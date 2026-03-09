import { useEffect, useState, useRef } from 'react';
import { useStore } from '../../store';
import { useNavigate } from 'react-router-dom';
import { 
  Send, Plus, Trash2, RefreshCw, ShieldAlert,
  ChevronDown, Copy, Check, LayoutTemplate,
  Settings2, Image as ImageIcon, Type, X,
  Sliders, Type as TypeIcon, Upload, RotateCw, Palette,
  ArrowUpLeft, ArrowUp, ArrowUpRight, ArrowLeft, Crosshair, ArrowRight, ArrowDownLeft, ArrowDown, ArrowDownRight, Move, Loader2, CheckCircle2, UserCircle
} from 'lucide-react';

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
  const linkSocialProfile = useStore((state) => state.linkSocialProfile);

  const removeAccount = useStore((state) => state.removeAccount);
  const saveAccountDesign = useStore((state) => state.saveAccountDesign);
  const token = useStore((state) => state.token);

  const [tgInput, setTgInput] = useState('');
  const [isAddingTg, setIsAddingTg] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [vkStep, setVkStep] = useState(1);
  const [vkLinkInput, setVkLinkInput] = useState('');
  const [vkTokenInput, setVkTokenInput] = useState('');
  const [isAddingVk, setIsAddingVk] = useState(false);
  const [isVerifyingVk, setIsVerifyingVk] = useState(false);
  const [vkSuccessMsg, setVkSuccessMsg] = useState('');
  const [isVkProfileLoading, setIsVkProfileLoading] = useState(false);

  const [savingSignature, setSavingSignature] = useState({});
  const [savingWatermark, setSavingWatermark] = useState({});
  const [isModalSaving, setIsModalSaving] = useState(false);
  
  const [expandedId, setExpandedId] = useState(null);
  const [copied, setCopied] = useState(false);

  const [designModal, setDesignModal] = useState({ isOpen: false, account: null });
  const [watermarkTab, setWatermarkTab] = useState('simple'); 
  const [localWatermark, setLocalWatermark] = useState({});
  const [localSignatures, setLocalSignatures] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

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

  useEffect(() => {
    if (user?.id) {
      fetchProfiles(user.id);
      fetchAccounts(user.id).then(() => {
        if (verifyAccountsStatus) verifyAccountsStatus();
        if (verifyVkAccountsStatus) verifyVkAccountsStatus();
      });
    }
  }, [user]);

  const tgAccounts = accounts.filter(a => a.provider === 'TELEGRAM');
  const vkAccounts = accounts.filter(a => a.provider === 'VK');
  const vkProfiles = profiles.filter(p => p.provider === 'VK');
  const hasVkProfile = vkProfiles.length > 0;

  const handleVkConnectProfile = () => {
    setIsVkProfileLoading(true);

    const cleanAppId = String(import.meta.env.VITE_VK_APP_ID || '54471878').replace(/['"]/g, '').trim();
    const cleanRedirectUri = String(import.meta.env.VITE_VK_REDIRECT_URI || 'https://smmdeck.ru/api/accounts/vk/callback').replace(/['"]/g, '').trim();
    const scope = 'groups,wall,photos,video,docs,offline';
    const url = `https://oauth.vk.com/authorize?client_id=${cleanAppId}&display=popup&redirect_uri=${encodeURIComponent(cleanRedirectUri)}&scope=${scope}&response_type=code&v=5.199`;

    const width = 600; const height = 700;
    const left = window.screen.width / 2 - width / 2; const top = window.screen.height / 2 - height / 2;
    const popup = window.open(url, 'vk_auth', `width=${width},height=${height},top=${top},left=${left},status=yes,scrollbars=yes`);
    
    const messageListener = async (event) => {
      if (event.data?.type === 'VK_GROUPS_LOADED') {
        const { accessToken, profile } = event.data.payload;
        const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Профиль ВК';
        
        await linkSocialProfile(user.id, 'VK', profile.id, name, profile.photo_100, accessToken);
        setIsVkProfileLoading(false);
        window.removeEventListener('message', messageListener);
      } else if (event.data?.type === 'VK_AUTH_ERROR') {
        alert('Ошибка авторизации: ' + event.data.error);
        setIsVkProfileLoading(false);
        window.removeEventListener('message', messageListener);
      }
    };

    window.addEventListener('message', messageListener);

    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        if (isVkProfileLoading) { setIsVkProfileLoading(false); window.removeEventListener('message', messageListener); }
      }
    }, 1000);
  };

  const copyBotName = (e) => {
    e.stopPropagation(); navigator.clipboard.writeText('@smmbox_auth_bot');
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleManualVerify = async (e) => { if (e) e.stopPropagation(); setIsVerifying(true); if (verifyAccountsStatus) await verifyAccountsStatus(); setIsVerifying(false); };
  const handleManualVerifyVk = async (e) => { if (e) e.stopPropagation(); setIsVerifyingVk(true); if (verifyVkAccountsStatus) await verifyVkAccountsStatus(); setIsVerifyingVk(false); };

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

  const handleAddTg = async () => {
    if (isLimitReached) return alert('Лимит аккаунтов исчерпан! Оформите PRO.');
    if (!tgInput.trim()) return alert('Введите ссылку канала!');
    
    setIsAddingTg(true);
    try {
      const infoRes = await fetch(`/api/auth/tg-chat-info`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: tgInput })
      });
      const infoData = await infoRes.json();

      if (!infoData.success) {
        alert(infoData.error || 'Канал не найден. Бот назначен администратором?');
        setIsAddingTg(false); return;
      }

      const saveRes = await fetch(`/api/accounts/tg/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, channels: [{ chatId: infoData.chatId || infoData.username, title: infoData.title, avatar: infoData.avatar }] })
      });
      const saveData = await saveRes.json();

      if (saveData.success) {
        setTgInput('');
        await fetchProfiles(user.id); 
        await fetchAccounts(user.id); 
        if (verifyAccountsStatus) verifyAccountsStatus(); 
      } else {
        alert(saveData.error || 'Ошибка сохранения аккаунта');
      }
    } catch (error) { alert('Ошибка соединения с сервером'); }
    setIsAddingTg(false);
  };

  const handleVkNextStep = () => {
    if (!vkLinkInput.trim()) return alert('Пожалуйста, укажите ссылку на группу');
    setVkStep(2);
  };

  const handleAddVk = async () => {
    if (isLimitReached) return alert('Лимит аккаунтов исчерпан! Оформите PRO.');
    if (!vkLinkInput.trim() || !vkTokenInput.trim()) return alert('Заполните токен!');
    
    setIsAddingVk(true);
    const res = await saveVkGroupWithToken(user.id, vkLinkInput, vkTokenInput);
    
    if (res.success) {
      setVkLinkInput(''); setVkTokenInput(''); setVkStep(1); 
      setVkSuccessMsg(`Сообщество "${res.group?.name || 'ВКонтакте'}" успешно подключено!`);
      setTimeout(() => setVkSuccessMsg(''), 4000); 
    } else {
      alert(res.error || 'Ошибка при добавлении группы');
    }
    setIsAddingVk(false);
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
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-gray-400 bg-black/30 p-2.5 rounded-lg mb-3 gap-2">
                      <span className="truncate w-full sm:w-auto">Бот: <span className="font-mono text-white">@smmbox_auth_bot</span></span>
                      <button onClick={copyBotName} className="shrink-0 w-full sm:w-auto text-gray-400 hover:text-white transition-colors bg-gray-800 px-3 py-2.5 sm:py-1.5 rounded-md flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-0">
                        {copied ? <><Check size={14} className="text-emerald-500" /> Сохранено</> : <><Copy size={14} /> Копировать</>}
                      </button>
                    </div>
                  )}

                  {acc.provider === 'VK' ? (
                    <button onClick={handleManualVerifyVk} disabled={isVerifyingVk} className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 py-3 sm:py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px]">
                      <RefreshCw size={16} className={isVerifyingVk ? "animate-spin" : ""} /> Проверить ключ ВК
                    </button>
                  ) : (
                    <button onClick={handleManualVerify} disabled={isVerifying} className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 py-3 sm:py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px]">
                      <RefreshCw size={16} className={isVerifying ? "animate-spin" : ""} /> Проверить статус бота
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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight px-1 sm:px-0">Мои группы</h1>
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

      {/* ШАГ 1 и 2: ДОБАВЛЕНИЕ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
        
        {/* ТЕЛЕГРАМ */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-sky-500/10 blur-[40px] sm:blur-[50px] rounded-full pointer-events-none"></div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <Send size={20} className="text-sky-400 shrink-0" /> Telegram
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mb-5">Добавьте бота <span className="text-gray-300 font-mono select-all">@smmbox_auth_bot</span> в админы канала и вставьте ссылку.</p>
          </div>
          <div className="mt-auto pt-2 flex flex-col sm:flex-row gap-3">
            <input 
              type="text" value={tgInput} onChange={(e) => setTgInput(e.target.value)}
              placeholder="t.me/channel" disabled={isLimitReached}
              className="flex-1 min-w-0 bg-black/50 border border-gray-700 rounded-xl py-3 px-4 text-base sm:text-sm text-white focus:outline-none focus:border-sky-500 transition-all placeholder:text-gray-600 disabled:opacity-50 min-h-[48px]"
            />
            <button onClick={handleAddTg} disabled={isAddingTg || isLimitReached} className="shrink-0 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm whitespace-nowrap min-h-[48px] shadow-lg shadow-sky-500/20 active:scale-95">
              {isAddingTg ? <RefreshCw className="animate-spin shrink-0" size={18} /> : <Plus size={18} className="shrink-0"/>} Добавить
            </button>
          </div>
        </div>

        {/* ВКОНТАКТЕ */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col h-full transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-[#0077FF]/10 blur-[40px] sm:blur-[50px] rounded-full pointer-events-none"></div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <span className="w-5 h-5 bg-[#0077FF] rounded-md flex items-center justify-center font-bold text-[10px] text-white shrink-0">K</span> ВКонтакте
            </h2>
            
            {!hasVkProfile ? (
              <p className="text-xs sm:text-sm text-gray-400 mb-5">
                Для добавления сообществ необходимо подтвердить ваши права. Привяжите личную страницу ВКонтакте.
              </p>
            ) : vkStep === 1 ? (
              <div className="flex items-center gap-3 mb-5">
                {vkProfiles[0]?.avatarUrl ? <img src={vkProfiles[0].avatarUrl} alt="VK" className="w-8 h-8 rounded-full border border-gray-700"/> : <UserCircle size={32} className="text-gray-500"/>}
                <div className="flex flex-col min-w-0">
                   <span className="text-sm font-bold text-white truncate">{vkProfiles[0]?.name || 'Мой профиль'}</span>
                   <span className="text-[10px] text-[#0077FF] font-medium uppercase tracking-wider">Профиль активен</span>
                </div>
              </div>
            ) : (
              <div className="text-xs sm:text-sm text-gray-300 mb-4 bg-[#0077FF]/10 p-3 rounded-xl border border-[#0077FF]/20">
                <p className="font-bold text-white mb-1">Группа найдена! Следующий шаг:</p>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                  <li>Зайдите в настройки группы → <b>Работа с API</b></li>
                  <li>Создайте ключ с правами: <b>Управление, Фото, Стена</b></li>
                  <li>Вставьте полученный ключ ниже</li>
                </ol>
              </div>
            )}
          </div>
          
          <div className="mt-auto pt-2 flex flex-col gap-3">
            {!hasVkProfile ? (
               <button 
                 onClick={handleVkConnectProfile} disabled={isVkProfileLoading}
                 className="w-full bg-[#0077FF] hover:bg-[#0066DD] disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm min-h-[48px] shadow-lg shadow-[#0077FF]/20 active:scale-95"
               >
                 {isVkProfileLoading ? <Loader2 className="animate-spin shrink-0" size={18} /> : <span className="font-black text-lg leading-none shrink-0 mr-1">K</span>}
                 <span>{isVkProfileLoading ? 'Привязка...' : 'Авторизоваться ВКонтакте'}</span>
               </button>
            ) : vkStep === 1 ? (
              <div className="flex flex-col gap-3">
                {vkSuccessMsg && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-sm animate-in fade-in flex items-center gap-2">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>{vkSuccessMsg}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text" value={vkLinkInput} onChange={(e) => setVkLinkInput(e.target.value)}
                    placeholder="Ссылка: vk.com/public123" disabled={isLimitReached}
                    className="flex-1 w-full bg-black/50 border border-gray-700 rounded-xl py-3 px-4 text-base sm:text-sm text-white focus:outline-none focus:border-[#0077FF] transition-all placeholder:text-gray-600 min-h-[48px]"
                  />
                  <button onClick={handleVkNextStep} disabled={!vkLinkInput || isLimitReached} className="shrink-0 bg-[#0077FF] hover:bg-[#0066DD] disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold transition-all text-sm min-h-[48px] shadow-lg shadow-[#0077FF]/20">
                    Далее
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-right-4">
                <input 
                  type="text" value={vkTokenInput} onChange={(e) => setVkTokenInput(e.target.value)}
                  placeholder="Вставьте API ключ сюда..." disabled={isLimitReached}
                  className="flex-1 w-full min-w-0 bg-black/50 border border-gray-700 rounded-xl py-3 px-4 text-base sm:text-sm text-white focus:outline-none focus:border-[#0077FF] transition-all placeholder:text-gray-600 min-h-[48px]"
                />
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setVkStep(1)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-3 rounded-xl font-bold transition-all text-sm min-h-[48px]">
                    Назад
                  </button>
                  <button 
                    onClick={handleAddVk} 
                    disabled={isAddingVk || !vkTokenInput} 
                    className="bg-[#0077FF] hover:bg-[#0066DD] disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold transition-all text-sm min-h-[48px] shadow-lg"
                  >
                    {isAddingVk ? (
                      <div className="flex items-center justify-center gap-2"><RefreshCw className="animate-spin" size={18} /><span>Проверка...</span></div>
                    ) : (
                      <div className="flex items-center justify-center gap-2"><Check size={18} /><span>Подключить</span></div>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* НИЖНИЕ СПИСКИ (ГРУППЫ) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mt-6 sm:mt-8">
        
        <div className="space-y-3 sm:space-y-4">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2 ml-1">
            <Send size={14} className="text-sky-500 shrink-0"/> Подключенные каналы
          </h3>
          <div className="flex flex-col gap-3 sm:gap-4">
            {tgAccounts.map(acc => renderAccountCard(acc, <Send size={8} className="text-white"/>, 'bg-sky-500'))}
            {tgAccounts.length === 0 && (
              <div className="text-center py-10 bg-gray-900/20 border border-gray-800/50 rounded-2xl border-dashed">
                <p className="text-gray-500 text-sm px-4">Нет подключенных каналов Telegram</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2 ml-1">
            <span className="w-4 h-4 rounded bg-[#0077FF] flex items-center justify-center text-[9px] text-white font-bold shrink-0">K</span> Сообщества ВКонтакте
          </h3>
          <div className="flex flex-col gap-3 sm:gap-4">
            {vkAccounts.map(acc => renderAccountCard(acc, <span className="font-bold text-[8px] text-white">K</span>, 'bg-[#0077FF]'))}
            {vkAccounts.length === 0 && (
              <div className="text-center py-10 bg-gray-900/20 border border-gray-800/50 rounded-2xl border-dashed">
                <p className="text-gray-500 text-sm px-4">Нет подключенных сообществ ВКонтакте</p>
              </div>
            )}
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
    </div>
  );
}