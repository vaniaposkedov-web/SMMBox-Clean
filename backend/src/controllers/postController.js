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

// === ДОБАВЛЕН ПАРАМЕТР publishAtDate ===
async function sendToKomodVK(token, providerId, text, imageBuffers, publishAtDate = null) {
    const KOMOD_BASE_URL = 'https://kom-od.ru/api/v1';
    const form = new FormData();

    let targetGroupId = null;

    // 1. Получаем список групп из шлюза
    const grpRes = await axios.get(`${KOMOD_BASE_URL}/group`, { headers: { 'Access-Token': token } });
    const groups = grpRes.data?.data?.items || grpRes.data?.data || [];

    if (providerId.startsWith('group_')) {
        const vkUid = providerId.replace('group_', '');
        const targetGroup = groups.find(g => String(g.uid) === String(vkUid) || String(g.url).includes(vkUid) || String(g.id) === String(vkUid));
        
        if (!targetGroup) throw new Error(`Группа не найдена в шлюзе Kom-od. Попробуйте переподключить её.`);
        targetGroupId = targetGroup.id;
    } else if (providerId.startsWith('wall_')) {
        const accId = providerId.replace('wall_', '');
        
        // Умный поиск: ищем стену по новому флагу is_profile от шлюза, либо по старым признакам
        let targetGroup = groups.find(g => 
            String(g.account_id) === String(accId) && 
            (String(g.is_profile) === '1' || g.is_profile === true || g.type === 'profile' || String(g.url).includes('vk.com/id') || String(g.uid) === String(g.user_id))
        );
        
        if (!targetGroup) {
            console.log(`[KOMOD ERROR] Стена для account_id ${accId} не активирована в шлюзе.`);
            throw new Error('Стена еще не активирована! Зайдите в "Мои социальные сети" и обязательно нажмите фиолетовую кнопку "Подключить стену".');
        } else {
            targetGroupId = targetGroup.id;
        }
    }

    if (!targetGroupId) throw new Error('Не удалось определить ID цели для публикации шлюза.');

    let targetDate = publishAtDate ? new Date(publishAtDate) : new Date();

    if (!publishAtDate) {
        // Для мгновенных постов накидываем 1-2 минуты к текущему времени, 
        // чтобы планировщик шлюза гарантированно успел его подхватить "прямо сейчас"
        targetDate.setMinutes(targetDate.getMinutes() + 1);
    }

    // === БРОНЕБОЙНОЕ РЕШЕНИЕ ДЛЯ ЧАСОВЫХ ПОЯСОВ ===
    // Здесь мы указываем тот пояс, который ты сохранил в настройках ЛК Kom-od.
    // Если в Kom-od стоит Москва -> 'Europe/Moscow'
    // Если оставил ЕКБ -> 'Asia/Yekaterinburg'
    const komodTimezone = 'Europe/Moscow'; 

    // Используем встроенный трюк JS: локаль 'sv-SE' (Швеция) 
    // автоматически отдает дату в идеальном формате "YYYY-MM-DD HH:mm:ss", 
    // при этом мы принудительно заставляем ее считать время по поясу шлюза.
    const tzString = targetDate.toLocaleString('sv-SE', { timeZone: komodTimezone });
    
    // Отрезаем секунды, чтобы получить строго то, что требует API: "YYYY-MM-DD HH:mm"
    const formattedDate = tzString.substring(0, 16);

    form.append('group_id', targetGroupId);
    form.append('publish_at', formattedDate); // <--- ВОТ ОНО!
    form.append('via_api', '1'); // <--- Принудительно через API
    
    // ... остальной код сборки media оставляем без изменений ...

    const media = [];
    if (text) {
        media.push({ type: 'text', text: text });
    }

    if (imageBuffers && imageBuffers.length > 0) {
        const images = [];
        imageBuffers.forEach((buf, index) => {
            const fileName = `file_${index + 1}`;
            images.push({ name: fileName });
            form.append(fileName, buf, { filename: `photo_${Date.now()}_${index}.jpg`, contentType: 'image/jpeg' });
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
        validateStatus: status => status < 500
    });

    if (postRes.data && postRes.data.success === false) {
        throw new Error('Ошибка шлюза при публикации: ' + JSON.stringify(postRes.data.errors));
    }

    // === УМНЫЙ ШПИОН ЗА ОЧЕРЕДЬЮ KOM-OD ===
    const postId = postRes.data?.data?.id;
    if (postId) {
        const checkStatus = async (delay, attempt) => {
            setTimeout(async () => {
                try {
                    console.log(`\n⏳ [Проверка #${attempt}] Запрашиваем статус поста ${postId}...`);
                    const checkRes = await axios.get(`${KOMOD_BASE_URL}/post/${postId}?logs=1`, {
                        headers: { 'Access-Token': token },
                        validateStatus: () => true
                    });
                    
                    const postData = checkRes.data?.data;
                    if (postData) {
                        console.log(`=== СТАТУС ПОСТА ${postId} (Через ${delay/1000} сек) ===`);
                        console.log(`Опубликован в ВК: ${postData.published === '1' ? 'ДА ✅' : 'В ОЧЕРЕДИ ⏳'}`);
                        console.log(`Произошла ошибка: ${postData.fail === '1' ? 'ДА ❌' : 'НЕТ ✅'}`);
                        if (postData.logs && postData.logs.length > 0) {
                            console.log('ЛОГИ ШЛЮЗА:');
                            postData.logs.forEach(l => console.log(`> ${l.message}`));
                        }
                        console.log(`===========================================\n`);
                    }
                } catch (e) {
                    // Игнорируем ошибки сети при проверке
                }
            }, delay);
        };

        // Проверяем статус 3 раза: через 15, 30 и 60 секунд
        checkStatus(15000, 1);
        checkStatus(30000, 2);
        checkStatus(60000, 3);
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

// === ОСНОВНОЙ КОНТРОЛЛЕР ПУБЛИКАЦИИ (ИДЕАЛЬНАЯ АРХИТЕКТУРА) ===
exports.createPost = async (req, res) => {
    try {
        const { text, mediaUrls = [], accounts = [], publishAt } = req.body;
        
        // === 1. УМНАЯ И БЕЗОПАСНАЯ ПРОВЕРКА ДАТЫ ===
        let parsedPublishAt = null;
        let isScheduled = false;

        // Проверяем, что дата передана и не является мусором
        if (publishAt && publishAt !== 'null' && publishAt !== 'undefined') {
            parsedPublishAt = new Date(publishAt);
            
            // Если JS не смог распарсить дату (Invalid Date), возвращаем ошибку клиенту, а не роняем сервер
            if (isNaN(parsedPublishAt.getTime())) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Сбой времени. Пожалуйста, проверьте выбранную дату и время публикации.' 
                });
            }
            isScheduled = true;
        }

        if (!accounts || accounts.length === 0) {
            return res.status(400).json({ success: false, error: 'Нет аккаунтов для отправки' });
        }

        // 2. ОПТИМИЗАЦИЯ ИСХОДНИКОВ (СИНХРОННО)
        const rawImageBuffers = mediaUrls.map(img => Buffer.from(img.replace(/^data:image\/\w+;base64,/, ""), 'base64'));
        const optimizedBaseBuffers = await Promise.all(rawImageBuffers.map(async (buf) => {
            return await sharp(buf).resize({ width: 2500, height: 2500, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
        }));

        const accountJobs = [];

        // 3. СИНХРОННОЕ НАЛОЖЕНИЕ ВОДЯНЫХ ЗНАКОВ ДЛЯ ВСЕХ АККАУНТОВ
        for (const accData of accounts) {
            const account = await prisma.account.findUnique({ where: { id: accData.accountId } });
            if (!account) continue;

            let finalText = text || '';
            if (accData.applySignature && accData.signatureText) {
                finalText += `\n\n${accData.signatureText}`;
            }

            let processedBuffers = optimizedBaseBuffers;
            
            if (accData.applyWatermark && accData.watermarkConfig && processedBuffers.length > 0) {
                let wm = accData.watermarkConfig;
                if (typeof wm === 'string') { try { wm = JSON.parse(wm); } catch(e) {} }
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
                                    currentLineWidth += (line.charCodeAt(i) > 1000) ? fontSize * 0.95 : fontSize * 0.65; 
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

            accountJobs.push({
                account,
                finalText,
                processedBuffers
            });
        }

        // 4. ОТПРАВКА ДАННЫХ В ЗАВИСИМОСТИ ОТ ТИПА ПОСТА
        if (isScheduled) {
            // Для отложенных: СРАЗУ сохраняем качественные фото в базу данных
            for (const job of accountJobs) {
                const finalImagesToSave = job.processedBuffers.map(buf => 'data:image/jpeg;base64,' + buf.toString('base64'));
                await prisma.post.create({
                    data: {
                        accountId: job.account.id,
                        text: job.finalText,
                        mediaUrls: JSON.stringify(finalImagesToSave),
                        publishAt: parsedPublishAt, // ✅ БЕЗОПАСНАЯ И ПРОВЕРЕННАЯ ДАТА ИЗ ШАГА 1
                        status: 'SCHEDULED' 
                    }
                });
            }
            // Гарантированно отдаем ответ фронтенду ТОЛЬКО после сохранения
            return res.status(200).json({ success: true, message: 'Запланировано' });
        } else {
            // Для мгновенных: Сохраняем ТОЛЬКО легкие миниатюры для истории (экономия места)
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

            // Отпускаем пользователя (перекидываем на зеленый экран)
            res.status(200).json({ success: true, message: 'Отправка запущена' });

            // А сами тяжелые файлы отправляем в ВК/ТГ в фоновом режиме
            setTimeout(async () => {
                for (const job of accountJobs) {
                    try {
                        const providerType = job.account.provider.toLowerCase(); 
                        if (providerType === 'telegram') {
                            const botToken = process.env.TELEGRAM_BOT_TOKEN.replace(/['"]/g, '').trim();
                            await sendToTelegram(botToken, job.account.providerId, job.finalText, job.processedBuffers);
                        } else if (providerType === 'vk') {
                            const isKomod = job.account.providerId.startsWith('wall_') || job.account.providerId.startsWith('group_');
                            if (isKomod) {
                                // === ПЕРЕДАЕМ ТЕКУЩУЮ ДАТУ ===
                                await sendToKomodVK(job.account.accessToken, job.account.providerId, job.finalText, job.processedBuffers, new Date());
                            } else {
                                await sendToVK(job.account.accessToken, job.account.providerId, job.finalText, job.processedBuffers);
                            }
                        }
                    } catch (err) {
                        console.error(`[BACKGROUND ERROR] ${job.account.name}:`, err.message);
                        
                        // Меняем статус на ошибку, чтобы юзер не ждал вечно
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
                    
                    // Берем уже ИДЕАЛЬНО ГОТОВЫЕ фото с водяным знаком прямо из базы
                    const imageBuffers = mediaUrls.map(img => {
                        const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
                        return Buffer.from(base64Data, 'base64');
                    });

                    const providerType = account.provider.toLowerCase();
                    if (providerType === 'telegram') {
                        const botToken = process.env.TELEGRAM_BOT_TOKEN.replace(/['"]/g, '').trim();
                        await sendToTelegram(botToken, account.providerId, post.text, imageBuffers);
                    } else if (providerType === 'vk') {
                        const isKomod = account.providerId.startsWith('wall_') || account.providerId.startsWith('group_');
                        if (isKomod) {
                            // === ПЕРЕДАЕМ ЗАПЛАНИРОВАННУЮ ДАТУ ===
                            await sendToKomodVK(account.accessToken, account.providerId, post.text, imageBuffers, post.publishAt);
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

        // ЗАЩИТА: Не отдаем тяжелые Base64-картинки фронтенду, чтобы не вызвать ошибку QuotaExceededError
        // ЗАЩИТА: Отдаем только ОДНУ картинку для превью, чтобы не вызвать ошибку
        const lightweightPosts = posts.map(p => {
            let firstImage = [];
            try {
                const parsed = JSON.parse(p.mediaUrls || '[]');
                if (parsed.length > 0) firstImage = [parsed[0]]; // Берем только 1 фото
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