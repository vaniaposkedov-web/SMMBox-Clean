const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Функция для обрыва долгих запросов (Тайм-аут)
const withTimeout = (promise, ms) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

exports.generateText = async (req, res) => {
  try {
    let { prompt, action, images } = req.body;

    // ЗАЩИТА 1: Проверка на пустой запрос
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Пустой запрос недопустим.' });
    }

    // ЗАЩИТА 2: Жесткая обрезка текста на бэкенде (максимум 1500 символов)
    prompt = prompt.substring(0, 1500);

    let systemInstruction = `Ты пишешь тексты так, будто ты обычный человек, который делится классной находкой, а не робот или агрессивный маркетолог.
    
    ТВОИ ЖЕСТКИЕ ПРАВИЛА:
    1. ВЫДАВАЙ ТОЛЬКО ТЕКСТ ПОСТА! Никаких приветствий.
    2. Текст должен быть короче 1000 символов.
    3. НИКАКИХ ПРИЗЫВОВ К ДЕЙСТВИЮ (CTA). 
    4. ТОН: Просто прикольное, живое, стильное и естественное описание товара или услуги.
    5. Короткие абзацы (1-2 предложения), минимум "воды".
    6. Эмодзи используй очень редко (максимум 1-2 на весь текст).`;

    if (action === 'rewrite') {
        systemInstruction += `\nТвоя задача: Улучшить отправленный черновик. Сделай его естественным и живым, исправь ошибки, сохрани цены и суть, но убери агрессивные призывы.`;
    } else {
        systemInstruction += `\nТвоя задача: Сделать прикольное описание с нуля по короткой мысли пользователя.`;
    }

    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash", 
        systemInstruction: systemInstruction 
    });

    const parts = [];
    const userMessage = action === 'rewrite' ? `Перепиши этот текст: ${prompt}` : `Напиши пост: ${prompt}`;
    parts.push(userMessage);

    // ЗАЩИТА 3: Ограничение размера и количества картинок
    if (images && Array.isArray(images) && images.length > 0) {
        parts.push("Обязательно проанализируй эти фотографии и органично впиши детали с них в описание.");
        
        const imagesToProcess = images.slice(0, 2); // Строго не больше 2
        for (const base64Image of imagesToProcess) {
            // Если base64 строка слишком огромная (больше ~4MB), пропускаем картинку
            if (base64Image.length > 5 * 1024 * 1024) continue; 

            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
            const mimeType = base64Image.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";
            
            parts.push({
                inlineData: { data: base64Data, mimeType: mimeType }
            });
        }
    }

    // ЗАЩИТА 4: Выполнение с тайм-аутом 15 секунд
    const requestPromise = model.generateContent(parts);
    const result = await withTimeout(requestPromise, 15000); 

    let responseText = result.response.text().trim();

    if (responseText.length > 1000) {
        responseText = responseText.substring(0, 997) + '...';
    }

    res.json({ success: true, text: responseText });

  } catch (error) {
    console.error('=== ОШИБКА ИИ ===', error.message);

    // ЗАЩИТА 5: Умная обработка специфичных ошибок
    if (error.message === 'TIMEOUT') {
        return res.status(504).json({ error: 'Нейросеть думает слишком долго. Попробуйте нажать еще раз.' });
    }
    if (error.message.includes('Candidate was blocked due to SAFETY')) {
        return res.status(400).json({ error: 'Ваш запрос отклонен цензурой ИИ. Уберите запрещенные слова.' });
    }
    if (error.status === 429 || error.message.includes('quota')) {
        return res.status(429).json({ error: 'Сервер перегружен запросами. Подождите пару минут.' });
    }

    // Общая ошибка для всего остального
    res.status(500).json({ error: 'Временный сбой нейросети. Мы уже чиним!' });
  }
};