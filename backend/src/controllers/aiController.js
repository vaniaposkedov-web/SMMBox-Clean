const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); // Подключение к БД

exports.generateText = async (req, res) => {
  try {
    let { prompt, action, images } = req.body;
   
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Пустой запрос недопустим.' });
    }
    
    prompt = prompt.substring(0, 1500);
   
    // === ПОЛУЧАЕМ НАШ ПРОМПТ ИЗ АДМИНКИ (БАЗЫ ДАННЫХ) ===
    let settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
    let systemInstruction = settings?.aiPrompt || "Ты — профессиональный SMM-копирайтер. Пиши посты коротко и ясно.";

    if (action === 'rewrite') {
        systemInstruction += `\n\nТвоя задача: Улучшить отправленный черновик пользователя. Сделай его более продающим, исправь ошибки, ОБЯЗАТЕЛЬНО сохрани все цены и суть исходника.`;
    } else {
        systemInstruction += `\n\nТвоя задача: Создать пост с нуля по короткой мысли пользователя.`;
    }

    const userMessageText = action === 'rewrite' ? `Черновик для улучшения: ${prompt}` : `Идея для поста: ${prompt}`;

    // Формируем контент для OpenAI-совместимого KIE API
    let contentArray = [
        { type: "text", text: userMessageText }
    ];

    // Добавляем анализ картинок, если они есть
    if (images && Array.isArray(images) && images.length > 0) {
        contentArray.push({ type: "text", text: "Внимательно проанализируй прикрепленные фотографии (какой товар, стиль, цвет, детали) и органично впиши эту информацию в пост." });
        
        const imagesToProcess = images.slice(0, 2);
        for (const base64Image of imagesToProcess) {
            if (base64Image.length > 5 * 1024 * 1024) continue; 
            
            // Убеждаемся, что строка содержит нужный префикс Data URI
            let formattedImage = base64Image;
            if (!formattedImage.startsWith('data:image')) {
                formattedImage = `data:image/jpeg;base64,${formattedImage}`;
            }

            contentArray.push({ 
                type: "image_url", 
                image_url: { url: formattedImage } 
            });
        }
    }

    // Подключаем KIE API
    const KIE_API_KEY = process.env.KIE_API_KEY || '7374972655d53927687b3f7d8418580c';
    const url = 'https://api.kie.ai/gemini-3.1-pro/v1/chat/completions';

    // Создаем прерывание запроса, если API зависнет дольше 15 секунд
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${KIE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: contentArray }
            ]
        }),
        signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        const errorData = await response.text();
        console.error('Ответ KIE API с ошибкой:', errorData);
        throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Некорректный формат ответа от KIE API');
    }

    let responseText = data.choices[0].message.content.trim();
    if (responseText.length > 1000) responseText = responseText.substring(0, 997) + '...';

    res.json({ success: true, text: responseText });

  } catch (error) {
    console.error('=== ОШИБКА ИИ ===', error.message);
    if (error.name === 'AbortError') return res.status(504).json({ error: 'Нейросеть думает слишком долго.' });
    if (error.message.includes('SAFETY')) return res.status(400).json({ error: 'Запрос отклонен цензурой ИИ.' });
    res.status(500).json({ error: 'Временный сбой нейросети.' });
  }
};