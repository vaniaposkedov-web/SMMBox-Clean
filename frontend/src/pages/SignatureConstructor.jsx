import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { 
  Save, Type, Loader2, Check,
  Edit3, X, Plus, Trash2, CheckCircle2, ChevronLeft,
  Search, ChevronDown, MessageSquare, AlignLeft
} from 'lucide-react';

export default function SignatureConstructor() {
  const user = useStore((state) => state.user);
  const accounts = useStore((state) => state.accounts) || [];
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  const saveAccountDesign = useStore((state) => state.saveAccountDesign);

  const [view, setView] = useState('landing'); 
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  
  // Для подписи нам нужна только строка
  const [signatureText, setSignatureText] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCardId, setExpandedCardId] = useState(null);

  useEffect(() => {
    if (user?.id) fetchAccounts(user.id);
  }, [user?.id, fetchAccounts]);

  // Фильтрация аккаунтов, у которых настроена СВОЯ подпись (не null)
  const configuredAccounts = accounts.filter(acc => acc.signature !== null && acc.signature !== undefined && acc.signature !== "");
  const filteredConfiguredAccounts = configuredAccounts.filter(acc => 
    acc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectAccount = (acc) => {
    setSelectedAccount(acc);
    setSignatureText(acc.signature || '');
    setIsAccountModalOpen(false);
    setView('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!selectedAccount) return;
    setIsSaving(true);
    // Сохраняем подпись, ВАЖНО: прокидываем текущий watermark, чтобы не затереть его
    const result = await saveAccountDesign(selectedAccount.id, signatureText, selectedAccount.watermark);
    setIsSaving(false);
    
    if (result.success) {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setView('landing');
        setSelectedAccount(null);
      }, 1500);
      fetchAccounts(user.id);
    }
  };

  const handleDeleteSignature = async (e, acc) => {
    e.stopPropagation();
    if (window.confirm('Удалить свою подпись и вернуть шаблон?')) {
      // Передаем null в signature, чтобы сбросить на "Шаблон", сохраняя watermark
      await saveAccountDesign(acc.id, null, acc.watermark);
      fetchAccounts(user.id);
    }
  };

  if (view === 'landing') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 animate-in fade-in duration-500 font-sans">
        
        {configuredAccounts.length === 0 ? (
          <div className="bg-admin-card border border-gray-800 rounded-xl p-8 sm:p-12 text-center shadow-lg relative overflow-hidden flex flex-col items-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />
            
            <div className="flex justify-center mb-6 w-full max-w-xs opacity-60">
               <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 shadow-sm w-48 relative">
                  <div className="w-full h-2 bg-gray-800 rounded mb-2" />
                  <div className="w-3/4 h-2 bg-gray-800 rounded mb-4" />
                  <div className="w-full h-px bg-gray-800 mb-3" />
                  <div className="w-1/2 h-2.5 bg-purple-500/50 rounded-full" />
               </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">Подписи к постам</h1>
            <p className="text-gray-400 text-xs sm:text-sm max-w-sm mx-auto mb-6 leading-relaxed">
              Настройте уникальный текст, ссылки или хештеги, которые будут автоматически добавляться в конец каждого поста.
            </p>
            
            <button 
              onClick={() => setIsAccountModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-2.5 rounded-lg font-bold transition-all shadow-md shadow-purple-600/20 active:scale-95 text-sm"
            >
              Создать подпись
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 bg-transparent">
              <div className="relative flex-1 max-w-xs sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Поиск аккаунта..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-admin-card border border-gray-800 focus:border-purple-500 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors shadow-sm"
                />
              </div>
              <button 
                onClick={() => setIsAccountModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 shrink-0 text-sm"
              >
                <Plus size={16} /> <span className="hidden sm:inline">Добавить</span>
              </button>
            </div>

            {filteredConfiguredAccounts.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">Аккаунты не найдены</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredConfiguredAccounts.map(acc => {
                  const isExpanded = expandedCardId === acc.id;
                  return (
                    <div 
                      key={acc.id} 
                      onClick={() => setExpandedCardId(isExpanded ? null : acc.id)}
                      className={`bg-admin-card border border-gray-800 rounded-lg transition-all cursor-pointer shadow-sm hover:border-gray-700 overflow-hidden ${isExpanded ? 'bg-gray-900/50' : ''}`}
                    >
                      <div className="flex items-center gap-3 p-3">
                        <div className="relative shrink-0">
                          <img src={acc.avatarUrl} className="w-8 h-8 rounded-full border border-gray-700 object-cover" alt="" />
                          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-purple-500 rounded-full border border-gray-900"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold text-sm truncate">{acc.name}</h3>
                          <p className="text-gray-500 text-[10px] truncate">{acc.signature}</p>
                        </div>
                        <div className={`text-gray-500 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                          <ChevronDown size={18} />
                        </div>
                      </div>

                      <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="flex gap-2 p-3 pt-0 border-t border-gray-800/50 mt-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSelectAccount(acc); }} 
                            className="flex-1 py-1.5 bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Edit3 size={14}/> Изменить
                          </button>
                          <button 
                            onClick={(e) => handleDeleteSignature(e, acc)} 
                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-md transition-colors flex items-center justify-center"
                            title="Сбросить на шаблон"
                          >
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* МОДАЛКА ВЫБОРА АККАУНТА */}
        {isAccountModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAccountModalOpen(false)} />
            <div className="relative w-full max-w-sm bg-[#111318] border border-gray-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                <h3 className="text-sm font-bold text-white">Выберите аккаунт</h3>
                <button onClick={() => setIsAccountModalOpen(false)} className="text-gray-500 hover:text-white bg-gray-800 p-1 rounded-md transition-colors"><X size={16}/></button>
              </div>
              <div className="p-2 max-h-[50vh] overflow-y-auto custom-scrollbar space-y-1">
                {accounts.length === 0 ? (
                  <p className="text-center text-xs text-gray-500 py-4">Сначала подключите соцсети</p>
                ) : (
                  accounts.map(acc => (
                    <button 
                      key={acc.id} 
                      onClick={() => handleSelectAccount(acc)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800 transition-all text-left border border-transparent hover:border-gray-700"
                    >
                      <img src={acc.avatarUrl} className="w-8 h-8 rounded-full border border-gray-800 object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{acc.name}</div>
                        <div className="text-[9px] text-gray-500 uppercase font-black">{acc.provider}</div>
                      </div>
                      {(acc.signature !== null && acc.signature !== undefined) && <CheckCircle2 className="text-purple-500" size={14} />}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 animate-in slide-in-from-bottom-4 duration-500 font-sans">
      <div className="flex items-center justify-between bg-admin-card border border-gray-800 p-2 sm:p-3 rounded-lg mb-4 shadow-sm gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => setView('landing')} className="p-1 hover:bg-gray-800 rounded-md text-gray-400 transition-colors">
            <ChevronLeft size={18}/>
          </button>
          <div className="h-5 w-px bg-gray-800 hidden sm:block" />
          <div className="flex items-center gap-2">
             <img src={selectedAccount?.avatarUrl} className="w-6 h-6 rounded-full border border-gray-700" alt="" />
             <div className="flex flex-col">
               <h2 className="text-white font-bold text-[11px] leading-none">{selectedAccount?.name}</h2>
               <span className="text-[8px] text-purple-500 uppercase font-black tracking-widest mt-0.5">Редактор подписи</span>
             </div>
          </div>
        </div>
        
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${saveSuccess ? 'bg-emerald-600 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-sm'}`}
        >
          {isSaving ? <Loader2 className="animate-spin" size={14}/> : saveSuccess ? <Check size={14}/> : <Save size={14}/>}
          <span className="hidden sm:inline">{saveSuccess ? 'Сохранено' : 'Сохранить'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        
        {/* ЛЕВАЯ ПАНЕЛЬ: ВИЗУАЛЬНЫЙ ПРЕДПРОСМОТР */}
        <div className="lg:col-span-7">
          <div className="bg-[#0f1115] border border-gray-800 rounded-xl p-4 sm:p-6 shadow-inner flex flex-col items-center justify-center min-h-[400px]">
            
            {/* Имитация поста (Telegram/VK style) */}
            <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg animate-in zoom-in-95 duration-300">
               <div className="p-4 space-y-3">
                 <div className="flex items-center gap-3 mb-2">
                   <div className="w-10 h-10 rounded-full bg-gray-800 shrink-0 overflow-hidden">
                     <img src={selectedAccount?.avatarUrl} className="w-full h-full object-cover" alt=""/>
                   </div>
                   <div>
                     <div className="text-sm font-bold text-white leading-tight">{selectedAccount?.name || 'Название группы'}</div>
                     <div className="text-xs text-gray-500">Только что</div>
                   </div>
                 </div>
                 
                 <div className="w-full aspect-video bg-gray-800 rounded-xl flex items-center justify-center relative overflow-hidden">
                   <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover opacity-80" alt="post demo" />
                 </div>
                 
                 <div className="text-sm text-gray-300 space-y-1">
                   <p>Привет! Это пример вашего будущего поста. Здесь будет располагаться основной текст, который вы напишете в редактоere.</p>
                   
                   {/* Блок самой подписи */}
                   <div className="pt-3 mt-3 border-t border-gray-800/80">
                     {signatureText ? (
                        <p className="text-blue-400 font-medium whitespace-pre-wrap text-[13px]">{signatureText}</p>
                     ) : (
                        <p className="text-gray-600 italic text-[13px]">Здесь появится ваша подпись...</p>
                     )}
                   </div>
                 </div>
               </div>
            </div>

          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ: ИНСТРУМЕНТЫ */}
        <div className="lg:col-span-5">
          <div className="bg-admin-card border border-gray-800 rounded-xl overflow-hidden shadow-md flex flex-col h-full max-h-[75vh]">
             <div className="flex items-center gap-2 p-3 sm:p-4 bg-gray-900/50 border-b border-gray-800 shrink-0">
                <AlignLeft size={16} className="text-purple-500" />
                <h3 className="text-sm font-bold text-white">Текст подписи</h3>
             </div>

             <div className="p-3 sm:p-4 flex-1 flex flex-col">
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  Этот текст будет автоматически добавляться в конец каждого поста для аккаунта <b>{selectedAccount?.name}</b>. Вы можете использовать ссылки и emoji.
                </p>
                
                <textarea 
                  value={signatureText}
                  onChange={e => setSignatureText(e.target.value)}
                  placeholder="Например: &#10;Подписывайтесь на наш канал: t.me/link&#10;📞 +7 (999) 000-00-00"
                  className="w-full flex-1 min-h-[250px] bg-gray-950 border border-gray-800 focus:border-purple-500 rounded-xl p-4 text-sm text-white resize-none outline-none transition-colors placeholder:text-gray-600 custom-scrollbar"
                />
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}