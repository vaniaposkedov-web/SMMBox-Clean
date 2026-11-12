const prisma = require('../utils/prisma');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const cron = require('node-cron');
const { logPost } = require('../utils/log_post');
const fs = require('fs');
const path = require('path');
const { postQueue, WORKER_CONCURRENCY } = require('../queue');
const { getUserLimits, getAllowedAccountIds, NO_SUBSCRIPTION_ERROR } = require('../utils/limits');
const { escapeXml } = require('../utils/security');
const { telegramHttp } = require('../utils/telegramClient');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Настройки KOMOD_TEST_* нужны только проверкам на имитации: там 15 минут сокращаются до секунд. На сервере их нет.
const KOMOD_CONFIRM_MS = Number(process.env.KOMOD_TEST_CONFIRM_MS) || 15 * 60_000;
const KOMOD_POLL_MS = Number(process.env.KOMOD_TEST_POLL_MS) || 5000;

// Для каких групп ВК команда «включить сетку» отправляется не перед каждым постом, а только когда нужно.
// Список адресов через запятую (group_123,wall_456) или all — для всех. Пусто — как раньше, перед каждым постом.
const GRID_CHECK_TARGETS = String(process.env.KOMOD_GRID_CHECK_TARGETS || '').split(',').map((item) => item.trim()).filter(Boolean);
const isGridCheckTarget = (providerId) => GRID_CHECK_TARGETS.includes('all') || GRID_CHECK_TARGETS.includes(String(providerId));
// Если Kom-OD не сообщает, включена ли сетка, команда повторяется раз в сутки (и после перезапуска сервера).
const GRID_REFRESH_MS = 24 * 60 * 60 * 1000;
const gridSetAt = new Map();

const isKomodFlag = (value) => value === true || value === 1 || String(value) === '1';

// === РАЗГРУЗКА ОЧЕРЕДИ ВК ===
// Раньше пост ВК занимал место в очереди, пока Kom-OD не подтвердит публикацию (до 15 минут), и задерживал всех.
// Для адресов из KOMOD_BACKGROUND_TARGETS (список через запятую или all) пост только передаётся в Kom-OD,
// место освобождается сразу, а подтверждения собирает фоновая проверка trackKomodPosts.
const KOMOD_API_URL = 'https://kom-od.ru/api/v1';
const BACKGROUND_TARGETS = String(process.env.KOMOD_BACKGROUND_TARGETS || '').split(',').map((item) => item.trim()).filter(Boolean);
const isKomodBackgroundTarget = (providerId) => BACKGROUND_TARGETS.includes('all') || BACKGROUND_TARGETS.includes(String(providerId));

// Список групп Kom-OD общий на всех клиентов и растёт вместе с ними: при пачке постов он скачивается один раз в минуту, а не перед каждым постом.
const KOMOD_GROUPS_TTL_MS = 60_000;
let komodGroupsCache = { at: 0, groups: null };
const fetchKomodGroups = async (token, { useCache = false } = {}) => {
    if (useCache && komodGroupsCache.groups && Date.now() - komodGroupsCache.at < KOMOD_GROUPS_TTL_MS) return komodGroupsCache.groups;
    const res = await axios.get(`${KOMOD_API_URL}/group`, { headers: { 'Access-Token': token }, timeout: 30_000 });
    const groups = res.data?.data?.items || res.data?.data || [];
    komodGroupsCache = { at: Date.now(), groups };
    return groups;
};

// Пост точно не дошёл до Kom-OD (сбой до передачи или прямой отказ): его можно отправить ещё раз без риска дубля.
// permanent: повтор не поможет, пока человек что-то не исправит.
const komodNotSent = (error, permanent = false) => {
    error.komodNotSent = true;
    error.komodPermanent = permanent;
    return error;
};

async function waitForKomodPublication(token, postData, userId, providerId, internalPostId, deadlineAt = null) {
    const postId = String(postData?.id || '');
    if (!postId) {
        const error = new Error('Kom-OD не вернул ID задания публикации');
        error.code = 'KOMOD_POST_UNCONFIRMED';
        throw error;
    }

    // Kom-OD может записать «ошибка», а потом сам повторить и опубликовать пост: так было и через минуту, и через 13 минут.
    // Поэтому итог ставится только через 15 минут: опубликовано — сразу успех, иначе ошибка или «нет подтверждения».
    // Сайт обещает клиенту эти же 15 минут (VK_CONFIRM_MINUTES в Publish.jsx).
    const deadline = deadlineAt || Date.now() + KOMOD_CONFIRM_MS;
    let state = postData;
    let lastSnapshot = '';
    let reportedFailure = false;

    while (Date.now() < deadline) {
        const task = state?.task || {};
        const snapshot = JSON.stringify({
            published: state?.published ?? null,
            fail: state?.fail ?? null,
            runCounter: task.run_counter ?? null,
            allowRetry: task.allow_retry ?? null,
            isCompleted: task.is_completed ?? null
        });

        if (snapshot !== lastSnapshot) {
            logPost(userId, 'VK', 'API_RESPONSE', 'Статус задания Kom-OD', {
                postId,
                published: state?.published ?? null,
                fail: state?.fail ?? null,
                runCounter: task.run_counter ?? null,
                allowRetry: task.allow_retry ?? null,
                isCompleted: task.is_completed ?? null
            });
            lastSnapshot = snapshot;

            const retryMessage = isKomodFlag(state?.fail) && isKomodFlag(task.allow_retry)
                ? `Kom-OD не подтвердил первую попытку и оставил задание на повторную обработку (задание ${postId}, попытка ${task.run_counter || 1}). Не отправляйте этот пост повторно.`
                : (Number(task.run_counter || 0) > 0
                    ? `Kom-OD обрабатывает публикацию (задание ${postId}, попытка ${task.run_counter}).`
                    : null);
            if (internalPostId) {
                try {
                    await prisma.post.updateMany({
                        where: { id: internalPostId, status: 'DELIVERING' },
                        data: { errorMessage: retryMessage }
                    });
                } catch (error) {
                    console.error(`[KOMOD STATUS] Не удалось сохранить статус задания ${postId}:`, error.message);
                }
            }
        }

        if (isKomodFlag(state?.published)) return postId;
        reportedFailure = isKomodFlag(state?.fail) || isKomodFlag(task.is_completed);

        await sleep(KOMOD_POLL_MS);
        try {
            const statusRes = await axios.get(`https://kom-od.ru/api/v1/post/${encodeURIComponent(postId)}`, {
                headers: { 'Access-Token': token },
                timeout: 15000,
                validateStatus: () => true
            });
            if (statusRes.status < 400 && statusRes.data?.success !== false && statusRes.data?.data) {
                state = statusRes.data.data;
            }
        } catch (error) {
            logPost(userId, 'VK', 'API_CHECK_ERROR', `Не удалось проверить задание ${postId}`, {
                code: error.code || null,
                httpStatus: error.response?.status || null
            });
        }
    }

    if (reportedFailure) {
        const error = new Error(`Kom-OD завершил задание ${postId} с ошибкой и не опубликовал его за 15 минут`);
        error.code = 'KOMOD_POST_FAILED';
        throw error;
    }
    const error = new Error(`Kom-OD не подтвердил публикацию задания ${postId} за 15 минут`);
    error.code = 'KOMOD_POST_UNCONFIRMED';
    throw error;
}

// === ЛОГИКА ОТПРАВКИ В TELEGRAM ===
// Telegram принимает до 1024 символов под фото и до 4096 в одном сообщении.
const TELEGRAM_CAPTION_LIMIT = 1024;
const TELEGRAM_MESSAGE_LIMIT = 4096;

const splitTelegramText = (text) => {
    const parts = [];
    let rest = String(text || '');
    while (rest.length > TELEGRAM_MESSAGE_LIMIT) {
        const chunk = rest.slice(0, TELEGRAM_MESSAGE_LIMIT);
        const lastBreak = Math.max(chunk.lastIndexOf('\n'), chunk.lastIndexOf(' '));
        const end = lastBreak > 0 ? lastBreak : TELEGRAM_MESSAGE_LIMIT;
        parts.push(rest.slice(0, end));
        rest = rest.slice(end).trimStart();
    }
    parts.push(rest);
    return parts;
};

// Длинный текст не помещается под фото: сначала уходят фото, затем текст отдельным сообщением.
// mediaAlreadySent и onMediaSent нужны для повторной попытки: фото не должны выйти в канал второй раз.
async function sendToTelegram(token, chatId, text, imageBuffers, { mediaAlreadySent = false, onMediaSent = null } = {}) {
    const baseUrl = `https://api.telegram.org/bot${token}`;
    const hasPhotos = imageBuffers.length > 0;
    const caption = hasPhotos && text && text.length <= TELEGRAM_CAPTION_LIMIT ? text : '';

    if (hasPhotos && !mediaAlreadySent) {
        const form = new FormData();
        form.append('chat_id', chatId);

        if (imageBuffers.length === 1) {
            if (caption) form.append('caption', caption);
            form.append('photo', imageBuffers[0], { filename: 'image.jpg', contentType: 'image/jpeg', knownLength: imageBuffers[0].length });
            await telegramHttp.post(`${baseUrl}/sendPhoto`, form, { headers: form.getHeaders() });
        } else {
            const media = imageBuffers.map((buf, i) => ({
                type: 'photo',
                media: `attach://photo${i}`,
                caption: i === 0 ? caption : ''
            }));

            form.append('media', JSON.stringify(media));
            imageBuffers.forEach((buf, i) => {
                form.append(`photo${i}`, buf, { filename: `photo${i}.jpg`, contentType: 'image/jpeg', knownLength: buf.length });
            });

            await telegramHttp.post(`${baseUrl}/sendMediaGroup`, form, { headers: form.getHeaders() });
        }

        if (onMediaSent) await onMediaSent();
    }

    if (!hasPhotos || (text && !caption)) {
        for (const part of splitTelegramText(text)) {
            await telegramHttp.post(`${baseUrl}/sendMessage`, { chat_id: chatId, text: part });
        }
    }
}


