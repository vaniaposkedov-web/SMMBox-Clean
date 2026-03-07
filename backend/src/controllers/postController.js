const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp'); // Для водяных знаков

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

// === ОСНОВНОЙ КОНТРОЛЛЕР ===
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

            // === ИДЕАЛЬНАЯ ЛОГИКА ВОДЯНЫХ ЗНАКОВ ===
            let processedBuffers = rawImageBuffers;
            
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
                            // 1. Адаптация размера
                            const scaleFactor = (wm.size || 100) / 100;
                            const fontSize = Math.max(16, Math.floor(width * 0.04 * scaleFactor));
                            
                            // 2. ИСПРАВЛЕНИЕ: Королевские отступы
                            const paddingX = Math.floor(fontSize * 1.5); // Еще больше пространства по бокам
                            const paddingY = Math.floor(fontSize * 0.8); // Комфортные отступы сверху и снизу
                            
                            // 3. УМНЫЙ ПРОСЧЕТ ШИРИНЫ (Спец. для русского языка)
                            let textWidthRaw = 0;
                            for (let i = 0; i < wmText.length; i++) {
                                // Если код символа > 1000 — это кириллица (русские буквы)
                                if (wmText.charCodeAt(i) > 1000) {
                                    textWidthRaw += fontSize * 0.85; // Даем много места широким русским буквам
                                } else {
                                    textWidthRaw += fontSize * 0.65; // Стандартное место для английских букв и цифр
                                }
                            }
                            textWidthRaw = Math.floor(textWidthRaw);
                            
                            wmPixelWidth = textWidthRaw + (paddingX * 2);
                            wmPixelHeight = Math.floor(fontSize * 1.3) + (paddingY * 2);
                            
                            const bgColor = wm.bgColor || '#000000';
                            const textColor = wm.textColor || '#ffffff';
                            const hasBg = wm.hasBackground !== false;
                            const borderRadius = Math.floor(fontSize * 0.35); 

                            // 4. Генерация SVG
                            const svgText = `
                            <svg width="${wmPixelWidth}" height="${wmPixelHeight}" xmlns="http://www.w3.org/2000/svg">
                                <g opacity="${opacity}">
                                    ${hasBg ? `<rect width="100%" height="100%" fill="${bgColor}" rx="${borderRadius}" />` : ''}
                                    <text x="50%" y="52%" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}px" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" fill="${textColor}">${wmText}</text>
                                </g>
                            </svg>`;
                            
                            watermarkBuffer = Buffer.from(svgText);
                            
                        } else if (wmType === 'image' && wm.image) {
                            // 5. ПОДДЕРЖКА ЛОГОТИПОВ (PNG/JPG)
                            const imgBase64 = wm.image.replace(/^data:image\/\w+;base64,/, "");
                            const scaleFactor = (wm.size || 100) / 100;
                            const targetWidth = Math.max(50, Math.floor(width * 0.15 * scaleFactor));

                            watermarkBuffer = await sharp(Buffer.from(imgBase64, 'base64'))
                                .resize({ width: targetWidth })
                                .ensureAlpha()
                                .composite([{
                                    input: Buffer.from([255, 255, 255, Math.floor(opacity * 255)]),
                                    raw: { width: 1, height: 1, channels: 4 },
                                    tile: true,
                                    blend: 'dest-in'
                                }])
                                .toBuffer();
                        }

                        if (!watermarkBuffer) return buf;

                        // 6. ПОВОРОТ
                        if (angle !== 0) {
                            watermarkBuffer = await sharp(watermarkBuffer)
                                .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
                                .toBuffer();
                        }

                        // Получаем точные размеры плашки после возможного поворота
                        const wmMeta = await sharp(watermarkBuffer).metadata();
                        wmPixelWidth = wmMeta.width;
                        wmPixelHeight = wmMeta.height;

                        // 7. СИНХРОНИЗАЦИЯ КООРДИНАТ С REACT (Translate -50%, -50%)
                        let leftPos = 0;
                        let topPos = 0;

                        if (wm.position === 'custom' || (wm.x !== undefined && wm.y !== undefined)) {
                            // Фронтенд передает координаты ЦЕНТРА в процентах
                            const centerX = Math.floor(width * (wm.x / 100));
                            const centerY = Math.floor(height * (wm.y / 100));
                            leftPos = centerX - Math.floor(wmPixelWidth / 2);
                            topPos = centerY - Math.floor(wmPixelHeight / 2);
                        } else {
                            // Резерв по старой сетке из React-компонента
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

                        // 8. Жесткая защита границ (чтобы знак не вылез за фото и не выдал ошибку)
                        leftPos = Math.max(0, Math.min(leftPos, width - wmPixelWidth));
                        topPos = Math.max(0, Math.min(topPos, height - wmPixelHeight));

                        return await image
                            .composite([{ 
                                input: watermarkBuffer, 
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

            try {
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