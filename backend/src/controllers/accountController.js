const axios = require('axios'); 
const prisma = require('../utils/prisma'); // Подключаем единый инстанс
// В начало файла accountController.js
// В начало файла accountController.js
const KOMOD_TOKEN = process.env.KOMOD_TOKEN;
const KOMOD_BASE_URL = 'https://kom-od.ru/api/v1';
const { logEvent } = require('../utils/logger');
const { getUserLimits, NO_SUBSCRIPTION_ERROR } = require('../utils/limits');
const { getBotToken } = require('../utils/security');

const GATEWAY_NOT_CONFIGURED = 'Шлюз ВК не настроен на сервере';


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
    if (!KOMOD_TOKEN) return res.status(503).json({ error: GATEWAY_NOT_CONFIGURED });
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

    // Новые аккаунты можно добавлять только с активной подпиской и в пределах тарифа
    if (!existingAcc) {
      const currentUser = await prisma.user.findUnique({ where: { id: userId } });
      const limits = getUserLimits(currentUser);
      if (!limits.active) return res.status(403).json({ error: NO_SUBSCRIPTION_ERROR });

      const vkCount = await prisma.account.count({ where: { userId, provider: 'VK' } });
      const totalCount = await prisma.account.count({ where: { userId } });
      if (vkCount >= limits.vk || totalCount >= limits.total) {
        return res.status(403).json({ error: `Лимит ВК (${limits.vk} акк.) исчерпан.` });
      }
    }

    // 1. Отправляем в Kom-od
    const params = new URLSearchParams();
    params.append('url', url);
    params.append('title', title || 'Без названия');
    params.append('account_id', profile.providerAccountId);
    params.append('random_account', '0'); 
    params.append('post_images_as_grid', '1');

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
        accessToken: '',
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
    if (!KOMOD_TOKEN) return res.status(503).json({ error: GATEWAY_NOT_CONFIGURED });

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

    // 2. Токен шлюза один на всех пользователей, поэтому здесь обновляются только профили,
    // которые этот пользователь подключил сам. Новые профили создаёт только confirmVkKomod.
    const validAccIds = allAccounts.map(a => String(a.id));
    const existingVkProfiles = await prisma.socialProfile.findMany({ where: { userId, provider: 'VK' } });

    if (allAccounts.length > 0) {
      for (const p of existingVkProfiles) {
        if (!validAccIds.includes(String(p.providerAccountId))) {
          await prisma.socialProfile.delete({ where: { id: p.id } });
        }
      }
    }

    const ownAccounts = allAccounts.filter(a => existingVkProfiles.some(p => String(p.providerAccountId) === String(a.id)));
    const metaMap = {};
    const groupAvatarsMap = {};

    await Promise.all(ownAccounts.map(async (acc) => {
      const [detailRes, groupsRes] = await Promise.allSettled([
        axios.get(`${KOMOD_BASE_URL}/account/${acc.id}`, { headers: { 'Access-Token': KOMOD_TOKEN } }),
        axios.get(`${KOMOD_BASE_URL}/account/${acc.id}/api-groups`, { headers: { 'Access-Token': KOMOD_TOKEN } })
      ]);

      if (detailRes.status === 'fulfilled' && detailRes.value.data?.data?.auth) {
        const auth = typeof detailRes.value.data.data.auth === 'string' ? JSON.parse(detailRes.value.data.data.auth) : detailRes.value.data.data.auth;
        const apiUser = auth.apiUserData;
        if (apiUser) {
          metaMap[String(acc.id)] = {
            avatar: apiUser.photo_200 || apiUser.photo_max || apiUser.photo_100,
            name: `${apiUser.first_name || ''} ${apiUser.last_name || ''}`.trim()
          };
        }
      }

      if (groupsRes.status === 'fulfilled') {
        let items = [];
        const resData = groupsRes.value.data?.data;
        const resGroups = groupsRes.value.data?.groups;

        if (Array.isArray(resData)) items = (resData[0]?.items || resData);
        else if (resData?.items) items = resData.items;
        else if (resGroups?.items) items = resGroups.items;

        for (const g of items) {
          const gUid = String(g.id || g.group_id || g.uid);
          const gPhoto = extractKomodAvatar(g);
          if (gUid && gPhoto) groupAvatarsMap[gUid] = gPhoto;
        }
      }
    }));

    // 3. Обновление своих профилей
    for (const acc of ownAccounts) {
      const pId = String(acc.id);
      const existingProfile = existingVkProfiles.find(p => String(p.providerAccountId) === pId);
      const name = metaMap[pId]?.name || acc.title || existingProfile?.name || 'Профиль ВК';
      let avatar = metaMap[pId]?.avatar;

      if (!avatar && existingProfile?.avatarUrl && !existingProfile.avatarUrl.includes('ui-avatars')) {
        avatar = existingProfile.avatarUrl;
      }
      if (!avatar) {
        const initials = name ? String(name).substring(0, 2).toUpperCase() : 'VK';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0077FF"/><text x="50%" y="50%" font-family="sans-serif" font-size="40" font-weight="bold" fill="#FFF" text-anchor="middle" dy=".3em">${initials}</text></svg>`;
        avatar = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
      }

      await prisma.socialProfile.update({ where: { id: existingProfile.id }, data: { name, avatarUrl: avatar } });
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
          const initials = finalName ? String(finalName).substring(0,2).toUpperCase() : 'VK';
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0d0f13"/><text x="50%" y="50%" font-family="sans-serif" font-size="40" font-weight="bold" fill="#0077FF" text-anchor="middle" dy=".3em">${initials}</text></svg>`;
          finalAvatar = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
      }

      await prisma.account.upsert({
        where: { provider_providerId: { provider: 'VK', providerId } },
        update: { name: finalName, avatarUrl: finalAvatar, isValid: true, profileId: parentProfile.id }, // БЕЗ userId
        create: { userId, provider: 'VK', providerId, name: finalName, avatarUrl: finalAvatar, accessToken: '', profileId: parentProfile.id }
      });
    }

    // 6. Очистка
    const existingVkAccounts = allGroupsRaw.length > 0 ? await prisma.account.findMany({ where: { userId, provider: 'VK' } }) : [];
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