async function saveImageToFile(buffer, prefix = 'img', extension = 'jpg') {
    // Путь к папке backend/uploads/posts
    const uploadsDir = path.join(__dirname, '../../uploads/posts');
    
    // Автоматически создаем папку, если ее нет
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Генерируем уникальное имя файла
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
    const filePath = path.join(uploadsDir, fileName);
    
    // Сохраняем физический файл на диск
    await fs.promises.writeFile(filePath, buffer);
    
    // Возвращаем относительный URL для базы данных
    return `/uploads/posts/${fileName}`;
}

// === ЛОГИКА ОТПРАВКИ KOM-OD (ВК) ===
// После перезапуска сервера: пост уже передан в Kom-OD, следим за тем же заданием до конца его 15 минут, ничего не отправляя заново.
async function resumeKomodVK(token, taskId, sentAt, providerId, userId, internalPostId) {
    logPost(userId, 'VK', 'RESUME', `Сервер перезапустился, продолжаем следить за заданием ${taskId}`);
    // Хотя бы одна проверка состоится, даже если сервер простоял дольше 15 минут.
    const deadlineAt = Math.max(Number(sentAt) + KOMOD_CONFIRM_MS, Date.now() + 3 * KOMOD_POLL_MS);
    await waitForKomodPublication(token, { id: taskId }, userId, providerId, internalPostId, deadlineAt);
    logPost(userId, 'VK', 'SUCCESS', `Пост успешно улетел в ${providerId}`);
}

// onAccepted(taskId): Kom-OD принял пост. Номер задания запоминается, чтобы после перезапуска сервера продолжить слежение.
// options.background: не ждать публикации, а сразу вернуть номер задания Kom-OD (дальше следит фоновая проверка).
async function sendToKomodVK(token, providerId, text, imageBuffers, publishAtDate = null, userId = 'CRON', internalPostId = null, onAccepted = null, options = {}) {
    const KOMOD_BASE_URL = KOMOD_API_URL;
    const background = Boolean(options.background);
    const form = new FormData();

    let targetGroupId = null;
    const cleanId = providerId.replace('wall_', '').replace('group_', '');


    logPost(userId, 'VK', 'START', `Начинаем отправку. Провайдер: ${providerId}`);

    // Ключ шлюза общий на всех клиентов, поэтому ищем только среди групп аккаунтов этого пользователя
    // и только по точному совпадению номера или адреса группы.
    const ownProfiles = await prisma.socialProfile.findMany({
        where: { userId: String(userId), provider: 'VK' },
        select: { providerAccountId: true }
    });
    const ownAccountIds = new Set(ownProfiles.map((profile) => String(profile.providerAccountId)));
    const urlTail = (group) => String(group.url || '').replace(/\/+$/, '').split('/').pop().replace(/^(club|public|event|id)(?=\d)/, '');
    const findTarget = (groups) => groups.find((group) => (
        ownAccountIds.has(String(group.account_id)) &&
        (String(group.uid || group.id) === cleanId || urlTail(group) === cleanId)
    ));

    let targetGroup;
    try {
        targetGroup = findTarget(await fetchKomodGroups(token, { useCache: background }));
        // Группу могли подключить минуту назад: в сохранённом списке её ещё нет.
        if (!targetGroup && background) targetGroup = findTarget(await fetchKomodGroups(token));
    } catch (error) {
        logPost(userId, 'VK', 'ERROR', 'Не удалось получить список групп Kom-OD', { code: error.code || null, httpStatus: error.response?.status || null });
        throw komodNotSent(error);
    }

    if (!targetGroup) {
        logPost(userId, 'VK', 'ERROR', `Группа ${providerId} не найдена среди подключённых аккаунтов`);
        throw komodNotSent(new Error('Группа не подключена в Kom-OD. Подключите её заново в разделе «Аккаунты и страницы».'), true);
    }

    // Фото должны выходить сеткой. Настройка хранится у группы в Kom-OD, и раньше она отправлялась перед каждым постом.
    // Проверяем догадку, что эта команда прямо перед постом срывает первую попытку Kom-OD (у групп она падала в 7 случаях из 12).
    // Для групп из KOMOD_GRID_CHECK_TARGETS команда уходит, только если сетка выключена или давно не подтверждалась.
    const gridKnown = targetGroup.post_images_as_grid !== undefined && targetGroup.post_images_as_grid !== null;
    const gridIsOn = gridKnown && isKomodFlag(targetGroup.post_images_as_grid);
    const gridSetRecently = Date.now() - (gridSetAt.get(String(targetGroup.id)) || 0) < GRID_REFRESH_MS;
    const skipGridUpdate = isGridCheckTarget(providerId) && (gridKnown ? gridIsOn : gridSetRecently);
    if (isGridCheckTarget(providerId)) {
        logPost(userId, 'VK', 'GRID', skipGridUpdate ? `Сетка уже включена у ${targetGroup.id}, команда не отправляется` : `Включаем сетку у ${targetGroup.id}`, {
            fieldInKomodAnswer: gridKnown,
            value: gridKnown ? String(targetGroup.post_images_as_grid) : null,
            groupFields: Object.keys(targetGroup)
        });
    }

    // 🔥 ИДЕАЛЬНАЯ КОПИЯ CURL-ЗАПРОСА АЛЕКСЕЯ
    if (!skipGridUpdate) {
        try {
            const upRes = await axios.post(
                `${KOMOD_BASE_URL}/group/${targetGroup.id}`,
                'post_images_as_grid=1', // Отправляем чистую строку, как в curl -d
                {
                    headers: {
                        'Access-Token': token,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: 20_000,
                    validateStatus: () => true
                }
            );
            if (upRes.status < 400) gridSetAt.set(String(targetGroup.id), Date.now());
            logPost(userId, 'VK', 'INFO', `СЕТКА: Обновлена для ${targetGroup.id}. Ответ шлюза: HTTP ${upRes.status}`);
        } catch (e) {
            logPost(userId, 'VK', 'ERROR', `Ошибка обновления группы: ${e.message}`);
        }
    }

    targetGroupId = targetGroup.id;
    form.append('group_id', targetGroupId);
    
    // 🔥 ПАРАМЕТРЫ ПОСТИНГА
    const viaApiMode = '1';
    form.append('via_api', viaApiMode); // Просим Kom-OD сразу отправить пост через API.
    form.append('post_images_as_grid', '1'); // Дублируем в тело поста для верности

    const targetDate = publishAtDate ? new Date(publishAtDate) : new Date();
    if (Number.isNaN(targetDate.getTime())) throw new Error('Некорректное время публикации ВК');
    const tzString = targetDate.toLocaleString('sv-SE', { timeZone: 'Europe/Moscow' });
    const publishAt = tzString.substring(0, 16).replace('T', ' ');
    form.append('publish_at', publishAt);
    
    const media = [];
    if (text) media.push({ type: 'text', text: text });

    if (imageBuffers && imageBuffers.length > 0) {
        const images = [];
        imageBuffers.forEach((buf, index) => {
            const fileName = `file_${index + 1}`;
            images.push({ name: fileName });
            form.append(fileName, buf, { 
                filename: `photo_${Date.now()}_${index}.jpg`, 
                contentType: 'image/jpeg',
                knownLength: buf.length 
            });
        });
        media.push({ type: 'photo', images: images });
    }

    form.append('media', JSON.stringify(media));

    logPost(userId, 'VK', 'API_REQUEST', 'Структура запроса публикации в Kom-OD', {
        groupId: targetGroupId,
        viaApi: viaApiMode,
        publishAt,
        media: media.map((item) => ({
            type: item.type,
            imageNames: item.images?.map((image) => image.name) || []
        })),
        fileParts: (imageBuffers || []).map((buffer, index) => ({
            field: `file_${index + 1}`,
            contentType: 'image/jpeg',
            bytes: buffer.length
        }))
    });

    try {
        const postRes = await axios.post(`${KOMOD_BASE_URL}/post`, form, {
            headers: { ...form.getHeaders(), 'Access-Token': token },
            maxBodyLength: Infinity,
            timeout: 120 * 1000,
            validateStatus: (status) => status >= 200 && status < 300
        });

        const responseData = postRes.data;
        const responseErrors = responseData?.errors;
        const errorDetails = responseData?.error || responseErrors || responseData?.message;
        const hasErrors = Array.isArray(responseErrors) ? responseErrors.length > 0 : Boolean(responseErrors);
        if (postRes.status < 200 || postRes.status >= 300 || responseData?.success === false || responseData?.error || hasErrors) {
            const details = errorDetails || `HTTP ${postRes.status}`;
            const gatewayError = new Error('Ошибка шлюза: ' + (typeof details === 'string' ? details : JSON.stringify(details)));
            gatewayError.gatewayStatus = postRes.status;
            gatewayError.gatewayDetails = details;
            throw komodNotSent(gatewayError, true); // Kom-OD ответил отказом: задание не создано
        }

        const postData = responseData?.data;
        logPost(userId, 'VK', 'API_RESPONSE', 'Kom-OD принял запрос публикации', {
            httpStatus: postRes.status,
            success: responseData?.success ?? null,
            postId: postData?.id || responseData?.post_id || null,
            published: postData?.published ?? null,
            fail: postData?.fail ?? null,
            allowRetry: postData?.task?.allow_retry ?? null,
            runCounter: postData?.task?.run_counter ?? null,
            hasError: Boolean(responseData?.error || responseData?.errors)
        });

        if (onAccepted && postData?.id) await onAccepted(String(postData.id));
        if (background) {
            if (!postData?.id) {
                const error = new Error('Kom-OD не вернул ID задания публикации');
                error.code = 'KOMOD_POST_UNCONFIRMED';
                throw error;
            }
            return String(postData.id);
        }
        await waitForKomodPublication(token, postData, userId, providerId, internalPostId);
        logPost(userId, 'VK', 'SUCCESS', `Пост успешно улетел в ${providerId}`);
        return String(postData?.id || '');

    } catch (error) {
        const responseData = error.response?.data;
        const errorDetails = responseData?.errors || responseData?.error || responseData?.message || error.message;
        logPost(userId, 'VK', 'ERROR', 'Ошибка отправки', {
            httpStatus: error.response?.status || error.gatewayStatus || null,
            code: error.code || null,
            error: errorDetails
        });
        throw error;
    }
}

// === ФОНОВАЯ ПРОВЕРКА ПОСТОВ ВК ===
// Следит за постами, переданными в Kom-OD (статус DELIVERING и номер задания в базе), и ставит им итог:
// опубликовано — сразу «опубликован»; не опубликовано за 15 минут — «ошибка» или «нет подтверждения».
// Состояние хранится в базе, поэтому перезапуск сервера слежение не обрывает.
const KOMOD_TRACK_FAST_MS = KOMOD_POLL_MS * 2;   // Первые две минуты пост проверяется каждые 10 секунд
const KOMOD_TRACK_SLOW_MS = KOMOD_POLL_MS * 6;   // Дальше — каждые 30: Kom-OD повторяет попытку раз в 6 минут
const KOMOD_TRACK_FAST_PERIOD_MS = Number(process.env.KOMOD_TEST_CONFIRM_MS) ? KOMOD_CONFIRM_MS / 3 : 2 * 60_000;
const komodTrack = new Map(); // id поста → { nextCheckAt, snapshot, failed }
let komodTrackRunning = false;

const trackOneKomodPost = async (token, post) => {
    const memo = komodTrack.get(post.id) || {};
    const userId = post.account?.userId || 'CRON';
    const providerId = post.account?.providerId || '';
    const taskId = String(post.komodTaskId);
    const sentAt = post.komodSentAt ? new Date(post.komodSentAt).getTime() : Date.now();

    let state = null;
    try {
        const res = await axios.get(`${KOMOD_API_URL}/post/${encodeURIComponent(taskId)}`, {
            headers: { 'Access-Token': token },
            timeout: 15000,
            validateStatus: () => true
        });
        if (res.status < 400 && res.data?.success !== false && res.data?.data) state = res.data.data;
    } catch (error) {
        logPost(userId, 'VK', 'API_CHECK_ERROR', `Не удалось проверить задание ${taskId}`, { code: error.code || null });
    }

    if (state) {
        const task = state.task || {};
        const details = {
            postId: taskId,
            published: state.published ?? null,
            fail: state.fail ?? null,
            runCounter: task.run_counter ?? null,
            allowRetry: task.allow_retry ?? null,
            isCompleted: task.is_completed ?? null
        };
        const snapshot = JSON.stringify(details);
        if (snapshot !== memo.snapshot) {
            memo.snapshot = snapshot;
            logPost(userId, 'VK', 'API_RESPONSE', 'Статус задания Kom-OD', details);
        }

        if (isKomodFlag(state.published)) {
            const { count } = await prisma.post.updateMany({
                where: { id: post.id, status: 'DELIVERING' },
                data: { status: 'PUBLISHED', errorMessage: null }
            });
            komodTrack.delete(post.id);
            if (count > 0) {
                logPost(userId, 'VK', 'SUCCESS', `Пост успешно улетел в ${providerId}`);
                if (post.sharedPostId) {
                    await confirmSharedPostPublished(post.sharedPostId).catch((error) => console.error(`[KOMOD TRACK] Отметка поста партнёра ${post.sharedPostId} не сохранена:`, error.message));
                }
            }
            return;
        }
        memo.failed = isKomodFlag(state.fail) || isKomodFlag(task.is_completed);
    }

    const age = Date.now() - sentAt;
    if (age >= KOMOD_CONFIRM_MS) {
        const data = memo.failed
            ? { status: 'FAILED', errorMessage: `Kom-OD завершил задание ${taskId} с ошибкой и не опубликовал его за 15 минут` }
            : { status: 'DELIVERY_UNKNOWN', errorMessage: 'Ответ сервиса публикации не получен. Проверьте канал перед повторной публикацией.' };
        await prisma.post.updateMany({ where: { id: post.id, status: 'DELIVERING' }, data });
        komodTrack.delete(post.id);
        logPost(userId, 'VK', 'ERROR', 'Ошибка отправки', { code: memo.failed ? 'KOMOD_POST_FAILED' : 'KOMOD_POST_UNCONFIRMED', error: data.errorMessage });
        return;
    }

    memo.nextCheckAt = Date.now() + (age < KOMOD_TRACK_FAST_PERIOD_MS ? KOMOD_TRACK_FAST_MS : KOMOD_TRACK_SLOW_MS);
    komodTrack.set(post.id, memo);
};

exports.trackKomodPosts = async () => {
    if (komodTrackRunning) return { checked: 0 };
    komodTrackRunning = true;
    try {
        const token = process.env.KOMOD_TOKEN;
        if (!token) return { checked: 0 };
        const posts = await prisma.post.findMany({
            where: { status: 'DELIVERING', komodTaskId: { not: null } },
            select: { id: true, komodTaskId: true, komodSentAt: true, sharedPostId: true, account: { select: { userId: true, providerId: true } } },
            orderBy: { komodSentAt: 'asc' },
            take: 1000
        });
        const waiting = new Set(posts.map((post) => post.id));
        for (const id of komodTrack.keys()) if (!waiting.has(id)) komodTrack.delete(id);

        const now = Date.now();
        const due = posts.filter((post) => (komodTrack.get(post.id)?.nextCheckAt || 0) <= now);
        await mapLimit(due, 5, (post) => trackOneKomodPost(token, post).catch((error) => console.error(`[KOMOD TRACK] Пост ${post.id}:`, error.message)));
        return { checked: due.length, waiting: posts.length };
    } finally {
        komodTrackRunning = false;
    }
};

const getUserId = (req) => req.userId;

// Метка одного нажатия «Опубликовать»: повтор запроса при плохой связи не создаёт вторую публикацию.
const parseRequestKey = (value) => {
    const key = String(value || '');
    return /^[A-Za-z0-9-]{8,64}$/.test(key) ? key : null;
};

// Несколько задач сразу, но не больше limit одновременно: обработка фото сильно нагружает процессор.
const mapLimit = async (items, limit, work) => {
    const results = new Array(items.length);
    let next = 0;
    const runner = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await work(items[index], index);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
    return results;
};

const JOB_OPTIONS = { attempts: 3, backoff: { type: 'exponential', delay: 5000 } };
const TEMP_QUEUE_DIR = path.join(__dirname, '../../uploads/temp_queue');
// Фото, загруженные для постов и для партнёров, хранятся 7 дней. Срок указан в политике конфиденциальности.
const MEDIA_RETENTION_DAYS = 7;
const MEDIA_RETENTION_MS = MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const POSTS_MEDIA_DIR = path.join(__dirname, '../../uploads/posts');
const MEDIA_GONE_ERROR = `Фото этого поста уже удалены с сервера: они хранятся ${MEDIA_RETENTION_DAYS} дней. Создайте пост заново.`;
const parseJson = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch (e) { return fallback; } };

