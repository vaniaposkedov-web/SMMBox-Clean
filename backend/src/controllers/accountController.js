const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

exports.getAccounts = async (req, res) => {
  const { userId } = req.query;
  try {
    const accounts = await prisma.account.findMany({
      where: { userId },
      include: { watermark: true }
    });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения аккаунтов' });
  }
};

exports.deleteAccount = async (req, res) => {
  const { accountId } = req.params;
  try {
    await prisma.account.delete({ where: { id: accountId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка удаления аккаунта' });
  }
};

// === НОВЫЙ МЕТОД: Добавление через токен из ссылки ===
exports.vkAddByToken = async (req, res) => {
  const { userId, tokenUrl } = req.body;

  try {
    // Извлекаем access_token из URL
    const tokenMatch = tokenUrl.match(/access_token=([^&]+)/);
    if (!tokenMatch) {
      return res.status(400).json({ error: 'Токен не найден в ссылке. Скопируйте её целиком.' });
    }
    const access_token = tokenMatch[1];

    // Получаем список групп
    const groupsUrl = `https://api.vk.com/method/groups.get?extended=1&filter=admin&v=5.131&access_token=${access_token}`;
    const groupsResponse = await axios.get(groupsUrl);

    if (groupsResponse.data.error) {
       return res.status(400).json({ error: 'Ошибка ВК: ' + groupsResponse.data.error.error_msg });
    }

    const groups = groupsResponse.data.response.items;

    for (const group of groups) {
      await prisma.account.upsert({
        where: { provider_providerId: { provider: 'vk', providerId: group.id.toString() } },
        update: {
          accessToken: access_token,
          name: group.name,
          avatarUrl: group.photo_200 || group.photo_100 || group.photo_50
        },
        create: {
          userId: userId,
          provider: 'vk',
          providerId: group.id.toString(),
          accessToken: access_token,
          name: group.name,
          avatarUrl: group.photo_200 || group.photo_100 || group.photo_50
        }
      });
    }

    res.json({ success: true, count: groups.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка на сервере' });
  }
};