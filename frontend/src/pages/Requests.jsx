import { useEffect, useState, useMemo, useCallback } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Inbox, X, Send, UserPlus, UserCheck, UserX,
  CheckCircle2, Image as ImageIcon, Share2, Layers,
  ChevronRight, Trash2, Maximize2, ChevronLeft, Download,
  Loader2, Calendar, FileText, Clock, RefreshCw, PlusCircle,
  ChevronUp, CalendarClock, Check
} from 'lucide-react';

// === Утилиты для картинок ===
const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}${url}`;
};

// Бронебойный парсер для mediaUrls (защита от двойного JSON.stringify)
const parseMediaUrls = (mediaStr) => {
  if (!mediaStr) return [];
  try {
    let parsed = JSON.parse(mediaStr);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
};

const urlToFile = async (url, filename) => {
  if (url.startsWith('data:')) {
    try {
      const arr = url.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      return new File([u8arr], filename, { type: mime });
    } catch (e) { return null; }
  }
  try {
    const res = await fetch(getImageUrl(url));
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
  } catch (e) { return null; }
};

export default function Requests() {
  const { 
    user, fetchPartnerData, fetchSharedPosts,
    acceptPartnership, declinePartnership,
    deleteSharedPostAction, saveTempDraft, 
    markSharedPostPublishedAction,
    markNotificationAsRead
  } = useStore();
  
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('notifications'); 
  
  const incomingRequests = useStore((state) => state.incomingRequests) || [];
  const sharedIncoming = useStore((state) => state.sharedIncoming) || []; 
  const notifications = useStore((state) => state.notifications) || [];

  // === ЖЕСТКАЯ ФИЛЬТРАЦИЯ 1 ВКЛАДКИ (Только ответы: Принято/Отказ) ===
  const activeNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (n.isRead) return false;
      // Убираем системный мусор про новые публикации, так как они лежат в 3 вкладке
      if (n.text.includes('поделился с вами новой')) return false;
      return true;
    });
  }, [notifications]);

  const incomingPosts = useMemo(() => sharedIncoming.filter(post => !post.isPublished), [sharedIncoming]);
  const isSubscriptionActive = user?.isPro && (!user?.proExpiresAt || new Date(user.proExpiresAt) > new Date());

  const [previewPost, setPreviewPost] = useState(null);
  const [previewNotification, setPreviewNotification] = useState(null);
  const [fsImageIndex, setFsImageIndex] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showRetryMenu, setShowRetryMenu] = useState(false);

  useEffect(() => {
    if (previewPost || previewNotification || fsImageIndex !== null) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [previewPost, previewNotification, fsImageIndex]);

  useEffect(() => {
    if (user?.id) fetchPartnerData(user.id);
    fetchSharedPosts();
  }, [user, fetchPartnerData, fetchSharedPosts]);

  const handleAcceptPartner = async (reqId) => {
    await acceptPartnership(reqId);
    fetchPartnerData(user?.id);
  };

  const handleDeclinePartner = async (reqId) => {
    await declinePartnership(reqId);
    fetchPartnerData(user?.id);
  };

  const handleDeletePost = async (id) => {
    if (window.confirm('Отказаться от публикации? Автору будет отправлено уведомление об отказе.')) {
      setPreviewPost(null);
      useStore.setState((state) => ({ sharedIncoming: state.sharedIncoming.filter(post => post.id !== id) }));
      await deleteSharedPostAction(id);
      fetchSharedPosts(); 
    }
  };

  const currentMediaList = useMemo(() => {
    if (previewPost) return parseMediaUrls(previewPost.mediaUrls);
    if (previewNotification && previewNotification.metadata) {
      try {
        const meta = JSON.parse(previewNotification.metadata);
        return parseMediaUrls(JSON.stringify(meta.mediaUrls));
      } catch(e) {}
    }
    return [];
  }, [previewPost, previewNotification]);

  const handleNextPhoto = useCallback((e) => {
    e?.stopPropagation();
    if (fsImageIndex !== null && fsImageIndex < currentMediaList.length - 1) setFsImageIndex(fsImageIndex + 1);
  }, [fsImageIndex, currentMediaList]);

  const handlePrevPhoto = useCallback((e) => {
    e?.stopPropagation();
    if (fsImageIndex !== null && fsImageIndex > 0) setFsImageIndex(fsImageIndex - 1);
  }, [fsImageIndex]);

  const handleDownload = async (imgUrl) => {
    try {
      const response = await fetch(getImageUrl(imgUrl));
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `smmdeck_photo_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) { window.open(getImageUrl(imgUrl), '_blank'); }
  };

  const handleUsePost = async (mode) => {
    if (!previewPost) return;
    setShowRetryMenu(false);
    setIsPreparing(true);

    try {
      await markSharedPostPublishedAction(previewPost.id);
      const reconstructedPhotos = await Promise.all(currentMediaList.map(async (url, index) => {
        const file = await urlToFile(url, `shared_${index}.jpg`);
        return file ? { id: `dup_${Math.random().toString(36).substr(2, 9)}`, url: getImageUrl(url), file: file } : null;
      }));

      saveTempDraft({ 
        text: previewPost.text || '', 
        photos: reconstructedPhotos.filter(p => p !== null),
        step: 1, view: 'wizard', publishMode: mode 
      });

      setIsPreparing(false);
      navigate('/publish');
    } catch (error) {
      setIsPreparing(false);
      alert("Не удалось загрузить файлы поста. Попробуйте еще раз.");
    }
  };

  return (
    <div className="w-full space-y-6 sm:space-y-8 font-sans pb-24 md:pb-12 pt-4 sm:pt-8">
      
      {/* === ТАБЫ === */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-gray-900/50 p-1.5 sm:p-2 rounded-[1.5rem] sm:rounded-[1.8rem] border border-gray-800 relative z-10">
        {[
          { id: 'notifications', label: 'Ответы', icon: Bell, count: activeNotifications.length },
          { id: 'partners', label: 'Заявки', icon: UserPlus, count: incomingRequests.length },
          { id: 'posts', label: 'Контент', icon: Inbox, count: incomingPosts.length }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4 rounded-[1.2rem] sm:rounded-2xl text-[10px] sm:text-sm font-black transition-all ${activeTab === tab.id ? 'bg-gray-800 text-white shadow-xl border border-gray-700 translate-y-[-1px]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <tab.icon size={18} className={activeTab === tab.id ? 'text-[#0077FF]' : 'text-gray-600'} />
            <span className="hidden xs:inline uppercase tracking-wider">{tab.label}</span>
            {tab.count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] sm:text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full border-2 border-admin-bg shadow-lg">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* === 1. ОТВЕТЫ === */}
      {activeTab === 'notifications' && (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
           {activeNotifications.length === 0 ? (
             <div className="bg-admin-card border border-gray-800 border-dashed p-10 rounded-[2rem] text-center flex flex-col items-center">
                <Bell className="text-gray-700 mb-4" size={48} />
                <p className="text-gray-500 font-bold">Ответов от партнеров пока нет</p>
             </div>
           ) : (
             <div className="space-y-3">
                {activeNotifications.map(note => (
                  <div key={note.id} className="bg-admin-card border border-gray-800 p-4 sm:p-5 rounded-[1.5rem] flex gap-4 items-start shadow-lg relative pr-20">
                      
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${note.type === 'SUCCESS' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                         {note.type === 'SUCCESS' ? <CheckCircle2 size={24}/> : <X size={24}/>}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                         <p className="text-white text-sm sm:text-base leading-snug font-medium">{note.text}</p>
                         <p className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-wider">
                           {new Date(note.createdAt).toLocaleString('ru-RU', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}
                         </p>
                      </div>
                      
                      {/* ⚡ ОБНОВЛЕНО: Блок кнопок в правом верхнем углу */}
                      <div className="absolute top-4 right-4 flex items-center gap-2">
                         {note.metadata && (
                           <button 
                             onClick={() => setPreviewNotification(note)}
                             className="text-gray-400 hover:text-blue-400 bg-gray-900 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 border border-gray-700"
                             title="Детали поста"
                           >
                             <FileText size={14} />
                           </button>
                         )}
                         <button 
                           onClick={() => markNotificationAsRead(note.id)} 
                           className="text-gray-500 hover:text-red-400 bg-gray-900 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 border border-gray-700"
                           title="Удалить уведомление"
                         >
                           <X size={14} />
                         </button>
                      </div>

                  </div>
                ))}
             </div>
           )}
        </section>
      )}

      {/* === 2. ЗАЯВКИ === */}
      {activeTab === 'partners' && (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
           {incomingRequests.length === 0 ? (
             <div className="bg-admin-card border border-gray-800 border-dashed p-10 rounded-[2rem] text-center flex flex-col items-center">
                <UserPlus className="text-gray-700 mb-4" size={48} />
                <p className="text-gray-500 font-bold">Заявок в партнеры пока нет</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {incomingRequests.map(req => (
                  <div key={req.id} className="bg-admin-card border border-gray-800 p-5 rounded-[1.5rem] sm:rounded-[2rem] flex flex-col justify-between shadow-lg">
                     <div className="flex items-center gap-4 mb-5">
                        <div className="w-14 h-14 rounded-[1.2rem] bg-gray-900 border border-gray-700 flex items-center justify-center shrink-0 overflow-hidden text-gray-400 font-bold text-lg">
                           {req.requester?.avatarUrl ? (
                             <img src={getImageUrl(req.requester.avatarUrl)} className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}/>
                           ) : null}
                           <span className={req.requester?.avatarUrl ? "hidden w-full h-full items-center justify-center" : "w-full h-full flex items-center justify-center"}>
                              {req.requester?.name?.substring(0,2).toUpperCase() || '??'}
                           </span>
                        </div>
                        <div className="min-w-0">
                           <h4 className="text-white font-bold text-lg truncate">{req.requester?.name || 'Без имени'}</h4>
                           <p className="text-xs text-blue-400 font-black uppercase tracking-widest mt-1">Павильон {req.requester?.pavilion || '?'}</p>
                        </div>
                     </div>
                     <div className="flex gap-2 w-full mt-auto">
                        <button onClick={() => handleDeclinePartner(req.id)} className="flex-1 flex items-center justify-center py-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 transition-all hover:text-white font-bold"><UserX size={18}/></button>
                        <button onClick={() => handleAcceptPartner(req.id)} className="flex-[3] flex items-center justify-center gap-2 py-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 transition-all hover:text-white font-black uppercase text-xs tracking-widest"><UserCheck size={18}/> Принять</button>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </section>
      )}

      {/* === 3. КОНТЕНТ === */}
      {activeTab === 'posts' && (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
           {incomingPosts.length === 0 ? (
             <div className="bg-admin-card border border-gray-800 border-dashed p-10 rounded-[2rem] text-center flex flex-col items-center">
                <Inbox className="text-gray-700 mb-4" size={48} />
                <p className="text-gray-500 font-bold">Новых постов от партнеров пока нет</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {incomingPosts.map(post => {
                  const mediaArr = parseMediaUrls(post.mediaUrls);
                  const firstImage = mediaArr.length > 0 ? getImageUrl(mediaArr[0]) : null;

                  return (
                    <div key={post.id} onClick={() => setPreviewPost(post)} className="bg-admin-card border border-gray-800 p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] hover:border-gray-600 transition-all cursor-pointer flex flex-col h-full group shadow-lg active:scale-[0.98]">
                       <div className="flex items-center gap-3 mb-4 sm:mb-5">
                          <div className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold text-gray-400">
                            {post.sender?.avatarUrl ? (
                              <img src={getImageUrl(post.sender.avatarUrl)} className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}/>
                            ) : null}
                            <span className={post.sender?.avatarUrl ? "hidden w-full h-full items-center justify-center" : "w-full h-full flex items-center justify-center"}>
                              {post.sender?.name?.substring(0,2).toUpperCase() || '??'}
                            </span>
                          </div>
                          <span className="text-xs font-black text-gray-400 truncate uppercase tracking-widest">{post.sender?.name || 'Партнер'}</span>
                          <div className="ml-auto bg-blue-500/10 p-1.5 rounded-lg text-blue-500"><Share2 size={14}/></div>
                       </div>
                       
                       <div className="flex gap-4 sm:gap-5 mb-4 sm:mb-5">
                          {/* Контейнер картинки с защитой */}
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[1.2rem] bg-gray-900 border border-gray-800 shrink-0 relative flex items-center justify-center overflow-hidden">
                             {firstImage ? (
                               <img src={firstImage} className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                             ) : null}
                             <ImageIcon className={`text-gray-700 w-8 h-8 absolute ${firstImage ? 'hidden' : 'block'}`} />
                          </div>
                          <p className="text-white text-sm sm:text-base line-clamp-2 font-bold leading-relaxed">{post.text || 'Без текста'}</p>
                       </div>
                       <div className="mt-auto pt-4 sm:pt-5 border-t border-gray-800 flex items-center justify-between">
                          <span className="text-[10px] sm:text-[11px] text-gray-500 font-black uppercase bg-gray-900 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-gray-800">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                          <ChevronRight className="text-gray-700 group-hover:text-[#0077FF] transition-all group-hover:translate-x-1" size={20} />
                       </div>
                    </div>
                  );
                })}
             </div>
           )}
        </section>
      )}

      {/* === МОДАЛЬНОЕ ОКНО ПРЕДПРОСМОТРА ПОСТА === */}
      {previewPost && (
        <div className="fixed inset-0 z-[999] flex flex-col sm:items-center sm:justify-center bg-black/95 sm:bg-black/80 sm:backdrop-blur-xl animate-in fade-in duration-200">
          {isPreparing && (
            <div className="absolute inset-0 z-[1000] bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center sm:rounded-[2.5rem]">
               <Loader2 className="animate-spin text-[#0077FF] mb-4 sm:mb-6" size={48} />
               <p className="text-white font-black text-xl sm:text-2xl tracking-tighter uppercase text-center px-4">Подготовка данных...</p>
            </div>
          )}

          <div className="bg-[#0f1115] w-full h-full sm:h-auto sm:max-h-[90dvh] md:max-w-[500px] sm:rounded-[2rem] shadow-2xl flex flex-col relative border-0 sm:border border-gray-800/50 animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 shrink-0 z-10">
                <div className="min-w-0">
                  <h2 className="text-white font-bold text-2xl tracking-tight leading-none truncate">{previewPost.sender?.name || 'Неизвестный партнер'}</h2>
                  <p className="text-gray-400 text-sm mt-1 uppercase tracking-wider">Павильон {previewPost.sender?.pavilion || '?'}</p>
                </div>
                <button onClick={() => setPreviewPost(null)} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-700 rounded-full transition-all active:scale-90 shrink-0 ml-4">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-6">
              {currentMediaList.length > 0 && (
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 mb-4 -mx-1 px-1">
                   {currentMediaList.map((img, i) => (
                      <div key={i} onClick={() => setFsImageIndex(i)} className="relative w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer group">
                        <img src={getImageUrl(img)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                        <ImageIcon className="text-gray-700 w-8 h-8 hidden absolute" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Maximize2 className="text-white" size={20} />
                        </div>
                      </div>
                   ))}
                </div>
              )}

              <div className="bg-[#181a20] rounded-[1.5rem] p-4 sm:p-5 border border-gray-800/60">
                 <p className="text-gray-300 text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                   {previewPost.text || <span className="italic text-gray-600">Текст отсутствует</span>}
                 </p>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-800/50 bg-[#0f1115] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-5 shrink-0 flex gap-3 relative z-20">
               <button onClick={() => handleDeletePost(previewPost.id)} className="flex-1 bg-[#181a20] hover:bg-red-500/10 border border-gray-800 hover:border-red-500/30 text-gray-300 hover:text-red-400 py-3.5 sm:py-4 rounded-xl font-bold text-sm transition-all active:scale-95">
                 Отказаться
               </button>
               <div className="flex-[2] relative">
                 <button 
                   onClick={() => setShowRetryMenu(!showRetryMenu)} 
                   disabled={!isSubscriptionActive}
                   className={`w-full py-3.5 sm:py-4 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 ${
                     isSubscriptionActive 
                       ? 'bg-[#10B981] hover:bg-[#059669] text-white active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                       : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                   }`}
                 >
                   {isSubscriptionActive ? (
                     <>Запостить <ChevronUp size={16} className={`transition-transform ${showRetryMenu ? 'rotate-180' : ''}`} /></>
                   ) : (
                     'Оформите подписку'
                   )}
                 </button>
                 {showRetryMenu && isSubscriptionActive && (
                   <div className="absolute bottom-[calc(100%+0.75rem)] right-0 w-full bg-[#181a20] border border-gray-700 rounded-2xl shadow-2xl p-1.5 z-50 animate-in slide-in-from-bottom-2 duration-200">
                     <button onClick={() => handleUsePost('now')} className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm text-white hover:bg-gray-700 font-bold transition-all rounded-xl mb-1">
                       <Send size={16} className="text-blue-400"/> Запостить сейчас
                     </button>
                     <button onClick={() => handleUsePost('schedule')} className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm text-white hover:bg-gray-700 font-bold transition-all rounded-xl border-t border-gray-700">
                       <CalendarClock size={16} className="text-purple-400"/> Запланировать
                     </button>
                   </div>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* === МОДАЛЬНОЕ ОКНО ПРЕДПРОСМОТРА УВЕДОМЛЕНИЯ === */}
      {previewNotification && (
        <div className="fixed inset-0 z-[999] flex flex-col sm:items-center sm:justify-center bg-black/95 sm:bg-black/80 sm:backdrop-blur-xl animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setPreviewNotification(null)}></div>
          <div className="bg-[#0f1115] w-full h-full sm:h-auto sm:max-h-[90dvh] md:max-w-[500px] sm:rounded-[2rem] shadow-2xl flex flex-col relative border-0 sm:border border-gray-800/50 animate-in zoom-in-95 duration-200 overflow-hidden z-10">
            
            <div className="flex items-center justify-between px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 shrink-0 z-10 border-b border-gray-800/50">
                <div className="min-w-0 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${previewNotification.type === 'SUCCESS' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                     {previewNotification.type === 'SUCCESS' ? <CheckCircle2 size={20}/> : <X size={20}/>}
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg tracking-tight leading-none truncate">
                      {previewNotification.type === 'SUCCESS' ? 'Пост опубликован' : 'Отказ от публикации'}
                    </h2>
                    <p className="text-gray-400 text-xs mt-1 uppercase tracking-wider">Детали ответа</p>
                  </div>
                </div>
                <button onClick={() => setPreviewNotification(null)} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-700 rounded-full transition-all active:scale-90 shrink-0 ml-4">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6">
              <p className="text-white text-sm font-medium mb-6 leading-relaxed bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                  {previewNotification.text}
              </p>

              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Содержимое поста:</h3>

              {currentMediaList.length > 0 && (
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 mb-4 -mx-1 px-1">
                   {currentMediaList.map((img, i) => (
                      <div key={i} onClick={() => setFsImageIndex(i)} className="relative w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer group">
                        <img src={getImageUrl(img)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                        <ImageIcon className="text-gray-700 w-8 h-8 hidden absolute" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Maximize2 className="text-white" size={20} />
                        </div>
                      </div>
                   ))}
                </div>
              )}

              <div className="bg-[#181a20] rounded-[1.5rem] p-4 sm:p-5 border border-gray-800/60">
                 {(() => {
                   try {
                     const meta = JSON.parse(previewNotification.metadata);
                     return <p className="text-gray-300 text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words">{meta.text || <span className="italic text-gray-600">Текст отсутствует</span>}</p>;
                   } catch(e) { return null; }
                 })()}
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-800/50 bg-[#0f1115] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-5 shrink-0 flex gap-3 relative z-20">
               <button onClick={() => {
                  markNotificationAsRead(previewNotification.id);
                  setPreviewNotification(null);
               }} className="w-full bg-[#181a20] hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-white py-3.5 sm:py-4 rounded-xl font-bold text-sm transition-all active:scale-95 flex justify-center items-center gap-2">
                 <Check size={18} /> Отметить как прочитанное
               </button>
            </div>
          </div>
        </div>
      )}

{fsImageIndex !== null && currentMediaList.length > 0 && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black animate-in fade-in duration-200">
          <button onClick={() => setFsImageIndex(null)} className="absolute top-8 right-8 w-14 h-14 bg-gray-900/80 text-white rounded-full flex items-center justify-center transition-all z-[1010] active:scale-90">
            <X size={24} />
          </button>
          
          <button 
            onClick={handlePrevPhoto} 
            disabled={fsImageIndex === 0} 
            className="absolute left-6 p-6 text-white hover:text-[#0077FF] disabled:opacity-5 transition-all z-[1010] active:scale-75"
          >
            <ChevronLeft size={48} />
          </button>
          
          <button 
            onClick={handleNextPhoto} 
            disabled={fsImageIndex === currentMediaList.length - 1} 
            className="absolute right-6 p-6 text-white hover:text-[#0077FF] disabled:opacity-5 transition-all z-[1010] active:scale-75"
          >
            <ChevronRight size={48} />
          </button>

          <div className="w-full h-full flex items-center justify-center p-12 select-none">
            <img 
              key={fsImageIndex} 
              src={getImageUrl(currentMediaList[fsImageIndex])} 
              className="max-w-full max-h-[85vh] object-contain rounded-3xl shadow-[0_0_80px_rgba(0,119,255,0.15)] animate-in zoom-in-95 duration-300" 
              onError={(e) => { e.target.style.display='none'; }}
              alt="fullscreen"
            />
          </div>

          <div className="absolute bottom-12 flex flex-col items-center gap-6 z-[1010]">
             <div className="px-6 py-2 bg-gray-900/90 border border-gray-800 rounded-full text-white font-black text-[10px] tracking-[0.3em] uppercase">
                {fsImageIndex + 1} / {currentMediaList.length}
             </div>
             <button 
                onClick={() => handleDownload(currentMediaList[fsImageIndex])} 
                className="flex items-center gap-4 px-10 py-5 bg-white text-black rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-2xl"
              >
               <Download size={20} /> Скачать
             </button>
          </div>
        </div>
      )}

    </div>
  );
}