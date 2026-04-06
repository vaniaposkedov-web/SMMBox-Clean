const axios = require('axios'); 
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// В начало файла accountController.js
const KOMOD_TOKEN = process.env.KOMOD_TOKEN || 'f95a39aab8bab90765151d1f50d8e4b6d359a019';
const KOMOD_BASE_URL = 'https://kom-od.ru/api/v1';

// Новый метод для синхронизации аккаунтов и групп через Komod
exports.syncVkKomod = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Получаем список аккаунтов (профилей) из Komod
    const accRes = await axios.get(`${KOMOD_BASE_URL}/account`, {
      headers: { 'Access-Token': KOMOD_TOKEN }
    });

    if (!accRes.data.success) {
      return res.status(400).json({ error: 'Ошибка получения аккаунтов от шлюза' });
    }

    // 2. Получаем список групп из Komod
    const groupRes = await axios.get(`${KOMOD_BASE_URL}/group`, {
      headers: { 'Access-Token': KOMOD_TOKEN }
    });

    const komodAccounts = accRes.data.data.items || [];
    const komodGroups = groupRes.data.data.items || [];

    // 3. Сохраняем/обновляем группы в нашей базе
    // Мы помечаем их как VK_KOMOD, чтобы отличать от обычных
    for (const group of komodGroups) {
      await prisma.account.upsert({
        where: { 
          provider_providerId: { 
            provider: 'VK', 
            providerId: String(group.id) 
          } 
        },
        update: {
          name: group.title,
          isValid: true,
          accessToken: KOMOD_TOKEN, // Храним токен шлюза для идентификации
          errorMsg: null
        },
        create: {
          userId: userId,
          provider: 'VK',
          providerId: String(group.id),
          name: group.title,
          accessToken: KOMOD_TOKEN,
          avatarUrl: '', // В API шлюза аватарок нет, можно оставить пустой или затычку
          isValid: true
        }
      });
    }

    res.json({ success: true, count: komodGroups.length });
  } catch (error) {
    console.error('Komod Sync Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Ошибка при синхронизации со шлюзом' });
  }
};


// Добавление новой группы в шлюз Komod
exports.addVkKomodGroup = async (req, res) => {
  try {
    const { url, title } = req.body;
    
    // 1. Отправляем запрос в Komod
    const response = await axios.post(`${KOMOD_BASE_URL}/group`, {
      url: url,
      title: title || 'Новая группа ВК',
      join_to_group: true
    }, {
      headers: { 'Access-Token': KOMOD_TOKEN }
    });

    if (response.data && response.data.success === false) {
      return res.status(400).json({ error: 'Ошибка шлюза: ' + JSON.stringify(response.data.errors) });
    }

    // 2. Если добавилось успешно, сразу вызываем синхронизацию, 
    // чтобы группа сохранилась в нашу базу данных и вывелась на экран
    await exports.syncVkKomod(req, res);
    
  } catch (error) {
    console.error('Komod Add Group Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Ошибка при добавлении группы в шлюз' });
  }
};

// Метод для привязки нового аккаунта по Hash (если шлюз выдал ссылку)
exports.confirmVkKomod = async (req, res) => {
  try {
    const { hash } = req.body;
    const response = await axios.post(`${KOMOD_BASE_URL}/account/confirm-vk`, 
      { hash }, 
      { headers: { 'Access-Token': KOMOD_TOKEN } }
    );
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка подтверждения аккаунта' });
  }
};

exports.vkCallback = async (req, res) => {
  const { code, error, error_description } = req.query;
  if (error) return res.send(`<script>window.opener.postMessage({ type: 'VK_AUTH_ERROR', error: '${error_description}' }, '*'); window.close();</script>`);
  try {
    const clientId = process.env.VK_APP_ID;
    const clientSecret = process.env.VK_SECURE_KEY;
    const redirectUri = process.env.VK_REDIRECT_URI;
    const tokenRes = await fetch(`https://oauth.vk.com/access_token?client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${redirectUri}&code=${code}`);
    const tokenData = await tokenRes.json();
    if (tokenData.error) return res.send(`<script>window.opener.postMessage({ type: 'VK_AUTH_ERROR', error: '${tokenData.error_description}' }, '*'); window.close();</script>`);
    const access_token = tokenData.access_token;
    const userRes = await fetch(`https://api.vk.com/method/users.get?fields=photo_100&access_token=${access_token}&v=5.199`);
    const userData = await userRes.json();
    const vkUser = userData.response[0];
    const groupsRes = await fetch(`https://api.vk.com/method/groups.get?extended=1&filter=admin,editor&access_token=${access_token}&v=5.199`);
    const groupsData = await groupsRes.json();
    const groups = groupsData.response ? groupsData.response.items : [];
    const html = `<script>window.opener.postMessage({ type: 'VK_GROUPS_LOADED', payload: { accessToken: '${access_token}', groups: ${JSON.stringify(groups)}, profile: ${JSON.stringify(vkUser)} } }, '*'); window.close();</script>`;
    res.send(html);
  } catch (err) { res.send(`<script>window.opener.postMessage({ type: 'VK_AUTH_ERROR', error: 'Internal Server Error' }, '*'); window.close();</script>`); }
};

