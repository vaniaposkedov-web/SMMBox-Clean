import { useState } from 'react';
import { Users, Share2, Droplet, Settings as SettingsIcon } from 'lucide-react';
import WatermarkConstructor from '../components/settings/WatermarkConstructor';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('watermark');

  // Удобная функция для рендера кнопок, чтобы не дублировать классы
  const TabButton = ({ id, icon: Icon, label }) => {
    const isActive = activeTab === id;
    return (
      <button 
        onClick={() => setActiveTab(id)} 
        className={`flex items-center gap-2 px-5 py-3 md:p-3 rounded-2xl transition-all font-medium whitespace-nowrap shrink-0 ${
          isActive 
            ? 'bg-admin-accent text-white shadow-lg shadow-blue-500/30' 
            : 'bg-admin-card border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
      >
        <Icon size={18} /> {label}
      </button>
    );
  };

  return (
    <div className="p-4 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 max-w-7xl mx-auto">
      
      {/* Боковое меню (на ПК) / Горизонтальный скролл (на телефонах) */}
      <div className="w-full md:w-64 shrink-0">
        <h1 className="text-2xl font-bold mb-4 md:mb-6 hidden md:flex items-center gap-2">
          <SettingsIcon className="text-admin-accent" /> Настройки
        </h1>
        
        {/* Адаптивный контейнер вкладок */}
        <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          <TabButton id="watermark" icon={Droplet} label="Водяной знак" />
          <TabButton id="partners" icon={Users} label="Мои партнеры" />
          <TabButton id="accounts" icon={Share2} label="Мои аккаунты" />
        </div>
      </div>

      {/* Рабочая область */}
      <div className="flex-1 min-w-0">
        {activeTab === 'watermark' && <WatermarkConstructor />}

        {activeTab === 'partners' && (
          <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 h-[400px] flex flex-col items-center justify-center text-gray-500 text-center">
            <Users size={64} className="mb-4 opacity-20" />
            <h2 className="text-xl font-bold text-white mb-2">Мои партнеры</h2>
            <p className="text-sm max-w-xs">Здесь будет система управления партнерским доступом к вашим проектам.</p>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 h-[400px] flex flex-col items-center justify-center text-gray-500 text-center">
            <Share2 size={64} className="mb-4 opacity-20" />
            <h2 className="text-xl font-bold text-white mb-2">Подключенные соцсети</h2>
            <p className="text-sm max-w-xs">Управление привязанными аккаунтами ВКонтакте и Telegram.</p>
          </div>
        )}
      </div>
    </div>
  );
}