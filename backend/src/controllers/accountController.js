const axios = require('axios'); 
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// В начало файла accountController.js
const KOMOD_TOKEN = process.env.KOMOD_TOKEN || 'f95a39aab8bab90765151d1f50d8e4b6d359a019';
const KOMOD_BASE_URL = 'https://kom-od.ru/api/v1';
const { logEvent } = require('../utils/logger');


// --- УНИВЕРСАЛЬНЫЙ ПАРСЕР ПО СТРУКТУРЕ АЛЕКСЕЯ ---
const extractKomodAvatar = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  
  // Прямая проверка
  const direct = obj.photo_200 || obj.photo_100 || obj.photo_50 || obj.avatar || obj.photo;
  if (direct && typeof direct === 'string' && direct.startsWith('http')) return direct;

  // Парсинг для ГРУПП (фикс Алексея)
  let info = obj.info;
  if (typeof info === 'string') { try { info = JSON.parse(info); } catch(e){} }
  
  if (info) {
    let raw = info.rawData || info.apiGroupData || info.apiUserData;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch(e){} }
    if (raw && typeof raw === 'object') {
      const rawPhoto = raw.photo_200 || raw.photo_100 || raw.photo_50 || raw.photo_max;
      if (rawPhoto) return rawPhoto;
    }
  }

  // Парсинг для ЛИЧНЫХ ПРОФИЛЕЙ (как указал Алексей)
  let apiUser = obj.apiUserData || obj.auth?.apiUserData;
  if (typeof apiUser === 'string') { try { apiUser = JSON.parse(apiUser); } catch(e){} }
  if (apiUser && typeof apiUser === 'object') {
     const userPhoto = apiUser.photo_200 || apiUser.photo_100 || apiUser.photo_50 || apiUser.photo_max;
     if (userPhoto) return userPhoto;
  }

  return null;
};



const extractKomodName = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  
  let info = obj.info;
  if (typeof info === 'string') { try { info = JSON.parse(info); } catch(e) {} }
  
  let apiUser = obj.apiUserData;
  if (typeof apiUser === 'string') { try { apiUser = JSON.parse(apiUser); } catch(e) {} }

  if (info && info.title) return info.title;
  if (info && info.rawData) {
    let raw = info.rawData;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch(e) {} }
    if (raw.name) return raw.name;
  }
  
  const target = apiUser || obj;
  if (target.first_name) return `${target.first_name} ${target.last_name || ''}`.trim();
  
  return obj.name || obj.title || null;
};

