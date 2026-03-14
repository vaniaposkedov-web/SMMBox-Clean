import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, Bell, Inbox, X, Send, 
  CheckCircle2, AlertTriangle, XCircle, Info, Image as ImageIcon 
} from 'lucide-react';

export default function Requests() {
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  
  const notifications = useStore((state) => state.notifications) || [];
  const sharedIncoming = useStore((state) => state.sharedIncoming) || []; 
  
  const fetchPartnerData = useStore((state) => state.fetchPartnerData);
  const fetchSharedPosts = useStore((state) => state.fetchSharedPosts);
  const deleteSharedPostAction = useStore((state) => state.deleteSharedPostAction);
  const saveTempDraft = useStore((state) => state.saveTempDraft);
  const clearNotifications = useStore((state) => state.clearNotifications);

  const [activeTab, setActiveTab] = useState('notifications'); 
  const [previewModal, setPreviewModal] = useState({ isOpen: false, data: null });

  useEffect(() => {
    if (user?.id) {
      fetchPartnerData(user.id);
      fetchSharedPosts();
    }
  }, [user?.id, fetchPartnerData, fetchSharedPosts]);

  const handleUseSharedPost = (post) => {
    saveTempDraft({ text: post.text, photos: JSON.parse(post.mediaUrls || '[]') });
    // В идеале здесь мы дергаем API чтобы отметить post.isPublished = true
    navigate('/publish');
  };

  const openPreview = (metadataJson) => {
    if (!metadataJson) return;
    try {
      const data = JSON.parse(metadataJson);
      if (data.text || (data.mediaUrls && data.mediaUrls.length > 0)) {
        setPreviewModal({ isOpen: true, data });
      }
    } catch (e) {}
  };

  // Функция для определения цвета и иконки уведомления
  const getNotificationStyle = (type) => {
    switch(type) {
      case 'SUCCESS': return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: <CheckCircle2 className="text-emerald-500 shrink-0" size={20} /> };
      case 'WARNING': return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: <AlertTriangle className="text-yellow-500 shrink-0" size={20} /> };
      case 'ERROR': return { bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: <XCircle className="text-rose-500 shrink-0" size={20} /> };
      default: return { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Info className="text-blue-500 shrink-0" size={20} /> };
    }
  };

  return (
    <div className="w-full animate-fade-in font-sans pb-20 sm:pb-0">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Bell className="text-blue-500" size={24} /> Уведомления и Посты
        </h2>
        <p className="text-xs sm:text-sm text-gray-400">Следите за активностью партнеров и входящим контентом.</p>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 sm:mb-8 pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
        <button 
          onClick={() => setActiveTab('notifications')} 
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all min-h-[44px] shrink-0 ${activeTab === 'notifications' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
          Уведомления
          {notifications.length > 0 && <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'notifications' ? 'bg-white/20' : 'bg-gray-800'}`}>{notifications.length}</span>}
        </button>
        <button 
          onClick={() => setActiveTab('shared')} 
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all min-h-[44px] shrink-0 ${activeTab === 'shared' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
          <Inbox size={16} /> Присланные посты
          {sharedIncoming.length > 0 && <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'shared' ? 'bg-white/20' : 'bg-gray-800'}`}>{sharedIncoming.length}</span>}
        </button>
      </div>

      <div className="bg-admin-card border border-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl min-h-[50vh]">
        
        {/* === ВКЛАДКА: УВЕДОМЛЕНИЯ === */}
        {activeTab === 'notifications' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {notifications.length > 0 && (
              <div className="flex justify-end mb-4">
                <button onClick={() => clearNotifications(user.id)} className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors bg-gray-800/50 hover:bg-gray-800 px-4 py-2 rounded-lg flex items-center gap-2">
                  <Trash2 size={14} /> Очистить все
                </button>
              </div>
            )}
            
            {notifications.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <Bell size={40} className="mx-auto mb-4 opacity-20" />
                <p>У вас нет новых уведомлений.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const style = getNotificationStyle(notif.type);
                return (
                  <div key={notif.id} className={`${style.bg} border ${style.border} p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all`}>
                    <div className="flex items-start gap-3 w-full">
                      <div className="mt-0.5">{style.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base text-gray-200 leading-snug">{notif.text}</p>
                        <span className="text-[10px] sm:text-xs text-gray-500 mt-2 block font-medium uppercase tracking-wider">
                          {new Date(notif.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' })}
                        </span>
                      </div>
                    </div>
                    {notif.metadata && (
                      <button 
                        onClick={() => openPreview(notif.metadata)}
                        className="w-full sm:w-auto shrink-0 bg-black/40 hover:bg-black/60 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-white/5 flex items-center justify-center gap-2 active:scale-95"
                      >
                        <ImageIcon size={16} /> Посмотреть
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* === ВКЛАДКА: ПРИСЛАННЫЕ ПОСТЫ === */}
        {activeTab === 'shared' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {sharedIncoming.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <Inbox size={40} className="mx-auto mb-4 opacity-20" />
                <p>Пока никто не делился с вами постами.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sharedIncoming.map((post) => {
                  const media = JSON.parse(post.mediaUrls || '[]');
                  return (
                    <div key={post.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col shadow-lg transition-transform hover:-translate-y-1 hover:border-gray-700">
                      
                      {/* Шапка карточки */}
                      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold shrink-0 border border-blue-500/30 overflow-hidden">
                            {post.sender?.avatarUrl ? <img src={post.sender.avatarUrl} className="w-full h-full object-cover"/> : post.sender?.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{post.sender?.name || 'Партнер'}</p>
                            <p className="text-[10px] text-gray-500 truncate">{new Date(post.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>

                      {/* Превью картинок */}
                      <div className="relative h-40 bg-gray-950 flex items-center justify-center overflow-hidden border-b border-gray-800">
                        {media.length > 0 ? (
                          <>
                            <img src={media[0]} className="w-full h-full object-cover opacity-80" alt="Превью" />
                            {media.length > 1 && (
                              <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold text-white border border-white/10 flex items-center gap-1.5">
                                <ImageIcon size={12}/> +{media.length - 1}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-600 text-xs uppercase tracking-widest font-bold">Только текст</span>
                        )}
                      </div>

                      {/* Текст поста */}
                      <div className="p-4 flex-1 bg-gray-900">
                        <p className="text-sm text-gray-300 line-clamp-3">
                          {post.text || <span className="text-gray-600 italic">Без текста</span>}
                        </p>
                      </div>

                      {/* Кнопки действий */}
                      <div className="p-3 bg-black/20 border-t border-gray-800 flex gap-2">
                         <button 
                           onClick={() => deleteSharedPostAction(post.id)}
                           className="w-12 h-11 bg-gray-800 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded-xl transition-colors border border-gray-700 hover:border-rose-500/30 flex items-center justify-center shrink-0 active:scale-95"
                         >
                           <Trash2 size={18}/>
                         </button>
                         <button 
                           onClick={() => handleUseSharedPost(post)}
                           className="flex-1 h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95 text-sm"
                         >
                           <Send size={16} /> Опубликовать
                         </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* === МОДАЛЬНОЕ ОКНО ПРОСМОТРА ПОСТА === */}
      {previewModal.isOpen && previewModal.data && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setPreviewModal({ isOpen: false, data: null })}></div>
          <div className="relative w-full max-w-2xl bg-[#0d0f13] border border-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] z-10 overflow-hidden">
            
            <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0 bg-gray-900/50">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Info size={18} className="text-blue-500" /> Подробности публикации
              </h3>
              <button onClick={() => setPreviewModal({ isOpen: false, data: null })} className="text-gray-400 hover:text-white p-2 bg-gray-800 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
              {/* Фотографии */}
              {previewModal.data.mediaUrls && previewModal.data.mediaUrls.length > 0 && (
                <div className={`grid gap-2 ${previewModal.data.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
                  {previewModal.data.mediaUrls.map((img, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-950 border border-gray-800 relative group">
                      <img src={img} className="w-full h-full object-cover" alt="Media"/>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Текст */}
              {previewModal.data.text && (
                <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {previewModal.data.text}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-800 bg-gray-900/50 shrink-0">
               <button onClick={() => setPreviewModal({ isOpen: false, data: null })} className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3.5 rounded-xl font-bold transition-all active:scale-95">
                 Закрыть
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}