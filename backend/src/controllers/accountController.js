// Используем встроенный fetch (Node 18+)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Обработка возврата от ВКонтакте (OAuth Callback)
exports.vkCallback = async (req, res) => {
  const { code, error, error_description } = req.query;

  // Если пользователь нажал "Отмена"
  if (error) {
    return res.send(`<script>window.opener.postMessage({ type: 'VK_AUTH_ERROR', error: '${error_description}' }, '*'); window.close();</script>`);
  }

  try {
    const clientId = process.env.VK_APP_ID;
    const clientSecret = process.env.VK_SECURE_KEY;
    const redirectUri = process.env.VK_REDIRECT_URI; // "https://smmdeck.ru/api/accounts/vk/callback"

    // 1. Обмениваем временный код на бессрочный access_token
    const tokenRes = await fetch(`https://oauth.vk.com/access_token?client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${redirectUri}&code=${code}`);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return res.send(`<script>window.opener.postMessage({ type: 'VK_AUTH_ERROR', error: '${tokenData.error_description}' }, '*'); window.close();</script>`);
    }

    const access_token = tokenData.access_token;

    // 2. Получаем список групп, где пользователь является админом или редактором
    // filter=admin,editor гарантирует, что мы не получим группы, где он просто подписчик
    const groupsRes = await fetch(`https://api.vk.com/method/groups.get?extended=1&filter=admin,editor&access_token=${access_token}&v=5.199`);
    const groupsData = await groupsRes.json();

    if (groupsData.error) {
      return res.send(`<script>window.opener.postMessage({ type: 'VK_AUTH_ERROR', error: '${groupsData.error.error_msg}' }, '*'); window.close();</script>`);
    }

    // Это массив объектов с группами (id, name, photo_50 и т.д.)
    const groups = groupsData.response.items;

    // 3. Формируем HTML, который отправит данные в родительское окно (на фронтенд) и закроет попап
    const html = `
      <script>
        window.opener.postMessage({
          type: 'VK_GROUPS_LOADED',
          payload: {
            accessToken: '${access_token}',
            groups: ${JSON.stringify(groups)}
          }
        }, '*');
        window.close();
      </script>
    `;
    
    // Отдаем HTML-скрипт в браузер
    res.send(html);

  } catch (err) {
    console.error('Ошибка OAuth ВК:', err);
    res.send(`<script>window.opener.postMessage({ type: 'VK_AUTH_ERROR', error: 'Internal Server Error' }, '*'); window.close();</script>`);
  }
};

exports.saveVkGroups = async (req, res) => {
  const { userId, accessToken, groups } = req.body;

  try {
    if (!userId || !groups || groups.length === 0) {
      return res.status(400).json({ error: 'Нет данных для сохранения' });
    }

    const savedAccounts = await Promise.all(groups.map(async (group) => {
      const safeProviderId = String(group.id); // ЗАЩИТА: приводим ID к строке

      const existing = await prisma.account.findFirst({
        where: { 
          userId: String(userId),
          provider: 'VK',
          providerId: safeProviderId 
        }
      });

      if (existing) {
        return prisma.account.update({
          where: { id: existing.id },
          data: { 
            accessToken: accessToken || '',
            avatarUrl: group.photo_50 || null,
            name: group.name || 'Без названия'
          }
        });
      } else {
        return prisma.account.create({
          data: {
            userId: String(userId),
            provider: 'VK',
            providerId: safeProviderId,
            name: group.name || 'Без названия',
            accessToken: accessToken || '',
            avatarUrl: group.photo_50 || null
          }
        });
      }
    }));

    res.json({ success: true, count: savedAccounts.length });
  } catch (error) {
    console.error('=== ОШИБКА СОХРАНЕНИЯ ВК ===', error);
    res.status(500).json({ error: 'Ошибка сервера при сохранении ВК', details: error.message });
  }
};


// Сохранение выбранных Telegram-каналов
exports.saveTgAccounts = async (req, res) => {
  const { userId, channels } = req.body;

  try {
    if (!userId || !channels || channels.length === 0) {
      return res.status(400).json({ error: 'Нет данных для сохранения' });
    }

    const savedAccounts = await Promise.all(channels.map(async (channel) => {
      const safeProviderId = String(channel.chatId); // ЗАЩИТА

      const existing = await prisma.account.findFirst({
        where: { userId: String(userId), provider: 'TELEGRAM', providerId: safeProviderId }
      });

      if (existing) {
        return prisma.account.update({
          where: { id: existing.id },
          data: { avatarUrl: channel.avatar || null, name: channel.title || 'Без названия' }
        });
      } else {
        return prisma.account.create({
          data: {
            userId: String(userId),
            provider: 'TELEGRAM',
            providerId: safeProviderId,
            name: channel.title || 'Без названия',
            avatarUrl: channel.avatar || null,
            accessToken: '' 
          }
        });
      }
    }));

    res.json({ success: true, count: savedAccounts.length });
  } catch (error) {
    console.error('=== ОШИБКА СОХРАНЕНИЯ ТГ ===', error);
    res.status(500).json({ error: 'Ошибка сервера при сохранении ТГ', details: error.message });
  }
};
const axios = require('axios');