const removeUploadedFiles = (req) => Promise.all((req.files || []).map((file) => fs.promises.unlink(file.path).catch(() => {})));

// === ФОТО, КОТОРЫЕ УЖЕ ЛЕЖАТ НА СЕРВЕРЕ ===
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Имя фото, загруженного человеком при создании поста. В имени зашит его владелец: чужое фото взять нельзя.
const stagedMediaPath = (userId, mediaId) => {
    const mediaName = path.basename(String(mediaId));
    const ownerPrefix = `staged_${String(userId)}_`;
    if (mediaName !== mediaId || !mediaName.startsWith(ownerPrefix) || !/^[a-z0-9-]{36}\.jpg$/i.test(mediaName.slice(ownerPrefix.length))) return null;
    return path.join(TEMP_QUEUE_DIR, mediaName);
};

// Адрес вида /uploads/... из базы → файл на диске. Выйти за пределы папки uploads нельзя.
const resolveUploadUrl = (url) => {
    const value = String(url || '');
    if (!value.startsWith('/uploads/')) return null;
    const file = path.resolve(UPLOADS_DIR, value.slice('/uploads/'.length));
    return file.startsWith(UPLOADS_DIR + path.sep) ? file : null;
};

const allFilesExist = async (files) => {
    const checks = await Promise.all(files.map((file) => fs.promises.stat(file).then((stats) => stats.isFile(), () => false)));
    return checks.every(Boolean);
};

// Копия фото для партнёра: без пересжатия, поэтому мгновенно. Имя shared_* — такие файлы удаляются через 7 дней.
const copyToShared = async (file) => {
    await fs.promises.mkdir(POSTS_MEDIA_DIR, { recursive: true });
    const extension = path.extname(file).toLowerCase() === '.webp' ? 'webp' : 'jpg';
    const fileName = `shared_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${extension}`;
    await fs.promises.copyFile(file, path.join(POSTS_MEDIA_DIR, fileName));
    return `/uploads/posts/${fileName}`;
};

exports.uploadPostMedia = async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'Выберите изображение' });

    const userId = String(getUserId(req));
    const fileName = `staged_${userId}_${crypto.randomUUID()}.jpg`;
    const tempDir = TEMP_QUEUE_DIR;
    const safePath = path.join(tempDir, fileName);
    try {
        await fs.promises.mkdir(tempDir, { recursive: true });
        const metadata = await sharp(file.path, { failOn: 'none' }).metadata();
        console.info(`[UPLOAD] Фото format=${metadata.format || 'unknown'} ${metadata.width || 0}x${metadata.height || 0}, bytes=${file.size || 0}`);
        await sharp(file.path, { failOn: 'none' })
            .rotate()
            .resize({ width: 4000, height: 4000, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 90 })
            .toFile(safePath);
        return res.status(201).json({ success: true, mediaId: fileName });
    } catch (error) {
        await fs.promises.unlink(safePath).catch(() => {});
        console.error(`[UPLOAD] Не удалось обработать фото ${path.basename(file.originalname || 'photo')}:`, error.message);
        return res.status(400).json({ success: false, error: 'Не удалось обработать фото. Сохраните его как JPG или PNG.' });
    } finally {
        await fs.promises.unlink(file.path).catch(() => {});
    }
};

// Kom-OD обычно публикует пост примерно за минуту.
const SECONDS_PER_POST = 60;
const estimatePublishSeconds = async () => {
    try {
        const { waiting = 0, active = 0, delayed = 0 } = await postQueue.getJobCounts('waiting', 'active', 'delayed');
        const rounds = Math.max(1, Math.ceil((waiting + active + delayed) / WORKER_CONCURRENCY));
        return rounds * SECONDS_PER_POST;
    } catch (error) {
        return null;
    }
};

