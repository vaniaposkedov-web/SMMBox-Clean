import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { 
  Save, Image as ImageIcon, Type, Palette, Loader2, Check,
  Upload, Edit3, X, Plus, Trash2, CheckCircle2, ChevronLeft, ChevronRight,
  Settings2, Type as TypeIcon
} from 'lucide-react';

const defaultWatermark = {
  type: 'text', 
  text: 'SMMBOX', 
  position: 'br', // tl, tc, tr, cl, cc, cr, bl, bc, br
  margin: 4,      // Отступ от краев
  opacity: 100,   // Прозрачность
  size: 100,      // Размер (шрифта или картинки)
  
  // Настройки текста
  fontFamily: 'system-ui',
  textColor: '#FFFFFF',
  
  // Настройки фона
  hasBackground: true,
  bgColor: '#000000',
  bgPadding: 10,
  
  // Настройки обводки
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
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user?.id) fetchAccounts(user.id);
  }, [user?.id, fetchAccounts]);

  const configuredAccounts = accounts.filter(acc => acc.watermark);

  // --- ЛОГИКА И СОХРАНЕНИЕ ---

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

  // --- ЛОГИКА РАСПОЛОЖЕНИЯ И СТИЛЕЙ ВОДЯНОГО ЗНАКА ---
  const getWatermarkStyle = () => {
    const margin = `${settings.margin || 0}%`;
    const style = {
      position: 'absolute',
      opacity: (settings.opacity ?? 100) / 100,
      transformOrigin: 'center',
      zIndex: 30,
      pointerEvents: 'none',
      transition: 'all 0.2s ease-out',
    };

    // Привязка к краям с учетом отступа (Логика сетки SMMBox)
    let transformBase = '';
    if (settings.position.includes('t')) style.top = margin;
    if (settings.position.includes('b')) style.bottom = margin;
    if (settings.position.includes('l')) style.left = margin;
    if (settings.position.includes('r')) style.right = margin;
    
    if (settings.position === 'tc' || settings.position === 'cc' || settings.position === 'bc') {
      style.left = '50%';
      transformBase += ' translateX(-50%)';
    }
    if (settings.position === 'cl' || settings.position === 'cc' || settings.position === 'cr') {
      style.top = '50%';
      transformBase += ' translateY(-50%)';
    }

    style.transform = transformBase.trim();

    // Применение стилей в зависимости от типа (текст или картинка)
    if (settings.type === 'text') {
      // Плавное увеличение текста через fontSize (50 = 1rem, 100 = 2rem)
      style.fontSize = `${(settings.size || 100) / 50}rem`;
      style.color = settings.textColor || '#FFFFFF';
      style.fontFamily = settings.fontFamily || 'system-ui';
      style.fontWeight = 'bold';
      style.lineHeight = '1.2';
      
      if (settings.hasBackground) {
        style.backgroundColor = settings.bgColor;
        // Padding зависит от ползунка bgPadding
        const padV = (settings.bgPadding || 10) / 20; 
        const padH = (settings.bgPadding || 10) / 10;
        style.padding = `${padV}em ${padH}em`;
        style.borderRadius = '8px';
      }

      if (settings.hasStroke) {
        style.WebkitTextStroke = `${settings.strokeWidth || 2}px ${settings.strokeColor || '#000000'}`;
      }
    } else {
      // Для картинки используем scale
      const scaleStr = `scale(${(settings.size || 100) / 100})`;
      style.transform = style.transform ? `${style.transform} ${scaleStr}` : scaleStr;
    }

    return style;
  };


  // --- ЭКРАН 1: СПИСОК / ПРИВЕТСТВИЕ (ТЕМНЫЙ ДИЗАЙН) ---
  if (view === 'landing') {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 animate-in fade-in duration-500 font-sans">
        
        {configuredAccounts.length === 0 ? (
          // ЗАГЛУШКА
          <div className="bg-admin-card border border-gray-800 rounded-[2.5rem] p-10 sm:p-16 text-center shadow-2xl relative overflow-hidden flex flex-col items-center">
            
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
            
            <div className="flex justify-center gap-4 sm:gap-6 mb-10 w-full max-w-md opacity-60">
               {[
                 { color: 'bg-blue-600' }, { color: 'bg-orange-500' }, { color: 'bg-sky-500' }
               ].map((card, i) => (
                 <div key={i} className="flex-1 bg-gray-900 border border-gray-700 rounded-2xl p-3 shadow-lg transform hover:-translate-y-2 transition-transform">
                    <div className={`w-6 h-6 ${card.color} rounded flex items-center justify-center mb-4`} />
                    <div className="w-full aspect-video bg-gray-800 rounded-lg flex items-center justify-center relative overflow-hidden mb-2">
                       <div className="w-6 h-6 rounded-full bg-gray-700 absolute left-2 top-2" />
                       <div className="absolute bottom-2 right-2 w-12 h-3 bg-gray-600 rounded-full" />
                    </div>
                    <div className="w-10 h-2 bg-blue-500/50 rounded-full" />
                 </div>
               ))}
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">Водяные знаки</h1>
            <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
              Создайте уникальный водяной знак, чтобы защитить ваш авторский контент в социальных сетях.
            </p>
            
            <button 
              onClick={() => setIsAccountModalOpen(true)}
              className="bg-[#5C9E42] hover:bg-[#4d8636] text-white px-10 py-3.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 text-lg"
            >
              Создать
            </button>
          </div>
        ) : (
          // СПИСОК АККАУНТОВ
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-admin-card border border-gray-800 p-6 rounded-3xl shadow-lg">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Водяные знаки</h1>
                <p className="text-gray-400 text-sm mt-1">Управление дизайном для ваших аккаунтов</p>
              </div>
              <button 
                onClick={() => setIsAccountModalOpen(true)}
                className="bg-[#5C9E42] hover:bg-[#4d8636] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Plus size={20} /> Добавить знак
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {configuredAccounts.map(acc => (
                <div key={acc.id} className="bg-admin-card border border-gray-800 p-5 rounded-[2rem] flex flex-col gap-5 hover:border-gray-700 transition-all shadow-lg group">
                  <div className="flex items-center gap-4">
                    <img src={acc.avatarUrl} className="w-12 h-12 rounded-full border border-gray-700 object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-base truncate">{acc.name}</h3>
                      <span className="text-[10px] text-emerald-500 font-black uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-md">Настроен</span>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleSelectAccount(acc)} className="flex-1 py-2.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"><Edit3 size={16}/> Изменить</button>
                    <button onClick={async () => {
                      if (window.confirm('Удалить водяной знак?')) {
                        await saveAccountDesign(acc.id, undefined, null);
                        fetchAccounts(user.id);
                      }
                    }} className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-colors"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* МОДАЛЬНОЕ ОКНО ВЫБОРА АККАУНТА */}
        {isAccountModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAccountModalOpen(false)} />
            <div className="relative w-full max-w-md bg-[#111318] border border-gray-800 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Выберите аккаунт</h3>
                <button onClick={() => setIsAccountModalOpen(false)} className="text-gray-500 hover:text-white bg-gray-800 p-1.5 rounded-lg transition-colors"><X size={20}/></button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-2">
                {accounts.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-6">Сначала подключите социальные сети</p>
                ) : (
                  accounts.map(acc => (
                    <button 
                      key={acc.id} 
                      onClick={() => handleSelectAccount(acc)}
                      className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-800 transition-all text-left border border-transparent hover:border-gray-700"
                    >
                      <img src={acc.avatarUrl} className="w-12 h-12 rounded-full border border-gray-800 object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{acc.name}</div>
                        <div className="text-[10px] text-gray-500 uppercase font-black">{acc.provider}</div>
                      </div>
                      {acc.watermark && <CheckCircle2 className="text-emerald-500" size={18} />}
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

  // --- ЭКРАН 2: РЕДАКТОР (ТЕМНЫЙ ДИЗАЙН, УДОБНЫЙ МИКШЕР) ---
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 animate-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER РЕДАКТОРА */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-admin-card border border-gray-800 p-4 sm:p-5 rounded-3xl mb-6 shadow-xl gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('landing')} className="p-2 hover:bg-gray-800 rounded-xl text-gray-400 transition-colors">
            <ChevronLeft size={24}/>
          </button>
          <div className="h-10 w-px bg-gray-800 hidden sm:block" />
          <div className="flex items-center gap-3">
             <img src={selectedAccount?.avatarUrl} className="w-10 h-10 rounded-full border border-gray-700" alt="" />
             <div>
               <h2 className="text-white font-bold leading-tight">{selectedAccount?.name}</h2>
               <span className="text-[10px] text-blue-500 uppercase font-black tracking-widest">Настройка дизайна</span>
             </div>
          </div>
        </div>
        
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${saveSuccess ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'}`}
        >
          {isSaving ? <Loader2 className="animate-spin" size={20}/> : saveSuccess ? <Check size={20}/> : <Save size={20}/>}
          <span>{saveSuccess ? 'Успешно сохранено' : 'Сохранить изменения'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* === ЛЕВАЯ ПАНЕЛЬ: ПРЕДПРОСМОТР === */}
        <div className="lg:col-span-7 space-y-6">
          <div className={`relative w-full aspect-video rounded-[2.5rem] overflow-hidden border-4 transition-all duration-500 shadow-2xl ${previewFilter === 'dark' ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
             
             {/* Фоновое изображение */}
             <div 
               className="absolute inset-0 bg-cover bg-center transition-all duration-300"
               style={{ 
                 backgroundImage: `url('${SAMPLE_IMAGES[imgIdx]}')`,
                 filter: previewFilter === 'dark' ? 'brightness(0.5)' : 'brightness(1.1)' 
               }}
             />

             {/* Стрелки слайдера */}
             <button onClick={() => setImgIdx((p) => (p === 0 ? SAMPLE_IMAGES.length - 1 : p - 1))} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all z-40 backdrop-blur-sm"><ChevronLeft size={24}/></button>
             <button onClick={() => setImgIdx((p) => (p === SAMPLE_IMAGES.length - 1 ? 0 : p + 1))} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all z-40 backdrop-blur-sm"><ChevronRight size={24}/></button>

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

             {/* Водяной знак */}
             <div style={getWatermarkStyle()}>
               {settings.type === 'image' && settings.image ? (
                 <img src={settings.image} className="max-h-20 object-contain" alt="Watermark" />
               ) : (
                 settings.text || 'SMMBOX'
               )}
             </div>
          </div>

          {/* ПЕРЕКЛЮЧАТЕЛЬ ФОНА ПРЕДПРОСМОТРА */}
          <div className="flex justify-center gap-4 bg-admin-card border border-gray-800 p-3 rounded-2xl w-fit mx-auto">
             <button 
               onClick={() => setPreviewFilter('dark')}
               className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${previewFilter === 'dark' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <div className={`w-3 h-3 rounded-full border-2 ${previewFilter === 'dark' ? 'border-blue-500 bg-blue-500' : 'border-gray-500'}`} /> Темный фон
             </button>
             <button 
               onClick={() => setPreviewFilter('light')}
               className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${previewFilter === 'light' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <div className={`w-3 h-3 rounded-full border-2 ${previewFilter === 'light' ? 'border-blue-500 bg-blue-500' : 'border-gray-500'}`} /> Светлый фон
             </button>
          </div>
        </div>

        {/* === ПРАВАЯ ПАНЕЛЬ: ИНСТРУМЕНТЫ РЕДАКТОРА === */}
        <div className="lg:col-span-5">
          <div className="bg-admin-card border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-full">
             
             {/* ТАБЫ (Текст / Логотип) */}
             <div className="flex p-2 bg-gray-900/50 border-b border-gray-800">
                <button 
                  onClick={() => updateSettings({ type: 'text' })}
                  className={`flex-1 py-3 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-2 ${settings.type === 'text' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <TypeIcon size={16}/> Текст
                </button>
                <button 
                  onClick={() => updateSettings({ type: 'image' })}
                  className={`flex-1 py-3 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-2 ${settings.type === 'image' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <ImageIcon size={16}/> Логотип
                </button>
             </div>

             <div className="p-6 sm:p-8 space-y-8 overflow-y-auto custom-scrollbar">
                
                {/* --- НАСТРОЙКИ ТЕКСТА --- */}
                {settings.type === 'text' ? (
                  <div className="space-y-8">
                    
                    {/* Текст и Шрифт */}
                    <div className="space-y-4">
                      <div className="relative">
                        <input 
                          type="text" 
                          value={settings.text}
                          onChange={e => updateSettings({ text: e.target.value })}
                          className="w-full bg-gray-950 border border-gray-800 focus:border-blue-500 rounded-2xl py-4 pl-14 pr-4 text-white font-bold outline-none transition-all placeholder:text-gray-600"
                          placeholder="Введите текст знака..."
                        />
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-500"><Type size={20}/></div>
                      </div>

                      <div className="flex items-center gap-3 bg-gray-950 p-2 rounded-2xl border border-gray-800">
                         <select 
                           value={settings.fontFamily} 
                           onChange={e => updateSettings({ fontFamily: e.target.value })}
                           className="flex-1 bg-transparent text-sm text-white font-medium outline-none cursor-pointer pl-3 appearance-none"
                         >
                           {FONTS.map(f => <option key={f.value} value={f.value} className="bg-gray-900">{f.name}</option>)}
                         </select>
                         <div className="w-10 h-10 flex items-center justify-center border-l border-gray-800 relative">
                            <input type="color" value={settings.textColor} onChange={e => updateSettings({ textColor: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Цвет текста" />
                            <div className="w-5 h-5 rounded-full border border-gray-700 shadow-sm" style={{ backgroundColor: settings.textColor }} />
                         </div>
                      </div>
                    </div>

                    <div className="h-px bg-gray-800 w-full" />

                    {/* Настройка Фона */}
                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                         <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                           Фон плашки
                         </label>
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input type="checkbox" checked={settings.hasBackground} onChange={e => updateSettings({ hasBackground: e.target.checked })} className="sr-only peer" />
                           <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                         </label>
                       </div>
                       
                       <div className={`transition-all duration-300 space-y-4 ${!settings.hasBackground ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                          <div className="flex items-center gap-3">
                             <div className="relative w-12 h-12 bg-gray-950 border border-gray-800 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                                <input type="color" value={settings.bgColor} onChange={e => updateSettings({ bgColor: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <div className="w-6 h-6 rounded-md" style={{ backgroundColor: settings.bgColor }} />
                             </div>
                             <div className="flex-1 space-y-2 bg-gray-950 border border-gray-800 p-3 rounded-xl">
                                <div className="flex justify-between text-xs text-gray-400"><span>Размер фона</span><span>{settings.bgPadding}%</span></div>
                                <input type="range" min="0" max="40" value={settings.bgPadding} onChange={e => updateSettings({ bgPadding: Number(e.target.value) })} className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="h-px bg-gray-800 w-full" />

                    {/* Настройка Обводки */}
                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                         <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Обводка текста</label>
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input type="checkbox" checked={settings.hasStroke} onChange={e => updateSettings({ hasStroke: e.target.checked })} className="sr-only peer" />
                           <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                         </label>
                       </div>

                       <div className={`transition-all duration-300 space-y-4 ${!settings.hasStroke ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                          <div className="flex items-center gap-3">
                             <div className="relative w-12 h-12 bg-gray-950 border border-gray-800 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                                <input type="color" value={settings.strokeColor} onChange={e => updateSettings({ strokeColor: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <div className="w-6 h-6 rounded-md border border-gray-600" style={{ backgroundColor: settings.strokeColor }} />
                             </div>
                             <div className="flex-1 space-y-2 bg-gray-950 border border-gray-800 p-3 rounded-xl">
                                <div className="flex justify-between text-xs text-gray-400"><span>Толщина</span><span>{settings.strokeWidth}px</span></div>
                                <input type="range" min="1" max="10" value={settings.strokeWidth} onChange={e => updateSettings({ strokeWidth: Number(e.target.value) })} className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                ) : (
                  /* --- НАСТРОЙКИ ЛОГОТИПА --- */
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Изображение</label>
                    <div 
                      onClick={() => fileInputRef.current.click()}
                      className="border-2 border-dashed border-gray-700 bg-gray-950 rounded-3xl p-10 text-center hover:bg-gray-900 transition-all cursor-pointer group"
                    >
                      <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                      {settings.image ? (
                        <div className="relative inline-block">
                          <img src={settings.image} className="h-20 object-contain rounded-lg" alt="" />
                          <div className="absolute -top-3 -right-3 bg-blue-600 text-white p-1.5 rounded-full shadow-lg"><Edit3 size={14}/></div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                           <div className="w-14 h-14 bg-gray-800 text-gray-400 rounded-2xl flex items-center justify-center group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-all"><Upload size={24}/></div>
                           <span className="text-sm font-bold text-gray-400">Загрузить логотип (PNG/SVG)</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="h-px bg-gray-800 w-full" />

                {/* --- ОБЩИЕ МИКШЕРЫ (РАЗМЕР, ПРОЗРАЧНОСТЬ, ОТСТУП) --- */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span className="text-gray-400">Увеличение</span>
                      <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md">{settings.size}%</span>
                    </div>
                    <input type="range" min="50" max="300" value={settings.size} onChange={e => updateSettings({ size: Number(e.target.value) })} className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span className="text-gray-400">Прозрачность</span>
                      <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md">{settings.opacity}%</span>
                    </div>
                    <input type="range" min="10" max="100" value={settings.opacity} onChange={e => updateSettings({ opacity: Number(e.target.value) })} className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span className="text-gray-400">Отступ от краев</span>
                      <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md">{settings.margin}%</span>
                    </div>
                    <input type="range" min="0" max="25" value={settings.margin} onChange={e => updateSettings({ margin: Number(e.target.value) })} className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                  </div>
                </div>

             </div>
          </div>
        </div>
      </div>
    </div>
  );
}