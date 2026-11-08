const prisma = require('../utils/prisma');
const axios = require('axios');
const { getUserLimits, NO_SUBSCRIPTION_ERROR } = require('../utils/limits');

const DEFAULT_AI_PROMPT = 'Ты профессиональный SMM-маркетолог. Твоя задача: улучшить предоставленный текст поста. Исправь ошибки, сделай текст более вовлекающим, разбей на удобные абзацы и добавь 2-3 подходящих эмодзи. Не выдумывай факты и цены, которых нет в оригинале.';
const MAX_TEXT_LENGTH = 5000;
const MAX_ANSWER_TOKENS = 2000; // Ограничивает расходы на один запрос: пост на сайте короче 1000 символов.
const REQUEST_TIMEOUT_MS = 50 * 1000; // Меньше 60 секунд ожидания у nginx: клиент получит понятный ответ, а не сбой шлюза.
const NOT_CONNECTED_ERROR = 'Улучшение текста пока не подключено.';

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

        // Подойдёт любой сервис с запросами в формате OpenAI: адрес и модель задаются в настройках сервера.
        const apiKey = String(process.env.AI_API_KEY || '').trim();
        if (!apiKey) return res.status(503).json({ success: false, error: NOT_CONNECTED_ERROR });
        const apiUrl = process.env.AI_API_URL || 'https://api.zveno.ai/v1/chat/completions';
        const modelName = process.env.AI_MODEL || 'openai/gpt-4o-mini';

        const response = await axios.post(apiUrl, {
            model: modelName,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ],
            temperature: 0.7,
            max_tokens: MAX_ANSWER_TOKENS
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: REQUEST_TIMEOUT_MS,
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
        
        // 2. Ошибка сервиса: например, неверный ключ или закончился баланс
        if (response.data && response.data.error) {
            throw new Error(`Сервис ИИ: ${response.data.error.message || response.data.error}`);
        }

        throw new Error(`Сервис ИИ вернул неожиданный ответ, код ${response.status}`);

    } catch (error) {
        console.error('[AI API ERROR]:', error.message);
        res.status(500).json({ success: false, error: 'Сервера пока что заняты' });
    }
};