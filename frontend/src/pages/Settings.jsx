// frontend/src/pages/Settings.jsx
import { Settings as SettingsIcon, CreditCard, Droplet, Key } from 'lucide-react';
import { useStore } from '../store';

export default function Settings() {
  const user = useStore((state) => state.user);

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-8">Настройки проекта</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Профиль и Тариф */}
        <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 md:col-span-1">
          <div className="w-20 h-20 bg-admin-accent/20 text-admin-accent rounded-full flex items-center justify-center text-3xl font-bold mb-4 mx-auto uppercase">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <h2 className="text-xl font-bold text-center mb-1">{user?.name}</h2>
          <p className="text-gray-400 text-sm text-center mb-6">{user?.email}</p>
          
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
            <p className="text-gray-400 text-xs mb-1 uppercase font-bold tracking-wider">Текущий тариф</p>
            <p className="text-admin-accent font-bold text-lg mb-2">FREE (Пробный)</p>
            <button className="w-full bg-admin-accent text-white py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-600">
              <CreditCard size={16} /> Улучшить до PRO
            </button>
          </div>
        </div>

        {/* Настройки функционала */}
        <div className="md:col-span-2 space-y-4">
          
          <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 text-admin-accent rounded-xl">
                <Droplet size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg">Водяные знаки (Watermarks)</h3>
                <p className="text-gray-400 text-sm mt-1 max-w-sm">
                  Автоматически накладывать ваш логотип на все публикуемые изображения.
                </p>
              </div>
            </div>
            <button className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-medium whitespace-nowrap">
              Настроить
            </button>
          </div>

          <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                <Key size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg">API Ключи</h3>
                <p className="text-gray-400 text-sm mt-1 max-w-sm">
                  Подключение сторонних сервисов (OpenAI для генерации текстов, RSS-ленты).
                </p>
              </div>
            </div>
            <button className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-medium whitespace-nowrap">
              Добавить
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}