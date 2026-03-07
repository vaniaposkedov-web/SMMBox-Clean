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
        className={`flex items-center gap-3 px-5 py-3 md:p-4 rounded-2xl transition-all font-bold whitespace-nowrap shrink-0 ${
          isActive 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
            : 'bg-[#13151A] border border-[#1E2028] text-gray-400 hover:text-white hover:bg-[#1a1d24]'
        }`}
      >
        <Icon size={18} /> {label}
      </button>
    );
  };

  return (
    <div className="w-full max-w-[98%] 2xl:max-w-[1800px] mx-auto flex flex-col md:flex-row gap-8 px-4 md:px-8 pt-6 lg:pt-10 pb-12 translate-no" translate="no">
      
      {/* === ЛЕВОЕ МЕНЮ === */}
      <div className="w-full md:w-64 xl:w-72 shrink-0 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-extrabold mb-6 hidden md:flex items-center gap-3 text-white">
            <SettingsIcon className="text-blue-500" size={28} /> Настройки
          </h1>
          
          <div className="flex md:flex-col gap-3 overflow-x-auto pb-2 md:pb-0 custom-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
            <TabButton id="watermark" icon={Droplet} label="Шаблоны" />
            <TabButton id="partners" icon={Users} label="Мои партнеры" />
            <TabButton id="accounts" icon={Share2} label="Мои аккаунты" />
          </div>
        </div>
      </div>

      {/* === РАБОЧАЯ ОБЛАСТЬ === */}
      <div className="flex-1 min-w-0">
        {activeTab === 'watermark' && <WatermarkConstructor />}
        {activeTab === 'partners' && <PartnersManager />}
        {activeTab === 'accounts' && <AccountsManager />}
      </div>
    </div>
  );
}