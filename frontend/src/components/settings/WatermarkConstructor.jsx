import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { 
  Save, Image as ImageIcon, Type, Palette, LayoutTemplate, Loader2, Check,
  Type as TypeIcon, Sliders, Upload, RotateCw, Move, Eye, // <--- ВОТ ЗДЕСЬ ДОБАВИЛИ EYE
  ArrowUpLeft, ArrowUp, ArrowUpRight, ArrowLeft, Crosshair, ArrowRight, ArrowDownLeft, ArrowDown, ArrowDownRight
} from 'lucide-react';

const defaultWatermark = {
  type: 'text', text: 'SMMBOX', position: 'br', hasBackground: true,
  textColor: '#FFFFFF', bgColor: '#000000', size: 100, opacity: 90, angle: 0, x: 90, y: 85
};

const posToCoords = {
  'tl': {x: 10, y: 15}, 'tc': {x: 50, y: 15}, 'tr': {x: 90, y: 15},
  'cl': {x: 10, y: 50}, 'cc': {x: 50, y: 50}, 'cr': {x: 90, y: 50},
  'bl': {x: 10, y: 85}, 'bc': {x: 50, y: 85}, 'br': {x: 90, y: 85}
};

const presetColors = ['#FFFFFF', '#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export default function WatermarkConstructor() {
  const globalSettings = useStore((state) => state.globalSettings);
  const fetchGlobalSettings = useStore((state) => state.fetchGlobalSettings);
  const saveGlobalSettings = useStore((state) => state.saveGlobalSettings);

  const [signature, setSignature] = useState('');
  const [settings, setSettings] = useState(defaultWatermark);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [watermarkTab, setWatermarkTab] = useState('simple'); 
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

  // Загружаем настройки при старте
  useEffect(() => {
    fetchGlobalSettings();
  }, []);

  // Синхронизируем локальный стейт с глобальным
  useEffect(() => {
    if (globalSettings) {
      setSignature(globalSettings.signature || '');
      setSettings(globalSettings.watermark || defaultWatermark);
    }
  }, [globalSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await saveGlobalSettings(signature, settings);
    setIsSaving(false);
    if (result.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const updateSettings = (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
    setSaveSuccess(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => updateSettings({ image: event.target.result, type: 'image' });
      reader.readAsDataURL(file);
    }
  };

  const handleAngleChange = (e) => {
    let val = Number(e.target.value);
    const snapPoints = [-180, -90, 0, 90, 180];
    for (let snap of snapPoints) {
      if (Math.abs(val - snap) <= 6) { val = snap; break; }
    }
    updateSettings({ angle: val });
  };

  // DRAG AND DROP
  const handlePointerDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = previewRef.current.getBoundingClientRect();
    const startMouseX = e.clientX || e.touches?.[0]?.clientX;
    const startMouseY = e.clientY || e.touches?.[0]?.clientY;
    const startWX = settings.x ?? 50;
    const startWY = settings.y ?? 50;

    const handlePointerMove = (moveEvent) => {
      const clientX = moveEvent.clientX || moveEvent.touches?.[0]?.clientX;
      const clientY = moveEvent.clientY || moveEvent.touches?.[0]?.clientY;
      const percentDx = ((clientX - startMouseX) / rect.width) * 100;
      const percentDy = ((clientY - startMouseY) / rect.height) * 100;
      let newX = Math.max(0, Math.min(100, startWX + percentDx));
      let newY = Math.max(0, Math.min(100, startWY + percentDy));
      updateSettings({ x: newX, y: newY, position: 'custom' });
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
    updateSettings({ x, y, position: 'custom' });
  };

  const PositionGridButtons = () => {
    const positions = [
      { id: 'tl', icon: ArrowUpLeft }, { id: 'tc', icon: ArrowUp }, { id: 'tr', icon: ArrowUpRight },
      { id: 'cl', icon: ArrowLeft },   { id: 'cc', icon: Crosshair }, { id: 'cr', icon: ArrowRight },
      { id: 'bl', icon: ArrowDownLeft }, { id: 'bc', icon: ArrowDown }, { id: 'br', icon: ArrowDownRight }
    ];

    const handleGridClick = (posId) => {
      const coords = posToCoords[posId];
      updateSettings({ position: posId, x: coords.x, y: coords.y });
    };

    return (
      <div className="grid grid-cols-3 gap-2 bg-black/30 p-2.5 rounded-xl border border-gray-800">
        {positions.map(pos => {
          const Icon = pos.icon;
          const isActive = settings.position === pos.id;
          return (
            <button key={pos.id} onClick={() => handleGridClick(pos.id)} className={`h-11 rounded-lg flex items-center justify-center transition-all ${isActive ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] scale-95' : 'bg-gray-800/80 text-gray-500 hover:bg-gray-700 hover:text-gray-300 border border-gray-700/50'}`}>
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
            <input type="checkbox" checked={settings[checkboxKey] !== false} onChange={e => updateSettings({ [checkboxKey]: e.target.checked })} className="accent-blue-500 w-4 h-4 cursor-pointer" />
          )}
        </label>
        <div className={`space-y-2 transition-opacity duration-200 ${(hasCheckbox && settings[checkboxKey] === false) ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center gap-2 bg-black/40 border border-gray-700 rounded-xl p-1.5 pr-3 w-full">
            <input type="color" value={settings[colorKey] || '#FFFFFF'} onChange={e => updateSettings({ [colorKey]: e.target.value })} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0" />
            <span className="text-xs font-mono text-gray-300 uppercase flex-1">{settings[colorKey] || '#FFFFFF'}</span>
            <Palette size={14} className="text-gray-500 shrink-0"/>
          </div>
          <div className="flex gap-1.5 justify-between">
            {presetColors.map(c => (
              <button key={c} onClick={() => updateSettings({ [colorKey]: c })} className="w-5 h-5 rounded-full border border-gray-600 transition-transform hover:scale-110 shadow-sm" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* ЗАГОЛОВОК */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <LayoutTemplate className="text-blue-500" size={32} /> Общие настройки (Шаблон)
          </h1>
          <p className="text-gray-400 mt-2 text-sm max-w-xl">
            Эти настройки будут автоматически применяться ко всем вашим группам и каналам, где выбран режим <span className="text-gray-300 font-bold bg-gray-800 px-2 py-0.5 rounded-md">Шаблон</span>.
          </p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className={`shrink-0 px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl ${saveSuccess ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 disabled:opacity-50'}`}
        >
          {isSaving ? <Loader2 className="animate-spin" size={20} /> : saveSuccess ? <Check size={20} /> : <Save size={20} />}
          <span>{isSaving ? 'Сохранение...' : saveSuccess ? 'Сохранено' : 'Сохранить шаблон'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        
        {/* === ПАНЕЛЬ НАСТРОЕК (Левая колонка) === */}
        <div className="lg:col-span-6 xl:col-span-5 space-y-6">
          
          {/* ПОДПИСЬ */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl">
            <label className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Type size={18} className="text-blue-400" /> Общая подпись к постам
            </label>
            <textarea 
              value={signature}
              onChange={(e) => { setSignature(e.target.value); setSaveSuccess(false); }}
              placeholder="Например: Подписывайтесь на наш основной Telegram канал..."
              className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white h-24 resize-none focus:outline-none focus:border-blue-500 transition-colors custom-scrollbar"
            />
            <p className="text-xs text-gray-500 mt-2">Автоматически добавляется в конец каждого поста.</p>
          </div>

          {/* ВОДЯНОЙ ЗНАК */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-3xl shadow-xl overflow-hidden flex flex-col">
            <div className="p-5 sm:p-6 border-b border-gray-800 bg-gray-900/40">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon size={18} className="text-blue-400" /> Дизайн водяного знака
              </label>
            </div>

            <div className="flex border-b border-gray-800 bg-black/20">
              <button onClick={() => setWatermarkTab('simple')} className={`flex-1 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${watermarkTab === 'simple' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300'}`}><TypeIcon size={16}/> Базовая</button>
              <button onClick={() => setWatermarkTab('advanced')} className={`flex-1 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${watermarkTab === 'advanced' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300'}`}><Sliders size={16}/> Продвинутая</button>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              {watermarkTab === 'simple' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex p-1 bg-black/40 rounded-xl border border-gray-800">
                    <button onClick={() => updateSettings({ type: 'text' })} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${settings.type === 'text' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Текст</button>
                    <button onClick={() => updateSettings({ type: 'image' })} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${settings.type === 'image' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Свое лого</button>
                  </div>

                  {settings.type === 'text' ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase">Текст знака</label>
                        <input type="text" value={settings.text || ''} onChange={e => updateSettings({ text: e.target.value })} placeholder="SMMBOX" className="w-full bg-black/40 border border-gray-700 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500 outline-none transition-colors" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <ColorPicker label="Цвет текста" colorKey="textColor" />
                        <ColorPicker label="Фон плашки" colorKey="bgColor" hasCheckbox checkboxKey="hasBackground" />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-400 uppercase">Файл логотипа</label>
                      <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:bg-gray-900/50 transition-colors bg-black/20">
                        <input type="file" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} className="hidden" />
                        {settings.image ? (
                          <div className="flex flex-col items-center gap-3">
                            <img src={settings.image} alt="preview" className="h-16 object-contain" />
                            <button onClick={() => fileInputRef.current?.click()} className="text-blue-400 text-xs font-bold hover:underline">Заменить логотип</button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center"><Upload size={18} className="text-blue-400"/></div>
                            <span className="text-sm font-medium text-gray-300">Нажмите, чтобы загрузить</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2"><label className="text-xs font-semibold text-gray-400 uppercase">Сетка позиций</label><PositionGridButtons /></div>
                </div>
              )}

              {watermarkTab === 'advanced' && (
                <div className="space-y-7 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="space-y-3"><div className="flex justify-between items-center"><label className="text-xs font-semibold text-gray-400 uppercase">Прозрачность</label><span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{settings.opacity || 90}%</span></div><input type="range" min="10" max="100" value={settings.opacity || 90} onChange={e => updateSettings({ opacity: Number(e.target.value) })} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
                  <div className="space-y-3"><div className="flex justify-between items-center"><label className="text-xs font-semibold text-gray-400 uppercase">Масштаб</label><span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{settings.size || 100}%</span></div><input type="range" min="50" max="250" value={settings.size || 100} onChange={e => updateSettings({ size: Number(e.target.value) })} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
                  <div className="space-y-3"><div className="flex justify-between items-center"><label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1.5"><RotateCw size={14}/> Поворот</label><span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{settings.angle || 0}°</span></div><input type="range" min="-180" max="180" value={settings.angle || 0} onChange={handleAngleChange} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" /><div className="flex justify-between text-[10px] text-gray-500 font-mono px-1 pt-1"><span>-180°</span><span>0°</span><span>180°</span></div></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === ЗОНА ПРЕДПРОСМОТРА (Правая колонка, липкая) === */}
        <div className="lg:col-span-6 xl:col-span-7 lg:sticky lg:top-6">
          <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold flex items-center gap-2"><Eye className="text-blue-400" size={18}/> Предпросмотр поста</h3>
              <span className="text-xs text-gray-500 uppercase flex items-center gap-1"><Move size={12}/> Можно перетаскивать</span>
            </div>

            {/* Имитация поста */}
            <div className="flex-1 bg-black/40 rounded-2xl overflow-hidden border border-gray-800 flex flex-col shadow-inner">
              
              <div className="p-4 text-sm text-gray-300 whitespace-pre-wrap border-b border-gray-800/50">
                <p>Ваш текст поста будет выглядеть примерно так. Это пример демонстрации.</p>
                {signature && (
                  <p className="mt-3 text-blue-400/90 border-l-2 border-blue-500 pl-3 leading-relaxed break-words">{signature}</p>
                )}
              </div>

              {/* Интерактивное фото */}
              <div 
                ref={previewRef}
                onPointerDown={handleBackgroundClick}
                className="relative w-full aspect-[4/3] sm:aspect-[16/9] lg:aspect-[4/3] xl:aspect-[16/9] bg-gray-800 overflow-hidden bg-cover bg-center cursor-crosshair touch-none"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop')" }}
              >
                {/* ВОДЯНОЙ ЗНАК */}
                <div 
                  onPointerDown={handlePointerDown}
                  className={`absolute px-2.5 py-1 flex items-center justify-center whitespace-nowrap cursor-move select-none ${isDragging ? 'transition-none' : 'transition-all duration-200 ease-out'}`}
                  style={{
                    left: `${settings.x ?? 90}%`, top: `${settings.y ?? 85}%`,
                    backgroundColor: (settings.type === 'text' && settings.hasBackground) ? settings.bgColor : 'transparent', color: settings.textColor,
                    opacity: (settings.opacity || 90) / 100,
                    transform: `translate(-50%, -50%) scale(${(settings.size || 100) / 100}) rotate(${settings.angle || 0}deg)`, transformOrigin: 'center',
                    borderRadius: '6px', fontSize: '15px', fontWeight: 'bold',
                    boxShadow: (settings.type === 'text' && settings.hasBackground) ? '0 4px 6px rgba(0,0,0,0.3)' : 'none', zIndex: 10
                  }}
                >
                  {settings.type === 'image' && settings.image ? (
                    <img src={settings.image} alt="watermark" draggable="false" className="max-h-12 object-contain drop-shadow-lg pointer-events-none" />
                  ) : (
                    settings.text || 'SMMBOX'
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}