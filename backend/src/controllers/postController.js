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
        
        form.append('photo', imageBuffers[0], { filename: 'image.jpg', contentType: 'image/jpeg' });
        
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
            form.append(`photo${i}`, buf, { filename: `photo${i}.jpg`, contentType: 'image/jpeg' });
        });
        
        await axios.post(`${baseUrl}/sendMediaGroup`, form, { headers: form.getHeaders() });
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

// === ЛОГИКА ОТПРАВКИ В ВКОНТАКТЕ (ПАКЕТНАЯ ЗАГРУЗКА) ===
async function sendToVK(token, groupId, text, imageBuffers) {
    const v = '5.131';
    const cleanGroupId = Math.abs(parseInt(groupId)); 
    let attachments = [];

    if (imageBuffers.length > 0) {
        const serverRes = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, {
            params: { group_id: cleanGroupId, access_token: token, v }
        });
        const uploadUrl = serverRes.data.response.upload_url;

        const chunks = [];
        for (let i = 0; i < imageBuffers.length; i += 5) {
            chunks.push(imageBuffers.slice(i, i + 5));
        }

        for (const chunk of chunks) {
            const form = new FormData();
            chunk.forEach((buf, index) => {
                form.append(`file${index + 1}`, buf, { filename: `image${index + 1}.jpg`, contentType: 'image/jpeg' });
            });
            
            const uploadRes = await axios.post(uploadUrl, form, { headers: form.getHeaders() });

            const saveRes = await axios.get(`https://api.vk.com/method/photos.saveWallPhoto`, {
                params: {
                    group_id: cleanGroupId,
                    photo: uploadRes.data.photo,
                    server: uploadRes.data.server,
                    hash: uploadRes.data.hash,
                    access_token: token,
                    v
                }
            });

            if (saveRes.data.response) {
                saveRes.data.response.forEach(savedPhoto => {
                    attachments.push(`photo${savedPhoto.owner_id}_${savedPhoto.id}`);
                });
            }
        }
    }

    const postParams = new URLSearchParams({
        owner_id: `-${cleanGroupId}`, 
        from_group: 1,
        message: text || '',
        access_token: token,
        v
    });

    if (attachments.length > 0) {
        postParams.append('attachments', attachments.join(','));
    }

    const postRes = await axios.post(`https://api.vk.com/method/wall.post`, postParams);
    if (postRes.data.error) throw new Error(postRes.data.error.error_msg);
}

