import { Settings as SettingsIcon, Share2, Droplet } from 'lucide-react';


export default function Settings() {
  return (
    <div className="w-full max-w-[98%] 2xl:max-w-[1800px] mx-auto flex flex-col gap-10 px-4 md:px-8 pt-6 lg:pt-10 pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-12 translate-no font-sans" translate="no">
      
      {/* Главный заголовок страницы */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-2 flex items-center gap-2 sm:gap-3 text-white">
          <SettingsIcon className="text-[#0077FF] shrink-0" size={28} /> 
          <span>Настройки</span>
        </h1>
        <p className="text-gray-400 text-sm sm:text-base">Управление вашими аккаунтами и шаблонами постов.</p>
      </div>


    </div>
  );
}