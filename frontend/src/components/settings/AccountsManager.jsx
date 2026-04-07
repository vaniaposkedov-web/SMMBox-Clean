import { useEffect, useState, useRef } from 'react';
import { useStore } from '../../store';
import { useNavigate } from 'react-router-dom';
import { 
  Send, Plus, Trash2, RefreshCw, ShieldAlert,
  ChevronDown, Copy, Check, LayoutTemplate,
  Settings2, Image as ImageIcon, Type, X,
  Sliders, Type as TypeIcon, Upload, RotateCw, Palette,
  ArrowUpLeft, ArrowUp, ArrowUpRight, ArrowLeft, Crosshair, ArrowRight, ArrowDownLeft, ArrowDown, ArrowDownRight, Move, Loader2, CheckCircle2, UserCircle, UserPlus, Users, UserSquare2, Info
} from 'lucide-react';

import CustomTelegramButton from '../../components/CustomTelegramButton';
import CustomVkButton from '../../components/CustomVkButton';

export default function AccountsManager() {
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const accounts = useStore((state) => state.accounts) || [];
  const profiles = useStore((state) => state.profiles) || [];
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  const fetchProfiles = useStore((state) => state.fetchProfiles);
  
  const verifyAccountsStatus = useStore((state) => state.verifyAccountsStatus);
  const saveVkGroupWithToken = useStore((state) => state.saveVkGroupWithToken);
  const verifyVkAccountsStatus = useStore((state) => state.verifyVkAccountsStatus);
  const fetchVkManagedGroupsClient = useStore((state) => state.fetchVkManagedGroupsClient);
  const linkSocialProfile = useStore((state) => state.linkSocialProfile);
  const [tgError, setTgError] = useState('');

  const removeAccount = useStore((state) => state.removeAccount);
  const removeSocialProfile = useStore((state) => state.removeSocialProfile);
  const saveAccountDesign = useStore((state) => state.saveAccountDesign);
  const token = useStore((state) => state.token);

  const [isSyncingVk, setIsSyncingVk] = useState(false);
  

  const [inputs, setInputs] = useState({});
  const [loadingStates, setLoadingStates] = useState({});

  const [isRefreshingTg, setIsRefreshingTg] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);

  const [savingSignature, setSavingSignature] = useState({});
  const [savingWatermark, setSavingWatermark] = useState({});
  const [isModalSaving, setIsModalSaving] = useState(false);
  
  const [expandedId, setExpandedId] = useState(null);
  const [copied, setCopied] = useState(false);

  const [designModal, setDesignModal] = useState({ isOpen: false, account: null });
  const [showTgHelperModal, setShowTgHelperModal] = useState(false);
  
  const [watermarkTab, setWatermarkTab] = useState('simple'); 
  const [localWatermark, setLocalWatermark] = useState({});
  const [localSignatures, setLocalSignatures] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

  const [collapsedProfiles, setCollapsedProfiles] = useState({});
  const toggleProfileCollapse = (id) => setCollapsedProfiles(prev => ({ ...prev, [id]: !prev[id] }));

  

  const presetColors = ['#FFFFFF', '#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

  const posToCoords = {
    'tl': {x: 10, y: 15}, 'tc': {x: 50, y: 15}, 'tr': {x: 90, y: 15},
    'cl': {x: 10, y: 50}, 'cc': {x: 50, y: 50}, 'cr': {x: 90, y: 50},
    'bl': {x: 10, y: 85}, 'bc': {x: 50, y: 85}, 'br': {x: 90, y: 85}
  };

  const isPro = user?.isPro || false;
  const accountsLimit = 10;
  const currentCount = accounts.length;
  const isLimitReached = !isPro && currentCount >= accountsLimit;

  const [isRefreshingProfiles, setIsRefreshingProfiles] = useState(false);

  const handleRefreshProfiles = async () => {
    setIsRefreshingProfiles(true);
    await fetchProfiles(user.id);
    await fetchAccounts(user.id);
    setIsRefreshingProfiles(false);
  };

  useEffect(() => {
    if (user?.id) {
      fetchProfiles(user.id);
      fetchAccounts(user.id).then(() => {
        if (verifyAccountsStatus) verifyAccountsStatus();
        if (verifyVkAccountsStatus) verifyVkAccountsStatus();
      });
    }
  }, [user]);


  // Перехватываем хэш после возвращения от Kom-od
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vkHash = params.get('vk_komod_hash');

    if (vkHash) {
      window.history.replaceState({}, document.title, window.location.pathname);

      const finalizeAuth = async () => {
        setIsSyncingVk(true);
        const confirmResult = await useStore.getState().confirmVkKomod(vkHash);
        
        if (confirmResult.success) {
          await useStore.getState().syncVkKomod();
          await handleRefreshProfiles(); // Скачиваем обновленный профиль из базы
          setIsSyncingVk(false);
          
          // Магия: сразу предлагаем добавить группы!
          if (window.confirm('Профиль ВКонтакте успешно подключен!\nХотите сразу добавить ссылки на ваши сообщества для постинга?')) {
            setVkHackModal({ isOpen: true, pastedUrl: '' });
          }
        } else {
          alert('Ошибка привязки: ' + confirmResult.error);
          setIsSyncingVk(false);
        }
      };
      finalizeAuth();
    }
  }, []);

  // Функция для генерации ссылки и отправки пользователя
  const handleConnectVkOAuth = () => {
    const hash = 'vk_' + user.id + '_' + Date.now();
    const redirectUrl = encodeURIComponent(`${window.location.origin}/settings?vk_komod_hash=${hash}`);
    
    // ВНИМАНИЕ СЮДА: должно быть redirect_url=
    const authUrl = `https://kom-od.ru/connect/vk?hash=${hash}&redirect_uri=${redirectUrl}`;
    window.location.href = authUrl; 
  };

  // --- ПЕРЕХВАТЧИК ТОКЕНОВ ИЗ ВСПЛЫВАЮЩИХ ОКОН ВК ---
  useEffect(() => {
    if (window.opener && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);

      if (params.has('access_token') && !hash.includes('access_token_')) {
        // Поймали токен пользователя
        window.opener.postMessage({ type: 'VK_USER_TOKEN', token: params.get('access_token') }, '*');
        window.close();
      } else if (hash.includes('access_token_')) {
        // Поймали токены групп
        const groupTokens = {};
        for (const [key, value] of params.entries()) {
          if (key.startsWith('access_token_')) {
            groupTokens[key.replace('access_token_', '')] = value;
          }
        }
        window.opener.postMessage({ type: 'VK_GROUP_TOKENS', tokens: groupTokens }, '*');
        window.close();
      } else if (params.has('error')) {
        window.opener.postMessage({ type: 'VK_ERROR', error: params.get('error_description') }, '*');
        window.close();
      }
    }
  }, []);

  // Вспомогательная функция для JSONP
  const fetchGroupsViaJsonp = (token) => {
    return new Promise((resolve) => {
      const callbackName = 'vkcb_' + Math.round(Math.random() * 1000000);
      window[callbackName] = (data) => {
        delete window[callbackName];
        if (data.error) resolve({ error: data.error.error_msg });
        else resolve({ groups: data.response.items });
      };
      const script = document.createElement('script');
      script.src = `https://api.vk.com/method/groups.get?extended=1&filter=admin,editor&access_token=${token}&v=5.199&callback=${callbackName}`;
      document.body.appendChild(script);
    });
  };

  const handleVkSync = async () => {
    setIsSyncingVk(true);
    // Вызываем новую функцию из store.js (которую мы добавим на шаге 2)
    const result = await useStore.getState().syncVkKomod();
    setIsSyncingVk(false);
    
    if (result.success) {
      alert('Аккаунты и группы ВК успешно синхронизированы через шлюз!');
    } else {
      alert('Ошибка при синхронизации: ' + result.error);
    }
  };

  const tgProfiles = profiles.filter(p => p.provider === 'TELEGRAM');
  const vkProfiles = profiles.filter(p => p.provider === 'VK');

  const handleInputChange = (profileId, field, value) => {
    setInputs(prev => ({ ...prev, [`${profileId}_${field}`]: value }));
  };

  const copyBotName = (e) => {
    e.stopPropagation(); navigator.clipboard.writeText('@smmbox_auth_bot');
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };


// 1. Стейты для модального окна
  const [vkModal, setVkModal] = useState({ isOpen: false, profileId: null });
  const [vkGroupsList, setVkGroupsList] = useState([]);
  const [vkSelectedGroups, setVkSelectedGroups] = useState([]);
  const [isFetchingGroups, setIsFetchingGroups] = useState(false);

  

  const closeVkModal = () => setVkModal({ isOpen: false, profileId: null });
  const toggleVkGroupSelection = (groupId) => setVkSelectedGroups(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);

  
  

  // Функция для главной кнопки "Обновить"
  const handleRefreshTg = async () => {
    setIsRefreshingTg(true);
    await fetchAccounts(user.id);
    setIsRefreshingTg(false);
  };

  // Умная функция проверки конкретного аккаунта
  const handleVerifyAccount = async (e, acc) => {
    if (e) e.stopPropagation();
    setVerifyingId(acc.id); // Включаем спиннер только на нажатом аккаунте
    if (acc.provider === 'VK') {
      if (verifyVkAccountsStatus) await verifyVkAccountsStatus();
    } else {
      if (verifyAccountsStatus) await verifyAccountsStatus();
    }
    setVerifyingId(null); // Выключаем спиннер
  };
  const toggleExpand = (acc) => {
    if (expandedId === acc.id) { setExpandedId(null); } else { setExpandedId(acc.id); setLocalSignatures(prev => ({ ...prev, [acc.id]: acc.signature || '' })); }
  };

  const handleSignatureChange = (id, value) => { setLocalSignatures(prev => ({ ...prev, [id]: value })); };

  const saveSignatureOnly = async (acc) => { setSavingSignature(prev => ({ ...prev, [acc.id]: true })); await saveAccountDesign(acc.id, localSignatures[acc.id] || "", undefined); setSavingSignature(prev => ({ ...prev, [acc.id]: false })); };
  const setGlobalSignature = async (acc) => { setSavingSignature(prev => ({ ...prev, [acc.id]: true })); await saveAccountDesign(acc.id, null, undefined); setSavingSignature(prev => ({ ...prev, [acc.id]: false })); };
  const enableCustomSignature = async (acc) => { setSavingSignature(prev => ({ ...prev, [acc.id]: true })); await saveAccountDesign(acc.id, acc.signature || "", undefined); setSavingSignature(prev => ({ ...prev, [acc.id]: false })); };
  const setGlobalWatermark = async (acc) => { setSavingWatermark(prev => ({ ...prev, [acc.id]: true })); await saveAccountDesign(acc.id, undefined, null); setSavingWatermark(prev => ({ ...prev, [acc.id]: false })); };

  const openDesignModal = (acc) => {
    const initialPos = acc.watermark?.position || 'br';
    const coords = (acc.watermark?.x !== undefined && acc.watermark?.x !== null) ? {x: acc.watermark.x, y: acc.watermark.y} : posToCoords[initialPos];
    setLocalWatermark({
      type: 'text', text: 'SMMBOX', image: null, opacity: 90, size: 100, angle: 0,
      textColor: '#FFFFFF', bgColor: '#000000', hasBackground: true,
      ...acc.watermark, position: initialPos, x: coords.x, y: coords.y
    });
    setWatermarkTab('simple');
    setDesignModal({ isOpen: true, account: acc });
  };

  const closeDesignModal = () => setDesignModal({ isOpen: false, account: null });

  const handleSaveModalDesign = async () => {
    setIsModalSaving(true);
    const acc = designModal.account;
    const currentSignature = localSignatures[acc.id] || acc.signature;
    await saveAccountDesign(acc.id, currentSignature, localWatermark);
    setIsModalSaving(false);
    closeDesignModal();
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setLocalWatermark({ ...localWatermark, image: event.target.result, type: 'image' });
      reader.readAsDataURL(file);
    }
  };

  const handleAngleChange = (e) => {
    let val = Number(e.target.value);
    const snapPoints = [-180, -90, 0, 90, 180];
    for (let snap of snapPoints) { if (Math.abs(val - snap) <= 6) { val = snap; break; } }
    setLocalWatermark({...localWatermark, angle: val});
  };

  const handlePointerDown = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
    const rect = previewRef.current.getBoundingClientRect();
    const startMouseX = e.clientX || e.touches?.[0]?.clientX; const startMouseY = e.clientY || e.touches?.[0]?.clientY;
    const startWX = localWatermark.x ?? 50; const startWY = localWatermark.y ?? 50;

    const handlePointerMove = (moveEvent) => {
      if (moveEvent.cancelable) moveEvent.preventDefault(); 
      const clientX = moveEvent.clientX || moveEvent.touches?.[0]?.clientX; const clientY = moveEvent.clientY || moveEvent.touches?.[0]?.clientY;
      const percentDx = ((clientX - startMouseX) / rect.width) * 100; const percentDy = ((clientY - startMouseY) / rect.height) * 100;
      let newX = Math.max(0, Math.min(100, startWX + percentDx)); let newY = Math.max(0, Math.min(100, startWY + percentDy));
      setLocalWatermark(prev => ({ ...prev, x: newX, y: newY, position: 'custom' }));
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove); window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove); window.removeEventListener('touchend', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false }); window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false }); window.addEventListener('touchend', handlePointerUp);
  };

  const handleBackgroundClick = (e) => {
    if (e.target !== previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setLocalWatermark(prev => ({ ...prev, x, y, position: 'custom' }));
  };

  // === УЛЬТИМАТИВНЫЙ ХАК ДЛЯ ОБХОДА БЛОКИРОВОК ВКОНТАКТЕ ===
  const [vkHackModal, setVkHackModal] = useState({ isOpen: false, profileId: null, step: 1, pastedUrl: '', tempToken: '', mode: 'groups', profile: null });

  const startVkHackAuth = (profileId, mode = 'groups', profile = null) => {
    if (isLimitReached) {
      return alert('Лимит аккаунтов исчерпан! Оформите PRO тариф для снятия ограничений.');
    }
    setVkSelectedGroups([]); 
    setVkGroupsList([]);
    setVkHackModal({ isOpen: true, profileId, step: 1, pastedUrl: '', tempToken: '', mode, profile });
  };

  const openKateMobileAuth = () => {
    window.open(`https://oauth.vk.com/authorize?client_id=2685278&scope=groups,manage,wall,photos,offline&response_type=token&redirect_uri=https://oauth.vk.com/blank.html&display=popup`, '_blank', 'width=600,height=500');
  };

  const handlePasteUrl = async () => {
    const url = vkHackModal.pastedUrl;
    const tokenMatch = url.match(/access_token=([^&]+)/);
    
    if (!tokenMatch) return alert('Ссылка не содержит токен! Скопируйте всю адресную строку из окна ВК.');
    
    const extractedToken = tokenMatch[1];
    setVkHackModal(prev => ({ ...prev, tempToken: extractedToken }));
    setIsFetchingGroups(true);

    // ЕСЛИ ЭТО ПОДКЛЮЧЕНИЕ ЛИЧНОЙ СТРАНИЦЫ
    if (vkHackModal.mode === 'personal') {
      const profile = vkHackModal.profile;
      const personalGroupToSave = [{
        id: profile.providerAccountId, 
        name: profile.name + ' (Стена)',
        avatarUrl: profile.avatarUrl,
        accessToken: extractedToken
      }];

      try {
        const res = await fetch('/api/accounts/vk/save-group-tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ userId: user.id, profileId: profile.id, groups: personalGroupToSave })
        });
        const data = await res.json();
        if (data.success) {
          await fetchAccounts(user.id);
          alert('Постинг на стену активирован!');
          setVkHackModal({ isOpen: false, profileId: null, step: 1, pastedUrl: '', tempToken: '', mode: 'groups', profile: null });
        } else { alert(data.error || 'Ошибка'); }
      } catch (e) { alert('Ошибка сети'); }
      setIsFetchingGroups(false);
      return;
    }

    // ЕСЛИ ЭТО ПОДКЛЮЧЕНИЕ ГРУПП
    setVkHackModal(prev => ({ ...prev, step: 2 }));
    const res = await fetchGroupsViaJsonp(extractedToken);
    
    if (res.error) {
      alert(`Ошибка ВК: ${res.error}`);
      setVkHackModal(prev => ({ ...prev, step: 1 }));
    } else {
      const existingIds = accounts.filter(a => a.provider === 'VK').map(a => a.providerId);
      setVkGroupsList(res.groups.filter(g => !existingIds.includes(String(g.id))));
    }
    setIsFetchingGroups(false);
  };

 const saveHackGroups = async () => {
    if (vkSelectedGroups.length === 0) return;
    
    const profileId = vkHackModal.profileId;
    const vkToken = vkHackModal.tempToken; 
    
    setLoadingStates(prev => ({...prev, [profileId]: true}));
    setVkHackModal({ isOpen: false, profileId: null, step: 1, pastedUrl: '', tempToken: '' });

    // Формируем готовые объекты групп со всей инфой с фронтенда!
    const groupsToSave = vkGroupsList
      .filter(g => vkSelectedGroups.includes(g.id))
      .map(g => ({
        id: g.id,
        name: g.name,
        avatarUrl: g.photo_50,
        accessToken: vkToken
      }));

    try {
      const res = await fetch('/api/accounts/vk/save-group-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, profileId, groups: groupsToSave })
      });
      const data = await res.json();
      
      if (data.success) {
        await fetchAccounts(user.id);
        alert('Сообщества успешно подключены!');
      } else {
        alert(data.error || 'Ошибка при сохранении');
      }
    } catch (e) {
      alert('Ошибка соединения с сервером');
    }
    setLoadingStates(prev => ({...prev, [profileId]: false}));
  };

  const PositionGridButtons = () => {
    const positions = [
      { id: 'tl', icon: ArrowUpLeft }, { id: 'tc', icon: ArrowUp }, { id: 'tr', icon: ArrowUpRight },
      { id: 'cl', icon: ArrowLeft },   { id: 'cc', icon: Crosshair }, { id: 'cr', icon: ArrowRight },
      { id: 'bl', icon: ArrowDownLeft }, { id: 'bc', icon: ArrowDown }, { id: 'br', icon: ArrowDownRight }
    ];

    const handleGridClick = (posId) => {
      const coords = posToCoords[posId];
      setLocalWatermark({...localWatermark, position: posId, x: coords.x, y: coords.y});
    };

    return (
      <div className="grid grid-cols-3 gap-2 bg-black/30 p-2.5 rounded-xl border border-gray-800">
        {positions.map(pos => {
          const Icon = pos.icon; const isActive = localWatermark.position === pos.id;
          return (
            <button 
              key={pos.id} onClick={() => handleGridClick(pos.id)}
              className={`h-11 rounded-lg flex items-center justify-center transition-all ${isActive ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] scale-95' : 'bg-gray-800/80 text-gray-500 hover:bg-gray-700 hover:text-gray-300 border border-gray-700/50'}`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            </button>
          )
        })}
      </div>
    );
  };

  const ColorPicker = ({ label, colorKey, hasCheckbox, checkboxKey }) => {
    return (
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-400 uppercase flex justify-between items-center min-h-[24px]">
          {label}
          {hasCheckbox && ( <input type="checkbox" checked={localWatermark[checkboxKey] !== false} onChange={e => setLocalWatermark({...localWatermark, [checkboxKey]: e.target.checked})} className="accent-blue-500 w-5 h-5 cursor-pointer" /> )}
        </label>
        <div className={`space-y-2 transition-opacity duration-200 ${(hasCheckbox && localWatermark[checkboxKey] === false) ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center gap-2 bg-black/40 border border-gray-700 rounded-xl p-1.5 pr-3 w-full min-h-[44px]">
            <input type="color" value={localWatermark[colorKey] || '#FFFFFF'} onChange={e => setLocalWatermark({...localWatermark, [colorKey]: e.target.value})} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0" />
            <span className="text-base sm:text-sm font-mono text-gray-300 uppercase flex-1">{localWatermark[colorKey] || '#FFFFFF'}</span>
            <Palette size={16} className="text-gray-500 shrink-0"/>
          </div>
          <div className="flex gap-2 justify-between pt-1">
            {presetColors.map(c => ( <button key={c} onClick={() => setLocalWatermark({...localWatermark, [colorKey]: c})} className="w-6 h-6 sm:w-5 sm:h-5 rounded-full border border-gray-600 transition-transform hover:scale-110 shadow-sm" style={{ backgroundColor: c }} /> ))}
          </div>
        </div>
      </div>
    );
  };

  const handleAddTgChannel = async (profileId) => {
    if (isLimitReached) return alert('Лимит аккаунтов исчерпан! Оформите PRO.');
    const link = inputs[`${profileId}_tgLink`];
    if (!link?.trim()) return alert('Введите ссылку канала!');
    
    setLoadingStates(prev => ({...prev, [profileId]: true}));
    try {
      const infoRes = await fetch(`/api/auth/tg-chat-info`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: link })
      });
      const infoData = await infoRes.json();

      if (!infoData.success) {
        alert(infoData.error || 'Канал не найден. Бот назначен администратором?');
        setLoadingStates(prev => ({...prev, [profileId]: false})); return;
      }

      const saveRes = await fetch(`/api/accounts/tg/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, socialProfileId: profileId, channels: [{ chatId: infoData.chatId || infoData.username, title: infoData.title, avatar: infoData.avatar }] })
      });
      const saveData = await saveRes.json();

      if (saveData.success) {
        handleInputChange(profileId, 'tgLink', '');
        await fetchProfiles(user.id); 
        await fetchAccounts(user.id); 
        if (verifyAccountsStatus) verifyAccountsStatus(); 
      } else {
        alert(saveData.error || 'Ошибка сохранения аккаунта');
      }
    } catch (error) { alert('Ошибка соединения с сервером'); }
    setLoadingStates(prev => ({...prev, [profileId]: false}));
  };

  const handleAddVkGroup = async (profileId) => {
    if (isLimitReached) return alert('Лимит аккаунтов исчерпан! Оформите PRO.');
    const link = inputs[`${profileId}_vkLink`];
    const vkToken = inputs[`${profileId}_vkToken`];
    if (!link?.trim() || !vkToken?.trim()) return alert('Заполните ссылку и токен API!');
    
    setLoadingStates(prev => ({...prev, [profileId]: true}));
    const res = await saveVkGroupWithToken(user.id, link, vkToken, profileId);
    
    if (res.success) {
      handleInputChange(profileId, 'vkLink', '');
      handleInputChange(profileId, 'vkToken', '');
      await fetchAccounts(user.id);
    } else {
      alert(res.error || 'Ошибка при добавлении группы');
    }
    setLoadingStates(prev => ({...prev, [profileId]: false}));
  };


  const renderAccountCard = (acc, providerIcon, providerColor) => {
    const isExpanded = expandedId === acc.id;
    const hasCustomWatermark = !!acc.watermark;
    const hasCustomSignature = acc.signature !== null;

    const borderClasses = acc.isValid
      ? isExpanded
        ? 'bg-gradient-to-r from-emerald-500/20 to-gray-900/50 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
        : 'bg-gradient-to-r from-emerald-500/10 to-gray-900/40 border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
      : isExpanded
        ? 'bg-gradient-to-r from-rose-500/20 to-gray-900/50 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
        : 'bg-gradient-to-r from-rose-500/10 to-gray-900/40 border-rose-500/30 hover:border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)]';

    return (
      <div key={acc.id} className={`flex flex-col transition-all duration-300 rounded-2xl overflow-hidden border ${borderClasses}`}>
        <div onClick={() => toggleExpand(acc)} className="p-3 sm:p-4 min-h-[64px] flex items-center justify-between cursor-pointer group hover:bg-white/[0.03] transition-colors">
          <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
            <div className="relative shrink-0">
              <img src={acc.avatarUrl || 'https://via.placeholder.com/150'} alt="avatar" className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-gray-700 object-cover" />
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${providerColor} border-2 border-gray-900`}>
                {providerIcon}
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="font-bold text-gray-100 truncate text-sm sm:text-base">{acc.name}</h3>
              <div className="flex items-center mt-0.5 sm:mt-1">
                {acc.isValid ? (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-emerald-400 bg-emerald-400/20 border border-emerald-500/20 px-2 py-0.5 rounded-full whitespace-nowrap shadow-[0_0_5px_rgba(16,185,129,0.3)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Подключено
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Ошибка
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={`shrink-0 text-gray-500 transition-transform duration-300 ml-1 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown size={20} />
          </div>
        </div>

        <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="p-3 sm:p-4 border-t border-gray-800/50 bg-gray-950/40 space-y-5 sm:space-y-6">
              
              {!acc.isValid && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                  <p className="font-bold text-rose-400 flex items-center gap-2 mb-2 text-sm"><ShieldAlert size={16} /> Требуется настройка</p>
                  <p className="text-gray-300 text-xs sm:text-sm mb-3">{acc.errorMsg || 'Ошибка подключения.'}</p>
                  
                  {acc.provider === 'TELEGRAM' && (
                    <>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-gray-400 bg-black/30 p-2.5 rounded-lg mb-3 gap-2">
                        <span className="truncate w-full sm:w-auto">Бот: <span className="font-mono text-white">@smmbox_auth_bot</span></span>
                        <button onClick={copyBotName} className="shrink-0 w-full sm:w-auto text-gray-400 hover:text-white transition-colors bg-gray-800 px-3 py-2.5 sm:py-1.5 rounded-md flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-0">
                          {copied ? <><Check size={14} className="text-emerald-500" /> Сохранено</> : <><Copy size={14} /> Копировать</>}
                        </button>
                      </div>

                      {/* НОВАЯ КНОПКА ВОЗВРАТА БОТА */}
                      <a 
                        href="https://t.me/smmbox_auth_bot?startchannel=true&admin=post_messages+edit_messages+delete_messages"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full mb-3 bg-[#0088CC]/20 hover:bg-[#0088CC]/30 text-[#0088CC] border border-[#0088CC]/30 py-3 sm:py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                      >
                        <Plus size={16} /> Вернуть бота в канал
                      </a>
                    </>
                  )}

                  {acc.provider === 'VK' ? (
                    <button onClick={(e) => handleVerifyAccount(e, acc)} disabled={verifyingId === acc.id} className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 py-3 sm:py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px]">
                      <RefreshCw size={16} className={verifyingId === acc.id ? "animate-spin" : ""} /> Проверить ключ ВК
                    </button>
                  ) : (
                    <button onClick={(e) => handleVerifyAccount(e, acc)} disabled={verifyingId === acc.id} className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 py-3 sm:py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px]">
                      <RefreshCw size={16} className={verifyingId === acc.id ? "animate-spin" : ""} /> Проверить статус бота
                    </button>
                  )}
                </div>
              )}

              {acc.isValid && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Type size={14}/> Подпись к постам</label>
                      {hasCustomSignature ? (
                        <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">Своя</span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">Шаблон</span>
                      )}
                    </div>

                    <div className="flex p-1 bg-black/40 rounded-xl border border-gray-800">
                      <button onClick={() => setGlobalSignature(acc)} disabled={savingSignature[acc.id]} className={`flex-1 py-2 sm:py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0 ${!hasCustomSignature ? 'bg-gray-800 text-white border-gray-600 shadow-inner' : 'bg-transparent text-gray-500 hover:text-gray-300'}`}>
                        {savingSignature[acc.id] && !hasCustomSignature ? <Loader2 size={16} className="animate-spin"/> : <LayoutTemplate size={16}/>} <span>Шаблон</span>
                      </button>
                      <button onClick={() => enableCustomSignature(acc)} disabled={savingSignature[acc.id]} className={`flex-1 py-2 sm:py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0 ${hasCustomSignature ? 'bg-blue-600/10 text-blue-400 border-blue-500/30' : 'bg-transparent text-gray-500 hover:text-gray-300'}`}>
                         <Settings2 size={16} /> <span>Своя</span>
                      </button>
                    </div>

                    {!hasCustomSignature ? (
                      <div className="mt-2.5 bg-gray-900/50 p-3 sm:p-3 rounded-lg border border-gray-800/50 flex items-center gap-3">
                        <div className="p-2 bg-gray-800 rounded-md text-gray-400"><LayoutTemplate size={16}/></div>
                        <p className="text-xs text-gray-400 leading-relaxed">Используется <span className="text-gray-300 font-semibold">Шаблон</span> проекта.</p>
                      </div>
                    ) : (
                      <div className="mt-2.5 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200">
                        <input 
                          type="text" value={localSignatures[acc.id] !== undefined ? localSignatures[acc.id] : ''}
                          onChange={(e) => handleSignatureChange(acc.id, e.target.value)}
                          placeholder="Например: t.me/mychannel" 
                          className="w-full bg-black/40 border border-gray-700 rounded-lg py-3 sm:py-2.5 px-3 text-base sm:text-sm text-white focus:outline-none focus:border-blue-500 transition-colors min-h-[48px]"
                        />
                        <button onClick={() => saveSignatureOnly(acc)} disabled={savingSignature[acc.id]} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-3 sm:py-2.5 rounded-lg text-sm font-medium transition-colors border border-gray-700 min-h-[48px]">
                          {savingSignature[acc.id] ? <Loader2 size={16} className="animate-spin" /> : <Check size={16}/>} <span>Сохранить подпись</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-5 border-t border-gray-800/50">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><ImageIcon size={14}/> Водяной знак</label>
                      {hasCustomWatermark ? (
                        <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">Свой</span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">Шаблон</span>
                      )}
                    </div>
                    
                    <div className="flex p-1 bg-black/40 rounded-xl border border-gray-800">
                      <button onClick={() => setGlobalWatermark(acc)} disabled={savingWatermark[acc.id]} className={`flex-1 py-2 sm:py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0 ${!hasCustomWatermark ? 'bg-gray-800 text-white border-gray-600 shadow-inner' : 'bg-transparent text-gray-500 hover:text-gray-300'}`}>
                        {savingWatermark[acc.id] && !hasCustomWatermark ? <Loader2 size={16} className="animate-spin"/> : <LayoutTemplate size={16}/>} <span>Шаблон</span>
                      </button>
                      <button onClick={() => openDesignModal(acc)} disabled={savingWatermark[acc.id]} className={`flex-1 py-2 sm:py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0 ${hasCustomWatermark ? 'bg-blue-600/10 text-blue-400 border-blue-500/30' : 'bg-transparent text-gray-500 hover:text-gray-300'}`}>
                         <Settings2 size={16} /> <span>Свой</span>
                      </button>
                    </div>

                    {!hasCustomWatermark ? (
                      <div className="mt-2.5 bg-gray-900/50 p-3 rounded-lg border border-gray-800/50 flex items-center gap-3">
                        <div className="p-2 bg-gray-800 rounded-md text-gray-400"><LayoutTemplate size={16}/></div>
                        <p className="text-xs text-gray-400 leading-relaxed">Используется <span className="text-gray-300 font-semibold">Шаблон</span> проекта.</p>
                      </div>
                    ) : (
                      <div className="mt-2.5 bg-blue-500/5 p-3 rounded-xl border border-blue-500/20 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/10 rounded-md text-blue-400">
                             {acc.watermark?.type === 'image' ? <ImageIcon size={16}/> : <Type size={16}/>}
                          </div>
                          <p className="text-xs text-blue-300 leading-relaxed flex-1">Для этой группы активен <span className="font-semibold text-blue-400">свой дизайн</span>.</p>
                        </div>
                        <button onClick={() => openDesignModal(acc)} className="w-full py-3 sm:py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0">
                          <Settings2 size={16} /> Изменить настройки
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="pt-4 border-t border-gray-800/50 flex justify-end">
                <button onClick={() => removeAccount(acc.id)} className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-400 transition-colors py-3 sm:py-2 px-3 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg min-h-[44px] sm:min-h-0">
                  <Trash2 size={16} /> Отключить
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-10 max-w-7xl mx-auto px-2 sm:px-4 w-full font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight px-1 sm:px-0">Мои социальные сети</h1>
      </div>

      {!isPro && (
        <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${isLimitReached ? 'bg-red-500/10 border-red-500/30 shadow-lg shadow-red-500/10' : 'bg-gray-900 border-gray-800'}`}>
          <div>
            <p className="text-white font-bold text-base flex items-center gap-2">
              Бесплатный тариф {isLimitReached && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest">Лимит исчерпан</span>}
            </p>
            <p className="text-gray-400 text-sm mt-1">Привязано аккаунтов (ВК + ТГ): <span className={isLimitReached ? 'text-red-400 font-bold' : 'text-white font-bold'}>{currentCount} / {accountsLimit}</span></p>
          </div>
          <button onClick={() => navigate('/profile')} className="w-full sm:w-auto text-sm bg-purple-600 hover:bg-purple-500 text-white px-6 py-3.5 sm:py-3 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 active:scale-95 whitespace-nowrap min-h-[48px]">
            Снять лимит (PRO)
          </button>
        </div>
      )}

      {/* ================= ИНФОРМАЦИОННЫЕ БЛОКИ (СПРАВОЧНИК) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
        
        {/* ИНСТРУКЦИЯ TELEGRAM */}
        <div className="bg-gradient-to-br from-[#0088CC]/10 to-transparent border border-[#0088CC]/20 rounded-3xl p-5 sm:p-8 relative overflow-hidden flex flex-col h-full shadow-lg shadow-[#0088CC]/5">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#0088CC]/20 blur-[60px] rounded-full pointer-events-none"></div>
          
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-3 mb-6 relative z-10">
            <div className="w-10 h-10 rounded-full bg-[#0088CC]/10 border border-[#0088CC]/20 flex items-center justify-center shrink-0">
              <Info size={20} className="text-[#0088CC]" />
            </div>
            Инструкция Telegram
          </h2>
          
          <ol className="relative border-l border-[#0088CC]/30 ml-4 space-y-6 flex-1 z-10">
             <li className="pl-6 relative">
               <span className="absolute -left-[13px] top-0 w-6 h-6 bg-[#0d0f13] border-2 border-[#0088CC] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-[0_0_10px_rgba(0,136,204,0.3)]">1</span>
               <p className="text-sm sm:text-[15px] text-gray-300 leading-relaxed mt-0.5">
                 В блоке ниже (под вашим профилем) нажмите кнопку <b className="text-white">«Добавить бота в канал»</b>.
               </p>
             </li>
             <li className="pl-6 relative">
               <span className="absolute -left-[13px] top-0 w-6 h-6 bg-[#0d0f13] border-2 border-[#0088CC] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-[0_0_10px_rgba(0,136,204,0.3)]">2</span>
               <p className="text-sm sm:text-[15px] text-gray-300 leading-relaxed mt-0.5">
                 В открывшемся приложении Telegram <b>выберите ваш канал</b> (все права настроятся автоматически) и нажмите «Добавить».
               </p>
             </li>
             <li className="pl-6 relative">
               <span className="absolute -left-[13px] top-0 w-6 h-6 bg-[#0d0f13] border-2 border-[#0088CC] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-[0_0_10px_rgba(0,136,204,0.3)]">3</span>
               <p className="text-sm sm:text-[15px] text-gray-300 leading-relaxed mt-0.5">
                 Вернитесь на эту страницу и нажмите кнопку <b className="text-white">«Обновить»</b> — канал моментально появится в списке!
               </p>
             </li>
          </ol>
        </div>

        {/* ИНСТРУКЦИЯ ВКОНТАКТЕ */}
        <div className="bg-gradient-to-br from-[#0077FF]/10 to-transparent border border-[#0077FF]/20 rounded-3xl p-5 sm:p-8 relative overflow-hidden flex flex-col h-full shadow-lg shadow-[#0077FF]/5">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#0077FF]/20 blur-[60px] rounded-full pointer-events-none"></div>
          
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-3 mb-6 relative z-10">
            <div className="w-10 h-10 rounded-full bg-[#0077FF]/10 border border-[#0077FF]/20 flex items-center justify-center shrink-0">
              <Info size={20} className="text-[#0077FF]" />
            </div>
            Инструкция ВКонтакте
          </h2>
          
          <ol className="relative border-l border-[#0077FF]/30 ml-4 space-y-6 flex-1 z-10">
             <li className="pl-6 relative">
               <span className="absolute -left-[13px] top-0 w-6 h-6 bg-[#0d0f13] border-2 border-[#0077FF] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-[0_0_10px_rgba(0,119,255,0.3)]">1</span>
               <p className="text-sm sm:text-[15px] text-gray-300 leading-relaxed mt-0.5">
                 В блоке ниже нажмите <b className="text-white">«Добавить сообщества»</b> или <b>«Подключить стену»</b> в шапке вашего профиля.
               </p>
             </li>
             <li className="pl-6 relative">
               <span className="absolute -left-[13px] top-0 w-6 h-6 bg-[#0d0f13] border-2 border-[#0077FF] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-[0_0_10px_rgba(0,119,255,0.3)]">2</span>
               <p className="text-sm sm:text-[15px] text-gray-300 leading-relaxed mt-0.5">
                 Нажмите <b>«Получить безопасный ключ ВК»</b> и разрешите доступ приложению в открывшемся окне.
               </p>
             </li>
             <li className="pl-6 relative">
               <span className="absolute -left-[13px] top-0 w-6 h-6 bg-[#0d0f13] border-2 border-[#0077FF] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-[0_0_10px_rgba(0,119,255,0.3)]">3</span>
               <p className="text-sm sm:text-[15px] text-gray-300 leading-relaxed mt-0.5">
                 Вы увидите пустую страницу. <b>Скопируйте всю ссылку</b> из адресной строки браузера, вставьте её на нашем сайте и выберите нужные группы галочками!
               </p>
             </li>
          </ol>
        </div>

      </div>

      {/* ================= УПРАВЛЕНИЕ КАНАЛАМИ TELEGRAM ================= */}
      <div className="bg-[#0d0f13] border border-gray-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-5 mt-6 sm:mt-8 shadow-xl">
        <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
          <div className="w-10 h-10 rounded-full bg-[#0088CC]/10 flex items-center justify-center text-[#0088CC]">
            <Send size={20} />
          </div>
          <h2 className="text-lg font-bold text-white">Управление каналами Telegram</h2>
        </div>

        {tgProfiles.length === 0 && (
          <div className="text-center py-10 bg-gray-900/20 border border-gray-800/50 rounded-2xl border-dashed">
            <p className="text-gray-400 text-sm px-4 mb-4">Для добавления каналов сначала привяжите ваш профиль Telegram.</p>
          </div>
        )}

        {tgProfiles.map(profile => (
          <div key={profile.id} className="mb-2 bg-gray-900/30 p-4 sm:p-5 rounded-2xl border border-gray-800 flex flex-col">
            
            {/* Шапка профиля ТГ (Идеальная и без стены) */}
            <div 
              className="flex items-center justify-between p-3 bg-gray-800/60 rounded-xl border border-[#0088CC]/30 relative z-10 cursor-pointer hover:bg-gray-800/80 transition-colors gap-2" 
              onClick={() => toggleProfileCollapse(profile.id)}
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <img src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${profile.name}&background=0088CC&color=fff`} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-gray-700 shrink-0" alt="TG" />
                <div className="min-w-0">
                  <div className="text-white font-bold text-sm sm:text-base truncate leading-tight">
                    {profile.name}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-0.5 shrink-0 ml-auto pl-1.5 sm:pl-3">
                <button className="p-1 text-gray-400 hover:text-white rounded-md transition-all">
                  <ChevronDown size={18} className={`transition-transform duration-300 ${collapsedProfiles[profile.id] ? '-rotate-90' : 'rotate-0'}`} />
                </button>
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (window.confirm(`Отключить профиль Telegram "${profile.name}" и все связанные каналы?`)) {
                      await removeSocialProfile(profile.id);
                    }
                  }}
                  className="p-1 text-gray-500 hover:text-rose-500 rounded-md transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Дерево элементов ТГ (Плавное скрытие) */}
            <div className={`grid transition-all duration-300 ease-in-out ${collapsedProfiles[profile.id] ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
              <div className="overflow-hidden">
                <div className="flex flex-col gap-4 mt-3 ml-[28px] sm:ml-[31px] pl-4 sm:pl-5 border-l-2 border-gray-800/60 pb-2 relative">
                  {accounts.filter(a => a.provider === 'TELEGRAM' && (a.profileId === profile.id || (!a.profileId && profile.id === tgProfiles[0]?.id))).map(acc => (
                    <div key={acc.id} className="relative">
                      {/* Горизонтальная линия связи */}
                      <div className="absolute top-[31px] -left-4 sm:-left-5 w-4 sm:w-5 h-[2px] bg-gray-800/60"></div>
                      {renderAccountCard(acc, <Send size={8} className="text-white"/>, 'bg-[#0088CC]')}
                    </div>
                  ))}
                  
                  {/* === НОВАЯ МАГИЧЕСКАЯ КНОПКА TELEGRAM === */}
                  <div className="relative flex flex-col sm:flex-row gap-3 w-full mt-2">
                    <div className="absolute top-[24px] sm:top-[24px] -left-4 sm:-left-5 w-4 sm:w-5 h-[2px] bg-gray-800/60"></div>
                    
                    {/* Кнопка с проверкой лимита */}
                    {isLimitReached ? (
                      <button 
                        onClick={() => alert('Лимит аккаунтов исчерпан! Оформите PRO тариф для снятия ограничений.')}
                        className="flex-1 w-full bg-[#0088CC]/5 text-[#0088CC]/50 border border-[#0088CC]/10 px-6 py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 font-bold cursor-not-allowed text-center"
                      >
                        <Plus size={18} />
                        <span>Добавить бота в канал</span>
                      </button>
                    ) : (
                      <a 
                        href="https://t.me/smmbox_auth_bot?startchannel=true&admin=post_messages+edit_messages+delete_messages"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 w-full bg-[#0088CC]/10 hover:bg-[#0088CC]/20 text-[#0088CC] border border-[#0088CC]/30 px-6 py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 font-bold shadow-sm active:scale-95 text-center"
                      >
                        <Plus size={18} />
                        <span>Добавить бота в канал</span>
                      </a>
                    )}

                    <button 
                      onClick={handleRefreshTg}
                      disabled={isRefreshingTg}
                      className="shrink-0 w-full sm:w-auto bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-5 py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 font-bold shadow-sm active:scale-95"
                    >
                      <RefreshCw size={18} className={isRefreshingTg ? "animate-spin" : ""} />
                      <span className="sm:hidden">{isRefreshingTg ? 'Обновление...' : 'Обновить'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        ))}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 bg-gray-800/30 rounded-xl border border-gray-700/50 border-dashed hover:bg-gray-800/50 transition-colors gap-4 mt-2">
          <div className="flex flex-col">
            <span className="text-gray-300 font-bold text-sm flex items-center gap-2">
              <UserPlus size={18} className="text-gray-400"/> Подключить {tgProfiles.length > 0 ? 'еще один ' : ''}профиль
            </span>
            <span className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              Безопасная привязка напрямую через Telegram-бота (без блокировок и сбоев).
            </span>
          </div>

          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            <button 
              onClick={handleRefreshProfiles} 
              disabled={isRefreshingProfiles} 
              className="shrink-0 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white w-12 h-12 flex items-center justify-center rounded-xl transition-all shadow-sm active:scale-95"
              title="Обновить список профилей"
            >
              <RefreshCw size={18} className={isRefreshingProfiles ? "animate-spin" : ""} />
            </button>
            <button 
              onClick={() => setShowTgHelperModal(true)} 
              className="flex-1 sm:flex-none shrink-0 whitespace-nowrap bg-[#0088CC] hover:bg-[#0077B3] text-white px-5 h-12 rounded-xl font-bold transition-all text-sm shadow-lg shadow-[#0088CC]/20 active:scale-95"
            >
               {tgProfiles.length > 0 ? 'Добавить аккаунт' : 'Привязать Telegram'}
            </button>
          </div>
        </div>
      </div> {/* <--- Этот закрывающий DIV держит структуру страницы */}

    

      {/* ================= УПРАВЛЕНИЕ ВКОНТАКТЕ ================= */}
      <div className="bg-[#0d0f13] border border-gray-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-5 mt-6 sm:mt-8 shadow-xl">
        <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
          <div className="w-10 h-10 rounded-full bg-[#0077FF]/10 flex items-center justify-center text-[#0077FF]">
            <Users size={20} />
          </div>
          <h2 className="text-lg font-bold text-white">Управление ВКонтакте</h2>
        </div>

        {vkProfiles.length === 0 && (
          <div className="text-center py-10 bg-gray-900/20 border border-gray-800/50 rounded-2xl border-dashed">
            <p className="text-gray-400 text-sm px-4 mb-4">Для добавления сообществ сначала авторизуйте профиль ВКонтакте.</p>
          </div>
        )}

        {vkProfiles.map(profile => (
          <div key={profile.id} className="mb-2 bg-gray-900/30 p-4 sm:p-5 rounded-2xl border border-gray-800 flex flex-col">
            
            {/* Шапка профиля ВК */}
            <div 
              className="flex items-center justify-between p-3 bg-gray-800/60 rounded-xl border border-[#0077FF]/30 relative z-10 cursor-pointer hover:bg-gray-800/80 transition-colors gap-2" 
              onClick={() => toggleProfileCollapse(profile.id)}
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <img src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=0077FF&color=fff`} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-gray-700 shrink-0" alt="VK" />
                <div className="min-w-0">
                  <div className="text-white font-bold text-sm sm:text-base truncate leading-tight">
                    {profile.name}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-0.5 shrink-0 ml-auto pl-1.5 sm:pl-3">
                <button className="p-1 text-gray-400 hover:text-white rounded-md transition-all">
                  <ChevronDown size={18} className={`transition-transform duration-300 ${collapsedProfiles[profile.id] ? '-rotate-90' : 'rotate-0'}`} />
                </button>
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (window.confirm(`Отключить профиль ВКонтакте "${profile.name}" и все связанные с ним страницы?`)) {
                      await removeSocialProfile(profile.id);
                    }
                  }}
                  className="p-1 text-gray-500 hover:text-rose-500 rounded-md transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Дерево элементов ВК */}
            <div className={`grid transition-all duration-300 ease-in-out ${collapsedProfiles[profile.id] ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
              <div className="overflow-hidden">
                <div className="flex flex-col gap-4 mt-3 ml-[28px] sm:ml-[31px] pl-4 sm:pl-5 border-l-2 border-gray-800/60 pb-2 relative">
                  {accounts.filter(a => a.provider === 'VK' && a.profileId === profile.id).map(acc => (
                    <div key={acc.id} className="relative">
                      <div className="absolute top-[31px] -left-4 sm:-left-5 w-4 sm:w-5 h-[2px] bg-gray-800/60"></div>
                      {renderAccountCard(acc, <Users size={8} className="text-white"/>, 'bg-[#0077FF]')}
                    </div>
                  ))}
                  
                  <div className="relative flex flex-col sm:flex-row gap-3 w-full mt-2">
                    <div className="absolute top-[24px] sm:top-[24px] -left-4 sm:-left-5 w-4 sm:w-5 h-[2px] bg-gray-800/60"></div>
                    
                    <button 
                      onClick={() => setVkHackModal({isOpen: true})}
                      className="flex-1 w-full bg-[#0077FF]/10 hover:bg-[#0077FF]/20 text-[#0077FF] border border-[#0077FF]/30 px-6 py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 font-bold shadow-sm active:scale-95 text-center"
                    >
                      <Plus size={18} />
                      <span>Добавить сообщество (по ссылке)</span>
                    </button>

                    <button 
                      onClick={handleVkSync}
                      disabled={isSyncingVk}
                      className="shrink-0 w-full sm:w-auto bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-5 py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 font-bold shadow-sm active:scale-95"
                    >
                      <RefreshCw size={18} className={isSyncingVk ? "animate-spin" : ""} />
                      <span className="sm:hidden">{isSyncingVk ? 'Синхронизация...' : 'Синхронизировать'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        ))}

        {/* Кнопка авторизации (Вынесена вниз как в ТГ) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 bg-gray-800/30 rounded-xl border border-gray-700/50 border-dashed hover:bg-gray-800/50 transition-colors gap-4 mt-2">
          <div className="flex flex-col">
            <span className="text-gray-300 font-bold text-sm flex items-center gap-2">
              <UserPlus size={18} className="text-gray-400"/> Подключить {vkProfiles.length > 0 ? 'еще один ' : ''}профиль ВК
            </span>
            <span className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              Основной аккаунт для постинга на стену и привязки сообществ.
            </span>
          </div>

          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            <button 
              onClick={handleConnectVkOAuth} 
              className="flex-1 sm:flex-none shrink-0 whitespace-nowrap bg-[#0077FF] hover:bg-[#0066CC] text-white px-5 h-12 rounded-xl font-bold transition-all text-sm shadow-lg shadow-[#0077FF]/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <UserCircle size={18} />
               {vkProfiles.length > 0 ? 'Добавить аккаунт' : 'Авторизовать ВК'}
            </button>
          </div>
        </div>
      </div>

       

      {/* МОДАЛЬНОЕ ОКНО ДИЗАЙНА */}
      {designModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeDesignModal}></div>
          <div className="relative w-full max-w-lg bg-[#111318] border-t sm:border border-gray-700 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] pb-[max(0px,env(safe-area-inset-bottom))] sm:pb-0 z-10 transition-transform">
            
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800 bg-gray-900/50 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 pr-4 truncate"><ImageIcon size={18} className="text-blue-400 shrink-0"/> Настройка дизайна</h3>
              <button onClick={closeDesignModal} className="text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700 p-2 sm:p-1.5 rounded-full sm:rounded-lg transition-colors shrink-0">
                <X size={20} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#111318] flex flex-col">
              <div className="p-4 sm:p-5 bg-black/50 border-b border-gray-800 shrink-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] sm:text-xs text-gray-500 uppercase flex items-center gap-1"><Move size={12}/> Перетаскивайте</span>
                </div>
                
                <div ref={previewRef} onClick={handleBackgroundClick} className="relative w-full aspect-[16/9] rounded-xl shadow-inner border border-gray-800 overflow-hidden bg-cover bg-center cursor-crosshair" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop')" }}>
                  <div 
                    onPointerDown={handlePointerDown}
                    className={`absolute px-2.5 py-1 flex items-center justify-center whitespace-nowrap cursor-move select-none touch-none ${isDragging ? 'transition-none' : 'transition-all duration-200 ease-out'}`}
                    style={{
                      left: `${localWatermark.x ?? 90}%`, top: `${localWatermark.y ?? 85}%`,
                      backgroundColor: (localWatermark.type === 'text' && localWatermark.hasBackground) ? localWatermark.bgColor : 'transparent', color: localWatermark.textColor,
                      opacity: (localWatermark.opacity || 90) / 100,
                      transform: `translate(-50%, -50%) scale(${(localWatermark.size || 100) / 100}) rotate(${localWatermark.angle || 0}deg)`, transformOrigin: 'center',
                      borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', zIndex: 10
                    }}
                  >
                    {localWatermark.type === 'image' && localWatermark.image ? (<img src={localWatermark.image} alt="watermark" draggable="false" className="max-h-10 sm:max-h-12 object-contain drop-shadow-lg pointer-events-none" />) : (localWatermark.text || 'SMMBOX')}
                  </div>
                </div>
              </div>

              <div className="flex border-b border-gray-800 bg-gray-900/30 shrink-0">
                <button onClick={() => setWatermarkTab('simple')} className={`flex-1 py-3 sm:py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors min-h-[48px] ${watermarkTab === 'simple' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300'}`}><TypeIcon size={16}/> Базовая</button>
                <button onClick={() => setWatermarkTab('advanced')} className={`flex-1 py-3 sm:py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors min-h-[48px] ${watermarkTab === 'advanced' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300'}`}><Sliders size={16}/> Продвинутая</button>
              </div>

              <div className="p-4 sm:p-5 shrink-0">
                {watermarkTab === 'simple' && (
                  <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex p-1 bg-black/40 rounded-xl border border-gray-800">
                      <button onClick={() => setLocalWatermark({...localWatermark, type: 'text'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all min-h-[40px] ${localWatermark.type === 'text' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Текст</button>
                      <button onClick={() => setLocalWatermark({...localWatermark, type: 'image'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all min-h-[40px] ${localWatermark.type === 'image' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Свое лого</button>
                    </div>
                    {localWatermark.type === 'text' ? (
                      <>
                        <div className="space-y-2">
                          <label className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase">Текст знака</label>
                          <input type="text" value={localWatermark.text || ''} onChange={e => setLocalWatermark({...localWatermark, text: e.target.value})} placeholder="SMMBOX" className="w-full bg-black/40 border border-gray-700 rounded-xl py-3 sm:py-2.5 px-4 text-base sm:text-sm text-white focus:border-blue-500 outline-none transition-colors min-h-[48px] sm:min-h-[44px]" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5"><ColorPicker label="Цвет текста" colorKey="textColor" /><ColorPicker label="Фон плашки" colorKey="bgColor" hasCheckbox checkboxKey="hasBackground" /></div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase">Файл логотипа</label>
                        <div className="border-2 border-dashed border-gray-700 rounded-xl p-5 sm:p-6 text-center hover:bg-gray-900/50 transition-colors bg-black/20">
                          <input type="file" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} className="hidden" />
                          {localWatermark.image ? (
                            <div className="flex flex-col items-center gap-3">
                              <img src={localWatermark.image} alt="preview" className="h-16 object-contain" />
                              <button onClick={() => fileInputRef.current?.click()} className="text-blue-400 text-xs font-bold hover:underline p-2 min-h-[44px]">Заменить логотип</button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 cursor-pointer p-2" onClick={() => fileInputRef.current?.click()}>
                              <div className="w-12 h-12 sm:w-10 sm:h-10 bg-blue-500/10 rounded-full flex items-center justify-center"><Upload size={20} className="text-blue-400"/></div>
                              <span className="text-sm font-medium text-gray-300 mt-1">Нажмите, чтобы загрузить</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="space-y-2"><label className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase">Быстрая позиция</label><PositionGridButtons /></div>
                  </div>
                )}
                {watermarkTab === 'advanced' && (
                  <div className="space-y-6 sm:space-y-7 animate-in fade-in slide-in-from-left-4 duration-300 py-2">
                    <div className="space-y-3"><div className="flex justify-between items-center"><label className="text-xs font-semibold text-gray-400 uppercase">Прозрачность</label><span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{localWatermark.opacity || 90}%</span></div><input type="range" min="10" max="100" value={localWatermark.opacity || 90} onChange={e => setLocalWatermark({...localWatermark, opacity: Number(e.target.value)})} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
                    <div className="space-y-3"><div className="flex justify-between items-center"><label className="text-xs font-semibold text-gray-400 uppercase">Масштаб</label><span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{localWatermark.size || 100}%</span></div><input type="range" min="50" max="250" value={localWatermark.size || 100} onChange={e => setLocalWatermark({...localWatermark, size: Number(e.target.value)})} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
                    <div className="space-y-3"><div className="flex justify-between items-center"><label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1.5"><RotateCw size={14}/> Поворот</label><span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{localWatermark.angle || 0}°</span></div><input type="range" min="-180" max="180" value={localWatermark.angle || 0} onChange={handleAngleChange} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" /><div className="flex justify-between text-[10px] text-gray-500 font-mono px-1 pt-1"><span>-180°</span><span>0°</span><span>180°</span></div></div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-800 bg-[#0d0f13] flex flex-col sm:flex-row gap-3 shrink-0">
              <button 
                onClick={closeDesignModal} 
                disabled={isModalSaving} 
                className="w-full sm:flex-1 py-3 sm:py-3 text-sm font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-xl transition-colors min-h-[48px] order-2 sm:order-1"
              >
                Отмена
              </button>
              <button 
                onClick={handleSaveModalDesign} 
                disabled={isModalSaving} 
                className="w-full sm:flex-[2] py-3 sm:py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex flex-row justify-center items-center gap-2 min-h-[48px] order-1 sm:order-2 active:scale-95"
              >
                {isModalSaving ? <Loader2 size={18} className="animate-spin shrink-0"/> : <Check size={18} className="shrink-0"/>} 
                <span>Сохранить настройки</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО ДОБАВЛЕНИЯ НОВОГО ПРОФИЛЯ ТГ */}
      {showTgHelperModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowTgHelperModal(false)}></div>
          <div className="relative w-full max-w-md bg-[#111318] border border-gray-700 rounded-2xl shadow-2xl flex flex-col z-10">
            
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus size={20} className="text-[#0088CC]" />
                Новый профиль Telegram
              </h3>
              <button onClick={() => setShowTgHelperModal(false)} className="text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700 p-2 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-sm text-gray-300">
              <div className="bg-[#0088CC]/10 border border-[#0088CC]/20 rounded-xl p-4 text-sm text-gray-300">
                <p className="mb-3 font-semibold text-white">Чтобы привязать дополнительный аккаунт:</p>
                <ol className="list-decimal pl-4 space-y-2">
                  <li>Нажмите кнопку ниже — откроется наш бот.</li>
                  <li><b>Важно:</b> Убедитесь, что в приложении Telegram вы переключились на тот аккаунт, который хотите привязать.</li>
                  <li>Нажмите <b>«Запустить»</b> (или отправьте команду <span className="text-white font-mono">/start</span>).</li>
                  <li>Вернитесь сюда и обновите страницу.</li>
                </ol>
              </div>
              
              <div className="pt-2">
                <a
                  href={`https://t.me/smmbox_auth_bot?start=bind_${user.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowTgHelperModal(false)}
                  className="w-full bg-[#0088CC] hover:bg-[#0077B3] text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-[#0088CC]/20 active:scale-95"
                >
                  <Send size={18} /> Перейти в бота
                </a>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* НОВОЕ ОКНО ВКОНТАКТЕ (ТОЛЬКО ДОБАВЛЕНИЕ ПО ССЫЛКЕ) */}
      {vkHackModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setVkHackModal({isOpen: false})}></div>
          <div className="relative w-full max-w-md bg-[#111318] border border-gray-700 rounded-2xl shadow-2xl flex flex-col z-10">
            
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users size={20} className="text-[#0077FF]" /> 
                Добавить сообщество ВК
              </h3>
              <button onClick={() => setVkHackModal({isOpen: false})} className="text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700 p-2 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="bg-[#0077FF]/10 border border-[#0077FF]/20 rounded-xl p-4 text-sm text-gray-300">
                <p className="mb-2 font-semibold text-white">Как подключить группу:</p>
                <ol className="list-decimal pl-4 space-y-1.5 text-xs">
                  <li>Зайдите в вашу группу ВКонтакте.</li>
                  <li>Скопируйте ссылку из адресной строки (например: <span className="font-mono text-white">vk.com/myclub</span>).</li>
                  <li>Вставьте ссылку в поле ниже и нажмите добавить.</li>
                </ol>
              </div>

              <div className="space-y-2 mt-4">
                <input 
                  type="text" 
                  placeholder="Ссылка на группу..." 
                  value={vkHackModal.pastedUrl || ''}
                  onChange={(e) => setVkHackModal(prev => ({...prev, pastedUrl: e.target.value}))}
                  className="w-full bg-black/40 border border-gray-700 rounded-xl py-3 px-4 text-sm text-white focus:border-[#0077FF] outline-none transition-colors"
                />
              </div>
              
              <button 
                onClick={async () => {
                  if (!vkHackModal.pastedUrl) return alert('Введите ссылку на группу!');
                  setIsSyncingVk(true);
                  const result = await useStore.getState().addVkKomodGroup(vkHackModal.pastedUrl, 'Новое сообщество');
                  setIsSyncingVk(false);
                  
                  if (result.success) {
                    alert('Группа успешно добавлена!');
                    setVkHackModal({isOpen: false, pastedUrl: ''});
                  } else {
                    alert('Ошибка: ' + result.error);
                  }
                }}
                disabled={isSyncingVk}
                className="w-full bg-[#0077FF] hover:bg-[#0066CC] disabled:opacity-50 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all active:scale-95 shadow-lg shadow-[#0077FF]/20 mt-2"
              >
                {isSyncingVk ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

