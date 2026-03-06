import { useEffect, useState, useRef } from 'react';
import { useStore } from '../../store';
import { 
  Send, Plus, Trash2, RefreshCw, ShieldAlert,
  ChevronDown, Copy, Check, LayoutTemplate,
  Settings2, Image as ImageIcon, Type, X,
  Sliders, Type as TypeIcon, Eye, Upload, RotateCw, Palette,
  ArrowUpLeft, ArrowUp, ArrowUpRight, ArrowLeft, Crosshair, ArrowRight, ArrowDownLeft, ArrowDown, ArrowDownRight, Move, Loader2
} from 'lucide-react';

export default function AccountsManager() {
  const user = useStore((state) => state.user);
  const accounts = useStore((state) => state.accounts);
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  const verifyAccountsStatus = useStore((state) => state.verifyAccountsStatus);
  const removeAccount = useStore((state) => state.removeAccount);
  const saveAccountDesign = useStore((state) => state.saveAccountDesign);
  const token = useStore((state) => state.token);

  const [tgInput, setTgInput] = useState('');
  const [isAddingTg, setIsAddingTg] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [savingStates, setSavingStates] = useState({});
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

  useEffect(() => {
    if (user?.id) {
      fetchAccounts(user.id).then(() => {
        if (verifyAccountsStatus) verifyAccountsStatus();
      });
    }
  }, [user]);

  const tgAccounts = accounts.filter(a => a.provider === 'TELEGRAM');
  const vkAccounts = accounts.filter(a => a.provider === 'VK');

  const copyBotName = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText('@smmbox_auth_bot');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualVerify = async (e) => {
    if (e) e.stopPropagation();
    setIsVerifying(true);
    if (verifyAccountsStatus) await verifyAccountsStatus();
    setIsVerifying(false);
  };

  const toggleExpand = (acc) => {
    if (expandedId === acc.id) {
      setExpandedId(null);
    } else {
      setExpandedId(acc.id);
      setLocalSignatures(prev => ({ ...prev, [acc.id]: acc.signature || '' }));
    }
  };

  const handleSignatureChange = (id, value) => {
    setLocalSignatures(prev => ({ ...prev, [id]: value }));
  };

  const saveSignatureOnly = async (acc) => {
    setSavingStates(prev => ({ ...prev, [acc.id]: true }));
    const newSignature = localSignatures[acc.id];
    await saveAccountDesign(acc.id, newSignature, acc.watermark);
    setSavingStates(prev => ({ ...prev, [acc.id]: false }));
  };

  const setGlobalWatermark = async (acc) => {
    setSavingStates(prev => ({ ...prev, [acc.id]: true }));
    await saveAccountDesign(acc.id, localSignatures[acc.id] || acc.signature, null);
    setSavingStates(prev => ({ ...prev, [acc.id]: false }));
  };

  const openDesignModal = (acc) => {
    const initialPos = acc.watermark?.position || 'br';
    const coords = (acc.watermark?.x !== undefined && acc.watermark?.x !== null) ? {x: acc.watermark.x, y: acc.watermark.y} : posToCoords[initialPos];

    setLocalWatermark({
      type: 'text', text: 'SMMBOX', image: null,
      opacity: 90, size: 100, angle: 0,
      textColor: '#FFFFFF', bgColor: '#000000', hasBackground: true,
      ...acc.watermark,
      position: initialPos,
      x: coords.x,
      y: coords.y
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
    for (let snap of snapPoints) {
      if (Math.abs(val - snap) <= 6) { val = snap; break; }
    }
    setLocalWatermark({...localWatermark, angle: val});
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = previewRef.current.getBoundingClientRect();
    const startMouseX = e.clientX || e.touches?.[0]?.clientX;
    const startMouseY = e.clientY || e.touches?.[0]?.clientY;
    const startWX = localWatermark.x ?? 50;
    const startWY = localWatermark.y ?? 50;

    const handlePointerMove = (moveEvent) => {
      const clientX = moveEvent.clientX || moveEvent.touches?.[0]?.clientX;
      const clientY = moveEvent.clientY || moveEvent.touches?.[0]?.clientY;
      const percentDx = ((clientX - startMouseX) / rect.width) * 100;
      const percentDy = ((clientY - startMouseY) / rect.height) * 100;
      let newX = Math.max(0, Math.min(100, startWX + percentDx));
      let newY = Math.max(0, Math.min(100, startWY + percentDy));
      setLocalWatermark(prev => ({ ...prev, x: newX, y: newY, position: 'custom' }));
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
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
          const Icon = pos.icon;
          const isActive = localWatermark.position === pos.id;
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
        <label className="text-xs font-semibold text-gray-400 uppercase flex justify-between items-center">
          {label}
          {hasCheckbox && (
            <input type="checkbox" checked={localWatermark[checkboxKey] !== false} onChange={e => setLocalWatermark({...localWatermark, [checkboxKey]: e.target.checked})} className="accent-blue-500 w-4 h-4 cursor-pointer" />
          )}
        </label>
        <div className={`space-y-2 transition-opacity duration-200 ${(hasCheckbox && localWatermark[checkboxKey] === false) ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center gap-2 bg-black/40 border border-gray-700 rounded-xl p-1.5 pr-3 w-full">
            <input type="color" value={localWatermark[colorKey] || '#FFFFFF'} onChange={e => setLocalWatermark({...localWatermark, [colorKey]: e.target.value})} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0" />
            <span className="text-xs font-mono text-gray-300 uppercase flex-1">{localWatermark[colorKey] || '#FFFFFF'}</span>
            <Palette size={14} className="text-gray-500 shrink-0"/>
          </div>
          <div className="flex gap-1.5 justify-between">
            {presetColors.map(c => (
              <button key={c} onClick={() => setLocalWatermark({...localWatermark, [colorKey]: c})} className="w-5 h-5 rounded-full border border-gray-600 transition-transform hover:scale-110 shadow-sm" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const handleAddTg = async () => {
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
        await fetchAccounts(user.id); 
        if (verifyAccountsStatus) verifyAccountsStatus(); 
      } else {
        alert(saveData.error || 'Ошибка сохранения аккаунта');
      }
    } catch (error) { alert('Ошибка соединения с сервером'); }
    setIsAddingTg(false);
  };

  const renderAccountCard = (acc, providerIcon, providerColor, providerName) => {
    const isExpanded = expandedId === acc.id;
    const hasCustomWatermark = !!acc.watermark;
    const isLoading = savingStates[acc.id];

    const borderClasses = acc.isValid
      ? isExpanded
        ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] bg-emerald-500/10'
        : 'border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)] bg-emerald-500/10'
      : isExpanded
        ? 'border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.15)] bg-rose-500/5'
        : 'border-rose-500/30 hover:border-rose-500/50 shadow-lg bg-gray-900/60';

    return (
      <div key={acc.id} className={`flex flex-col transition-all duration-300 rounded-2xl overflow-hidden border ${borderClasses}`}>
        <div onClick={() => toggleExpand(acc)} className="p-4 flex items-center justify-between cursor-pointer group hover:bg-white/[0.03] transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <img src={acc.avatarUrl || 'https://via.placeholder.com/150'} alt="avatar" className="w-11 h-11 rounded-full border border-gray-700 object-cover" />
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${providerColor} border-2 border-gray-900`}>
                {providerIcon}
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="font-bold text-gray-100 truncate text-sm sm:text-base">{acc.name}</h3>
              <div className="flex items-center mt-1">
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
          <div className={`shrink-0 text-gray-500 transition-transform duration-300 ml-2 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown size={20} />
          </div>
        </div>

        <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="p-4 border-t border-gray-800/50 bg-gray-950/40 space-y-6">
              
              {!acc.isValid && acc.provider === 'TELEGRAM' && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                  <p className="font-bold text-rose-400 flex items-center gap-2 mb-2 text-sm"><ShieldAlert size={16} /> Требуется настройка</p>
                  <p className="text-gray-300 text-xs sm:text-sm mb-3">{acc.errorMsg || 'Бот удален или не имеет прав администратора.'}</p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-gray-400 bg-black/30 p-2.5 rounded-lg mb-3 gap-2">
                    <span className="truncate">Бот: <span className="font-mono text-white">@smmbox_auth_bot</span></span>
                    <button onClick={copyBotName} className="shrink-0 w-full sm:w-auto text-gray-400 hover:text-white transition-colors bg-gray-800 px-3 py-1.5 rounded-md flex items-center justify-center gap-1.5">
                      {copied ? <><Check size={12} className="text-emerald-500" /> Сохранено</> : <><Copy size={12} /> Копировать</>}
                    </button>
                  </div>
                  <button onClick={handleManualVerify} disabled={isVerifying} className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    <RefreshCw size={14} className={isVerifying ? "animate-spin" : ""} /> Проверить статус
                  </button>
                </div>
              )}

              {acc.isValid && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Type size={14}/> Подпись к постам</label>
                    <div className="flex flex-col gap-2">
                      <input 
                        type="text" value={localSignatures[acc.id] !== undefined ? localSignatures[acc.id] : ''}
                        onChange={(e) => handleSignatureChange(acc.id, e.target.value)}
                        placeholder="Например: t.me/mychannel" 
                        className="w-full bg-black/40 border border-gray-700 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <button onClick={() => saveSignatureOnly(acc)} disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-gray-700">
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16}/>} Сохранить подпись
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-gray-800/50">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><ImageIcon size={14}/> Водяной знак</label>
                    
                    <div className="flex p-1 bg-black/40 rounded-xl border border-gray-800">
                      <button onClick={() => setGlobalWatermark(acc)} disabled={isLoading} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${!hasCustomWatermark ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
                        Общий шаблон
                      </button>
                      <button onClick={() => openDesignModal(acc)} disabled={isLoading} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${hasCustomWatermark ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
                        Кастомный
                      </button>
                    </div>

                    {!hasCustomWatermark ? (
                      <div className="mt-2.5 bg-gray-900/50 p-3 rounded-lg border border-gray-800/50 flex items-center gap-3">
                        <div className="p-2 bg-gray-800 rounded-md text-gray-400"><LayoutTemplate size={16}/></div>
                        <p className="text-xs text-gray-400 leading-relaxed">Используется <span className="text-gray-300 font-semibold">Общий шаблон</span> проекта.</p>
                      </div>
                    ) : (
                      <div className="mt-2.5 bg-blue-500/5 p-3 rounded-xl border border-blue-500/20 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/10 rounded-md text-blue-400">
                             {acc.watermark?.type === 'image' ? <ImageIcon size={16}/> : <Type size={16}/>}
                          </div>
                          <p className="text-xs text-blue-300 leading-relaxed flex-1">Для этой группы активен <span className="font-semibold text-blue-400">кастомный дизайн</span>.</p>
                        </div>
                        <button onClick={() => openDesignModal(acc)} className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2">
                          <Settings2 size={14} /> Изменить настройки
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-gray-800/50 flex justify-end">
                <button onClick={() => removeAccount(acc.id)} className="flex items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-400 transition-colors p-2 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg">
                  <Trash2 size={14} /> Отключить группу
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-10 max-w-7xl mx-auto px-2 sm:px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Мои группы</h1>
      </div>

      {/* ШАГ 1: ВЕРХНИЕ БЛОКИ ДОБАВЛЕНИЯ (ИДЕАЛЬНАЯ ВЫСОТА И ВЫРАВНИВАНИЕ) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[50px] rounded-full pointer-events-none"></div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <Send size={20} className="text-sky-400" /> Telegram
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mb-5">Добавьте бота <span className="text-gray-300 font-mono">@smmbox_auth_bot</span> в админы канала и вставьте ссылку.</p>
          </div>
          <div className="mt-auto pt-2 flex flex-col sm:flex-row gap-3">
            <input 
              type="text" value={tgInput} onChange={(e) => setTgInput(e.target.value)}
              placeholder="t.me/channel" 
              className="flex-1 min-w-0 bg-black/50 border border-gray-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-sky-500 transition-all placeholder:text-gray-600"
            />
            <button onClick={handleAddTg} disabled={isAddingTg} className="shrink-0 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm whitespace-nowrap">
              {isAddingTg ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} />} Добавить
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col h-full opacity-80">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0077FF]/10 blur-[50px] rounded-full pointer-events-none"></div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <span className="w-5 h-5 bg-[#0077FF] rounded-md flex items-center justify-center font-bold text-[10px] text-white">K</span> ВКонтакте
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mb-5">Подключение сообществ ВКонтакте находится в процессе глобального обновления.</p>
          </div>
          <div className="mt-auto pt-2">
            <button disabled className="w-full bg-gray-800/80 text-gray-500 border border-gray-700/80 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm cursor-not-allowed">
              Подключить ВКонтакте <span className="text-[10px] uppercase tracking-wider bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded-full ml-1">Скоро</span>
            </button>
          </div>
        </div>

      </div>

      {/* ШАГ 2: НИЖНИЕ СПИСКИ (НАЧИНАЮТСЯ СТРОГО НА ОДНОМ УРОВНЕ) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mt-8">
        
        {/* ЛЕВАЯ КОЛОНКА (ТГ) */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2 ml-1">
            <Send size={14} className="text-sky-500"/> Подключенные каналы
          </h3>
          <div className="flex flex-col gap-4">
            {tgAccounts.map(acc => renderAccountCard(acc, <Send size={8} className="text-white"/>, 'bg-sky-500', 'Telegram'))}
            {tgAccounts.length === 0 && (
              <div className="text-center py-10 bg-gray-900/20 border border-gray-800/50 rounded-2xl border-dashed">
                <p className="text-gray-500 text-sm">Нет подключенных каналов</p>
              </div>
            )}
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА (ВК) */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2 ml-1">
            <span className="w-4 h-4 rounded bg-[#0077FF] flex items-center justify-center text-[9px] text-white font-bold">K</span> Сообщества ВКонтакте
          </h3>
          <div className="flex flex-col gap-4">
            {vkAccounts.map(acc => renderAccountCard(acc, <span className="font-bold text-[8px] text-white">K</span>, 'bg-[#0077FF]', 'ВКонтакте'))}
            {vkAccounts.length === 0 && (
              <div className="text-center py-10 bg-gray-900/20 border border-gray-800/50 rounded-2xl border-dashed">
                <p className="text-gray-500 text-sm">Нет подключенных сообществ</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- МОДАЛЬНОЕ ОКНО --- */}
      {designModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeDesignModal}></div>
          <div className="relative w-full max-w-lg bg-[#111318] border border-gray-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800 bg-gray-900/50">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2"><ImageIcon size={18} className="text-blue-400"/> Настройка дизайна</h3>
              <button onClick={closeDesignModal} className="text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
            </div>

            <div className="p-4 sm:p-5 bg-black/50 border-b border-gray-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500 uppercase flex items-center gap-1"><Move size={12}/> Можно перетаскивать мышью</span>
              </div>
              <div ref={previewRef} onPointerDown={handleBackgroundClick} className="relative w-full aspect-[16/9] rounded-xl shadow-inner border border-gray-800 overflow-hidden bg-cover bg-center cursor-crosshair touch-none" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop')" }}>
                <div 
                  onPointerDown={handlePointerDown}
                  className={`absolute px-2.5 py-1 flex items-center justify-center whitespace-nowrap cursor-move select-none ${isDragging ? 'transition-none' : 'transition-all duration-200 ease-out'}`}
                  style={{
                    left: `${localWatermark.x ?? 90}%`, top: `${localWatermark.y ?? 85}%`,
                    backgroundColor: (localWatermark.type === 'text' && localWatermark.hasBackground) ? localWatermark.bgColor : 'transparent', color: localWatermark.textColor,
                    opacity: (localWatermark.opacity || 90) / 100,
                    transform: `translate(-50%, -50%) scale(${(localWatermark.size || 100) / 100}) rotate(${localWatermark.angle || 0}deg)`, transformOrigin: 'center',
                    borderRadius: '6px', fontSize: '15px', fontWeight: 'bold',
                    boxShadow: (localWatermark.type === 'text' && localWatermark.hasBackground) ? '0 4px 6px rgba(0,0,0,0.3)' : 'none', zIndex: 10
                  }}
                >
                  {localWatermark.type === 'image' && localWatermark.image ? (<img src={localWatermark.image} alt="watermark" draggable="false" className="max-h-12 object-contain drop-shadow-lg pointer-events-none" />) : (localWatermark.text || 'SMMBOX')}
                </div>
              </div>
            </div>

            <div className="flex border-b border-gray-800 bg-gray-900/30">
              <button onClick={() => setWatermarkTab('simple')} className={`flex-1 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${watermarkTab === 'simple' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300'}`}><TypeIcon size={16}/> Базовая</button>
              <button onClick={() => setWatermarkTab('advanced')} className={`flex-1 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${watermarkTab === 'advanced' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300'}`}><Sliders size={16}/> Продвинутая</button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 bg-[#111318]">
              {watermarkTab === 'simple' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex p-1 bg-black/40 rounded-xl border border-gray-800">
                    <button onClick={() => setLocalWatermark({...localWatermark, type: 'text'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${localWatermark.type === 'text' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Текст</button>
                    <button onClick={() => setLocalWatermark({...localWatermark, type: 'image'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${localWatermark.type === 'image' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Свое лого</button>
                  </div>
                  {localWatermark.type === 'text' ? (
                    <>
                      <div className="space-y-2"><label className="text-xs font-semibold text-gray-400 uppercase">Текст знака</label><input type="text" value={localWatermark.text || ''} onChange={e => setLocalWatermark({...localWatermark, text: e.target.value})} placeholder="SMMBOX" className="w-full bg-black/40 border border-gray-700 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500 outline-none transition-colors" /></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5"><ColorPicker label="Цвет текста" colorKey="textColor" /><ColorPicker label="Фон плашки" colorKey="bgColor" hasCheckbox checkboxKey="hasBackground" /></div>
                    </>
                  ) : (
                    <div className="space-y-2"><label className="text-xs font-semibold text-gray-400 uppercase">Файл логотипа</label><div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:bg-gray-900/50 transition-colors bg-black/20"><input type="file" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} className="hidden" />{localWatermark.image ? (<div className="flex flex-col items-center gap-3"><img src={localWatermark.image} alt="preview" className="h-16 object-contain" /><button onClick={() => fileInputRef.current?.click()} className="text-blue-400 text-xs font-bold hover:underline">Заменить логотип</button></div>) : (<div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}><div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center"><Upload size={18} className="text-blue-400"/></div><span className="text-sm font-medium text-gray-300">Нажмите, чтобы загрузить</span></div>)}</div></div>
                  )}
                  <div className="space-y-2"><label className="text-xs font-semibold text-gray-400 uppercase">Сетка позиций</label><PositionGridButtons /></div>
                </div>
              )}
              {watermarkTab === 'advanced' && (
                <div className="space-y-7 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="space-y-3"><div className="flex justify-between items-center"><label className="text-xs font-semibold text-gray-400 uppercase">Прозрачность</label><span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{localWatermark.opacity || 90}%</span></div><input type="range" min="10" max="100" value={localWatermark.opacity || 90} onChange={e => setLocalWatermark({...localWatermark, opacity: Number(e.target.value)})} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
                  <div className="space-y-3"><div className="flex justify-between items-center"><label className="text-xs font-semibold text-gray-400 uppercase">Масштаб</label><span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{localWatermark.size || 100}%</span></div><input type="range" min="50" max="250" value={localWatermark.size || 100} onChange={e => setLocalWatermark({...localWatermark, size: Number(e.target.value)})} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
                  <div className="space-y-3"><div className="flex justify-between items-center"><label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1.5"><RotateCw size={14}/> Поворот</label><span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{localWatermark.angle || 0}°</span></div><input type="range" min="-180" max="180" value={localWatermark.angle || 0} onChange={handleAngleChange} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" /><div className="flex justify-between text-[10px] text-gray-500 font-mono px-1 pt-1"><span>-180°</span><span>0°</span><span>180°</span></div></div>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-800 bg-[#0d0f13] flex gap-3">
              <button onClick={closeDesignModal} disabled={isModalSaving} className="flex-1 py-3 text-sm font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">Отмена</button>
              <button onClick={handleSaveModalDesign} disabled={isModalSaving} className="flex-[2] py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex justify-center items-center gap-2">
                {isModalSaving ? <Loader2 size={18} className="animate-spin"/> : <Check size={18}/>} Сохранить настройки
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}