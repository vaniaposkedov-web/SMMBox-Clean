import { useState, useEffect } from 'react';
import { Image as ImageIcon, Type, Upload, Grid, Check, Sliders, RotateCw, Maximize, Droplet, Palette, ChevronDown, AlertCircle } from 'lucide-react';
import { useStore } from '../../store'; // ПОДКЛЮЧАЕМ НАШУ БАЗУ

const PRESET_COLORS = ['#FFFFFF', '#000000', '#EAB308', '#EF4444', '#3B82F6', '#10B981', '#8B5CF6'];

export default function WatermarkConstructor() {
  // Достаем настройки и функцию сохранения из Store
  const savedSettings = useStore((state) => state.watermarkSettings);
  const saveToStore = useStore((state) => state.setWatermarkSettings);

  // Инициализируем локальные стейты из сохраненных настроек
  const [type, setType] = useState(savedSettings.type);
  const [text, setText] = useState(savedSettings.text);
  const [image, setImage] = useState(savedSettings.image);
  const [position, setPosition] = useState(savedSettings.position);
  
  const [hasBackground, setHasBackground] = useState(savedSettings.hasBackground);
  const [visualStyle, setVisualStyle] = useState(savedSettings.visualStyle);
  const [fontFamily, setFontFamily] = useState(savedSettings.fontFamily);
  const [textColor, setTextColor] = useState(savedSettings.textColor);
  const [bgColor, setBgColor] = useState(savedSettings.bgColor);

  const [size, setSize] = useState(savedSettings.size);
  const [angle, setAngle] = useState(savedSettings.angle);
  const [opacity, setOpacity] = useState(savedSettings.opacity);
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaved, setIsSaved] = useState(false); // Для анимации кнопки сохранения

  const SAMPLE_BG = "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800&auto=format&fit=crop";

  // Обработчик загрузки фото (строго PNG)
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'image/png') {
        alert('Пожалуйста, загружайте только изображения в формате PNG с прозрачным фоном!');
        return;
      }
      
      // Конвертируем в Base64, чтобы можно было сохранить в localStorage/БД
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
        setType('image');
      };
      reader.readAsDataURL(file);
    }
  };

  // ФУНКЦИЯ СОХРАНЕНИЯ
  const handleSave = () => {
    saveToStore({
      type, text, image, position,
      hasBackground, visualStyle, fontFamily, textColor, bgColor,
      size: Number(size), angle: Number(angle), opacity: Number(opacity)
    });
    
    // Красивая анимация успеха
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'tl': return 'top-3 left-3 md:top-4 md:left-4';
      case 'tc': return 'top-3 left-1/2 -translate-x-1/2 md:top-4';
      case 'tr': return 'top-3 right-3 md:top-4 md:right-4';
      case 'ml': return 'top-1/2 left-3 -translate-y-1/2 md:left-4';
      case 'mc': return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
      case 'mr': return 'top-1/2 right-3 -translate-y-1/2 md:right-4';
      case 'bl': return 'bottom-3 left-3 md:bottom-4 md:left-4';
      case 'bc': return 'bottom-3 left-1/2 -translate-x-1/2 md:bottom-4';
      case 'br': return 'bottom-3 right-3 md:bottom-4 md:right-4';
      default: return 'bottom-3 right-3 md:bottom-4 md:right-4';
    }
  };

  const ColorPicker = ({ label, value, onChange }) => (
    <div className="flex-1">
      <label className="block text-xs text-gray-400 mb-2">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-gray-700 shrink-0 cursor-pointer shadow-lg">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => onChange(c)} className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${value === c ? 'border-admin-accent scale-110' : 'border-gray-700'}`} style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-admin-card border border-gray-800 rounded-3xl p-4 md:p-6 shadow-xl relative">
      <h2 className="text-xl font-bold mb-6 hidden md:flex items-center gap-2">
        <Droplet className="text-admin-accent" /> Дизайн водяного знака
      </h2>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* ================= ЛЕВАЯ ЧАСТЬ ================= */}
        <div className="order-2 lg:order-1 lg:col-span-7 space-y-6 mt-4 lg:mt-0">
          
          <div className="flex gap-2 p-1 bg-gray-900 rounded-xl border border-gray-800">
            <button onClick={() => setType('text')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${type === 'text' ? 'bg-admin-card text-white shadow border border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}>
              <Type size={16} /> Текст
            </button>
            <button onClick={() => setType('image')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${type === 'image' ? 'bg-admin-card text-white shadow border border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}>
              <ImageIcon size={16} /> Картинка
            </button>
          </div>

          {type === 'text' ? (
             /* ... ВЕСЬ КОД ТЕКСТА ОСТАЕТСЯ БЕЗ ИЗМЕНЕНИЙ ... */
             <div className="space-y-5 bg-gray-900/40 p-4 md:p-5 rounded-2xl border border-gray-800/50">
             <div>
               <label className="block text-sm text-gray-400 mb-2 font-medium">Текст знака</label>
               <input type="text" value={text} onChange={(e) => setText(e.target.value)} className="w-full bg-admin-card border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-admin-accent focus:ring-1 focus:ring-admin-accent transition-all" />
             </div>
             <div className="flex flex-col sm:flex-row gap-4">
               <div className="flex-1">
                 <label className="block text-xs text-gray-400 mb-2">Шрифт</label>
                 <div className="relative">
                   <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="w-full appearance-none bg-admin-card border border-gray-700 rounded-xl py-3 pl-4 pr-10 text-sm text-white focus:outline-none focus:border-admin-accent cursor-pointer transition-colors hover:border-gray-500">
                     <option value="font-sans">Классический (Sans)</option>
                     <option value="font-serif">С засечками (Serif)</option>
                     <option value="font-mono">Печатный (Mono)</option>
                   </select>
                   <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                 </div>
               </div>
               <div className="flex-1">
                 <label className="block text-xs text-gray-400 mb-2">Стиль плашки</label>
                 <div className="relative">
                   <select value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} className={`w-full appearance-none bg-admin-card border border-gray-700 rounded-xl py-3 pl-4 pr-10 text-sm text-white focus:outline-none focus:border-admin-accent cursor-pointer transition-colors ${!hasBackground ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-500'}`} disabled={!hasBackground}>
                     <option value="glass">Стекло (Blur)</option>
                     <option value="solid">Сплошной цвет</option>
                   </select>
                   <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                 </div>
               </div>
             </div>
             <div className="pt-4 border-t border-gray-800 space-y-4">
               <div className="flex items-center justify-between">
                 <span className="text-sm font-medium text-gray-300 flex items-center gap-2"><Palette size={16}/> Использовать фон</span>
                 <button onClick={() => setHasBackground(!hasBackground)} className={`w-12 h-6 rounded-full p-1 transition-colors ${hasBackground ? 'bg-admin-accent' : 'bg-gray-700'}`}>
                   <div className={`w-4 h-4 rounded-full bg-white transition-transform ${hasBackground ? 'translate-x-6' : 'translate-x-0'}`}></div>
                 </button>
               </div>
               <div className="flex flex-col sm:flex-row gap-4">
                 <ColorPicker label="Цвет текста" value={textColor} onChange={setTextColor} />
                 {hasBackground && <ColorPicker label="Цвет фона" value={bgColor} onChange={setBgColor} />}
               </div>
             </div>
           </div>
          ) : (
            <div className="bg-gray-900/40 p-4 md:p-5 rounded-2xl border border-gray-800/50">
              <label className="block text-sm text-gray-400 mb-2 font-medium flex items-center gap-2">Логотип <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300">Только PNG</span></label>
              
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-admin-accent hover:bg-admin-accent/5 transition-all group overflow-hidden relative bg-admin-card">
                {image ? (
                  <img src={image} alt="Preview" className="h-full object-contain p-2 opacity-50 group-hover:opacity-20 transition-opacity" />
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-gray-500 group-hover:text-admin-accent transition-colors" />
                    <p className="text-sm text-gray-400">Загрузить логотип (без фона)</p>
                  </div>
                )}
                {image && <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 font-bold text-white bg-black/50 transition-all">Заменить фото</div>}
                
                {/* === ОГРАНИЧЕНИЕ НА СТРОГИЙ PNG === */}
                <input type="file" className="hidden" accept="image/png" onChange={handleImageUpload} />
              </label>

              <div className="mt-3 text-xs text-yellow-500/80 flex items-start gap-1.5">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <p>Убедитесь, что ваше изображение сохранено в формате PNG и имеет прозрачный фон, иначе оно перекроет фотографию белым квадратом.</p>
              </div>
            </div>
          )}

          {/* Позиция */}
          <div className="bg-gray-900/40 p-4 md:p-5 rounded-2xl border border-gray-800/50">
            <label className="block text-sm text-gray-400 mb-4 flex items-center gap-2 font-medium">
              <Grid size={16} /> Положение на фото
            </label>
            <div className="grid grid-cols-3 gap-2 mx-auto max-w-[220px] lg:mx-0">
              {['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'].map((pos) => (
                <button key={pos} onClick={() => setPosition(pos)} className={`h-12 rounded-xl flex items-center justify-center transition-all ${position === pos ? 'bg-admin-accent text-white shadow-lg shadow-blue-500/30 ring-2 ring-admin-accent/50' : 'bg-admin-card border border-gray-700 text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                  {pos === 'mc' ? <div className="w-2.5 h-2.5 rounded-full bg-current"></div> : getArrowIcon(pos)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ================= ПРАВАЯ ЧАСТЬ ================= */}
        <div className="order-1 lg:order-2 lg:col-span-5 flex flex-col gap-6">
          <div className="sticky top-0 z-30 pt-2 pb-4 -mx-4 px-4 bg-admin-card/90 backdrop-blur-xl border-b border-gray-800 md:mx-0 md:px-0 md:pt-0 md:pb-0 md:static md:bg-transparent md:backdrop-blur-none md:border-none shadow-2xl md:shadow-none">
            <div className="flex justify-between items-center mb-2 md:hidden">
              <span className="text-sm font-bold text-white">Живой результат</span>
            </div>
            <div className="relative w-full h-[180px] md:h-auto md:aspect-square bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 md:shadow-2xl ring-2 md:ring-4 ring-gray-900/50">
              
              <img src={SAMPLE_BG} alt="Фон" className="w-full h-full object-cover" />
              
              <div className={`absolute ${getPositionClasses()} transition-all duration-300 pointer-events-none z-10 flex items-center justify-center`}>
                <div className="transition-transform duration-100 ease-linear origin-center" style={{ transform: `scale(${size / 100}) rotate(${angle}deg)`, opacity: opacity / 100 }}>
                  {type === 'text' && text ? (
                    <div 
                      className={`${fontFamily} font-bold px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-base uppercase tracking-wide ${hasBackground ? 'rounded-lg md:rounded-xl shadow-lg' : 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'}`}
                      style={{ 
                        color: textColor,
                        backgroundColor: hasBackground ? (visualStyle === 'glass' ? `${bgColor}80` : bgColor) : 'transparent',
                        backdropFilter: hasBackground && visualStyle === 'glass' ? 'blur(8px)' : 'none',
                      }}
                    >
                      {text}
                    </div>
                  ) : type === 'image' && image ? (
                    <img src={image} alt="Watermark" className="max-w-[120px] md:max-w-[200px] max-h-[120px] md:max-h-[200px] drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)] object-contain" />
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900/40 p-4 md:p-6 rounded-2xl border border-gray-800/50">
            <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
              <Sliders size={16} className="text-admin-accent" /> Точная настройка
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-3"><span className="flex items-center gap-1"><Maximize size={14}/> Масштаб</span><span className="bg-admin-card border border-gray-700 px-2 py-0.5 rounded-md text-white">{size}%</span></div>
                <input type="range" min="30" max="200" value={size} onChange={(e) => setSize(e.target.value)} className="w-full accent-admin-accent h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-3"><span className="flex items-center gap-1"><Droplet size={14}/> Прозрачность</span><span className="bg-admin-card border border-gray-700 px-2 py-0.5 rounded-md text-white">{opacity}%</span></div>
                <input type="range" min="10" max="100" value={opacity} onChange={(e) => setOpacity(e.target.value)} className="w-full accent-admin-accent h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-3"><span className="flex items-center gap-1"><RotateCw size={14}/> Поворот</span><span className="bg-admin-card border border-gray-700 px-2 py-0.5 rounded-md text-white">{angle}°</span></div>
                <input type="range" min="-180" max="180" value={angle} onChange={(e) => setAngle(e.target.value)} className="w-full accent-admin-accent h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* === КНОПКА СОХРАНЕНИЯ С АНИМАЦИЕЙ === */}
      <div className="mt-8 flex justify-end md:border-t border-gray-800 pt-6">
        <button 
          onClick={handleSave}
          className={`w-full md:w-auto font-bold py-4 md:py-3 px-8 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${isSaved ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-admin-accent text-white hover:bg-blue-600 shadow-blue-500/20'}`}
        >
          {isSaved ? <><Check size={18} /> Сохранено!</> : <><Check size={18} /> Сохранить дизайн</>}
        </button>
      </div>
    </div>
  );
}

function getArrowIcon(pos) {
  const arrows = { tl: '↖', tc: '↑', tr: '↗', ml: '←', mr: '→', bl: '↙', bc: '↓', br: '↘' };
  return <span className="text-xl leading-none">{arrows[pos]}</span>;
}