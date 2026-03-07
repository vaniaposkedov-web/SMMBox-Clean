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
  const mainPreviewContainerRef = useRef(null);

  useEffect(() => {
    fetchGlobalSettings();
  }, []);

  useEffect(() => {
    if (globalSettings) {
      setSignature(globalSettings.signature || '');
      setSettings(globalSettings.watermark || defaultWatermark);
    }
  }, [globalSettings]);

  // Шторка для мобилок
  useEffect(() => {
    const handleScroll = () => {
      if (mainPreviewContainerRef.current) {
        const rect = mainPreviewContainerRef.current.getBoundingClientRect();
        setShowMobileSticky(rect.bottom < 100); 
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

  // Drag & Drop с жесткими границами
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
      const clientX = moveEvent.clientX || moveEvent.touches?.[0]?.clientX;
      const clientY = moveEvent.clientY || moveEvent.touches?.[0]?.clientY;
      const percentDx = ((clientX - startMouseX) / rect.width) * 100;
      const percentDy = ((clientY - startMouseY) / rect.height) * 100;
      // Жестко ограничиваем от 0 до 100
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
    return (
      <div className="grid grid-cols-3 gap-1.5 bg-[#0f1115] p-2.5 rounded-xl border border-[#1f222a] w-full max-w-[150px]">
        {positions.map(pos => {
          const Icon = pos.icon;
          const isActive = settings.position === pos.id;
          return (
            <button key={pos.id} onClick={() => updateSettings({ position: pos.id, x: posToCoords[pos.id].x, y: posToCoords[pos.id].y })} 
              className={`w-full aspect-square rounded-lg flex items-center justify-center transition-all ${isActive ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)] scale-95' : 'bg-[#1a1d24] text-gray-400 hover:bg-[#252830] hover:text-white border border-[#2a2d36]'}`}>
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
        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex justify-between items-center">
          {label}
          {hasCheckbox && (
            <input type="checkbox" checked={settings[checkboxKey] !== false} onChange={e => updateSettings({ [checkboxKey]: e.target.checked })} className="accent-blue-500 w-4 h-4 cursor-pointer rounded shrink-0" />
          )}
        </label>
        <div className={`space-y-3 transition-opacity duration-200 ${(hasCheckbox && settings[checkboxKey] === false) ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center gap-3 bg-[#0f1115] border border-[#1f222a] rounded-xl p-2 pr-3 w-full shadow-inner">
            <input type="color" value={settings[colorKey] || '#FFFFFF'} onChange={e => updateSettings({ [colorKey]: e.target.value })} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0" />
            <span className="text-sm font-mono text-gray-300 uppercase flex-1 truncate">{settings[colorKey] || '#FFFFFF'}</span>
            <Palette size={16} className="text-gray-500 shrink-0"/>
          </div>
          {/* flex-wrap не даст кружочкам сплюснуться в прямоугольники */}
          <div className="flex flex-wrap gap-2.5 px-1">
            {presetColors.map(c => (
              <button key={c} onClick={() => updateSettings({ [colorKey]: c })} className="w-5 h-5 aspect-square shrink-0 rounded-full border border-gray-600 transition-transform hover:scale-125 shadow-sm" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const WatermarkElement = ({ scaleFactor = 1 }) => (
    <div 
      onPointerDown={handlePointerDown}
      className={`absolute px-3 py-1.5 flex items-center justify-center whitespace-nowrap cursor-move select-none touch-none ${isDragging ? 'transition-none' : 'transition-all duration-200 ease-out'}`}
      style={{
        left: `${settings.x ?? 90}%`, top: `${settings.y ?? 85}%`,
        backgroundColor: (settings.type === 'text' && settings.hasBackground) ? settings.bgColor : 'transparent', color: settings.textColor,
        opacity: (settings.opacity || 90) / 100,
        transform: `translate(-50%, -50%) scale(${((settings.size || 100) / 100) * scaleFactor}) rotate(${settings.angle || 0}deg)`, transformOrigin: 'center',
        borderRadius: '8px', fontSize: '15px', fontWeight: 'bold',
        boxShadow: (settings.type === 'text' && settings.hasBackground) ? '0 6px 12px rgba(0,0,0,0.4)' : 'none', zIndex: 10
      }}
    >
      {settings.type === 'image' && settings.image ? (
        <img src={settings.image} alt="watermark" draggable="false" className="max-h-12 object-contain drop-shadow-lg pointer-events-none" />
      ) : (settings.text || 'SMMBOX')}
    </div>
  );

  return (
    <div className="w-full space-y-8 pb-20 translate-no" translate="no">
      
      {/* === МОБИЛЬНАЯ ШТОРКА === */}
      <div className={`fixed top-0 left-0 right-0 bg-[#0d0f13]/95 backdrop-blur-xl border-b border-[#1f222a] p-3 z-50 flex items-center justify-between transition-transform duration-300 lg:hidden shadow-2xl ${showMobileSticky ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gray-800 bg-cover bg-center relative overflow-hidden shadow-inner border border-gray-700/50" style={{ backgroundImage: `url('${SAMPLE_IMG}')` }}>
             <WatermarkElement scaleFactor={0.25} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Шаблон</span>
            <span className="text-sm font-semibold text-white">В редактировании</span>
          </div>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-colors">
          {isSaving ? <Loader2 size={16} className="animate-spin"/> : saveSuccess ? <Check size={16}/> : <Save size={16}/>}
        </button>
      </div>

      {/* === ГЛАВНЫЙ ЗАГОЛОВОК === */}
      <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-lg">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3 tracking-tight">
            <LayoutTemplate className="text-blue-500" size={30} /> Шаблоны проекта
          </h1>
          <p className="text-gray-400 mt-2 text-sm max-w-xl leading-relaxed">
            Настройте дизайн постов. Он применится ко всем каналам, использующим <span className="text-gray-300 font-bold bg-[#1f222a] px-2 py-0.5 rounded-md border border-gray-700">Шаблон</span>.
          </p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className={`hidden sm:flex shrink-0 px-8 py-3.5 rounded-xl font-bold items-center justify-center gap-2 transition-all shadow-xl ${saveSuccess ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 disabled:opacity-50'}`}>
          {isSaving ? <Loader2 className="animate-spin" size={20} /> : saveSuccess ? <Check size={20} /> : <Save size={20} />}
          <span>{isSaving ? 'Сохранение...' : saveSuccess ? 'Сохранено' : 'Сохранить шаблон'}</span>
        </button>
      </div>

      {/* === 1. БОЛЬШОЙ ПРЕДПРОСМОТР СВЕРХУ === */}
      <div className="w-full bg-[#13151A] border border-[#1E2028] rounded-3xl shadow-2xl overflow-hidden flex flex-col" ref={mainPreviewContainerRef}>
        <div className="px-6 py-5 border-b border-[#1E2028] bg-[#16181e] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-sm text-white font-bold flex items-center gap-2 uppercase tracking-wide"><Eye className="text-blue-400" size={18}/> Холст предпросмотра</h3>
          <span className="text-[10px] text-gray-400 uppercase flex items-center gap-1.5 font-bold tracking-wider bg-[#0f1115] px-3 py-1.5 rounded-lg border border-[#2a2d36] shadow-inner"><Move size={12}/> Можно перетаскивать знак по фото</span>
        </div>

        <div className="flex flex-col xl:flex-row">
          <div className="w-full xl:w-1/2 bg-[#0f1115] p-6 sm:p-8 border-b xl:border-b-0 xl:border-r border-[#1f222a] flex flex-col justify-center">
            <div className="space-y-4">
              <p className="text-[15px] text-gray-300 leading-relaxed">Ваш текст поста будет выглядеть примерно так. Это пример проявления.</p>
              {signature ? (
                <p className="text-[15px] text-blue-400/90 border-l-2 border-blue-500 pl-4 leading-relaxed break-words animate-in fade-in duration-300">{signature}</p>
              ) : (
                <p className="text-[13px] text-gray-600 italic">Здесь будет ваша подпись...</p>
              )}
            </div>
          </div>
          {/* Сделали пропорцию квадрата для мобилок и 4:3 для ПК. Добавили overflow-hidden чтобы знак не вылезал! */}
          <div 
            ref={previewRef} onPointerDown={handleBackgroundClick}
            className="relative w-full xl:w-1/2 aspect-square md:aspect-[4/3] bg-gray-800 bg-cover bg-center cursor-crosshair touch-none overflow-hidden"
            style={{ backgroundImage: `url('${SAMPLE_IMG}')` }}
          >
            <WatermarkElement />
          </div>
        </div>
      </div>

      {/* === 2. ДИЗАЙН ЗНАКА === */}
      <div className="bg-[#13151A] border border-[#1E2028] rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-[#1E2028] bg-[#16181e] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <label className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
            <ImageIcon size={18} className="text-blue-400" /> Дизайн знака
          </label>
          <div className="flex w-full sm:w-auto bg-[#0f1115] rounded-lg border border-[#1f222a] p-1">
            <button onClick={() => setWatermarkTab('simple')} className={`flex-1 sm:flex-none px-6 py-2.5 text-[11px] uppercase tracking-wider font-bold rounded-md flex items-center justify-center gap-2 transition-colors ${watermarkTab === 'simple' ? 'text-white bg-[#1e2028] shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><Edit3 size={14}/> Базовая</button>
            <button onClick={() => setWatermarkTab('advanced')} className={`flex-1 sm:flex-none px-6 py-2.5 text-[11px] uppercase tracking-wider font-bold rounded-md flex items-center justify-center gap-2 transition-colors ${watermarkTab === 'advanced' ? 'text-white bg-[#1e2028] shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><Sliders size={14}/> Тонкая</button>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {watermarkTab === 'simple' && (
            // 12-колоночная сетка для идеальных пропорций
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start animate-in fade-in duration-300">
              
              {/* Колонка 1: Ввод (4 части) */}
              <div className="lg:col-span-4 space-y-6">
                <div className="flex p-1 bg-[#0f1115] rounded-xl border border-[#1f222a]">
                  <button onClick={() => updateSettings({ type: 'text' })} className={`flex-1 py-3 text-[13px] font-bold rounded-lg transition-all ${settings.type === 'text' ? 'bg-[#1e2028] text-white shadow-sm border border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}>Текст</button>
                  <button onClick={() => updateSettings({ type: 'image' })} className={`flex-1 py-3 text-[13px] font-bold rounded-lg transition-all ${settings.type === 'image' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Логотип</button>
                </div>

                {settings.type === 'text' ? (
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Текст знака</label>
                    <input type="text" value={settings.text || ''} onChange={e => updateSettings({ text: e.target.value })} placeholder="SMMBOX" className="w-full bg-[#0f1115] border border-[#1f222a] shadow-inner rounded-xl py-4 px-5 text-base text-white focus:border-blue-500 outline-none transition-colors" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Файл логотипа</label>
                    <div className="border-2 border-dashed border-[#2a2d36] rounded-xl p-6 text-center hover:bg-[#181a20] transition-colors bg-[#0f1115]">
                      <input type="file" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} className="hidden" />
                      {settings.image ? (
                        <div className="flex flex-col items-center gap-4">
                          <img src={settings.image} alt="preview" className="h-16 object-contain" />
                          <button onClick={() => fileInputRef.current?.click()} className="text-blue-400 text-sm font-bold hover:underline">Заменить логотип</button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                          <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center"><Upload size={20} className="text-blue-400"/></div>
                          <span className="text-sm font-medium text-gray-300">Нажмите, чтобы загрузить PNG/JPG</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Колонка 2: Цвета (5 частей) */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                {settings.type === 'text' ? (
                  <>
                    <ColorPicker label="Цвет текста" colorKey="textColor" />
                    <ColorPicker label="Фон плашки" colorKey="bgColor" hasCheckbox checkboxKey="hasBackground" />
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-600 border-2 border-dashed border-[#1f222a] rounded-xl p-4">Цвета настраиваются только для текста</div>
                )}
              </div>

              {/* Колонка 3: Сетка (3 части) */}
              <div className="lg:col-span-3 space-y-3 flex flex-col items-start lg:items-end">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider w-full max-w-[150px]">Привязка (Сетка)</label>
                <PositionGridButtons />
              </div>

            </div>
          )}

          {watermarkTab === 'advanced' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 animate-in fade-in duration-300">
              <div className="space-y-5"><div className="flex justify-between items-center"><label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Прозрачность</label><span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{settings.opacity || 90}%</span></div><input type="range" min="10" max="100" value={settings.opacity || 90} onChange={e => updateSettings({ opacity: Number(e.target.value) })} className="w-full h-2.5 bg-[#1f222a] rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
              <div className="space-y-5"><div className="flex justify-between items-center"><label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Масштаб</label><span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{settings.size || 100}%</span></div><input type="range" min="50" max="250" value={settings.size || 100} onChange={e => updateSettings({ size: Number(e.target.value) })} className="w-full h-2.5 bg-[#1f222a] rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
              <div className="space-y-5"><div className="flex justify-between items-center"><label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><RotateCw size={14}/> Поворот</label><span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">{settings.angle || 0}°</span></div><input type="range" min="-180" max="180" value={settings.angle || 0} onChange={handleAngleChange} className="w-full h-2.5 bg-[#1f222a] rounded-lg appearance-none cursor-pointer accent-blue-500" /><div className="flex justify-between text-[10px] text-gray-500 font-mono px-1 pt-1"><span>-180°</span><span>0°</span><span>180°</span></div></div>
            </div>
          )}
        </div>
      </div>

      {/* === 3. ОБЩАЯ ПОДПИСЬ === */}
      <div className="bg-[#13151A] border border-[#1E2028] rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
          <div className="lg:w-1/3 space-y-3">
            <label className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
              <Type size={18} className="text-blue-400" /> Общая подпись к посту
            </label>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold leading-relaxed">
              Этот текст автоматически добавится в самый конец каждого вашего поста. Удобно для ссылок на основной канал.
            </p>
          </div>
          <div className="lg:w-2/3">
            <textarea 
              value={signature} onChange={(e) => { setSignature(e.target.value); setSaveSuccess(false); }}
              placeholder="Например: Подписывайтесь на наш основной канал Telegram..."
              className="w-full min-h-[120px] bg-[#0f1115] border border-[#1f222a] rounded-xl px-5 py-4 text-[15px] text-gray-200 resize-none focus:outline-none focus:border-blue-500 transition-colors custom-scrollbar placeholder-gray-600 leading-relaxed shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Мобильная кнопка сохранения (дубль для низа) */}
      <button onClick={handleSave} disabled={isSaving} className={`mt-8 w-full sm:hidden py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl ${saveSuccess ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 disabled:opacity-50'}`}>
        {isSaving ? <Loader2 className="animate-spin" size={20} /> : saveSuccess ? <Check size={20} /> : <Save size={20} />}
        <span>{isSaving ? 'Сохранение...' : saveSuccess ? 'Сохранено' : 'Сохранить шаблон'}</span>
      </button>

    </div>
  );
}