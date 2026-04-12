const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

exports.generateText = async (req, res) => {
    try {
        const { text, systemPrompt } = req.body;
        
        // Временно хардкодим ключ, пока не разберемся с .env
        const apiKey = '7374972655d53927687b3f7d8418580c';
        
        // 1. Используем актуальную модель из документации Kie.ai
        const modelName = 'gpt-5-2'; // Или 'gemini-3.1-pro'
        
        // 2. Модель указывается прямо в URL
        const apiUrl = `https://api.kie.ai/${modelName}/v1/chat/completions`; 

        const response = await axios.post(apiUrl, {
            // 3. Параметр model отсюда убран, так как он уже есть в URL
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

        // Успешный ответ
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return res.json({ success: true, text: response.data.choices[0].message.content });
        } 
        
        // Обработка ошибок по стандарту Kie
        if (response.data && response.data.error) {
            throw new Error(`Kie.ai: ${response.data.error.message || response.data.error}`);
        }

        throw new Error("Неверный формат ответа от KIE API");

    } catch (error) {
        console.error('[KIE API ERROR]:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};