exports.linkSocialProfile = async (req, res) => {
  try {
    const { userId, provider, providerAccountId, name, avatarUrl, accessToken } = req.body;

    
    const existingProfile = await prisma.socialProfile.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: String(providerAccountId) } }
    });

    if (existingProfile && existingProfile.userId !== String(userId)) {
      return res.status(400).json({ success: false, error: 'Этот профиль уже привязан к другому аккаунту' });
    }

    const profile = await prisma.socialProfile.upsert({
      where: { provider_providerAccountId: { provider, providerAccountId: String(providerAccountId) } },
      update: { name, avatarUrl, accessToken },
      create: { userId: String(userId), provider, providerAccountId: String(providerAccountId), name, avatarUrl, accessToken }
    });
    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

exports.getProfiles = async (req, res) => {
  const { userId } = req.query;
  try {
    const profiles = await prisma.socialProfile.findMany({ where: { userId: String(userId) }, include: { accounts: { include: { watermark: true } } }, orderBy: { createdAt: 'asc' } });
    res.json({ success: true, profiles });
  } catch (error) { res.status(500).json({ error: 'Ошибка загрузки' }); }
};

exports.saveVkGroupWithToken = async (req, res) => {
  const { userId, groupLink, accessToken } = req.body;
  try {
    if (!userId || !groupLink || !accessToken) return res.status(400).json({ error: 'Заполните поля' });
    let groupId = groupLink.replace(/^(?:https?:\/\/)?(?:www\.|m\.)?vk\.com\//i, '').split('/')[0].split('?')[0].split('#')[0].trim();

    const vkRes = await axios.get(`https://api.vk.com/method/groups.getById`, { params: { group_id: groupId, access_token: accessToken, v: '5.131' } });
    if (vkRes.data.error) return res.status(400).json({ error: `Ошибка ключа ВК: ${vkRes.data.error.error_msg}` });
    
    const group = vkRes.data.response[0];
    if (!group || !group.id) return res.status(400).json({ error: 'Группа не найдена' });

    const safeProviderId = String(group.id);
    const isTaken = await prisma.account.findFirst({ where: { provider: 'VK', providerId: safeProviderId } });
    if (isTaken && isTaken.userId !== String(userId)) return res.status(400).json({ error: `Сообщество привязано к другому пользователю!` });

    const currentUser = await prisma.user.findUnique({ where: { id: String(userId) } });
    const currentAccountsCount = await prisma.account.count({ where: { userId: String(userId) } });
    if (!isTaken && !currentUser.isPro && currentAccountsCount >= 10) return res.status(403).json({ error: 'Лимит 10 аккаунтов. Нужен PRO.' });

    const userProfile = await prisma.socialProfile.findFirst({ where: { userId: String(userId), provider: 'VK' } });

    if (isTaken) {
      await prisma.account.update({ where: { id: isTaken.id }, data: { accessToken, avatarUrl: group.photo_50, name: group.name, isValid: true, errorMsg: null, profileId: userProfile ? userProfile.id : null } });
    } else {
      await prisma.account.create({ data: { userId: String(userId), profileId: userProfile ? userProfile.id : null, provider: 'VK', providerId: safeProviderId, name: group.name, accessToken, avatarUrl: group.photo_50 } });
    }
    res.json({ success: true, group: { name: group.name, avatar: group.photo_50 } });
  } catch (error) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
};

exports.saveTgAccounts = async (req, res) => {
  const { userId, channels } = req.body;
  try {
    if (!userId || !channels || channels.length === 0) return res.status(400).json({ error: 'Нет данных' });
    let tgProfile = await prisma.socialProfile.findFirst({ where: { userId: String(userId), provider: 'TELEGRAM' } });
    if (!tgProfile) tgProfile = await prisma.socialProfile.create({ data: { userId: String(userId), provider: 'TELEGRAM', providerAccountId: String(userId), name: 'Telegram Профиль' } });
    const currentUser = await prisma.user.findUnique({ where: { id: String(userId) } });
    const currentAccountsCount = await prisma.account.count({ where: { userId: String(userId) } });
    if (!currentUser.isPro && (currentAccountsCount + channels.length) > 10) return res.status(403).json({ error: `Лимит 10 аккаунтов.` });
    for (const channel of channels) {
      const safeProviderId = String(channel.chatId);
      const isTaken = await prisma.account.findFirst({ where: { provider: 'TELEGRAM', providerId: safeProviderId } });
      if (isTaken && isTaken.userId !== String(userId)) return res.status(400).json({ error: `Канал уже привязан к другому пользователю!` });
    }
    const savedAccounts = await Promise.all(channels.map(async (channel) => {
      const safeProviderId = String(channel.chatId); 
      const existing = await prisma.account.findFirst({ where: { userId: String(userId), provider: 'TELEGRAM', providerId: safeProviderId } });
      if (existing) {
        return prisma.account.update({ where: { id: existing.id }, data: { avatarUrl: channel.avatar || null, name: channel.title || 'Без названия', profileId: tgProfile.id } });
      } else {
        return prisma.account.create({ data: { userId: String(userId), provider: 'TELEGRAM', providerId: safeProviderId, name: channel.title || 'Без названия', avatarUrl: channel.avatar || null, accessToken: '', profileId: tgProfile.id } });
      }
    }));
    res.json({ success: true, count: savedAccounts.length });
  } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
};

exports.saveVkGroups = async (req, res) => {
  const { userId, accessToken, groups } = req.body;
  try {
    if (!userId || !groups || groups.length === 0) return res.status(400).json({ error: 'Нет данных' });
    const currentUser = await prisma.user.findUnique({ where: { id: String(userId) } });
    const currentAccountsCount = await prisma.account.count({ where: { userId: String(userId) } });
    if (!currentUser.isPro && (currentAccountsCount + groups.length) > 10) return res.status(403).json({ error: `Лимит 10 аккаунтов.` });
    let vkProfile = await prisma.socialProfile.findFirst({ where: { userId: String(userId), provider: 'VK' } });
    const savedAccounts = await Promise.all(groups.map(async (group) => {
      const safeProviderId = String(group.id); 
      const existing = await prisma.account.findFirst({ where: { userId: String(userId), provider: 'VK', providerId: safeProviderId } });
      if (existing) {
        return prisma.account.update({ where: { id: existing.id }, data: { accessToken: accessToken || '', avatarUrl: group.photo_50 || null, name: group.name || 'Без названия', profileId: vkProfile?.id } });
      } else {
        return prisma.account.create({ data: { userId: String(userId), provider: 'VK', providerId: safeProviderId, name: group.name || 'Без названия', accessToken: accessToken || '', avatarUrl: group.photo_50 || null, profileId: vkProfile?.id } });
      }
    }));
    res.json({ success: true, count: savedAccounts.length });
  } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
};

exports.getAccounts = async (req, res) => {
  const { userId } = req.query; 
  try {
    if (!userId) return res.status(400).json({ error: 'Не указан ID пользователя' });
    const accounts = await prisma.account.findMany({ where: { userId: userId }, include: { watermark: true }, orderBy: { createdAt: 'desc' } });
    res.json(accounts);
  } catch (error) { res.status(500).json({ error: 'Ошибка сервера при загрузке групп' }); }
};

exports.deleteAccount = async (req, res) => {
  const { id } = req.params;
  try { await prisma.account.delete({ where: { id: id } }); res.json({ success: true }); } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
};

exports.verifyTgAccountsStatus = async (req, res) => {
  const userId = req.user?.userId || req.user?.id || req.body?.userId;
  try {
    if (!userId) return res.status(400).json({ error: 'Не указан userId' });
    const tgAccounts = await prisma.account.findMany({ where: { userId: String(userId), provider: 'TELEGRAM' } });
    if (tgAccounts.length === 0) return res.json({ success: true });
    let botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    botToken = botToken.replace(/['"]/g, '').trim();
    if (!botToken) return res.status(500).json({ error: 'Бот не настроен на сервере' });
    const botId = botToken.split(':')[0];
    const updates = await Promise.all(tgAccounts.map(async (acc) => {
      try {
        if (!acc.providerId) throw new Error('Фантомный аккаунт');
        const tgRes = await axios.get(`https://api.telegram.org/bot${botToken}/getChatMember`, { params: { chat_id: acc.providerId, user_id: botId } });
        const member = tgRes.data.result;
        const isWorking = member.status === 'administrator' || member.status === 'creator';
        return await prisma.account.update({ where: { id: acc.id }, data: { isValid: isWorking, errorMsg: isWorking ? null : 'Бот должен быть администратором' } });
      } catch (error) { return await prisma.account.update({ where: { id: acc.id }, data: { isValid: false, errorMsg: 'Ошибка связи с Telegram' } }); }
    }));
    res.json({ success: true, updated: updates.length });
  } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
};

exports.saveAccountDesign = async (req, res) => {
  const { id } = req.params;
  const { signature, watermark } = req.body;
  try {
    if (signature !== undefined) await prisma.account.update({ where: { id: id }, data: { signature: signature } });
    if (watermark === null) {
      try { await prisma.watermark.delete({ where: { accountId: id } }); } catch(e) {} 
    } else if (watermark !== undefined) {
      await prisma.watermark.upsert({
        where: { accountId: id },
        update: { type: watermark.type || 'text', text: watermark.text || '', image: watermark.image || null, position: watermark.position || 'br', opacity: Number(watermark.opacity || 90), size: Number(watermark.size || 100), angle: Number(watermark.angle || 0), textColor: watermark.textColor || '#FFFFFF', bgColor: watermark.bgColor || '#000000', hasBackground: watermark.hasBackground !== false, x: watermark.x !== undefined ? Number(watermark.x) : null, y: watermark.y !== undefined ? Number(watermark.y) : null },
        create: { accountId: id, type: watermark.type || 'text', text: watermark.text || '', image: watermark.image || null, position: watermark.position || 'br', opacity: Number(watermark.opacity || 90), size: Number(watermark.size || 100), angle: Number(watermark.angle || 0), textColor: watermark.textColor || '#FFFFFF', bgColor: watermark.bgColor || '#000000', hasBackground: watermark.hasBackground !== false, x: watermark.x !== undefined ? Number(watermark.x) : null, y: watermark.y !== undefined ? Number(watermark.y) : null }
      });
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
};

exports.getGlobalSettings = async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  try {
    const user = await prisma.user.findUnique({ where: { id: String(userId) }, include: { globalWatermark: true } });
    res.json({ success: true, signature: user?.globalSignature || '', watermark: user?.globalWatermark || null });
  } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
};

exports.saveGlobalSettings = async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const { signature, watermark } = req.body;
  try {
    if (signature !== undefined) await prisma.user.update({ where: { id: String(userId) }, data: { globalSignature: signature } });
    if (watermark === null) {
      try { await prisma.globalWatermark.delete({ where: { userId: String(userId) } }); } catch(e) {} 
    } else if (watermark !== undefined) {
      await prisma.globalWatermark.upsert({
        where: { userId: String(userId) },
        update: { type: watermark.type || 'text', text: watermark.text || '', image: watermark.image || null, position: watermark.position || 'br', opacity: Number(watermark.opacity || 90), size: Number(watermark.size || 100), angle: Number(watermark.angle || 0), textColor: watermark.textColor || '#FFFFFF', bgColor: watermark.bgColor || '#000000', hasBackground: watermark.hasBackground !== false, x: watermark.x !== undefined ? Number(watermark.x) : null, y: watermark.y !== undefined ? Number(watermark.y) : null },
        create: { userId: String(userId), type: watermark.type || 'text', text: watermark.text || '', image: watermark.image || null, position: watermark.position || 'br', opacity: Number(watermark.opacity || 90), size: Number(watermark.size || 100), angle: Number(watermark.angle || 0), textColor: watermark.textColor || '#FFFFFF', bgColor: watermark.bgColor || '#000000', hasBackground: watermark.hasBackground !== false, x: watermark.x !== undefined ? Number(watermark.x) : null, y: watermark.y !== undefined ? Number(watermark.y) : null }
      });
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Ошибка' }); }
};

exports.scanTgChannels = async (req, res) => {
  const { botToken } = req.body;
  const userId = req.user?.userId || req.user?.id;
  try {
    if (!botToken) return res.status(400).json({ error: 'Укажите токен бота' });
    const token = botToken.replace(/['"]/g, '').trim();
    const existingAccounts = await prisma.account.findMany({ where: { userId: String(userId), provider: 'TELEGRAM' }, select: { providerId: true } });
    const existingIds = new Set(existingAccounts.map(a => a.providerId));
    await axios.get(`https://api.telegram.org/bot${token}/deleteWebhook`);
    const updatesRes = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`);
    const updates = updatesRes.data.result;
    if (!updates || updates.length === 0) return res.json({ success: true, channels: [] }); 
    const uniqueChats = new Map();
    for (const update of updates) {
      let chat = null;
      if (update.my_chat_member) chat = update.my_chat_member.chat;
      if (update.message) chat = update.message.chat;
      if (update.channel_post) chat = update.channel_post.chat;
      if (chat && (chat.type === 'channel' || chat.type === 'group' || chat.type === 'supergroup')) {
          const chatIdStr = String(chat.id);
          if (!existingIds.has(chatIdStr)) uniqueChats.set(chatIdStr, chat);
      }
    }
    const channels = [];
    for (const [chatId, chatObj] of uniqueChats.entries()) {
        try {
            const chatRes = await axios.get(`https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`);
            const fullChat = chatRes.data.result;
            let avatarUrl = null;
            if (fullChat.photo?.small_file_id) {
                const fileRes = await axios.get(`https://api.telegram.org/bot${token}/getFile?file_id=${fullChat.photo.small_file_id}`);
                avatarUrl = `https://api.telegram.org/file/bot${token}/${fileRes.data.result.file_path}`;
            }
            channels.push({ chatId: chatId, title: fullChat.title || fullChat.username || 'Без названия', username: fullChat.username ? `@${fullChat.username}` : '', avatar: avatarUrl });
        } catch (e) {}
    }
    res.json({ success: true, channels });
  } catch (error) { res.status(500).json({ error: 'Не удалось просканировать Telegram.' }); }
};

exports.verifyVkAccountsStatus = async (req, res) => {
  const userId = req.user?.userId || req.user?.id || req.body?.userId;
  try {
    if (!userId) return res.status(400).json({ error: 'Не указан userId' });
    const vkAccounts = await prisma.account.findMany({ where: { userId: String(userId), provider: 'VK' } });
    if (vkAccounts.length === 0) return res.json({ success: true, message: 'Нет ВК аккаунтов' });
    const updates = await Promise.all(vkAccounts.map(async (acc) => {
      try {
        const vkRes = await axios.get(`https://api.vk.com/method/groups.getById`, { params: { group_id: acc.providerId, access_token: acc.accessToken, v: '5.131' } });
        if (vkRes.data.error) return await prisma.account.update({ where: { id: acc.id }, data: { isValid: false, errorMsg: 'Ключ доступа недействителен.' } });
        else return await prisma.account.update({ where: { id: acc.id }, data: { isValid: true, errorMsg: null } });
      } catch (error) { return await prisma.account.update({ where: { id: acc.id }, data: { isValid: false, errorMsg: 'Ошибка проверки ВК' } }); }
    }));
    res.json({ success: true, updated: updates.length });
  } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
};

exports.deleteSocialProfile = async (req, res) => {
  try {
    // Получаем ID пользователя из токена (защита от удаления чужих профилей)
    const userId = req.user?.userId || req.user?.id;
    const profileId = req.params.id;

    if (!userId) return res.status(401).json({ error: 'Не авторизован' });

    // 1. Ищем профиль в базе
    const profile = await prisma.socialProfile.findUnique({
      where: { id: profileId }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Профиль не найден' });
    }

    // 2. Проверяем, принадлежит ли профиль текущему пользователю
    if (profile.userId !== String(userId)) {
      return res.status(403).json({ error: 'У вас нет прав на удаление этого профиля' });
    }

    // 3. Удаляем профиль. (Благодаря Cascade все его группы и каналы удалятся сами)
    await prisma.socialProfile.delete({
      where: { id: profileId }
    });

    res.json({ success: true, message: 'Профиль успешно отключен' });
  } catch (error) {
    console.error('Ошибка при удалении профиля:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера при удалении' });
  }
};

exports.getVkManagedGroups = async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const { profileId } = req.query; // Получаем ID профиля из запроса

  try {
    if (!profileId) return res.status(400).json({ error: 'Не указан ID профиля' });

    // 1. Ищем конкретный профиль ВК пользователя
    const profile = await prisma.socialProfile.findFirst({
      where: { id: profileId, userId: String(userId), provider: 'VK' }
    });

    if (!profile || !profile.accessToken) {
      return res.status(400).json({ error: 'Профиль ВК не найден или отсутствует токен доступа.' });
    }

    // 2. Запрашиваем группы из ВК API
    const groupsRes = await axios.get('https://api.vk.com/method/groups.get', {
      params: { extended: 1, filter: 'admin,editor', access_token: profile.accessToken, v: '5.199' }
    });

    if (groupsRes.data.error) {
      return res.status(400).json({ error: `Ошибка VK API: ${groupsRes.data.error.error_msg}` });
    }

    // 3. Отправляем список
    const groups = groupsRes.data.response ? groupsRes.data.response.items : [];
    res.json({ success: true, groups });

  } catch (error) {
    console.error('Ошибка при получении групп ВК:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера при загрузке групп.' });
  }
};


exports.vkGroupCallback = async (req, res) => {
  const { code, state, error, error_description } = req.query;
  
  if (error) {
    return res.send(`<script>window.opener.postMessage({ type: 'VK_GROUP_ERROR', error: '${error_description}' }, '*'); window.close();</script>`);
  }

  try {
    const clientId = process.env.VK_APP_ID;
    const clientSecret = process.env.VK_SECURE_KEY;
    
    // Формируем ссылку, которая должна ТОЧНО совпадать с той, что отправил фронтенд
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const redirectUri = `${protocol}://${req.headers.host}/api/accounts/vk/group-callback`;
    
    // Мы передали ID юзера и профиля через параметр state
    const [userId, profileId] = (state || '').split('_');

    // Меняем временный код на вечные токены групп
    const tokenRes = await axios.get(`https://oauth.vk.com/access_token`, {
      params: { client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code }
    });

    if (tokenRes.data.error) {
      return res.send(`<script>window.opener.postMessage({ type: 'VK_GROUP_ERROR', error: '${tokenRes.data.error_description}' }, '*'); window.close();</script>`);
    }

    const tokensData = tokenRes.data; 
    let savedCount = 0;

    // Ищем профиль ВК
    let targetProfileId = profileId;
    if (!targetProfileId || targetProfileId === 'undefined') {
      const vkProfile = await prisma.socialProfile.findFirst({ where: { userId: String(userId), provider: 'VK' } });
      targetProfileId = vkProfile ? vkProfile.id : null;
    }

    // ВКонтакте пришлет объект, где ключи называются access_token_123, access_token_456 и т.д.
    for (const key in tokensData) {
      if (key.startsWith('access_token_')) {
        const groupId = key.replace('access_token_', '');
        const groupToken = tokensData[key];

        // Получаем аватарку и название группы
        const groupInfoRes = await axios.get(`https://api.vk.com/method/groups.getById`, {
          params: { group_id: groupId, access_token: groupToken, v: '5.199' }
        });

        const groupDetails = groupInfoRes.data.response?.[0];
        if (groupDetails) {
          // Сохраняем группу и ее API токен
          await prisma.account.upsert({
            where: { provider_providerId: { provider: 'VK', providerId: String(groupId) } },
            update: { accessToken: groupToken, avatarUrl: groupDetails.photo_50, name: groupDetails.name, profileId: targetProfileId, isValid: true, errorMsg: null },
            create: { userId: String(userId), provider: 'VK', providerId: String(groupId), name: groupDetails.name, accessToken: groupToken, avatarUrl: groupDetails.photo_50, profileId: targetProfileId }
          });
          savedCount++;
        }
      }
    }

    // Сообщаем фронтенду об успехе
    res.send(`<script>window.opener.postMessage({ type: 'VK_GROUP_SUCCESS', count: ${savedCount} }, '*'); window.close();</script>`);

  } catch (err) {
    console.error('Ошибка в vkGroupCallback:', err);
    res.send(`<script>window.opener.postMessage({ type: 'VK_GROUP_ERROR', error: 'Внутренняя ошибка сервера' }, '*'); window.close();</script>`);
  }
};

exports.vkFetchGroupsCallback = async (req, res) => {
  const { code, state, error, error_description } = req.query;
  
  if (error) {
    return res.send(`<script>window.opener.postMessage({ type: 'VK_FETCH_ERROR', error: '${error_description}' }, '*'); window.close();</script>`);
  }

  try {
    const clientId = process.env.VK_APP_ID;
    const clientSecret = process.env.VK_SECURE_KEY;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const redirectUri = `${protocol}://${req.headers.host}/api/accounts/vk/fetch-groups-callback`;

    // 1. Получаем токен пользователя с правом на просмотр групп
    const tokenRes = await axios.get(`https://oauth.vk.com/access_token`, {
      params: { client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code }
    });

    if (tokenRes.data.error) throw new Error(tokenRes.data.error_description);

    // 2. Запрашиваем список групп
    const groupsRes = await axios.get('https://api.vk.com/method/groups.get', {
      params: { extended: 1, filter: 'admin,editor', access_token: tokenRes.data.access_token, v: '5.199' }
    });

    if (groupsRes.data.error) throw new Error(groupsRes.data.error.error_msg);

    const groups = groupsRes.data.response ? groupsRes.data.response.items : [];
    
    // 3. Отправляем список в модальное окно на фронтенд
    res.send(`<script>
      window.opener.postMessage({ type: 'VK_FETCH_SUCCESS', groups: ${JSON.stringify(groups)} }, '*');
      window.close();
    </script>`);

  } catch (err) {
    res.send(`<script>window.opener.postMessage({ type: 'VK_FETCH_ERROR', error: 'Не удалось загрузить группы' }, '*'); window.close();</script>`);
  }
};

exports.saveVkGroupTokens = async (req, res) => {
  // Надежно достаем твой ID
  const userId = req.user?.userId || req.user?.id || req.body.userId;
  const { profileId, groups } = req.body; 

  try {
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });
    if (!groups || groups.length === 0) return res.status(400).json({ error: 'Группы не переданы' });

    let savedCount = 0;

    for (const group of groups) {
      // Сохраняем группу НАПРЯМУЮ, без запросов к ВКонтакте!
      await prisma.account.upsert({
        where: { provider_providerId: { provider: 'VK', providerId: String(group.id) } },
        update: { 
          userId: String(userId), 
          accessToken: group.accessToken, 
          avatarUrl: group.avatarUrl || null, 
          name: group.name || 'Без названия', 
          profileId: profileId,   
          isValid: true, 
          errorMsg: null 
        },
        create: { 
          userId: String(userId), 
          provider: 'VK', 
          providerId: String(group.id), 
          name: group.name || 'Без названия', 
          accessToken: group.accessToken, 
          avatarUrl: group.avatarUrl || null, 
          profileId: profileId    
        }
      });
      savedCount++;
    }
    
    res.json({ success: true, count: savedCount });
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

exports.telegramWebhook = async (req, res) => {
  try {
    const update = req.body;
    
    // 1. МГНОВЕННО отвечаем Telegram, что всё ок, чтобы он не спамил запросами
    res.sendStatus(200);

    // === НОВАЯ НЕПРОБИВАЕМАЯ АВТОРИЗАЦИЯ TELEGRAM (DEEP LINKING) ===
    if (update.message && update.message.text && update.message.text.startsWith('/start bind_')) {
      const userId = update.message.text.split('bind_')[1]; // Достаем ID юзера из ссылки
      const tgUser = update.message.from;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      const providerAccountId = String(tgUser.id);
      const name = `${tgUser.first_name} ${tgUser.last_name || ''}`.trim();
      let avatarUrl = '';
      
      // 1. Пытаемся скачать аватарку пользователя через API Telegram
      if (botToken) {
        try {
          const photosRes = await axios.get(`https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${tgUser.id}&limit=1`);
          if (photosRes.data.result.total_count > 0) {
            const fileId = photosRes.data.result.photos[0][0].file_id;
            const fileRes = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
            avatarUrl = `https://api.telegram.org/file/bot${botToken}/${fileRes.data.result.file_path}`;
          }
        } catch (e) {
          console.log('Не удалось загрузить аватарку пользователя из-за настроек приватности');
        }
      }

      // ЗАЩИТА В БОТЕ: ПРОВЕРЯЕМ, НЕ ПРИВЯЗАН ЛИ УЖЕ ЭТОТ ТГ
      const existingProfile = await prisma.socialProfile.findUnique({
        where: { provider_providerAccountId: { provider: 'TELEGRAM', providerAccountId: providerAccountId } }
      });

      if (existingProfile && existingProfile.userId !== String(userId)) {
        if (botToken) {
          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: tgUser.id,
            text: '❌ Ошибка: Этот Telegram-аккаунт уже привязан к другому профилю на сайте. Пожалуйста, используйте другой Telegram-аккаунт.'
          }).catch(e => console.log('Не удалось отправить сообщение об ошибке в ТГ'));
        }
        return; // Прерываем выполнение!
      }

    
      
      // 2. Создаем или обновляем профиль в базе
      await prisma.socialProfile.upsert({
        where: { provider_providerAccountId: { provider: 'TELEGRAM', providerAccountId: providerAccountId } },
        update: { name, avatarUrl: avatarUrl || undefined, userId: String(userId) }, // avatarUrl обновляем только если нашли
        create: { 
          userId: String(userId), 
          provider: 'TELEGRAM', 
          providerAccountId: providerAccountId, 
          name, 
          avatarUrl, 
          accessToken: '' 
        }
      });

      // 3. Отвечаем пользователю прямо в Телеграм
      if (botToken) {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: tgUser.id,
          text: '✅ Ваш аккаунт Telegram успешно привязан! Вернитесь на сайт и нажмите кнопку "Обновить".'
        }).catch(e => console.log('Не удалось отправить сообщение об успехе в ТГ'));
      }

      return; 
    }
    // === КОНЕЦ БЛОКА АВТОРИЗАЦИИ ===
    // === КОНЕЦ БЛОКА АВТОРИЗАЦИИ ===

    // 2. Проверяем, что это событие изменения статуса бота в чате/канале
    if (update.my_chat_member) {
      const chat = update.my_chat_member.chat; // Инфа о канале
      const from = update.my_chat_member.from; // Инфа о человеке, который добавил бота
      const newStatus = update.my_chat_member.new_chat_member.status;

      // Если бота сделали администратором
      if (newStatus === 'administrator') {
        const telegramUserId = String(from.id);
        const chatId = String(chat.id);
        const chatTitle = chat.title || 'Без названия';

        // Ищем в базе профиль человека, который привязал этот Telegram
        const tgProfile = await prisma.socialProfile.findFirst({
          where: { provider: 'TELEGRAM', providerAccountId: telegramUserId }
        });

        // Если нашли — сохраняем канал в его аккаунт!
        if (tgProfile) {
          const userWithPlan = await prisma.user.findUnique({ where: { id: tgProfile.userId } });
          const currentAccountsCount = await prisma.account.count({ where: { userId: tgProfile.userId } });
          const existingAccount = await prisma.account.findFirst({ where: { provider: 'TELEGRAM', providerId: chatId } });

          // Если канала еще нет в базе, тариф бесплатный и лимит исчерпан — блокируем добавление
          if (!existingAccount && !userWithPlan.isPro && currentAccountsCount >= 10) {
            console.log(`Лимит превышен для ${tgProfile.userId}. Канал ${chatTitle} не добавлен.`);
            return; 
          }

          // Получаем аватарку канала (если есть)
          let avatarUrl = null;
          try {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            const chatRes = await axios.get(`https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`);
            if (chatRes.data.result.photo?.small_file_id) {
              const fileRes = await axios.get(`https://api.telegram.org/bot${token}/getFile?file_id=${chatRes.data.result.photo.small_file_id}`);
              avatarUrl = `https://api.telegram.org/file/bot${token}/${fileRes.data.result.file_path}`;
            }
          } catch (e) { /* Игнорируем ошибку загрузки фото */ }

          await prisma.account.upsert({
            where: { provider_providerId: { provider: 'TELEGRAM', providerId: chatId } },
            update: {
              name: chatTitle,
              avatarUrl: avatarUrl,
              isValid: true,
              errorMsg: null,
              profileId: tgProfile.id,
              userId: tgProfile.userId
            },
            create: {
              userId: tgProfile.userId,
              provider: 'TELEGRAM',
              providerId: chatId,
              name: chatTitle,
              accessToken: '',
              avatarUrl: avatarUrl,
              profileId: tgProfile.id
            }
          });
        }
      } 
      // Если бота удалили из канала — помечаем канал как неактивный
      else if (newStatus === 'left' || newStatus === 'kicked') {
        await prisma.account.updateMany({
          where: { provider: 'TELEGRAM', providerId: String(chat.id) },
          data: { isValid: false, errorMsg: 'Бот удален из канала' }
        });
      }
    }
  } catch (error) {
    console.error('Ошибка в Webhook Telegram:', error);
  }
};