// Токены доступа остаются на сервере и в браузер не передаются.
const withoutToken = ({ accessToken, ...rest }) => rest;

exports.getProfiles = async (req, res) => {
  try {
    const profiles = await prisma.socialProfile.findMany({
      where: { userId: req.userId },
      include: { accounts: { include: { watermark: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({
      success: true,
      profiles: profiles.map((p) => ({ ...withoutToken(p), accounts: p.accounts.map(withoutToken) })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки' });
  }
};

// Привязывает к пользователю ровно один аккаунт шлюза: тот, который он только что подключил.
exports.confirmVkKomod = async (req, res) => {
  try {
    const userId = req.userId;
    const { hash } = req.body;
    if (!KOMOD_TOKEN) return res.status(503).json({ error: GATEWAY_NOT_CONFIGURED });
    if (!hash || !String(hash).startsWith(`vk_${userId}_`)) {
      return res.status(400).json({ error: 'Некорректный код подключения' });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!getUserLimits(currentUser).active) return res.status(403).json({ error: NO_SUBSCRIPTION_ERROR });

    const response = await axios.post(
      `${KOMOD_BASE_URL}/account/confirm-vk`,
      new URLSearchParams({ hash }),
      {
        headers: { 'Access-Token': KOMOD_TOKEN, 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: (status) => status < 500,
      }
    );
    if (response.data && response.data.success === false) {
      return res.status(400).json({ error: 'Ошибка шлюза: ' + JSON.stringify(response.data.errors) });
    }

    const body = response.data || {};
    let komodId = body.data?.id || body.data?.account_id || body.id || body.account_id;

    // Если шлюз не назвал аккаунт, берём самый новый из ещё никем не привязанных.
    if (!komodId) {
      const accRes = await axios.get(`${KOMOD_BASE_URL}/account`, { headers: { 'Access-Token': KOMOD_TOKEN } });
      const items = accRes.data?.data?.items || [];
      const claimed = await prisma.socialProfile.findMany({ where: { provider: 'VK' }, select: { providerAccountId: true } });
      const claimedIds = new Set(claimed.map((p) => String(p.providerAccountId)));
      const free = items.filter((a) => !claimedIds.has(String(a.id))).sort((a, b) => Number(b.id) - Number(a.id));
      komodId = free[0]?.id;
    }
    if (!komodId) return res.status(400).json({ error: 'Не удалось определить подключённый аккаунт ВК' });

    const providerAccountId = String(komodId);
    const taken = await prisma.socialProfile.findUnique({
      where: { provider_providerAccountId: { provider: 'VK', providerAccountId } },
    });
    if (taken && taken.userId !== userId) {
      return res.status(409).json({ error: 'Этот аккаунт ВК уже привязан к другому пользователю' });
    }
    if (!taken) {
      await prisma.socialProfile.create({
        data: { userId, provider: 'VK', providerAccountId, name: 'Профиль ВК', accessToken: '' },
      });
    }

    res.json({ success: true, data: { id: providerAccountId } });
  } catch (error) {
    console.error('Ошибка подтверждения ВК:', error.message);
    res.status(500).json({ error: 'Ошибка сервера при обращении к Kom-od' });
  }
};

exports.saveTgAccounts = async (req, res) => {
  const userId = req.userId;
  const { channels } = req.body;
  try {
    if (!Array.isArray(channels) || channels.length === 0) return res.status(400).json({ error: 'Нет данных' });

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    const limits = getUserLimits(currentUser);
    if (!limits.active) return res.status(403).json({ error: NO_SUBSCRIPTION_ERROR });

    for (const channel of channels) {
      const isTaken = await prisma.account.findFirst({ where: { provider: 'TELEGRAM', providerId: String(channel.chatId) } });
      if (isTaken && isTaken.userId !== userId) return res.status(400).json({ error: 'Канал уже привязан к другому пользователю!' });
    }

    const existing = await prisma.account.findMany({ where: { userId, provider: 'TELEGRAM' }, select: { providerId: true } });
    const existingIds = new Set(existing.map((a) => a.providerId));
    const newCount = channels.filter((c) => !existingIds.has(String(c.chatId))).length;
    const totalCount = await prisma.account.count({ where: { userId } });
    if (existing.length + newCount > limits.tg || totalCount + newCount > limits.total) {
      return res.status(403).json({ error: `Лимит Telegram каналов для вашего тарифа: ${limits.tg}. У вас уже ${existing.length}.` });
    }

    let tgProfile = await prisma.socialProfile.findFirst({ where: { userId, provider: 'TELEGRAM' } });
    if (!tgProfile) {
      tgProfile = await prisma.socialProfile.create({ data: { userId, provider: 'TELEGRAM', providerAccountId: `site_${userId}`, name: 'Telegram Профиль' } });
    }

    const savedAccounts = await Promise.all(channels.map((channel) => prisma.account.upsert({
      where: { provider_providerId: { provider: 'TELEGRAM', providerId: String(channel.chatId) } },
      update: { avatarUrl: channel.avatar || null, name: channel.title || 'Без названия', profileId: tgProfile.id },
      create: { userId, provider: 'TELEGRAM', providerId: String(channel.chatId), name: channel.title || 'Без названия', avatarUrl: channel.avatar || null, accessToken: '', profileId: tgProfile.id },
    })));
    res.json({ success: true, count: savedAccounts.length });
  } catch (error) {
    console.error('Ошибка сохранения каналов:', error.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

exports.getAccounts = async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { userId: req.userId },
      include: { watermark: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(accounts.map(withoutToken));
  } catch (error) {
    console.error('Ошибка getAccounts:', error.message);
    res.status(500).json({ error: 'Ошибка сервера при загрузке групп' });
  }
};

exports.deleteAccount = async (req, res) => {
  const { id } = req.params;
  try {
    const account = await prisma.account.findFirst({ where: { id, userId: req.userId } });
    if (!account) return res.status(404).json({ error: 'Аккаунт не найден' });

    // Группа удаляется и из шлюза, но только если она относится к профилю этого пользователя.
    if (account.provider === 'VK' && KOMOD_TOKEN) {
      try {
        const grpRes = await axios.get(`${KOMOD_BASE_URL}/group`, { headers: { 'Access-Token': KOMOD_TOKEN } });
        const allGroups = grpRes.data?.data?.items || [];
        const rawId = account.providerId.replace('wall_', '').replace('group_', '').replace('-', '');
        const profiles = await prisma.socialProfile.findMany({ where: { userId: req.userId, provider: 'VK' }, select: { providerAccountId: true } });
        const ownAccountIds = new Set(profiles.map((p) => String(p.providerAccountId)));

        const komodGroup = allGroups.find((g) => {
          if (!ownAccountIds.has(String(g.account_id))) return false;
          const uid = String(g.uid || '').replace('-', '');
          const url = String(g.url || '');
          return uid === rawId || new RegExp(`/(club|public|event|id)?${rawId}/?$`).test(url);
        });

        if (komodGroup && komodGroup.id) {
          await axios.delete(`${KOMOD_BASE_URL}/group/${komodGroup.id}`, { headers: { 'Access-Token': KOMOD_TOKEN } });
        }
      } catch (apiError) {
        console.error('Не удалось удалить группу со шлюза Kom-od:', apiError.message);
      }
    }

    await prisma.account.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при удалении аккаунта:', error.message);
    res.status(500).json({ error: 'Ошибка сервера при удалении' });
  }
};

exports.verifyTgAccountsStatus = async (req, res) => {
  const userId = req.userId;
  try {
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
    const owned = await prisma.account.findFirst({ where: { id, userId: req.userId }, select: { id: true } });
    if (!owned) return res.status(404).json({ error: 'Аккаунт не найден' });
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

// Все группы ВК работают через шлюз, отдельных токенов ВК больше нет.
exports.verifyVkAccountsStatus = async (req, res) => {
  try {
    const { count } = await prisma.account.updateMany({
      where: { userId: req.userId, provider: 'VK' },
      data: { isValid: true, errorMsg: null },
    });
    res.json({ success: true, updated: count });
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

exports.addVkKomodProfile = async (req, res) => {
  try {
    const { profileId, avatarUrl, name } = req.body; 
    const userId = String(req.user.userId || req.user.id);

    const profile = await prisma.socialProfile.findFirst({
      where: { id: profileId, userId }
    });
    
    if (!profile) return res.status(404).json({ error: 'Профиль не найден' });
    if (!KOMOD_TOKEN) return res.status(503).json({ error: GATEWAY_NOT_CONFIGURED });

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    const limits = getUserLimits(currentUser);
    if (!limits.active) return res.status(403).json({ error: NO_SUBSCRIPTION_ERROR });
    const vkCount = await prisma.account.count({ where: { userId, provider: 'VK' } });
    if (vkCount >= limits.vk) return res.status(403).json({ error: `Лимит ВК (${limits.vk} акк.) исчерпан.` });

    // Отправляем запрос в шлюз Kom-od
    const params = new URLSearchParams();
    params.append('account_id', profile.providerAccountId);
    params.append('is_profile', '1');
    params.append('post_images_as_grid', '1');

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
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret && req.headers['x-telegram-bot-api-secret-token'] !== webhookSecret) {
      return res.sendStatus(403);
    }
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
          const tgCount = await prisma.account.count({ where: { userId: tgProfile.userId, provider: 'TELEGRAM' } });
          const limits = getUserLimits(userWithPlan);
          const existingAccount = await prisma.account.findFirst({ where: { provider: 'TELEGRAM', providerId: chatId } });

          if (!existingAccount && (!limits.active || tgCount >= limits.tg)) {
            console.log(`Канал не добавлен для ${tgProfile.userId}: нет подписки или исчерпан лимит (${limits.tg}).`);
            return; 
          }

          let avatarUrl = null;
          // === ИСПРАВЛЕНИЕ: БЕЗОПАСНАЯ ЗАГРУЗКА АВАТАРКИ КАНАЛА ТГ ===
          try {
            const token = getBotToken();
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

          // ⚡ МОМЕНТАЛЬНОЕ ОБНОВЛЕНИЕ ФРОНТЕНДА ПРИ ДОБАВЛЕНИИ ⚡
          if (req.app.get('io') && global.userSockets) {
             const connectedSockets = global.userSockets.get(String(tgProfile.userId));
             if (connectedSockets) {
               connectedSockets.forEach(socketId => {
                 req.app.get('io').to(socketId).emit('ACCOUNTS_UPDATED');
               });
             }
          }
        }
      } 
      else if (newStatus === 'left' || newStatus === 'kicked') {
        const chatAccount = await prisma.account.findFirst({ where: { provider: 'TELEGRAM', providerId: String(chat.id) } });

        await prisma.account.updateMany({
          where: { provider: 'TELEGRAM', providerId: String(chat.id) },
          data: { isValid: false, errorMsg: 'Бот удален из канала' }
        });

        // ⚡ МОМЕНТАЛЬНОЕ ОБНОВЛЕНИЕ ПРИ УДАЛЕНИИ БОТА ИЗ КАНАЛА ⚡
        if (chatAccount && req.app.get('io') && global.userSockets) {
           const connectedSockets = global.userSockets.get(String(chatAccount.userId));
           if (connectedSockets) {
             connectedSockets.forEach(socketId => {
               req.app.get('io').to(socketId).emit('ACCOUNTS_UPDATED');
             });
           }
        }
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