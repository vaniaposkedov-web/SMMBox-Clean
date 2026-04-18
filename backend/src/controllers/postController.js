const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp'); 
const cron = require('node-cron'); 
const jwt = require('jsonwebtoken');
const { logPost } = require('../utils/log_post');
const fs = require('fs');
const path = require('path');
const { postQueue } = require('../queue'); // Добавь эту строчку

// === ЛОГИКА ОТПРАВКИ В TELEGRAM ===В общем
async function sendToTelegram(token, chatId, text, imageBuffers) {
    const baseUrl = `https://api.telegram.org/bot${token}`;

    if (imageBuffers.length === 0) {
        await axios.post(`${baseUrl}/sendMessage`, { chat_id: chatId, text: text });
    } else if (imageBuffers.length === 1) {
        const form = new FormData();
        form.append('chat_id', chatId);
        if (text) form.append('caption', text);
        form.append('photo', imageBuffers[0], { filename: 'image.jpg', contentType: 'image/jpeg', knownLength: imageBuffers[0].length });
        await axios.post(`${baseUrl}/sendPhoto`, form, { headers: form.getHeaders() });
    } else {
        const form = new FormData();
        form.append('chat_id', chatId);
        
        const media = imageBuffers.map((buf, i) => ({
            type: 'photo',
            media: `attach://photo${i}`,
            caption: i === 0 ? text : '' 
        }));
        
        form.append('media', JSON.stringify(media));
        imageBuffers.forEach((buf, i) => {
            form.append(`photo${i}`, buf, { filename: `photo${i}.jpg`, contentType: 'image/jpeg', knownLength: buf.length });
        });
        
        await axios.post(`${baseUrl}/sendMediaGroup`, form, { headers: form.getHeaders() });
    }
}


async function saveImageToFile(buffer, prefix = 'img') {
    // Путь к папке backend/uploads/posts
    const uploadsDir = path.join(__dirname, '../../uploads/posts');
    
    // Автоматически создаем папку, если ее нет
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Генерируем уникальное имя файла
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
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
    const isWall = providerId.startsWith('wall_');

    logPost(userId, 'VK', 'START', `Начинаем отправку. Провайдер: ${providerId}`);

    const grpRes = await axios.get(`${KOMOD_BASE_URL}/group`, { headers: { 'Access-Token': token } });
    const groups = grpRes.data?.data?.items || grpRes.data?.data || [];

    let targetGroup = groups.find(g => 
        String(g.uid) === cleanId || 
        String(g.id) === cleanId || 
        String(g.account_id) === cleanId ||
        (g.url && String(g.url).includes(cleanId))
    );

    if (!targetGroup) {
        logPost(userId, 'VK', 'INFO', `Группа не найдена. Авто-регистрация...`);
        // Простая строка параметров, как любит этот API
        const addPayload = isWall 
            ? `account_id=${cleanId}&is_profile=1&post_images_as_grid=1`
            : `url=https://vk.com/club${cleanId}&title=Группа_${cleanId}&account_id=${cleanId}&post_images_as_grid=1`;

        await axios.post(`${KOMOD_BASE_URL}/group`, addPayload, {
            headers: { 'Access-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
            validateStatus: () => true
        });

        const newGrpRes = await axios.get(`${KOMOD_BASE_URL}/group`, { headers: { 'Access-Token': token } });
        const newGroups = newGrpRes.data?.data?.items || newGrpRes.data?.data || [];
        targetGroup = newGroups.find(g => String(g.uid) === cleanId || String(g.account_id) === cleanId);
        
        if (!targetGroup) throw new Error(`Стена еще не активирована!`);
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
            validateStatus: status => status < 500
        });

        if (postRes.data && postRes.data.success === false) {
            throw new Error('Ошибка шлюза: ' + JSON.stringify(postRes.data.errors));
        }

        logPost(userId, 'VK', 'SUCCESS', `Пост успешно улетел в ${providerId}`);

    } catch (error) {
        logPost(userId, 'VK', 'ERROR', `Ошибка отправки`, error.message || error.response?.data);
        throw error;
    }
}

// === ЗАЩИТА АВТОРИЗАЦИИ ===
const getUserId = (req) => {
    if (req.user && typeof req.user === 'object') return req.user.id || req.user.userId;
    if (req.userId) return req.userId;
    if (typeof req.user === 'string') return req.user;

    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.decode(token); 
            if (decoded) return decoded.id || decoded.userId;
        }
    } catch (e) {}
    return null;
};

