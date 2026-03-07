import { useEffect } from 'react';
import { useStore } from '../store';
import { UserCheck, Trash2, Bell, Inbox, X, UserMinus } from 'lucide-react';

export default function Requests() {
  const user = useStore((state) => state.user);
  
  // Данные
  const incomingRequests = useStore((state) => state.incomingRequests) || [];
  const notifications = useStore((state) => state.notifications) || [];
  
  // Методы
  const fetchPartnerData = useStore((state) => state.fetchPartnerData);
  const acceptPartnership = useStore((state) => state.acceptPartnership);
  const declinePartnership = useStore((state) => state.declinePartnership);
  const clearNotifications = useStore((state) => state.clearNotifications);

  const sharedIncoming = useStore((state) => state.sharedIncoming) || [];
  const deleteSharedPostAction = useStore((state) => state.deleteSharedPostAction);
  const saveTempDraft = useStore((state) => state.saveTempDraft);
  const navigate = useNavigate();

  // Функция превращения сырого Base64 обратно в объект File для Publish.jsx
  const dataURLtoFile = (dataurl, filename) => {
      const arr = dataurl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]); 
      let n = bstr.length; 
      const u8arr = new Uint8Array(n);
      while(n--){ u8arr[n] = bstr.charCodeAt(n); }
      return new File([u8arr], filename, {type:mime});
  };

  const handleUseSharedPost = (post) => {
      const mediaUrls = JSON.parse(post.mediaUrls || '[]');
      
      // Создаем фейковые объекты, которые понимает Publish.jsx
      const reconstructedPhotos = mediaUrls.map((base64, i) => ({
          id: `shared_${i}`,
          file: dataURLtoFile(base64, `photo_${i}.jpg`),
          preview: base64
      }));

      // Сохраняем в память и перекидываем в редактор
      saveTempDraft({ text: post.text || '', photos: reconstructedPhotos });
      navigate('/publish');
  };

  useEffect(() => {
    if (user?.id) fetchPartnerData(user.id);
  }, [user?.id, fetchPartnerData]);

  return (
    <div className="w-full p-4 md:p-8 translate-no" translate="no">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold flex items-center gap-3 text-white">
          <Inbox className="text-blue-500" size={32} /> Заявки и Уведомления
        </h1>
        <p className="text-gray-400 mt-2 text-sm max-w-2xl leading-relaxed">
          Управляйте приглашениями от других поставщиков и просматривайте историю системных событий.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* === ЛЕВАЯ КОЛОНКА: ВХОДЯЩИЕ ЗАЯВКИ === */}
        <div className="lg:col-span-7 bg-[#13151A] border border-[#1E2028] rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col min-h-[400px]">
          <h2 className="text-lg font-bold mb-6 text-white flex items-center gap-3 border-b border-[#1f222a] pb-4">
            Новые заявки
            {incomingRequests.length > 0 && (
              <span className="bg-blue-600 text-white text-[11px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">{incomingRequests.length}</span>
            )}
          </h2>

          <div className="space-y-4 flex-1">
            {incomingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 py-12">
                <Inbox size={48} className="opacity-20" />
                <p className="text-[15px]">Входящих заявок пока нет.</p>
              </div>
            ) : (
              incomingRequests.map((req) => (
                <div key={req.id} className="bg-[#0f1115] border border-blue-500/20 p-5 rounded-2xl flex flex-col sm:flex-row justify-between gap-5 transition-all shadow-[0_0_15px_rgba(37,99,235,0.05)]">
                  <div>
                    <h3 className="font-bold text-white text-lg">{req.requester.name || 'Без имени'}</h3>
                    <p className="text-sm text-gray-400 mt-1">Павильон: <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded ml-1 uppercase tracking-wider">{req.requester.pavilion || '?'}</span></p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button 
                      onClick={() => declinePartnership(req.id)}
                      className="flex-1 sm:flex-none w-12 h-12 flex items-center justify-center bg-[#1a1d24] hover:bg-red-500/20 border border-[#2a2d36] hover:border-red-500/30 text-gray-400 hover:text-red-400 rounded-xl transition-all shadow-sm"
                      title="Отклонить"
                    >
                      <X size={20} />
                    </button>
                    <button 
                      onClick={() => acceptPartnership(req.id)}
                      className="flex-1 sm:flex-none px-6 h-12 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all"
                    >
                      <UserCheck size={18} /> Принять
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* === ПРАВАЯ КОЛОНКА: УВЕДОМЛЕНИЯ === */}
        <div className="lg:col-span-5 bg-[#13151A] border border-[#1E2028] rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col lg:sticky lg:top-8 min-h-[400px]">
          <div className="flex justify-between items-center mb-6 border-b border-[#1f222a] pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Bell className="text-blue-400" size={20} /> История событий
            </h2>
            {notifications.length > 0 && (
              <button onClick={() => clearNotifications(user.id)} className="text-[11px] font-bold uppercase tracking-wider text-gray-500 hover:text-white transition-colors flex items-center gap-1.5 bg-[#1a1d24] px-3 py-1.5 rounded-lg border border-[#2a2d36]">
                <Trash2 size={14} /> Очистить
              </button>
            )}
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar pr-2">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 py-12">
                <Bell size={48} className="opacity-20" />
                <p className="text-[15px]">Уведомлений нет.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="bg-[#0f1115] border border-[#1f222a] p-4 rounded-2xl shadow-inner flex gap-4 items-start group hover:border-gray-700 transition-colors">
                  <div className="p-2 bg-[#1a1d24] rounded-lg shrink-0 mt-0.5 group-hover:bg-blue-500/10 transition-colors">
                    {/* Если в тексте есть слово "прекратил", показываем иконку разрыва, иначе обычный колокольчик */}
                    {notif.text.includes('прекратил') ? <UserMinus size={16} className="text-red-400"/> : <Bell size={16} className="text-blue-400"/>}
                  </div>
                  <div>
                    <p className="text-[14px] text-gray-300 leading-relaxed">{notif.text}</p>
                    <span className="text-[11px] text-gray-500 mt-2 block font-medium">
                      {new Date(notif.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}