import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { 
  Save, Image as ImageIcon, Type, Palette, LayoutTemplate, Loader2, Check,
  Type as TypeIcon, Sliders, Upload, RotateCw, Move, Eye, Edit3, X, Plus,
  ArrowUpLeft, ArrowUp, ArrowUpRight, ArrowLeft, Crosshair, ArrowRight, 
  ArrowDownLeft, ArrowDown, ArrowDownRight, Trash2, Info, CheckCircle2
} from 'lucide-react';

const defaultWatermark = {
  type: 'text', 
  text: 'SMMBOX', 
  position: 'br', 
  hasBackground: true,
  textColor: '#FFFFFF', 
  bgColor: '#000000', 
  size: 100, 
  opacity: 90, 
  angle: 0, 
  x: 90, 
  y: 85
};

const posToCoords = {
  'tl': {x: 10, y: 15}, 'tc': {x: 50, y: 15}, 'tr': {x: 90, y: 15},
  'cl': {x: 10, y: 50}, 'cc': {x: 50, y: 50}, 'cr': {x: 90, y: 50},
  'bl': {x: 10, y: 85}, 'bc': {x: 50, y: 85}, 'br': {x: 90, y: 85}
};

const presetColors = ['#FFFFFF', '#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
const SAMPLE_IMG = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop";

export default function WatermarkConstructor() {
  const user = useStore((state) => state.user);
  const accounts = useStore((state) => state.accounts) || [];
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  const saveAccountDesign = useStore((state) => state.saveAccountDesign);

  // Режимы отображения: 'landing' (список/заглушка), 'editor'
  const [view, setView] = useState('landing'); 
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  
  const [settings, setSettings] = useState(defaultWatermark);
  const [isPreviewDark, setIsPreviewDark] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [watermarkTab, setWatermarkTab] = useState('simple'); 
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    if (user?.id) fetchAccounts(user.id);
  }, [user, fetchAccounts]);

  const configuredAccounts = accounts.filter(acc => acc.watermark);

  // --- ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ЭКРАНОВ ---
  
  const handleStartCreate = () => {
    setIsAccountModalOpen(true);
  };

  const handleSelectAccount = (acc) => {
    setSelectedAccount(acc);
    setSettings(acc.watermark ? { ...acc.watermark } : { ...defaultWatermark });
    setIsAccountModalOpen(false);
    setView('editor');
  };

  const handleBack = () => {
    setView('landing');
    setSelectedAccount(null);
  };

  const handleSave = async () => {
    if (!selectedAccount) return;
    setIsSaving(true);
    // Сохраняем индивидуально для аккаунта (signature оставляем текущую)
    const result = await saveAccountDesign(selectedAccount.id, selectedAccount.signature, settings);
    setIsSaving(false);
    if (result.success) {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setView('landing');
      }, 1500);
      fetchAccounts(user.id);
    }
  };

  const handleDeleteWatermark = async (accId) => {
    if (window.confirm('Удалить водяной знак для этого аккаунта?')) {
      await saveAccountDesign(accId, undefined, null);
      fetchAccounts(user.id);
    }
  };

  // --- ЛОГИКА РЕДАКТОРА ---

  const updateSettings = (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => updateSettings({ image: event.target.result, type: 'image' });
      reader.readAsDataURL(file);
    }
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = previewRef.current.getBoundingClientRect();
    const startX = e.clientX || e.touches?.[0]?.clientX;
    const startY = e.clientY || e.touches?.[0]?.clientY;
    const initialX = settings.x ?? 50;
    const initialY = settings.y ?? 50;

    const onMove = (moveEvent) => {
      const currentX = moveEvent.clientX || moveEvent.touches?.[0]?.clientX;
      const currentY = moveEvent.clientY || moveEvent.touches?.[0]?.clientY;
      const dx = ((currentX - startX) / rect.width) * 100;
      const dy = ((currentY - startY) / rect.height) * 100;
      updateSettings({ 
        x: Math.max(0, Math.min(100, initialX + dx)), 
        y: Math.max(0, Math.min(100, initialY + dy)),
        position: 'custom'
      });
    };

    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

  const PositionGrid = () => (
    <div className="grid grid-cols-3 gap-2 bg-gray-900/80 p-3 rounded-2xl border border-gray-800">
      {Object.keys(posToCoords).map(pos => (
        <button
          key={pos}
          onClick={() => updateSettings({ position: pos, x: posToCoords[pos].x, y: posToCoords[pos].y })}
          className={`aspect-square rounded-xl flex items-center justify-center transition-all ${settings.position === pos ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'}`}
        >
          <div className="w-2 h-2 rounded-full bg-current" />
        </button>
      ))}
    </div>
  );

  // --- РЕНДЕР: ПУСТОЙ ЭКРАН / СПИСОК ---
  if (view === 'landing') {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-4 py-12 bg-admin-card border border-gray-800 rounded-[2rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
          
          <div className="flex justify-center gap-4 opacity-50 mb-6 scale-90 sm:scale-100">
             <div className="w-24 h-32 bg-gray-800 rounded-xl border border-gray-700 flex flex-col p-2">
                <div className="w-6 h-6 bg-blue-500 rounded-lg mb-2" />
                <div className="flex-1 bg-gray-700 rounded-lg relative overflow-hidden">
                   <div className="absolute bottom-2 left-2 w-8 h-2 bg-blue-400 rounded-full" />
                </div>
             </div>
             <div className="w-24 h-32 bg-gray-800 rounded-xl border border-gray-700 flex flex-col p-2">
                <div className="w-6 h-6 bg-orange-500 rounded-lg mb-2" />
                <div className="flex-1 bg-gray-700 rounded-lg relative overflow-hidden">
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-1 bg-orange-400 rounded-full" />
                </div>
             </div>
             <div className="w-24 h-32 bg-gray-800 rounded-xl border border-gray-700 flex flex-col p-2">
                <div className="w-6 h-6 bg-sky-500 rounded-lg mb-2" />
                <div className="flex-1 bg-gray-700 rounded-lg relative overflow-hidden">
                   <div className="absolute top-4 right-2 w-4 h-4 bg-sky-400 rounded-md" />
                </div>
             </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white">Водяные знаки</h1>
          <p className="text-gray-400 max-w-md mx-auto px-6">Создайте новый водяной знак, который выделит ваш контент и защитит авторство.</p>
          
          <button 
            onClick={handleStartCreate}
            className="mt-8 bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            Создать
          </button>
        </div>

        {configuredAccounts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {configuredAccounts.map(acc => (
              <div key={acc.id} className="bg-admin-card border border-gray-800 p-5 rounded-3xl flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={acc.avatarUrl} className="w-12 h-12 rounded-full border border-gray-700" alt="" />
                    <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-1 border-2 border-gray-900">
                      <Check size={8} className="text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white font-bold">{acc.name}</h3>
                    <span className="text-xs text-emerald-500">Знак настроен</span>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleSelectAccount(acc)} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl"><Edit3 size={18}/></button>
                  <button onClick={() => handleDeleteWatermark(acc.id)} className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl"><Trash2 size={18}/></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* МОДАЛКА ВЫБОРА АККАУНТА */}
        {isAccountModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAccountModalOpen(false)} />
            <div className="relative w-full max-w-md bg-[#111318] border border-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Выберите аккаунт</h3>
                <button onClick={() => setIsAccountModalOpen(false)} className="text-gray-500"><X size={20}/></button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {accounts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Сначала подключите соцсети</div>
                ) : (
                  <div className="space-y-2">
                    {accounts.map(acc => (
                      <button 
                        key={acc.id} 
                        onClick={() => handleSelectAccount(acc)}
                        className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors border border-transparent hover:border-gray-800"
                      >
                        <img src={acc.avatarUrl} className="w-10 h-10 rounded-full" alt="" />
                        <div className="text-left">
                          <div className="text-sm font-bold text-white">{acc.name}</div>
                          <div className="text-[10px] text-gray-500 uppercase">{acc.provider}</div>
                        </div>
                        {acc.watermark && <Check className="ml-auto text-emerald-500" size={16} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- РЕНДЕР: РЕДАКТОР ---
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* HEADER РЕДАКТОРА */}
      <div className="flex items-center justify-between bg-admin-card border border-gray-800 p-4 rounded-3xl">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="p-2 hover:bg-gray-800 rounded-xl text-gray-400"><X size={24}/></button>
          <div className="h-10 w-px bg-gray-800" />
          <div className="flex items-center gap-3">
             <img src={selectedAccount?.avatarUrl} className="w-10 h-10 rounded-full border border-gray-700" alt="" />
             <div>
               <h2 className="text-white font-bold leading-tight">{selectedAccount?.name}</h2>
               <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Настройка знака</span>
             </div>
          </div>
        </div>
        <div className="flex gap-3">
           <button 
            onClick={handleSave} 
            disabled={isSaving}
            className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all ${saveSuccess ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'}`}
           >
             {isSaving ? <Loader2 className="animate-spin" size={20}/> : saveSuccess ? <CheckCircle2 size={20}/> : <Save size={20}/>}
             <span>{saveSuccess ? 'Готово' : 'Сохранить'}</span>
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ЛЕВАЯ ПАНЕЛЬ: ХОЛСТ */}
        <div className="lg:col-span-7 space-y-4">
          <div className={`relative aspect-video rounded-[2.5rem] overflow-hidden border-4 ${isPreviewDark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'} shadow-2xl transition-colors duration-500`}>
             
             {/* Сетка направляющих (SMMBox Style) */}
             <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-0 opacity-20">
                <div className="border-r border-b border-gray-500" />
                <div className="border-r border-b border-gray-500" />
                <div className="border-b border-gray-500" />
                <div className="border-r border-b border-gray-500" />
                <div className="border-r border-b border-gray-500" />
                <div className="border-b border-gray-500" />
                <div className="border-r border-gray-500" />
                <div className="border-r border-gray-500" />
                <div />
             </div>

             <div 
               ref={previewRef}
               className="absolute inset-0 bg-cover bg-center"
               style={{ backgroundImage: `url('${SAMPLE_IMG}')`, filter: isPreviewDark ? 'brightness(0.6)' : 'none' }}
             />

             {/* САМ ВОДЯНОЙ ЗНАК */}
             <div 
               onPointerDown={handlePointerDown}
               className={`absolute px-4 py-2 flex items-center justify-center whitespace-nowrap cursor-move select-none ${isDragging ? 'scale-110 shadow-2xl z-50' : 'transition-all duration-300'}`}
               style={{
                 left: `${settings.x}%`, 
                 top: `${settings.y}%`,
                 transform: `translate(-50%, -50%) scale(${settings.size / 100}) rotate(${settings.angle}deg)`,
                 opacity: settings.opacity / 100,
                 backgroundColor: (settings.type === 'text' && settings.hasBackground) ? settings.bgColor : 'transparent',
                 color: settings.textColor,
                 borderRadius: '12px',
                 fontSize: '18px',
                 fontWeight: '900',
                 fontFamily: 'system-ui',
                 boxShadow: (settings.type === 'text' && settings.hasBackground) ? '0 10px 25px rgba(0,0,0,0.3)' : 'none'
               }}
             >
               {settings.type === 'image' && settings.image ? (
                 <img src={settings.image} className="max-h-16 object-contain pointer-events-none" alt="" />
               ) : (
                 <span className="italic uppercase tracking-tighter">{settings.text || 'SMMBOX'}</span>
               )}
             </div>
          </div>

          <div className="flex justify-center gap-8 bg-admin-card border border-gray-800 p-4 rounded-3xl">
             <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => setIsPreviewDark(true)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isPreviewDark ? 'border-blue-500 bg-blue-500' : 'border-gray-600'}`}>
                  {isPreviewDark && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <span className={`text-sm font-bold ${isPreviewDark ? 'text-white' : 'text-gray-500'}`}>Темный фон</span>
             </label>
             <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => setIsPreviewDark(false)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${!isPreviewDark ? 'border-blue-500 bg-blue-500' : 'border-gray-600'}`}>
                  {!isPreviewDark && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <span className={`text-sm font-bold ${!isPreviewDark ? 'text-white' : 'text-gray-500'}`}>Светлый фон</span>
             </label>
          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ: НАСТРОЙКИ */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-admin-card border border-gray-800 rounded-[2.5rem] overflow-hidden flex flex-col shadow-xl">
             <div className="flex border-b border-gray-800">
                <button 
                  onClick={() => updateSettings({ type: 'text' })}
                  className={`flex-1 py-5 text-sm font-black uppercase tracking-widest transition-all ${settings.type === 'text' ? 'text-white bg-blue-600' : 'text-gray-500 hover:text-gray-300 bg-gray-900/50'}`}
                >
                  <div className="flex items-center justify-center gap-2"><Type size={18}/> Текст</div>
                </button>
                <button 
                  onClick={() => updateSettings({ type: 'image' })}
                  className={`flex-1 py-5 text-sm font-black uppercase tracking-widest transition-all ${settings.type === 'image' ? 'text-white bg-blue-600' : 'text-gray-500 hover:text-gray-300 bg-gray-900/50'}`}
                >
                  <div className="flex items-center justify-center gap-2"><ImageIcon size={18}/> Логотип</div>
                </button>
             </div>

             <div className="p-8 space-y-8">
                {settings.type === 'text' ? (
                  <div className="space-y-6">
                    <div className="relative">
                      <input 
                        type="text" 
                        value={settings.text}
                        onChange={e => updateSettings({ text: e.target.value })}
                        className="w-full bg-gray-950 border-2 border-gray-800 focus:border-blue-500 rounded-2xl p-5 text-white font-bold outline-none transition-all placeholder:text-gray-700"
                        placeholder="Введите текст..."
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-700"><TypeIcon size={20}/></div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Цвет текста</label>
                          <div className="flex items-center gap-3 bg-gray-950 p-2 rounded-xl border border-gray-800">
                             <input type="color" value={settings.textColor} onChange={e => updateSettings({ textColor: e.target.value })} className="w-8 h-8 rounded-lg bg-transparent cursor-pointer" />
                             <span className="text-xs font-mono text-gray-400 uppercase">{settings.textColor}</span>
                          </div>
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Фон плашки</label>
                          <div className="flex items-center gap-3 bg-gray-950 p-2 rounded-xl border border-gray-800">
                             <input type="color" value={settings.bgColor} onChange={e => updateSettings({ bgColor: e.target.value })} className="w-8 h-8 rounded-lg bg-transparent cursor-pointer" />
                             <input type="checkbox" checked={settings.hasBackground} onChange={e => updateSettings({ hasBackground: e.target.checked })} className="w-5 h-5 accent-blue-500" />
                          </div>
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div 
                      onClick={() => fileInputRef.current.click()}
                      className="border-4 border-dashed border-gray-800 rounded-[2rem] p-8 text-center hover:bg-white/5 transition-all cursor-pointer group"
                    >
                      <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                      {settings.image ? (
                        <img src={settings.image} className="h-24 mx-auto object-contain" alt="" />
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                           <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Upload size={32}/></div>
                           <span className="text-sm font-bold text-gray-400">Нажмите для загрузки логотипа</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-6 pt-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Прозрачность</label>
                    <span className="text-sm font-bold text-blue-500">{settings.opacity}%</span>
                  </div>
                  <input type="range" min="10" max="100" value={settings.opacity} onChange={e => updateSettings({ opacity: Number(e.target.value) })} className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                  
                  <div className="flex justify-between items-center pt-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Масштаб / Отступ</label>
                    <span className="text-sm font-bold text-blue-500">{settings.size}%</span>
                  </div>
                  <input type="range" min="50" max="200" value={settings.size} onChange={e => updateSettings({ size: Number(e.target.value) })} className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Положение</label>
                  <PositionGrid />
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}