// --- МЕТОД ЗАГРУЗКИ (СТРОГО ЧЕРЕЗ KOM-OD API) ---
exports.getKomodGroupsForSelection = async (req, res) => {
  try {
    const profileId = req.query.profileId || req.query.id || req.body?.profileId || req.params?.id;
    const userId = String(req.user?.userId || req.user?.id);

    const profile = await prisma.socialProfile.findFirst({
      where: { id: profileId, userId: userId }
    });

    if (!profile) return res.status(403).json({ error: 'Профиль не найден' });

    try {
      // 1. Получаем список групп аккаунта
      const response = await axios.get(`${KOMOD_BASE_URL}/account/${profile.providerAccountId}/api-groups`, {
        headers: { 'Access-Token': KOMOD_TOKEN }
      });

      let items = [];
      const resData = response.data?.data;
      const resGroups = response.data?.groups;

      if (Array.isArray(resData)) {
          if (resData[0]?.items && Array.isArray(resData[0].items)) items = resData[0].items;
          else items = resData;
      } else if (resData?.items) {
          items = resData.items;
      } else if (resGroups?.items) {
          items = resGroups.items;
      } else if (Array.isArray(resGroups)) {
          items = resGroups;
      }

      // 2. Получаем полный список всех групп шлюза (чтобы гарантированно узнать Kom-od ID)
      let allKomodGroups = [];
      try {
        const allGrpRes = await axios.get(`${KOMOD_BASE_URL}/group`, { headers: { 'Access-Token': KOMOD_TOKEN } });
        const d = allGrpRes.data?.data;
        if (Array.isArray(d)) {
           allKomodGroups = d[0]?.items || d;
        } else if (d?.items) {
           allKomodGroups = d.items;
        }
      } catch (e) {
        console.log('[KOM-OD] Не удалось загрузить словарь всех групп');
      }

      // 3. Обогащаем список фотографиями
      const enrichedItems = await Promise.all(items.map(async (group) => {
        let photo = extractKomodAvatar(group);

        let komodId = null;
        
        // ✅ ЖЕЛЕЗОБЕТОННАЯ ЛОГИКА ОПРЕДЕЛЕНИЯ ВНУТРЕННЕГО ID KOM-OD
        // Ситуация А: Шлюз сразу вернул и системный id, и вк-шный uid
        if (group.id && group.uid && String(group.id).length < 10) {
          komodId = group.id;
        } 
        // Ситуация Б: Шлюз вернул только один ID. Ищем совпадение в общем списке по VK ID
        else {
          const vkIdRaw = String(group.uid || group.group_id || group.id).replace(/\D/g, '');
          if (vkIdRaw) {
             const matched = allKomodGroups.find(g => String(g.uid) === vkIdRaw || String(g.group_id) === vkIdRaw);
             if (matched) {
                komodId = matched.id; // Нашли настоящий системный ID
             }
          }
        }

        // ДЕЛАЕМ ЗАПРОС К ПОЧИНЕННОМУ МЕТОДУ АЛЕКСЕЯ СТРОГО ПО СИСТЕМНОМУ ID (например, 20017)
        if (!photo && komodId) {
          try {
            const detailRes = await axios.get(`${KOMOD_BASE_URL}/group/${komodId}`, {
              headers: { 'Access-Token': KOMOD_TOKEN }
            });
            if (detailRes.data?.success && detailRes.data?.data) {
              photo = extractKomodAvatar(detailRes.data.data);
            }
          } catch (e) {
            console.log(`[KOM-OD] Ошибка получения деталей группы ${komodId}`);
          }
        }

        // Резервный поиск в нашей БД на случай задержек шлюза
        if (!photo) {
           const vkIdRaw = String(group.uid || group.group_id || group.id).replace(/\D/g, '');
           try {
             const existing = await prisma.account.findFirst({
               where: { provider: 'VK', providerId: { endsWith: vkIdRaw } }
             });
             if (existing && existing.avatarUrl && !existing.avatarUrl.includes('ui-avatars')) {
               photo = existing.avatarUrl;
             }
           } catch(e) {}
        }

        // Подшиваем найденное фото на верхний уровень объекта для фронтенда
        if (photo) {
          group.photo_200 = photo;
          group.photo_100 = photo;
          group.photo_50 = photo;
          group.avatar = photo; 
        }

        return group;
      }));

      const authData = response.data?.auth || null;
      return res.json({ success: true, groups: enrichedItems, auth: authData });
      
    } catch (apiError) {
      if (apiError.response && apiError.response.status === 404) {
        return res.json({ 
          success: false, 
          error: 'Этот профиль устарел. Авторизуйте заново.' 
        });
      }
      throw apiError; 
    }

  } catch (error) {
    console.error('Ошибка загрузки сообществ:', error.message);
    res.status(500).json({ error: 'Ошибка API шлюза: ' + error.message });
  }
};







