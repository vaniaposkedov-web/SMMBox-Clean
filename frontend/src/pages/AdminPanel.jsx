// frontend/src/pages/AdminPanel.jsx
import { Shield, Users, Layers, Activity } from 'lucide-react';
import { useStore } from '../store';

export default function AdminPanel() {
  // Достаем все глобальные данные из нашей "базы" (Zustand)
  const allUsers = useStore((state) => state.registeredUsers) || [];
  const allAccounts = useStore((state) => state.accounts) || [];
  const allPosts = useStore((state) => state.posts) || [];

  return (
    <div className="p-4 md:p-8">
      
      {/* Шапка админки */}
      <div className="flex items-center gap-3 mb-8 text-red-400">
        <Shield size={32} />
        <div>
          <h1 className="text-2xl font-bold text-white">Панель администратора</h1>
          <p className="text-sm">Глобальная статистика платформы SMMBOX</p>
        </div>
      </div>

      {/* Карточки со статистикой платформы */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 text-gray-800/50">
            <Users size={100} />
          </div>
          <p className="text-gray-400 text-sm font-medium mb-1 relative z-10">Всего пользователей</p>
          <p className="text-4xl font-bold text-white relative z-10">{allUsers.length}</p>
        </div>

        <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 text-gray-800/50">
            <Layers size={100} />
          </div>
          <p className="text-gray-400 text-sm font-medium mb-1 relative z-10">Подключено соцсетей</p>
          <p className="text-4xl font-bold text-white relative z-10">{allAccounts.length}</p>
        </div>

        <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 text-gray-800/50">
            <Activity size={100} />
          </div>
          <p className="text-gray-400 text-sm font-medium mb-1 relative z-10">Постов в системе</p>
          <p className="text-4xl font-bold text-white relative z-10">{allPosts.length}</p>
        </div>
      </div>

      {/* Таблица зарегистрированных пользователей */}
      <div className="bg-admin-card border border-gray-800 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-lg font-bold">База пользователей</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-900/50 text-xs uppercase font-medium text-gray-500">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Имя</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Аккаунтов</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    Пока нет зарегистрированных пользователей
                  </td>
                </tr>
              ) : (
                allUsers.map((user) => {
                  // Считаем, сколько аккаунтов привязал конкретный юзер
                  const userAccs = allAccounts.filter(acc => acc.userId === user.id).length;
                  return (
                    <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">{user.id}</td>
                      <td className="px-6 py-4 font-bold text-white">{user.name}</td>
                      <td className="px-6 py-4">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-500/10 text-admin-accent py-1 px-3 rounded-full text-xs font-bold">
                          {userAccs}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}