const safeColor = (value, fallback) =>(/^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? value : fallback);

// Настоящая ширина текста в выбранном шрифте: иначе широкие буквы обрезаются по краю знака.
async function measureTextWidth(text, fontFamily, fontSize) {
    const probeSize = 100;
    const svg = `<svg width="${Math.ceil(probeSize * (text.length * 1.5 + 2))}" height="${probeSize * 2}"><text x="${probeSize}" y="${probeSize * 1.4}" font-size="${probeSize}" style="font-family: ${fontFamily}; font-weight: bold;" fill="#fff">${escapeXml(text)}</text></svg>`;
    try {
        const { info } = await sharp(Buffer.from(svg)).trim().toBuffer({ resolveWithObject: true });
        return Math.ceil((info.width / probeSize) * fontSize);
    } catch (err) {
        return Math.floor(fontSize * 0.60 * text.length);
    }
}

// === Вспомогательная функция для наложения водяного знака ===
// Предпросмотр считает по тем же формулам: frontend/src/components/settings/watermarkTools.js
async function applyWatermark(imageBuffer, wmConfig) {
    // 🛡️ ЖЕЛЕЗОБЕТОННАЯ ПРОВЕРКА: Пропускаем чистое фото, если:
    // 1. Конфига нет
    // 2. Явно передано отключение (enabled/isActive = false)
    // 3. Это текст 'SADOVODPS' по умолчанию, который человек не сохранял (у сохранённых настроек есть id)
    if (!wmConfig ||
        wmConfig.enabled === false ||
        wmConfig.isActive === false) {
        return imageBuffer;
    }

    if (wmConfig.type === 'text' && wmConfig.text === 'SADOVODPS' && !wmConfig.enabled && !wmConfig.id) {
        return imageBuffer;
    }

    if (wmConfig.type === 'text' && (!wmConfig.text || wmConfig.text.trim() === '')) {
        return imageBuffer;
    }

    if (wmConfig.type === 'image' && !wmConfig.image) {
        return imageBuffer;
    }
    
    try {
        const metadata = await sharp(imageBuffer).metadata();
        const { width, height } = metadata;

        const sizeValue = wmConfig.size ?? 20;
        const marginValue = wmConfig.margin ?? 5;
        const opacity = (wmConfig.opacity ?? 80) / 100;

        const padX = Math.floor(width * (marginValue / 100));
        const padY = Math.floor(height * (marginValue / 100));

        let overlayBuffer;
        let overlayMeta;

        if (wmConfig.type === 'text') {
            const text = wmConfig.text; 
            const textColor = safeColor(wmConfig.textColor, '#FFFFFF');
            const bgColor = safeColor(wmConfig.bgColor, '#000000');
            const hasBg = wmConfig.hasBackground !== false;
            
            const fontSize = Math.max(12, Math.floor(width * (sizeValue / 100) * 0.20)); 
            
            const bgPaddingVal = hasBg ? (wmConfig.bgPadding ?? 10) : 0;
            const innerPadV = Math.floor(fontSize * (bgPaddingVal / 25));
            const innerPadH = Math.floor(fontSize * (bgPaddingVal / 12));

            const hasStroke = wmConfig.hasStroke === true;
            const strokeColor = safeColor(wmConfig.strokeColor, '#000000');
            const strokeWidth = Math.max(1, Math.floor((wmConfig.strokeWidth || 2) * (width / 1000)));

            const strokeAttr = hasStroke ? `stroke="${strokeColor}" stroke-width="${strokeWidth}" paint-order="stroke"` : '';
            const fontFam = wmConfig.fontFamily ? String(wmConfig.fontFamily).replace(/[^\w\s,'"-]/g, '').replace(/"/g, "'") : 'sans-serif';

            const textWidth = await measureTextWidth(text, fontFam, fontSize);
            const plateWidth = textWidth + (innerPadH * 2);
            const plateHeight = Math.ceil(fontSize * 1.2) + (innerPadV * 2);
            // Обводка выходит за край букв: оставляем ей место, чтобы она не обрезалась.
            const strokeRoom = hasStroke ? Math.ceil(strokeWidth / 2) + 1 : 0;

            const svg = `
                <svg width="${plateWidth + (strokeRoom * 2)}" height="${plateHeight + (strokeRoom * 2)}">
                    <style>
                        .bg { fill: ${bgColor}; }
                        .text { fill: ${textColor}; font-size: ${fontSize}px; font-family: ${fontFam}; font-weight: bold; }
                    </style>
                    <g opacity="${opacity}">
                        ${hasBg ? `<rect x="${strokeRoom}" y="${strokeRoom}" width="${plateWidth}" height="${plateHeight}" rx="${fontSize * 0.2}" class="bg" />` : ''}
                        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" class="text" ${strokeAttr}>${escapeXml(text)}</text>
                    </g>
                </svg>`;
            overlayBuffer = Buffer.from(svg);

        } else if (wmConfig.type === 'image' && wmConfig.image) {
            const base64Data = wmConfig.image.includes(',') ? wmConfig.image.split(',')[1] : wmConfig.image;
            const targetWidth = Math.max(20, Math.floor(width * (sizeValue / 100) * 0.35));

            overlayBuffer = await sharp(Buffer.from(base64Data, 'base64'))
                .resize({ width: targetWidth, withoutEnlargement: false })
                .ensureAlpha()
                .composite([{
                    input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
                    raw: { width: 1, height: 1, channels: 4 },
                    tile: true,
                    blend: 'dest-in',
                }])
                .png()
                .toBuffer();
        }

        if (wmConfig.angle) {
            overlayBuffer = await sharp(overlayBuffer)
                .rotate(wmConfig.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();
        }

        overlayMeta = await sharp(overlayBuffer).metadata();

        if (overlayMeta.width > width || overlayMeta.height > height) {
            overlayBuffer = await sharp(overlayBuffer)
                .resize({ width: width, height: height, fit: 'inside' })
                .toBuffer();
            overlayMeta = await sharp(overlayBuffer).metadata();
        }

        let left = padX;
        let top = padY;

        if (wmConfig.position === 'custom' && Number.isFinite(wmConfig.x) && Number.isFinite(wmConfig.y)) {
            left = Math.floor((width * wmConfig.x) / 100) - Math.floor(overlayMeta.width / 2);
            top = Math.floor((height * wmConfig.y) / 100) - Math.floor(overlayMeta.height / 2);
        } else {
            // Первая буква — строка (верх, центр, низ), вторая — столбец (лево, центр, право).
            const [row, column] = /^[tcb][lcr]$/.test(wmConfig.position) ? wmConfig.position : 'br';
            if (column === 'c') left = Math.floor((width - overlayMeta.width) / 2);
            if (column === 'r') left = width - overlayMeta.width - padX;
            if (row === 'c') top = Math.floor((height - overlayMeta.height) / 2);
            if (row === 'b') top = height - overlayMeta.height - padY;
        }

        left = Math.max(0, Math.min(left, width - overlayMeta.width));
        top = Math.max(0, Math.min(top, height - overlayMeta.height));

        return await sharp(imageBuffer)
            .composite([{ input: overlayBuffer, top, left }])
            .toBuffer();
            
    } catch (err) {
        console.error('[WATERMARK ERROR]:', err);
        throw new Error('Не удалось применить водяной знак. Пост не отправлен.', { cause: err });
    }
}

// === ПРАВИЛА ОТЛОЖЕННЫХ ПОСТОВ ===
// Запланировать можно только на будущее время. У одного человека на одну минуту приходится одна публикация.
// Один пост сразу в несколько каналов считается одной публикацией: его записи связаны общим batchId.
const SCHEDULE_INVALID_ERROR = 'Неверная дата или время публикации.';
const SCHEDULE_PAST_ERROR = 'Это время уже прошло. Выберите время в будущем.';
const SCHEDULE_BUSY_ERROR = 'На это время у вас уже запланирована публикация. Выберите другое время.';
const ONE_MINUTE_MS = 60 * 1000;

const toScheduleMinute = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setSeconds(0, 0);
    return date;
};

// own: пост, который переносят. Он сам и другие каналы той же публикации время не занимают.
const findScheduleConflict = (client, userId, minute, own = null) => client.post.findFirst({
    where: {
        status: 'SCHEDULED',
        publishAt: { gte: minute, lt: new Date(minute.getTime() + ONE_MINUTE_MS) },
        account: { userId },
        ...(own ? { id: { not: own.id } } : {}),
        ...(own?.batchId ? { OR: [{ batchId: null }, { batchId: { not: own.batchId } }] } : {}),
    },
    select: { id: true },
});

// Запросы одного человека выполняются по очереди, иначе два одновременных запроса заняли бы одно время.
const withScheduleLock = (userId, work) => prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${String(userId)}))`;
    return work(tx);
}, { maxWait: 5000, timeout: 15000 });

const findPostsByRequest = (client, userId, requestKey) => client.post.findMany({
    where: { batchId: requestKey, account: { userId } },
    select: { id: true, status: true, errorMessage: true, account: { select: { name: true, provider: true } } },
});

const toCreatedPost = (post) => ({ id: post.id, status: post.status, errorMessage: post.errorMessage, accountName: post.account.name, provider: post.account.provider });

exports.createPost = async (req, res) => {
    try {
        const { text, accountsData, publishAt } = req.body;
        let mediaIds = [];
        try {
            mediaIds = req.body.mediaIds ? JSON.parse(req.body.mediaIds) : [];
        } catch (error) {
            await removeUploadedFiles(req);
            return res.status(400).json({ success: false, error: 'Некорректный список фотографий' });
        }
        if (!Array.isArray(mediaIds) || mediaIds.length > 10 || mediaIds.some((id) => typeof id !== 'string') || new Set(mediaIds).size !== mediaIds.length) {
            await removeUploadedFiles(req);
            return res.status(400).json({ success: false, error: 'Некорректный список фотографий' });
        }
        if (mediaIds.length && (req.files || []).length) {
            await removeUploadedFiles(req);
            return res.status(400).json({ success: false, error: 'Нельзя одновременно отправлять новые и загруженные фотографии' });
        }
        const requestKey = parseRequestKey(req.body.requestKey);

        let accounts = [];
        if (accountsData) {
            accounts = typeof accountsData === 'string' ? JSON.parse(accountsData) : accountsData;
        }
        // Один канал дважды в одном запросе дал бы два одинаковых поста
        if (Array.isArray(accounts)) {
            accounts = accounts.filter((item, index) => accounts.findIndex((other) => other.accountId === item.accountId) === index);
        }

        let parsedPublishAt = null;
        let isScheduled = false;

        if (publishAt && publishAt !== 'null' && String(publishAt).trim() !== "") {
            parsedPublishAt = toScheduleMinute(publishAt);
            if (!parsedPublishAt) {
                await removeUploadedFiles(req);
                return res.status(400).json({ success: false, error: SCHEDULE_INVALID_ERROR });
            }
            if (parsedPublishAt.getTime() <= Date.now()) {
                await removeUploadedFiles(req);
                return res.status(400).json({ success: false, error: SCHEDULE_PAST_ERROR });
            }
            isScheduled = true;
        }

        if (!accounts || accounts.length === 0) {
            await removeUploadedFiles(req);
            return res.status(400).json({ success: false, error: 'Нет аккаунтов для отправки' });
        }

        const postText = typeof text === 'string' ? text : '';
        if (!postText.trim() && !(req.files || []).length && mediaIds.length === 0) {
            await removeUploadedFiles(req);
            return res.status(400).json({ success: false, error: 'Добавьте текст или хотя бы одно фото' });
        }

        // Публиковать можно только в свои аккаунты, при активной подписке и в пределах тарифа
        const userId = getUserId(req);
        for (const mediaId of mediaIds) {
            const mediaName = path.basename(mediaId);
            const ownerPrefix = `staged_${String(userId)}_`;
            if (mediaName !== mediaId || !mediaName.startsWith(ownerPrefix) || !mediaName.endsWith('.jpg') || !/^[a-z0-9-]{36}\.jpg$/i.test(mediaName.slice(ownerPrefix.length))) {
                return res.status(400).json({ success: false, error: 'Фотография недействительна или принадлежит другому пользователю' });
            }
            try {
                const stats = await fs.promises.stat(path.join(TEMP_QUEUE_DIR, mediaName));
                if (!stats.isFile()) throw new Error('Not a file');
            } catch (error) {
                return res.status(400).json({ success: false, error: 'Фотография не найдена на сервере. Загрузите её повторно.' });
            }
        }
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        const limits = getUserLimits(currentUser);
        if (!limits.active) {
            await removeUploadedFiles(req);
            return res.status(403).json({ success: false, error: NO_SUBSCRIPTION_ERROR });
        }
        const ownAccounts = await prisma.account.findMany({ where: { userId }, select: { id: true, provider: true, createdAt: true } });
        const allowedIds = getAllowedAccountIds(ownAccounts, limits);
        if (accounts.some((item) => !allowedIds.has(item.accountId))) {
            await removeUploadedFiles(req);
            return res.status(403).json({ success: false, error: 'Один из выбранных аккаунтов недоступен для публикации' });
        }

        if (requestKey) {
            const repeated = await findPostsByRequest(prisma, userId, requestKey);
            if (repeated.length > 0) {
                await removeUploadedFiles(req);
                return res.status(200).json({ success: true, message: 'Этот пост уже принят', posts: repeated.map(toCreatedPost), estimatedSeconds: isScheduled ? null : await estimatePublishSeconds() });
            }
        }

        if (isScheduled && await findScheduleConflict(prisma, userId, parsedPublishAt)) {
            await removeUploadedFiles(req);
            return res.status(409).json({ success: false, error: SCHEDULE_BUSY_ERROR });
        }

        // БЫСТРЫЙ ШАГ 1: Надежно сохраняем файлы и генерируем два вида путей
        const workerFilePaths = []; // Внутренние пути для Воркера (серверные)
        const dbFilePaths = [];     // Публичные пути для базы и Фронтенда (чтобы картинки грузились)

        if (mediaIds.length) {
            for (const mediaId of mediaIds) {
                workerFilePaths.push(path.join(TEMP_QUEUE_DIR, path.basename(mediaId)));
                dbFilePaths.push(`/uploads/temp_queue/${path.basename(mediaId)}`);
            }
        }

        if (req.files && req.files.length > 0) {
            const tempDir = path.join(__dirname, '../../uploads/temp_queue');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            for (const file of req.files) {
                const fileName = `task_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                const safePath = path.join(tempDir, fileName);

                try {
                    const metadata = await sharp(file.path, { failOn: 'none' }).metadata();
                    console.info(`[UPLOAD] Фото format=${metadata.format || 'unknown'} ${metadata.width || 0}x${metadata.height || 0}, bytes=${file.size || 0}`);

                    await sharp(file.path, { failOn: 'none' })
                        .rotate()
                        .resize({ width: 4000, height: 4000, fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 90 })
                        .toFile(safePath);
                } catch (error) {
                    await Promise.all([
                        ...req.files.map((uploadedFile) => fs.promises.unlink(uploadedFile.path).catch(() => {})),
                        ...workerFilePaths.map((filePath) => fs.promises.unlink(filePath).catch(() => {})),
                        fs.promises.unlink(safePath).catch(() => {})
                    ]);
                    const originalName = path.basename(file.originalname || 'photo');
                    console.error(`[UPLOAD] Не удалось обработать фото ${originalName}:`, error.message);
                    return res.status(400).json({
                        success: false,
                        error: `Файл ${originalName} не удалось обработать. Сохраните его как JPG или PNG.`
                    });
                } finally {
                    await fs.promises.unlink(file.path).catch(() => {});
                }

                workerFilePaths.push(safePath);
                dbFilePaths.push(`/uploads/temp_queue/${fileName}`); // Этот путь поймет браузер
            }
        }

        // Если партнёр публикует присланный ему пост, отметка «опубликован» появится, когда воркер его действительно отправит.
        const sharedPost = req.body.sharedPostId
            ? await prisma.sharedPost.findFirst({ where: { id: String(req.body.sharedPostId), receiverId: userId, isPublished: false }, select: { id: true } })
            : null;

        // Создаём записи в базе. Оформление сохраняется вместе с постом: оно нужно и отложенным постам, и повторной отправке.
        const batchId = requestKey || (isScheduled ? crypto.randomUUID() : null);
        // Все каналы одним запросом, а не по одному: при 28 каналах это 28 лишних обращений к базе.
        const accountRecords = await prisma.account.findMany({
            where: { id: { in: accounts.map((item) => item.accountId) }, userId },
            include: { watermark: true }
        });
        const accountById = new Map(accountRecords.map((account) => [account.id, account]));
        const createRows = async (client) => {
            const rows = [];
            for (const accData of accounts) {
                const account = accountById.get(accData.accountId);
                if (!account) continue;

                const watermarkConfig = accData.applyWatermark ? (accData.watermarkConfig || account.watermark) : null;
                const signatureText = accData.applySignature ? (accData.signatureText !== undefined ? accData.signatureText : account.signature) : null;

                const post = await client.post.create({
                    data: {
                        accountId: account.id,
                        text: postText,
                        mediaUrls: JSON.stringify(dbFilePaths),
                        originalMediaUrls: JSON.stringify(dbFilePaths),
                        watermarkConfig: watermarkConfig ? JSON.stringify(watermarkConfig) : null,
                        signatureText: signatureText || null,
                        publishAt: parsedPublishAt,
                        status: isScheduled ? 'SCHEDULED' : 'PROCESSING',
                        sharedPostId: sharedPost?.id,
                        batchId
                    }
                });
                rows.push({ post, account, watermarkConfig, signatureText });
            }
            return rows;
        };

        // Проверка повторяется под блокировкой: это же время мог занять запрос, пришедший одновременно с этим.
        const rows = (isScheduled || requestKey)
            ? await withScheduleLock(userId, async (tx) => {
                // Два одинаковых запроса могли прийти одновременно: под блокировкой второй увидит записи первого.
                if (requestKey) {
                    const repeated = await findPostsByRequest(tx, userId, requestKey);
                    if (repeated.length > 0) return { repeated };
                }
                if (isScheduled && await findScheduleConflict(tx, userId, parsedPublishAt)) return null;
                return createRows(tx);
            })
            : await createRows(prisma);

        if (!rows || rows.repeated) {
            await Promise.all(workerFilePaths.map((file) => fs.promises.unlink(file).catch(() => {})));
            if (rows?.repeated) return res.status(200).json({ success: true, message: 'Этот пост уже принят', posts: rows.repeated.map(toCreatedPost), estimatedSeconds: isScheduled ? null : await estimatePublishSeconds() });
            return res.status(409).json({ success: false, error: SCHEDULE_BUSY_ERROR });
        }

        const createdPosts = [];
        for (const { post, account, watermarkConfig, signatureText } of rows) {
            const created = { id: post.id, status: post.status, errorMessage: null, accountName: account.name, provider: account.provider };

            if (!isScheduled) {
                try {
                    await postQueue.add('publish-job', {
                        postId: post.id,
                        accountId: account.id,
                        text: postText,
                        filePaths: workerFilePaths,
                        watermarkConfig,
                        signatureText
                    }, JOB_OPTIONS);
                } catch (queueError) {
                    console.error('Очередь публикаций недоступна:', queueError.message);
                    created.status = 'FAILED';
                    created.errorMessage = 'Очередь публикаций недоступна';
                    await prisma.post.update({ where: { id: post.id }, data: { status: 'FAILED', errorMessage: created.errorMessage } });
                }
            }
            createdPosts.push(created);
        }

        const estimatedSeconds = isScheduled ? null : await estimatePublishSeconds();
        return res.status(200).json({ success: true, message: 'Посты приняты в обработку', posts: createdPosts, estimatedSeconds });

    } catch (error) {
        console.error('[FATAL ERROR] Сбой createPost:', error);
        if (!res.headersSent) res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
};

