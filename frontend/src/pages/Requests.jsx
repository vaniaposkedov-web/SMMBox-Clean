import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { UserCheck, Trash2, Bell, Inbox, X, UserMinus, Image as ImageIcon, Send } from 'lucide-react';

export default function Requests() {
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  
  // Данные
  const incomingRequests = useStore((state) => state.incomingRequests) || [];
  const notifications = useStore((state) => state.notifications) || [];
  const sharedIncoming = useStore((state) => state.sharedIncoming) || []; // <-- Новые посты от партнеров
  
  // Методы
  const fetchPartnerData = useStore((state) => state.fetchPartnerData);
  const fetchSharedPosts = useStore((state) => state.fetchSharedPosts);
  const deleteSharedPostAction = useStore((state) => state.deleteSharedPostAction);
  const saveTempDraft = useStore((state) => state.saveTempDraft);
  
  const acceptPartnership = useStore((state) => state.acceptPartnership);
  const declinePartnership = useStore((state) => state.declinePartnership);
  const clearNotifications = useStore((state) => state.clearNotifications);

  const [activeTab, setActiveTab] = useState('events'); // 'events' или 'posts'

  useEffect(() => {
    if (user?.id) {
      fetchPartnerData(user.id);
      fetchSharedPosts();
    }
  }, [user?.id, fetchPartnerData, fetchSharedPosts]);

  // Магия превращения Base64 от партнера обратно в Файл для нашего редактора
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
      
      const reconstructedPhotos = mediaUrls.map((base64, i) => ({
          id: `shared_${Math.random().toString(36).substr(2, 9)}`,
          file: dataURLtoFile(base64, `photo_${i}.jpg`),
          url: base64 // Используем сам base64 для превью
      }));

      // Передаем данные в редактор, принудительно ставим Шаг 1
      saveTempDraft({ 
        text: post.text || '', 
        photos: reconstructedPhotos,
        step: 1, 
        view: 'wizard', 
        publishMode: 'now' 
      });
      navigate('/publish');
  };

  return (
    <div className="w-full p-4 md:p-8 translate-no" translate="no">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold flex items-center gap-3 text-white">
          <Inbox className="text-blue-500" size={32} /> Заявки и Уведомления
        </h1>
        <p className="text-gray-400 mt-2 text-sm max-w-2xl leading-relaxed">
          Управляйте приглашениями, просматривайте историю событий и забирайте посты от партнеров.
        </p>
      </div>

      {/* ВКЛАДКИ */}
      <div className="flex bg-gray-900 border border-gray-800 p-1 rounded-2xl w-full max-w-md mb-8">
        <button 
          onClick={() => setActiveTab('events')} 
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'events' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
        >
          События
        </button>
        <button 
          onClick={() => setActiveTab('posts')} 
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'posts' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Входящие посты
          {sharedIncoming.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{sharedIncoming.length}</span>}
        </button>
      </div>

      {/* === РАЗДЕЛ "СОБЫТИЯ" (Старый интерфейс) === */}
      {activeTab === 'events' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
          {/* ЛЕВАЯ КОЛОНКА: ЗАЯВКИ В ПАРТНЕРЫ */}
          <div className="lg:col-span-7 bg-[#13151A] border border-[#1E2028] rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col min-h-[400px]">
            <h2 className="text-lg font-bold mb-6 text-white flex items-center gap-3 border-b border-[#1f222a] pb-4">
              Новые заявки
              {incomingRequests.length > 0 && <span className="bg-blue-600 text-white text-[11px] px-2.5 py-0.5 rounded-full">{incomingRequests.length}</span>}
            </h2>

            <div className="space-y-4 flex-1">
              {incomingRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 py-12">
                  <Inbox size={48} className="opacity-20" />
                  <p className="text-[15px]">Входящих заявок пока нет.</p>
                </div>
              ) : (
                incomingRequests.map((req) => (
                  <div key={req.id} className="bg-[#0f1115] border border-blue-500/20 p-5 rounded-2xl flex flex-col sm:flex-row justify-between gap-5 transition-all">
                    <div>
                      <h3 className="font-bold text-white text-lg">{req.requester.name || 'Без имени'}</h3>
                      <p className="text-sm text-gray-400 mt-1">Павильон: <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded ml-1">{req.requester.pavilion || '?'}</span></p>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                      <button onClick={() => declinePartnership(req.id)} className="flex-1 sm:flex-none w-12 h-12 flex items-center justify-center bg-[#1a1d24] hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition-all"><X size={20} /></button>
                      <button onClick={() => acceptPartnership(req.id)} className="flex-1 sm:flex-none px-6 h-12 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold"><UserCheck size={18} /> Принять</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА: УВЕДОМЛЕНИЯ */}
          <div className="lg:col-span-5 bg-[#13151A] border border-[#1E2028] rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-6 border-b border-[#1f222a] pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Bell className="text-blue-400" size={20} /> История событий</h2>
              {notifications.length > 0 && (
                <button onClick={() => clearNotifications(user.id)} className="text-[11px] font-bold text-gray-500 hover:text-white bg-[#1a1d24] px-3 py-1.5 rounded-lg border border-[#2a2d36]"><Trash2 size={14} /> Очистить</button>
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
                  <div key={notif.id} className="bg-[#0f1115] border border-[#1f222a] p-4 rounded-2xl flex gap-4 items-start">
                    <div className="p-2 bg-[#1a1d24] rounded-lg mt-0.5">
                      {notif.text.includes('прекратил') ? <UserMinus size={16} className="text-red-400"/> : <Bell size={16} className="text-blue-400"/>}
                    </div>
                    <div>
                      <p className="text-[14px] text-gray-300 leading-relaxed">{notif.text}</p>
                      <span className="text-[11px] text-gray-500 mt-2 block">{new Date(notif.createdAt).toLocaleString('ru-RU')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* === РАЗДЕЛ "ВХОДЯЩИЕ ПОСТЫ" === */}
      {activeTab === 'posts' && (
        <div className="bg-[#13151A] border border-[#1E2028] rounded-3xl p-6 sm:p-8 shadow-xl animate-fade-in">
          <h2 className="text-lg font-bold mb-6 text-white flex items-center gap-3 border-b border-[#1f222a] pb-4">
            <ImageIcon className="text-blue-500" size={20}/> Посты от ваших партнеров
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {sharedIncoming.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center text-gray-500 py-16">
                <Inbox size={48} className="opacity-20 mb-4" />
                <p>Партнеры пока ничего вам не присылали.</p>
              </div>
            ) : (
              sharedIncoming.map((post) => {
                const mediaArr = JSON.parse(post.mediaUrls || '[]');
                const previewImg = mediaArr.length > 0 ? mediaArr[0] : null;

                return (
                  <div key={post.id} className="bg-[#0f1115] border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all flex flex-col">
                    {/* Шапка с инфой отправителя */}
                    <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center font-bold text-gray-400 text-xs border border-gray-700">
                           {post.sender.avatarUrl ? <img src={post.sender.avatarUrl} className="w-full h-full rounded-full object-cover"/> : post.sender.name.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-bold">{post.sender.name}</p>
                          <p className="text-gray-500 text-[10px]">Павильон: {post.sender.pavilion || '?'}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>

                    {/* Контент поста */}
                    <div className="flex-1 p-4">
                      {previewImg && (
                        <div className="relative aspect-video bg-gray-900 rounded-xl mb-3 overflow-hidden border border-gray-800">
                           <img src={previewImg} className="w-full h-full object-cover" />
                           {mediaArr.length > 1 && (
                             <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded-lg font-bold">
                               +{mediaArr.length - 1} фото
                             </div>
                           )}
                        </div>
                      )}
                      <p className="text-sm text-gray-300 line-clamp-3 leading-relaxed">{post.text || 'Без текста'}</p>
                    </div>

                    {/* Кнопки действий */}
                    <div className="p-3 bg-gray-900/50 border-t border-gray-800 flex gap-2">
                       <button 
                         onClick={() => deleteSharedPostAction(post.id)}
                         className="px-3 h-10 bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition-colors border border-gray-700"
                         title="Удалить"
                       >
                         <Trash2 size={16}/>
                       </button>
                       <button 
                         onClick={() => handleUseSharedPost(post)}
                         className="flex-1 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                       >
                         <Send size={16} /> Опубликовать у себя
                       </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
}