import { useState } from 'react';
import { Users, Share2, Droplet, Settings as SettingsIcon } from 'lucide-react';


import WatermarkConstructor from '../components/settings/WatermarkConstructor';
import PartnersManager from '../components/settings/PartnersManager';
import AccountsManager from '../components/settings/AccountsManager';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('watermark');

  
  const TabButton = ({ id, icon: Icon, label }) => {
    const isActive = activeTab === id;
    return (
      <button 
        onClick={() => setActiveTab(id)} 
        className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all font-bold whitespace-nowrap shrink-0 min-h-[44px] text-sm sm:text-base active:scale-95 ${
          isActive 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
            : 'bg-[#13151A] border border-[#1E2028] text-gray-400 hover:text-white hover:bg-[#1a1d24]'
        }`}
      >
        <Icon size={18} className="shrink-0" /> 
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <div className="w-full max-w-[98%] 2xl:max-w-[1800px] mx-auto flex flex-col md:flex-row gap-6 md:gap-8 px-4 md:px-8 pt-6 lg:pt-10 pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-12 translate-no font-sans" translate="no">
      
      
      <div className="w-full md:w-64 xl:w-72 shrink-0 flex flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 text-white">
            <SettingsIcon className="text-blue-500 shrink-0" size={28} /> 
            <span>Настройки</span>
          </h1>
          
          
          <div className="flex md:flex-col gap-2 sm:gap-3 overflow-x-auto hide-scrollbar pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
            <TabButton id="watermark" icon={Droplet} label="Шаблоны" />
            <TabButton id="accounts" icon={Share2} label="Мои соцсети" />
            <TabButton id="partners" icon={Users} label="Партнеры" />
          </div>
        </div>
      </div>

      
      <div className="flex-1 w-full min-w-0">
        <div className="animate-in fade-in duration-300">
          {activeTab === 'watermark' && <WatermarkConstructor />}
          {activeTab === 'partners' && <PartnersManager />}
          {activeTab === 'accounts' && <AccountsManager />}
        </div>
      </div>

    </div>
  );
}