// Статус постов для экрана после публикации: показываем успех только тогда, когда он действительно есть.
exports.getPostStatuses = async (req, res) => {
    try {
        const ids = String(req.query.ids || '').split(',').map((id) => id.trim()).filter(Boolean).slice(0, 50);
        const posts = await prisma.post.findMany({
            where: { id: { in: ids }, account: { userId: getUserId(req) } },
            select: { id: true, status: true, errorMessage: true, account: { select: { name: true, provider: true } } }
        });
        res.json({
            success: true,
            posts: posts.map((p) => ({ id: p.id, status: p.status, errorMessage: p.errorMessage, accountName: p.account.name, provider: p.account.provider })),
            estimatedSeconds: posts.some((p) => ['PROCESSING', 'DELIVERING'].includes(p.status)) ? await estimatePublishSeconds() : null
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ошибка загрузки статуса' });
    }
};

// Файлы для воркера: исходные фото поста. Старые посты могли хранить картинки прямо в базе.
const resolveFilePaths = async (post) => {
    const urls = parseJson(post.originalMediaUrls, null) || parseJson(post.mediaUrls, []);
    const filePaths = [];
    for (const url of urls) {
        if (String(url).startsWith('data:')) {
            fs.mkdirSync(TEMP_QUEUE_DIR, { recursive: true });
            const file = path.join(TEMP_QUEUE_DIR, `task_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);
            await fs.promises.writeFile(file, Buffer.from(String(url).split(',')[1], 'base64'));
            filePaths.push(file);
        } else {
            filePaths.push(path.join(__dirname, '../..', String(url)));
        }
    }
    return filePaths;
};

// Отложенные посты идут через ту же очередь и тот же воркер, что и обычные:
// те же водяной знак, подпись и обработка фото. Если фото пропало, пост станет «Ошибка», а не уйдёт без картинок.
const enqueueDuePosts = async () => {
    const duePosts = await prisma.post.findMany({ where: { status: 'SCHEDULED', publishAt: { lte: new Date() } } });

    for (const post of duePosts) {
        // Статус меняется сразу, чтобы следующий запуск планировщика не отправил пост второй раз.
        const { count } = await prisma.post.updateMany({
            where: { id: post.id, status: 'SCHEDULED' },
            data: { status: 'PROCESSING', errorMessage: null }
        });
        if (count === 0) continue;

        try {
            await postQueue.add('publish-job', {
                postId: post.id,
                accountId: post.accountId,
                text: post.text || '',
                filePaths: await resolveFilePaths(post),
                watermarkConfig: parseJson(post.watermarkConfig, null),
                signatureText: post.signatureText
            }, JOB_OPTIONS);
        } catch (error) {
            console.error(`[CRON ERROR] Пост ${post.id}:`, error.message);
            await prisma.post.update({ where: { id: post.id }, data: { status: 'FAILED', errorMessage: 'Не удалось поставить пост в очередь' } });
        }
    }
};

// Если данные очереди потерялись (например, сбой Redis), пост навсегда остался бы «В работе».
// Такой пост становится «Ошибка» и его можно отправить ещё раз. Пока в очереди что-то есть, посты не трогаем.
const STUCK_AFTER_MS = 15 * 60 * 1000;
exports.failStuckPosts = async () => {
    const { waiting = 0, active = 0, delayed = 0 } = await postQueue.getJobCounts('waiting', 'active', 'delayed');
    if (waiting + active + delayed > 0) return { failed: 0 };
    const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
    const { count } = await prisma.post.updateMany({
        where: { status: 'PROCESSING', createdAt: { lt: cutoff }, OR: [{ publishAt: null }, { publishAt: { lt: cutoff } }] },
        data: { status: 'FAILED', errorMessage: 'Публикация прервалась из-за сбоя на сервере. Отправьте пост ещё раз.' }
    });
    const unknown = await prisma.post.updateMany({
        // Посты, переданные в Kom-OD, сюда не попадают: их итог ставит фоновая проверка trackKomodPosts.
        where: { status: 'DELIVERING', komodTaskId: null, createdAt: { lt: cutoff }, OR: [{ publishAt: null }, { publishAt: { lt: cutoff } }] },
        data: { status: 'DELIVERY_UNKNOWN', errorMessage: 'Связь прервалась во время отправки. Проверьте канал перед повторной публикацией.' }
    });
    if (count > 0) console.error(`[CRON] Зависшие посты отмечены как ошибка: ${count}`);
    if (unknown.count > 0) console.error(`[CRON] Результат отправки неизвестен: ${unknown.count}`);
    return { failed: count, unknown: unknown.count };
};

// Удаляет файлы папки старше срока хранения. keep: файлы, которые ещё нужны, сколько бы им ни было.
const removeExpiredFiles = async (dir, keep) => {
    if (!fs.existsSync(dir)) return 0;
    let removed = 0;
    const now = Date.now();
    for (const file of await fs.promises.readdir(dir)) {
        if (keep(file)) continue;
        const filePath = path.join(dir, file);
        try {
            const stats = await fs.promises.stat(filePath);
            if (stats.isFile() && now - stats.mtimeMs > MEDIA_RETENTION_MS) {
                await fs.promises.unlink(filePath);
                removed += 1;
            }
        } catch (error) {
            // Файл мог удалить соседний процесс: это не повод прерывать очистку.
            if (error.code !== 'ENOENT') console.error(`[CRON] Не удалось удалить ${file}:`, error.message);
        }
    }
    return removed;
};

// Раз в сутки удаляются фото старше 7 дней:
// 1) загруженные при создании поста (папка temp_queue), кроме фото постов, которые ещё ждут отправки,
//    сколько бы они ни ждали: запланированный на месяц вперёд пост выйдет со своими фото;
// 2) фото, пересланные партнёрам (shared_* в папке posts). Миниатюры истории постов не удаляются.
exports.cleanupTempQueue = async () => {
    const pending = await prisma.post.findMany({
        where: { status: { in: ['SCHEDULED', 'PROCESSING', 'DELIVERING', 'DELIVERY_UNKNOWN'] } },
        select: { mediaUrls: true, originalMediaUrls: true }
    });
    const inUse = new Set();
    for (const post of pending) {
        for (const url of [...parseJson(post.mediaUrls, []), ...parseJson(post.originalMediaUrls, [])]) {
            inUse.add(path.basename(String(url)));
        }
    }
    // Рядом с фото очередь кладёт его сжатую копию (.base.jpg) и временные файлы: они живут вместе с фото.
    const sourceName = (file) => file.replace(/\.base\.jpg(\..*\.tmp)?$/, '');

    const removed = await removeExpiredFiles(TEMP_QUEUE_DIR, (file) => inUse.has(sourceName(file)));
    const removedShared = await removeExpiredFiles(POSTS_MEDIA_DIR, (file) => !file.startsWith('shared_'));
    if (removed + removedShared > 0) console.log(`[CRON] Удалено старых фото: ${removed} постов, ${removedShared} для партнёров`);
    return { removed, removedShared };
};

exports.initCron = () => {
    cron.schedule('* * * * *', async () => {
        try {
            await enqueueDuePosts();
        } catch (e) {
            console.error('[CRON FATAL ERROR]', e.message);
        }
    });

    // Подтверждения постов ВК от Kom-OD. Следующий проход не начинается, пока идёт предыдущий.
    setInterval(() => {
        exports.trackKomodPosts().catch((e) => console.error('[KOMOD TRACK] Ошибка проверки постов ВК', e.message));
    }, KOMOD_POLL_MS);

    cron.schedule('*/5 * * * *', async () => {
        try {
            await exports.failStuckPosts();
        } catch (e) {
            console.error('[CRON] Ошибка проверки зависших постов', e.message);
        }
    });

    cron.schedule('0 3 * * *', async () => {
        try {
            await exports.cleanupTempQueue();
        } catch (e) {
            console.error('[CRON] Ошибка очистки файлов', e.message);
        }
    });
};


/// === ПОЛУЧИТЬ ТОЛЬКО ОТЛОЖЕННЫЕ ПОСТЫ ДЛЯ КАЛЕНДАРЯ ===
exports.getScheduledPosts = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Ошибка авторизации' });

        // Запланированные посты отдаются все: при 75 более новых постах будущий выпадал бы из плана,
        // а с ним и занятое время. Фото плану не нужны, поэтому ответ намного меньше.
        const fields = {
            omit: { watermarkConfig: true, mediaUrls: true, originalMediaUrls: true, signatureText: true },
            include: { account: { select: { name: true, provider: true, avatarUrl: true } } },
        };
        const [scheduled, others] = await Promise.all([
            prisma.post.findMany({ where: { status: 'SCHEDULED', account: { userId } }, ...fields, orderBy: { publishAt: 'asc' } }),
            prisma.post.findMany({ where: { status: { not: 'SCHEDULED' }, account: { userId } }, ...fields, orderBy: { createdAt: 'desc' }, take: 75 }),
        ]);

        res.json({ success: true, posts: [...scheduled, ...others] });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};
// === ОБНОВИТЬ СУЩЕСТВУЮЩИЙ ОТЛОЖЕННЫЙ ПОСТ (РЕДАКТИРОВАНИЕ) ===
exports.updateScheduledPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, publishAt } = req.body;
        const userId = getUserId(req);

        const post = await prisma.post.findFirst({ where: { id, account: { userId } } });
        if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });
        if (post.status !== 'SCHEDULED') return res.status(400).json({ success: false, error: 'Этот пост уже опубликован' });

        const requested = publishAt ? toScheduleMinute(publishAt) : null;
        if (publishAt && !requested) return res.status(400).json({ success: false, error: SCHEDULE_INVALID_ERROR });

        // Время проверяется, только если его меняют: текст можно поправить и у поста, который скоро выйдет.
        const isMoved = Boolean(requested) && requested.getTime() !== toScheduleMinute(post.publishAt).getTime();
        if (isMoved && requested.getTime() <= Date.now()) return res.status(400).json({ success: false, error: SCHEDULE_PAST_ERROR });

        const changed = await withScheduleLock(userId, async (tx) => {
            if (isMoved && await findScheduleConflict(tx, userId, requested, post)) return null;
            const { count } = await tx.post.updateMany({
                where: { id, status: 'SCHEDULED' },
                data: {
                    text: text !== undefined ? text : post.text,
                    ...(isMoved ? { publishAt: requested } : {})
                }
            });
            return count;
        });
        if (changed === null) return res.status(409).json({ success: false, error: SCHEDULE_BUSY_ERROR });
        if (changed === 0) return res.status(400).json({ success: false, error: 'Этот пост уже опубликован' });

        res.json({ success: true, post: await prisma.post.findUnique({ where: { id } }) });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

exports.shareWithPartners = async (req, res) => {
    try {
        // 🛡️ 1. БЕЗОПАСНЫЙ ПАРСИНГ ID ПАРТНЕРОВ
        let partnerIds = [];
        const rawPartnerIds = req.body.partnerIds || req.body.partnerIdsStr;
        
        if (typeof rawPartnerIds === 'string') {
            try { partnerIds = JSON.parse(rawPartnerIds); } catch (e) { console.error('Не парсится partnerIds:', rawPartnerIds); }
        } else if (Array.isArray(rawPartnerIds)) {
            partnerIds = rawPartnerIds;
        }

        const senderId = getUserId(req);
        const requestKey = parseRequestKey(req.body.requestKey);

        if (!senderId) return res.status(401).json({ success: false, error: 'Ошибка авторизации' });
        if (!Array.isArray(partnerIds) || partnerIds.length === 0) {
            await removeUploadedFiles(req);
            return res.status(400).json({ success: false, error: 'Выберите партнера' });
        }

        // Посты можно отправлять только тем, кто действительно принял заявку в партнёры
        const accepted = await prisma.partnership.findMany({
            where: { status: 'ACCEPTED', OR: [{ requesterId: senderId }, { receiverId: senderId }] },
            select: { requesterId: true, receiverId: true },
        });
        const myPartnerIds = new Set(accepted.map((p) => (p.requesterId === senderId ? p.receiverId : p.requesterId)));
        const notPartners = partnerIds.map(String).filter((id) => !myPartnerIds.has(id));
        partnerIds = [...new Set(partnerIds.map(String))].filter((id) => myPartnerIds.has(id));
        if (partnerIds.length === 0) {
            await removeUploadedFiles(req);
            return res.status(403).json({ success: false, error: 'Выбранные пользователи не являются вашими партнёрами' });
        }

        // Повтор того же нажатия при плохой связи: партнёр не должен получить пост второй раз.
        let alreadyDelivered = [];
        if (requestKey) {
            const sent = await prisma.sharedPost.findMany({ where: { senderId, requestKey, receiverId: { in: partnerIds } }, select: { receiverId: true } });
            alreadyDelivered = sent.map((item) => item.receiverId);
            partnerIds = partnerIds.filter((id) => !alreadyDelivered.includes(id));
            if (partnerIds.length === 0) {
                await removeUploadedFiles(req);
                return res.json({ success: true, delivered: alreadyDelivered, failed: notPartners });
            }
        }

        const sender = await prisma.user.findUnique({ where: { id: senderId } });
        if (!sender) return res.status(404).json({ success: false, error: 'Отправитель не найден' });

        // 🛡️ 2. БЕЗОПАСНАЯ ОБРАБОТКА ФАЙЛОВ (И ОТ OOM, И ОТ ОШИБОК ПАРСИНГА)
        let savedImageUrls = [];
        let failedPhotos = 0;
        let usedThumbnails = false;
        let sourcePostText = null;

        // БЫСТРЫЙ ПУТЬ: фото уже лежат на сервере. Браузер присылает только их имена или номер своего поста,
        // сервер делает партнёру копию без пересжатия. Занимает доли секунды и не зависит от очереди публикаций.
        const hasMediaIds = req.body.mediaIds !== undefined && req.body.mediaIds !== null;
        const sourcePostId = req.body.postId ? String(req.body.postId) : null;
        if (hasMediaIds || sourcePostId) {
            let sourceFiles = [];
            if (hasMediaIds) {
                let mediaIds = req.body.mediaIds;
                if (typeof mediaIds === 'string') { try { mediaIds = JSON.parse(mediaIds); } catch (e) { mediaIds = null; } }
                if (!Array.isArray(mediaIds) || mediaIds.length > 10 || new Set(mediaIds).size !== mediaIds.length) {
                    return res.status(400).json({ success: false, error: 'Некорректный список фотографий' });
                }
                sourceFiles = mediaIds.map((mediaId) => stagedMediaPath(senderId, mediaId));
                if (sourceFiles.some((file) => !file)) {
                    return res.status(400).json({ success: false, error: 'Фотография недействительна или принадлежит другому пользователю' });
                }
                if (!(await allFilesExist(sourceFiles))) {
                    return res.status(400).json({ success: false, error: 'Фотография не найдена на сервере. Загрузите её повторно.' });
                }
            } else {
                const sourcePost = await prisma.post.findFirst({
                    where: { id: sourcePostId, account: { userId: senderId } },
                    select: { text: true, originalMediaUrls: true, mediaUrls: true }
                });
                if (!sourcePost) return res.status(404).json({ success: false, error: 'Пост не найден' });
                sourcePostText = sourcePost.text || '';
                const originals = parseJson(sourcePost.originalMediaUrls, null) || [];
                const thumbnails = parseJson(sourcePost.mediaUrls, []) || [];
                // Старые посты могли хранить картинки прямо в базе: их браузер отправит прежним способом.
                if ([...originals, ...thumbnails].some((url) => String(url).startsWith('data:'))) {
                    return res.status(400).json({ success: false, fallback: true, error: 'Этот пост нужно отправить обычным способом' });
                }
                const originalFiles = originals.map(resolveUploadUrl);
                const thumbnailFiles = thumbnails.map(resolveUploadUrl);
                // Партнёр получает исходные фото без водяного знака. Если их уже удалили (хранятся 7 дней), берём копии из истории.
                if (originalFiles.every(Boolean) && await allFilesExist(originalFiles)) {
                    sourceFiles = originalFiles;
                } else if (thumbnailFiles.every(Boolean) && await allFilesExist(thumbnailFiles)) {
                    sourceFiles = thumbnailFiles;
                    usedThumbnails = thumbnailFiles.length > 0;
                } else {
                    return res.status(400).json({ success: false, error: 'Не удалось найти фото этого поста. Партнёрам ничего не отправлено.' });
                }
            }
            try {
                savedImageUrls = await Promise.all(sourceFiles.map(copyToShared));
            } catch (error) {
                console.error('Не удалось скопировать фото для партнёра:', error.message);
                return res.status(500).json({ success: false, error: 'Не удалось подготовить фото. Пост не отправлен, попробуйте ещё раз.' });
            }
        } else if (req.files && req.files.length > 0) {
            // ВЕТКА А: Если фронтенд прислал файлы через FormData
            // Фото обрабатываются параллельно, порядок сохраняется.
            const processed = await mapLimit(req.files, 3, async (file) => {
                try {
                    const buffer = await fs.promises.readFile(file.path);
                    fs.promises.unlink(file.path).catch(() => {});

                    const optimizedBuf = await sharp(buffer)
                        .resize({ width: 2000, fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 85 })
                        .toBuffer();

                    return await saveImageToFile(optimizedBuf, 'shared');
                } catch (e) {
                    failedPhotos += 1;
                    console.error('Ошибка обработки фото партнера (файл):', e);
                    return null;
                }
            });
            savedImageUrls = processed.filter(Boolean);
        } else if (req.body.mediaUrls) {
            // ВЕТКА Б: Если фронтенд прислал Base64 JSON (Защита от 502 ошибки!)
            let urls = [];
            if (typeof req.body.mediaUrls === 'string') {
                try { urls = JSON.parse(req.body.mediaUrls); } catch(e) {}
            } else if (Array.isArray(req.body.mediaUrls)) {
                urls = req.body.mediaUrls;
            }

            for (const img of urls) {
                // Строгая проверка, что это именно строка Base64, защита от "img.includes is not a function"
                if (img && typeof img === 'string' && img.includes(',')) {
                    try {
                        const base64Data = img.split(',')[1];
                        const buffer = Buffer.from(base64Data, 'base64');
                        
                        // Сжимаем и сохраняем НА ДИСК, а не в базу!
                        const optimizedBuf = await sharp(buffer)
                            .resize({ width: 2000, fit: 'inside', withoutEnlargement: true })
                            .jpeg({ quality: 85 })
                            .toBuffer();
                            
                        const url = await saveImageToFile(optimizedBuf, 'shared_base64');
                        if (url) savedImageUrls.push(url);
                    } catch (e) {
                        failedPhotos += 1;
                        console.error('Ошибка конвертации Base64 в файл:', e);
                    }
                } else if (img && typeof img === 'string' && img.startsWith('/uploads/') && !img.includes('..')) {
                    // Если вдруг прислали уже готовый путь
                    savedImageUrls.push(img);
                }
            }
        }

        // Пост без части фото партнёру не отправляем: лучше честно сказать об ошибке.
        if (failedPhotos > 0) {
            return res.status(400).json({ success: false, error: `Не удалось обработать фото (${failedPhotos}). Пост не отправлен, попробуйте ещё раз.` });
        }

        const mediaString = JSON.stringify(savedImageUrls);
        const postText = typeof req.body.text === 'string' ? req.body.text : (sourcePostText || '');

        // 🛡️ 3. ЗАПИСЬ В БАЗУ ДАННЫХ. Пост дошёл до партнёра, когда он появился в его входящих.
        // Партнёры обрабатываются параллельно: сбой у одного не мешает остальным.
        const deliveredSet = new Set(alreadyDelivered);
        const newSharedPosts = await withScheduleLock(senderId, async (tx) => {
            if (requestKey) {
                const existing = await tx.sharedPost.findMany({
                    where: { senderId, requestKey, receiverId: { in: partnerIds } },
                    select: { receiverId: true }
                });
                existing.forEach((item) => deliveredSet.add(item.receiverId));
            }

            const created = [];
            for (const receiverId of partnerIds) {
                if (deliveredSet.has(receiverId)) continue;
                created.push(await tx.sharedPost.create({
                    data: { senderId: sender.id, receiverId, text: postText, mediaUrls: mediaString, requestKey }
                }));
                deliveredSet.add(receiverId);
            }
            return created;
        });

        const failed = [...notPartners];
        await mapLimit(newSharedPosts, 5, async (sharedPost) => {
            try {
                await prisma.notification.create({
                    data: {
                        userId: sharedPost.receiverId,
                        type: 'INFO',
                        text: `Партнер ${sender?.name || 'Без имени'} поделился с вами новой публикацией.`,
                        metadata: JSON.stringify({ text: postText, mediaUrls: savedImageUrls })
                    }
                });
            } catch (dbError) {
                console.error(`Уведомление партнеру ${sharedPost.receiverId} не сохранено:`, dbError.message);
            }
        });

        const delivered = [...deliveredSet];
        if (delivered.length === 0) {
            return res.status(500).json({ success: false, error: 'Не удалось доставить пост партнёрам. Попробуйте ещё раз.' });
        }

        res.json({ success: true, delivered, failed, usedThumbnails });
    } catch (error) {
        console.error('ФАТАЛЬНАЯ ОШИБКА ШЕРИНГА:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера. Попробуйте ещё раз.' });
    }
};

exports.getSharedPosts = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Ошибка авторизации' });

        // Этот запрос повторяется каждые 15 секунд, поэтому объём ответа ограничен.
        const [incoming, outgoing] = await Promise.all([
            prisma.sharedPost.findMany({
                where: { receiverId: userId },
                include: {
                    sender: { select: { id: true, name: true, pavilion: true, avatarUrl: true } },
                    posts: { select: { id: true, status: true, publishAt: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: 100
            }),
            prisma.sharedPost.findMany({
                where: { senderId: userId },
                include: { receiver: { select: { id: true, name: true, pavilion: true, avatarUrl: true } } },
                orderBy: { createdAt: 'desc' },
                take: 100
            }),
        ]);
        res.json({ success: true, incoming, outgoing });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// === ОТКАЗАТЬСЯ ОТ ПОСТА ПАРТНЕРА (С УВЕДОМЛЕНИЕМ) ===
// Партнёр нажал «Использовать пост»: сервер сам кладёт ему фото этого поста как уже загруженные.
// Раньше браузер скачивал каждое фото и загружал обратно, а кнопка «Далее» ждала.
exports.stageSharedPost = async (req, res) => {
    const userId = String(getUserId(req));
    const created = [];
    try {
        const shared = await prisma.sharedPost.findFirst({ where: { id: req.params.id, receiverId: userId }, select: { mediaUrls: true } });
        if (!shared) return res.status(404).json({ success: false, error: 'Пост не найден' });

        const urls = (parseJson(shared.mediaUrls, []) || []).slice(0, 10);
        // Старые посты могли хранить картинки прямо в базе: их браузер подготовит прежним способом.
        if (urls.some((url) => String(url).startsWith('data:'))) return res.status(400).json({ success: false, fallback: true });

        const files = urls.map(resolveUploadUrl);
        if (!files.every(Boolean) || !(await allFilesExist(files))) {
            return res.status(400).json({ success: false, error: 'Фото этого поста уже удалены с сервера: они хранятся 7 дней.' });
        }

        await fs.promises.mkdir(TEMP_QUEUE_DIR, { recursive: true });
        const photos = await mapLimit(files, 3, async (file, index) => {
            const mediaId = `staged_${userId}_${crypto.randomUUID()}.jpg`;
            const target = path.join(TEMP_QUEUE_DIR, mediaId);
            created.push(target);
            if (/\.jpe?g$/i.test(file)) await fs.promises.copyFile(file, target);
            else await sharp(file, { failOn: 'none' }).rotate().jpeg({ quality: 90 }).toFile(target);
            return { mediaId, url: urls[index] };
        });
        res.json({ success: true, photos });
    } catch (error) {
        await Promise.all(created.map((file) => fs.promises.unlink(file).catch(() => {})));
        console.error('Не удалось подготовить фото поста партнёра:', error.message);
        res.status(500).json({ success: false, error: 'Не удалось подготовить фото. Попробуйте ещё раз.' });
    }
};

exports.deleteSharedPost = async (req, res) => {
    try {
        const post = await prisma.sharedPost.findFirst({
            where: { id: req.params.id, receiverId: getUserId(req) },
            include: { receiver: { select: { name: true, pavilion: true } } }
        });
        
        if (post) {
            // 🛡️ ЗАЩИТА ОТ ДУБЛЕЙ: Сначала удаляем пост
            await prisma.sharedPost.delete({ where: { id: req.params.id } });
            
            // И только если удаление прошло успешно, создаем 1 уведомление
            await prisma.notification.create({
                data: {
                    userId: post.senderId,
                    type: 'WARNING',
                    text: `Партнер ${post.receiver?.name || 'Без имени'} (Павильон ${post.receiver?.pavilion || '?'}) отказался от публикации вашего поста.`,
                    metadata: JSON.stringify({ text: post.text, mediaUrls: post.mediaUrls })
                }
            });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

exports.deleteScheduledPost = async (req, res) => {
    try {
        const { count } = await prisma.post.deleteMany({ where: { id: req.params.id, account: { userId: getUserId(req) } } });
        if (count === 0) return res.status(404).json({ success: false, error: 'Пост не найден' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// === ПОЛУЧИТЬ ПОЛНУЮ ИСТОРИЮ ПОСТОВ (ВК/ТГ + ПАРТНЕРЫ) ===
exports.getPostsHistory = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Ошибка авторизации' });

        // 1. Берем обычные посты (VK / Telegram)
        // 2. Берем посты, отправленные партнерам. Оба запроса идут одновременно.
        const [posts, sharedPosts] = await Promise.all([
            prisma.post.findMany({
                where: { account: { userId: userId } },
                omit: { watermarkConfig: true },
                include: { account: { select: { name: true, provider: true, avatarUrl: true } } },
                orderBy: [{ createdAt: 'desc' }],
                take: 500
            }),
            prisma.sharedPost.findMany({
                where: { senderId: userId },
                include: { receiver: { select: { name: true, avatarUrl: true, pavilion: true } } },
                orderBy: [{ createdAt: 'desc' }],
                take: 75 // 🟢 ИСПРАВЛЕНИЕ: Загружаем 75 постов вместо 500
            }),
        ]);

        // 3. Форматируем отправленные партнерам под единый стандарт истории
        const formattedShared = sharedPosts.map(sp => ({
            id: sp.id,
            text: sp.text,
            mediaUrls: sp.mediaUrls,
            status: 'PUBLISHED',
            createdAt: sp.createdAt,
            publishAt: sp.createdAt,
            account: {
                name: `Партнеру: ${sp.receiver?.name || 'Без имени'}`,
                provider: 'partner',
                avatarUrl: sp.receiver?.avatarUrl || null
            }
        }));

        // 4. Объединяем всё вместе и сортируем по дате (от новых к старым)
        const allPosts = [...posts, ...formattedShared].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ success: true, posts: allPosts });
    } catch (error) {
        console.error('Ошибка в getPostsHistory:', error);
        res.status(500).json({ success: false, error: 'Ошибка при загрузке истории' });
    }
};

// === ПЕРЕОТПРАВКА ПОСТА С ОШИБКОЙ ===
exports.retryPost = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        const post = await prisma.post.findUnique({
            where: { id },
            include: { account: true }
        });

        if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });
        if (post.account.userId !== userId) return res.status(403).json({ success: false, error: 'Нет доступа' });
        if (post.status !== 'FAILED') return res.status(400).json({ success: false, error: 'Можно переотправлять только посты с ошибкой' });

        // Через 7 дней фото удаляются с сервера: без них пост ушёл бы без картинок или упал с непонятной ошибкой.
        const sourceUrls = parseJson(post.originalMediaUrls, null) || parseJson(post.mediaUrls, []);
        for (const url of sourceUrls) {
            if (String(url).startsWith('data:')) continue;
            if (!fs.existsSync(path.join(__dirname, '../..', String(url)))) {
                return res.status(400).json({ success: false, error: MEDIA_GONE_ERROR });
            }
        }

        // Условие по статусу защищает от двойного нажатия. Планировщик не ждём: пост уходит в очередь сразу.
        const { count } = await prisma.post.updateMany({
            where: { id, status: 'FAILED' },
            data: {
                status: 'SCHEDULED',
                errorMessage: null,
                publishAt: new Date(),
                // Прежнее задание Kom-OD закончилось ошибкой: за новой отправкой фоновая проверка следит заново.
                komodTaskId: null,
                komodSentAt: null
            }
        });
        if (count === 0) return res.status(400).json({ success: false, error: 'Можно переотправлять только посты с ошибкой' });

        enqueueDuePosts().catch((error) => console.error('[RETRY] Планировщик подхватит пост позже:', error.message));

        res.json({ success: true, message: 'Пост отправлен в очередь на публикацию' });
    } catch (error) {
        console.error('Ошибка в retryPost:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера при переотправке' });
    }
};


// === ОТМЕТИТЬ ПОСТ ПАРТНЁРА КАК ОПУБЛИКОВАННЫЙ И УВЕДОМИТЬ АВТОРА ===
// Вызывается воркером, когда пост действительно вышел в соцсети партнёра.
// Партнёр мог выбрать несколько аккаунтов: отметка ставится один раз, и уведомление уходит тоже одно.
const confirmSharedPostPublished = async (id) => {
    const { count } = await prisma.sharedPost.updateMany({ where: { id, isPublished: false }, data: { isPublished: true } });
    if (count === 0) return;

    const sharedPost = await prisma.sharedPost.findUnique({
        where: { id },
        include: { receiver: { select: { name: true, pavilion: true } } }
    });
    await prisma.notification.create({
        data: {
            userId: sharedPost.senderId,
            type: 'SUCCESS',
            text: `Партнер ${sharedPost.receiver?.name || 'Без имени'} (Павильон ${sharedPost.receiver?.pavilion || '?'}) опубликовал ваш пост у себя!`,
            metadata: JSON.stringify({ text: sharedPost.text, mediaUrls: sharedPost.mediaUrls })
        }
    });
};


// === ЭКСПОРТ ДЛЯ ФОНОВОГО ВОРКЕРА ===
exports.confirmSharedPostPublished = confirmSharedPostPublished;
exports.sendToTelegram = sendToTelegram;
exports.sendToKomodVK = sendToKomodVK;
exports.resumeKomodVK = resumeKomodVK;
exports.isKomodBackgroundTarget = isKomodBackgroundTarget;
exports.applyWatermark = applyWatermark;
exports.saveImageToFile = saveImageToFile;
