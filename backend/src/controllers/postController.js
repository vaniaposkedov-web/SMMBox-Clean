const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp'); 
const cron = require('node-cron'); 
const jwt = require('jsonwebtoken');
const { logPost } = require('../utils/log_post');

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

// === ЛОГИКА ОТПРАВКИ KOM-OD (ВК) С АВТО-РЕГИСТРАЦИЕЙ ПРОФИЛЕЙ ===
async function sendToKomodVK(token, providerId, text, imageBuffers, publishAtDate = null, userId = 'CRON') {
    const KOMOD_BASE_URL = 'https://kom-od.ru/api/v1';
    const form = new FormData();

    let targetGroupId = null;
    const cleanId = providerId.replace('wall_', '').replace('group_', '');
    const isWall = providerId.startsWith('wall_');

    logPost(userId, 'VK', 'START', `Начинаем отправку. Провайдер: ${providerId}`, { 
        hasText: !!text, 
        imagesCount: imageBuffers.length,
        publishAt: publishAtDate 
    });

    // 1. Получаем список групп из шлюза
    const grpRes = await axios.get(`${KOMOD_BASE_URL}/group`, { headers: { 'Access-Token': token } });
    const groups = grpRes.data?.data?.items || grpRes.data?.data || [];

    let targetGroup = groups.find(g => 
        String(g.uid) === cleanId || 
        String(g.id) === cleanId || 
        String(g.account_id) === cleanId ||
        (g.url && String(g.url).includes(cleanId))
    );

    // 2. АВТО-РЕГИСТРАЦИЯ
    if (!targetGroup) {
        logPost(userId, 'VK', 'INFO', `Цель ${providerId} не найдена в шлюзе. Пробуем авто-регистрацию...`);
        const addForm = new FormData();
        if (isWall) {
            addForm.append('account_id', cleanId);
            addForm.append('is_profile', '1');
        } else {
            addForm.append('url', `https://vk.com/club${cleanId}`);
            addForm.append('title', `Авто-добавленная группа ${cleanId}`);
            addForm.append('account_id', cleanId);
        }

        try {
            const addRes = await axios.post(`${KOMOD_BASE_URL}/group`, addForm, {
                headers: { ...addForm.getHeaders(), 'Access-Token': token },
                validateStatus: () => true
            });

            if (addRes.data && addRes.data.success !== false) {
                const newGrpRes = await axios.get(`${KOMOD_BASE_URL}/group`, { headers: { 'Access-Token': token } });
                const newGroups = newGrpRes.data?.data?.items || newGrpRes.data?.data || [];
                targetGroup = newGroups.find(g => String(g.uid) === cleanId || String(g.account_id) === cleanId);
                logPost(userId, 'VK', 'SUCCESS', `Авто-регистрация ${providerId} прошла успешно`);
            }
        } catch (addError) {
            logPost(userId, 'VK', 'ERROR', `Ошибка авто-регистрации ${providerId}`, addError.message);
        }
        
        if (!targetGroup) throw new Error(`Стена еще не активирована! Зайдите на kom-od.ru и подключите стену.`);
    }

    targetGroupId = targetGroup.id;
    form.append('group_id', targetGroupId);
    form.append('via_api', '1');

    // === ФИКС КОТОРЫЙ МЫ ДЕЛАЛИ (ОСТАЛСЯ БЕЗ ИЗМЕНЕНИЙ) ===
    let targetDate = publishAtDate ? new Date(publishAtDate) : new Date();
    const tzString = targetDate.toLocaleString('sv-SE', { timeZone: 'Europe/Moscow' });
    const formattedDate = tzString.substring(0, 16).replace('T', ' ');
    form.append('publish_at', formattedDate);
    
    logPost(userId, 'VK', 'INFO', `Установлено время публикации (MSK): ${formattedDate}`);
    
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

        logPost(userId, 'VK', 'API_RESPONSE', `Ответ от шлюза Kom-od: HTTP ${postRes.status}`, postRes.data);

        if (postRes.data && postRes.data.success === false) {
            throw new Error('Ошибка шлюза: ' + JSON.stringify(postRes.data.errors));
        }

        logPost(userId, 'VK', 'SUCCESS', `Пост успешно улетел в ${providerId}`);

    } catch (error) {
        logPost(userId, 'VK', 'ERROR', `Фатальная ошибка отправки в ${providerId}`, error.message || error.response?.data);
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
    if (!wmConfig) return imageBuffer;
    
    try {
        const metadata = await sharp(imageBuffer).metadata();
        const { width, height } = metadata;

        const sizeValue = wmConfig.size !== undefined ? wmConfig.size : 20; 
        const marginValue = wmConfig.margin !== undefined ? wmConfig.margin : 5;
        const opacity = (wmConfig.opacity !== undefined ? wmConfig.opacity : 80) / 100;
        
        // 🟢 ИСПРАВЛЕНИЕ: Все расчеты ведем СТРОГО от ШИРИНЫ кадра
        const padX = Math.floor(width * (marginValue / 100));
        const padY = Math.floor(width * (marginValue / 100));

        let overlayBuffer;
        let overlayMeta;

        if (wmConfig.type === 'text') {
            const text = wmConfig.text || 'SMMBOX';
            const textColor = wmConfig.textColor || '#FFFFFF';
            const bgColor = wmConfig.bgColor || '#000000';
            const hasBg = wmConfig.hasBackground !== false;
            
            // Базовый размер шрифта: 100% на ползунке = 20% от ШИРИНЫ картинки
            const fontSize = Math.max(12, Math.floor(width * (sizeValue / 100) * 0.20)); 
            
            const bgPaddingVal = wmConfig.bgPadding !== undefined ? wmConfig.bgPadding : 10;
            const innerPadV = Math.floor(fontSize * (bgPaddingVal / 25));
            const innerPadH = Math.floor(fontSize * (bgPaddingVal / 12));
            
            // Расчет габаритов SVG
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
            
            // Для логотипа: 100% на ползунке = 35% от ШИРИНЫ фото
            const targetWidth = Math.max(20, Math.floor(width * (sizeValue / 100) * 0.35));
            
            overlayBuffer = await sharp(Buffer.from(base64Data, 'base64'))
                .resize({ width: targetWidth, withoutEnlargement: false })
                .ensureAlpha(opacity)
                .toBuffer();
        } else {
            return imageBuffer;
        }

        // Поворот (если задан)
        if (wmConfig.angle) {
            overlayBuffer = await sharp(overlayBuffer)
                .rotate(wmConfig.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();
        }

        overlayMeta = await sharp(overlayBuffer).metadata();

        // Расчет координат наложения
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

        // Защита: не даем знаку улететь за край экрана
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

// Полный исправленный метод создания поста
// В методе exports.createPost
exports.createPost = async (req, res) => {
    try {
        const { text, mediaUrls = [], accounts = [], publishAt } = req.body;
        
        let parsedPublishAt = null;
        let isScheduled = false;

        // Более надежная проверка даты
        if (publishAt && publishAt !== 'null' && String(publishAt).trim() !== "") {
            const tempDate = new Date(publishAt);
            if (!isNaN(tempDate.getTime())) {
                parsedPublishAt = tempDate;
                isScheduled = true;
                console.log(`[DEBUG] Пост определен как ОТЛОЖЕННЫЙ на: ${parsedPublishAt}`);
            }
        }
// ...
        
        if (!accounts || accounts.length === 0) {
            return res.status(400).json({ success: false, error: 'Нет аккаунтов для отправки' });
        }

        // Подготовка изображений (Buffer)
        const rawImageBuffers = mediaUrls.map(img => {
            const base64Data = img.includes(',') ? img.split(',')[1] : img;
            return Buffer.from(base64Data, 'base64');
        });

        // Оптимизация (sharp)
        const optimizedBaseBuffers = await Promise.all(rawImageBuffers.map(async (buf) => {
            return await sharp(buf)
                .resize({ width: 2500, height: 2500, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 90 })
                .toBuffer();
        }));

        const accountJobs = [];

        // Формирование очереди заданий (подписи, водяные знаки)
        for (const accData of accounts) {
            const account = await prisma.account.findUnique({ 
                where: { id: accData.accountId },
                include: { watermark: true } 
            });
            if (!account) continue;

            let finalText = text || '';
            const sigText = accData.signatureText !== undefined ? accData.signatureText : (accData.signature !== undefined ? accData.signature : account.signature);
            const applySig = accData.applySignature !== undefined ? accData.applySignature : !!sigText;

            if (applySig && sigText) {
                finalText += `\n\n${sigText}`;
            }

            let processedBuffers = [...optimizedBaseBuffers];
            
            let wmConfig = accData.watermarkConfig || account.watermark;
            let applyWm = accData.applyWatermark === true || (accData.applyWatermark === undefined && !!wmConfig);

            if (applyWm && wmConfig && processedBuffers.length > 0) {
                processedBuffers = await Promise.all(
                    processedBuffers.map(buf => applyWatermark(buf, wmConfig))
                );
            }

            accountJobs.push({ account, finalText, processedBuffers });
        }

        // === ВЕТКА А: ОТЛОЖЕННЫЙ ПОСТ ===
        if (isScheduled) {
            for (const job of accountJobs) {
                // ПРАВИЛЬНО создаем миниатюры для отложенного поста
                const finalImagesToSave = await Promise.all(job.processedBuffers.map(async (buf) => {
                    const thumb = await sharp(buf).resize({ width: 600, height: 600, fit: 'inside' }).jpeg({ quality: 60 }).toBuffer();
                    return 'data:image/jpeg;base64,' + thumb.toString('base64');
                }));

                await prisma.post.create({
                    data: {
                        accountId: job.account.id,
                        text: job.finalText,
                        mediaUrls: JSON.stringify(finalImagesToSave),
                        publishAt: parsedPublishAt, // Строго сохраняем БУДУЩУЮ дату
                        status: 'SCHEDULED' // Оставляем статус для Cron-планировщика
                    }
                });
            }
            return res.status(200).json({ success: true, message: 'Запланировано' });
        }
        
        // === ВЕТКА Б: МОМЕНТАЛЬНАЯ ПУБЛИКАЦИЯ ===
        else {
            let hasErrors = false;
            let lastError = '';

            for (const job of accountJobs) {
                try {
                    const providerType = job.account.provider.toLowerCase(); 
                    
                    if (providerType === 'telegram') {
                        const botToken = process.env.TELEGRAM_BOT_TOKEN.replace(/['"]/g, '').trim();
                        await sendToTelegram(botToken, job.account.providerId, job.finalText, job.processedBuffers);
                    } else if (providerType === 'vk') {
                        await sendToKomodVK(job.account.accessToken, job.account.providerId, job.finalText, job.processedBuffers, null, job.account.userId);
                    }

                    // Сжимаем фото для сохранения в истории
                    const thumbnailsForDb = await Promise.all(job.processedBuffers.map(async (buf) => {
                        const thumb = await sharp(buf).resize({ width: 600, height: 600, fit: 'inside' }).jpeg({ quality: 60 }).toBuffer();
                        return 'data:image/jpeg;base64,' + thumb.toString('base64');
                    }));

                    await prisma.post.create({
                        data: {
                            accountId: job.account.id,
                            text: job.finalText,
                            mediaUrls: JSON.stringify(thumbnailsForDb),
                            publishAt: null, // ФИКС: null скрывает моментальный пост из календаря
                            status: 'PUBLISHED' 
                        }
                    });
                } catch (err) {
                    console.error(`Ошибка при отправке в ${job.account.name}:`, err.message);
                    hasErrors = true;
                    lastError = err.message;
                    
                    // В блоке ошибки (catch)
                    await prisma.post.create({
                        data: {
                            accountId: job.account.id,
                            text: job.finalText,
                            mediaUrls: "[]",
                            publishAt: null, // ФИКС: null скрывает моментальный пост из календаря
                            status: 'FAILED' 
                        }
                    });
                }
            }

            if (hasErrors) {
                return res.status(500).json({ success: false, error: `Не удалось отправить пост во все аккаунты. Последняя ошибка: ${lastError}` });
            }

            return res.status(200).json({ success: true, message: 'Успешно опубликовано' });
        }

    } catch (error) {
        console.error('[FATAL ERROR] Сбой createPost:', error);
        if (!res.headersSent) res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
};

// === ТАЙМЕР (CRON): АВТОМАТИЧЕСКАЯ ОТПРАВКА ОТЛОЖЕННЫХ ПОСТОВ ===
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
                    
                    const imageBuffers = mediaUrls.map(img => {
                        const base64Data = img.includes(',') ? img.split(',')[1] : img;
                        return Buffer.from(base64Data, 'base64');
                    });

                    const providerType = account.provider.toLowerCase();
                    if (providerType === 'telegram') {
                        const botToken = process.env.TELEGRAM_BOT_TOKEN.replace(/['"]/g, '').trim();
                        await sendToTelegram(botToken, account.providerId, post.text, imageBuffers);
                    } else if (providerType === 'vk') {
                        // 🟢 ИСПРАВЛЕНИЕ: Всегда отправляем через шлюз, функция sendToVK удалена.
                        // Передаем null в качестве времени, чтобы шлюз принял пост к публикации немедленно (так как время по Cron уже пришло).
                        await sendToKomodVK(account.accessToken, account.providerId, post.text, imageBuffers, null, account.userId);
                    }

                    // Сжимаем фото для сохранения в истории
                    const thumbnailsForDb = await Promise.all(imageBuffers.map(async (buf) => {
                        const thumb = await sharp(buf).resize({ width: 600, height: 600, fit: 'inside' }).jpeg({ quality: 60 }).toBuffer();
                        return 'data:image/jpeg;base64,' + thumb.toString('base64');
                    }));

                    await prisma.post.update({
                        where: { id: post.id },
                        data: { 
                            status: 'PUBLISHED', 
                            mediaUrls: JSON.stringify(thumbnailsForDb) 
                            // ВАЖНО: Мы НЕ обнуляем publishAt, чтобы пост остался в календаре как завершенный
                        } 
                    });
                    
                    console.log(`[CRON] ✅ Отложенный пост #${post.id} успешно отправлен!`);
                } catch (err) {
                    console.error(`[CRON ERROR] Ошибка отправки отложенного поста #${post.id}:`, err.message);
                    await prisma.post.update({ where: { id: post.id }, data: { status: 'FAILED' } });
                }
            }
        } catch (e) {}
    });
};


/// === ПОЛУЧИТЬ ТОЛЬКО ОТЛОЖЕННЫЕ ПОСТЫ ДЛЯ КАЛЕНДАРЯ ===
exports.getScheduledPosts = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Ошибка авторизации' });

        const posts = await prisma.post.findMany({
            where: { 
                account: { userId: userId }, 
                status: { in: ['SCHEDULED', 'PUBLISHED', 'FAILED'] },
                publishAt: { not: null } 
            },
            include: { account: { select: { name: true, provider: true, avatarUrl: true } } },
            orderBy: { publishAt: 'asc' },
            take: 150
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
        const { text, mediaUrls = [], partnerIds = [] } = req.body;
        const senderId = getUserId(req);

        if (!senderId) return res.status(401).json({ success: false, error: 'Ошибка авторизации' });
        if (!partnerIds || partnerIds.length === 0) return res.status(400).json({ success: false, error: 'Выберите партнера' });

        const sender = await prisma.user.findUnique({ where: { id: senderId } });
        const mediaString = JSON.stringify(mediaUrls);

        for (const receiverId of partnerIds) {
            await prisma.sharedPost.create({
                data: { senderId: sender.id, receiverId, text: text || '', mediaUrls: mediaString }
            });
            await prisma.notification.create({
                data: { 
                    userId: receiverId, 
                    type: 'INFO',
                    text: `Партнер ${sender?.name || 'Без имени'} поделился с вами новой публикацией. Вы можете опубликовать её у себя!`,
                    metadata: JSON.stringify({ text, mediaUrls })
                }
            });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: `Ошибка: ${error.message}` });
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

exports.deleteSharedPost = async (req, res) => {
    try {
        await prisma.sharedPost.delete({ where: { id: req.params.id } });
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


// === ПОЛУЧИТЬ ПОЛНУЮ ИСТОРИЮ ПОСТОВ ===
exports.getPostsHistory = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Ошибка авторизации' });

        const posts = await prisma.post.findMany({
            where: { 
                account: { userId: userId } 
            },
            include: { account: { select: { name: true, provider: true, avatarUrl: true } } },
            orderBy: [
                { createdAt: 'desc' }
            ],
            take: 100 
        });

        // 🟢 ИСПРАВЛЕНИЕ: Отдаем все фотографии без обрезки!
        res.json({ success: true, posts: posts });
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


// === ОТМЕТИТЬ ПОСТ КАК ОПУБЛИКОВАННЫЙ И УВЕДОМИТЬ АВТОРА ===
exports.markSharedPostPublished = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        const sharedPost = await prisma.sharedPost.findUnique({
            where: { id },
            include: { sender: true, receiver: true }
        });

        if (!sharedPost) return res.status(404).json({ success: false, error: 'Пост не найден' });
        
        // Обновляем статус поста
        await prisma.sharedPost.update({
            where: { id },
            data: { isPublished: true }
        });

        // Отправляем уведомление автору поста
        await prisma.notification.create({
            data: {
                userId: sharedPost.senderId,
                type: 'SUCCESS',
                text: `Партнер ${sharedPost.receiver.name || 'Без имени'} опубликовал ваш пост у себя!`,
                metadata: JSON.stringify({ text: sharedPost.text, mediaUrls: sharedPost.mediaUrls })
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка в markSharedPostPublished:', error);
        res.status(500).json({ success: false });
    }
};