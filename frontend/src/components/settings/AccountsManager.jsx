import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { 
  Send, Plus, Trash2, CheckCircle2, RefreshCw, XCircle, 
  ChevronDown, ChevronUp, Copy, AlertTriangle, ShieldAlert,
  Settings2, Image as ImageIcon, Type, LayoutTemplate, X, Check,
  Sliders, Type as TypeIcon, Eye
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
  
  const [expandedId, setExpandedId] = useState(null);
  const [copied, setCopied] = useState(false);

  // Состояния для Модалки водяного знака
  const [designModal, setDesignModal] = useState({ isOpen: false, account: null });
  const [watermarkTab, setWatermarkTab] = useState('simple'); // 'simple' | 'advanced'
  const [localWatermark, setLocalWatermark] = useState({});
  const [localSignatures, setLocalSignatures] = useState({});

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
    const newSignature = localSignatures[acc.id];
    await saveAccountDesign(acc.id, newSignature, acc.watermark);
  };

  const setGlobalWatermark = async (acc) => {
    await saveAccountDesign(acc.id, localSignatures[acc.id] || acc.signature, null);
  };

  // --- ЛОГИКА ВОДЯНОГО ЗНАКА ---
  const openDesignModal = (acc) => {
    setLocalWatermark(acc.watermark || {
      type: 'text', text: 'SMMBOX', position: 'br', opacity: 90, size: 100, 
      textColor: '#FFFFFF', bgColor: '#000000', hasBackground: true
    });
    setWatermarkTab('simple');
    setDesignModal({ isOpen: true, account: acc });
  };

  const closeDesignModal = () => setDesignModal({ isOpen: false, account: null });

  const handleSaveModalDesign = async () => {
    const acc = designModal.account;
    const currentSignature = localSignatures[acc.id] || acc.signature;
    await saveAccountDesign(acc.id, currentSignature, localWatermark);
    closeDesignModal();
  };

  const getPositionClasses = (pos) => {
    const map = {
      'tl': 'top-2 left-2', 'tc': 'top-2 left-1/2 -translate-x-1/2', 'tr': 'top-2 right-2',
      'cl': 'top-1/2 -translate-y-1/2 left-2', 'cc': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', 'cr': 'top-1/2 -translate-y-1/2 right-2',
      'bl': 'bottom-2 left-2', 'bc': 'bottom-2 left-1/2 -translate-x-1/2', 'br': 'bottom-2 right-2'
    };
    return map[pos] || map['br'];
  };

  // --- ДОБАВЛЕНИЕ ТЕЛЕГРАМ ---
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          userId: user.id,
          channels: [{ chatId: infoData.chatId || infoData.username, title: infoData.title, avatar: infoData.avatar }]
        })
      });
      const saveData = await saveRes.json();

      if (saveData.success) {
        setTgInput('');
        await fetchAccounts(user.id); 
        if (verifyAccountsStatus) verifyAccountsStatus(); 
      } else {
        alert(saveData.error || 'Ошибка сохранения аккаунта');
      }
    } catch (error) {
      alert('Ошибка соединения с сервером');
    }
    setIsAddingTg(false);
  };

  // --- РЕНДЕР КАРТОЧКИ АККАУНТА ---
  const renderAccountCard = (acc, providerIcon, providerColor, providerName) => {
    const isExpanded = expandedId === acc.id;
    const hasCustomWatermark = !!acc.watermark;

    return (
      <div key={acc.id} className={`flex flex-col bg-gray-900/60 border transition-all duration-300 rounded-2xl overflow-hidden ${isExpanded ? 'border-gray-600 shadow-2xl' : 'border-gray-800 hover:border-gray-600 shadow-lg'}`}>
        
        {/* Шапка карточки */}
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
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Подключено
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Требует настройки
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={`shrink-0 text-gray-500 transition-transform duration-300 ml-2 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown size={20} />
          </div>
        </div>

        {/* Раскрывающийся контент */}
        <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="p-4 border-t border-gray-800/50 bg-gray-950/40 space-y-5">
              
              {/* Ошибка ТГ */}
              {!acc.isValid && acc.provider === 'TELEGRAM' && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                  <p className="font-bold text-rose-400 flex items-center gap-2 mb-2 text-sm"><ShieldAlert size={16} /> Ошибка доступа</p>
                  <p className="text-gray-300 text-xs sm:text-sm mb-3">{acc.errorMsg || 'Бот удален или не имеет прав администратора.'}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400 bg-black/30 p-2.5 rounded-lg mb-3">
                    <span className="truncate">Бот: <span className="font-mono text-white">@smmbox_auth_bot</span></span>
                    <button onClick={copyBotName} className="shrink-0 text-gray-400 hover:text-white transition-colors ml-2 bg-gray-800 px-2 py-1 rounded-md flex items-center gap-1">
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
                  {/* Подпись */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Type size={14}/> Подпись к постам</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input 
                        type="text" 
                        value={localSignatures[acc.id] !== undefined ? localSignatures[acc.id] : ''}
                        onChange={(e) => handleSignatureChange(acc.id, e.target.value)}
                        placeholder="Например: t.me/mychannel" 
                        className="flex-1 min-w-0 bg-black/40 border border-gray-700 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <button onClick={() => saveSignatureOnly(acc)} className="shrink-0 w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-gray-700">
                        Сохранить
                      </button>
                    </div>
                  </div>

                  {/* Водяной знак */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><ImageIcon size={14}/> Водяной знак</label>
                    
                    <div className="flex p-1 bg-black/40 rounded-xl border border-gray-800">
                      <button onClick={() => setGlobalWatermark(acc)} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${!hasCustomWatermark ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
                        Общий шаблон
                      </button>
                      <button onClick={() => openDesignModal(acc)} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${hasCustomWatermark ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
                        Кастомный
                      </button>
                    </div>

                    {!hasCustomWatermark ? (
                      <p className="text-[11px] sm:text-xs text-gray-500 flex items-center gap-1.5 mt-2 bg-gray-900/50 p-2 rounded-lg border border-gray-800/50">
                        <LayoutTemplate size={12} className="shrink-0"/> Используются настройки из общего профиля проекта.
                      </p>
                    ) : (
                      <button onClick={() => openDesignModal(acc)} className="w-full mt-1 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                        <Settings2 size={16} /> Изменить вид знака
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Удаление */}
              <div className="pt-2 flex justify-end">
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
    <div className="space-y-8 pb-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Мои группы</h1>
      </div>

      {/* --- БЛОК ДОБАВЛЕНИЯ (2 Колонки) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Telegram Блок */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[50px] rounded-full pointer-events-none"></div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <Send size={20} className="text-sky-400" /> Telegram
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mb-5 line-clamp-2">Добавьте бота <span className="text-gray-300 font-mono">@smmbox_auth_bot</span> в админы канала и вставьте ссылку.</p>
          </div>
          <div className="flex flex-col xl:flex-row gap-3">
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

        {/* ВКонтакте Блок (Заглушка) */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between opacity-80">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0077FF]/10 blur-[50px] rounded-full pointer-events-none"></div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <span className="w-5 h-5 bg-[#0077FF] rounded-md flex items-center justify-center font-bold text-[10px] text-white">K</span> ВКонтакте
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mb-5">Подключение сообществ ВКонтакте находится в процессе глобального обновления.</p>
          </div>
          <button disabled className="w-full bg-gray-800/80 text-gray-500 border border-gray-700/80 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm cursor-not-allowed">
            Подключить ВКонтакте <span className="text-[10px] uppercase tracking-wider bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded-full ml-1">Скоро</span>
          </button>
        </div>
      </div>

      {/* --- СПИСОК ГРУПП --- */}
      <div className="space-y-8">
        {/* Telegram Список */}
        {tgAccounts.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2 ml-1">
              <Send size={14} className="text-sky-500"/> Telegram
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {tgAccounts.map(acc => renderAccountCard(acc, <Send size={8} className="text-white"/>, 'bg-sky-500', 'Telegram'))}
            </div>
          </div>
        )}

        {/* VK Список */}
        {vkAccounts.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2 ml-1">
              <span className="text-[#0077FF] font-bold">K</span> ВКонтакте
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {vkAccounts.map(acc => renderAccountCard(acc, <span className="font-bold text-[8px] text-white">K</span>, 'bg-[#0077FF]', 'ВКонтакте'))}
            </div>
          </div>
        )}
        
        {accounts.length === 0 && (
          <div className="text-center py-12 bg-gray-900/20 border border-gray-800/50 rounded-3xl border-dashed">
            <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4"><LayoutTemplate size={24} className="text-gray-600"/></div>
            <p className="text-gray-400 text-sm">У вас пока нет подключенных групп.</p>
          </div>
        )}
      </div>

      {/* --- МОДАЛЬНОЕ ОКНО ДИЗАЙНА ВОДЯНОГО ЗНАКА --- */}
      {designModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeDesignModal}></div>
          
          <div className="relative w-full max-w-lg bg-[#111318] border border-gray-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <ImageIcon size={18} className="text-blue-400"/> Кастомный водяной знак
              </h3>
              <button onClick={closeDesignModal} className="text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
            </div>

            {/* Preview Box */}
            <div className="p-4 sm:p-5 bg-black/50 border-b border-gray-800">
              <div className="relative w-full aspect-[21/9] bg-gray-800 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                {/* Имитация картинки на фоне */}
                <Eye size={40} className="text-gray-700/50 absolute" />
                
                {/* Сам водяной знак */}
                <div 
                  className={`absolute px-2 py-1 flex items-center justify-center whitespace-nowrap transition-all ${getPositionClasses(localWatermark.position)}`}
                  style={{
                    backgroundColor: localWatermark.hasBackground ? localWatermark.bgColor : 'transparent',
                    color: localWatermark.textColor,
                    opacity: (localWatermark.opacity || 90) / 100,
                    transform: `scale(${(localWatermark.size || 100) / 100})`,
                    transformOrigin: localWatermark.position.includes('l') ? 'left' : localWatermark.position.includes('r') ? 'right' : 'center',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  {localWatermark.text || 'SMMBOX'}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800">
              <button 
                onClick={() => setWatermarkTab('simple')} 
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${watermarkTab === 'simple' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <TypeIcon size={16}/> Базовая настройка
              </button>
              <button 
                onClick={() => setWatermarkTab('advanced')} 
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${watermarkTab === 'advanced' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Sliders size={16}/> Продвинутая
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1">
              
              {watermarkTab === 'simple' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Текст знака</label>
                    <input 
                      type="text" value={localWatermark.text || ''} 
                      onChange={e => setLocalWatermark({...localWatermark, text: e.target.value})}
                      placeholder="SMMBOX" className="w-full bg-black/40 border border-gray-700 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-400 uppercase">Цвет текста</label>
                      <div className="flex items-center gap-2 bg-black/40 border border-gray-700 rounded-xl p-1.5 pr-3">
                         <input type="color" value={localWatermark.textColor || '#FFFFFF'} onChange={e => setLocalWatermark({...localWatermark, textColor: e.target.value})} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0" />
                         <span className="text-xs font-mono text-gray-300 uppercase">{localWatermark.textColor || '#FFFFFF'}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-400 uppercase flex justify-between">
                        Фон плашки
                        <input type="checkbox" checked={localWatermark.hasBackground !== false} onChange={e => setLocalWatermark({...localWatermark, hasBackground: e.target.checked})} className="accent-blue-500" />
                      </label>
                      <div className={`flex items-center gap-2 bg-black/40 border border-gray-700 rounded-xl p-1.5 pr-3 transition-opacity ${localWatermark.hasBackground === false ? 'opacity-50 pointer-events-none' : ''}`}>
                         <input type="color" value={localWatermark.bgColor || '#000000'} onChange={e => setLocalWatermark({...localWatermark, bgColor: e.target.value})} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0" />
                         <span className="text-xs font-mono text-gray-300 uppercase">{localWatermark.bgColor || '#000000'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Расположение на фото</label>
                    <div className="grid grid-cols-3 gap-2 bg-black/20 p-2 rounded-xl border border-gray-800/50">
                      {['tl', 'tc', 'tr', 'cl', 'cc', 'cr', 'bl', 'bc', 'br'].map(pos => (
                        <button 
                          key={pos} onClick={() => setLocalWatermark({...localWatermark, position: pos})}
                          className={`h-10 rounded-lg border flex items-center justify-center transition-all ${localWatermark.position === pos ? 'border-blue-500 bg-blue-500/20 text-blue-400 scale-95 shadow-inner' : 'border-gray-700 bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                        >
                          <div className={`w-3 h-3 rounded-sm ${localWatermark.position === pos ? 'bg-blue-400' : 'bg-gray-500'}`}></div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {watermarkTab === 'advanced' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-gray-400 uppercase">Прозрачность</label>
                      <span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{localWatermark.opacity || 90}%</span>
                    </div>
                    <input 
                      type="range" min="10" max="100" value={localWatermark.opacity || 90} 
                      onChange={e => setLocalWatermark({...localWatermark, opacity: Number(e.target.value)})}
                      className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-gray-400 uppercase">Размер (Масштаб)</label>
                      <span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{localWatermark.size || 100}%</span>
                    </div>
                    <input 
                      type="range" min="50" max="200" value={localWatermark.size || 100} 
                      onChange={e => setLocalWatermark({...localWatermark, size: Number(e.target.value)})}
                      className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3 mt-4">
                    <Info size={16} className="text-blue-400 shrink-0 mt-0.5"/>
                    <p className="text-xs text-blue-300/80 leading-relaxed">
                      Продвинутые настройки позволяют тонко подогнать водяной знак под стилистику вашего сообщества. Эти настройки переопределят глобальный шаблон.
                    </p>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-gray-800 bg-[#0d0f13] flex gap-3">
              <button onClick={closeDesignModal} className="flex-1 py-3 text-sm font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">Отмена</button>
              <button onClick={handleSaveModalDesign} className="flex-[2] py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex justify-center items-center gap-2">
                <Check size={18}/> Применить дизайн
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Заглушка для иконки Info в продвинутых настройках
function Info(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size} height={props.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  );
}