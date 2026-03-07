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

    // === НОВЫЙ МОЩНЫЙ СИСТЕМНЫЙ ПРОМПТ ===
    let systemInstruction = `Ты — профессиональный SMM-копирайтер для продавцов из торговых центров и розничных магазинов.
    Твоя задача — создавать привлекательные, живые и продающие тексты для соцсетей (Telegram, VK, Instagram).

    ТВОИ ЖЕСТКИЕ ПРАВИЛА:
    1. ФОРМАТ: ВЫДАВАЙ ТОЛЬКО ТЕКСТ ПОСТА! Никаких приветствий, комментариев или подтверждений.
    2. ЛИМИТ: Текст должен быть короче 1000 символов.
    3. ТОН: Разговорный, естественный и живой стиль. Пиши просто, без излишнего пафоса и "воды".
    4. СТРУКТУРА:
       - Короткий цепляющий заголовок.
       - 2-3 коротких абзаца (описание товара, цвет, стиль, эмоции от вещи).
       - Мягкий призыв к действию (CTA) — например, приглашение примерить, написать в личку или зайти в павильон.
       - 3-5 релевантных хештегов в самом конце.
    5. ЭМОДЗИ: Используй умеренно (не более 3-4 на весь текст).
    6. АНТИ-ГАЛЛЮЦИНАЦИИ: НИКОГДА не придумывай характеристики, материалы или цены, если их нет в запросе или их нельзя точно распознать на фото. Не пиши фразы типа "На фото изображено".`;

    if (action === 'rewrite') {
        systemInstruction += `\n\nТвоя задача: Улучшить отправленный черновик пользователя. Сделай его более продающим, исправь ошибки, ОБЯЗАТЕЛЬНО сохрани все цены и суть исходника.`;
    } else {
        systemInstruction += `\n\nТвоя задача: Создать пост с нуля по короткой мысли пользователя.`;
    }

    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", 
        systemInstruction: systemInstruction 
    });

    const parts = [];
    const userMessage = action === 'rewrite' ? `Черновик для улучшения: ${prompt}` : `Идея для поста: ${prompt}`;
    parts.push(userMessage);

    // ЗАЩИТА 3: Ограничение размера и количества картинок
    if (images && Array.isArray(images) && images.length > 0) {
        // Уточняем задачу для анализа фото
        parts.push("Внимательно проанализируй прикрепленные фотографии (какой товар, стиль, цвет, детали) и органично впиши эту информацию в пост.");
        
        const imagesToProcess = images.slice(0, 2);
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