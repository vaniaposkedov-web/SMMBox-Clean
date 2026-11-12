const { Worker, UnrecoverableError, DelayedError } = require('bullmq');
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
const { sendToTelegram, sendToKomodVK, resumeKomodVK, isKomodBackgroundTarget, applyWatermark, saveImageToFile, confirmSharedPostPublished } = require('./controllers/postController');

// Ответ сервиса «так нельзя» (нет прав, канал удалён) не изменится от повтора: ошибка показывается сразу.
const isPermanentError = (error) => error instanceof UnrecoverableError || error.code === 'KOMOD_POST_FAILED' || [400, 401, 403, 404].includes(error.response?.status);

// Telegram просит подождать: ждём столько, сколько он сказал, и только потом занимаем следующую попытку.
const waitIfRateLimited = async (error) => {
    if (error.response?.status !== 429) return;
    const seconds = Number(error.response.data?.parameters?.retry_after) || 5;
    await sleep(Math.min(seconds, 60) * 1000);
};

// Основа фото готовится один раз на публикацию: при 28 каналах это 28 одинаковых сжатий одних и тех же файлов.
const BASE_SUFFIX = '.base.jpg';
const getOptimizedBase = async (filePath) => {
    const cached = filePath + BASE_SUFFIX;
    try {
        return await fs.promises.readFile(cached);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    const buffer = await sharp(await fs.promises.readFile(filePath))
        .resize({ width: 2500, height: 2500, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
    // Запись через временное имя: соседняя задача не прочитает файл наполовину.
    const temporary = `${cached}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.promises.writeFile(temporary, buffer);
    try {
        await fs.promises.rename(temporary, cached);
    } catch (error) {
        await fs.promises.unlink(temporary).catch((cleanupError) => console.error('[WORKER] Временный файл кэша не удалён:', cleanupError.message));
        if (!['EEXIST', 'EPERM'].includes(error.code)) throw error;
    }
    return buffer;
};

// Сколько постов одного человека могут одновременно ждать подтверждения от Kom-OD.
// Остальные его посты ждут в очереди и никому не мешают. Неизвестно, сколько заданий сразу выдерживает Kom-OD, поэтому предел осторожный.
const KOMOD_MAX_ACTIVE_PER_USER = process.env.KOMOD_MAX_ACTIVE_PER_USER === undefined ? 5 : Number(process.env.KOMOD_MAX_ACTIVE_PER_USER);
const KOMOD_SLOT_RECHECK_MS = Number(process.env.KOMOD_TEST_POLL_MS) || 10_000;

// Номер задания Kom-OD должен попасть в базу: по нему пост найдёт фоновая проверка.
const saveKomodTask = async (postId, taskId, sentAt) => {
    for (let attempt = 1; ; attempt += 1) {
        try {
            await prisma.post.updateMany({ where: { id: postId, status: 'DELIVERING' }, data: { komodTaskId: String(taskId), komodSentAt: new Date(sentAt || Date.now()) } });
            return;
        } catch (error) {
            if (attempt >= 3) throw error;
            await sleep(1000);
        }
    }
};

// Миниатюры для истории постов. Сбой здесь не должен влиять на публикацию.
const saveThumbnails = async (postId, buffers, statuses) => {
    try {
        const urls = await Promise.all(buffers.map(async (buf) => {
            const thumbBuf = await sharp(buf).resize({ width: 400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 65 }).toBuffer();
            return await saveImageToFile(thumbBuf, 'history', 'webp');
        }));
        if (urls.length) await prisma.post.updateMany({ where: { id: postId, status: { in: statuses } }, data: { mediaUrls: JSON.stringify(urls) } });
    } catch (thumbnailError) {
        console.error(`[WORKER] Миниатюры поста ${postId} не сохранены:`, thumbnailError.message);
    }
};

const worker = new Worker('posts_v2', async (job, token) => {
    const { postId, accountId, text, filePaths, watermarkConfig, signatureText } = job.data;
    let dispatchStarted = false;
    let providerDelivered = false;
    let komodBackground = false;

    console.log(`[WORKER] Начал обработку поста ${postId}`);

    try {
        // Пост удалили, пока он ждал очереди, или он уже вышел: публиковать нельзя.
        const currentPost = await prisma.post.findUnique({ where: { id: postId }, select: { status: true, sharedPostId: true } });
        if (!currentPost) {
            console.log(`[WORKER] Пост ${postId} удалён, публикация отменена`);
            return;
        }
        if (currentPost.status === 'PUBLISHED') {
            console.log(`[WORKER] Пост ${postId} уже опубликован, повтор пропущен`);
            return;
        }
        // Сервер перезапустился, пока пост ВК ждал ответа Kom-OD. Пост уже у Kom-OD: продолжаем следить за тем же заданием.
        const resumeKomod = currentPost.status === 'DELIVERING' && Boolean(job.data.komodTaskId);
        if (currentPost.status === 'DELIVERING' && !resumeKomod) {
            await prisma.post.updateMany({
                where: { id: postId, status: 'DELIVERING' },
                data: { status: 'DELIVERY_UNKNOWN', errorMessage: 'Связь прервалась во время отправки. Проверьте канал перед повторной публикацией.' }
            });
            console.error(`[WORKER] Результат отправки поста ${postId} неизвестен; автоматический повтор запрещён`);
            return;
        }
        if (currentPost.status === 'DELIVERY_UNKNOWN') return;

        const account = await prisma.account.findUnique({ where: { id: accountId } });
        if (!account) throw new Error('Аккаунт не найден');

        // Пост ВК только передаётся в Kom-OD и сразу освобождает место: подтверждение ждёт фоновая проверка.
        komodBackground = account.provider.toLowerCase() === 'vk' && isKomodBackgroundTarget(account.providerId);

        if (komodBackground && resumeKomod) {
            // Сервер перезапустился между «Kom-OD принял» и записью в базу: дописываем номер задания, заново ничего не отправляем.
            await saveKomodTask(postId, job.data.komodTaskId, job.data.komodSentAt);
            console.log(`[WORKER] Пост ${postId}: задание Kom-OD ${job.data.komodTaskId} передано фоновой проверке`);
            return;
        }

        if (komodBackground && KOMOD_MAX_ACTIVE_PER_USER > 0) {
            const active = await prisma.post.count({ where: { status: 'DELIVERING', komodTaskId: { not: null }, account: { userId: account.userId } } });
            if (active >= KOMOD_MAX_ACTIVE_PER_USER) {
                await job.moveToDelayed(Date.now() + KOMOD_SLOT_RECHECK_MS, token);
                throw new DelayedError();
            }
        }

        // 1-2. Читаем файлы и готовим основу фото (один раз на публикацию)
        const optimizedBaseBuffers = await Promise.all(filePaths.map(getOptimizedBase));

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
        if (!['telegram', 'vk'].includes(providerType)) {
            throw new UnrecoverableError(`Неизвестный канал публикации: ${account.provider}`);
        }

        if (!resumeKomod) {
            const dispatch = await prisma.post.updateMany({
                where: { id: postId, status: 'PROCESSING' },
                data: { status: 'DELIVERING', errorMessage: null, komodTaskId: null, komodSentAt: null }
            });
            if (dispatch.count === 0) throw new UnrecoverableError('Статус публикации изменился до отправки');
        }
        dispatchStarted = true;
        // Пост уже ушёл в канал, а следующий шаг сорвался: повторная попытка не должна опубликовать его второй раз.
        if (job.data.delivered) {
            providerDelivered = true;
            console.log(`[WORKER] Пост ${postId} уже отправлен, повтор только сохраняет результат`);
        } else if (providerType === 'telegram') {
            const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').replace(/['"]/g, '').trim();
            if (!botToken) throw new UnrecoverableError('TELEGRAM_BOT_TOKEN не настроен');
            await sendToTelegram(botToken, account.providerId, finalText, processedBuffers, {
                mediaAlreadySent: Boolean(job.data.telegramMediaSent),
                onMediaSent: async () => {
                    await job.updateData({ ...job.data, telegramMediaSent: true });
                },
            });
            providerDelivered = true;
            await sleep(2000); // 🟢 АНТИ-СПАМ: Задержка 2 секунды после отправки в ТГ
        } else if (providerType === 'vk') {
            if (!process.env.KOMOD_TOKEN) throw new UnrecoverableError('KOMOD_TOKEN не настроен');
            if (komodBackground) {
                let sentAt = Date.now();
                const taskId = await sendToKomodVK(process.env.KOMOD_TOKEN, account.providerId, finalText, processedBuffers, null, account.userId, postId, async (acceptedId) => {
                    sentAt = Date.now();
                    await job.updateData({ ...job.data, komodTaskId: acceptedId, komodSentAt: sentAt });
                }, { background: true });
                providerDelivered = true;
                await saveKomodTask(postId, taskId, sentAt);
                await saveThumbnails(postId, processedBuffers, ['DELIVERING', 'PUBLISHED']);
                console.log(`[WORKER] Пост ${postId} передан в Kom-OD (задание ${taskId}), место в очереди свободно`);
                return;
            }
            if (resumeKomod) {
                console.log(`[WORKER] Пост ${postId}: после перезапуска продолжаем следить за заданием Kom-OD ${job.data.komodTaskId}`);
                await resumeKomodVK(process.env.KOMOD_TOKEN, job.data.komodTaskId, job.data.komodSentAt, account.providerId, account.userId, postId);
            } else {
                await sendToKomodVK(process.env.KOMOD_TOKEN, account.providerId, finalText, processedBuffers, null, account.userId, postId, async (taskId) => {
                    await job.updateData({ ...job.data, komodTaskId: taskId, komodSentAt: Date.now() });
                });
            }
            providerDelivered = true;
            await sleep(1000); // 🟢 АНТИ-СПАМ: Задержка 1 секунда для ВК
        }

        const publishedPost = await prisma.post.update({
            where: { id: postId },
            data: { status: 'PUBLISHED', errorMessage: null }
        });
        if (!job.data.delivered) await job.updateData({ ...job.data, delivered: true });

        // 6. Сохраняем миниатюры для истории. Пост уже отправлен: сбой здесь не должен вызвать повторную публикацию.
        let thumbnailsUrls = null;
        try {
            thumbnailsUrls = await Promise.all(processedBuffers.map(async (buf) => {
                const thumbBuf = await sharp(buf).resize({ width: 400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 65 }).toBuffer();
                return await saveImageToFile(thumbBuf, 'history', 'webp');
            }));
        } catch (thumbnailError) {
            console.error(`[WORKER] Миниатюры поста ${postId} не сохранены:`, thumbnailError.message);
        }

        // 7. ОБНОВЛЯЕМ БАЗУ - УСПЕХ!
        if (thumbnailsUrls?.length) {
            await prisma.post.updateMany({ where: { id: postId, status: 'PUBLISHED' }, data: { mediaUrls: JSON.stringify(thumbnailsUrls) } });
        }

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
        if (error instanceof DelayedError) throw error; // Пост ждёт своей очереди у Kom-OD: это не ошибка, попытка не тратится
        console.error(`[WORKER ERROR] Ошибка поста ${postId}:`, error.message);

        await waitIfRateLimited(error);

        const isPermanent = isPermanentError(error);
        const isRateLimited = error.response?.status === 429;
        const isLastAttempt = isPermanent || job.attemptsMade + 1 >= (job.opts.attempts || 1);

        // Пост точно не дошёл до Kom-OD (нет связи со списком групп, группа не подключена, прямой отказ).
        // Дубля быть не может, поэтому это обычная ошибка с кнопкой «Повторить», а не «результат неизвестен».
        if (komodBackground && error.komodNotSent && !providerDelivered && !job.data.komodTaskId) {
            const final = error.komodPermanent || isLastAttempt;
            await prisma.post.updateMany({
                where: { id: postId, status: { in: ['PROCESSING', 'DELIVERING'] } },
                data: final ? { status: 'FAILED', errorMessage: describeError(error) } : { status: 'PROCESSING', errorMessage: null }
            }).catch((updateError) => console.error(`[WORKER ERROR] Статус поста ${postId} не сохранён:`, updateError.message));
            if (final) throw new UnrecoverableError(error.message);
            throw error; // BullMQ повторит попытку
        }
        const postState = await prisma.post.findUnique({ where: { id: postId }, select: { status: true } }).catch((stateError) => {
            console.error(`[WORKER ERROR] Не удалось проверить статус поста ${postId}:`, stateError.message);
            return null;
        });
        if (postState?.status === 'PUBLISHED') {
            throw new UnrecoverableError('Пост уже опубликован; повторная отправка отменена.');
        }

        let update = {};
        if (dispatchStarted || postState?.status === 'DELIVERING') {
            if (isRateLimited && !providerDelivered) {
                update = { status: 'PROCESSING', errorMessage: describeError(error) };
            } else if (job.data.telegramMediaSent || providerDelivered || !postState) {
                update = { status: 'DELIVERY_UNKNOWN', errorMessage: 'Ответ сервиса публикации не получен. Проверьте канал перед повторной публикацией.' };
            } else if (isPermanent) {
                update = { status: 'FAILED', errorMessage: describeError(error) };
            } else {
                update = { status: 'DELIVERY_UNKNOWN', errorMessage: 'Ответ сервиса публикации не получен. Проверьте канал перед повторной публикацией.' };
            }
        } else {
            update = isLastAttempt ? { status: 'FAILED', errorMessage: describeError(error) } : { errorMessage: describeError(error) };
        }
        await prisma.post.updateMany({ where: { id: postId }, data: update }).catch((updateError) => console.error(`[WORKER ERROR] Статус поста ${postId} не сохранён:`, updateError.message));

        if (isPermanent || ((dispatchStarted || postState?.status === 'DELIVERING') && (!isRateLimited || providerDelivered))) {
            throw new UnrecoverableError(error.message);
        }
        throw error; // Чтобы BullMQ знал, что задача провалилась
    }
}, { 
    connection, 
    concurrency: WORKER_CONCURRENCY // ВАЖНО: ограничение, чтобы не убить процессор
});

module.exports = worker;
