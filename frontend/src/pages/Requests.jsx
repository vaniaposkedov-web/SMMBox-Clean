import { useEffect } from 'react';
import { useStore } from '../store';
import { UserCheck, Trash2, Bell, Inbox } from 'lucide-react';

export default function Requests() {
  const user = useStore((state) => state.user);
  const incomingRequests = useStore((state) => state.incomingRequests);
  const notifications = useStore((state) => state.notifications);
  
  const fetchPartnerData = useStore((state) => state.fetchPartnerData);
  const acceptPartnership = useStore((state) => state.acceptPartnership);
  const clearNotifications = useStore((state) => state.clearNotifications);

  // При открытии страницы запрашиваем свежие данные с сервера
  useEffect(() => {
    if (user) fetchPartnerData(user.id);
  }, [user, fetchPartnerData]);

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-8 flex items-center gap-2 text-white">
        <Inbox className="text-admin-accent" /> Заявки и Уведомления
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* === ЛЕВАЯ КОЛОНКА: ВХОДЯЩИЕ ЗАЯВКИ === */}
        <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
            Входящие заявки
            {incomingRequests?.length > 0 && (
              <span className="bg-admin-accent text-white text-xs px-2 py-1 rounded-full">{incomingRequests.length}</span>
            )}
          </h2>

          <div className="space-y-4">
            {!incomingRequests || incomingRequests.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Новых заявок пока нет.</p>
            ) : (
              incomingRequests.map((req) => (
                <div key={req.id} className="bg-gray-900 border border-gray-800 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white">{req.requester.name}</h3>
                    <p className="text-sm text-gray-400">Павильон: <span className="text-admin-accent">{req.requester.pavilion}</span></p>
                  </div>
                  <button 
                    onClick={() => acceptPartnership(req.id)}
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-green-500/20"
                  >
                    <UserCheck size={16} /> Принять
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* === ПРАВАЯ КОЛОНКА: УВЕДОМЛЕНИЯ === */}
        <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Bell className="text-yellow-500" /> Уведомления
            </h2>
            {notifications?.length > 0 && (
              <button onClick={() => clearNotifications(user.id)} className="text-sm text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1">
                <Trash2 size={14} /> Очистить
              </button>
            )}
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-2">
            {!notifications || notifications.length === 0 ? (
              <p className="text-gray-500 text-center py-8">История уведомлений пуста.</p>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="bg-gray-900/50 border-l-2 border-yellow-500 p-4 rounded-r-xl">
                  <p className="text-sm text-gray-300">{notif.text}</p>
                  <span className="text-xs text-gray-600 mt-2 block">
                    {new Date(notif.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}