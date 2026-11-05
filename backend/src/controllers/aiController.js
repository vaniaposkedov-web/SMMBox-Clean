const prisma = require('../utils/prisma');
const axios = require('axios');
const { getUserLimits, NO_SUBSCRIPTION_ERROR } = require('../utils/limits');

const DEFAULT_AI_PROMPT = 'Ты профессиональный SMM-маркетолог. Твоя задача: улучшить предоставленный текст поста. Исправь ошибки, сделай текст более вовлекающим, разбей на удобные абзацы и добавь 2-3 подходящих эмодзи. Не выдумывай факты и цены, которых нет в оригинале.';
const MAX_TEXT_LENGTH = 5000;

exports.DEFAULT_AI_PROMPT = DEFAULT_AI_PROMPT;

exports.generateText = async (req, res) => {
    try {
        const text = String(req.body.text || '').trim();
        if (!text) return res.status(400).json({ success: false, error: 'Введите текст' });
        if (text.length > MAX_TEXT_LENGTH) return res.status(400).json({ success: false, error: 'Текст слишком длинный' });

        const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!getUserLimits(currentUser).active) {
            return res.status(403).json({ success: false, error: NO_SUBSCRIPTION_ERROR });
        }

        // Инструкция для нейросети берётся из настроек админки, а не из браузера.
        const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
        const systemPrompt = settings?.aiPrompt || DEFAULT_AI_PROMPT;

        const apiKey = process.env.KIE_API_KEY;
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

        // 1. Успешный ответ
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const generatedText = response.data.choices[0].message.content;

            // --- СОХРАНЕНИЕ ЛОГА ИИ В БАЗУ ДАННЫХ ---
            const userId = req.userId;
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