// === Вспомогательная функция для наложения водяного знака ===
async function applyWatermark(imageBuffer, wmConfig) {
    // 🛡️ ЖЕЛЕЗОБЕТОННАЯ ПРОВЕРКА: Пропускаем чистое фото, если:
    // 1. Конфига нет
    // 2. Явно передано отключение (enabled/isActive = false)
    // 3. Стоит дефолтный текст 'SADOVODPS', но знак не активирован явно
    if (!wmConfig || 
        wmConfig.enabled === false || 
        wmConfig.isActive === false) {
        return imageBuffer;
    }

    if (wmConfig.type === 'text' && wmConfig.text === 'SADOVODPS' && !wmConfig.enabled) {
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

        const sizeValue = wmConfig.size !== undefined ? wmConfig.size : 20; 
        const marginValue = wmConfig.margin !== undefined ? wmConfig.margin : 5;
        const opacity = (wmConfig.opacity !== undefined ? wmConfig.opacity : 80) / 100;
        
        const padX = Math.floor(width * (marginValue / 100));
        const padY = Math.floor(width * (marginValue / 100));

        let overlayBuffer;
        let overlayMeta;

        if (wmConfig.type === 'text') {
            const text = wmConfig.text; 
            const textColor = wmConfig.textColor || '#FFFFFF';
            const bgColor = wmConfig.bgColor || '#000000';
            const hasBg = wmConfig.hasBackground !== false;
            
            const fontSize = Math.max(12, Math.floor(width * (sizeValue / 100) * 0.20)); 
            
            const bgPaddingVal = wmConfig.bgPadding !== undefined ? wmConfig.bgPadding : 10;
            const innerPadV = Math.floor(fontSize * (bgPaddingVal / 25));
            const innerPadH = Math.floor(fontSize * (bgPaddingVal / 12));
            
            const textWidth = Math.floor(fontSize * 0.60 * text.length);
            const svgWidth = textWidth + (innerPadH * 2);
            const svgHeight = fontSize + (innerPadV * 2);

            const hasStroke = wmConfig.hasStroke;
            const strokeColor = wmConfig.strokeColor || '#000000';
            const strokeWidth = Math.max(1, Math.floor((wmConfig.strokeWidth || 2) * (width / 1000)));

            const strokeAttr = hasStroke ? `stroke="${strokeColor}" stroke-width="${strokeWidth}" paint-order="stroke"` : '';
            const fontFam = wmConfig.fontFamily ? wmConfig.fontFamily.replace(/"/g, "'") : 'sans-serif';

            const svg = `
                <svg width="${svgWidth}" height="${svgHeight}">
                    <style>
                        .bg { fill: ${bgColor}; opacity: ${hasBg ? opacity * 0.6 : 0}; }
                        .text { fill: ${textColor}; font-size: ${fontSize}px; font-family: ${fontFam}; font-weight: bold; opacity: ${opacity}; }
                    </style>
                    <rect width="100%" height="100%" rx="${fontSize * 0.2}" class="bg" />
                    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" class="text" ${strokeAttr}>${text}</text>
                </svg>`;
            overlayBuffer = Buffer.from(svg);
            
        } else if (wmConfig.type === 'image' && wmConfig.image) {
            const base64Data = wmConfig.image.includes(',') ? wmConfig.image.split(',')[1] : wmConfig.image;
            const targetWidth = Math.max(20, Math.floor(width * (sizeValue / 100) * 0.35));
            
            overlayBuffer = await sharp(Buffer.from(base64Data, 'base64'))
                .resize({ width: targetWidth, withoutEnlargement: false })
                .ensureAlpha(opacity)
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
        const pos = wmConfig.position || 'br';

        if (wmConfig.position === 'custom' && wmConfig.x !== undefined && wmConfig.y !== undefined) {
            left = Math.floor((width * wmConfig.x) / 100) - Math.floor(overlayMeta.width / 2);
            top = Math.floor((height * wmConfig.y) / 100) - Math.floor(overlayMeta.height / 2);
        } else {
            if (pos.includes('r')) left = width - overlayMeta.width - padX;
            if (pos.includes('c')) left = Math.floor((width - overlayMeta.width) / 2);
            if (pos.includes('b')) top = height - overlayMeta.height - padY;
            if (pos === 'cc') top = Math.floor((height - overlayMeta.height) / 2);
        }

        left = Math.max(0, Math.min(left, width - overlayMeta.width));
        top = Math.max(0, Math.min(top, height - overlayMeta.height));

        return await sharp(imageBuffer)
            .composite([{ input: overlayBuffer, top, left }])
            .toBuffer();
            
    } catch (err) {
        console.error('[WATERMARK ERROR]:', err);
        return imageBuffer; 
    }
}

exports.createPost = async (req, res) => {
    try {
        const { text, accountsData, publishAt } = req.body;
        
        let accounts = [];
        if (accountsData) {
            accounts = typeof accountsData === 'string' ? JSON.parse(accountsData) : accountsData;
        }
        
        let parsedPublishAt = null;
        let isScheduled = false;

        if (publishAt && publishAt !== 'null' && String(publishAt).trim() !== "") {
            const tempDate = new Date(publishAt);
            if (!isNaN(tempDate.getTime())) {
                parsedPublishAt = tempDate;
                isScheduled = true;
            }
        }
        
        if (!accounts || accounts.length === 0) {
            return res.status(400).json({ success: false, error: 'Нет аккаунтов для отправки' });
        }

        // БЫСТРЫЙ ШАГ 1: Надежно сохраняем файлы в постоянный volume
        const safeFilePaths = [];
        if (req.files && req.files.length > 0) {
            // Создаем папку для очереди, если её нет
            const tempDir = path.join(__dirname, '../../uploads/temp_queue');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            for (const file of req.files) {
                const ext = path.extname(file.originalname) || '.jpg';
                const safePath = path.join(tempDir, `task_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
                // Физически копируем файл в надежное место
                await fs.promises.copyFile(file.path, safePath);
                safeFilePaths.push(safePath);
            }
        }

        // БЫСТРЫЙ ШАГ 2: Создаем записи в базе данных
        for (const accData of accounts) {
            const account = await prisma.account.findUnique({ 
                where: { id: accData.accountId },
                include: { watermark: true } 
            });
            if (!account) continue;

            const post = await prisma.post.create({
                data: {
                    accountId: account.id,
                    text: text || '',
                    mediaUrls: JSON.stringify(filePaths), // Временно сохраняем пути к сырым файлам
                    publishAt: parsedPublishAt,
                    status: isScheduled ? 'SCHEDULED' : 'PROCESSING' // PROCESSING означает "В обработке"
                }
            });

            // БЫСТРЫЙ ШАГ 3: Если пост надо выложить СЕЙЧАС — кидаем чек на кухню (в очередь)
            if (!isScheduled) {
                await postQueue.add('publish-job', {
                    postId: post.id,
                    accountId: account.id,
                    text: text || '',
                    filePaths: safeFilePaths,
                    watermarkConfig: accData.applyWatermark ? (accData.watermarkConfig || account.watermark) : null,
                    signatureText: accData.applySignature ? (accData.signatureText !== undefined ? accData.signatureText : account.signature) : null
                }, {
                    attempts: 3, // Если сеть упадет, воркер попробует еще 3 раза
                    backoff: { type: 'exponential', delay: 2000 }
                });
            }
        }

        // БЫСТРЫЙ ШАГ 4: СРАЗУ отвечаем фронтенду, что всё супер!
        // Пользователь сразу увидит галочку, пока сервер в фоне будет делать работу.
        return res.status(200).json({ success: true, message: 'Посты успешно отправлены в обработку' });

    } catch (error) {
        console.error('[FATAL ERROR] Сбой createPost:', error);
        if (!res.headersSent) res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
};

/// === ТАЙМЕР (CRON): АВТОМАТИЧЕСКАЯ ОТПРАВКА ОТЛОЖЕННЫХ ПОСТОВ ===
exports.initCron = () => {
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const postsToPublish = await prisma.post.findMany({
                where: { status: 'SCHEDULED', publishAt: { lte: now } },
                include: { account: true }
            });

            if (postsToPublish.length > 0) {
                console.log(`\n[CRON] ⏰ Найдено отложенных постов для отправки: ${postsToPublish.length}`);
            }

            for (const post of postsToPublish) {
                try {
                    const account = post.account;
                    const mediaUrls = JSON.parse(post.mediaUrls || '[]');
                    
                    const imageBuffers = [];
                    
                    // Читаем фото: поддержка и новых (файлы) и старых (Base64) постов
                    for (const imgUrl of mediaUrls) {
                        if (imgUrl.startsWith('data:')) {
                            // Поддержка СТАРЫХ постов (Base64)
                            const base64Data = imgUrl.split(',')[1];
                            imageBuffers.push(Buffer.from(base64Data, 'base64'));
                        } else {
                            // Читаем НОВЫЕ файлы с диска
                            const filePath = path.join(__dirname, '../..', imgUrl);
                            try {
                                const buf = await fs.promises.readFile(filePath);
                                imageBuffers.push(buf);
                            } catch (e) {
                                console.error(`[CRON ERROR] Не найден файл ${filePath}`);
                            }
                        }
                    }

                    const providerType = account.provider.toLowerCase();
                    if (providerType === 'telegram') {
                        const botToken = process.env.TELEGRAM_BOT_TOKEN.replace(/['"]/g, '').trim();
                        await sendToTelegram(botToken, account.providerId, post.text, imageBuffers);
                    } else if (providerType === 'vk') {
                        await sendToKomodVK(account.accessToken, account.providerId, post.text, imageBuffers, null, account.userId);
                    }

                    
                    const thumbnailsUrls = await Promise.all(imageBuffers.map(async (buf) => {
                        // 🟢 ИСПРАВЛЕНИЕ: Сжимаем до WebP 400px (вес будет в 10 раз меньше, чем JPEG 800px)
                        const thumbBuf = await sharp(buf)
                            .resize({ width: 400, fit: 'inside', withoutEnlargement: true })
                            .webp({ quality: 65 })
                            .toBuffer();
                        return await saveImageToFile(thumbBuf, 'history_cron');
                    }));
                    await prisma.post.update({
                        where: { id: post.id },
                        data: { 
                            status: 'PUBLISHED', 
                            mediaUrls: JSON.stringify(thumbnailsUrls) 
                            // ВАЖНО: Мы НЕ обнуляем publishAt, чтобы пост остался в календаре
                        } 
                    });
                    
                    console.log(`[CRON] ✅ Отложенный пост #${post.id} успешно отправлен!`);
                } catch (err) {
                    console.error(`[CRON ERROR] Ошибка отправки отложенного поста #${post.id}:`, err.message);
                    await prisma.post.update({ where: { id: post.id }, data: { status: 'FAILED' } });
                }
            }
        } catch (e) {
            console.error('[CRON FATAL ERROR]', e);
        }
    });

    // === АВТО-ОЧИСТКА ВРЕМЕННЫХ ФАЙЛОВ ===
    // Каждую ночь в 3:00 удаляем отработанные фото из очереди старше 1 дня
    cron.schedule('0 3 * * *', async () => {
        try {
            const tempDir = path.join(__dirname, '../../uploads/temp_queue');
            if (fs.existsSync(tempDir)) {
                const files = await fs.promises.readdir(tempDir);
                const now = Date.now();
                for (const file of files) {
                    const filePath = path.join(tempDir, file);
                    const stats = await fs.promises.stat(filePath);
                    // Если файлу больше 24 часов - удаляем
                    if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) { 
                        await fs.promises.unlink(filePath).catch(()=>({}));
                    }
                }
            }
        } catch (e) { console.error('[CRON] Ошибка очистки темп-файлов', e); }
    });
};


