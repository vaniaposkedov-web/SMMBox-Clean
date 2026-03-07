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
        const { text, images = [], accounts = [], publishAt } = req.body;
        
        if (!accounts || accounts.length === 0) {
            return res.status(400).json({ success: false, error: 'Нет аккаунтов для отправки' });
        }

        const results = [];

        // Декодируем все картинки из Base64 обратно в бинарные файлы (Buffer)
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
            if (accData.applySignature && account.signature) {
                finalText += `\n\n${account.signature}`;
            }

            // 2. Блок обработки водяного знака (подготовлен к внедрению логики Sharp)
            let processedBuffers = rawImageBuffers;
            if (accData.applyWatermark && processedBuffers.length > 0) {
                // В будущем здесь будет логика:
                // processedBuffers = await Promise.all(rawImageBuffers.map(buf => sharp(buf).composite(...).toBuffer()));
            }

            // 3. Отправляем в нужную соцсеть
            try {
                if (account.provider === 'telegram') {
                    await sendToTelegram(account.accessToken, account.providerId, finalText, processedBuffers);
                } else if (account.provider === 'vk') {
                    await sendToVK(account.accessToken, account.providerId, finalText, processedBuffers);
                }
                
                results.push({ accountId: account.id, success: true });
                console.log(`[УСПЕХ] Пост отправлен в ${account.provider} (${account.name})`);
            } catch (err) {
                console.error(`[ОШИБКА] Не удалось отправить в ${account.provider}:`, err.response?.data || err.message);
                results.push({ accountId: account.id, success: false, error: err.message });
            }
        }

        res.json({ success: true, results });

    } catch (error) {
        console.error('Критическая ошибка в createPost:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера при отправке' });
    }
};