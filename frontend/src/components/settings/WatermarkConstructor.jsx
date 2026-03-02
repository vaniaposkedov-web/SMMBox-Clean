import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { Save, Image as ImageIcon, Type, AlignRight, Palette, Layout, Loader2, CheckCircle2 } from 'lucide-react';

// Стандартные настройки, если группа новая
const defaultWatermark = {
  type: 'text',
  text: 'SMMBOX',
  position: 'br',
  hasBackground: true,
  visualStyle: 'glass',
  fontFamily: 'font-sans',
  textColor: '#FFFFFF',
  bgColor: '#000000',
  size: 100,
  opacity: 90,
  angle: 0,
};

export default function WatermarkConstructor() {
  const accounts = useStore((state) => state.accounts);
  const saveAccountDesign = useStore((state) => state.saveAccountDesign);

  // Локальные стейты для формы
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [signature, setSignature] = useState('');
  const [settings, setSettings] = useState(defaultWatermark);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Когда юзер выбирает другую группу - подгружаем её настройки
  useEffect(() => {
    if (selectedAccountId) {
      const acc = accounts.find(a => a.id === selectedAccountId);
      if (acc) {
        setSignature(acc.signature || '');
        setSettings(acc.watermark || defaultWatermark);
        setSaveSuccess(false);
      }
    } else {
      setSignature('');
      setSettings(defaultWatermark);
    }
  }, [selectedAccountId, accounts]);

  // Выбираем первый аккаунт по умолчанию при загрузке (если он есть)
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const updateSettings = (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!selectedAccountId) return alert('Выберите аккаунт!');
    setIsSaving(true);
    const result = await saveAccountDesign(selectedAccountId, signature, settings);
    setIsSaving(false);
    if (result.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      alert('Ошибка при сохранении!');
    }
  };

  // Если аккаунтов нет
  if (accounts.length === 0) {
    return (
      <div className="bg-admin-card border border-gray-800 rounded-3xl p-12 text-center shadow-xl">
        <Layout size={48} className="mx-auto text-gray-600 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Нет подключенных аккаунтов</h2>
        <p className="text-gray-400">Сначала перейдите во вкладку "Мои аккаунты" и добавьте хотя бы одну группу.</p>
      </div>
    );
  }

  const selectedAcc = accounts.find(a => a.id === selectedAccountId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-8rem)]">
      
      {/* ПАНЕЛЬ НАСТРОЕК (Левая колонка) */}
      <div className="lg:col-span-5 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
        
        {/* 1. Выбор группы */}
        <div className="bg-admin-card border border-gray-800 p-6 rounded-3xl shadow-lg">
          <label className="block text-sm font-medium text-gray-400 mb-3">Настраиваем дизайн для группы:</label>
          <select 
            value={selectedAccountId} 
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-admin-accent focus:ring-1 focus:ring-admin-accent transition-all"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} ({acc.provider.toUpperCase()})</option>
            ))}
          </select>
        </div>

        {/* 2. Подпись (Текст поста) */}
        <div className="bg-admin-card border border-gray-800 p-6 rounded-3xl shadow-lg">
          <label className="block text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <AlignRight size={16} className="text-admin-accent" /> Уникальная подпись к постам
          </label>
          <textarea 
            value={signature}
            onChange={(e) => { setSignature(e.target.value); setSaveSuccess(false); }}
            placeholder="Например: Для заказа пишите в WhatsApp +7 999 000-00-00&#10;Или переходите в наш Telegram канал..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white h-28 resize-none focus:outline-none focus:border-admin-accent transition-all"
          />
          <p className="text-xs text-gray-500 mt-2">Этот текст будет автоматически добавляться в конец каждого поста для этой группы. Партнеры его не увидят при копировании.</p>
        </div>

        {/* 3. Настройки Водяного знака */}
        <div className="bg-admin-card border border-gray-800 p-6 rounded-3xl shadow-lg space-y-6">
          <div className="flex items-center gap-2 mb-2 text-white font-bold">
            <Palette size={18} className="text-admin-accent" /> Водяной знак на фото
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Тип знака</label>
            <div className="flex bg-gray-900 p-1 rounded-xl border border-gray-800">
              <button onClick={() => updateSettings({ type: 'text' })} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${settings.type === 'text' ? 'bg-admin-accent text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
                <Type size={16} /> Текст
              </button>
              <button onClick={() => updateSettings({ type: 'image' })} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${settings.type === 'image' ? 'bg-admin-accent text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
                <ImageIcon size={16} /> Логотип
              </button>
            </div>
          </div>

          {settings.type === 'text' && (
            <div>
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Текст водяного знака</label>
              <input 
                type="text" 
                value={settings.text || ''} 
                onChange={(e) => updateSettings({ text: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-admin-accent"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Расположение</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'tl', label: '↖' }, { id: 'tc', label: '↑' }, { id: 'tr', label: '↗' },
                { id: 'ml', label: '←' }, { id: 'mc', label: '•' }, { id: 'mr', label: '→' },
                { id: 'bl', label: '↙' }, { id: 'bc', label: '↓' }, { id: 'br', label: '↘' }
              ].map(pos => (
                <button 
                  key={pos.id}
                  onClick={() => updateSettings({ position: pos.id })}
                  className={`py-2 rounded-xl text-lg font-bold transition-all border ${settings.position === pos.id ? 'bg-admin-accent border-admin-accent text-white' : 'bg-gray-900 border-gray-800 text-gray-500 hover:bg-gray-800'}`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* Сохранить */}
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all mt-6 shadow-xl ${saveSuccess ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'}`}
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : saveSuccess ? <CheckCircle2 size={20} /> : <Save size={20} />}
            {isSaving ? 'Сохранение...' : saveSuccess ? 'Сохранено!' : 'Сохранить шаблон для группы'}
          </button>
        </div>

      </div>

      {/* ЗОНА ПРЕДПРОСМОТРА (Правая колонка) */}
      <div className="lg:col-span-7 bg-admin-card border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col h-[600px] lg:h-auto relative overflow-hidden">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2 z-10">
          <ImageIcon className="text-admin-accent" /> Предпросмотр поста
        </h3>

        {/* Имитация поста ВКонтакте/Телеграм */}
        <div className="flex-1 bg-[#1a1a1a] rounded-2xl overflow-hidden border border-gray-800 flex flex-col">
          
          {/* Шапка поста */}
          <div className="p-4 flex items-center gap-3 bg-gray-900/50 border-b border-gray-800">
            <img src={selectedAcc?.avatarUrl || "https://vk.com/images/community_200.png"} className="w-10 h-10 rounded-full border border-gray-700" alt="avatar" />
            <div>
              <p className="text-white text-sm font-bold">{selectedAcc?.name || "Название группы"}</p>
              <p className="text-gray-500 text-xs">Только что</p>
            </div>
          </div>

          {/* Текст поста */}
          <div className="p-4 text-sm text-gray-300 whitespace-pre-wrap">
            <p>Новое поступление кроссовок! 🔥</p>
            <p>Размеры: 41-45. Цена: 2500 руб.</p>
            {signature && (
              <p className="mt-4 text-admin-accent/90 border-l-2 border-admin-accent pl-3">{signature}</p>
            )}
          </div>

          {/* Фейковая картинка с водяным знаком */}
          <div className="relative flex-1 bg-gray-800 flex items-center justify-center min-h-[300px] overflow-hidden">
            <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1000" alt="Preview" className="w-full h-full object-cover opacity-60" />
            
            {/* Рендер водяного знака поверх картинки */}
            <div className={`absolute p-4 transition-all duration-300 ${
              settings.position.includes('t') ? 'top-0' : settings.position.includes('b') ? 'bottom-0' : 'top-1/2 -translate-y-1/2'
            } ${
              settings.position.includes('l') ? 'left-0' : settings.position.includes('r') ? 'right-0' : 'left-1/2 -translate-x-1/2'
            }`}>
              <div className={`
                ${settings.hasBackground ? 'px-4 py-2 rounded-lg backdrop-blur-md' : ''}
                ${settings.visualStyle === 'glass' ? 'bg-black/30 border border-white/20 shadow-xl' : ''}
                ${settings.visualStyle === 'solid' ? 'bg-[#000000] shadow-2xl' : ''}
                ${settings.visualStyle === 'minimal' ? 'bg-transparent text-shadow-md' : ''}
              `}
              style={{ opacity: settings.opacity / 100, transform: `rotate(${settings.angle}deg) scale(${settings.size / 100})`, color: settings.textColor }}
              >
                {settings.type === 'text' ? (
                  <span className={`font-bold whitespace-nowrap text-lg ${settings.fontFamily}`}>{settings.text || 'ВАШ ТЕКСТ'}</span>
                ) : (
                  <div className="flex items-center gap-2"><ImageIcon size={24} /> <span>Логотип</span></div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}