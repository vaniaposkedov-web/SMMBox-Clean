const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp'); 
const cron = require('node-cron'); 
const jwt = require('jsonwebtoken');

// === ЛОГИКА ОТПРАВКИ В TELEGRAM ===
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
async function sendToKomodVK(token, providerId, text, imageBuffers, publishAtDate = null) {
    const KOMOD_BASE_URL = 'https://kom-od.ru/api/v1';
    const form = new FormData();

    let targetGroupId = null;
    const cleanId = providerId.replace('wall_', '').replace('group_', '');
    const isWall = providerId.startsWith('wall_');

    // 1. Получаем список групп из шлюза
    const grpRes = await axios.get(`${KOMOD_BASE_URL}/group`, { headers: { 'Access-Token': token } });
    const groups = grpRes.data?.data?.items || grpRes.data?.data || [];

    let targetGroup = groups.find(g => 
        String(g.uid) === cleanId || 
        String(g.id) === cleanId || 
        String(g.account_id) === cleanId ||
        (g.url && String(g.url).includes(cleanId))
    );

    // 2. АВТО-РЕГИСТРАЦИЯ: Если группы/профиля нет, добавляем через API Kom-od
    if (!targetGroup) {
        console.log(`\n[KOMOD] Цель ${providerId} не найдена в шлюзе. Пробуем авто-регистрацию...`);
        
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
                // Перезапрашиваем список, чтобы получить внутренний ID новой группы
                const newGrpRes = await axios.get(`${KOMOD_BASE_URL}/group`, { headers: { 'Access-Token': token } });
                const newGroups = newGrpRes.data?.data?.items || newGrpRes.data?.data || [];
                targetGroup = newGroups.find(g => String(g.uid) === cleanId || String(g.account_id) === cleanId);
                
                if (targetGroup) {
                    console.log(`[KOMOD] ✅ Авто-регистрация успешна! ID в шлюзе: ${targetGroup.id}`);
                } else {
                    throw new Error('Авто-регистрация прошла, но группа не найдена в списке.');
                }
            } else {
                console.error('[KOMOD ADD ERROR]', addRes.data);
                throw new Error('Шлюз отклонил авто-регистрацию.');
            }
        } catch (addError) {
            console.error('[KOMOD AUTO-ADD ERROR]', addError.message);
            throw new Error(`Стена еще не активирована! Зайдите на kom-od.ru и нажмите "Подключить стену".`);
        }
    }

    targetGroupId = targetGroup.id;

    let targetDate = publishAtDate ? new Date(publishAtDate) : new Date();

    if (!publishAtDate) {
        targetDate.setMinutes(targetDate.getMinutes() + 1);
    }

    // === ИСПРАВЛЕНИЕ: СТАВИМ ЧАСОВОЙ ПОЯС ТВОЕГО ШЛЮЗА (+05:00) ===
    const komodTimezone = 'Asia/Yekaterinburg'; 
    const tzString = targetDate.toLocaleString('sv-SE', { timeZone: komodTimezone });
    const formattedDate = tzString.substring(0, 16);

    form.append('group_id', targetGroupId);
    form.append('publish_at', formattedDate); 
    form.append('via_api', '1');
    
    const media = [];
    if (text) {
        media.push({ type: 'text', text: text });
    }

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

    console.log(`\n=== [KOMOD POST START] Отправка поста в targetGroupId: ${targetGroupId} ===`);
    
    const postRes = await axios.post(`${KOMOD_BASE_URL}/post`, form, {
        headers: { 
            ...form.getHeaders(), 
            'Access-Token': token 
        },
        maxBodyLength: Infinity,
        validateStatus: status => status < 500
    });

    if (postRes.data && postRes.data.success === false) {
        throw new Error('Ошибка шлюза при публикации: ' + JSON.stringify(postRes.data.errors));
    }

    const postId = postRes.data?.data?.id;
    if (postId) {
        const checkStatus = async (delay, attempt) => {
            setTimeout(async () => {
                try {
                    const checkRes = await axios.get(`${KOMOD_BASE_URL}/post/${postId}?logs=1`, {
                        headers: { 'Access-Token': token },
                        validateStatus: () => true
                    });
                    
                    const postData = checkRes.data?.data;
                    if (postData) {
                        console.log(`\n⏳ [Проверка #${attempt}] СТАТУС ПОСТА ${postId}`);
                        console.log(`> Опубликован: ${postData.published === '1' ? 'ДА ✅' : 'В ОЧЕРЕДИ ⏳'}`);
                        if (postData.logs && postData.logs.length > 0) {
                            postData.logs.forEach(l => console.log(`> ЛОГ: ${l.message}`));
                        }
                    }
                } catch (e) {}
            }, delay);
        };

        checkStatus(15000, 1);
        checkStatus(30000, 2);
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

        // Базовый размер водяного знака (25% от ширины фото) умноженный на пользовательский масштаб
        const scaleFactor = (wmConfig.size || 100) / 100;
        const wmBaseWidth = Math.floor(width * 0.25 * scaleFactor);
        const padding = Math.floor(width * 0.03); // 3% отступ от краев
        const opacity = (wmConfig.opacity !== undefined ? wmConfig.opacity : 90) / 100;

        let overlayBuffer;
        let overlayMeta;

        // Генерируем водяной знак
        if (wmConfig.type === 'text') {
            const text = wmConfig.text || 'SMMBOX';
            const fontSize = Math.floor(wmBaseWidth / (text.length * 0.6));
            const textColor = wmConfig.textColor || '#ffffff';
            const bgColor = wmConfig.bgColor || '#000000';
            const hasBg = wmConfig.hasBackground !== false;

            // Для текста генерируем SVG на лету
            const svg = `
                <svg width="${wmBaseWidth + padding*2}" height="${fontSize + padding*2}">
                    <style>
                        .bg { fill: ${bgColor}; opacity: ${hasBg ? opacity * 0.6 : 0}; }
                        .text { fill: ${textColor}; font-size: ${fontSize}px; font-family: sans-serif; font-weight: bold; opacity: ${opacity}; }
                    </style>
                    <rect width="100%" height="100%" rx="${padding}" class="bg" />
                    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" class="text">${text}</text>
                </svg>
            `;
            overlayBuffer = Buffer.from(svg);
        } else if (wmConfig.type === 'image' && wmConfig.image) {
            const base64Data = wmConfig.image.includes(',') ? wmConfig.image.split(',')[1] : wmConfig.image;
            const imgBuf = Buffer.from(base64Data, 'base64');
            overlayBuffer = await sharp(imgBuf)
                .resize({ width: wmBaseWidth })
                .ensureAlpha(opacity)
                .toBuffer();
        } else {
            return imageBuffer;
        }

        overlayMeta = await sharp(overlayBuffer).metadata();

        // Расчет координат позиции
        let left = padding;
        let top = padding;

        if (wmConfig.position === 'custom' && wmConfig.x !== undefined && wmConfig.y !== undefined) {
            left = Math.floor((width * wmConfig.x) / 100) - Math.floor(overlayMeta.width / 2);
            top = Math.floor((height * wmConfig.y) / 100) - Math.floor(overlayMeta.height / 2);
        } else {
            const pos = wmConfig.position || 'br';
            if (pos.includes('r')) left = width - overlayMeta.width - padding;
            if (pos.includes('c')) left = Math.floor((width - overlayMeta.width) / 2);
            if (pos.includes('b')) top = height - overlayMeta.height - padding;
            if (pos.includes('c') && pos.length === 2 && pos[1] === 'c') top = Math.floor((height - overlayMeta.height) / 2);
        }

        // Защита от вылета за границы кадра
        left = Math.max(0, Math.min(left, width - overlayMeta.width));
        top = Math.max(0, Math.min(top, height - overlayMeta.height));

        // Наложение слоев
        return await sharp(imageBuffer)
            .composite([{ input: overlayBuffer, top, left }])
            .toBuffer();
            
    } catch (err) {
        console.error('[WATERMARK ERROR]:', err);
        return imageBuffer; // Если ошибка, публикуем оригинал, чтобы пост не пропал
    }
}

