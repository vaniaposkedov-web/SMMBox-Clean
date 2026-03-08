const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp'); 
const cron = require('node-cron'); // Подключаем таймер
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
        form.append('photo', imageBuffers[0], 'image.jpg');
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
            form.append(`photo${i}`, buf, `photo${i}.jpg`);
        });
        
        await axios.post(`${baseUrl}/sendMediaGroup`, form, { headers: form.getHeaders() });
    }
}

// === ЗАЩИТА АВТОРИЗАЦИИ (Гарантированно достает ID пользователя) ===
const getUserId = (req) => {
    // 1. Стандартный способ
    if (req.user && typeof req.user === 'object') return req.user.id || req.user.userId;
    if (req.userId) return req.userId;
    if (typeof req.user === 'string') return req.user;

    // 2. Бронебойный способ: достаем ID прямо из заголовка, если система его потеряла
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.decode(token); // Читаем начинку токена
            if (decoded) return decoded.id || decoded.userId;
        }
    } catch (e) {
        console.error("Ошибка при ручной расшифровке токена:", e);
    }
    return null;
};

// === ЛОГИКА ОТПРАВКИ В ВКОНТАКТЕ ===
async function sendToVK(token, groupId, text, imageBuffers) {
    const v = '5.131';
    const cleanGroupId = Math.abs(parseInt(groupId)); 
    let attachments = [];

    if (imageBuffers.length > 0) {
        const serverRes = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, {
            params: { group_id: cleanGroupId, access_token: token, v }
        });
        const uploadUrl = serverRes.data.response.upload_url;

        for (let i = 0; i < imageBuffers.length; i++) {
            const form = new FormData();
            form.append('file1', imageBuffers[i], `image${i}.jpg`);
            
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

            const savedPhoto = saveRes.data.response[0];
            attachments.push(`photo${savedPhoto.owner_id}_${savedPhoto.id}`);
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

// === ОСНОВНОЙ КОНТРОЛЛЕР ПУБЛИКАЦИИ ===
exports.createPost = async (req, res) => {
    try {
        const { text, mediaUrls = [], accounts = [], publishAt } = req.body;
        const images = mediaUrls; 
        
        if (!accounts || accounts.length === 0) {
            return res.status(400).json({ success: false, error: 'Нет аккаунтов для отправки' });
        }

        const results = [];
        let hasSuccess = false;

        const rawImageBuffers = images.map(img => {
            const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
            return Buffer.from(base64Data, 'base64');
        });

        for (const accData of accounts) {
            const account = await prisma.account.findUnique({
                where: { id: accData.accountId }
            });

            if (!account) continue;

            let finalText = text || '';
            if (accData.applySignature && accData.signatureText) {
                finalText += `\n\n${accData.signatureText}`;
            }

            let processedBuffers = rawImageBuffers;
            
            // Накладываем водяной знак (Логика сохранена)
            if (accData.applyWatermark && accData.watermarkConfig && processedBuffers.length > 0) {
                const wm = accData.watermarkConfig;
                const wmType = wm.type || 'text'; 
                const wmText = wm.text || 'SMMBOX';
                const opacity = wm.opacity !== undefined ? wm.opacity / 100 : 0.9;
                const angle = wm.angle || 0;
                
                processedBuffers = await Promise.all(rawImageBuffers.map(async (buf) => {
                    try {
                        const image = sharp(buf);
                        const metadata = await image.metadata();
                        
                        const width = metadata.width || 1000;
                        const height = metadata.height || 1000;
                        
                        let watermarkBuffer;
                        let wmPixelWidth = 0;
                        let wmPixelHeight = 0;

                        if (wmType === 'text') {
                            const scaleFactor = (wm.size || 100) / 100;
                            const fontSize = Math.max(16, Math.floor(width * 0.04 * scaleFactor));
                            
                            const paddingX = Math.floor(fontSize * 1.5); 
                            const paddingY = Math.floor(fontSize * 1); 
                            
                            const lines = wmText.split('\n');
                            let maxTextWidthRaw = 0;
                            
                            for (const line of lines) {
                                let currentLineWidth = 0;
                                for (let i = 0; i < line.length; i++) {
                                    if (line.charCodeAt(i) > 1000) currentLineWidth += fontSize * 0.95; 
                                    else currentLineWidth += fontSize * 0.75; 
                                }
                                if (currentLineWidth > maxTextWidthRaw) maxTextWidthRaw = currentLineWidth;
                            }
                            
                            wmPixelWidth = Math.floor(maxTextWidthRaw) + (paddingX * 2);
                            const lineHeight = Math.floor(fontSize * 1.25);
                            wmPixelHeight = (lines.length * lineHeight) + (paddingY * 2);
                            
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
                                    <text font-size="${fontSize}px" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" fill="${textColor}">
                                        ${tspans}
                                    </text>
                                </g>
                            </svg>`;
                            watermarkBuffer = Buffer.from(svgText);
                        } else if (wmType === 'image' && wm.image) {
                            const imgBase64 = wm.image.replace(/^data:image\/\w+;base64,/, "");
                            const scaleFactor = (wm.size || 100) / 100;
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

                        const wmMeta = await sharp(watermarkBuffer).metadata();
                        wmPixelWidth = wmMeta.width;
                        wmPixelHeight = wmMeta.height;

                        let leftPos = 0;
                        let topPos = 0;

                        if (wm.position === 'custom' || (wm.x !== undefined && wm.y !== undefined)) {
                            const centerX = Math.floor(width * (wm.x / 100));
                            const centerY = Math.floor(height * (wm.y / 100));
                            leftPos = centerX - Math.floor(wmPixelWidth / 2);
                            topPos = centerY - Math.floor(wmPixelHeight / 2);
                        } else {
                            const posToCoords = {
                                'tl': {x: 10, y: 15}, 'tc': {x: 50, y: 15}, 'tr': {x: 90, y: 15},
                                'cl': {x: 10, y: 50}, 'cc': {x: 50, y: 50}, 'cr': {x: 90, y: 50},
                                'bl': {x: 10, y: 85}, 'bc': {x: 50, y: 85}, 'br': {x: 90, y: 85}
                            };
                            const fallbackCoord = posToCoords[wm.position] || posToCoords['br'];
                            const centerX = Math.floor(width * (fallbackCoord.x / 100));
                            const centerY = Math.floor(height * (fallbackCoord.y / 100));
                            leftPos = centerX - Math.floor(wmPixelWidth / 2);
                            topPos = centerY - Math.floor(wmPixelHeight / 2);
                        }

                        return await image
                            .composite([{ input: watermarkBuffer, top: Math.round(topPos), left: Math.round(leftPos) }])
                            .jpeg({ quality: 90 }) 
                            .toBuffer();
                    } catch (e) {
                        return buf; 
                    }
                }));
            }

            // === ВАЖНО: ПРОВЕРКА НА ОТЛОЖЕННЫЙ ПОСТ ===
            const isScheduled = publishAt ? true : false;

            if (isScheduled) {
                // Превращаем обработанные картинки обратно в base64, чтобы сохранить в БД
                const base64ImagesToSave = processedBuffers.map(buf => 'data:image/jpeg;base64,' + buf.toString('base64'));
                
                await prisma.post.create({
                    data: {
                        accountId: account.id,
                        text: finalText,
                        mediaUrls: JSON.stringify(base64ImagesToSave),
                        publishAt: new Date(publishAt),
                        status: 'SCHEDULED' // СТРОГО сохраняем как отложенный
                    }
                });
                
                results.push({ accountId: account.id, success: true, scheduled: true });
                hasSuccess = true;
                console.log(`[ПЛАН] Пост запланирован в ${account.name} на ${publishAt}`);
            } else {
                // Отправляем СЕЙЧАС
                try {
                    const providerType = account.provider.toLowerCase(); 
                    if (providerType === 'telegram') {
                        const botToken = process.env.TELEGRAM_BOT_TOKEN.replace(/['"]/g, '').trim();
                        await sendToTelegram(botToken, account.providerId, finalText, processedBuffers);
                    } else if (providerType === 'vk') {
                        await sendToVK(account.accessToken, account.providerId, finalText, processedBuffers);
                    }
                    
                    // Сохраняем в историю
                    await prisma.post.create({
                        data: { accountId: account.id, text: finalText, mediaUrls: JSON.stringify([]), status: 'PUBLISHED' }
                    });

                    results.push({ accountId: account.id, success: true });
                    hasSuccess = true; 
                    console.log(`[УСПЕХ] Пост отправлен в ${account.provider} (${account.name})`);
                } catch (err) {
                    console.error(`[ОШИБКА] Не удалось отправить в ${account.provider}:`, err.response?.data || err.message);
                    results.push({ accountId: account.id, success: false, error: err.message });
                }
            }
        }

        res.json({ success: hasSuccess, results });

    } catch (error) {
        console.error('Критическая ошибка в createPost:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера при отправке' });
    }
};

// === ТАЙМЕР (CRON): АВТОМАТИЧЕСКАЯ ОТПРАВКА ОТЛОЖЕННЫХ ПОСТОВ ===
exports.initCron = () => {
    // Запускается каждую минуту
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            // Ищем все посты, время которых уже настало
            const postsToPublish = await prisma.post.findMany({
                where: { status: 'SCHEDULED', publishAt: { lte: now } },
                include: { account: true }
            });

            for (const post of postsToPublish) {
                try {
                    const account = post.account;
                    const mediaUrls = JSON.parse(post.mediaUrls || '[]');
                    
                    // Превращаем base64 из базы обратно в буферы для отправки
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

                    // Обновляем статус на Опубликовано и очищаем тяжелые фото из базы для экономии места
                    await prisma.post.update({
                        where: { id: post.id },
                        data: { status: 'PUBLISHED', mediaUrls: JSON.stringify([]) }
                    });
                    console.log(`[CRON] Отложенный пост ${post.id} успешно отправлен в ${account.name}`);
                } catch (err) {
                    console.error(`[CRON ОШИБКА] Пост ${post.id}:`, err.message);
                    await prisma.post.update({ where: { id: post.id }, data: { status: 'FAILED' } });
                }
            }
        } catch (e) {
            console.error('Ошибка в работе CRON:', e);
        }
    });
    console.log('[CRON] Планировщик отложенных постов запущен!');
};

// === ПОЛУЧИТЬ ОТЛОЖЕННЫЕ ПОСТЫ ДЛЯ КАЛЕНДАРЯ ===
exports.getScheduledPosts = async (req, res) => {
    try {
        const userId = req.user?.id || req.userId || (typeof req.user === 'string' ? req.user : null);
        if (!userId) return res.status(401).json({ success: false, error: 'Ошибка авторизации' });

        const posts = await prisma.post.findMany({
            where: { account: { userId: userId }, status: 'SCHEDULED' },
            include: { account: { select: { name: true, provider: true } } },
            orderBy: { publishAt: 'asc' }
        });
        res.json({ success: true, posts });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// === ОСТАЛЬНЫЕ ФУНКЦИИ ПАРТНЕРОВ ===
exports.shareWithPartners = async (req, res) => {
    try {
        const { text, mediaUrls = [], partnerIds = [] } = req.body;
        const senderId = req.user?.id || req.user?.userId || req.userId || (typeof req.user === 'string' ? req.user : null);

        if (!senderId) return res.status(401).json({ success: false, error: 'Ошибка авторизации: сервер не видит ваш ID' });
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
        const userId = req.user?.id || req.userId || (typeof req.user === 'string' ? req.user : null);
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