// 2. Исправленный метод добавления группы по ссылке
exports.addVkKomodGroup = async (req, res) => {
  try {
    const { url, title, profileId, avatarUrl } = req.body;
    const userId = String(req.user?.userId || req.user?.id);

    const profile = await prisma.socialProfile.findFirst({
      where: { id: profileId, userId }
    });
    if (!profile) return res.status(404).json({ error: 'Профиль не найден' });

    if (!url || url.includes('null') || url.includes('undefined')) {
      return res.status(400).json({ error: 'Некорректная ссылка на группу' });
    }

    // Извлекаем ID для проверки на дубликаты у других пользователей
    const parsedId = url.split('/').pop().replace('club', '').replace('public', '').replace('event', '');
    const providerId = `group_${parsedId}`;

    // ПРОВЕРКА: Не привязана ли эта группа уже к другому пользователю?
    const existingAcc = await prisma.account.findUnique({
      where: { provider_providerId: { provider: 'VK', providerId: providerId } }
    });

    if (existingAcc && existingAcc.userId !== userId) {
      return res.status(403).json({ error: 'Это сообщество уже привязано к другому пользователю!' });
    }

    // 1. Отправляем в Kom-od
    const params = new URLSearchParams();
    params.append('url', url);
    params.append('title', title || 'Без названия');
    params.append('account_id', profile.providerAccountId);
    params.append('random_account', '0'); 

    try {
      await axios.post(`${KOMOD_BASE_URL}/group`, params, {
        headers: { 'Access-Token': KOMOD_TOKEN, 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: () => true 
      });
    } catch (apiError) {
      console.error('[KOM-OD] Ошибка при добавлении группы в шлюз:', apiError.message);
    }

    // 2. Сохраняем локально (БЕЗ перезаписи userId в блоке update)
    const account = await prisma.account.upsert({
      where: { provider_providerId: { provider: 'VK', providerId: providerId } },
      update: { 
        name: title, 
        avatarUrl: avatarUrl, 
        isValid: true, 
        profileId: profile.id 
        // userId здесь НЕ обновляем, чтобы не "украсть" группу, если она уже существует
      },
      create: {
        userId,
        provider: 'VK',
        providerId,
        name: title,
        avatarUrl: avatarUrl,
        accessToken: KOMOD_TOKEN,
        profileId: profile.id
      }
    });

    res.json({ success: true, account });
  } catch (error) {
    console.error('Ошибка addVkKomodGroup:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};


// 3. Полный исправленный метод синхронизации VK (БЕЗОПАСНЫЙ)
exports.syncVkKomod = async (req, res) => {
  try {
    const userId = String(req.user?.userId || req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });

    // 1. Получаем аккаунты шлюза
    const accRes = await axios.get(`${KOMOD_BASE_URL}/account`, { headers: { 'Access-Token': KOMOD_TOKEN } });
    const allAccountsRaw = accRes.data?.data?.items || [];

    const accountsMap = new Map();
    for (const acc of allAccountsRaw) {
      const uid = String(acc.uid || 'unknown');
      if (!accountsMap.has(uid) || Number(acc.id) > Number(accountsMap.get(uid).id)) {
        accountsMap.set(uid, acc);
      }
    }
    const allAccounts = Array.from(accountsMap.values());

    // 2. Сбор метаданных (аватарки/имена)
    const metaMap = {};
    const groupAvatarsMap = {}; 

    for (const acc of allAccounts) {
      try {
        const detailRes = await axios.get(`${KOMOD_BASE_URL}/account/${acc.id}`, { headers: { 'Access-Token': KOMOD_TOKEN } });
        const data = detailRes.data?.data;
        if (data && data.auth) {
          const auth = typeof data.auth === 'string' ? JSON.parse(data.auth) : data.auth;
          const apiUser = auth.apiUserData; 
          if (apiUser) {
            metaMap[String(acc.id)] = {
              avatar: apiUser.photo_200 || apiUser.photo_max || apiUser.photo_100,
              name: `${apiUser.first_name || ''} ${apiUser.last_name || ''}`.trim()
            };
          }
        }
      } catch (e) {}

      try {
        const groupsRes = await axios.get(`${KOMOD_BASE_URL}/account/${acc.id}/api-groups`, { headers: { 'Access-Token': KOMOD_TOKEN } });
        let items = [];
        const resData = groupsRes.data?.data;
        const resGroups = groupsRes.data?.groups;

        if (Array.isArray(resData)) {
            if (resData[0]?.items && Array.isArray(resData[0].items)) items = resData[0].items;
            else items = resData;
        } else if (resData?.items) {
            items = resData.items;
        } else if (resGroups?.items) {
            items = resGroups.items;
        } else if (Array.isArray(resGroups)) {
            items = resGroups;
        }

        for (const g of items) {
          const gUid = String(g.id || g.group_id || g.uid);
          const gPhoto = extractKomodAvatar(g);
          if (gUid && gPhoto) groupAvatarsMap[gUid] = gPhoto;
        }
      } catch (e) {}
    }

    // 3. Сохранение ПРОФИЛЕЙ (С проверкой на принадлежность)
    const validAccIds = allAccounts.map(a => String(a.id));
    const existingVkProfiles = await prisma.socialProfile.findMany({ where: { userId, provider: 'VK' } });

    for (const p of existingVkProfiles) {
      if (!validAccIds.includes(String(p.providerAccountId))) {
        await prisma.socialProfile.delete({ where: { id: p.id } });
      }
    }

    for (const acc of allAccounts) {
      const pId = String(acc.id);
      
      // БЕЗОПАСНОСТЬ: Если этот профиль уже привязан к ДРУГОМУ пользователю - пропускаем его
      const globalProfile = await prisma.socialProfile.findUnique({
         where: { provider_providerAccountId: { provider: 'VK', providerAccountId: pId } }
      });
      if (globalProfile && globalProfile.userId !== userId) continue;

      const existingProfile = existingVkProfiles.find(p => p.providerAccountId === pId);
      const name = metaMap[pId]?.name || acc.title || existingProfile?.name || 'Профиль ВК';
      let avatar = metaMap[pId]?.avatar;
      
      if (!avatar && existingProfile?.avatarUrl && !existingProfile.avatarUrl.includes('ui-avatars')) {
         avatar = existingProfile.avatarUrl;
      }
      if (!avatar) {
         avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0077FF&color=fff`;
      }

      await prisma.socialProfile.upsert({
        where: { provider_providerAccountId: { provider: 'VK', providerAccountId: pId } },
        update: { name, avatarUrl: avatar }, // userId НЕ обновляем
        create: { userId, provider: 'VK', providerAccountId: pId, name, avatarUrl: avatar, accessToken: KOMOD_TOKEN }
      });
    }

    // 4. Получение ГРУПП
    const grpRes = await axios.get(`${KOMOD_BASE_URL}/group`, { headers: { 'Access-Token': KOMOD_TOKEN } });
    const allGroupsRaw = grpRes.data?.data?.items || [];

    const groupsMap = new Map();
    for (const grp of allGroupsRaw) {
      const urlStr = String(grp.url || '');
      const isProfileByUrl = /^https?:\/\/(www\.)?vk\.com\/id\d+\/?$/i.test(urlStr);
      const isProfileById = String(grp.uid || grp.id) === String(grp.account_id);
      const isProfileByFlag = String(grp.is_profile) === '1' || String(grp.is_profile).toLowerCase() === 'true' || grp.is_profile === true;
      
      const isWall = isProfileByFlag || isProfileByUrl || isProfileById;
      const vkUid = String(grp.uid || grp.id);
      const groupKey = isWall ? `wall_${vkUid}` : `group_${vkUid}`;

      if (!groupsMap.has(groupKey) || Number(grp.id) > Number(groupsMap.get(groupKey).id)) {
        groupsMap.set(groupKey, grp);
      }
    }
    const allGroups = Array.from(groupsMap.values());

    const validGroupProviderIds = [];
    const myProfiles = await prisma.socialProfile.findMany({ where: { userId, provider: 'VK' } });
    const myProfileAccountIds = myProfiles.map(p => String(p.providerAccountId));

    // 5. Сохранение ГРУПП (С защитой от угона)
    for (const grp of allGroups) {
      if (!myProfileAccountIds.includes(String(grp.account_id))) continue;

      const parentProfile = myProfiles.find(p => String(p.providerAccountId) === String(grp.account_id));
      
      const urlStr = String(grp.url || '');
      const isProfileByUrl = /^https?:\/\/(www\.)?vk\.com\/id\d+\/?$/i.test(urlStr);
      const isProfileById = String(grp.uid || grp.id) === String(grp.account_id);
      const isProfileByFlag = String(grp.is_profile) === '1' || String(grp.is_profile).toLowerCase() === 'true' || grp.is_profile === true;
      
      const isWall = isProfileByFlag || isProfileByUrl || isProfileById;
      const vkUid = String(grp.uid || grp.id);
      const providerId = isWall ? `wall_${vkUid}` : `group_${vkUid}`;

      // БЕЗОПАСНОСТЬ: Проверяем, не принадлежит ли группа другому пользователю
      const globalAcc = await prisma.account.findUnique({
         where: { provider_providerId: { provider: 'VK', providerId } }
      });
      if (globalAcc && globalAcc.userId !== userId) continue;

      validGroupProviderIds.push(providerId);

      let finalName = grp.title || grp.name || 'Сообщество';
      let finalAvatar = null;
      
      if (isWall) {
        finalAvatar = parentProfile?.avatarUrl;
      } else {
        finalAvatar = extractKomodAvatar(grp) || groupAvatarsMap[vkUid];

        if (!finalAvatar && grp.id) {
          try {
            const detailGrpRes = await axios.get(`${KOMOD_BASE_URL}/group/${grp.id}`, { headers: { 'Access-Token': KOMOD_TOKEN } });
            if (detailGrpRes.data?.success && detailGrpRes.data?.data) {
              finalAvatar = extractKomodAvatar(detailGrpRes.data.data);
            }
          } catch (e) {}
        }
      }

      const existingAcc = await prisma.account.findUnique({ where: { provider_providerId: { provider: 'VK', providerId } } });
      if (!finalAvatar && existingAcc?.avatarUrl && !existingAcc.avatarUrl.includes('ui-avatars')) {
          finalAvatar = existingAcc.avatarUrl;
      }
      if (!finalAvatar) {
          finalAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(finalName)}&background=0d0f13&color=0077FF&rounded=true`;
      }

      await prisma.account.upsert({
        where: { provider_providerId: { provider: 'VK', providerId } },
        update: { name: finalName, avatarUrl: finalAvatar, isValid: true, profileId: parentProfile.id }, // БЕЗ userId
        create: { userId, provider: 'VK', providerId, name: finalName, avatarUrl: finalAvatar, accessToken: KOMOD_TOKEN, profileId: parentProfile.id }
      });
    }

    // 6. Очистка
    const existingVkAccounts = await prisma.account.findMany({ where: { userId, provider: 'VK' } });
    for (const acc of existingVkAccounts) {
      if (acc.providerId.startsWith('group_') || acc.providerId.startsWith('wall_')) {
        if (!validGroupProviderIds.includes(acc.providerId)) {
          await prisma.account.delete({ where: { id: acc.id } });
        }
      }
    }

    res.json({ success: true, count: validGroupProviderIds.length });
  } catch (error) {
    console.error('Ошибка синхронизации syncVkKomod:', error);
    
    // === ЗАПИСЬ ОШИБКИ В БАЗУ ===
    const userId = String(req.user?.userId || req.user?.id);
    if (userId && userId !== 'undefined') {
      await logEvent(
        userId, 
        'ERROR', 
        'KOMOD_API', 
        'Ошибка при синхронизации ВК', 
        error.response?.data || error.message
      );
    }
    res.status(500).json({ error: 'Ошибка сервера' });
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

exports.confirmVkKomod = async (req, res) => {
  try {
    const { hash } = req.body;
    
    const params = new URLSearchParams();
    params.append('hash', hash);

    const response = await axios.post(
      `${KOMOD_BASE_URL}/account/confirm-vk`,
      params,
      { 
        headers: { 
          'Access-Token': KOMOD_TOKEN,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        validateStatus: function (status) { return status < 500; }
      }
    );

    if (response.data && response.data.success === false) {
      return res.status(400).json({ error: 'Ошибка шлюза: ' + JSON.stringify(response.data.errors) });
    }

    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера при обращении к Kom-od' });
  }
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
  // 1. Пробуем получить ID из req.user (если стоит auth-middleware)
  let userId = req.user?.userId || req.user?.id;

  // 2. Если middleware нет на этом роуте, вручную читаем токен из заголовка!
  if (!userId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
          const jwt = require('jsonwebtoken');
          const token = req.headers.authorization.split(' ')[1];
          const decoded = jwt.decode(token);
          if (decoded) {
              userId = decoded.id || decoded.userId;
          }
      } catch (e) {
          console.error("Ошибка парсинга токена:", e);
      }
  }

  try {
    // Теперь, если фронтенд прислал токен, userId точно найдется
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });

    const accounts = await prisma.account.findMany({ 
      where: { userId: String(userId) }, 
      include: { watermark: true }, 
      orderBy: { createdAt: 'desc' } 
    });
    
    res.json(accounts);
  } catch (error) { 
    console.error('Ошибка getAccounts:', error);
    res.status(500).json({ error: 'Ошибка сервера при загрузке групп' }); 
  }
};

exports.deleteAccount = async (req, res) => {
  const { id } = req.params;
  try {
    const account = await prisma.account.findUnique({ where: { id: id } });

    // Если это аккаунт Kom-od (определяем по токену), нужно удалить его и со шлюза
    if (account && account.provider === 'VK' && account.accessToken === KOMOD_TOKEN) {
      try {
        // Запрашиваем список групп шлюза, чтобы найти внутренний ID (komod-id) для удаления
        const grpRes = await axios.get(`${KOMOD_BASE_URL}/group`, { headers: { 'Access-Token': KOMOD_TOKEN } });
        const allGroups = grpRes.data?.data?.items || [];
        
        // Извлекаем чистый UID/ID из нашего providerId (wall_123 -> 123, group_456 -> 456)
        const rawId = account.providerId.replace('wall_', '').replace('group_', '');
        
        // Ищем группу в ответе шлюза
        const komodGroup = allGroups.find(g => String(g.uid || g.id || g.account_id) === rawId);

        if (komodGroup && komodGroup.id) {
          // [DELETE] https://kom-od.ru/api/v1/group/<id>
          await axios.delete(`${KOMOD_BASE_URL}/group/${komodGroup.id}`, {
            headers: { 'Access-Token': KOMOD_TOKEN }
          });
        }
      } catch (apiError) {
        console.error('Не удалось удалить группу со шлюза Kom-od:', apiError.message);
        // Не блокируем локальное удаление, если шлюз недоступен
      }
    }

    // Удаляем из локальной базы
    await prisma.account.delete({ where: { id: id } }); 
    res.json({ success: true }); 
  } catch (error) { 
    res.status(500).json({ error: 'Ошибка сервера' }); 
  }
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
  const userId = req.user?.userId || req.user?.id;
  try {
    const vkAccounts = await prisma.account.findMany({ where: { userId: String(userId), provider: 'VK' } });
    
    const updates = await Promise.all(vkAccounts.map(async (acc) => {
      // КРИТИЧЕСКИЙ ФИКС: Если это аккаунт шлюза (токен совпадает с KOMOD_TOKEN), 
      // НЕ шлем его в ВК, а просто помечаем как валидный.
      if (acc.accessToken === KOMOD_TOKEN) {
        return prisma.account.update({ where: { id: acc.id }, data: { isValid: true, errorMsg: null } });
      }

      // Обычные аккаунты проверяем как раньше
      try {
        const vkRes = await axios.get(`https://api.vk.com/method/groups.getById`, { 
          params: { group_id: acc.providerId, access_token: acc.accessToken, v: '5.131' } 
        });
        const isValid = !vkRes.data.error;
        return prisma.account.update({ 
          where: { id: acc.id }, 
          data: { isValid, errorMsg: isValid ? null : 'Ключ доступа недействителен' } 
        });
      } catch (e) {
        return prisma.account.update({ where: { id: acc.id }, data: { isValid: false, errorMsg: 'Ошибка связи с ВК' } });
      }
    }));
    res.json({ success: true, updated: updates.length });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка проверки' });
  }
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

// БЕЗОПАСНОЕ СОХРАНЕНИЕ ТОКЕНОВ ГРУПП (Защита от BOLA/IDOR)
exports.saveVkGroupTokens = async (req, res) => {
  const userId = req.user?.userId || req.user?.id || req.body.userId;
  const { profileId, groups } = req.body; 

  try {
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });
    if (!groups || groups.length === 0) return res.status(400).json({ error: 'Группы не переданы' });

    let savedCount = 0;

    for (const group of groups) {
      // БЕЗОПАСНОСТЬ: Проверяем, не занята ли уже эта группа другим пользователем!
      const existingAccount = await prisma.account.findUnique({
        where: { provider_providerId: { provider: 'VK', providerId: String(group.id) } }
      });

      if (existingAccount && existingAccount.userId !== String(userId)) {
        console.warn(`[SECURITY] Попытка перехвата группы ${group.id} пользователем ${userId}`);
        continue; // Строго игнорируем чужую группу
      }

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

    if (req.app.get('io') && global.userSockets) {
       const connectedSockets = global.userSockets.get(String(userId));
       if (connectedSockets) {
         connectedSockets.forEach(socketId => {
           req.app.get('io').to(socketId).emit('ACCOUNTS_UPDATED');
         });
       }
    }
    
    res.json({ success: true, count: savedCount });
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};


exports.addVkKomodProfile = async (req, res) => {
  try {
    const { profileId, avatarUrl, name } = req.body; 
    const userId = String(req.user.userId || req.user.id);

    const profile = await prisma.socialProfile.findFirst({
      where: { id: profileId, userId }
    });
    
    if (!profile) return res.status(404).json({ error: 'Профиль не найден' });

    // Отправляем запрос в шлюз Kom-od
    const params = new URLSearchParams();
    params.append('account_id', profile.providerAccountId);
    params.append('is_profile', '1');

    try {
      await axios.post(`${KOMOD_BASE_URL}/group`, params, {
        headers: { 
          'Access-Token': KOMOD_TOKEN,
          'Content-Type': 'application/x-www-form-urlencoded' 
        }
      });
    } catch (apiError) {
      console.error('Ошибка API шлюза при добавлении профиля:', apiError.response?.data || apiError.message);
    }

    // Обновляем саму аватарку профиля (SocialProfile), если она пришла
    if (avatarUrl && !avatarUrl.includes('ui-avatars')) {
      await prisma.socialProfile.update({
        where: { id: profile.id },
        data: { avatarUrl: avatarUrl, name: name || profile.name }
      });
    }
    

    if (req.app.get('io') && global.userSockets) {
       const connectedSockets = global.userSockets.get(String(userId));
       if (connectedSockets) {
         connectedSockets.forEach(socketId => {
           req.app.get('io').to(socketId).emit('ACCOUNTS_UPDATED');
         });
       }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding komod profile:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

exports.telegramWebhook = async (req, res) => {
  try {
    const update = req.body;
    
    // 1. МГНОВЕННО отвечаем Telegram, что всё ок, чтобы он не спамил запросами
    res.sendStatus(200);

    if (update.message && update.message.text && update.message.text.startsWith('/start bind_')) {
      const userId = update.message.text.split('bind_')[1]; 
      const tgUser = update.message.from;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      const providerAccountId = String(tgUser.id);
      const name = `${tgUser.first_name} ${tgUser.last_name || ''}`.trim();
      let avatarUrl = '';
      
      // === ИСПРАВЛЕНИЕ: БЕЗОПАСНАЯ ЗАГРУЗКА АВАТАРКИ ПОЛЬЗОВАТЕЛЯ ТГ ===
      if (botToken) {
        try {
          const photosRes = await axios.get(`https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${tgUser.id}&limit=1`);
          if (photosRes.data.result.total_count > 0) {
            const fileId = photosRes.data.result.photos[0][0].file_id;
            const fileRes = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
            const tgFileUrl = `https://api.telegram.org/file/bot${botToken}/${fileRes.data.result.file_path}`;
            
            // Скачиваем картинку и переводим в формат base64
            const imageReq = await axios.get(tgFileUrl, { responseType: 'arraybuffer' });
            avatarUrl = `data:image/jpeg;base64,${Buffer.from(imageReq.data).toString('base64')}`;
          }
        } catch (e) {
          console.log('Не удалось загрузить аватарку пользователя ТГ');
        }
      }

      const existingProfile = await prisma.socialProfile.findUnique({
        where: { provider_providerAccountId: { provider: 'TELEGRAM', providerAccountId: providerAccountId } }
      });

      if (existingProfile && existingProfile.userId !== String(userId)) {
        if (botToken) {
          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: tgUser.id,
            text: '❌ Ошибка: Этот Telegram-аккаунт уже привязан к другому профилю на сайте.'
          }).catch(e => console.log('Не удалось отправить сообщение об ошибке'));
        }
        return; 
      }

      await prisma.socialProfile.upsert({
        where: { provider_providerAccountId: { provider: 'TELEGRAM', providerAccountId: providerAccountId } },
        update: { name, avatarUrl: avatarUrl || undefined, userId: String(userId) }, 
        create: { 
          userId: String(userId), 
          provider: 'TELEGRAM', 
          providerAccountId: providerAccountId, 
          name, 
          avatarUrl, 
          accessToken: '' 
        }
      });

      if (botToken) {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: tgUser.id,
          text: '✅ Ваш аккаунт Telegram успешно привязан! Вернитесь на сайт и нажмите кнопку "Обновить".'
        }).catch(e => console.log('Не удалось отправить сообщение об успехе'));
      }

      if (req.app.get('io') && global.userSockets) {
         const connectedSockets = global.userSockets.get(String(userId));
         if (connectedSockets) {
           connectedSockets.forEach(socketId => {
             req.app.get('io').to(socketId).emit('ACCOUNTS_UPDATED');
           });
         }
      }
      return; 
    }

    if (update.my_chat_member) {
      const chat = update.my_chat_member.chat; 
      const from = update.my_chat_member.from; 
      const newStatus = update.my_chat_member.new_chat_member.status;

      if (newStatus === 'administrator') {
        const telegramUserId = String(from.id);
        const chatId = String(chat.id);
        const chatTitle = chat.title || 'Без названия';

        const tgProfile = await prisma.socialProfile.findFirst({
          where: { provider: 'TELEGRAM', providerAccountId: telegramUserId }
        });

        if (tgProfile) {
          const userWithPlan = await prisma.user.findUnique({ where: { id: tgProfile.userId } });
          const currentAccountsCount = await prisma.account.count({ where: { userId: tgProfile.userId } });
          const existingAccount = await prisma.account.findFirst({ where: { provider: 'TELEGRAM', providerId: chatId } });

          if (!existingAccount && !userWithPlan.isPro && currentAccountsCount >= 10) {
            console.log(`Лимит превышен для ${tgProfile.userId}. Канал ${chatTitle} не добавлен.`);
            return; 
          }

          let avatarUrl = null;
          // === ИСПРАВЛЕНИЕ: БЕЗОПАСНАЯ ЗАГРУЗКА АВАТАРКИ КАНАЛА ТГ ===
          try {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            const chatRes = await axios.get(`https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`);
            if (chatRes.data.result.photo?.small_file_id) {
              const fileRes = await axios.get(`https://api.telegram.org/bot${token}/getFile?file_id=${chatRes.data.result.photo.small_file_id}`);
              const tgFileUrl = `https://api.telegram.org/file/bot${token}/${fileRes.data.result.file_path}`;
              
              // Скачиваем картинку и переводим в формат base64
              const imageReq = await axios.get(tgFileUrl, { responseType: 'arraybuffer' });
              avatarUrl = `data:image/jpeg;base64,${Buffer.from(imageReq.data).toString('base64')}`;
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
      else if (newStatus === 'left' || newStatus === 'kicked') {
        await prisma.account.updateMany({
          where: { provider: 'TELEGRAM', providerId: String(chat.id) },
          data: { isValid: false, errorMsg: 'Бот удален из канала' }
        });
      }
    }
  } catch (error) {
    console.error('Ошибка в Webhook Telegram:', error);

    await logEvent(
      null, // ID юзера неизвестен, если бот упал на системном уровне
      'ERROR', 
      'TELEGRAM_WEBHOOK', 
      'Сбой при обработке сообщения от Telegram', 
      error.message
    );
  }
};