// Полный исправленный метод создания поста
exports.createPost = async (req, res) => {
    try {
        const { text, mediaUrls = [], accounts = [], publishAt } = req.body;
        
        let parsedPublishAt = null;
        let isScheduled = false;

        // Валидация даты планирования
        if (publishAt && publishAt !== 'null' && publishAt !== 'undefined' && publishAt !== '') {
            const tempDate = new Date(publishAt);
            if (!isNaN(tempDate.getTime())) {
                parsedPublishAt = tempDate;
                isScheduled = true;
            }
        }
        
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
        // Формирование очереди заданий (подписи, водяные знаки)
        for (const accData of accounts) {
            const account = await prisma.account.findUnique({ 
                where: { id: accData.accountId },
                // ВАЖНО: Подтягиваем настройки знака из БД
                include: { watermark: true } 
            });
            if (!account) continue;

            let finalText = text || '';
            const sigText = accData.signatureText !== undefined ? accData.signatureText : (accData.signature !== undefined ? accData.signature : account.signature);
            const applySig = accData.applySignature !== undefined ? accData.applySignature : !!sigText;

            if (applySig && sigText) {
                finalText += `\n\n${sigText}`;
            }

            let processedBuffers = optimizedBaseBuffers;
            
            // Логика водяного знака
            let wmConfig = accData.watermarkConfig !== undefined ? accData.watermarkConfig : (accData.watermark !== undefined ? accData.watermark : account.watermark);
            
            if (typeof wmConfig === 'string' && (wmConfig === 'null' || wmConfig === '{}' || wmConfig.trim() === '')) {
                wmConfig = null;
            }

            let applyWm = accData.applyWatermark !== undefined ? String(accData.applyWatermark) === 'true' : !!wmConfig;

            // === ЗДЕСЬ ПРИМЕНЯЕТСЯ ВОДЯНОЙ ЗНАК ===
            if (applyWm && wmConfig && processedBuffers.length > 0) {
                processedBuffers = await Promise.all(
                    processedBuffers.map(buf => applyWatermark(buf, wmConfig))
                );
            }

            accountJobs.push({ account, finalText, processedBuffers });
        }

        // ВЕТКА А: Отложенный пост
        if (isScheduled) {
            for (const job of accountJobs) {
                const finalImagesToSave = job.processedBuffers.map(buf => 'data:image/jpeg;base64,' + buf.toString('base64'));
                await prisma.post.create({
                    data: {
                        accountId: job.account.id,
                        text: job.finalText,
                        mediaUrls: JSON.stringify(finalImagesToSave),
                        publishAt: parsedPublishAt,
                        status: 'SCHEDULED' 
                    }
                });
            }
            return res.status(200).json({ success: true, message: 'Запланировано' });
        } 
        
        // ВЕТКА Б: Мгновенная публикация (ОБНОВЛЕНО: Ждем реального ответа!)
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
                        // Постинг через шлюз (включая личные страницы)
                        await sendToKomodVK(job.account.accessToken, job.account.providerId, job.finalText, job.processedBuffers, null);
                    }

                    // Сохраняем историю (сжимаем для БД)
                    const thumbnailsForDb = await Promise.all(job.processedBuffers.map(async (buf) => {
                        const thumb = await sharp(buf).resize({ width: 600, height: 600, fit: 'inside' }).jpeg({ quality: 60 }).toBuffer();
                        return 'data:image/jpeg;base64,' + thumb.toString('base64');
                    }));

                    await prisma.post.create({
                        data: {
                            accountId: job.account.id,
                            text: job.finalText,
                            mediaUrls: JSON.stringify(thumbnailsForDb),
                            status: 'PUBLISHED' 
                        }
                    });
                } catch (err) {
                    console.error(`Ошибка при отправке в ${job.account.name}:`, err.message);
                    hasErrors = true;
                    lastError = err.message;
                    
                    // Фиксируем ошибку в базе
                    await prisma.post.create({
                        data: {
                            accountId: job.account.id,
                            text: job.finalText,
                            mediaUrls: "[]",
                            status: 'FAILED' 
                        }
                    });
                }
            }

            // Если были ошибки - возвращаем 500, чтобы фронтенд показал Alert
            if (hasErrors) {
                return res.status(500).json({ 
                    success: false, 
                    error: `Не удалось отправить пост во все аккаунты. Последняя ошибка: ${lastError}` 
                });
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

            // Добавил логирование, чтобы ты в консоли видел, когда срабатывает отложенный пост
            if (postsToPublish.length > 0) {
                console.log(`\n[CRON] ⏰ Найдено отложенных постов для отправки: ${postsToPublish.length}`);
            }

            for (const post of postsToPublish) {
                try {
                    const account = post.account;
                    const mediaUrls = JSON.parse(post.mediaUrls || '[]');
                    
                    // Берем уже ИДЕАЛЬНО ГОТОВЫЕ фото с водяным знаком прямо из базы
                    const imageBuffers = mediaUrls.map(img => {
                        const base64Data = img.includes(',') ? img.split(',')[1] : img;
                        return Buffer.from(base64Data, 'base64');
                    });

                    const providerType = account.provider.toLowerCase();
                    if (providerType === 'telegram') {
                        const botToken = process.env.TELEGRAM_BOT_TOKEN.replace(/['"]/g, '').trim();
                        await sendToTelegram(botToken, account.providerId, post.text, imageBuffers);
                    } else if (providerType === 'vk') {
                        const isKomod = account.providerId.startsWith('wall_') || account.providerId.startsWith('group_');
                        if (isKomod) {
                            // === ИСПРАВЛЕНИЕ: Передаем null вместо post.publishAt ===
                            // Раз время сработало, значит пост нужно выпустить немедленно.
                            // null заставит шлюз добавить +1 минуту и принять пост без ошибки "времени в прошлом"
                            await sendToKomodVK(account.accessToken, account.providerId, post.text, imageBuffers, null);
                        } else {
                            await sendToVK(account.accessToken, account.providerId, post.text, imageBuffers);
                        }
                    }

                    // ПОСЛЕ успешной публикации, сжимаем эти фото до миниатюр (чтобы БД не распухла)
                    const thumbnailsForDb = await Promise.all(imageBuffers.map(async (buf) => {
                        const thumb = await sharp(buf).resize({ width: 600, height: 600, fit: 'inside' }).jpeg({ quality: 60 }).toBuffer();
                        return 'data:image/jpeg;base64,' + thumb.toString('base64');
                    }));

                    await prisma.post.update({
                        where: { id: post.id },
                        data: { status: 'PUBLISHED', mediaUrls: JSON.stringify(thumbnailsForDb) } 
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
// === ПОЛУЧИТЬ ОТЛОЖЕННЫЕ И ОПУБЛИКОВАННЫЕ ПОСТЫ ДЛЯ КАЛЕНДАРЯ ===
exports.getScheduledPosts = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Ошибка авторизации' });

        const posts = await prisma.post.findMany({
            where: { 
                account: { userId: userId }, 
                status: { in: ['SCHEDULED', 'PUBLISHED'] } 
            },
            include: { account: { select: { name: true, provider: true } } },
            orderBy: { publishAt: 'asc' },
            take: 150
        });

        const lightweightPosts = posts.map(p => {
            let firstImage = [];
            try {
                const parsed = JSON.parse(p.mediaUrls || '[]');
                if (parsed.length > 0) firstImage = [parsed[0]];
            } catch(e) {}
            
            return { ...p, mediaUrls: JSON.stringify(firstImage) };
        });

        res.json({ success: true, posts: lightweightPosts });
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