// === ОСНОВНОЙ КОНТРОЛЛЕР ПУБЛИКАЦИИ (ФОНОВАЯ АСИНХРОННОСТЬ) ===
exports.createPost = async (req, res) => {
    try {
        const { text, mediaUrls = [], accounts = [], publishAt } = req.body;
        
        if (!accounts || accounts.length === 0) {
            return res.status(400).json({ success: false, error: 'Нет аккаунтов для отправки' });
        }

        // 1. МГНОВЕННЫЙ ОТВЕТ ФРОНТЕНДУ (Решает проблему тайм-аута Nginx на 100%)
        res.json({ success: true, message: 'Публикация запущена в фоновом режиме' });

        // 2. ФОНОВЫЙ ПРОЦЕСС (Никак не задерживает браузер пользователя)
        (async () => {
            try {
                // Читаем загруженные буферы
                const rawImageBuffers = mediaUrls.map(img => {
                    const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
                    return Buffer.from(base64Data, 'base64');
                });

                // Сжимаем исходники
                const optimizedBaseBuffers = await Promise.all(rawImageBuffers.map(async (buf) => {
                    return await sharp(buf).resize({ width: 2500, height: 2500, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
                }));

                // Легкие превью для базы данных (чтобы история загружалась быстро)
                const thumbnailsForDb = await Promise.all(optimizedBaseBuffers.map(async (buf) => {
                    const thumb = await sharp(buf).resize({ width: 600, height: 600, fit: 'inside' }).jpeg({ quality: 60 }).toBuffer();
                    return 'data:image/jpeg;base64,' + thumb.toString('base64');
                }));

                const isScheduled = publishAt ? true : false;

                // Отправляем во все аккаунты параллельно!
                await Promise.all(accounts.map(async (accData) => {
                    try {
                        const account = await prisma.account.findUnique({ where: { id: accData.accountId } });
                        if (!account) return;

                        let finalText = text || '';
                        if (accData.applySignature && accData.signatureText) {
                            finalText += `\n\n${accData.signatureText}`;
                        }

                        let processedBuffers = optimizedBaseBuffers;
                        
                        // Логика наложения водяного знака
                        if (accData.applyWatermark && accData.watermarkConfig && processedBuffers.length > 0) {
                            let wm = accData.watermarkConfig;
                            if (typeof wm === 'string') { try { wm = JSON.parse(wm); } catch(e) {} }
                            if (typeof wm === 'string') { try { wm = JSON.parse(wm); } catch(e) {} } 
                            if (!wm || typeof wm !== 'object') wm = {};
                            
                            const wmType = wm.type || 'text'; 
                            let wmText = wm.text || 'SMMBOX';
                            if (!wmText.trim()) wmText = 'SMMBOX';

                            const opacity = wm.opacity !== undefined ? Number(wm.opacity) / 100 : 0.9;
                            const angle = Number(wm.angle) || 0;
                            
                            processedBuffers = await Promise.all(processedBuffers.map(async (buf) => {
                                try {
                                    const image = sharp(buf);
                                    const metadata = await image.metadata();
                                    const width = metadata.width || 1000;
                                    const height = metadata.height || 1000;
                                    
                                    let watermarkBuffer;
                                    let wmPixelWidth = 0;
                                    let wmPixelHeight = 0;

                                    if (wmType === 'text') {
                                        const scaleFactor = (Number(wm.size) || 100) / 100;
                                        const fontSize = Math.max(16, Math.floor(width * 0.04 * scaleFactor));
                                        const paddingX = Math.max(4, Math.floor(fontSize * 1.5)); 
                                        const paddingY = Math.max(4, Math.floor(fontSize * 1)); 
                                        
                                        const lines = String(wmText).split('\n');
                                        let maxTextWidthRaw = 0;
                                        for (const line of lines) {
                                            let currentLineWidth = 0;
                                            for (let i = 0; i < line.length; i++) {
                                                if (line.charCodeAt(i) > 1000) currentLineWidth += fontSize * 0.95; 
                                                else currentLineWidth += fontSize * 0.65; 
                                            }
                                            if (currentLineWidth > maxTextWidthRaw) maxTextWidthRaw = currentLineWidth;
                                        }
                                        
                                        wmPixelWidth = Math.max(20, Math.floor(maxTextWidthRaw) + (paddingX * 2));
                                        const lineHeight = Math.max(20, Math.floor(fontSize * 1.25));
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
                                        const scaleFactor = (Number(wm.size) || 100) / 100;
                                        const targetWidth = Math.max(50, Math.floor(width * 0.15 * scaleFactor));

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

                                    let targetX = 90;
                                    let targetY = 85;

                                    if (wm.x !== undefined && wm.x !== null && !isNaN(Number(wm.x))) {
                                        targetX = Number(wm.x);
                                    } else if (wm.position) {
                                        const posToCoords = {
                                            'tl': {x: 10, y: 15}, 'tc': {x: 50, y: 15}, 'tr': {x: 90, y: 15},
                                            'cl': {x: 10, y: 50}, 'cc': {x: 50, y: 50}, 'cr': {x: 90, y: 50},
                                            'bl': {x: 10, y: 85}, 'bc': {x: 50, y: 85}, 'br': {x: 90, y: 85}
                                        };
                                        if (posToCoords[wm.position]) {
                                            targetX = posToCoords[wm.position].x;
                                            targetY = posToCoords[wm.position].y;
                                        }
                                    }
                                    
                                    if (wm.y !== undefined && wm.y !== null && !isNaN(Number(wm.y))) {
                                        targetY = Number(wm.y);
                                    }

                                    targetX = Math.max(0, Math.min(100, targetX));
                                    targetY = Math.max(0, Math.min(100, targetY));

                                    const centerX = Math.floor(width * (targetX / 100));
                                    const centerY = Math.floor(height * (targetY / 100));
                                    
                                    let leftPos = Math.floor(centerX - (wmPixelWidth / 2));
                                    let topPos = Math.floor(centerY - (wmPixelHeight / 2));

                                    if (leftPos + wmPixelWidth > width) leftPos = width - wmPixelWidth;
                                    if (topPos + wmPixelHeight > height) topPos = height - wmPixelHeight;
                                    if (leftPos < 0) leftPos = 0;
                                    if (topPos < 0) topPos = 0;

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

                        if (isScheduled) {
                            await prisma.post.create({
                                data: {
                                    accountId: account.id,
                                    text: finalText,
                                    mediaUrls: JSON.stringify(thumbnailsForDb),
                                    publishAt: new Date(publishAt),
                                    status: 'SCHEDULED' 
                                }
                            });
                        } else {
                            try {
                                const providerType = account.provider.toLowerCase(); 
                                if (providerType === 'telegram') {
                                    const botToken = process.env.TELEGRAM_BOT_TOKEN.replace(/['"]/g, '').trim();
                                    await sendToTelegram(botToken, account.providerId, finalText, processedBuffers);
                                } else if (providerType === 'vk') {
                                    await sendToVK(account.accessToken, account.providerId, finalText, processedBuffers);
                                }
                                
                                await prisma.post.create({
                                    data: { 
                                        accountId: account.id, 
                                        text: finalText, 
                                        mediaUrls: JSON.stringify(thumbnailsForDb), 
                                        status: 'PUBLISHED' 
                                    }
                                });
                            } catch (err) {
                                console.error(`[ОШИБКА ОТПРАВКИ] ${account.name}:`, err.message);
                                await prisma.post.create({
                                    data: { 
                                        accountId: account.id, 
                                        text: finalText, 
                                        mediaUrls: JSON.stringify(thumbnailsForDb), 
                                        status: 'FAILED' 
                                    }
                                });
                            }
                        }
                    } catch (accountErr) {
                        console.error(`Ошибка обработки аккаунта:`, accountErr);
                    }
                }));
            } catch (backgroundError) {
                console.error('[КРИТИЧЕСКАЯ ФОНОВАЯ ОШИБКА]:', backgroundError);
            }
        })(); // Вызов фоновой функции (без await)

    } catch (error) {
        console.error('Сбой при запуске createPost:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
        }
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
                        const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
                        return Buffer.from(base64Data, 'base64');
                    });

                    const providerType = account.provider.toLowerCase();
                    if (providerType === 'telegram') {
                        const botToken = process.env.TELEGRAM_BOT_TOKEN.replace(/['"]/g, '').trim();
                        await sendToTelegram(botToken, account.providerId, post.text, imageBuffers);
                    } else if (providerType === 'vk') {
                        await sendToVK(account.accessToken, account.providerId, post.text, imageBuffers);
                    }

                    await prisma.post.update({
                        where: { id: post.id },
                        data: { status: 'PUBLISHED' } 
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
        res.json({ success: true, posts });
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

// === ОСТАЛЬНЫЕ ФУНКЦИИ ПАРТНЕРОВ И УДАЛЕНИЯ ===
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
                data: { userId: receiverId, text: `Партнер ${sender?.name || 'Без имени'} поделился с вами публикацией.` }
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