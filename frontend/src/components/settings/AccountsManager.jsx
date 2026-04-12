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

  const connectedVk = accounts.filter(acc => acc.provider === 'VK');
  const connectedTg = accounts.filter(acc => acc.provider === 'TELEGRAM');

  const [isSyncingVk, setIsSyncingVk] = useState(false);
  // Состояния для нового блока подключения
  const [selectedNetwork, setSelectedNetwork] = useState('VK'); 
  const [showPreConnectModal, setShowPreConnectModal] = useState(null);
  

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

  const [isGroupsLoading, setIsGroupsLoading] = useState(false);
  const [selectableGroups, setSelectableGroups] = useState([]);
  const [komodModal, setKomodModal] = useState({ isOpen: false, profileId: null });
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [komodSelected, setKomodSelected] = useState([]);

  const [vkConnectStatus, setVkConnectStatus] = useState('idle');
  const [newlyAddedProfileId, setNewlyAddedProfileId] = useState(null);
  const [addedGroupsCount, setAddedGroupsCount] = useState(0);

  const handleOpenGroupsSelector = async (profileId) => {
    setIsGroupsLoading(true);
    const data = await useStore.getState().fetchKomodGroups(profileId);
    if (data.success) {
      setSelectableGroups(data.groups || []);
      setKomodSelected([]); // Сбрасываем старые галочки
      setKomodModal({ isOpen: true, profileId });
    } else {
      alert(data.error);
    }
    setIsGroupsLoading(false);
  };


  const handleAddMyWall = async (profileId) => {
    try {
      setIsSyncingVk(true);
      const res = await fetch('/api/accounts/vk/komod-add-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Исправили user.token на token
        },
        body: JSON.stringify({ profileId })
      });
      
      const data = await res.json();
      if (data.success) {
        // Вызываем авто-синхронизацию, чтобы стена сразу подтянулась на экран!
        await useStore.getState().syncVkKomod();
        alert('Личная стена успешно добавлена!');
        await handleRefreshProfiles();
      } else {
        alert('Ошибка: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Внутренняя ошибка');
    } finally {
      setIsSyncingVk(false);
    }
  };

  // --- 1. ЛОГИКА СОХРАНЕНИЯ ВЫБРАННЫХ ПЛОЩАДОК (ГРУППЫ И СТЕНА) ---
  const handleSaveKomodGroups = async () => {
    if (komodSelected.length === 0) return;
    setIsSyncingVk(true);
    setVkConnectStatus('syncing_groups'); 
    setKomodModal({ isOpen: false, profileId: null }); 
    
    let addedCount = 0;
    let lastError = null;
    
    for (const uniqueId of komodSelected) {
      const group = selectableGroups.find((g, i) => {
        const gId = g.apiGroupData?.id || g.id || g.group_id || `idx-${i}`;
        return String(gId) === String(uniqueId);
      });

      if (group) {
        // Если это личная страница (dummy профиль)
        if (group.is_profile_dummy) {
          try {
            const res = await fetch('/api/accounts/vk/komod-add-profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ profileId: komodModal.profileId })
            });
            const data = await res.json();
            if (data.success) addedCount++;
            else lastError = data.error;
          } catch (err) { lastError = 'Ошибка сети при добавлении стены'; }
        } 
        // Если это обычное сообщество
        else {
          const groupId = group.apiGroupData?.id || group.id || group.group_id;
          const screenName = group.apiGroupData?.name || group.screen_name || `club${groupId}`;
          const groupUrl = `https://vk.com/${screenName}`;
          const title = group.apiGroupData?.name || group.name || group.title;
          
          const res = await useStore.getState().addVkKomodGroup(groupUrl, title, komodModal.profileId);
          if (res.success) addedCount++;
          else lastError = res.error;
        }
      }
    }
    
    // Синхронизируем и обновляем интерфейс
    await useStore.getState().syncVkKomod();
    await handleRefreshProfiles();
    setIsSyncingVk(false);
    
    if (addedCount > 0) {
      setAddedGroupsCount(addedCount);
      setVkConnectStatus('groups_success'); 
    } else if (lastError) {
      alert(`Ошибка: ${lastError}`);
      setVkConnectStatus('idle');
    } else {
      setVkConnectStatus('idle');
    }
  };


  useEffect(() => {
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
        
        const confirmResult = await useStore.getState().confirmVkKomod(hashToProcess);
        if (!confirmResult.success) {
           alert('Ошибка шлюза: ' + (confirmResult.error || 'Аккаунт не найден.'));
           setIsSyncingVk(false); setVkConnectStatus('idle'); return; 
        }

        // Синхронизируем профили без авто-создания аккаунтов
        await useStore.getState().syncVkKomod();
        await handleRefreshProfiles();
        setIsSyncingVk(false);
        
        const updatedProfiles = useStore.getState().profiles;
        const vkProf = updatedProfiles.find(p => p.provider === 'VK');
        
        setVkConnectStatus('idle');
        
        // СРАЗУ открываем окно выбора, где будет и стена, и группы
        if (vkProf?.id) {
          handleOpenGroupsSelector(vkProf.id);
        }
      };
      
      finalizeAuth();
    }
  }, [handleRefreshProfiles, navigate]);


  const handleRefreshProfiles = async () => {
    setIsRefreshingProfiles(true);
    await fetchProfiles(user.id);
    await fetchAccounts(user.id);
    setIsRefreshingProfiles(false);
  };

  // Слушаем ответ от официального окна ВКонтакте
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'VK_FETCH_SUCCESS') {
        const fetchedGroups = event.data.groups;
        const existingIds = accounts.filter(a => a.provider === 'VK').map(a => a.providerId.replace('group_', ''));
        setVkGroupsList(fetchedGroups.filter(g => !existingIds.includes(String(g.id))));
        setVkHackModal(prev => ({ ...prev, step: 2 }));
        setIsFetchingGroups(false);
      }
      if (event.data?.type === 'VK_FETCH_ERROR') {
        alert('Ошибка загрузки групп: ' + event.data.error);
        setIsFetchingGroups(false);
        setVkHackModal(prev => ({ ...prev, step: 1 }));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [accounts]);

  useEffect(() => {
    if (user?.id) {
      fetchProfiles(user.id);
      fetchAccounts(user.id).then(() => {
        if (verifyAccountsStatus) verifyAccountsStatus();
        if (verifyVkAccountsStatus) verifyVkAccountsStatus();
      });
    }
  }, [user]);

  const processingHash = useRef(null);

  
 
  const handleConnectVkOAuth = () => {
    const hash = 'vk_' + user.id + '_' + Date.now();
    localStorage.setItem('vk_pending_hash', hash);
    
    // БЕРЕМ ИДЕАЛЬНО ЧИСТЫЙ URL без всяких параметров и мусора
    const cleanUrl = window.location.origin + window.location.pathname;
    const redirectUrl = encodeURIComponent(cleanUrl);
    
    window.location.href = `https://kom-od.ru/connect/vk?hash=${hash}&redirect_url=${redirectUrl}`; 
  };

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

  

  // Официальная и безопасная загрузка групп через ваше VK Приложение
  const handleLoadGroupsOfficial = () => {
    setIsFetchingGroups(true);
    // ВАЖНО: Укажи здесь ID твоего приложения ВКонтакте (из кабинета разработчика ВК)
    const clientId = import.meta.env.VITE_VK_APP_ID || '51888496'; // <-- Вставь свой ID
    const redirectUri = `${window.location.origin}/api/accounts/vk/fetch-groups-callback`;
    const authUrl = `https://oauth.vk.com/authorize?client_id=${clientId}&display=popup&redirect_uri=${redirectUri}&scope=groups,offline&response_type=code&v=5.199`;
    
    window.open(authUrl, '_blank', 'width=600,height=600');
  };

  // Пакетно отправляем выбранные группы в шлюз Kom-od
  const saveHackGroups = async () => {
    if (vkSelectedGroups.length === 0) return;
    setIsSyncingVk(true);
    
    let addedCount = 0;
    
    // Отправляем каждую выбранную группу в Kom-od по очереди
    for (const groupId of vkSelectedGroups) {
      const group = vkGroupsList.find(g => g.id === groupId);
      if (group) {
        const groupUrl = `https://vk.com/${group.screen_name || 'club' + group.id}`;
        const res = await useStore.getState().addVkKomodGroup(groupUrl, group.name);
        if (res.success) addedCount++;
      }
    }
    
    setIsSyncingVk(false);
    // В конце функции saveHackGroups:
    alert(`Успешно подключено сообществ: ${addedCount} из ${vkSelectedGroups.length}!`);
    setVkHackModal({ isOpen: false, step: 1, pastedUrl: '', profileId: null }); // Добавили очистку
    handleRefreshProfiles(); // Обновляем интерфейс
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

 const SocialGridItem = ({ icon: Icon, name, colorClass, onConnect }) => (
    <div 
      onClick={onConnect}
      className="bg-admin-card border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all hover:border-gray-700 hover:bg-gray-800/50 cursor-pointer shadow-sm hover:shadow-lg group"
    >
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${colorClass} text-white transition-transform group-hover:scale-110`}>
        <Icon size={32} />
      </div>
      <h3 className="text-white font-bold text-lg mb-1">{name}</h3>
      <span className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">Подключить</span>
    </div>
  );


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
                {/* БЕЗОПАСНОСТЬ: Стену (isProfile) отключать нельзя, только сообщества */}
                {!acc.providerId.startsWith('wall_') ? (
                  <button 
                    onClick={() => removeAccount(acc.id)} 
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-400 transition-colors py-3 sm:py-2 px-3 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg min-h-[44px] sm:min-h-0"
                  >
                    <Trash2 size={16} /> Отключить
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 italic px-2">
                    <Info size={12} /> Личный профиль нельзя отключить отдельно
                  </div>
                )}
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

     {/* === БЛОК ВЫБОРА СОЦСЕТИ === */}
      <div className="bg-[#0d0f13] border border-gray-800 rounded-3xl p-5 sm:p-6 flex flex-col gap-5 mt-6 shadow-xl max-w-md mx-auto w-full relative overflow-hidden">
        
        <div className={`absolute top-0 left-0 w-full h-full opacity-10 transition-colors duration-700 pointer-events-none ${
          selectedNetwork === 'VK' 
            ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0077FF] via-transparent to-transparent' 
            : 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2AABEE] via-transparent to-transparent'
        }`} />

        <h2 className="text-base font-bold text-white text-center relative z-10">Выберите платформу</h2>

        <div className="grid grid-cols-2 gap-3 relative z-10">
          {/* Плашка ВК */}
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

          {/* Плашка ТГ */}
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
          onClick={() => selectedNetwork === 'VK' ? handleConnectVkOAuth() : setShowTgHelperModal(true)}
          className={`relative z-10 w-full py-3.5 rounded-xl font-bold text-white transition-all text-sm active:scale-95 ${
            selectedNetwork === 'VK' ? 'bg-[#0077FF] shadow-lg shadow-[#0077FF]/20' : 'bg-[#2AABEE] shadow-lg shadow-[#2AABEE]/20'
          }`}
        >
          Авторизовать {selectedNetwork === 'VK' ? 'ВК' : 'ТГ'}
        </button>
      </div>
     
{/* === КОМПАКТНЫЙ СПИСОК ПОДКЛЮЧЕННЫХ СЕТЕЙ === */}
      {(connectedVk.length > 0 || connectedTg.length > 0) && (
        <div className="max-w-md mx-auto w-full mt-8 mb-4 px-1">
          <h2 className="text-[10px] font-bold text-gray-500 mb-3 uppercase tracking-[0.2em] text-center">Подключено</h2>
          <div className="grid grid-cols-2 gap-2">
            {[...connectedVk, ...connectedTg].map(acc => (
              <div key={acc.id} className="flex items-center justify-between p-2 bg-[#0d0f13] border border-gray-800 rounded-xl hover:border-gray-700 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img src={acc.avatarUrl || 'https://via.placeholder.com/40'} className="w-8 h-8 rounded-full object-cover border border-gray-800 shrink-0" alt="" />
                  <span className="text-white font-bold text-xs">{acc.provider === 'VK' ? 'ВК' : 'ТГ'}</span>
                </div>
                <button onClick={() => removeAccount(acc.id)} className="text-gray-500 hover:text-rose-500 p-1.5 bg-gray-800/50 hover:bg-rose-500/10 rounded-lg transition-all">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
    

     

       

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
                Для безопасности и моментальной синхронизации, выбор сообществ и каналов происходит <b className="text-white">прямо в нашем официальном Telegram-боте</b>.
              </p>
              
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">1</div>
                  <p className="text-sm text-gray-400">Перейдите в бота по кнопке ниже.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">2</div>
                  <p className="text-sm text-gray-400">Нажмите <b className="text-white">Запустить</b> и следуйте инструкциям в чате.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">3</div>
                  <p className="text-sm text-gray-400">Вернитесь на эту страницу — ваши каналы появятся автоматически!</p>
                </div>
              </div>

              <a
                href={`https://t.me/smmbox_auth_bot?start=bind_${user?.id || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowTgHelperModal(false)}
                className="w-full py-4 rounded-xl font-bold text-white transition-all flex justify-center items-center gap-3 bg-[#0088CC] hover:bg-[#0077B3] shadow-lg shadow-[#0088CC]/20 active:scale-95 text-base mt-2"
              >
                <Send size={20} /> Открыть Telegram-бота
              </a>
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
              <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0077FF] flex items-center justify-center text-white shadow-lg shadow-[#0077FF]/30">
                  <Users size={20} />
                </div>
                Выберите страницы
              </h3>
              <button onClick={() => setKomodModal({ isOpen: false, profileId: null })} className="text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700 p-2 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-2">
              {selectableGroups.map((group, index) => {
                const uniqueId = group.apiGroupData?.id || group.id || group.group_id || `idx-${index}`;
                const isSelected = komodSelected.includes(uniqueId);
                const avatar = group.apiGroupData?.photo_50 || group.photo_50 || 'https://via.placeholder.com/50';
                const name = group.apiGroupData?.name || group.name || group.title;
                const isPersonal = group.is_profile_dummy;

                return (
                  <div 
                    key={uniqueId} 
                    onClick={() => setKomodSelected(prev => isSelected ? prev.filter(id => id !== uniqueId) : [...prev, uniqueId])}
                    className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border ${isSelected ? 'bg-[#0077FF]/10 border-[#0077FF] shadow-inner' : 'bg-gray-900 border-gray-800 hover:bg-gray-800'}`}
                  >
                    <div className="relative shrink-0">
                      <img src={avatar} className="w-12 h-12 rounded-full object-cover border border-gray-700" alt="avatar" />
                      {isPersonal && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#0077FF] border-2 border-[#111318] rounded-full flex items-center justify-center text-white" title="Личный профиль">
                          <UserCircle size={12} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <span className="text-white font-bold text-sm block truncate">{name}</span>
                      {isPersonal && <span className="text-[10px] text-[#0077FF] font-bold uppercase mt-0.5 block tracking-wide">Ваша стена</span>}
                    </div>

                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-colors ${isSelected ? 'bg-[#0077FF] border-[#0077FF]' : 'border-gray-600 bg-transparent'}`}>
                      {isSelected && <Check size={14} className="text-white" />}
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

      {/* ЭКРАН ЗАГРУЗКИ (SMMBox Style) */}
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

      {/* 2. ЭКРАН УСПЕХА: ПРОФИЛЬ */}
      {vkConnectStatus === 'profile_success' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setVkConnectStatus('idle')}></div>
           <div className="relative bg-[#111318] border border-emerald-500/30 rounded-3xl p-8 shadow-2xl flex flex-col items-center w-full max-w-md animate-in zoom-in-95 duration-300">
              <div className="relative mb-5">
                <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 rounded-full"></div>
                <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center relative z-10">
                   <CheckCircle2 size={40} />
                </div>
              </div>
              <h3 className="text-white font-extrabold text-2xl text-center mb-3">Профиль подключен!</h3>
              <p className="text-gray-300 text-center mb-8 leading-relaxed">Ваша личная стена успешно добавлена. Хотите сразу выбрать и подключить свои сообщества для постинга?</p>

              <div className="flex flex-col gap-3 w-full">
                 <button
                   onClick={() => {
                      setVkConnectStatus('idle');
                      if (newlyAddedProfileId) handleOpenGroupsSelector(newlyAddedProfileId);
                   }}
                   className="w-full py-4 bg-[#0077FF] hover:bg-[#0066CC] text-white rounded-xl font-bold shadow-lg shadow-[#0077FF]/20 transition-all active:scale-95 text-base flex justify-center items-center gap-2"
                 >
                   <Plus size={20}/> Выбрать сообщества
                 </button>
                 <button
                   onClick={() => setVkConnectStatus('idle')}
                   className="w-full py-3.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-bold transition-colors text-sm"
                 >
                   Сделать это позже
                 </button>
              </div>
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

    </div>
  );
}

