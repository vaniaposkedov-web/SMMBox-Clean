const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); // Подключение к БД
const axios = require('axios');

exports.generateText = async (req, res) => {
    try {
        const { text, systemPrompt } = req.body;
        const apiKey = '7374972655d53927687b3f7d8418580c';
        
        // 2. У Kie.ai название модели ОБЯЗАТЕЛЬНО должно быть в URL!
        const modelName = 'gpt-4o-mini'; // или gpt-4o, claude-3-5-sonnet и т.д.
        const apiUrl = `https://api.kie.ai/${modelName}/v1/chat/completions`; 

        const response = await axios.post(apiUrl, {
            // Название модели внутри body тоже оставим для надежности
            model: modelName, 
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
            validateStatus: function (status) { return status < 500; }
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