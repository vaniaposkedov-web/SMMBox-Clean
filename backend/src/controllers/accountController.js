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

// Сохранение выбранных групп ВК
exports.saveVkGroups = async (req, res) => {
  const { userId, accessToken, groups } = req.body;

  try {
    if (!userId || !groups || groups.length === 0) {
      return res.status(400).json({ error: 'Нет данных для сохранения' });
    }

    // Сохраняем каждую выбранную группу в базу
    const savedAccounts = await Promise.all(groups.map(async (group) => {
      // Ищем, нет ли уже такого аккаунта, чтобы не создавать дубли
      const existing = await prisma.account.findFirst({
        where: { 
          userId: userId,
          provider: 'VK',
          providerAccountId: group.id.toString() 
        }
      });

      if (existing) {
        // Обновляем токен и аватарку, если они изменились
        return prisma.account.update({
          where: { id: existing.id },
          data: { 
            accessToken: accessToken,
            avatarUrl: group.photo_50 || null,
            name: group.name
          }
        });
      } else {
        // Создаем новый аккаунт
        return prisma.account.create({
          data: {
            userId: userId,
            provider: 'VK',
            providerAccountId: group.id.toString(),
            name: group.name,
            accessToken: accessToken,
            avatarUrl: group.photo_50 || null,
            type: 'GROUP' // Помечаем, что это группа
          }
        });
      }
    }));

    res.json({ success: true, count: savedAccounts.length });
  } catch (error) {
    console.error('Ошибка сохранения групп ВК:', error);
    res.status(500).json({ error: 'Ошибка сервера при сохранении аккаунтов' });
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
      const existing = await prisma.account.findFirst({
        where: { userId: userId, provider: 'TELEGRAM', providerAccountId: channel.chatId }
      });

      if (existing) {
        return prisma.account.update({
          where: { id: existing.id },
          data: { avatarUrl: channel.avatar, name: channel.title }
        });
      } else {
        return prisma.account.create({
          data: {
            userId: userId,
            provider: 'TELEGRAM',
            providerAccountId: channel.chatId,
            name: channel.title,
            avatarUrl: channel.avatar,
            type: 'CHANNEL'
          }
        });
      }
    }));

    res.json({ success: true, count: savedAccounts.length });
  } catch (error) {
    console.error('Ошибка сохранения ТГ:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

const axios = require('axios');

// Функция проверки прав бота в подключенных ТГ-каналах
exports.verifyTgAccountsStatus = async (req, res) => {
  const userId = req.user.userId; // Берем из authMiddleware

  try {
    // 1. Ищем все ТГ-аккаунты пользователя
    const tgAccounts = await prisma.account.findMany({
      where: { userId, provider: 'TELEGRAM' }
    });

    if (tgAccounts.length === 0) return res.json({ success: true, message: 'Нет ТГ аккаунтов' });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const botId = botToken.split(':')[0]; // ID бота всегда идет до двоеточия в токене

    // 2. Проверяем каждый аккаунт
    const updates = await Promise.all(tgAccounts.map(async (acc) => {
      try {
        // Запрашиваем статус бота в конкретном чате
        const tgRes = await axios.get(`https://api.telegram.org/bot${botToken}/getChatMember`, {
          params: { chat_id: acc.providerId, user_id: botId }
        });

        const member = tgRes.data.result;

        // Проверяем, админ ли он и может ли писать посты
        const isWorking = member.status === 'administrator' && member.can_post_messages !== false;

        return prisma.account.update({
          where: { id: acc.id },
          data: { 
            isValid: isWorking, 
            errorMsg: isWorking ? null : 'Боту не выданы права на публикацию постов' 
          }
        });

      } catch (error) {
        // Если API вернуло ошибку (например, бота удалили из канала)
        return prisma.account.update({
          where: { id: acc.id },
          data: { 
            isValid: false, 
            errorMsg: 'Бот удален из канала или канал не существует' 
          }
        });
      }
    }));

    res.json({ success: true, updated: updates.length });
  } catch (error) {
    console.error('Ошибка проверки статусов ТГ:', error);
    res.status(500).json({ error: 'Ошибка сервера при проверке статусов' });
  }
};