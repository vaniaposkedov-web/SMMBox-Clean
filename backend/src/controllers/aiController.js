const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); // <-- ДОБАВИЛИ ПОДКЛЮЧЕНИЕ К БД

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", 
        systemInstruction: systemInstruction 
    });

    const parts = [];
    const userMessage = action === 'rewrite' ? `Черновик для улучшения: ${prompt}` : `Идея для поста: ${prompt}`;
    parts.push(userMessage);

    if (images && Array.isArray(images) && images.length > 0) {
        parts.push("Внимательно проанализируй прикрепленные фотографии (какой товар, стиль, цвет, детали) и органично впиши эту информацию в пост.");
        
        const imagesToProcess = images.slice(0, 2);
        for (const base64Image of imagesToProcess) {
            if (base64Image.length > 5 * 1024 * 1024) continue; 
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
            const mimeType = base64Image.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";
            parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
        }
    }

    const requestPromise = model.generateContent(parts);
    const result = await withTimeout(requestPromise, 15000); 

    let responseText = result.response.text().trim();
    if (responseText.length > 1000) responseText = responseText.substring(0, 997) + '...';

    res.json({ success: true, text: responseText });

  } catch (error) {
    console.error('=== ОШИБКА ИИ ===', error.message);
    if (error.message === 'TIMEOUT') return res.status(504).json({ error: 'Нейросеть думает слишком долго.' });
    if (error.message.includes('SAFETY')) return res.status(400).json({ error: 'Запрос отклонен цензурой ИИ.' });
    res.status(500).json({ error: 'Временный сбой нейросети.' });
  }
};