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
async function sendToKomodVK(token, providerId, text, imageBuffers, publishAtDate = null, userId = 'CRON') {
    const KOMOD_BASE_URL = 'https://kom-od.ru/api/v1';
    const form = new FormData();

    let targetGroupId = null;
    const cleanId = providerId.replace('wall_', '').replace('group_', '');


    logPost(userId, 'VK', 'START', `Начинаем отправку. Провайдер: ${providerId}`);

    const grpRes = await axios.get(`${KOMOD_BASE_URL}/group`, { headers: { 'Access-Token': token } });
    const allGroups = grpRes.data?.data?.items || grpRes.data?.data || [];

    // Ключ шлюза общий на всех клиентов, поэтому ищем только среди групп аккаунтов этого пользователя
    // и только по точному совпадению номера или адреса группы.
    const ownProfiles = await prisma.socialProfile.findMany({
        where: { userId: String(userId), provider: 'VK' },
        select: { providerAccountId: true }
    });
    const ownAccountIds = new Set(ownProfiles.map((profile) => String(profile.providerAccountId)));
    const urlTail = (group) => String(group.url || '').replace(/\/+$/, '').split('/').pop().replace(/^(club|public|event|id)(?=\d)/, '');

    const targetGroup = allGroups.find((group) => (
        ownAccountIds.has(String(group.account_id)) &&
        (String(group.uid || group.id) === cleanId || urlTail(group) === cleanId)
    ));

    if (!targetGroup) {
        logPost(userId, 'VK', 'ERROR', `Группа ${providerId} не найдена среди подключённых аккаунтов`);
        throw new Error('Группа не подключена в Kom-OD. Подключите её заново в разделе «Аккаунты и страницы».');
    }

    // 🔥 ИДЕАЛЬНАЯ КОПИЯ CURL-ЗАПРОСА АЛЕКСЕЯ
    if (targetGroup) {
        try {
            const upRes = await axios.post(
                `${KOMOD_BASE_URL}/group/${targetGroup.id}`,
                'post_images_as_grid=1', // Отправляем чистую строку, как в curl -d
                {
                    headers: {
                        'Access-Token': token,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    validateStatus: () => true
                }
            );
            logPost(userId, 'VK', 'INFO', `СЕТКА: Обновлена для ${targetGroup.id}. Ответ шлюза: HTTP ${upRes.status}`);
        } catch (e) {
            logPost(userId, 'VK', 'ERROR', `Ошибка обновления группы: ${e.message}`);
        }
    }

    targetGroupId = targetGroup.id;
    form.append('group_id', targetGroupId);
    
    // 🔥 ПАРАМЕТРЫ ПОСТИНГА
    form.append('via_api', '0'); // ВАЖНО: 0 включает веб-эмуляцию, в которой ВК собирает фото в сетку
    form.append('post_images_as_grid', '1'); // Дублируем в тело поста для верности

    let targetDate = publishAtDate ? new Date(publishAtDate) : new Date();
    const tzString = targetDate.toLocaleString('sv-SE', { timeZone: 'Europe/Moscow' });
    const formattedDate = tzString.substring(0, 16).replace('T', ' ');
    form.append('publish_at', formattedDate);
    
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

    try {
        const postRes = await axios.post(`${KOMOD_BASE_URL}/post`, form, {
            headers: { ...form.getHeaders(), 'Access-Token': token },
            maxBodyLength: Infinity,
            timeout: 120 * 1000,
            validateStatus: status => status < 500
        });

        if (postRes.status >= 400 || postRes.data?.success === false) {
            logPost(userId, 'VK', 'ERROR', `Шлюз отклонил пост: HTTP ${postRes.status}`);
            const details = postRes.data?.errors || postRes.data?.message || `код ${postRes.status}`;
            throw new Error('Ошибка шлюза: ' + (typeof details === 'string' ? details : JSON.stringify(details)));
        }

        logPost(userId, 'VK', 'SUCCESS', `Пост успешно улетел в ${providerId}`);

    } catch (error) {
        logPost(userId, 'VK', 'ERROR', `Ошибка отправки`, error.message || error.response?.data);
        throw error;
    }
}

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
const ORIGINALS_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const parseJson = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch (e) { return fallback; } };

const removeUploadedFiles = (req) => Promise.all((req.files || []).map((file) => fs.promises.unlink(file.path).catch(() => {})));

// Сколько примерно ждать отправки: посты идут по очереди, один пост занимает около 10 секунд.
const SECONDS_PER_POST = 10;
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
        if (!postText.trim() && !(req.files || []).length) {
            await removeUploadedFiles(req);
            return res.status(400).json({ success: false, error: 'Добавьте текст или хотя бы одно фото' });
        }

        // Публиковать можно только в свои аккаунты, при активной подписке и в пределах тарифа
        const userId = getUserId(req);
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

        if (req.files && req.files.length > 0) {
            const tempDir = path.join(__dirname, '../../uploads/temp_queue');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            for (const file of req.files) {
                const ext = path.extname(file.originalname) || '.jpg';
                const fileName = `task_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
                const safePath = path.join(tempDir, fileName);
                
                // Копируем файл в надежную папку
                await fs.promises.copyFile(file.path, safePath);
                // Удаляем исходный мусорный файл от multer из /tmp/
                await fs.promises.unlink(file.path).catch(() => {}); 
                
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
        where: { status: 'DELIVERING', createdAt: { lt: cutoff }, OR: [{ publishAt: null }, { publishAt: { lt: cutoff } }] },
        data: { status: 'DELIVERY_UNKNOWN', errorMessage: 'Связь прервалась во время отправки. Проверьте канал перед повторной публикацией.' }
    });
    if (count > 0) console.error(`[CRON] Зависшие посты отмечены как ошибка: ${count}`);
    if (unknown.count > 0) console.error(`[CRON] Результат отправки неизвестен: ${unknown.count}`);
    return { failed: count, unknown: unknown.count };
};

// Исходные фото хранятся 30 дней: они нужны для отправки партнёрам и повторной публикации.
// Фото постов, которые ещё ждут отправки, не удаляются, сколько бы они ни ждали.
exports.cleanupTempQueue = async () => {
    if (!fs.existsSync(TEMP_QUEUE_DIR)) return { removed: 0 };

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

    let removed = 0;
    const now = Date.now();
    for (const file of await fs.promises.readdir(TEMP_QUEUE_DIR)) {
        if (inUse.has(file)) continue;
        const filePath = path.join(TEMP_QUEUE_DIR, file);
        const stats = await fs.promises.stat(filePath);
        if (now - stats.mtimeMs > ORIGINALS_RETENTION_MS) {
            await fs.promises.unlink(filePath).catch(() => {});
            removed += 1;
        }
    }
    return { removed };
};

exports.initCron = () => {
    cron.schedule('* * * * *', async () => {
        try {
            await enqueueDuePosts();
        } catch (e) {
            console.error('[CRON FATAL ERROR]', e.message);
        }
    });

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

        if (req.files && req.files.length > 0) {
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
        const postText = req.body.text || '';

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

        res.json({ success: true, delivered, failed });
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

        // Условие по статусу защищает от двойного нажатия. Планировщик не ждём: пост уходит в очередь сразу.
        const { count } = await prisma.post.updateMany({
            where: { id, status: 'FAILED' },
            data: {
                status: 'SCHEDULED',
                errorMessage: null,
                publishAt: new Date()
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
exports.applyWatermark = applyWatermark;
exports.saveImageToFile = saveImageToFile;