// Функция проверки прав бота в подключенных ТГ-каналах
exports.verifyTgAccountsStatus = async (req, res) => {
  const { userId } = req.body; // Теперь берем userId явно из тела запроса!

  try {
    if (!userId) {
      return res.status(400).json({ error: 'Не указан userId для проверки' });
    }

    // 1. Ищем все ТГ-аккаунты пользователя
    const tgAccounts = await prisma.account.findMany({
      where: { userId: String(userId), provider: 'TELEGRAM' }
    });

    if (tgAccounts.length === 0) return res.json({ success: true, message: 'Нет ТГ аккаунтов' });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({ error: 'Не настроен токен бота на сервере' });
    }
    const botId = botToken.split(':')[0]; 

    // 2. Проверяем каждый аккаунт
    const updates = await Promise.all(tgAccounts.map(async (acc) => {
      try {
        const tgRes = await axios.get(`https://api.telegram.org/bot${botToken}/getChatMember`, {
          params: { chat_id: acc.providerId, user_id: botId }
        });

        const member = tgRes.data.result;
        const isWorking = member.status === 'administrator' && member.can_post_messages !== false;

        return prisma.account.update({
          where: { id: acc.id },
          data: { 
            isValid: isWorking, 
            errorMsg: isWorking ? null : 'Боту не выданы права на публикацию постов' 
          }
        });

      } catch (error) {
        // === ЛОВИМ НАСТОЯЩУЮ ОШИБКУ ОТ ТЕЛЕГРАМ ===
        console.error('=== ОШИБКА ОТ TELEGRAM API ===');
        console.error('ID Канала:', acc.providerId);
        console.error('Ответ ТГ:', error.response?.data || error.message);
        
        // Если Телеграм вернул ошибку, аккуратно сохраняем её текст
        return await prisma.account.update({
          where: { id: acc.id },
          data: { isValid: false, errorMsg: error.response?.data?.description || 'Бот удален из канала' }
        });
      }
    }));

    res.json({ success: true, updated: updates.length });
  } catch (error) {
    console.error('Ошибка проверки статусов ТГ:', error);
    res.status(500).json({ error: 'Ошибка сервера при проверке статусов' });
  }
};

// Получение списка аккаунтов пользователя
exports.getAccounts = async (req, res) => {
  const { userId } = req.query; // Берем ID из URL параметров
  
  try {
    if (!userId) {
      return res.status(400).json({ error: 'Не указан ID пользователя' });
    }

    const accounts = await prisma.account.findMany({
      where: { userId: userId },
      include: { watermark: true }, // Подтягиваем настройки дизайна
      orderBy: { createdAt: 'desc' }
    });

    res.json(accounts);
  } catch (error) {
    console.error('Ошибка получения аккаунтов:', error);
    res.status(500).json({ error: 'Ошибка сервера при загрузке групп' });
  }
};

// === УДАЛЕНИЕ АККАУНТА (Исправляет ошибку 404) ===
exports.deleteAccount = async (req, res) => {
  const { id } = req.params;
  
  try {
    await prisma.account.delete({
      where: { id: id }
    });
    res.json({ success: true, message: 'Аккаунт успешно удален' });
  } catch (error) {
    console.error('Ошибка при удалении аккаунта:', error);
    res.status(500).json({ error: 'Ошибка сервера при удалении' });
  }
};

// === ПРОВЕРКА СТАТУСОВ (Усиленная защита от 500 ошибки) ===
exports.verifyTgAccountsStatus = async (req, res) => {
  // Ищем ID либо в токене, либо в теле запроса
  const userId = req.user?.userId || req.user?.id || req.body?.userId;

  try {
    if (!userId) return res.status(400).json({ error: 'Не указан userId' });

    const tgAccounts = await prisma.account.findMany({
      where: { userId: String(userId), provider: 'TELEGRAM' }
    });

    if (tgAccounts.length === 0) return res.json({ success: true, message: 'Нет ТГ аккаунтов' });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken || !botToken.includes(':')) {
      console.error('ОШИБКА: TELEGRAM_BOT_TOKEN не настроен в .env');
      return res.status(500).json({ error: 'Бот не настроен на сервере' });
    }
    const botId = botToken.split(':')[0];

    const updates = await Promise.all(tgAccounts.map(async (acc) => {
      try {
        const tgRes = await axios.get(`https://api.telegram.org/bot${botToken}/getChatMember`, {
          params: { chat_id: acc.providerId, user_id: botId }
        });

        const member = tgRes.data.result;
        const isWorking = member.status === 'administrator' && member.can_post_messages !== false;

        return await prisma.account.update({
          where: { id: acc.id },
          data: { isValid: isWorking, errorMsg: isWorking ? null : 'Выдайте боту права админа' }
        });
      } catch (error) {
        // Если Телеграм вернул ошибку, аккуратно сохраняем её текст, а не крашим сервер
        return await prisma.account.update({
          where: { id: acc.id },
          data: { isValid: false, errorMsg: error.response?.data?.description || 'Бот удален из канала' }
        });
      }
    }));

    res.json({ success: true, updated: updates.length });
  } catch (error) {
    console.error('Критическая ошибка проверки ТГ:', error);
    res.status(500).json({ error: 'Ошибка сервера при проверке статусов' });
  }
};