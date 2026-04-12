const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

exports.generateText = async (req, res) => {
    try {
        const { text, systemPrompt } = req.body;
        
        // Оставляем хардкод ключа
        const apiKey = '7374972655d53927687b3f7d8418580c';
        
        // Возвращаем классический универсальный URL
        const apiUrl = 'https://api.kie.ai/v1/chat/completions'; 

        const response = await axios.post(apiUrl, {
            // 🔄 МЕНЯЕМ МОДЕЛЬ на 100% рабочую:
            model: "gpt-3.5-turbo", // Если захочешь мощнее, потом попробуй "gpt-4o"
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

        console.log('\n=== ОТВЕТ ОТ KIE API ===');
        console.log(`Статус-код: ${response.status}`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('========================\n');

        // 1. Если всё прошло успешно:
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return res.json({ success: true, text: response.data.choices[0].message.content });
        } 
        
        // 2. Если Kie.ai прислал ошибку (как в прошлый раз):
        if (response.data && response.data.msg) {
            throw new Error(`Kie.ai: ${response.data.msg}`);
        }
        if (response.data && response.data.error) {
            throw new Error(`Kie.ai: ${response.data.error.message || response.data.error}`);
        }

        throw new Error("Неверный формат ответа от KIE API");

    } catch (error) {
        console.error('[KIE API ERROR]:', error.message);
        // Теперь мы отдаем реальную ошибку на фронтенд, чтобы ты видел её в Alert!
        res.status(500).json({ success: false, error: error.message });
    }
};