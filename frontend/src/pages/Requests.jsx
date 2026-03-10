import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { UserCheck, Trash2, Bell, Inbox, X, UserMinus, Image as ImageIcon, Send } from 'lucide-react';

export default function Requests() {
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  
  
  const incomingRequests = useStore((state) => state.incomingRequests) || [];
  const notifications = useStore((state) => state.notifications) || [];
  const sharedIncoming = useStore((state) => state.sharedIncoming) || []; 
  
 
  const fetchPartnerData = useStore((state) => state.fetchPartnerData);
  const fetchSharedPosts = useStore((state) => state.fetchSharedPosts);
  const deleteSharedPostAction = useStore((state) => state.deleteSharedPostAction);
  const saveTempDraft = useStore((state) => state.saveTempDraft);
  
  const acceptPartnership = useStore((state) => state.acceptPartnership);
  const declinePartnership = useStore((state) => state.declinePartnership);
  const clearNotifications = useStore((state) => state.clearNotifications);

  const [activeTab, setActiveTab] = useState('events'); 

  useEffect(() => {
    if (user?.id) {
      fetchPartnerData(user.id);
      fetchSharedPosts();
    }
  }, [user?.id, fetchPartnerData, fetchSharedPosts]);

  
  const dataURLtoFile = (dataurl, filename) => {
      try {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]); 
        let n = bstr.length; 
        const u8arr = new Uint8Array(n);
        while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        return new File([u8arr], filename, {type:mime});
      } catch (e) {
        console.error('Ошибка конвертации изображения', e);
        return null;
      }
  };

  const handleUseSharedPost = (post) => {
      let mediaUrls = [];
      try {
        mediaUrls = JSON.parse(post.mediaUrls || '[]');
      } catch(e) {
        mediaUrls = [];
      }
      
      const reconstructedPhotos = mediaUrls.map((base64, i) => {
          const file = dataURLtoFile(base64, `photo_${i}.jpg`);
          if (!file) return null;
          return {
            id: `shared_${Math.random().toString(36).substr(2, 9)}`,
            file: file,
            url: base64 
          };
      }).filter(Boolean); 

     
      if (saveTempDraft) {
        saveTempDraft({ 
          text: post.text || '', 
          photos: reconstructedPhotos,
          step: 1, 
          view: 'wizard', 
          publishMode: 'now' 
        });
      }
      navigate('/publish');
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-6 lg:pt-10 pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-12 translate-no font-sans" translate="no">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2 sm:gap-3 text-white leading-tight">
          <Inbox className="text-blue-500 shrink-0" size={28} /> <span>Заявки и Уведомления</span>
        </h1>
        <p className="text-gray-400 mt-2 text-xs sm:text-sm max-w-2xl leading-relaxed">
          Управляйте приглашениями, просматривайте историю событий и забирайте посты от партнеров.
        </p>
      </div>

      {/* ВКЛАДКИ (Адаптивные) */}
      <div className="flex bg-gray-900 border border-gray-800 p-1 rounded-2xl w-full max-w-md mb-6 sm:mb-8">
        <button 
          onClick={() => setActiveTab('events')} 
          className={`flex-1 py-3 sm:py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all min-h-[44px] ${activeTab === 'events' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
        >
          События
        </button>
        <button 
          onClick={() => setActiveTab('posts')} 
          className={`flex-1 py-3 sm:py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] ${activeTab === 'posts' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Входящие посты
          {sharedIncoming.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{sharedIncoming.length}</span>}
        </button>
      </div>

      {/* === РАЗДЕЛ "СОБЫТИЯ" === */}
      {activeTab === 'events' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start animate-fade-in">
          
          {/* ЛЕВАЯ КОЛОНКА: ЗАЯВКИ В ПАРТНЕРЫ */}
          <div className="xl:col-span-7 bg-[#13151A] border border-[#1E2028] rounded-3xl p-5 sm:p-8 shadow-xl flex flex-col min-h-[300px] sm:min-h-[400px]">
            <h2 className="text-base sm:text-lg font-bold mb-4 sm:mb-6 text-white flex items-center gap-3 border-b border-[#1f222a] pb-4">
              Новые заявки
              {incomingRequests.length > 0 && <span className="bg-blue-600 text-white text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 rounded-full">{incomingRequests.length}</span>}
            </h2>

            <div className="space-y-4 flex-1">
              {incomingRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-3 py-10 sm:py-12">
                  <Inbox size={40} className="opacity-20 sm:w-12 sm:h-12" />
                  <p className="text-sm sm:text-[15px] text-center px-4">Входящих заявок пока нет.</p>
                </div>
              ) : (
                incomingRequests.map((req) => (
                  <div key={req.id} className="bg-[#0f1115] border border-blue-500/20 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row justify-between gap-4 sm:gap-5 transition-all hover:border-blue-500/40">
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-base sm:text-lg truncate">{req.requester?.name || 'Без имени'}</h3>
                      <p className="text-xs sm:text-sm text-gray-400 mt-1 truncate">
                        Павильон: <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded ml-1">{req.requester?.pavilion || '?'}</span>
                      </p>
                    </div>
                    <div className="flex gap-2 sm:gap-3 w-full sm:w-auto shrink-0">
                      <button 
                        onClick={() => declinePartnership(req.id)} 
                        className="flex-1 sm:flex-none w-12 sm:w-12 h-12 min-h-[48px] flex items-center justify-center bg-[#1a1d24] hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition-all"
                        aria-label="Отклонить"
                      >
                        <X size={20} />
                      </button>
                      <button 
                        onClick={() => acceptPartnership(req.id)} 
                        className="flex-[3] sm:flex-none px-4 sm:px-6 h-12 min-h-[48px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                      >
                        <UserCheck size={18} /> <span className="sm:inline">Принять</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА: УВЕДОМЛЕНИЯ */}
          <div className="xl:col-span-5 bg-[#13151A] border border-[#1E2028] rounded-3xl p-5 sm:p-8 shadow-xl flex flex-col min-h-[300px] sm:min-h-[400px]">
            <div className="flex justify-between items-center mb-4 sm:mb-6 border-b border-[#1f222a] pb-4">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Bell className="text-blue-400 shrink-0" size={18} /> <span>История событий</span>
              </h2>
              {notifications.length > 0 && (
                <button 
                  onClick={() => clearNotifications(user.id)} 
                  className="text-[10px] sm:text-[11px] font-bold text-gray-500 hover:text-white bg-[#1a1d24] px-3 py-2 sm:py-1.5 rounded-lg border border-[#2a2d36] transition-colors flex items-center gap-1.5 min-h-[36px]"
                >
                  <Trash2 size={14} /> <span className="hidden sm:inline">Очистить</span>
                </button>
              )}
            </div>
            
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] sm:max-h-[500px] custom-scrollbar pr-1 sm:pr-2">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-3 py-10 sm:py-12">
                  <Bell size={40} className="opacity-20 sm:w-12 sm:h-12" />
                  <p className="text-sm sm:text-[15px] text-center px-4">Уведомлений нет.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div key={notif.id} className="bg-[#0f1115] border border-[#1f222a] p-3 sm:p-4 rounded-2xl flex gap-3 sm:gap-4 items-start">
                    <div className="p-2 bg-[#1a1d24] rounded-lg mt-0.5 shrink-0">
                      {notif.text?.includes('прекратил') ? <UserMinus size={14} className="text-red-400 sm:w-4 sm:h-4"/> : <Bell size={14} className="text-blue-400 sm:w-4 sm:h-4"/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-[14px] text-gray-300 leading-relaxed break-words">{notif.text}</p>
                      <span className="text-[10px] sm:text-[11px] text-gray-500 mt-1.5 sm:mt-2 block">
                        {notif.createdAt ? new Date(notif.createdAt).toLocaleString('ru-RU') : ''}
                      </span>
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
        <div className="bg-[#13151A] border border-[#1E2028] rounded-3xl p-5 sm:p-8 shadow-xl animate-fade-in">
          <h2 className="text-base sm:text-lg font-bold mb-4 sm:mb-6 text-white flex items-center gap-2 sm:gap-3 border-b border-[#1f222a] pb-4">
            <ImageIcon className="text-blue-500 shrink-0" size={20}/> <span>Посты от ваших партнеров</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {sharedIncoming.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center text-gray-500 py-12 sm:py-16">
                <Inbox size={40} className="opacity-20 mb-3 sm:w-12 sm:h-12" />
                <p className="text-sm sm:text-base text-center px-4">Партнеры пока ничего вам не присылали.</p>
              </div>
            ) : (
              sharedIncoming.map((post) => {
                let mediaArr = [];
                try {
                  mediaArr = JSON.parse(post.mediaUrls || '[]');
                } catch(e) {}
                const previewImg = mediaArr.length > 0 ? mediaArr[0] : null;

                return (
                  <div key={post.id} className="bg-[#0f1115] border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all flex flex-col">
                    
                    {/* Шапка с инфой отправителя */}
                    <div className="p-3 sm:p-4 border-b border-gray-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-2">
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center font-bold text-gray-400 text-[10px] sm:text-xs border border-gray-700 shrink-0 overflow-hidden">
                           {post.sender?.avatarUrl ? <img src={post.sender.avatarUrl} className="w-full h-full object-cover"/> : post.sender?.name?.substring(0,2).toUpperCase() || '??'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-xs sm:text-sm font-bold truncate">{post.sender?.name || 'Неизвестный'}</p>
                          <p className="text-gray-500 text-[9px] sm:text-[10px] truncate">Павильон: {post.sender?.pavilion || '?'}</p>
                        </div>
                      </div>
                      <span className="text-[10px] sm:text-xs text-gray-500 shrink-0">
                        {post.createdAt ? new Date(post.createdAt).toLocaleDateString('ru-RU') : ''}
                      </span>
                    </div>

                    {/* Контент поста */}
                    <div className="flex-1 p-3 sm:p-4">
                      {previewImg && (
                        <div className="relative aspect-video bg-gray-900 rounded-xl mb-3 overflow-hidden border border-gray-800">
                           <img src={previewImg} className="w-full h-full object-cover" alt="Preview" />
                           {mediaArr.length > 1 && (
                             <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[9px] sm:text-[10px] px-2 py-1 rounded-lg font-bold backdrop-blur-sm shadow-sm">
                               +{mediaArr.length - 1} фото
                             </div>
                           )}
                        </div>
                      )}
                      <p className="text-xs sm:text-sm text-gray-300 line-clamp-3 leading-relaxed break-words">
                        {post.text || <span className="italic text-gray-500">Без текста</span>}
                      </p>
                    </div>

                    {/* Кнопки действий */}
                    <div className="p-3 sm:p-4 bg-gray-900/50 border-t border-gray-800 flex gap-2">
                       <button 
                         onClick={() => deleteSharedPostAction(post.id)}
                         className="w-12 sm:w-auto sm:px-4 min-h-[48px] bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition-colors border border-gray-700 flex items-center justify-center shrink-0 active:scale-95"
                         title="Удалить"
                       >
                         <Trash2 size={18}/>
                       </button>
                       <button 
                         onClick={() => handleUseSharedPost(post)}
                         className="flex-1 min-h-[48px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95 text-xs sm:text-sm"
                       >
                         <Send size={16} /> 
                         <span className="hidden sm:inline">Опубликовать у себя</span>
                         <span className="sm:hidden">Опубликовать</span>
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