/// === ПОЛУЧИТЬ ТОЛЬКО ОТЛОЖЕННЫЕ ПОСТЫ ДЛЯ КАЛЕНДАРЯ ===
exports.getScheduledPosts = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Ошибка авторизации' });

        const posts = await prisma.post.findMany({
            where: { account: { userId: userId } },
            include: { account: { select: { name: true, provider: true, avatarUrl: true } } },
            orderBy: [{ createdAt: 'desc' }],
            take: 75 // 🟢 ИСПРАВЛЕНИЕ: Загружаем 75 постов вместо 500
        });

        // 🟢 ИСПРАВЛЕНИЕ: БОЛЬШЕ НИКАКОЙ ОБРЕЗКИ. Отдаем массив mediaUrls целиком!
        res.json({ success: true, posts: posts });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};
// === ОБНОВИТЬ СУЩЕСТВУЮЩИЙ ОТЛОЖЕННЫЙ ПОСТ (РЕДАКТИРОВАНИЕ) ===
exports.updateScheduledPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, publishAt } = req.body;
        
        const post = await prisma.post.findUnique({ where: { id }});
        if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });
        if (post.status !== 'SCHEDULED') return res.status(400).json({ success: false, error: 'Этот пост уже опубликован' });
        
        const updated = await prisma.post.update({
            where: { id },
            data: {
                text: text !== undefined ? text : post.text,
                publishAt: publishAt ? new Date(publishAt) : post.publishAt
            }
        });
        res.json({ success: true, post: updated });
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

        if (!senderId) return res.status(401).json({ success: false, error: 'Ошибка авторизации' });
        if (!partnerIds || partnerIds.length === 0) return res.status(400).json({ success: false, error: 'Выберите партнера' });

        const sender = await prisma.user.findUnique({ where: { id: senderId } });
        if (!sender) return res.status(404).json({ success: false, error: 'Отправитель не найден' });

        // 🛡️ 2. БЕЗОПАСНАЯ ОБРАБОТКА ФАЙЛОВ (И ОТ OOM, И ОТ ОШИБОК ПАРСИНГА)
        let savedImageUrls = [];
        
        if (req.files && req.files.length > 0) {
            // ВЕТКА А: Если фронтенд прислал файлы через FormData
            for (const file of req.files) {
                try {
                    const buffer = await fs.promises.readFile(file.path);
                    fs.promises.unlink(file.path).catch(() => {});
                    
                    const optimizedBuf = await sharp(buffer)
                        .resize({ width: 2000, fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 85 })
                        .toBuffer();
                        
                    const url = await saveImageToFile(optimizedBuf, 'shared');
                    if (url) savedImageUrls.push(url);
                } catch (e) {
                    console.error('Ошибка обработки фото партнера (файл):', e);
                }
            }
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
                        console.error('Ошибка конвертации Base64 в файл:', e);
                    }
                } else if (img && typeof img === 'string' && img.startsWith('/uploads/')) {
                    // Если вдруг прислали уже готовый путь
                    savedImageUrls.push(img);
                }
            }
        }

        const mediaString = JSON.stringify(savedImageUrls);
        const postText = req.body.text || '';

        // 🛡️ 3. ПОСЛЕДОВАТЕЛЬНАЯ ЗАПИСЬ В БАЗУ ДАННЫХ
        for (const receiverId of partnerIds) {
            try {
                await prisma.sharedPost.create({
                    data: { senderId: sender.id, receiverId, text: postText, mediaUrls: mediaString }
                });
                await prisma.notification.create({
                    data: { 
                        userId: receiverId, 
                        type: 'INFO',
                        text: `Партнер ${sender?.name || 'Без имени'} поделился с вами новой публикацией.`,
                        metadata: JSON.stringify({ text: postText, mediaUrls: savedImageUrls })
                    }
                });
            } catch (dbError) {
                console.error(`Ошибка записи в БД для партнера ${receiverId}:`, dbError.message);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('ФАТАЛЬНАЯ ОШИБКА ШЕРИНГА:', error);
        res.status(500).json({ success: false, error: `Внутренняя ошибка сервера: ${error.message}` });
    }
};

