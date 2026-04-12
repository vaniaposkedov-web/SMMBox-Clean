const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); // Подключение к БД

const axios = require('axios');

exports.generateText = async (req, res) => {
    try {
        const { text, systemPrompt } = req.body;
        
        // 1. Безопасно получаем ключ из .env (C:\Users\vanap\Desktop\smmbox-clone\backend\.env)
        const apiKey = process.env.KIE_API_KEY;
        
        // 2. Официальный универсальный эндпоинт Kie.ai
        const apiUrl = 'https://api.kie.ai/v1/chat/completions'; 

        const response = await axios.post(apiUrl, {
            // Выбираешь нужную модель, которая доступна в твоем тарифе Kie
            model: "gpt-4o-mini", // Замени на нужную (например: gpt-4o, claude-3-5-sonnet и т.д.)
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ],
            temperature: 0.7 // Немного креативности для SMM-текстов
        }, {
            headers: { 
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        // 3. Kie.ai возвращает ответ в строгом OpenAI формате
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            res.json({ success: true, text: response.data.choices[0].message.content });
        } else {
            throw new Error("Неверный формат ответа от KIE API");
        }

    } catch (error) {
        // Логируем детальную ошибку, если вдруг не хватило кредитов или неверное имя модели
        console.error('[KIE API ERROR]:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: "Ошибка при обращении к нейросети" });
    }
};