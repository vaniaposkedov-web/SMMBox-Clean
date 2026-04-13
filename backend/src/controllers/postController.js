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

    const komodTimezone = 'Europe/Moscow'; 
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

// === ОСНОВНОЙ КОНТРОЛЛЕР ПУБЛИКАЦИИ ===
exports.createPost = async (req, res) => {
    try {
        const { text, mediaUrls = [], accounts = [], publishAt } = req.body;
        
        let parsedPublishAt = null;
        let isScheduled = false;

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

        const rawImageBuffers = mediaUrls.map(img => {
            const base64Data = img.includes(',') ? img.split(',')[1] : img;
            return Buffer.from(base64Data, 'base64');
        });

        const optimizedBaseBuffers = await Promise.all(rawImageBuffers.map(async (buf) => {
            return await sharp(buf).resize({ width: 2500, height: 2500, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
        }));

        const accountJobs = [];

        for (const accData of accounts) {
            const account = await prisma.account.findUnique({ where: { id: accData.accountId } });
            if (!account) continue;

            let finalText = text || '';
            const sigText = accData.signatureText !== undefined ? accData.signatureText : (accData.signature !== undefined ? accData.signature : account.signature);
            const applySig = accData.applySignature !== undefined ? accData.applySignature : !!sigText;

            if (applySig && sigText) {
                finalText += `\n\n${sigText}`;
            }

            let processedBuffers = optimizedBaseBuffers;
            
            // === ИСПРАВЛЕНИЕ: ЖЕЛЕЗОБЕТОННЫЙ ПОДХВАТ ВОДЯНОГО ЗНАКА ===
            let wmConfig = accData.watermarkConfig;
            if (!wmConfig && account.watermark) {
                wmConfig = account.watermark; // Берем дефолтный, если нет специфичного для поста
            }
            
            // Если фронт явно передал false, отключаем. Иначе - включаем при наличии конфига.
            const applyWm = accData.applyWatermark !== undefined ? accData.applyWatermark : !!wmConfig;

            if (applyWm && wmConfig && processedBuffers.length > 0) {
                console.log(`\n[WATERMARK] 🎨 Начинаем наложение водяного знака для аккаунта: ${account.name} (Фото: ${processedBuffers.length} шт.)`);
                
                let wm = wmConfig;
                if (typeof wm === 'string') { try { wm = JSON.parse(wm); } catch(e) {} }
                if (!wm || typeof wm !== 'object') wm = {};
                
                const wmType = wm.type || 'text'; 
                let wmText = wm.text || 'SMMBOX';
                if (!wmText || !String(wmText).trim()) wmText = 'SMMBOX';

                const opacity = wm.opacity !== undefined ? Number(wm.opacity) / 100 : 0.9;
                const angle = Number(wm.angle) || 0;
                
                processedBuffers = await Promise.all(processedBuffers.map(async (buf) => {
                    try {
                        const image = sharp(buf);
                        const metadata = await image.metadata();
                        const width = metadata.width || 1000;
                        const height = metadata.height || 1000;
                        
                        const baseSize = Math.min(width, height);
                        
                        let watermarkBuffer;
                        let wmPixelWidth = 0;
                        let wmPixelHeight = 0;

                        if (wmType === 'text') {
                            const fontSize = Math.max(16, Math.floor(baseSize * (Number(wm.size) || 20) / 400));
                            const paddingX = Math.max(4, Math.floor(fontSize * 0.8)); 
                            const paddingY = Math.max(4, Math.floor(fontSize * 0.6)); 
                            
                            const lines = String(wmText).split('\n');
                            let maxTextWidthRaw = 0;
                            for (const line of lines) {
                                let currentLineWidth = 0;
                                for (let i = 0; i < line.length; i++) {
                                    currentLineWidth += (line.charCodeAt(i) > 1000) ? fontSize * 0.95 : fontSize * 0.65; 
                                }
                                if (currentLineWidth > maxTextWidthRaw) maxTextWidthRaw = currentLineWidth;
                            }
                            
                            wmPixelWidth = Math.max(20, Math.floor(maxTextWidthRaw) + (paddingX * 2));
                            const lineHeight = Math.floor(fontSize * 1.25);
                            wmPixelHeight = Math.max(20, (lines.length * lineHeight) + (paddingY * 2));
                            
                            const bgColor = wm.bgColor || '#000000';
                            const textColor = wm.textColor || '#ffffff';
                            const hasBg = wm.hasBackground !== false;
                            const borderRadius = Math.floor(fontSize * 0.35); 

                            const centerY = wmPixelHeight / 2;
                            const totalTextHeight = (lines.length - 1) * lineHeight;
                            const startY = centerY - (totalTextHeight / 2);

                            const escapeXml = (unsafe) => unsafe.replace(/[<>&'"]/g, (c) => {
                                switch (c) {
                                    case '<': return '&lt;'; case '>': return '&gt;';
                                    case '&': return '&amp;'; case '\'': return '&apos;';
                                    case '"': return '&quot;'; default: return c;
                                }
                            });

                            const tspans = lines.map((line, index) => {
                                const yPos = startY + (index * lineHeight);
                                return `<tspan x="50%" y="${yPos}" text-anchor="middle" dominant-baseline="central">${escapeXml(line)}</tspan>`;
                            }).join('');

                            const svgText = `
                            <svg width="${wmPixelWidth}" height="${wmPixelHeight}" xmlns="http://www.w3.org/2000/svg">
                                <g opacity="${opacity}">
                                    ${hasBg ? `<rect width="100%" height="100%" fill="${bgColor}" rx="${borderRadius}" />` : ''}
                                    <text font-size="${fontSize}px" font-family="Arial, sans-serif" font-weight="bold" fill="${textColor}">
                                        ${tspans}
                                    </text>
                                </g>
                            </svg>`;
                            watermarkBuffer = Buffer.from(svgText);
                        } else if (wmType === 'image' && typeof wm.image === 'string' && wm.image.length > 100) {
                            const imgBase64 = wm.image.includes(',') ? wm.image.split(',')[1] : wm.image;
                            const targetWidth = Math.max(50, Math.floor(baseSize * (Number(wm.size) || 20) / 100));

                            watermarkBuffer = await sharp(Buffer.from(imgBase64, 'base64'))
                                .resize({ width: targetWidth })
                                .ensureAlpha()
                                .composite([{
                                    input: Buffer.from([255, 255, 255, Math.floor(opacity * 255)]),
                                    raw: { width: 1, height: 1, channels: 4 },
                                    tile: true, blend: 'dest-in'
                                }])
                                .toBuffer();
                        }

                        if (!watermarkBuffer) return buf;

                        if (angle !== 0) {
                            watermarkBuffer = await sharp(watermarkBuffer)
                                .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
                                .toBuffer();
                        }

                        const tempMeta = await sharp(watermarkBuffer).metadata();
                        if (tempMeta.width > width || tempMeta.height > height) {
                            watermarkBuffer = await sharp(watermarkBuffer)
                                .resize({ width: Math.max(10, width - 20), height: Math.max(10, height - 20), fit: 'inside' })
                                .toBuffer();
                        }

                        const wmMeta = await sharp(watermarkBuffer).metadata();
                        wmPixelWidth = wmMeta.width;
                        wmPixelHeight = wmMeta.height;

                        const marginPx = Math.floor(baseSize * ((Number(wm.margin) || 5) / 100));
                        let leftPos = 0;
                        let topPos = 0;
                        const pos = wm.position || 'br';

                        if (pos.includes('l')) leftPos = marginPx;
                        else if (pos.includes('r')) leftPos = width - wmPixelWidth - marginPx;
                        else leftPos = Math.floor((width - wmPixelWidth) / 2);

                        if (pos.includes('t')) topPos = marginPx;
                        else if (pos.includes('b')) topPos = height - wmPixelHeight - marginPx;
                        else topPos = Math.floor((height - wmPixelHeight) / 2);

                        leftPos = Math.max(0, Math.min(leftPos, width - wmPixelWidth));
                        topPos = Math.max(0, Math.min(topPos, height - wmPixelHeight));

                        return await image
                            .composite([{ input: watermarkBuffer, top: Math.round(topPos), left: Math.round(leftPos) }])
                            .jpeg({ quality: 90 }) 
                            .toBuffer();
                    } catch (e) {
                        console.error(`[WATERMARK ERROR] Account ${account.name}:`, e.message);
                        return buf; 
                    }
                }));
            }

            accountJobs.push({
                account,
                finalText,
                processedBuffers
            });
        }

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
        } else {
            for (const job of accountJobs) {
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
            }

            res.status(200).json({ success: true, message: 'Отправка запущена' });

            setTimeout(async () => {
                for (const job of accountJobs) {
                    try {
                        const providerType = job.account.provider.toLowerCase(); 
                        if (providerType === 'telegram') {
                            const botToken = process.env.TELEGRAM_BOT_TOKEN.replace(/['"]/g, '').trim();
                            await sendToTelegram(botToken, job.account.providerId, job.finalText, job.processedBuffers);
                        } else if (providerType === 'vk') {
                            await sendToKomodVK(job.account.accessToken, job.account.providerId, job.finalText, job.processedBuffers, null);
                        }
                    } catch (err) {
                        console.error(`[BACKGROUND ERROR] ${job.account.name}:`, err.message);
                        await prisma.post.updateMany({
                            where: { accountId: job.account.id, status: 'PUBLISHED' },
                            data: { status: 'FAILED' }
                        });
                    }
                }
            }, 100);
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
                        await sendToKomodVK(account.accessToken, account.providerId, post.text, imageBuffers, post.publishAt);
                    }

                    const thumbnailsForDb = await Promise.all(imageBuffers.map(async (buf) => {
                        const thumb = await sharp(buf).resize({ width: 600, height: 600, fit: 'inside' }).jpeg({ quality: 60 }).toBuffer();
                        return 'data:image/jpeg;base64,' + thumb.toString('base64');
                    }));

                    await prisma.post.update({
                        where: { id: post.id },
                        data: { status: 'PUBLISHED', mediaUrls: JSON.stringify(thumbnailsForDb) } 
                    });
                } catch (err) {
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