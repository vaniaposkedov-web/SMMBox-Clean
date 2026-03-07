const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp'); // Для водяных знаков

// === ЛОГИКА ОТПРАВКИ В TELEGRAM ===
async function sendToTelegram(token, chatId, text, imageBuffers) {
    const baseUrl = `https://api.telegram.org/bot${token}`;

    if (imageBuffers.length === 0) {
        // Только текст
        await axios.post(`${baseUrl}/sendMessage`, {
            chat_id: chatId,
            text: text
        });
    } else if (imageBuffers.length === 1) {
        // Одно фото
        const form = new FormData();
        form.append('chat_id', chatId);
        if (text) form.append('caption', text);
        form.append('photo', imageBuffers[0], 'image.jpg');
        await axios.post(`${baseUrl}/sendPhoto`, form, { headers: form.getHeaders() });
    } else {
        // Карусель фото (Media Group)
        const form = new FormData();
        form.append('chat_id', chatId);
        
        const media = imageBuffers.map((buf, i) => ({
            type: 'photo',
            media: `attach://photo${i}`,
            caption: i === 0 ? text : '' // Подпись крепится только к первому фото
        }));
        
        form.append('media', JSON.stringify(media));
        
        imageBuffers.forEach((buf, i) => {
            form.append(`photo${i}`, buf, `photo${i}.jpg`);
        });
        
        await axios.post(`${baseUrl}/sendMediaGroup`, form, { headers: form.getHeaders() });
    }
}

