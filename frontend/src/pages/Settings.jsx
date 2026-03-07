import { useState } from 'react';
import { Users, Share2, Droplet, Settings as SettingsIcon } from 'lucide-react';

// Подключаем наши компоненты:
import WatermarkConstructor from '../components/settings/WatermarkConstructor';
import PartnersManager from '../components/settings/PartnersManager';
import AccountsManager from '../components/settings/AccountsManager';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('watermark');

  // Удобная функция для рендера кнопок меню
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
    <div className="max-w-[1600px] w-full mx-auto flex flex-col md:flex-row gap-6 p-4...">
      
      {/* Боковое меню */}
      <div className="w-full md:w-64 shrink-0">
        <h1 className="text-2xl font-bold mb-4 md:mb-6 hidden md:flex items-center gap-2">
          <SettingsIcon className="text-admin-accent" /> Настройки
        </h1>
        
        <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          <TabButton id="watermark" icon={Droplet} label="Водяной знак" />
          <TabButton id="partners" icon={Users} label="Мои партнеры" />
          <TabButton id="accounts" icon={Share2} label="Мои аккаунты" />
        </div>
      </div>

      {/* Рабочая область */}
      <div className="flex-1 min-w-0">
        
        {/* Вкладка 1: Водяной знак */}
        {activeTab === 'watermark' && <WatermarkConstructor />}

        {/* Вкладка 2: ПАРТНЕРЫ */}
        {activeTab === 'partners' && <PartnersManager />}

        {/* Вкладка 3: Аккаунты */}
        {activeTab === 'accounts' && <AccountsManager />}
      </div>
    </div>
  );
}