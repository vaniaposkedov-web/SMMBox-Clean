import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { 
  Save, Image as ImageIcon, Type, Loader2, Check,
  Upload, Edit3, X, Plus, Trash2, CheckCircle2, ChevronLeft,
  Search, ChevronDown
} from 'lucide-react';

const defaultWatermark = {
  type: 'text', 
  text: 'SMMBOX', 
  position: 'br', // tl, tc, tr, cl, cc, cr, bl, bc, br
  margin: 5,      
  opacity: 80,    
  size: 20,       
  fontFamily: 'system-ui',
  textColor: '#FFFFFF',
  hasBackground: true,
  bgColor: '#000000',
  bgPadding: 10,
  hasStroke: false,
  strokeColor: '#000000',
  strokeWidth: 2
};

const SAMPLE_IMAGES = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000&auto=format&fit=crop"
];

const FONTS = [
  { name: 'Стандартный', value: 'system-ui' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", serif' },
  { name: 'Courier New', value: '"Courier New", monospace' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { name: 'Impact', value: 'Impact, sans-serif' }
];

export default function WatermarkConstructor() {
  const user = useStore((state) => state.user);
  const accounts = useStore((state) => state.accounts) || [];
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  const saveAccountDesign = useStore((state) => state.saveAccountDesign);

  const [view, setView] = useState('landing'); 
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [settings, setSettings] = useState(defaultWatermark);
  
  const [previewFilter, setPreviewFilter] = useState('dark'); 
  const [imgIdx, setImgIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Новые состояния для поиска и раскрывающихся плашек
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCardId, setExpandedCardId] = useState(null);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user?.id) fetchAccounts(user.id);
  }, [user?.id, fetchAccounts]);

  // --- АВТОМАТИЧЕСКИЙ СЛАЙДЕР КАРТИНОК ---
  useEffect(() => {
    let interval;
    if (view === 'editor') {
      interval = setInterval(() => {
        setImgIdx((prev) => (prev + 1) % SAMPLE_IMAGES.length);
      }, 3500); 
    }
    return () => clearInterval(interval);
  }, [view]);

  // Фильтрация настроенных аккаунтов по поиску
  const configuredAccounts = accounts.filter(acc => acc.watermark);
  const filteredConfiguredAccounts = configuredAccounts.filter(acc => 
    acc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- УПРАВЛЕНИЕ ---
  const handleSelectAccount = (acc) => {
    setSelectedAccount(acc);
    setSettings(acc.watermark ? { ...defaultWatermark, ...acc.watermark } : { ...defaultWatermark });
    setIsAccountModalOpen(false);
    setView('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!selectedAccount) return;
    setIsSaving(true);
    const result = await saveAccountDesign(selectedAccount.id, selectedAccount.signature, settings);
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

  const updateSettings = (updates) => setSettings(prev => ({ ...prev, ...updates }));

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => updateSettings({ image: event.target.result, type: 'image' });
      reader.readAsDataURL(file);
    }
  };

  // --- ЛОГИКА РАСПОЛОЖЕНИЯ (АДАПТИВНАЯ ПОД ЛЮБЫЕ ФОТО) ---
  const getWatermarkStyle = () => {
    const margin = `${settings.margin || 0}%`;
    const style = {
      position: 'absolute',
      opacity: (settings.opacity ?? 80) / 100,
      transformOrigin: 'center',
      zIndex: 30,
      pointerEvents: 'none',
      transition: 'all 0.2s ease-out',
      maxWidth: '100%',
      maxHeight: '100%'
    };

    let transformBase = '';
    if (settings.position.includes('t')) style.top = margin;
    if (settings.position.includes('b')) style.bottom = margin;
    if (settings.position.includes('l')) style.left = margin;
    if (settings.position.includes('r')) style.right = margin;
    
    if (settings.position === 'tc' || settings.position === 'cc' || settings.position === 'bc') {
      style.left = '50%'; transformBase += ' translateX(-50%)';
    }
    if (settings.position === 'cl' || settings.position === 'cc' || settings.position === 'cr') {
      style.top = '50%'; transformBase += ' translateY(-50%)';
    }

    style.transform = transformBase.trim();

    if (settings.type === 'text') {
      style.fontSize = `${(settings.size || 20) / 10}rem`; 
      style.color = settings.textColor || '#FFFFFF';
      style.fontFamily = settings.fontFamily || 'system-ui';
      style.fontWeight = 'bold';
      style.lineHeight = '1.2';
      style.whiteSpace = 'nowrap';
      
      if (settings.hasBackground) {
        style.backgroundColor = settings.bgColor;
        const padV = (settings.bgPadding || 10) / 25; 
        const padH = (settings.bgPadding || 10) / 12;
        style.padding = `${padV}em ${padH}em`;
        style.borderRadius = '0.3em'; 
      }

      if (settings.hasStroke) {
        style.WebkitTextStroke = `${settings.strokeWidth || 2}px ${settings.strokeColor || '#000000'}`;
      }
    } else {
      style.height = `${settings.size || 20}%`;
      style.width = 'auto';
      style.objectFit = 'contain';
    }

    return style;
  };


  // --- ЭКРАН 1: СПИСОК / ПРИВЕТСТВИЕ ---
  if (view === 'landing') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 animate-in fade-in duration-500 font-sans">
        
        {configuredAccounts.length === 0 ? (
          // ЗАГЛУШКА (Если нет знаков)
          <div className="bg-admin-card border border-gray-800 rounded-xl p-8 sm:p-12 text-center shadow-lg relative overflow-hidden flex flex-col items-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
            
            <div className="flex justify-center gap-3 sm:gap-4 mb-6 w-full max-w-xs opacity-60">
               {['bg-blue-600', 'bg-orange-500', 'bg-sky-500'].map((color, i) => (
                 <div key={i} className="flex-1 bg-gray-900 border border-gray-700 rounded-xl p-2 shadow-sm transform hover:-translate-y-1 transition-transform">
                    <div className={`w-4 h-4 ${color} rounded mb-2`} />
                    <div className="w-full aspect-video bg-gray-800 rounded-md mb-2 relative">
                       <div className="absolute bottom-1 right-1 w-6 h-1.5 bg-gray-600 rounded-full" />
                    </div>
                    <div className="w-8 h-1.5 bg-blue-500/50 rounded-full" />
                 </div>
               ))}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">Водяные знаки</h1>
            <p className="text-gray-400 text-xs sm:text-sm max-w-sm mx-auto mb-6 leading-relaxed">
              Создайте уникальный знак, чтобы защитить ваш авторский контент.
            </p>
            
            <button 
              onClick={() => setIsAccountModalOpen(true)}
              className="bg-[#5C9E42] hover:bg-[#4d8636] text-white px-8 py-2.5 rounded-lg font-bold transition-all shadow-md active:scale-95 text-sm"
            >
              Создать
            </button>
          </div>
        ) : (
          // СПИСОК АККАУНТОВ (Компактный вид)
          <div className="space-y-4">
            
            {/* Панель: Поиск + Добавить */}
            <div className="flex items-center justify-between gap-3 bg-transparent">
              <div className="relative flex-1 max-w-xs sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Поиск аккаунта..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-admin-card border border-gray-800 focus:border-blue-500 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors shadow-sm"
                />
              </div>
              <button 
                onClick={() => setIsAccountModalOpen(true)}
                className="bg-[#5C9E42] hover:bg-[#4d8636] text-white px-4 py-2 rounded-lg font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 shrink-0 text-sm"
              >
                <Plus size={16} /> <span className="hidden sm:inline">Добавить</span>
              </button>
            </div>

            {/* Сетка компактных плашек */}
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
                      {/* Основная строка карточки */}
                      <div className="flex items-center gap-3 p-3">
                        <div className="relative">
                          <img src={acc.avatarUrl} className="w-8 h-8 rounded-full border border-gray-700 object-cover" alt="" />
                          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-gray-900" title="Настроен"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold text-sm truncate">{acc.name}</h3>
                        </div>
                        <div className={`text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                          <ChevronDown size={18} />
                        </div>
                      </div>

                      {/* Раскрывающаяся область (Кнопки действий) */}
                      <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="flex gap-2 p-3 pt-0 border-t border-gray-800/50 mt-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSelectAccount(acc); }} 
                            className="flex-1 py-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Edit3 size={14}/> Настроить
                          </button>
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm('Удалить водяной знак?')) {
                                await saveAccountDesign(acc.id, undefined, null);
                                fetchAccounts(user.id);
                              }
                            }} 
                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-md transition-colors flex items-center justify-center"
                            title="Удалить знак"
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

        {/* МОДАЛЬНОЕ ОКНО ВЫБОРА */}
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
                      {acc.watermark && <CheckCircle2 className="text-emerald-500" size={14} />}
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

  // --- ЭКРАН 2: РЕДАКТОР ---
  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 animate-in slide-in-from-bottom-4 duration-500 font-sans">
      
      {/* МИНИМАЛИСТИЧНЫЙ HEADER РЕДАКТОРА */}
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
               <span className="text-[8px] text-blue-500 uppercase font-black tracking-widest mt-0.5">Настройка</span>
             </div>
          </div>
        </div>
        
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${saveSuccess ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'}`}
        >
          {isSaving ? <Loader2 className="animate-spin" size={14}/> : saveSuccess ? <Check size={14}/> : <Save size={14}/>}
          <span className="hidden sm:inline">{saveSuccess ? 'Сохранено' : 'Сохранить'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        
        {/* === ЛЕВАЯ ПАНЕЛЬ: ПРЕДПРОСМОТР === */}
        <div className="lg:col-span-7">
          <div className={`relative w-full aspect-video rounded-xl overflow-hidden border-2 transition-all duration-500 shadow-md ${previewFilter === 'dark' ? 'border-gray-800 bg-gray-950' : 'border-gray-300 bg-white'}`}>
             
             {/* Фоновое изображение (Автоматически листается) */}
             <div 
               className="absolute inset-0 bg-cover bg-center transition-all duration-500"
               style={{ 
                 backgroundImage: `url('${SAMPLE_IMAGES[imgIdx]}')`,
                 filter: previewFilter === 'dark' ? 'brightness(0.5)' : 'brightness(1.1)' 
               }}
             />

             {/* СЕТКА (Секции позиционирования) */}
             <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 z-20">
               {['tl', 'tc', 'tr', 'cl', 'cc', 'cr', 'bl', 'bc', 'br'].map(pos => (
                 <div 
                   key={pos} 
                   onClick={() => updateSettings({ position: pos })}
                   className={`border-[0.5px] border-white/10 hover:bg-white/10 cursor-pointer transition-colors ${settings.position === pos ? 'bg-white/5' : ''}`}
                 />
               ))}
             </div>

             {/* Адаптивный Водяной знак */}
             {settings.type === 'image' && settings.image ? (
               <img src={settings.image} style={getWatermarkStyle()} alt="Watermark" />
             ) : (
               <div style={getWatermarkStyle()}>{settings.text || 'SMMBOX'}</div>
             )}
          </div>
        </div>

        {/* === ПРАВАЯ ПАНЕЛЬ: ИНСТРУМЕНТЫ РЕДАКТОРА === */}
        <div className="lg:col-span-5">
          <div className="bg-admin-card border border-gray-800 rounded-xl overflow-hidden shadow-md flex flex-col h-full max-h-[75vh]">
             
             {/* ТАБЫ */}
             <div className="flex p-1.5 bg-gray-900/50 border-b border-gray-800 shrink-0">
                <button 
                  onClick={() => updateSettings({ type: 'text' })}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] rounded-md transition-all flex items-center justify-center gap-1.5 ${settings.type === 'text' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <Type size={12}/> Текст
                </button>
                <button 
                  onClick={() => updateSettings({ type: 'image' })}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] rounded-md transition-all flex items-center justify-center gap-1.5 ${settings.type === 'image' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <ImageIcon size={12}/> Логотип
                </button>
             </div>

             <div className="p-3 sm:p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                
                {/* --- НАСТРОЙКИ ФОНА ПРЕДПРОСМОТРА --- */}
                <div className="flex items-center justify-between bg-gray-950 p-1.5 rounded-lg border border-gray-800">
                   <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest pl-2">Предпросмотр</span>
                   <div className="flex gap-1">
                     <button onClick={() => setPreviewFilter('dark')} className={`px-3 py-1 rounded text-[9px] font-bold transition-all ${previewFilter === 'dark' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Темный</button>
                     <button onClick={() => setPreviewFilter('light')} className={`px-3 py-1 rounded text-[9px] font-bold transition-all ${previewFilter === 'light' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Светлый</button>
                   </div>
                </div>

                <div className="h-px bg-gray-800 w-full" />

                {/* --- НАСТРОЙКИ ТЕКСТА --- */}
                {settings.type === 'text' ? (
                  <div className="space-y-4">
                    
                    {/* Текст и Шрифт */}
                    <div className="space-y-2">
                      <div className="relative">
                        <input 
                          type="text" 
                          value={settings.text}
                          onChange={e => updateSettings({ text: e.target.value })}
                          className="w-full bg-gray-950 border border-gray-800 focus:border-blue-500 rounded-lg py-2 pl-8 pr-3 text-sm text-white font-bold outline-none transition-all placeholder:text-gray-600"
                          placeholder="Текст знака..."
                        />
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500"><Type size={14}/></div>
                      </div>

                      <div className="flex items-center gap-2 bg-gray-950 p-1 rounded-lg border border-gray-800">
                         <select 
                           value={settings.fontFamily} 
                           onChange={e => updateSettings({ fontFamily: e.target.value })}
                           className="flex-1 bg-transparent text-xs text-white font-medium outline-none cursor-pointer pl-2 appearance-none h-7"
                         >
                           {FONTS.map(f => <option key={f.value} value={f.value} className="bg-gray-900">{f.name}</option>)}
                         </select>
                         <div className="w-7 h-7 flex items-center justify-center border-l border-gray-800 relative shrink-0">
                            <input type="color" value={settings.textColor} onChange={e => updateSettings({ textColor: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="w-3.5 h-3.5 rounded-sm border border-gray-700 shadow-sm" style={{ backgroundColor: settings.textColor }} />
                         </div>
                      </div>
                    </div>

                    <div className="h-px bg-gray-800 w-full" />

                    {/* Настройка Фона */}
                    <div className="space-y-2">
                       <div className="flex items-center justify-between">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer flex-1" onClick={() => updateSettings({ hasBackground: !settings.hasBackground })}>
                           Фон плашки
                         </label>
                         <label className="relative inline-flex items-center cursor-pointer shrink-0">
                           <input type="checkbox" checked={settings.hasBackground} onChange={e => updateSettings({ hasBackground: e.target.checked })} className="sr-only peer" />
                           <div className="w-7 h-3.5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-blue-600"></div>
                         </label>
                       </div>
                       
                       {settings.hasBackground && (
                         <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="relative w-8 h-8 bg-gray-950 border border-gray-800 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                               <input type="color" value={settings.bgColor} onChange={e => updateSettings({ bgColor: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                               <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: settings.bgColor }} />
                            </div>
                            <div className="flex-1 bg-gray-950 border border-gray-800 p-1.5 rounded-lg flex items-center gap-2">
                               <span className="text-[9px] text-gray-500 whitespace-nowrap w-6 text-right">{settings.bgPadding}</span>
                               <input type="range" min="0" max="30" value={settings.bgPadding} onChange={e => updateSettings({ bgPadding: Number(e.target.value) })} className="flex-1 h-1 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                            </div>
                         </div>
                       )}
                    </div>

                    <div className="h-px bg-gray-800 w-full" />

                    {/* Настройка Обводки */}
                    <div className="space-y-2">
                       <div className="flex items-center justify-between">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer flex-1" onClick={() => updateSettings({ hasStroke: !settings.hasStroke })}>
                           Обводка текста
                         </label>
                         <label className="relative inline-flex items-center cursor-pointer shrink-0">
                           <input type="checkbox" checked={settings.hasStroke} onChange={e => updateSettings({ hasStroke: e.target.checked })} className="sr-only peer" />
                           <div className="w-7 h-3.5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-blue-600"></div>
                         </label>
                       </div>

                       {settings.hasStroke && (
                         <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="relative w-8 h-8 bg-gray-950 border border-gray-800 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                               <input type="color" value={settings.strokeColor} onChange={e => updateSettings({ strokeColor: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                               <div className="w-4 h-4 rounded-sm border border-gray-600" style={{ backgroundColor: settings.strokeColor }} />
                            </div>
                            <div className="flex-1 bg-gray-950 border border-gray-800 p-1.5 rounded-lg flex items-center gap-2">
                               <span className="text-[9px] text-gray-500 whitespace-nowrap w-6 text-right">{settings.strokeWidth}px</span>
                               <input type="range" min="1" max="8" value={settings.strokeWidth} onChange={e => updateSettings({ strokeWidth: Number(e.target.value) })} className="flex-1 h-1 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                            </div>
                         </div>
                       )}
                    </div>
                  </div>
                ) : (
                  /* --- НАСТРОЙКИ ЛОГОТИПА --- */
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Изображение</label>
                    <div 
                      onClick={() => fileInputRef.current.click()}
                      className="border-2 border-dashed border-gray-700 bg-gray-950 rounded-lg p-4 text-center hover:bg-gray-900 transition-all cursor-pointer group"
                    >
                      <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                      {settings.image ? (
                        <div className="relative inline-block">
                          <img src={settings.image} className="h-10 object-contain rounded-md" alt="" />
                          <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-0.5 rounded-full shadow-md"><Edit3 size={10}/></div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                           <div className="w-8 h-8 bg-gray-800 text-gray-400 rounded-md flex items-center justify-center group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-all"><Upload size={14}/></div>
                           <span className="text-[10px] font-bold text-gray-400">Загрузить логотип</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="h-px bg-gray-800 w-full" />

                {/* --- МИКШЕРЫ (РЕАЛЬНЫЕ ПРОЦЕНТЫ) --- */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-gray-400">Размер (Адаптивно)</span>
                      <span className="text-blue-500">{settings.size}%</span>
                    </div>
                    <input type="range" min="5" max="100" value={settings.size} onChange={e => updateSettings({ size: Number(e.target.value) })} className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-gray-400">Прозрачность</span>
                      <span className="text-blue-500">{settings.opacity}%</span>
                    </div>
                    <input type="range" min="10" max="100" value={settings.opacity} onChange={e => updateSettings({ opacity: Number(e.target.value) })} className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-gray-400">Отступ</span>
                      <span className="text-blue-500">{settings.margin}%</span>
                    </div>
                    <input type="range" min="0" max="20" value={settings.margin} onChange={e => updateSettings({ margin: Number(e.target.value) })} className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                  </div>
                </div>

             </div>
          </div>
        </div>
      </div>
    </div>
  );
}