// === ЛОГИКА ОТПРАВКИ В ВКОНТАКТЕ ===
async function sendToVK(token, groupId, text, imageBuffers) {
    const v = '5.131';
    const cleanGroupId = Math.abs(parseInt(groupId)); // VK API требует ID группы без минуса
    let attachments = [];

    // 1. Если есть фото, сначала загружаем их на сервера ВК
    if (imageBuffers.length > 0) {
        // Получаем сервер для загрузки
        const serverRes = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, {
            params: { group_id: cleanGroupId, access_token: token, v }
        });
        const uploadUrl = serverRes.data.response.upload_url;

        // Загружаем каждое фото по очереди
        for (let i = 0; i < imageBuffers.length; i++) {
            const form = new FormData();
            form.append('file1', imageBuffers[i], `image${i}.jpg`);
            
            const uploadRes = await axios.post(uploadUrl, form, { headers: form.getHeaders() });

            // Сохраняем загруженное фото
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

    // 2. Публикуем пост на стену группы
    const postParams = new URLSearchParams({
        owner_id: `-${cleanGroupId}`, // Для публикации в группу нужен минус
        from_group: 1,
        message: text || '',
        access_token: token,
        v
    });

    if (attachments.length > 0) {
        postParams.append('attachments', attachments.join(','));
    }

    const postRes = await axios.post(`https://api.vk.com/method/wall.post`, postParams);
    
    if (postRes.data.error) {
        throw new Error(postRes.data.error.error_msg);
    }
}

// === ОСНОВНОЙ КОНТРОЛЛЕР ===
exports.createPost = async (req, res) => {
    try {
        // Принимаем mediaUrls (как шлет фронтенд)
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

        // Проходимся по каждому выбранному профилю
        for (const accData of accounts) {
            const account = await prisma.account.findUnique({
                where: { id: accData.accountId }
            });

            if (!account) continue;

            // 1. Формируем финальный текст с подписью
            let finalText = text || '';
            if (accData.applySignature && accData.signatureText) {
                finalText += `\n\n${accData.signatureText}`;
            }

            // 2. ИДЕАЛЬНАЯ ЛОГИКА ВОДЯНЫХ ЗНАКОВ SHARP (Синхронизировано с фронтендом)
            let processedBuffers = rawImageBuffers;
            
            if (accData.applyWatermark && accData.watermarkConfig && processedBuffers.length > 0) {
                const wm = accData.watermarkConfig;
                const wmText = wm.text || 'SMMBOX';

                processedBuffers = await Promise.all(rawImageBuffers.map(async (buf) => {
                    try {
                        const image = sharp(buf);
                        const metadata = await image.metadata();
                        
                        const width = metadata.width || 1000;
                        const height = metadata.height || 1000;
                        
                        // Адаптивный размер шрифта (соответствует фронтенду)
                        const fontSize = Math.max(16, Math.floor(width * 0.04 * ((wm.size || 100) / 100)));
                        
                        // Вычисляем размеры плашки
                        const padding = Math.floor(fontSize * 0.6);
                        const textWidth = Math.floor(wmText.length * fontSize * 0.6) + (padding * 2);
                        const textHeight = Math.floor(fontSize * 1.5);
                        
                        const bgColor = wm.bgColor || '#000000';
                        const textColor = wm.textColor || '#ffffff';
                        const opacity = wm.opacity !== undefined ? wm.opacity / 100 : 0.9;
                        const hasBg = wm.hasBackground !== false;

                        // Идеальное центрирование текста внутри прямоугольника
                        const svgText = `
                        <svg width="${textWidth}" height="${textHeight}" xmlns="http://www.w3.org/2000/svg">
                            <g opacity="${opacity}">
                                ${hasBg ? `<rect width="100%" height="100%" fill="${bgColor}" rx="${padding / 2}" />` : ''}
                                <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}px" font-family="Arial, sans-serif" font-weight="bold" fill="${textColor}">${wmText}</text>
                            </g>
                        </svg>`;

                        // Вычисляем точные пиксельные координаты X и Y из процентов
                        let leftPos = 0;
                        let topPos = 0;

                        if (wm.x !== null && wm.y !== null && wm.x !== undefined && wm.y !== undefined) {
                            // Если пользователь двигал ползунки
                            leftPos = Math.floor((width - textWidth) * (wm.x / 100));
                            topPos = Math.floor((height - textHeight) * (wm.y / 100));
                        } else {
                            // Резервный вариант, если координаты не сохранились (с отступом 5%)
                            const marginX = Math.floor(width * 0.05);
                            const marginY = Math.floor(height * 0.05);
                            
                            if (wm.position?.includes('l')) leftPos = marginX;
                            else if (wm.position?.includes('r')) leftPos = width - textWidth - marginX;
                            else leftPos = Math.floor((width - textWidth) / 2);

                            if (wm.position?.includes('t')) topPos = marginY;
                            else if (wm.position?.includes('b')) topPos = height - textHeight - marginY;
                            else topPos = Math.floor((height - textHeight) / 2);
                        }

                        // Защита от выхода за границы картинки при экстремальных значениях
                        leftPos = Math.max(0, Math.min(leftPos, width - textWidth));
                        topPos = Math.max(0, Math.min(topPos, height - textHeight));

                        // Накладываем по точным координатам
                        return await image
                            .composite([{ 
                                input: Buffer.from(svgText), 
                                top: topPos, 
                                left: leftPos 
                            }])
                            .jpeg({ quality: 90 }) 
                            .toBuffer();
                    } catch (e) {
                        console.error('Ошибка наложения водяного знака:', e.message);
                        return buf; 
                    }
                }));
            }

            // 3. Отправляем в нужную соцсеть
            try {
                // Приводим к нижнему регистру для безопасности проверки
                const providerType = account.provider.toLowerCase(); 

                if (providerType === 'telegram') {
                    const botToken = process.env.TELEGRAM_BOT_TOKEN.replace(/['"]/g, '').trim();
                    await sendToTelegram(botToken, account.providerId, finalText, processedBuffers);
                } else if (providerType === 'vk') {
                    await sendToVK(account.accessToken, account.providerId, finalText, processedBuffers);
                }
                
                results.push({ accountId: account.id, success: true });
                hasSuccess = true; 
                console.log(`[УСПЕХ] Пост отправлен в ${account.provider} (${account.name})`);
            } catch (err) {
                console.error(`[ОШИБКА] Не удалось отправить в ${account.provider}:`, err.response?.data || err.message);
                results.push({ accountId: account.id, success: false, error: err.message });
            }
        }

        res.json({ success: hasSuccess, results });

    } catch (error) {
        console.error('Критическая ошибка в createPost:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера при отправке' });
    }
};