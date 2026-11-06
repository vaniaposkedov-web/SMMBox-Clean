import { useEffect, useState, useRef } from 'react';
import { useStore } from '../../store';
import { useNavigate } from 'react-router-dom';
import {
  Send, Plus, ShieldAlert, Check, Type, X, Loader2, CheckCircle2, Users
} from 'lucide-react';

import CustomVkButton from '../../components/CustomVkButton';
import { TELEGRAM_BOT_NAME } from '../../telegramBot';
import { io } from 'socket.io-client';

export default function AccountsManager() {
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const accounts = useStore((state) => state.accounts) || [];
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  const fetchProfiles = useStore((state) => state.fetchProfiles);
  const fetchCurrentUser = useStore((state) => state.fetchCurrentUser);
  
  const verifyAccountsStatus = useStore((state) => state.verifyAccountsStatus);
  const verifyVkAccountsStatus = useStore((state) => state.verifyVkAccountsStatus);

  const removeAccount = useStore((state) => state.removeAccount);
  const token = useStore((state) => state.token);

  const connectedVk = accounts.filter(acc => acc.provider === 'VK');
  const connectedTg = accounts.filter(acc => acc.provider === 'TELEGRAM');

  const [isSyncingVk, setIsSyncingVk] = useState(false);
  // Состояния для нового блока подключения
  const [selectedNetwork, setSelectedNetwork] = useState('VK'); 
  const [showTgHelperModal, setShowTgHelperModal] = useState(false);
  const [tgBindLink, setTgBindLink] = useState(null);
  const [tgBindFailed, setTgBindFailed] = useState(false);
  
// Динамический расчет лимитов для интерфейса
  // Динамический расчет лимитов для интерфейса
  const isExpired = user?.proExpiresAt && new Date(user.proExpiresAt) < new Date();
  const isPaid = user?.isPro && !isExpired;
  // ВАЖНО: сразу переводим в верхний регистр, чтобы .includes() сработал
  const planType = isPaid ? user?.proPlanType?.toUpperCase() : 'FREE'; 

  const isAdvanced = planType?.includes('РАСШИРЕН') || planType === 'PRO';
  const isBasic = planType?.includes('БАЗОВ') || planType === 'BASIC';

  // ВАЖНО: используем наши булевы флаги, а не старую проверку на 'PRO'
  const limits = {
    vk: isAdvanced ? 20 : (isBasic ? 15 : 6),
    tg: isAdvanced ? 8 : (isBasic ? 5 : 4),
    total: isAdvanced ? 28 : (isBasic ? 20 : 10)
  };

  const vkCount = connectedVk.length;
  const tgCount = connectedTg.length;
  const currentCount = vkCount + tgCount;

  const isVkLimitReached = vkCount >= limits.vk;
  const isTgLimitReached = tgCount >= limits.tg;
  const isTotalLimitReached = currentCount >= limits.total;
  
  // Флаг для блокировки главной кнопки выбора соцсети
  const isLimitReached = selectedNetwork === 'VK' ? (isVkLimitReached || isTotalLimitReached) : (isTgLimitReached || isTotalLimitReached);

  const [selectableGroups, setSelectableGroups] = useState([]);
  const [komodModal, setKomodModal] = useState({ isOpen: false, profileId: null });
  const [komodSelected, setKomodSelected] = useState([]);

  const [vkConnectStatus, setVkConnectStatus] = useState('idle');
  const [addedGroupsCount, setAddedGroupsCount] = useState(0);
  const [isWaitingForTg, setIsWaitingForTg] = useState(false); // Для Telegram
  const [tgCountBeforeWait, setTgCountBeforeWait] = useState(0);
  const processingHash = useRef(null);

  

  const handleRefreshProfiles = async () => {
    await fetchProfiles(user.id);
    await fetchAccounts(user.id);
  };


 const extractAvatar = (obj) => {
    if (!obj || typeof obj !== 'object') return null;

    try {
      // 1. Ищем через нашу функцию deepSearch (самый надежный способ, игнорирующий кривизну структуры API)
      const deepAvatar = deepSearch(obj, ['photo_200', 'photo_100', 'photo_50', 'avatar', 'photo']);
      if (deepAvatar) return deepAvatar;

      // 2. Резервный поиск по всему объекту (улучшенный regex для всех доменов ВК, включая заглушки vk.com/images/)
      const fullStr = JSON.stringify(obj, null, 2);
      const vkUrlMatch = fullStr.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:userapi\.com|vk\.com\/images)[^\s"'\\]+/i);
      if (vkUrlMatch) return vkUrlMatch[0].replace(/\\/g, '');

    } catch(e) {}
    
    return null;
  };

  const extractName = (obj) => {
    if (!obj || typeof obj !== 'object') return null;

    try {
      // 1. Имя группы
      let info = obj.info;
      if (typeof info === 'string') { try { info = JSON.parse(info); } catch(e){} }
      
      let raw = info?.rawData;
      if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch(e){} }
      
      if (info && info.title) return info.title;
      if (raw && raw.name) return raw.name;

      // 2. Имя личной страницы
      let apiUser = obj.apiUserData || obj.auth;
      if (typeof apiUser === 'string') { try { apiUser = JSON.parse(apiUser); } catch(e){} }
      
      if (apiUser && apiUser.first_name) {
         return `${apiUser.first_name} ${apiUser.last_name || ''}`.trim();
      }

      if (obj.name) return obj.name;
      if (obj.title) return obj.title;

    } catch(e) {}
    
    return 'Без названия';
  };

  const extractId = (obj) => {
    if (!obj) return null;
    if (obj.info?.rawData?.id) return obj.info.rawData.id;
    if (obj.apiGroupData?.id) return obj.apiGroupData.id;
    if (obj.id) return obj.id;
    if (obj.group_id) return obj.group_id;
    return null;
  };

 // --- УЛЬТРА-РЕКУРСИВНЫЙ ПОИСК ДАННЫХ ---
  // ✅ ИСПРАВЛЕНИЕ: Перенесли deepSearch ВЫШЕ, чтобы её можно было использовать в extractAvatar
  const deepSearch = (obj, targetKeys) => {
    if (!obj || typeof obj !== 'object') return null;
    
    // Проверяем прямые ключи
    for (let key of targetKeys) {
      if (obj[key] && typeof obj[key] === 'string' && obj[key].length > 1) return obj[key];
    }

    // Лезем вглубь (apiUserData, apiGroupData, и т.д.)
    for (let key in obj) {
      if (obj[key] && typeof obj[key] === 'object') {
        const found = deepSearch(obj[key], targetKeys);
        if (found) return found;
      }
    }
    return null;
  };

  const getValidAvatar = (url, fallbackName) => {
    const generateFallback = () => {
       const text = fallbackName ? String(fallbackName).substring(0,2).toUpperCase() : 'VK';
       // Локальная мгновенная генерация SVG (без запросов в интернет)
       const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0077FF"/><text x="50%" y="50%" font-family="sans-serif" font-size="40" font-weight="bold" fill="#FFF" text-anchor="middle" dy=".3em">${text}</text></svg>`;
       return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    };
    if (!url || typeof url !== 'string' || url.includes('camera_')) return generateFallback();
    let finalUrl = url.trim().startsWith('//') ? `https:${url.trim()}` : url.trim();
    return finalUrl.replace('http://', 'https://');
  };
  

