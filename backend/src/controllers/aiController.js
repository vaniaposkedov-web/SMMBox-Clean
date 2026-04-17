const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

exports.generateText = async (req, res) => {
    try {
        const { text, systemPrompt } = req.body;
        
        const apiKey = '7374972655d53927687b3f7d8418580c';
        
        // Возвращаем рабочую модель, которая была до моих правок!
        const modelName = 'gpt-5-2'; 
        
        const apiUrl = `https://api.kie.ai/${modelName}/v1/chat/completions`; 

        const response = await axios.post(apiUrl, {
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

        // 1. Успешный ответ
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const generatedText = response.data.choices[0].message.content;

            // --- СОХРАНЕНИЕ ЛОГА ИИ В БАЗУ ДАННЫХ ---
            const userId = req.user?.userId || req.user?.id;
            if (userId) {
                await prisma.aiLog.create({
                    data: {
                        userId: String(userId),
                        prompt: `СИСТЕМНЫЙ ПРОМПТ:\n${systemPrompt}\n\nТЕКСТ КЛИЕНТА:\n${text}`,
                        result: generatedText
                    }
                });
            }
            // ----------------------------------------

            return res.json({ success: true, text: generatedText });
        } 
        
        // 2. Обработка ошибки формата "msg" (как раз та, что у тебя вылезла)
        if (response.data && response.data.msg) {
            throw new Error(`Kie.ai: ${response.data.msg}`);
        }

        // 3. Обработка стандартной ошибки формата "error"
        if (response.data && response.data.error) {
            throw new Error(`Kie.ai: ${response.data.error.message || response.data.error}`);
        }

        throw new Error("Неверный формат ответа от KIE API");

    } catch (error) {
        console.error('[KIE API ERROR]:', error.message);
        res.status(500).json({ success: false, error: 'Сервера пока что заняты' });
    }
};