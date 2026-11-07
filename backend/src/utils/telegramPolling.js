// Сайт сам спрашивает у Telegram о новых событиях бота, поэтому Telegram не нужно обращаться к серверу сайта.
// Так подключение каналов работает, даже если входящие сообщения от Telegram до российского сервера не доходят.
const { telegramHttp } = require('./telegramClient');
const { getBotToken } = require('./security');
const { logEvent } = require('./logger');
const { processTelegramUpdate } = require('../controllers/accountController');

const WAIT_FOR_EVENTS_SECONDS = 50;
const ANSWER_MARGIN_MS = 15 * 1000;
const MAX_PAUSE_MS = 60 * 1000;
const FAILURES_BEFORE_ADMIN_LOG = 3;
const WANTED_EVENTS = JSON.stringify(['message', 'my_chat_member']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pollForever = async (api, io) => {
  let offset;
  let failures = 0;
  let removeWebhook = true;

  for (;;) {
    try {
      // Пока у бота задан webhook, Telegram отказывает в опросе.
      if (removeWebhook) {
        await telegramHttp.post(`${api}/deleteWebhook`);
        removeWebhook = false;
      }

      const { data } = await telegramHttp.get(`${api}/getUpdates`, {
        params: { offset, timeout: WAIT_FOR_EVENTS_SECONDS, allowed_updates: WANTED_EVENTS },
        timeout: WAIT_FOR_EVENTS_SECONDS * 1000 + ANSWER_MARGIN_MS,
      });

      if (failures > 0) console.log('Связь с Telegram восстановлена');
      failures = 0;

      for (const update of data.result || []) {
        // Номер сдвигается до обработки: событие, которое вызывает сбой, не должно блокировать все следующие.
        offset = update.update_id + 1;
        await processTelegramUpdate(update, io);
      }
    } catch (error) {
      failures += 1;
      if (error.response?.status === 409) removeWebhook = true;

      // Только текст ошибки: в полном объекте есть адрес запроса с ключом бота.
      if (failures === 1) console.error('Нет связи с Telegram при получении событий бота:', error.message);
      if (failures === FAILURES_BEFORE_ADMIN_LOG) {
        await logEvent(null, 'ERROR', 'TELEGRAM_POLLING', 'Нет связи с Telegram: каналы сейчас не подключаются', error.message);
      }

      await sleep(Math.min(MAX_PAUSE_MS, 1000 * 2 ** failures));
    }
  }
};

const startTelegramPolling = (io) => {
  if (process.env.TELEGRAM_UPDATES !== 'polling') return;

  const botToken = getBotToken();
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN не задан: события бота получать не буду');
    return;
  }

  pollForever(`https://api.telegram.org/bot${botToken}`, io);
};

module.exports = { startTelegramPolling };