exports.getSharedPosts = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Ошибка авторизации' });

        const incoming = await prisma.sharedPost.findMany({
            where: { receiverId: userId },
            include: { sender: { select: { id: true, name: true, pavilion: true, avatarUrl: true } } },
            orderBy: { createdAt: 'desc' }
        });
        const outgoing = await prisma.sharedPost.findMany({
            where: { senderId: userId },
            include: { receiver: { select: { id: true, name: true, pavilion: true, avatarUrl: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, incoming, outgoing });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// === ОТКАЗАТЬСЯ ОТ ПОСТА ПАРТНЕРА (С УВЕДОМЛЕНИЕМ) ===
exports.deleteSharedPost = async (req, res) => {
    try {
        const post = await prisma.sharedPost.findUnique({
            where: { id: req.params.id },
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
        await prisma.post.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

exports.markSharedPostRead = async (req, res) => {
  try {
    await prisma.sharedPost.update({ where: { id: req.body.id }, data: { isRead: true } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Ошибка' }); }
};

// === API ДЛЯ АДМИНКИ: ЧТЕНИЕ ЛОГОВ ПУБЛИКАЦИИ ===
exports.getSystemLogs = async (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const { date } = req.query; 
    
    try {
        const targetDate = date || new Date().toLocaleDateString('en-CA');
        const logPath = path.join(__dirname, '../../logs', `posts_${targetDate}.log`);
        
        if (!fs.existsSync(logPath)) {
            return res.json({ success: true, logs: [], message: 'За эту дату логов нет' });
        }
        
        const fileContent = fs.readFileSync(logPath, 'utf-8');
        const logLines = fileContent.split('\n').filter(line => line.trim() !== '');
        
        const parsedLogs = logLines.map((line, index) => {
            const match = line.match(/^\[(.*?)\]\s+\[USER:(.*?)\]\s+\[(.*?)\]\s+\[(.*?)\]\s+(.*?)\s+\|\s+DETAILS:\s+(.*)$/);
            
            if (match) {
                let parsedDetails = match[6];
                try { parsedDetails = JSON.parse(match[6]); } catch (e) {}

                return {
                    id: `${targetDate}-${index}`,
                    timestamp: match[1],
                    userId: match[2],
                    provider: match[3],
                    action: match[4],      
                    message: match[5],
                    details: parsedDetails
                };
            }
            return { id: `${targetDate}-${index}`, raw: line };
        }).reverse(); 
        
        res.json({ success: true, logs: parsedLogs });
    } catch (error) {
        console.error('Ошибка чтения логов для админки:', error);
        res.status(500).json({ success: false, error: 'Не удалось прочитать файлы логов' });
    }
};


// === ПОЛУЧИТЬ ПОЛНУЮ ИСТОРИЮ ПОСТОВ (ВК/ТГ + ПАРТНЕРЫ) ===
exports.getPostsHistory = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Ошибка авторизации' });

        // 1. Берем обычные посты (VK / Telegram)
        const posts = await prisma.post.findMany({
            where: { account: { userId: userId } },
            include: { account: { select: { name: true, provider: true, avatarUrl: true } } },
            orderBy: [{ createdAt: 'desc' }],
            take: 500 
        });

        // 2. Берем посты, отправленные партнерам
        const sharedPosts = await prisma.sharedPost.findMany({
            where: { senderId: userId },
            include: { receiver: { select: { name: true, avatarUrl: true, pavilion: true } } },
            orderBy: [{ createdAt: 'desc' }],
            take: 75 // 🟢 ИСПРАВЛЕНИЕ: Загружаем 75 постов вместо 500
        });

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

        // Переводим пост обратно в статус SCHEDULED и ставим время на "сейчас", 
        // чтобы твой CRON-планировщик подхватил его в следующую минуту
        const updatedPost = await prisma.post.update({
            where: { id },
            data: { 
                status: 'SCHEDULED',
                publishAt: new Date() 
            }
        });

        res.json({ success: true, message: 'Пост отправлен в очередь на публикацию' });
    } catch (error) {
        console.error('Ошибка в retryPost:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера при переотправке' });
    }
};


/// === ОТМЕТИТЬ ПОСТ КАК ОПУБЛИКОВАННЫЙ И УВЕДОМИТЬ АВТОРА ===
exports.markSharedPostPublished = async (req, res) => {
    try {
        const { id } = req.params;
        const sharedPost = await prisma.sharedPost.findUnique({
            where: { id },
            include: { sender: true, receiver: { select: { name: true, pavilion: true } } }
        });

        // 🛡️ ЗАЩИТА ОТ ДУБЛЕЙ: Проверяем, не опубликован ли он уже
        if (!sharedPost || sharedPost.isPublished) {
            return res.status(404).json({ success: false, error: 'Пост не найден или уже обработан' });
        }
        
        // Обновляем статус
        await prisma.sharedPost.update({
            where: { id },
            data: { isPublished: true }
        });

        // Создаем 1 уведомление
        await prisma.notification.create({
            data: {
                userId: sharedPost.senderId,
                type: 'SUCCESS',
                text: `Партнер ${sharedPost.receiver?.name || 'Без имени'} (Павильон ${sharedPost.receiver?.pavilion || '?'}) опубликовал ваш пост у себя!`,
                metadata: JSON.stringify({ text: sharedPost.text, mediaUrls: sharedPost.mediaUrls })
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка в markSharedPostPublished:', error);
        res.status(500).json({ success: false });
    }
};


// === ЭКСПОРТ ДЛЯ ФОНОВОГО ВОРКЕРА ===
exports.sendToTelegram = sendToTelegram;
exports.sendToKomodVK = sendToKomodVK;
exports.applyWatermark = applyWatermark;
exports.saveImageToFile = saveImageToFile;