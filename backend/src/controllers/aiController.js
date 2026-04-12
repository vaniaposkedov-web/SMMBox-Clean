const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); // Подключение к БД
const axios = require('axios');

exports.generateText = async (req, res) => {
    try {
        const { text, systemPrompt } = req.body;
        const apiKey = process.env.KIE_API_KEY;
        const apiUrl = 'https://api.kie.ai/v1/chat/completions'; 

        const response = await axios.post(apiUrl, {
            model: "gpt-4o-mini", // Возможно, в твоем тарифе доступна другая модель
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ],
            temperature: 0.7
        }, {
            headers: { 
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            // Заставляем axios не падать при ошибках, чтобы прочитать ответ
            validateStatus: function (status) {
                return status < 500; 
            }
        });

        // === 🛠 ЛОГ ДЛЯ ОТЛАДКИ (ПОСМОТРИМ, ЧТО ОНИ ОТВЕТИЛИ) ===
        console.log('\n=== ОТВЕТ ОТ KIE API ===');
        console.log(`Статус-код: ${response.status}`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('========================\n');

        // Если все прошло идеально:
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return res.json({ success: true, text: response.data.choices[0].message.content });
        } 
        
        // Если Kie.ai прислал ошибку в самом JSON:
        if (response.data && response.data.error) {
            const errorMsg = response.data.error.message || response.data.error;
            throw new Error(`Kie.ai отклонил запрос: ${errorMsg}`);
        }

        // Если совсем непонятный формат:
        throw new Error("Неверный формат ответа от KIE API");

    } catch (error) {
        console.error('[KIE API ERROR]:', error.message);
        res.status(500).json({ success: false, error: "Ошибка при обращении к нейросети" });
    }
};