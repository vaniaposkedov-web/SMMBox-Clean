const { Worker } = require('bullmq');
const { connection, WORKER_CONCURRENCY } = require('./queue');
const prisma = require('./utils/prisma');
const fs = require('fs');
const sharp = require('sharp');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const NETWORK_ERROR_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'ENETUNREACH', 'EHOSTUNREACH']);
const describeError = (error) => {
    const data = error.response?.data;
    // Клиент видит эту причину на сайте: технический текст на английском ему ничего не скажет.
    if (!data && NETWORK_ERROR_CODES.has(error.code)) return 'Нет связи с сервисом публикации. Попробуйте отправить пост ещё раз позже.';
    return String(data?.description || data?.message || error.message || 'Неизвестная ошибка').slice(0, 300);
};

// ИМПОРТИРУЕМ твои функции из postController. 
// ВАЖНО: Тебе нужно зайти в postController.js и убедиться, что ты экспортируешь эти функции (напиши exports.applyWatermark = applyWatermark и т.д.)
const { sendToTelegram, sendToKomodVK, applyWatermark, saveImageToFile, confirmSharedPostPublished } = require('./controllers/postController');

const worker = new Worker('posts_v2', async (job) => {
    const { postId, accountId, text, filePaths, watermarkConfig, signatureText } = job.data;
    
    console.log(`[WORKER] Начал обработку поста ${postId}`);

    try {
        const account = await prisma.account.findUnique({ where: { id: accountId } });
        if (!account) throw new Error('Аккаунт не найден');

        // 1. Читаем файлы с диска
        const rawImageBuffers = await Promise.all(filePaths.map(async (fp) => {
            return await fs.promises.readFile(fp);
        }));

        // 2. Сжимаем базово
        const optimizedBaseBuffers = await Promise.all(rawImageBuffers.map(async (buf) => {
            return await sharp(buf).resize({ width: 2500, height: 2500, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
        }));

        // 3. Водяной знак
        let processedBuffers = [...optimizedBaseBuffers];
        if (watermarkConfig && processedBuffers.length > 0) {
            processedBuffers = await Promise.all(processedBuffers.map(buf => applyWatermark(buf, watermarkConfig)));
        }

        // 4. Подпись
        let finalText = text;
        if (signatureText) {
            finalText += `\n\n${signatureText}`;
        }

        // 5. Отправка в соцсети
        const providerType = account.provider.toLowerCase(); 
        if (providerType === 'telegram') {
            const botToken = process.env.TELEGRAM_BOT_TOKEN.replace(/['"]/g, '').trim();
            await sendToTelegram(botToken, account.providerId, finalText, processedBuffers, {
                mediaAlreadySent: Boolean(job.data.telegramMediaSent),
                // Отметка хранится в очереди: при повторной попытке фото не уйдут в канал второй раз.
                onMediaSent: () => job.updateData({ ...job.data, telegramMediaSent: true }).catch((error) => {
                    console.error(`[WORKER] Отметка об отправке фото поста ${postId} не сохранена:`, error.message);
                }),
            });
            await sleep(2000); // 🟢 АНТИ-СПАМ: Задержка 2 секунды после отправки в ТГ
        } else if (providerType === 'vk') {
            await sendToKomodVK(process.env.KOMOD_TOKEN, account.providerId, finalText, processedBuffers, null, account.userId);
            await sleep(1000); // 🟢 АНТИ-СПАМ: Задержка 1 секунда для ВК
        }

        // 6. Сохраняем миниатюры для истории. Пост уже отправлен: сбой здесь не должен вызвать повторную публикацию.
        let thumbnailsUrls = null;
        try {
            thumbnailsUrls = await Promise.all(processedBuffers.map(async (buf) => {
                const thumbBuf = await sharp(buf).resize({ width: 400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 65 }).toBuffer();
                return await saveImageToFile(thumbBuf, 'history');
            }));
        } catch (thumbnailError) {
            console.error(`[WORKER] Миниатюры поста ${postId} не сохранены:`, thumbnailError.message);
        }

        // 7. ОБНОВЛЯЕМ БАЗУ - УСПЕХ!
        const publishedPost = await prisma.post.update({
            where: { id: postId },
            data: { status: 'PUBLISHED', errorMessage: null, ...(thumbnailsUrls ? { mediaUrls: JSON.stringify(thumbnailsUrls) } : {}) }
        });

        // 8. Пост от партнёра: только теперь он считается опубликованным. Сбой здесь не должен вызвать повторную публикацию.
        if (publishedPost.sharedPostId) {
            try {
                await confirmSharedPostPublished(publishedPost.sharedPostId);
            } catch (confirmError) {
                console.error(`[WORKER] Отметка поста партнёра ${publishedPost.sharedPostId} не сохранена:`, confirmError.message);
            }
        }

        console.log(`[WORKER] Успешно завершил пост ${postId}`);

    } catch (error) {
        console.error(`[WORKER ERROR] Ошибка поста ${postId}:`, error.message);
        
        // Очередь повторит отправку сама, поэтому ошибкой считается только последняя попытка
        const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);
        await prisma.post.update({
            where: { id: postId },
            data: isLastAttempt ? { status: 'FAILED', errorMessage: describeError(error) } : { errorMessage: describeError(error) }
        });
        
        throw error; // Чтобы BullMQ знал, что задача провалилась
    }
}, { 
    connection, 
    concurrency: WORKER_CONCURRENCY // ВАЖНО: ограничение, чтобы не убить процессор
});

module.exports = worker;