const handleSaveKomodGroups = async () => {
    if (komodSelected.length === 0) return;
    setIsSyncingVk(true);
    setVkConnectStatus('syncing_groups'); 
    setKomodModal({ isOpen: false, profileId: null }); 

    const addErrors = [];
    // Создаем массив задач для параллельного выполнения
    const tasks = komodSelected.map(async (uniqueId) => {
      const group = selectableGroups.find((g, idx) => String(extractId(g) || `idx-${idx}`) === String(uniqueId));
      if (!group) return false;

      const groupAvatar = extractAvatar(group);
      const groupName = extractName(group) || 'Без названия';

      if (group.is_profile_dummy) {
        const res = await fetch('/api/accounts/vk/komod-add-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ profileId: komodModal.profileId, avatarUrl: groupAvatar, name: groupName })
        });
        return res.ok;
      } else {
        // ИСПРАВЛЕНИЕ 400 ОШИБКИ: Надежное формирование URL без "undefined"
        const vkId = group.uid || group.group_id || group.id;
        const screenName = group.screen_name || group.domain || (vkId ? `club${vkId}` : null);
        
        if (!screenName) {
           console.error("Ошибка: Не удалось определить ID группы", group);
           return false; // Пропускаем сломанную группу, не вызывая 400 ошибку
        }
        
        const groupUrl = `https://vk.com/${screenName}`;
        const res = await useStore.getState().addVkKomodGroup(groupUrl, groupName, komodModal.profileId, groupAvatar);
        if (!res.success) addErrors.push(`${groupName}: ${res.error || 'не удалось добавить'}`);
        return res.success;
      }
    });

    const results = await Promise.all(tasks);
    const addedCount = results.filter(Boolean).length;
    
    setAddedGroupsCount(addedCount);
    await useStore.getState().syncVkKomod();
    await handleRefreshProfiles();
    setIsSyncingVk(false);
    setVkConnectStatus(addedCount > 0 ? 'groups_success' : 'idle');
    if (addErrors.length > 0) alert(`Не удалось подключить:\n${addErrors.join('\n')}`);
  };


  useEffect(() => {
    // Если включен режим ожидания и количество каналов стало больше, чем до ухода
    if (isWaitingForTg && tgCount > tgCountBeforeWait) {
      setIsWaitingForTg(false);
    }
  }, [tgCount, isWaitingForTg, tgCountBeforeWait]);


 // --- WEB SOCKETS: АВТО-ОБНОВЛЕНИЕ ДАННЫХ БЕЗ НАГРУЗКИ ---
 useEffect(() => {
    if (!user?.id) return;

    // Тихо обновляем данные пользователя, чтобы тариф мгновенно применился без F5
    if (fetchCurrentUser) fetchCurrentUser();

    // Первичная загрузка
    fetchAccounts(user.id);
    fetchProfiles(user.id);

    // Подключаемся к WebSocket серверу
    const socket = io(import.meta.env.VITE_API_URL || window.location.origin, {
      auth: { token: localStorage.getItem('token') || token }
      // 🟢 ИСПРАВЛЕНИЕ: Мы удалили строку "transports: ['websocket']". 
      // Теперь Socket.io сам обойдет блокировку NGINX на TimeWeb 
      // и подключится через резервный канал связи!
    });

    // Слушаем сигнал от бэкенда об обновлении аккаунтов
    socket.on('ACCOUNTS_UPDATED', () => {
      console.log('⚡ Получен сигнал от сервера: обновляем аккаунты!');
      fetchAccounts(user.id);
      fetchProfiles(user.id);
      setIsWaitingForTg(false); // Снимаем прогресс-бар, когда Telegram аккаунт прилетел в базу
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id, fetchAccounts, fetchProfiles]);

// === УМНОЕ ОБНОВЛЕНИЕ ПРИ ВОЗВРАТЕ ИЗ ТЕЛЕГРАМ ===
  // ИСПРАВЛЕНИЕ: Убран спам запросами при каждом фокусе (вызывало зависания сайта).
  // Теперь авто-обновление происходит только по WebSockets (блок кода выше).
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Оставляем только мягкое обновление при разблокировке телефона/возврате на вкладку, 
      // но убираем агрессивный слушатель focus, который ломал Event Loop
      if (document.visibilityState === 'visible' && user?.id) {
        fetchAccounts(user.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, fetchAccounts]);

  useEffect(() => {
    // Обязательно ждем загрузки данных пользователя, иначе запросы упадут
    if (!user?.id) return;

    const params = new URLSearchParams(window.location.search);
    const urlHash = params.get('vk_komod_hash');
    const pendingHash = localStorage.getItem('vk_pending_hash');
    const hashToProcess = urlHash || pendingHash;

    if (hashToProcess && processingHash.current !== hashToProcess) {
      processingHash.current = hashToProcess; 
      if (urlHash) navigate(window.location.pathname, { replace: true });
      if (pendingHash) localStorage.removeItem('vk_pending_hash');

      const finalizeAuth = async () => {
        setIsSyncingVk(true);
        setVkConnectStatus('syncing_profile'); 
        
        // 1. ПРИНУДИТЕЛЬНО ЗАГРУЖАЕМ ПРОФИЛИ ДО СИНХРОНИЗАЦИИ
        // После редиректа состояние (state) пустое. Если не загрузить сейчас, 
        // скрипт выберет первый попавшийся аккаунт.
        await fetchProfiles(user.id);
        
        const profilesBefore = useStore.getState().profiles.filter(p => p.provider === 'VK');
        // Используем точный ID шлюза (providerAccountId) вместо локального ID
        const beforeAccountIds = profilesBefore.map(p => String(p.providerAccountId));

        const confirmResult = await useStore.getState().confirmVkKomod(hashToProcess);
        if (!confirmResult.success) {
           alert('Ошибка шлюза: ' + (confirmResult.error || 'Аккаунт не найден.'));
           setIsSyncingVk(false); setVkConnectStatus('idle'); return; 
        }

        let confirmedKomodId = null;
        if (confirmResult.data?.data) {
           confirmedKomodId = confirmResult.data.data.id || confirmResult.data.data.account_id;
        }
        if (!confirmedKomodId && confirmResult.data) {
           confirmedKomodId = confirmResult.data.id || confirmResult.data.account_id;
        }

        // 2. Синхронизируем базу со шлюзом
        await useStore.getState().syncVkKomod();
        await handleRefreshProfiles();
        
        const updatedProfiles = useStore.getState().profiles;
        const vkProfilesAfter = updatedProfiles.filter(p => p.provider === 'VK');
        
        let vkProf = null;

        // 3. Ищем строго по ID шлюза
        if (confirmedKomodId) {
          vkProf = vkProfilesAfter.find(p => String(p.providerAccountId) === String(confirmedKomodId));
        }

        // 4. Резервный поиск: ищем профиль, которого ТОЧНО не было до синхронизации
        if (!vkProf) {
          vkProf = vkProfilesAfter.find(p => !beforeAccountIds.includes(String(p.providerAccountId)));
        }
        
        if (!vkProf) vkProf = vkProfilesAfter[vkProfilesAfter.length - 1];
        
        if (vkProf?.id) {
          // 5. ИСПРАВЛЕНИЕ ОПАСНОГО БАГА: Удаляем авто-стену ТОЛЬКО для нового аккаунта!
          const currentAccounts = useStore.getState().accounts;
          const autoAddedWall = currentAccounts.find(a => a.provider === 'VK' && a.providerId === `wall_${vkProf.providerAccountId}`);
          
          if (autoAddedWall) {
            await useStore.getState().removeAccount(autoAddedWall.id);
            await handleRefreshProfiles();
          }

          const profile = useStore.getState().profiles.find(p => p.id === vkProf.id);
          const data = await useStore.getState().fetchKomodGroups(vkProf.id);
          
          setIsSyncingVk(false);
          setVkConnectStatus('idle');
          
          if (data.success) {
            const groupsArray = Array.isArray(data.groups) ? data.groups : (data.groups?.items || []);
            
            const apiUser = data.auth?.apiUserData || data.auth || profile?.auth?.apiUserData;
            const fullName = extractName(apiUser) || profile?.name || 'Личная страница';
            const photoUrl = extractAvatar(apiUser) || profile?.avatarUrl;

            const personalWall = {
              id: 'wall_profile', 
              name: fullName,
              photo_50: photoUrl, 
              is_profile_dummy: true 
            };

            setSelectableGroups([personalWall, ...groupsArray]);
            setKomodSelected([]); 
            setKomodModal({ isOpen: true, profileId: vkProf.id });
          } else {
            alert('Внимание: ' + (data.error || 'Пустой ответ сервера'));
          }
        } else {
          setIsSyncingVk(false);
          setVkConnectStatus('idle');
        }
      };
      
      finalizeAuth();
    }
  }, [handleRefreshProfiles, navigate, user?.id]);
  

  useEffect(() => {
    if (user?.id) {
      fetchProfiles(user.id);
      fetchAccounts(user.id).then(() => {
        if (verifyAccountsStatus) verifyAccountsStatus();
        if (verifyVkAccountsStatus) verifyVkAccountsStatus();
      });
    }
  }, [user]);

 

  
 
  const handleConnectVkOAuth = () => {
    const hash = 'vk_' + user.id + '_' + Date.now();
    localStorage.setItem('vk_pending_hash', hash);
    
    // БЕРЕМ ИДЕАЛЬНО ЧИСТЫЙ URL без всяких параметров и мусора
    const cleanUrl = window.location.origin + window.location.pathname;
    const redirectUrl = encodeURIComponent(cleanUrl);
    
    window.location.href = `https://kom-od.ru/connect/vk?hash=${hash}&redirect_url=${redirectUrl}`; 
  };

  // Ссылка на бота содержит одноразовый код: только так Telegram привяжется именно к этому аккаунту.
  const openTgHelper = async () => {
    setShowTgHelperModal(true);
    setTgBindLink(null);
    setTgBindFailed(false);
    const result = await useStore.getState().createTelegramBindCode();
    if (result.success) setTgBindLink(`https://t.me/${TELEGRAM_BOT_NAME}?start=bind_${result.code}`);
    else setTgBindFailed(true);
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-10 max-w-7xl mx-auto px-2 sm:px-4 w-full font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight px-1 sm:px-0">Мои социальные сети</h1>
      </div>

      {/* Динамический блок лимитов или Требование подписки */}
      {!isPaid ? (
        <div className="bg-red-500/10 border border-red-500/30 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 shadow-lg shadow-red-500/5">
          <div>
            <h3 className="text-red-500 font-bold text-base sm:text-lg">Нет активной подписки</h3>
            <p className="text-gray-400 text-sm mt-1">Без подписки вы не сможете использовать или добавлять аккаунты.</p>
          </div>
          <button 
            onClick={() => navigate('/profile?tab=subscription')} 
            className="w-full sm:w-auto text-sm bg-red-600 hover:bg-red-500 text-white px-6 py-3.5 sm:py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95 whitespace-nowrap min-h-[48px]"
          >
            Оформить подписку
          </button>
        </div>
      ) : (
        <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${isLimitReached ? 'bg-red-500/10 border-red-500/30 shadow-lg shadow-red-500/10' : 'bg-gray-900 border-gray-800'}`}>
          <div>
            <p className="text-white font-bold text-base flex items-center gap-2">
              {isAdvanced ? 'Тариф Расширенный' : 'Тариф Базовый'} 
              {isLimitReached && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest">Лимит исчерпан</span>}
            </p>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1.5">
              <span className="text-gray-400 text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0077FF]"></span> ВК: <span className={isVkLimitReached ? 'text-red-400 font-bold' : 'text-white font-bold'}>{vkCount} / {limits.vk}</span>
              </span>
              <span className="text-gray-400 text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2AABEE]"></span> ТГ: <span className={isTgLimitReached ? 'text-red-400 font-bold' : 'text-white font-bold'}>{tgCount} / {limits.tg}</span>
              </span>
              <span className="text-gray-500 text-xs ml-2 border-l border-gray-700 pl-4 hidden sm:block">Всего: {currentCount}/{limits.total}</span>
            </div>
          </div>
          
          {!isAdvanced && (
            <button onClick={() => navigate('/profile?tab=subscription')} className="w-full sm:w-auto text-sm bg-purple-600 hover:bg-purple-500 text-white px-6 py-3.5 sm:py-3 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 active:scale-95 whitespace-nowrap min-h-[48px]">
              Улучшить до Расширенного (1800₽)
            </button>
          )}
        </div>
      )}

     {/* === БЛОК ВЫБОРА СОЦСЕТИ === */}
      <div className="bg-[#0d0f13] border border-gray-800 rounded-3xl p-5 sm:p-6 flex flex-col gap-5 mt-6 shadow-xl max-w-md mx-auto w-full relative overflow-hidden">
        
        <div className={`absolute top-0 left-0 w-full h-full opacity-10 transition-colors duration-700 pointer-events-none ${
          selectedNetwork === 'VK' 
            ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0077FF] via-transparent to-transparent' 
            : 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2AABEE] via-transparent to-transparent'
        }`} />

        <h2 className="text-base font-bold text-white text-center relative z-10">Выберите платформу</h2>

        <div className="grid grid-cols-2 gap-3 relative z-10">
          <div
            onClick={() => setSelectedNetwork('VK')}
            className={`relative border rounded-2xl py-3 flex flex-row items-center justify-center gap-3 transition-all cursor-pointer ${
              selectedNetwork === 'VK' ? 'border-[#0077FF] bg-[#0077FF]/10 scale-[1.02]' : 'border-gray-800 bg-gray-900/50 opacity-60'
            }`}
          >
            <img src="/icons8-vk.svg" alt="VK" className="w-8 h-8 object-contain" />
            <h3 className="font-bold text-white text-lg">ВК</h3>
            {selectedNetwork === 'VK' && <div className="absolute top-1.5 right-2 text-[#0077FF]"><Check size={14} strokeWidth={4} /></div>}
          </div>

          <div
            onClick={() => setSelectedNetwork('TG')}
            className={`relative border rounded-2xl py-3 flex flex-row items-center justify-center gap-3 transition-all cursor-pointer ${
              selectedNetwork === 'TG' ? 'border-[#2AABEE] bg-[#2AABEE]/10 scale-[1.02]' : 'border-gray-800 bg-gray-900/50 opacity-60'
            }`}
          >
            <img src="/icons8-телеграм.svg" alt="TG" className="w-8 h-8 object-contain" />
            <h3 className="font-bold text-white text-lg">ТГ</h3>
            {selectedNetwork === 'TG' && <div className="absolute top-1.5 right-2 text-[#2AABEE]"><Check size={14} strokeWidth={4} /></div>}
          </div>
        </div>

        <button
          onClick={() => {
            if (!isPaid) return; // Если нет подписки - игнорируем
            if (!isLimitReached) {
              selectedNetwork === 'VK' ? handleConnectVkOAuth() : openTgHelper();
            }
          }}
          disabled={!isPaid || isLimitReached}
          className={`relative z-10 w-full py-4 rounded-xl font-bold transition-all text-sm ${
            !isPaid || isLimitReached 
              ? 'bg-gray-800/80 text-gray-500 cursor-not-allowed border border-gray-700/50' 
              : selectedNetwork === 'VK' 
                ? 'bg-[#0077FF] text-white shadow-lg shadow-[#0077FF]/20 active:scale-95' 
                : 'bg-[#2AABEE] text-white shadow-lg shadow-[#2AABEE]/20 active:scale-95'
          }`}
        >
          {!isPaid 
            ? 'Оформите подписку для добавления'
            : isLimitReached 
              ? `Лимит ${selectedNetwork === 'VK' ? 'ВК' : 'Telegram'} исчерпан` 
              : `Авторизовать ${selectedNetwork === 'VK' ? 'ВКонтакте' : 'Telegram'}`
          }
        </button>
      </div>
     
      {/* === СПИСОК ПОДКЛЮЧЕННЫХ СЕТЕЙ (ЕДИНЫЙ БЛОК) === */}
      <div className="max-w-md mx-auto w-full mt-8 mb-4 px-1">
        <h2 className="text-[10px] font-bold text-gray-500 mb-3 uppercase tracking-[0.2em] text-center">Подключено</h2>
        
        {(connectedVk.length === 0 && connectedTg.length === 0) ? (
          <div className="text-center p-4 bg-[#0d0f13] border border-gray-800 border-dashed rounded-xl text-gray-500 text-sm">
            Платформы не добавлены
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {[
              // Высчитываем, какие аккаунты заморожены или вышли за лимит
              ...connectedVk.map((acc, idx) => ({ ...acc, isOverLimit: idx >= limits.vk, isFrozen: !isPaid })),
              ...connectedTg.map((acc, idx) => ({ ...acc, isOverLimit: idx >= limits.tg, isFrozen: !isPaid }))
            ].map(acc => {
              const isVk = acc.provider === 'VK';
              const isPersonal = isVk && acc.providerId.startsWith('wall_');
              const accountName = acc.name || acc.title || (isVk ? 'ВК' : 'ТГ');
              const avatar = getValidAvatar(acc.avatarUrl || extractAvatar(acc), accountName);
              
              const isBlocked = acc.isFrozen || acc.isOverLimit;

              return (
                <div 
                  key={acc.id} 
                  className={`flex flex-col p-2 bg-[#0d0f13] border rounded-xl relative group transition-all ${
                    isBlocked ? 'opacity-50 grayscale border-gray-700/50' : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  
                  {/* ПЛАШКА: Заморожен / Продлите подписку */}
                  {isBlocked && (
                    <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-white text-[8px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap z-10 shadow-lg ${acc.isFrozen ? 'bg-gray-600 border border-gray-500' : 'bg-red-600'}`}>
                      {acc.isFrozen ? 'Заморожен' : 'Лимит исчерпан'}
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 min-w-0">
                    
                    <div className="relative shrink-0">
                      <img 
                        src={avatar} 
                        onError={(e) => { e.target.onerror = null; e.target.src = getValidAvatar(null, accountName); }}
                        className="w-9 h-9 rounded-full object-cover border border-gray-800" 
                        alt="" 
                      />
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#0d0f13] ${isVk ? 'bg-[#0077FF]' : 'bg-[#2AABEE]'}`}>
                        {isVk ? (
                          <span className="text-[7px] font-bold text-white">VK</span>
                        ) : (
                          <Send size={8} className="text-white" />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-white font-bold text-[11px] sm:text-xs truncate">
                        {accountName}
                      </span>
                      {isPersonal && (
                        <span className="text-[8px] text-gray-500 uppercase font-black mt-0.5 tracking-wider">
                          Личная страница
                        </span>
                      )}
                    </div>

                    {/* Удаление доступно ВСЕГДА, z-20 чтобы кнопка была поверх блокировки */}
                    <button 
                      onClick={() => removeAccount(acc.id)} 
                      className="text-gray-600 hover:text-rose-500 transition-all p-1 relative z-20"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

{/* === 2. ОКНО ИНСТРУКЦИИ ТЕЛЕГРАМ === */}
      {showTgHelperModal && (
        <div key="modal-tg" className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowTgHelperModal(false)}></div>
          <div className="relative z-10 w-full max-w-md bg-[#111318] border border-gray-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-800 bg-[#0088CC]/5">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0088CC] flex items-center justify-center text-white shadow-lg shadow-[#0088CC]/30">
                  <Send size={20} />
                </div>
                Подключение Telegram
              </h3>
              <button onClick={() => setShowTgHelperModal(false)} className="text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700 p-2 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-sm text-gray-300 leading-relaxed">
                Чтобы добавить канал, необходимо выполнить <b>два шага</b>. Сначала привяжите свой аккаунт, а затем выберите канал из списка.
              </p>
              
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-5">
                
                {/* ШАГ 1: Связка аккаунта (нужно для webhook бэкенда) */}
                <div>
                  <div className="flex gap-3 items-start mb-2">
                    <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">1</div>
                    <p className="text-sm text-gray-400">Привяжите личный ТГ-аккаунт (нажмите <b className="text-white">Запустить</b> в боте)</p>
                  </div>
                  {tgBindLink && (
                    <a
                      href={tgBindLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-lg font-bold text-white transition-all flex justify-center items-center gap-2 bg-gray-800 hover:bg-gray-700 text-sm border border-gray-700 mt-2"
                    >
                      Привязать профиль
                    </a>
                  )}
                  {!tgBindLink && !tgBindFailed && (
                    <div className="w-full py-2.5 rounded-lg font-bold text-gray-400 flex justify-center items-center gap-2 bg-gray-800 text-sm border border-gray-700 mt-2">
                      <Loader2 size={16} className="animate-spin" /> Готовим ссылку...
                    </div>
                  )}
                  {tgBindFailed && (
                    <button onClick={openTgHelper} className="w-full py-2.5 rounded-lg font-bold text-red-300 transition-all flex justify-center items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-sm border border-red-500/30 mt-2">
                      Не удалось подготовить ссылку. Повторить
                    </button>
                  )}
                  <p className="text-xs text-gray-500 mt-2">Ссылка одноразовая и действует 15 минут. Не пересылайте её другим.</p>
                </div>

                <div className="w-full h-px bg-gray-800"></div>

                {/* ШАГ 2: Выбор канала (ИСПРАВЛЕНИЕ 3) */}
                {/* ШАГ 2: Выбор канала */}
                <div>
                  <div className="flex gap-3 items-start mb-2">
                    <div className="w-6 h-6 rounded-full bg-[#0088CC]/20 border border-[#0088CC]/50 flex items-center justify-center text-xs font-bold text-[#0088CC] shrink-0 mt-0.5">2</div>
                    <p className="text-sm text-gray-400">Выберите сообщество, куда нужно добавить бота</p>
                  </div>
                  
                  {/* Умная проверка лимита для ТГ */}
                  {isTgLimitReached || isTotalLimitReached ? (
                    <div className="w-full py-3.5 rounded-xl font-bold text-white transition-all flex justify-center items-center gap-3 bg-red-500/10 border border-red-500/30 text-sm mt-3 cursor-not-allowed">
                      <ShieldAlert size={18} className="text-red-400" /> Лимит каналов ({limits.tg}) исчерпан
                    </div>
                  ) : (
                    <a
                    href={`https://t.me/${TELEGRAM_BOT_NAME}?startchannel=true&admin=post_messages+edit_messages+delete_messages`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setShowTgHelperModal(false);
                      setTgCountBeforeWait(tgCount);
                      setIsWaitingForTg(true); // Включаем режим ожидания
                    }}
                      className="w-full py-3.5 rounded-xl font-bold text-white transition-all flex justify-center items-center gap-3 bg-[#0088CC] hover:bg-[#0077B3] shadow-lg shadow-[#0088CC]/20 active:scale-95 text-base mt-3"
                    >
                      <Plus size={18} /> Выбрать канал в Telegram
                    </a>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* === 3. ОКНО ВЫБОРА ГРУПП ВК (С ЛИЧНОЙ СТРАНИЦЕЙ) === */}
      {komodModal.isOpen && (
        <div key="modal-vk" className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setKomodModal({ isOpen: false, profileId: null })}></div>
          <div className="relative z-10 w-full max-w-lg bg-[#111318] border border-gray-700 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            
            <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-[#0077FF]/5 shrink-0">
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0077FF] flex items-center justify-center text-white shadow-lg shadow-[#0077FF]/30">
                    <Users size={20} />
                  </div>
                  Выберите страницы
                </h3>
                <p className={`text-sm mt-1.5 font-bold ${komodSelected.length >= (limits.vk - vkCount) ? 'text-red-400' : 'text-[#0077FF]'}`}>
                  Лимит: {vkCount + komodSelected.length} / {limits.vk} аккаунтов
                </p>
              </div>
              <button onClick={() => setKomodModal({ isOpen: false, profileId: null })} className="text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700 p-2 rounded-xl transition-colors self-start">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-2">
              {selectableGroups.map((group, index) => {
                const uniqueId = extractId(group) || `idx-${index}`;
                
                // === БРОНЕБОЙНАЯ ПРОВЕРКА ПОДКЛЮЧЕНИЯ ===
                const isPersonal = group.is_profile_dummy;
                const groupName = extractName(group) || 'Без названия';
                
                let isAlreadyConnected = false;

                if (isPersonal) {
  // ИСПРАВЛЕНИЕ: Ищем стену (wall_), которая привязана СТРОГО к текущему авторизованному профилю
                  isAlreadyConnected = connectedVk.some(acc =>
                    acc.profileId === komodModal.profileId && acc.providerId.startsWith('wall_')
                  );
                } else {
                  // 1. Достаем только голые цифры из ID модалки
                  const cleanVkId = String(group.uid || group.group_id || group.id || '').replace(/\D/g, '');
                  
                  // 2. Достаем хвостик ссылки
                  const screenName = group.screen_name || group.domain;
                  let urlPart = null;
                  if (group.url) {
                     urlPart = group.url.split('/').pop().replace(/^(club|public|event)/, '');
                  }

                  isAlreadyConnected = connectedVk.some(acc => {
                    const rawProviderId = String(acc.providerId).replace('group_', '');
                    // Чистые цифры из ID базы данных (игнорируем минусы)
                    const cleanAccId = rawProviderId.replace(/\D/g, ''); 

                    // Проверяем все возможные комбинации:
                    // А. Совпадение по цифрам (самое надежное)
                    if (cleanVkId && cleanVkId.length > 3 && cleanAccId === cleanVkId) return true;
                    // Б. Совпадение по буквенному ID (screen_name)
                    if (screenName && rawProviderId === String(screenName)) return true;
                    // В. Совпадение по ссылке
                    if (urlPart && rawProviderId === urlPart) return true;
                    // Г. Последний шанс: точное совпадение названия
                    if (acc.name === groupName && groupName !== 'Без названия') return true;

                    return false;
                  });
                }

                const isSelected = komodSelected.includes(uniqueId);
                
                // Умная логика блокировки
                const isVkModalLimitReached = komodSelected.length >= (limits.vk - vkCount);
                // Карточка блокируется, если УЖЕ подключена ИЛИ если исчерпан лимит
                const isLocked = isAlreadyConnected || (!isSelected && isVkModalLimitReached);
                
                const avatar = getValidAvatar(extractAvatar(group), groupName);

                return (
                  <div 
                    key={uniqueId} 
                    onClick={() => {
                      if (isLocked) return; // Если заблокировано - клик не работает
                      setKomodSelected(prev => isSelected ? prev.filter(id => id !== uniqueId) : [...prev, uniqueId]);
                    }}
                    className={`relative flex items-center gap-4 p-3 rounded-2xl transition-all border overflow-hidden ${
                      isAlreadyConnected ? 'bg-gray-900 border-gray-800 opacity-50 grayscale cursor-not-allowed' :
                      isSelected ? 'bg-[#0077FF]/10 border-[#0077FF] cursor-pointer' : 
                      isLocked ? 'bg-gray-900 border-red-500/20 opacity-50 cursor-not-allowed' : 
                      'bg-gray-900 border-gray-800 hover:bg-gray-800 cursor-pointer'
                    }`}
                  >
                    {/* ПЛАШКА: ПОДКЛЮЧЕН */}
                    {isAlreadyConnected && (
                      <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center backdrop-blur-[2px]">
                         <span className="text-xs font-bold text-gray-300 bg-gray-900/90 px-3 py-1.5 rounded-lg border border-gray-700 uppercase tracking-widest shadow-lg">Подключен</span>
                      </div>
                    )}

                    {/* ПЛАШКА: ЛИМИТ (с крестиком) */}
                    {isLocked && !isAlreadyConnected && (
                      <div className="absolute inset-0 bg-red-950/20 z-10 flex items-center justify-center backdrop-blur-[1px]">
                         <X size={40} className="text-red-500/50" strokeWidth={3} />
                      </div>
                    )}
                    
                    <img 
                      src={avatar} 
                      onError={(e) => { e.target.onerror = null; e.target.src = getValidAvatar(null, groupName); }} 
                      className="w-12 h-12 rounded-full object-cover border border-gray-700 shrink-0" 
                      alt="" 
                    />
                    
                    <div className="flex-1 min-w-0">
                      <span className="text-white font-bold text-sm block truncate">{groupName}</span>
                      {isPersonal && <span className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 block tracking-wide">Личная страница</span>}
                    </div>

                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${isAlreadyConnected ? 'border-gray-600 bg-gray-800' : isSelected ? 'bg-[#0077FF] border-[#0077FF]' : 'border-gray-600'}`}>
                      {isAlreadyConnected ? <Check size={14} className="text-gray-500" /> : isSelected && <Check size={14} className="text-white" />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-5 border-t border-gray-800 bg-[#0d0f13] shrink-0">
              <button 
                onClick={handleSaveKomodGroups}
                disabled={isSyncingVk || komodSelected.length === 0}
                className="w-full bg-[#0077FF] hover:bg-[#0066CC] disabled:opacity-50 text-white py-4 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-[#0077FF]/20 active:scale-95 text-base"
              >
                {isSyncingVk ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                Добавить выбранные ({komodSelected.length})
              </button>
            </div>

          </div>
        </div>
      )}


      

     
      {/* CSS Анимация для прогресс-бара */}
      <style>{`
        @keyframes custom-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-custom-progress {
          animation: custom-progress 1.5s infinite linear;
        }
      `}</style>

      {/* ЭКРАН ЗАГРУЗКИ (SADOVODPS Style) */}
      {(vkConnectStatus === 'syncing_profile' || vkConnectStatus === 'syncing_groups') && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-[#121212]/90 backdrop-blur-sm"></div>
           <div className="relative bg-[#1e1e1e] border border-gray-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center max-w-sm w-full animate-in zoom-in-95 duration-200">
              <Loader2 size={48} className="text-[#0077FF] animate-spin mb-5" />
              <h3 className="text-white font-bold text-xl text-center mb-2">Пожалуйста, подождите...</h3>
              <p className="text-gray-400 text-sm text-center">Идет загрузка страниц для подключения.</p>
           </div>
        </div>
      )}

      {/* 3. ЭКРАН УСПЕХА: ГРУППЫ */}
      {vkConnectStatus === 'groups_success' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setVkConnectStatus('idle')}></div>
           <div className="relative bg-[#111318] border border-emerald-500/30 rounded-3xl p-8 shadow-2xl flex flex-col items-center w-full max-w-sm animate-in zoom-in-95 duration-300">
              <div className="relative mb-5">
                <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 rounded-full"></div>
                <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center relative z-10">
                   <CheckCircle2 size={40} />
                </div>
              </div>
              <h3 className="text-white font-extrabold text-2xl text-center mb-3">Всё готово!</h3>
              <p className="text-gray-300 text-center mb-8 leading-relaxed">
                Выбранные сообщества <span className="text-white font-bold bg-white/10 px-2 py-0.5 rounded">({addedGroupsCount} шт.)</span> успешно добавлены. Теперь вы можете отправлять в них посты.
              </p>

              <button
                onClick={() => setVkConnectStatus('idle')}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 text-base"
              >
                Отлично
              </button>
           </div>
        </div>
      )}


      {/* ЭКРАН ОЖИДАНИЯ TELEGRAM */}
      {isWaitingForTg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-[#121212]/90 backdrop-blur-sm"></div>
           <div className="relative bg-[#1e1e1e] border border-gray-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center max-w-sm w-full animate-in zoom-in-95 duration-200">
              <div className="relative mb-6">
                <Loader2 size={48} className="text-[#2AABEE] animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <Send size={14} className="text-[#2AABEE]" />
                </div>
              </div>
              <h3 className="text-white font-bold text-xl text-center mb-2">Ожидание Telegram...</h3>
              <p className="text-gray-400 text-sm text-center mb-6">Как только вы добавите бота в канал, он автоматически появится в списке.</p>
              <button 
                onClick={() => setIsWaitingForTg(false)}
                className="text-gray-500 hover:text-white text-xs underline"
              >
                Отменить ожидание
              </button>
           </div>
        </div>
      )}

    </div>
  );
}

