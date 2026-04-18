const { Worker } = require('bullmq');
const { connection } = require('./queue');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
const sharp = require('sharp');

// ИМПОРТИРУЕМ твои функции из postController. 
// ВАЖНО: Тебе нужно зайти в postController.js и убедиться, что ты экспортируешь эти функции (напиши exports.applyWatermark = applyWatermark и т.д.)
const { sendToTelegram, sendToKomodVK, applyWatermark, saveImageToFile } = require('./controllers/postController');

const worker = new Worker('posts', async (job) => {
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
            await sendToTelegram(botToken, account.providerId, finalText, processedBuffers);
        } else if (providerType === 'vk') {
            await sendToKomodVK(account.accessToken, account.providerId, finalText, processedBuffers, null, account.userId);
        }

        // 6. Сохраняем миниатюры для истории
        const thumbnailsUrls = await Promise.all(processedBuffers.map(async (buf) => {
            const thumbBuf = await sharp(buf).resize({ width: 400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 65 }).toBuffer();
            return await saveImageToFile(thumbBuf, 'history');
        }));

        // 7. ОБНОВЛЯЕМ БАЗУ - УСПЕХ!
        await prisma.post.update({
            where: { id: postId },
            data: { status: 'PUBLISHED', mediaUrls: JSON.stringify(thumbnailsUrls) }
        });

        // 8. Удаляем временные файлы загруженные через Multer
        filePaths.forEach(fp => fs.promises.unlink(fp).catch(() => {}));
        
        console.log(`[WORKER] Успешно завершил пост ${postId}`);

    } catch (error) {
        console.error(`[WORKER ERROR] Ошибка поста ${postId}:`, error.message);
        
        // ОБНОВЛЯЕМ БАЗУ - ОШИБКА!
        await prisma.post.update({
            where: { id: postId },
            data: { status: 'FAILED' }
        });
        
        throw error; // Чтобы BullMQ знал, что задача провалилась
    }
}, { 
    connection, 
    concurrency: 3 // ВАЖНО: Воркер будет обрабатывать максимум 3 поста одновременно, чтобы не убить процессор
});

module.exports = worker;