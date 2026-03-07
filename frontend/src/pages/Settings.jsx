import { useState, useEffect } from 'react';
import { Users, Share2, Droplet, Settings as SettingsIcon, Bell } from 'lucide-react';
import { useStore } from '../store';

// Подключаем наши компоненты:
import WatermarkConstructor from '../components/settings/WatermarkConstructor';
import PartnersManager from '../components/settings/PartnersManager';
import AccountsManager from '../components/settings/AccountsManager';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('watermark');
  
  // Достаем данные пользователя и уведомления из хранилища
  const user = useStore((state) => state.user);
  const notifications = useStore((state) => state.notifications) || [];
  const clearNotifications = useStore((state) => state.clearNotifications);
  const fetchPartnerData = useStore((state) => state.fetchPartnerData);

  // Запрашиваем уведомления при входе на страницу настроек
  useEffect(() => {
    if (user?.id) {
      fetchPartnerData(user.id);
    }
  }, [user?.id, fetchPartnerData]);

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
        
        {/* Блок с кнопками вкладок */}
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

        {/* БЛОК УВЕДОМЛЕНИЙ */}
        <div className="bg-[#13151A] border border-[#1E2028] rounded-2xl p-5 shadow-xl flex flex-col mt-2 md:mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[13px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Bell size={16} /> Уведомления 
              {notifications.length > 0 && <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] animate-pulse">{notifications.length}</span>}
            </h3>
            {notifications.length > 0 && (
              <button onClick={() => clearNotifications(user.id)} className="text-[11px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-wider">Очистить</button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-gray-600 italic text-center py-6 border border-dashed border-[#1f222a] rounded-xl">Нет новых уведомлений</p>
          ) : (
            <div className="space-y-3 max-h-[250px] md:max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
              {notifications.map(note => (
                <div key={note.id} className="bg-[#0f1115] border border-[#1f222a] p-3.5 rounded-xl text-[13px] text-gray-300 leading-relaxed shadow-inner flex gap-3 items-start">
                  <div className="p-1.5 bg-blue-500/10 rounded-md shrink-0 mt-0.5"><Bell size={14} className="text-blue-400"/></div>
                  <span>{note.text}</span>
                </div>
              ))}
            </div>
          )}
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