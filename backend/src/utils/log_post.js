const fs = require('fs');
const path = require('path');

// Создаем папку logs в корне backend, если ее еще нет
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Функция для записи логов публикации
 * @param {string|number} userId - ID пользователя (или 'CRON')
 * @param {string} provider - Соцсеть (VK, TELEGRAM)
 * @param {string} action - Тип события (START, SUCCESS, ERROR, API_RESPONSE)
 * @param {string} message - Краткое сообщение
 * @param {object|string} details - Данные (тело запроса, ответ API, ошибка)
 */
function logPost(userId, provider, action, message, details = {}) {
    const date = new Date();
    // Формируем имя файла по текущей дате (например: posts_2026-04-14.log)
    const dateString = date.toLocaleDateString('en-CA'); 
    const timeString = date.toISOString();

    const logFile = path.join(logsDir, `posts_${dateString}.log`);

    // Безопасный парсинг деталей (защита от циклических ссылок)
    let detailsString = '';
    if (typeof details === 'object') {
        try {
            detailsString = JSON.stringify(details);
        } catch (e) {
            detailsString = '[Невозможно сериализовать объект]';
        }
    } else {
        detailsString = String(details);
    }

    const logLine = `[${timeString}] [USER:${userId || 'UNKNOWN'}] [${provider}] [${action}] ${message} | DETAILS: ${detailsString}\n`;

    // Асинхронно пишем в файл (не блокируя основной поток сервера)
    fs.appendFile(logFile, logLine, (err) => {
        if (err) console.error('[LOGGER FATAL] Не удалось записать файл лога:', err);
    });

    // Дублируем в консоль для удобства мониторинга (Docker/TimeWeb)
    if (action === 'ERROR') {
        console.error(`🔴 [POST ERROR] User:${userId} | ${provider} | ${message}`);
    } else if (action === 'SUCCESS') {
        console.log(`🟢 [POST SUCCESS] User:${userId} | ${provider} | ${message}`);
    } else {
        console.log(`🔵 [POST INFO] User:${userId} | ${provider} | ${message}`);
    }
}

module.exports = { logPost };