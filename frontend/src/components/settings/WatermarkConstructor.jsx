import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { 
  Save, Image as ImageIcon, Type, Palette, LayoutTemplate, Loader2, Check,
  Type as TypeIcon, Sliders, Upload, RotateCw, Move, Eye, Edit3, X, Plus,
  ArrowUpLeft, ArrowUp, ArrowUpRight, ArrowLeft, Crosshair, ArrowRight, 
  ArrowDownLeft, ArrowDown, ArrowDownRight, Trash2, Info, CheckCircle2,
  ChevronLeft
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

const SAMPLE_IMG = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop";

export default function WatermarkConstructor() {
  const user = useStore((state) => state.user);
  const accounts = useStore((state) => state.accounts) || [];
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  const saveAccountDesign = useStore((state) => state.saveAccountDesign);

  const [view, setView] = useState('landing'); 
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [settings, setSettings] = useState(defaultWatermark);
  
  const [isPreviewDark, setIsPreviewDark] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    if (user?.id) fetchAccounts(user.id);
  }, [user?.id, fetchAccounts]);

  const configuredAccounts = accounts.filter(acc => acc.watermark);

  // --- УПРАВЛЕНИЕ СОСТОЯНИЕМ ---

  const handleSelectAccount = (acc) => {
    setSelectedAccount(acc);
    setSettings(acc.watermark ? { ...acc.watermark } : { ...defaultWatermark });
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
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  // --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

  const PositionGrid = () => (
    <div className="grid grid-cols-3 gap-2 bg-gray-950/50 p-3 rounded-2xl border border-gray-800">
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

  // --- ЭКРАН 1: СПИСОК / ПРИВЕТСТВИЕ ---
  if (view === 'landing') {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-8 animate-in fade-in duration-500">
        <div className="bg-admin-card border border-gray-800 rounded-[2.5rem] p-8 sm:p-16 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30" />
          
          <div className="flex justify-center gap-4 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-16 h-20 sm:w-20 sm:h-28 bg-gray-800/50 border border-gray-700 rounded-xl relative overflow-hidden opacity-40">
                <div className="absolute bottom-2 left-2 w-2/3 h-1 sm:h-2 bg-gray-600 rounded-full" />
              </div>
            ))}
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight">Водяные знаки</h1>
          <p className="text-gray-400 text-sm sm:text-lg max-w-lg mx-auto mb-10 leading-relaxed">
            Создайте индивидуальный водяной знак для каждого вашего аккаунта, чтобы защитить свой контент и повысить узнаваемость бренда.
          </p>
          
          <button 
            onClick={() => setIsAccountModalOpen(true)}
            className="group relative bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <span className="relative z-10 flex items-center gap-2">
              <Plus size={20} className="group-hover:rotate-90 transition-transform" /> Создать знак
            </span>
          </button>
        </div>

        {configuredAccounts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] px-2">Уже настроены</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {configuredAccounts.map(acc => (
                <div key={acc.id} className="bg-admin-card border border-gray-800 p-4 rounded-[2rem] flex items-center justify-between hover:border-gray-700 transition-all group shadow-sm">
                  <div className="flex items-center gap-4">
                    <img src={acc.avatarUrl} className="w-12 h-12 rounded-full border border-gray-700" alt="" />
                    <div>
                      <h3 className="text-white font-bold">{acc.name}</h3>
                      <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Активен</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleSelectAccount(acc)}
                    className="p-3 bg-gray-800 hover:bg-blue-600 text-gray-300 hover:text-white rounded-xl transition-all"
                  >
                    <Edit3 size={18}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* МОДАЛЬНОЕ ОКНО ВЫБОРА */}
        {isAccountModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsAccountModalOpen(false)} />
            <div className="relative w-full max-w-md bg-[#0d0f13] border border-gray-800 rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Выберите аккаунт</h3>
                <button onClick={() => setIsAccountModalOpen(false)} className="p-2 text-gray-500 hover:text-white transition-colors"><X size={24}/></button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-2">
                {accounts.map(acc => (
                  <button 
                    key={acc.id} 
                    onClick={() => handleSelectAccount(acc)}
                    className="w-full flex items-center gap-4 p-4 rounded-3xl hover:bg-white/5 transition-all border border-transparent hover:border-gray-800 text-left"
                  >
                    <img src={acc.avatarUrl} className="w-12 h-12 rounded-full border border-gray-800" alt="" />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-white">{acc.name}</div>
                      <div className="text-[10px] text-gray-500 uppercase font-black">{acc.provider}</div>
                    </div>
                    {acc.watermark && <CheckCircle2 className="text-emerald-500" size={18} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- ЭКРАН 2: РЕДАКТОР (SMMBOX STYLE) ---
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 animate-in slide-in-from-bottom-6 duration-500">
      
      {/* ПАНЕЛЬ УПРАВЛЕНИЯ (STICKY ON MOBILE) */}
      <div className="sticky top-4 z-[50] flex items-center justify-between bg-[#0d0f13]/80 backdrop-blur-xl border border-gray-800 p-4 rounded-[2rem] mb-8 shadow-2xl">
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => setView('landing')} className="p-2 sm:p-3 hover:bg-gray-800 rounded-2xl text-gray-400 transition-colors">
            <ChevronLeft size={24}/>
          </button>
          <div className="flex items-center gap-3">
             <img src={selectedAccount?.avatarUrl} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-gray-700" alt="" />
             <div className="hidden sm:block">
               <h2 className="text-white font-bold text-sm leading-tight">{selectedAccount?.name}</h2>
               <span className="text-[9px] text-blue-500 font-black uppercase tracking-widest">Редактирование</span>
             </div>
          </div>
        </div>
        
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className={`px-6 sm:px-10 py-3 sm:py-4 rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95 ${saveSuccess ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20'} text-white text-sm sm:text-base`}
        >
          {isSaving ? <Loader2 className="animate-spin" size={20}/> : saveSuccess ? <Check size={20}/> : <Save size={20}/>}
          <span>{saveSuccess ? 'Сохранено' : 'Готово'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ЛЕВАЯ КОЛОНКА: ХОЛСТ ПРЕДПРОСМОТРА */}
        <div className="lg:col-span-7 space-y-6">
          <div className={`relative aspect-video rounded-[3rem] overflow-hidden border-4 transition-all duration-700 shadow-2xl ${isPreviewDark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
             
             {/* СЕТКА НАПРАВЛЯЮЩИХ */}
             <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-10 opacity-10">
                {[...Array(9)].map((_, i) => <div key={i} className="border-[0.5px] border-gray-400" />)}
             </div>

             <div 
               ref={previewRef}
               className="absolute inset-0 bg-cover bg-center transition-all duration-500"
               style={{ backgroundImage: `url('${SAMPLE_IMG}')`, filter: isPreviewDark ? 'brightness(0.5) contrast(1.1)' : 'none' }}
             />

             {/* ИНТЕРАКТИВНЫЙ ВОДЯНОЙ ЗНАК */}
             <div 
               onPointerDown={handlePointerDown}
               className={`absolute px-4 py-2 flex items-center justify-center whitespace-nowrap cursor-move select-none touch-none ${isDragging ? 'scale-110 z-50' : 'transition-all duration-300'}`}
               style={{
                 left: `${settings.x}%`, 
                 top: `${settings.y}%`,
                 transform: `translate(-50%, -50%) scale(${settings.size / 100}) rotate(${settings.angle}deg)`,
                 opacity: settings.opacity / 100,
                 backgroundColor: (settings.type === 'text' && settings.hasBackground) ? settings.bgColor : 'transparent',
                 color: settings.textColor,
                 borderRadius: '12px',
                 fontSize: '1.2rem',
                 fontWeight: '900',
                 boxShadow: (settings.type === 'text' && settings.hasBackground) ? '0 10px 30px rgba(0,0,0,0.4)' : 'none'
               }}
             >
               {settings.type === 'image' && settings.image ? (
                 <img src={settings.image} className="max-h-16 object-contain pointer-events-none" alt="" />
               ) : (
                 <span className="italic uppercase tracking-tighter drop-shadow-md">{settings.text || 'SMMBOX'}</span>
               )}
             </div>
          </div>

          {/* ТУМБЛЕР ФОНА */}
          <div className="flex bg-admin-card border border-gray-800 p-2 rounded-3xl w-fit mx-auto shadow-lg">
             <button 
               onClick={() => setIsPreviewDark(true)}
               className={`px-6 py-2 rounded-2xl text-xs font-bold transition-all ${isPreviewDark ? 'bg-gray-800 text-white' : 'text-gray-500'}`}
             >
               Темный фон
             </button>
             <button 
               onClick={() => setIsPreviewDark(false)}
               className={`px-6 py-2 rounded-2xl text-xs font-bold transition-all ${!isPreviewDark ? 'bg-white text-black' : 'text-gray-500'}`}
             >
               Светлый фон
             </button>
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА: ИНСТРУМЕНТЫ */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-admin-card border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
             
             {/* ТАБЫ ТИПА */}
             <div className="flex p-2 bg-gray-900/50">
                <button 
                  onClick={() => updateSettings({ type: 'text' })}
                  className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all ${settings.type === 'text' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:bg-white/5'}`}
                >
                  <div className="flex items-center justify-center gap-2"><Type size={16}/> Текст</div>
                </button>
                <button 
                  onClick={() => updateSettings({ type: 'image' })}
                  className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all ${settings.type === 'image' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:bg-white/5'}`}
                >
                  <div className="flex items-center justify-center gap-2"><ImageIcon size={16}/> Логотип</div>
                </button>
             </div>

             <div className="p-6 sm:p-8 space-y-8">
                {settings.type === 'text' ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Содержание</label>
                      <input 
                        type="text" 
                        value={settings.text}
                        onChange={e => updateSettings({ text: e.target.value })}
                        className="w-full bg-gray-950 border-2 border-gray-800 focus:border-blue-500 rounded-2xl p-5 text-white font-bold outline-none transition-all"
                        placeholder="Название проекта..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Цвет текста</label>
                          <div className="flex items-center gap-3 bg-gray-950 p-2 rounded-2xl border border-gray-800">
                             <input type="color" value={settings.textColor} onChange={e => updateSettings({ textColor: e.target.value })} className="w-10 h-10 rounded-xl bg-transparent cursor-pointer border-0" />
                             <span className="text-[10px] font-mono text-gray-400 uppercase">{settings.textColor}</span>
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Фон</label>
                          <div className="flex items-center justify-between bg-gray-950 p-2 rounded-2xl border border-gray-800">
                             <input type="color" value={settings.bgColor} onChange={e => updateSettings({ bgColor: e.target.value })} className="w-10 h-10 rounded-xl bg-transparent cursor-pointer border-0" />
                             <input type="checkbox" checked={settings.hasBackground} onChange={e => updateSettings({ hasBackground: e.target.checked })} className="w-6 h-6 rounded-lg accent-blue-600 cursor-pointer" />
                          </div>
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Изображение</label>
                    <div 
                      onClick={() => fileInputRef.current.click()}
                      className="border-2 border-dashed border-gray-800 rounded-3xl p-10 text-center hover:bg-blue-600/5 hover:border-blue-500/50 transition-all cursor-pointer group"
                    >
                      <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                      {settings.image ? (
                        <div className="relative inline-block">
                          <img src={settings.image} className="h-20 object-contain rounded-lg" alt="" />
                          <div className="absolute -top-2 -right-2 bg-blue-600 p-1 rounded-full"><Edit3 size={12}/></div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                           <div className="w-14 h-14 bg-gray-800 text-gray-500 rounded-2xl flex items-center justify-center group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-all"><Upload size={24}/></div>
                           <span className="text-xs font-bold text-gray-500">Загрузить PNG / SVG</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* СЛАЙДЕРЫ */}
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between px-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Прозрачность</label>
                      <span className="text-xs font-bold text-blue-500">{settings.opacity}%</span>
                    </div>
                    <input type="range" min="10" max="100" value={settings.opacity} onChange={e => updateSettings({ opacity: Number(e.target.value) })} className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-600" />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between px-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Размер</label>
                      <span className="text-xs font-bold text-blue-500">{settings.size}%</span>
                    </div>
                    <input type="range" min="50" max="250" value={settings.size} onChange={e => updateSettings({ size: Number(e.target.value) })} className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-600" />
                  </div>
                </div>

                {/* ГРИД ПОЗИЦИЙ */}
                <div className="space-y-4 pt-4 border-t border-gray-800">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Привязка к углу</label>
                  <PositionGrid />
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}