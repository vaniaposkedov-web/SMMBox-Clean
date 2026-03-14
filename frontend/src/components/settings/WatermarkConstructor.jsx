import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { 
  Save, Image as ImageIcon, Type, Palette, LayoutTemplate, Loader2, Check,
  Type as TypeIcon, Sliders, Upload, RotateCw, Move, Eye, Edit3,
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
const SAMPLE_IMG = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop";

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
  const [showMobileSticky, setShowMobileSticky] = useState(false);
  
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);
  const mainContainerRef = useRef(null);

  useEffect(() => {
    fetchGlobalSettings();
  }, [fetchGlobalSettings]);

  useEffect(() => {
    if (globalSettings) {
      setSignature(globalSettings.signature || '');
      setSettings(globalSettings.watermark || defaultWatermark);
    }
  }, [globalSettings]);

  // Умная логика появления верхней плавающей панели на мобильных
  useEffect(() => {
    const handleScroll = () => {
      if (mainContainerRef.current) {
        setShowMobileSticky(window.scrollY > 150); 
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Drag & Drop: жесткие границы и блокировка скролла ТОЛЬКО при захвате элемента
  const handlePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);

    const rect = previewRef.current.getBoundingClientRect();
    const startMouseX = e.clientX || e.touches?.[0]?.clientX;
    const startMouseY = e.clientY || e.touches?.[0]?.clientY;
    const startWX = settings.x ?? 90;
    const startWY = settings.y ?? 85;

    const handlePointerMove = (moveEvent) => {
      if (moveEvent.cancelable) moveEvent.preventDefault(); 
      
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

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  };

  // Клик по фону холста
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
    return (
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 bg-gray-900/50 p-2 sm:p-2.5 rounded-xl border border-gray-800 w-full max-w-full sm:max-w-[150px]">
        {positions.map(pos => {
          const Icon = pos.icon;
          const isActive = settings.position === pos.id;
          return (
            <button key={pos.id} onClick={() => updateSettings({ position: pos.id, x: posToCoords[pos.id].x, y: posToCoords[pos.id].y })} 
              className={`w-full aspect-square rounded-lg flex items-center justify-center transition-all min-h-[44px] sm:min-h-[40px] active:scale-95 ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700'}`}>
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            </button>
          )
        })}
      </div>
    );
  };

  const ColorPicker = ({ label, colorKey, hasCheckbox, checkboxKey }) => {
    return (
      <div className="space-y-3 w-full">
        <label className="text-xs sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider flex justify-between items-center min-h-[24px]">
          {label}
          {hasCheckbox && (
            <div className="flex items-center justify-center w-8 h-8">
              <input type="checkbox" checked={settings[checkboxKey] !== false} onChange={e => updateSettings({ [checkboxKey]: e.target.checked })} className="accent-blue-500 w-5 h-5 cursor-pointer rounded shrink-0" />
            </div>
          )}
        </label>
        <div className={`space-y-3 transition-opacity duration-200 ${(hasCheckbox && settings[checkboxKey] === false) ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-2 pr-4 w-full shadow-inner min-h-[48px]">
            <input type="color" value={settings[colorKey] || '#FFFFFF'} onChange={e => updateSettings({ [colorKey]: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0" />
            <span className="text-base sm:text-sm font-mono text-gray-300 uppercase flex-1 truncate">{settings[colorKey] || '#FFFFFF'}</span>
            <Palette size={18} className="text-gray-500 shrink-0"/>
          </div>
          
          <div className="flex flex-wrap gap-3 sm:gap-2.5 px-1 py-1">
            {presetColors.map(c => (
              <button key={c} onClick={() => updateSettings({ [colorKey]: c })} className="w-7 h-7 sm:w-6 sm:h-6 shrink-0 rounded-full border border-gray-600 transition-transform active:scale-90 hover:scale-110 shadow-sm" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const WatermarkElement = ({ isMiniature = false }) => {
    const visualScale = isMiniature ? 0.3 : (window.innerWidth < 640 ? 0.8 : 1);
    
    return (
      <div 
        onPointerDown={isMiniature ? undefined : handlePointerDown}
        className={`absolute px-3 py-1.5 flex items-center justify-center whitespace-nowrap select-none touch-none ${isMiniature ? '' : 'cursor-move'} ${isDragging ? 'transition-none' : 'transition-all duration-200 ease-out'}`}
        style={{
          left: `${settings.x ?? 90}%`, top: `${settings.y ?? 85}%`,
          backgroundColor: (settings.type === 'text' && settings.hasBackground) ? settings.bgColor : 'transparent', color: settings.textColor,
          opacity: (settings.opacity || 90) / 100,
          transform: `translate(-50%, -50%) scale(${((settings.size || 100) / 100) * visualScale}) rotate(${settings.angle || 0}deg)`, transformOrigin: 'center',
          borderRadius: '8px', fontSize: '15px', fontWeight: 'bold',
          boxShadow: (settings.type === 'text' && settings.hasBackground) ? '0 6px 12px rgba(0,0,0,0.4)' : 'none', zIndex: 10
        }}
      >
        {settings.type === 'image' && settings.image ? (
          <img src={settings.image} alt="watermark" draggable="false" className="max-h-12 object-contain drop-shadow-lg pointer-events-none" />
        ) : (settings.text || 'SMMBOX')}
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 sm:space-y-8 font-sans" ref={mainContainerRef}>
      
      {/* === ГЛАВНЫЙ ЗАГОЛОВОК === */}
      <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-3xl p-5 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-lg">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-white flex items-center gap-3 tracking-tight">
            <LayoutTemplate className="text-blue-500 shrink-0" size={28} /> <span>Шаблоны проекта</span>
          </h1>
          <p className="text-gray-400 mt-2 text-xs sm:text-sm max-w-xl leading-relaxed">
            Настройте дизайн постов. Он применится ко всем каналам, использующим <span className="text-gray-300 font-bold bg-gray-800 px-2 py-0.5 rounded-md border border-gray-700 whitespace-nowrap">Шаблон</span>.
          </p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className={`flex w-full sm:w-auto mt-4 sm:mt-0 shrink-0 px-8 py-3.5 rounded-xl font-bold items-center justify-center gap-2 transition-all shadow-xl active:scale-95 ${saveSuccess ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 disabled:opacity-50'}`}>
          {isSaving ? <Loader2 className="animate-spin" size={20} /> : saveSuccess ? <Check size={20} /> : <Save size={20} />}
          <span>{isSaving ? 'Сохранение...' : saveSuccess ? 'Сохранено' : 'Сохранить шаблон'}</span>
        </button>
      </div>

      {/* === 1. БОЛЬШОЙ ПРЕДПРОСМОТР СВЕРХУ === */}
      <div className="w-full bg-admin-card border border-gray-800 rounded-3xl shadow-xl overflow-hidden flex flex-col">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-800 bg-gray-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <h3 className="text-sm sm:text-base text-white font-bold flex items-center gap-2 uppercase tracking-wide"><Eye className="text-blue-400" size={18}/> Холст предпросмотра</h3>
          <span className="text-[10px] sm:text-[11px] text-gray-400 uppercase flex items-center gap-1.5 font-bold tracking-wider bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 shadow-inner"><Move size={14}/> Можно таскать по фото</span>
        </div>

        <div className="flex flex-col xl:flex-row">
          <div className="w-full xl:w-1/2 bg-gray-900 p-5 sm:p-8 border-b xl:border-b-0 xl:border-r border-gray-800 flex flex-col justify-center">
            <div className="space-y-4">
              <p className="text-sm sm:text-[15px] text-gray-300 leading-relaxed">Ваш текст поста будет выглядеть примерно так. Это пример проявления подписи.</p>
              {signature ? (
                <p className="text-sm sm:text-[15px] text-blue-400/90 border-l-2 border-blue-500 pl-4 leading-relaxed break-words animate-in fade-in duration-300">{signature}</p>
              ) : (
                <p className="text-xs sm:text-[13px] text-gray-600 italic">Здесь будет ваша подпись...</p>
              )}
            </div>
          </div>
          
          {/* ОБЛАСТЬ ХОЛСТА: убран класс touch-none, onClick вместо onPointerDown */}
          <div 
            ref={previewRef} onClick={handleBackgroundClick}
            className="relative w-full xl:w-1/2 aspect-square sm:aspect-[4/3] bg-gray-800 bg-cover bg-center cursor-crosshair overflow-hidden"
            style={{ backgroundImage: `url('${SAMPLE_IMG}')` }}
          >
            <WatermarkElement />
          </div>
        </div>
      </div>

      {/* === 2. ДИЗАЙН ЗНАКА === */}
      <div className="bg-admin-card border border-gray-800 rounded-3xl shadow-xl overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-gray-800 bg-gray-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <label className="text-sm sm:text-base font-bold text-white flex items-center gap-2 uppercase tracking-wide">
            <ImageIcon size={20} className="text-blue-400 shrink-0" /> Дизайн знака
          </label>
          <div className="flex w-full sm:w-auto bg-gray-900 rounded-xl border border-gray-800 p-1">
            <button onClick={() => setWatermarkTab('simple')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2.5 text-[11px] sm:text-[12px] uppercase tracking-wider font-bold rounded-lg flex items-center justify-center gap-2 transition-colors min-h-[44px] sm:min-h-0 ${watermarkTab === 'simple' ? 'text-white bg-gray-800 shadow-sm border border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}><Edit3 size={16}/> Базовая</button>
            <button onClick={() => setWatermarkTab('advanced')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2.5 text-[11px] sm:text-[12px] uppercase tracking-wider font-bold rounded-lg flex items-center justify-center gap-2 transition-colors min-h-[44px] sm:min-h-0 ${watermarkTab === 'advanced' ? 'text-white bg-gray-800 shadow-sm border border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}><Sliders size={16}/> Тонкая</button>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {watermarkTab === 'simple' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start animate-in fade-in duration-300">
              
              {/* Колонка 1: Ввод */}
              <div className="lg:col-span-4 space-y-6">
                <div className="flex p-1 bg-gray-900 rounded-xl border border-gray-800">
                  <button onClick={() => updateSettings({ type: 'text' })} className={`flex-1 py-3 sm:py-2.5 text-xs sm:text-[13px] font-bold rounded-lg transition-all min-h-[44px] ${settings.type === 'text' ? 'bg-gray-800 text-white shadow-sm border border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}>Текст</button>
                  <button onClick={() => updateSettings({ type: 'image' })} className={`flex-1 py-3 sm:py-2.5 text-xs sm:text-[13px] font-bold rounded-lg transition-all min-h-[44px] ${settings.type === 'image' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Логотип</button>
                </div>

                {settings.type === 'text' ? (
                  <div className="space-y-3">
                    <label className="text-xs sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Текст знака</label>
                    <input type="text" value={settings.text || ''} onChange={e => updateSettings({ text: e.target.value })} placeholder="SMMBOX" className="w-full bg-gray-900 border border-gray-800 shadow-inner rounded-xl py-3 sm:py-4 px-4 sm:px-5 text-base sm:text-base text-white focus:border-blue-500 outline-none transition-colors min-h-[48px]" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-xs sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Файл логотипа</label>
                    <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 sm:p-8 text-center hover:bg-gray-800/50 transition-colors bg-gray-900/50">
                      <input type="file" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} className="hidden" />
                      {settings.image ? (
                        <div className="flex flex-col items-center gap-4">
                          <img src={settings.image} alt="preview" className="h-16 sm:h-20 object-contain" />
                          <button onClick={() => fileInputRef.current?.click()} className="text-blue-400 text-sm font-bold hover:underline py-2 px-4 rounded-lg min-h-[44px]">Заменить логотип</button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 cursor-pointer py-4" onClick={() => fileInputRef.current?.click()}>
                          <div className="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20"><Upload size={24} className="text-blue-400"/></div>
                          <span className="text-sm font-medium text-gray-300 mt-2">Нажмите, чтобы загрузить PNG/JPG</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Колонка 2: Цвета */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                {settings.type === 'text' ? (
                  <>
                    <ColorPicker label="Цвет текста" colorKey="textColor" />
                    <ColorPicker label="Фон плашки" colorKey="bgColor" hasCheckbox checkboxKey="hasBackground" />
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-800 rounded-2xl p-8 text-center text-sm">
                    Настройка цветов доступна только для текстового водяного знака
                  </div>
                )}
              </div>

              {/* Колонка 3: Сетка */}
              <div className="lg:col-span-3 space-y-3 flex flex-col items-start lg:items-end">
                <label className="text-xs sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider w-full lg:max-w-[150px]">Привязка (Сетка)</label>
                <PositionGridButtons />
              </div>

            </div>
          )}

          {watermarkTab === 'advanced' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 animate-in fade-in duration-300 py-4 sm:py-0">
              <div className="space-y-4 sm:space-y-5">
                <div className="flex justify-between items-center"><label className="text-xs sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Прозрачность</label><span className="text-xs sm:text-sm text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{settings.opacity || 90}%</span></div>
                <input type="range" min="10" max="100" value={settings.opacity || 90} onChange={e => updateSettings({ opacity: Number(e.target.value) })} className="w-full h-2.5 sm:h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
              </div>
              <div className="space-y-4 sm:space-y-5">
                <div className="flex justify-between items-center"><label className="text-xs sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Масштаб</label><span className="text-xs sm:text-sm text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{settings.size || 100}%</span></div>
                <input type="range" min="50" max="250" value={settings.size || 100} onChange={e => updateSettings({ size: Number(e.target.value) })} className="w-full h-2.5 sm:h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
              </div>
              <div className="space-y-4 sm:space-y-5">
                <div className="flex justify-between items-center"><label className="text-xs sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><RotateCw size={14}/> Поворот</label><span className="text-xs sm:text-sm text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{settings.angle || 0}°</span></div>
                <input type="range" min="-180" max="180" value={settings.angle || 0} onChange={handleAngleChange} className="w-full h-2.5 sm:h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                <div className="flex justify-between text-[10px] text-gray-500 font-mono px-1 pt-1"><span>-180°</span><span>0°</span><span>180°</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* === 3. ОБЩАЯ ПОДПИСЬ === */}
      {/* Убран mb-24, чтобы не было пустой дыры снизу */}
      <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-5 sm:gap-6 lg:items-start">
          <div className="lg:w-1/3 space-y-2 sm:space-y-3">
            <label className="text-base sm:text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
              <Type size={20} className="text-blue-400 shrink-0" /> Общая подпись
            </label>
            <p className="text-[10px] sm:text-[11px] text-gray-500 uppercase tracking-wider font-semibold leading-relaxed">
              Этот текст автоматически добавится в самый конец каждого вашего поста. Удобно для ссылок на основной канал.
            </p>
          </div>
          <div className="lg:w-2/3">
            <textarea 
              value={signature} onChange={(e) => { setSignature(e.target.value); setSaveSuccess(false); }}
              placeholder="Например: Подписывайтесь на наш основной канал Telegram..."
              className="w-full min-h-[120px] sm:min-h-[140px] bg-gray-900 border border-gray-800 rounded-2xl px-4 sm:px-5 py-4 text-base sm:text-[15px] text-gray-200 resize-none focus:outline-none focus:border-blue-500 transition-colors custom-scrollbar placeholder-gray-600 leading-relaxed shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* === TOP ACTION BAR ДЛЯ МОБИЛЬНЫХ (ВЕРХНЯЯ ПАНЕЛЬ) === */}
      <div className={`fixed top-0 left-0 right-0 bg-[#0d0f13]/95 backdrop-blur-xl border-b border-gray-800 p-3 z-[60] transition-transform duration-300 shadow-xl flex items-center justify-between sm:hidden ${showMobileSticky ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex items-center gap-3 pr-2 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gray-800 bg-cover bg-center relative overflow-hidden shadow-inner border border-gray-700/50 shrink-0" style={{ backgroundImage: `url('${SAMPLE_IMG}')` }}>
             <WatermarkElement isMiniature={true} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">Настройки</span>
            <span className="text-sm font-bold text-white truncate">В редактировании</span>
          </div>
        </div>
        <button onClick={handleSave} disabled={isSaving} className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all min-h-[44px] active:scale-95 ${saveSuccess ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 disabled:opacity-50'}`}>
          {isSaving ? <Loader2 size={18} className="animate-spin"/> : saveSuccess ? <Check size={18}/> : <Save size={18}/>}
        </button>
      </div>

    </div>
  );
}