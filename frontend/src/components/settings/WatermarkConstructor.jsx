import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { 
  Save, Image as ImageIcon, Type, Palette, Loader2, Check,
  Upload, Edit3, X, Plus, Trash2, CheckCircle2, ChevronLeft, ChevronRight
} from 'lucide-react';

const defaultWatermark = {
  type: 'text', 
  text: 'SMMBOX', 
  position: 'br', 
  hasBackground: true,
  textColor: '#FFFFFF', 
  bgColor: '#000000', 
  size: 100, 
  opacity: 100, 
  margin: 4, 
  hasStroke: false,
  fontFamily: 'system-ui'
};

const SAMPLE_IMAGES = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000&auto=format&fit=crop"
];

const FONTS = [
  { name: 'System', value: 'system-ui' },
  { name: 'Lobster', value: '"Lobster", cursive' },
  { name: 'Roboto', value: '"Roboto", sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' }
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
  
  const [previewFilter, setPreviewFilter] = useState('dark'); // 'dark' | 'light'
  const [imgIdx, setImgIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user?.id) fetchAccounts(user.id);
  }, [user?.id, fetchAccounts]);

  const configuredAccounts = accounts.filter(acc => acc.watermark);

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

  // --- ЛОГИКА РАСПОЛОЖЕНИЯ (СЕКЦИИ + ОТСТУП) ---
  const getWatermarkStyle = () => {
    const margin = `${settings.margin || 0}%`;
    const style = {
      position: 'absolute',
      opacity: (settings.opacity ?? 100) / 100,
      transformOrigin: 'center',
      zIndex: 30,
      pointerEvents: 'none',
      transition: 'all 0.2s ease-out'
    };

    if (settings.type === 'text') {
      style.fontSize = `${((settings.size || 100) / 100) * 1.2}rem`;
      style.backgroundColor = settings.hasBackground ? settings.bgColor : 'transparent';
      style.color = settings.textColor;
      style.padding = settings.hasBackground ? '0.3em 0.6em' : '0';
      style.borderRadius = '6px';
      style.fontFamily = settings.fontFamily || 'system-ui';
      style.fontWeight = 'bold';
      if (settings.hasStroke) {
        style.WebkitTextStroke = `1px ${settings.hasBackground ? 'rgba(0,0,0,0.3)' : '#000'}`;
      }
    } else {
      style.transform = `scale(${(settings.size || 100) / 100})`;
    }

    // Привязка к краям с учетом отступа
    switch (settings.position) {
      case 'tl': style.top = margin; style.left = margin; break;
      case 'tc': style.top = margin; style.left = '50%'; style.transform = `${style.transform || ''} translateX(-50%)`; break;
      case 'tr': style.top = margin; style.right = margin; break;
      case 'cl': style.top = '50%'; style.left = margin; style.transform = `${style.transform || ''} translateY(-50%)`; break;
      case 'cc': style.top = '50%'; style.left = '50%'; style.transform = `${style.transform || ''} translate(-50%, -50%)`; break;
      case 'cr': style.top = '50%'; style.right = margin; style.transform = `${style.transform || ''} translateY(-50%)`; break;
      case 'bl': style.bottom = margin; style.left = margin; break;
      case 'bc': style.bottom = margin; style.left = '50%'; style.transform = `${style.transform || ''} translateX(-50%)`; break;
      case 'br': style.bottom = margin; style.right = margin; break;
      default: style.bottom = margin; style.right = margin; break;
    }

    return style;
  };

  // --- ЭКРАН 1: СПИСОК / ПРИВЕТСТВИЕ ---
  if (view === 'landing') {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 animate-in fade-in duration-500">
        
        {configuredAccounts.length === 0 ? (
          // ЗАГЛУШКА: Если нет настроенных знаков
          <div className="bg-[#111318] border border-gray-800 rounded-3xl p-10 sm:p-16 text-center shadow-xl relative overflow-hidden flex flex-col items-center">
            
            {/* Имитация 3-х карточек из первого скриншота */}
            <div className="flex justify-center gap-4 sm:gap-6 mb-10 w-full max-w-md">
               {[
                 { color: 'bg-blue-600', icon: 'VK' },
                 { color: 'bg-orange-500', icon: 'OK' },
                 { color: 'bg-sky-500', icon: 'TG' }
               ].map((card, i) => (
                 <div key={i} className="flex-1 bg-white rounded-2xl p-3 shadow-lg transform hover:-translate-y-2 transition-transform opacity-90">
                    <div className={`w-6 h-6 ${card.color} rounded flex items-center justify-center text-[10px] font-bold text-white mb-4`}>
                      {card.icon}
                    </div>
                    <div className="w-full aspect-video bg-gray-200 rounded-lg flex items-center justify-center relative overflow-hidden mb-2">
                       <div className="w-8 h-8 rounded-full bg-gray-300 absolute left-2 top-2" />
                       <svg className="w-full h-full text-gray-300" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                    </div>
                    <div className="w-10 h-2 bg-blue-500 rounded-full" />
                 </div>
               ))}
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">Водяные знаки</h1>
            <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
              Создайте новый водяной знак, который выделит вас и защитит ваш авторский контент в соцсетях.
            </p>
            
            <button 
              onClick={() => setIsAccountModalOpen(true)}
              className="bg-[#5C9E42] hover:bg-[#4d8636] text-white px-10 py-3.5 rounded-lg font-bold transition-all shadow-lg active:scale-95"
            >
              Создать
            </button>
          </div>
        ) : (
          // СПИСОК: Если уже есть настроенные знаки
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Водяные знаки</h1>
              <button 
                onClick={() => setIsAccountModalOpen(true)}
                className="bg-[#5C9E42] hover:bg-[#4d8636] text-white px-5 py-2.5 rounded-lg font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-sm w-full sm:w-auto"
              >
                <Plus size={18} /> Добавить
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {configuredAccounts.map(acc => (
                <div key={acc.id} className="bg-[#111318] border border-gray-800 p-5 rounded-2xl flex flex-col gap-4 hover:border-gray-700 transition-all shadow-sm">
                  <div className="flex items-center gap-3">
                    <img src={acc.avatarUrl} className="w-10 h-10 rounded-full border border-gray-700 object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-sm truncate">{acc.name}</h3>
                      <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Знак настроен</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSelectAccount(acc)} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-colors">Изменить</button>
                    <button onClick={async () => {
                      if (window.confirm('Удалить водяной знак?')) {
                        await saveAccountDesign(acc.id, undefined, null);
                        fetchAccounts(user.id);
                      }
                    }} className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-colors"><Trash2 size={16}/></button>
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
            <div className="relative w-full max-w-md bg-[#111318] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                <h3 className="text-base font-bold text-white">Выберите аккаунт</h3>
                <button onClick={() => setIsAccountModalOpen(false)} className="text-gray-500 hover:text-white transition-colors"><X size={20}/></button>
              </div>
              <div className="p-3 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-1">
                {accounts.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-6">Сначала подключите соцсети</p>
                ) : (
                  accounts.map(acc => (
                    <button 
                      key={acc.id} 
                      onClick={() => handleSelectAccount(acc)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition-all text-left"
                    >
                      <img src={acc.avatarUrl} className="w-10 h-10 rounded-full border border-gray-800 object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{acc.name}</div>
                        <div className="text-[10px] text-gray-500 uppercase font-black">{acc.provider}</div>
                      </div>
                      {acc.watermark && <CheckCircle2 className="text-emerald-500" size={16} />}
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
    <div className="max-w-5xl mx-auto px-4 py-6 animate-in slide-in-from-bottom-4 duration-500">
      
      {/* НАВИГАЦИЯ */}
      <div className="flex items-center justify-between mb-6 text-sm">
        <button onClick={() => setView('landing')} className="flex items-center gap-1 text-[#2AABEE] hover:text-[#2188bd] font-medium transition-colors">
          <ChevronLeft size={18}/> К списку водяных знаков
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        
        {/* ВЕРХНЯЯ ПАНЕЛЬ ИНСТРУМЕНТОВ */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
           <div className="flex gap-2">
              <button 
                onClick={() => updateSettings({ type: 'text' })}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${settings.type === 'text' ? 'bg-[#21bca5] text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                <Edit3 size={18} />
              </button>
              <button 
                onClick={() => updateSettings({ type: 'image' })}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${settings.type === 'image' ? 'bg-[#21bca5] text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                <ImageIcon size={18} />
              </button>
           </div>
           
           <div className="flex gap-2">
              <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="w-10 h-10 bg-[#21bca5] hover:bg-[#1da28e] text-white rounded-lg flex items-center justify-center transition-colors shadow-sm disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
              </button>
              <button onClick={() => setView('landing')} className="w-10 h-10 bg-[#e72e4b] hover:bg-[#d02842] text-white rounded-lg flex items-center justify-center transition-colors shadow-sm">
                <X size={18}/>
              </button>
           </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          
          {/* ОБЛАСТЬ ПРЕДПРОСМОТРА С СЕТКОЙ */}
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 mb-4 group select-none">
             
             {/* Фоновое изображение со слайдером */}
             <div 
               className="absolute inset-0 bg-cover bg-center transition-all duration-300"
               style={{ 
                 backgroundImage: `url('${SAMPLE_IMAGES[imgIdx]}')`,
                 filter: previewFilter === 'dark' ? 'brightness(0.6)' : 'brightness(1.1)' 
               }}
             />

             {/* Стрелки переключения картинок */}
             <button onClick={() => setImgIdx((p) => (p === 0 ? SAMPLE_IMAGES.length - 1 : p - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-40"><ChevronLeft size={20}/></button>
             <button onClick={() => setImgIdx((p) => (p === SAMPLE_IMAGES.length - 1 ? 0 : p + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-40"><ChevronRight size={20}/></button>

             {/* Интерактивная Сетка 3x3 */}
             <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 z-20">
               {['tl', 'tc', 'tr', 'cl', 'cc', 'cr', 'bl', 'bc', 'br'].map(pos => (
                 <div 
                   key={pos} 
                   onClick={() => updateSettings({ position: pos })}
                   className="border-[0.5px] border-white/30 hover:bg-white/10 cursor-pointer transition-colors"
                 />
               ))}
             </div>

             {/* Сам водяной знак */}
             <div style={getWatermarkStyle()}>
               {settings.type === 'image' && settings.image ? (
                 <img src={settings.image} className="max-h-16 object-contain" alt="Watermark" />
               ) : (
                 settings.text || 'SMMBOX'
               )}
             </div>
          </div>

          {/* ТУМБЛЕР ФОНА (Под картинкой) */}
          <div className="flex gap-6 mb-8 text-sm font-medium text-gray-500">
             <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="bgFilter" checked={previewFilter === 'dark'} onChange={() => setPreviewFilter('dark')} className="w-4 h-4 accent-[#21bca5]" />
                <span className={previewFilter === 'dark' ? 'text-gray-800' : ''}>темный фон</span>
             </label>
             <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="bgFilter" checked={previewFilter === 'light'} onChange={() => setPreviewFilter('light')} className="w-4 h-4 accent-[#21bca5]" />
                <span className={previewFilter === 'light' ? 'text-gray-800' : ''}>светлый фон</span>
             </label>
          </div>

          {/* НАСТРОЙКИ */}
          <div className="space-y-6 max-w-3xl">
            
            {settings.type === 'text' ? (
              <>
                {/* Текстовое поле */}
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#21bca5]"><Type size={18}/></div>
                  <input 
                    type="text" 
                    value={settings.text}
                    onChange={e => updateSettings({ text: e.target.value })}
                    className="w-full border border-gray-300 focus:border-[#21bca5] rounded-lg py-3 pl-12 pr-4 text-gray-800 outline-none transition-colors"
                    placeholder="Введите текст..."
                  />
                </div>

                {/* Инструменты текста */}
                <div className="flex flex-wrap items-center gap-4">
                   <div className="flex items-center gap-3">
                     {/* Цвет текста */}
                     <div className="relative w-10 h-10 border border-gray-300 rounded-md overflow-hidden flex items-center justify-center">
                        <input type="color" value={settings.textColor} onChange={e => updateSettings({ textColor: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="w-5 h-5 border border-gray-200 shadow-sm" style={{ backgroundColor: settings.textColor }} />
                     </div>
                     
                     {/* Цвет фона + Галочка включения */}
                     <div className="flex items-center gap-2 border border-gray-300 rounded-md p-1 pr-2 h-10">
                        <div className="relative w-7 h-7 overflow-hidden flex items-center justify-center">
                          <input type="color" value={settings.bgColor} onChange={e => updateSettings({ bgColor: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                          <div className="w-4 h-4 border border-gray-200" style={{ backgroundColor: settings.bgColor }} />
                        </div>
                        <input type="checkbox" checked={settings.hasBackground} onChange={e => updateSettings({ hasBackground: e.target.checked })} className="w-4 h-4 accent-[#21bca5] cursor-pointer" title="Включить фон" />
                     </div>
                   </div>

                   {/* Шрифт */}
                   <select 
                     value={settings.fontFamily} 
                     onChange={e => updateSettings({ fontFamily: e.target.value })}
                     className="h-10 border border-gray-300 rounded-md px-3 text-gray-700 outline-none focus:border-[#21bca5] cursor-pointer bg-white"
                   >
                     {FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                   </select>

                   {/* Обводка текста */}
                   <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                     <input type="checkbox" checked={settings.hasStroke} onChange={e => updateSettings({ hasStroke: e.target.checked })} className="w-4 h-4 accent-[#21bca5]" />
                     Обводка текста
                   </label>
                </div>
              </>
            ) : (
              /* Загрузка картинки */
              <div 
                onClick={() => fileInputRef.current.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input type="file" ref={fileInputRef} hidden accept="image/png, image/jpeg, image/svg+xml" onChange={handleImageUpload} />
                <div className="text-[#21bca5] flex justify-center mb-2"><Upload size={24}/></div>
                <p className="text-gray-500 text-sm">Нажмите для загрузки файла (PNG, JPG)</p>
              </div>
            )}

            {/* ПОЛЗУНКИ */}
            <div className="space-y-8 pt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  Прозрачность <span className="text-[#21bca5]">{settings.opacity}%</span>
                </div>
                <input type="range" min="10" max="100" value={settings.opacity} onChange={e => updateSettings({ opacity: Number(e.target.value) })} className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#21bca5]" />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  Отступ <span className="text-[#21bca5]">{settings.margin}%</span>
                </div>
                <input type="range" min="0" max="25" value={settings.margin} onChange={e => updateSettings({ margin: Number(e.target.value) })} className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#21bca5]" />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}