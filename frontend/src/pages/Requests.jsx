import { useEffect, useState, useMemo, useCallback } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Inbox, X, Send, UserPlus, UserCheck, UserX,
  CheckCircle2, Image as ImageIcon, Share2, Layers,
  ChevronRight, Trash2, Maximize2, ChevronLeft, Download,
  Loader2, Calendar, FileText, Clock, RefreshCw
} from 'lucide-react';

// === Утилита для конвертации картинок в файлы ===
const base64ToFile = (base64String, filename) => {
  try {
    const arr = base64String.split(',');
    if (arr.length < 2) return null;
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (e) {
    console.error("Ошибка парсинга изображения:", e);
    return null;
  }
};

export default function Requests() {
  const { 
    user, fetchPartnerData, fetchSharedPosts,
    acceptPartnershipRequest, declinePartnershipRequest,
    deleteSharedPostAction, saveTempDraft, 
    markSharedPostPublishedAction // <--- ДОБАВИТЬ ЭТО
  } = useStore();
  
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all'); 
  
  const incomingRequests = useStore((state) => state.incomingRequests) || [];
  const sharedIncoming = useStore((state) => state.sharedIncoming) || []; 

  const [previewPost, setPreviewPost] = useState(null);
  const [fsImageIndex, setFsImageIndex] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showRetryMenu, setShowRetryMenu] = useState(false);

  // === ЖЕСТКАЯ БЛОКИРОВКА СКРОЛЛА ФОНА ===
  useEffect(() => {
    if (previewPost || fsImageIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [previewPost, fsImageIndex]);

  useEffect(() => {
    if (user?.id) fetchPartnerData(user.id);
    fetchSharedPosts();
  }, [user, fetchPartnerData, fetchSharedPosts]);

  const handleAcceptPartner = async (reqId) => {
    await acceptPartnershipRequest(reqId);
    fetchPartnerData(user?.id);
  };

  const handleDeclinePartner = async (reqId) => {
    await declinePartnershipRequest(reqId);
    fetchPartnerData(user?.id);
  };

  const handleDeletePost = async (id) => {
    if (window.confirm('Удалить этот пост из входящих?')) {
      await deleteSharedPostAction(id);
      setPreviewPost(null);
      fetchSharedPosts();
    }
  };

  const currentMediaList = useMemo(() => {
    if (!previewPost) return [];
    try {
      return JSON.parse(previewPost.mediaUrls || '[]');
    } catch(e) { return []; }
  }, [previewPost]);

  const handleNextPhoto = useCallback((e) => {
    e?.stopPropagation();
    if (fsImageIndex !== null && fsImageIndex < currentMediaList.length - 1) {
      setFsImageIndex(fsImageIndex + 1);
    }
  }, [fsImageIndex, currentMediaList]);

  const handlePrevPhoto = useCallback((e) => {
    e?.stopPropagation();
    if (fsImageIndex !== null && fsImageIndex > 0) {
      setFsImageIndex(fsImageIndex - 1);
    }
  }, [fsImageIndex]);

  const handleDownload = async (imgUrl) => {
    try {
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `smmdeck_shared_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) { window.open(imgUrl, '_blank'); }
  };

  const handleUsePost = async (mode) => {
    if (!previewPost) return;
    setShowRetryMenu(false);
    setIsPreparing(true);

    // Уведомляем бэкенд, что пост взят в публикацию
    await markSharedPostPublishedAction(previewPost.id);

    setTimeout(() => {
      const reconstructedPhotos = currentMediaList.map((base64str, index) => {
        const file = base64ToFile(base64str, `shared_${index}.jpg`);
        return file ? {
          id: `dup_${Math.random().toString(36).substr(2, 9)}`,
          url: base64str,
          file: file
        } : null;
      }).filter(p => p !== null);

      saveTempDraft({ 
        text: previewPost.text || '', 
        photos: reconstructedPhotos,
        step: 1, 
        view: 'wizard',
        publishMode: mode 
      });

      setTimeout(() => {
        setIsPreparing(false);
        navigate('/publish');
      }, 300);
    }, 600);
  };

  // === КОМПОНЕНТ СЕТКИ ФОТОГРАФИЙ ===
  const PhotoGrid = ({ mediaUrls }) => {
    const images = useMemo(() => {
      try { return JSON.parse(mediaUrls || '[]'); } catch(e) { return []; }
    }, [mediaUrls]);
    
    if (images.length === 0) return null;

    return (
      <div className={`grid gap-2 sm:gap-3 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {images.slice(0, 4).map((img, i) => (
          <div 
            key={i} 
            onClick={() => setFsImageIndex(i)}
            className="relative aspect-square rounded-[1rem] sm:rounded-[1.5rem] overflow-hidden bg-gray-900 group cursor-pointer border border-gray-800"
          >
            <img src={img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="media" />
            {i === 3 && images.length > 4 && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center border-l border-t border-gray-700">
                <span className="text-white text-2xl sm:text-3xl font-black">+{images.length - 3}</span>
                <span className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">фото</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Maximize2 className="text-white drop-shadow-lg" size={24} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 sm:space-y-8 font-sans pb-24 md:pb-12">
      
      {/* === ШАПКА === */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 bg-admin-card border border-gray-800 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl">
        <div>
           <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3 sm:gap-4 tracking-tighter">
              <Bell className="text-yellow-500" size={28} /> Уведомления
           </h1>
           <p className="text-gray-500 font-medium mt-1 text-sm sm:text-base">Входящие заявки и партнерский контент</p>
        </div>
      </div>

      {/* === ТАБЫ === */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-gray-900/50 p-1.5 sm:p-2 rounded-[1.5rem] sm:rounded-[1.8rem] border border-gray-800">
        {[
          { id: 'all', label: 'Все', icon: Layers },
          { id: 'partners', label: `Заявки (${incomingRequests.length})`, icon: UserPlus },
          { id: 'posts', label: `Контент (${sharedIncoming.length})`, icon: Inbox }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4 rounded-[1.2rem] sm:rounded-2xl text-xs sm:text-sm font-black transition-all ${activeTab === tab.id ? 'bg-gray-800 text-white shadow-xl border border-gray-700 translate-y-[-1px]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <tab.icon size={18} className={activeTab === tab.id ? 'text-[#0077FF]' : 'text-gray-600'} />
            <span className="hidden xs:inline uppercase tracking-wider">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* === ЗАЯВКИ В ПАРТНЕРЫ === */}
      {(activeTab === 'all' || activeTab === 'partners') && incomingRequests.length > 0 && (
        <section className="space-y-4">
           <h2 className="text-xs sm:text-sm font-black text-gray-500 uppercase tracking-[0.2em] px-2 sm:px-4">Запросы в партнеры</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {incomingRequests.map(req => (
                <div key={req.id} className="bg-admin-card border border-gray-800 p-5 rounded-[1.5rem] sm:rounded-[2rem] flex flex-col justify-between shadow-lg">
                   <div className="flex items-center gap-4 mb-5">
                      <div className="w-14 h-14 rounded-[1.2rem] bg-gray-900 border border-gray-700 overflow-hidden shrink-0">
                         {req.requester?.avatarUrl ? (
                           <img src={req.requester.avatarUrl} className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-gray-600"><UserPlus size={24}/></div>
                         )}
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
        </section>
      )}

      {/* === ВХОДЯЩИЕ ПУБЛИКАЦИИ === */}
      {(activeTab === 'all' || activeTab === 'posts') && (
        <section className="space-y-4">
           <h2 className="text-xs sm:text-sm font-black text-gray-500 uppercase tracking-[0.2em] px-2 sm:px-4">Входящий контент</h2>
           {sharedIncoming.length === 0 ? (
             <div className="bg-admin-card border border-gray-800 border-dashed p-10 rounded-[2rem] text-center flex flex-col items-center">
                <Inbox className="text-gray-700 mb-4" size={48} />
                <p className="text-gray-500 font-bold">Новых постов от партнеров пока нет</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {sharedIncoming.map(post => (
                  <div 
                    key={post.id} 
                    onClick={() => setPreviewPost(post)} 
                    className="bg-admin-card border border-gray-800 p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] hover:border-gray-600 transition-all cursor-pointer flex flex-col h-full group shadow-lg active:scale-[0.98]"
                  >
                     <div className="flex items-center gap-3 mb-4 sm:mb-5">
                        <div className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 overflow-hidden shrink-0">
                          {post.sender?.avatarUrl ? <img src={post.sender.avatarUrl} className="w-full h-full object-cover"/> : <ImageIcon className="w-full h-full p-2 text-gray-600"/>}
                        </div>
                        <span className="text-xs font-black text-gray-400 truncate uppercase tracking-widest">{post.sender?.name || 'Партнер'}</span>
                        <div className="ml-auto bg-blue-500/10 p-1.5 rounded-lg text-blue-500"><Share2 size={14}/></div>
                     </div>
                     <div className="flex gap-4 sm:gap-5 mb-4 sm:mb-5">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[1.2rem] bg-gray-900 border border-gray-800 overflow-hidden shrink-0 relative">
                           <img src={JSON.parse(post.mediaUrls || '[""]')[0]} className="w-full h-full object-cover" />
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
                ))}
             </div>
           )}
        </section>
      )}

      {/* === ИДЕАЛЬНОЕ МОДАЛЬНОЕ ОКНО (Точно как в истории, без кнопки поделиться) === */}
      {previewPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 sm:bg-black/80 sm:backdrop-blur-xl sm:p-6 md:p-10 animate-in fade-in duration-200">
          
          {isPreparing && (
            <div className="absolute inset-0 z-[160] bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center sm:rounded-[2.5rem]">
               <Loader2 className="animate-spin text-[#0077FF] mb-4 sm:mb-6" size={48} />
               <p className="text-white font-black text-xl sm:text-2xl tracking-tighter uppercase text-center px-4">Подготовка данных...</p>
            </div>
          )}

          <div className="bg-[#0d0f13] w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] md:max-w-4xl sm:rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col relative border-0 sm:border border-gray-800/50 animate-in zoom-in-95 duration-200 overflow-hidden">
            
            {/* --- ШАПКА С КНОПКАМИ ДЕЙСТВИЙ --- */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800/50 bg-gray-900/50 shrink-0 z-10 pt-[max(1rem,env(safe-area-inset-top))]">
                
                <div className="flex items-center gap-3 sm:gap-4 hidden sm:flex">
                  <div className="p-2 sm:p-3 bg-emerald-500/10 rounded-xl sm:rounded-2xl text-emerald-400">
                    <FileText size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <h3 className="text-white font-black text-base sm:text-xl tracking-tight uppercase line-clamp-1">Публикация от партнера</h3>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  
                  <div className="flex items-center gap-1.5 sm:gap-3">
                    
                    {/* Кнопка Опубликовать с Dropdown (Точно как кнопка Повторить) */}
                    <div className="relative">
                      <button 
                        onClick={() => setShowRetryMenu(!showRetryMenu)}
                        title="Опубликовать"
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-blue-400 hover:bg-blue-500 hover:text-white bg-gray-800 transition-all active:scale-95"
                      >
                        <RefreshCw size={18} className="sm:w-5 sm:h-5" />
                      </button>
                      
                      {showRetryMenu && (
                        <div className="absolute top-[calc(100%+0.5rem)] left-0 sm:left-auto sm:right-0 w-56 sm:w-64 bg-gray-800 border border-gray-700 rounded-2xl sm:rounded-3xl shadow-2xl p-1.5 z-50 animate-in slide-in-from-top-2 duration-200">
                          <button onClick={() => handleUsePost('schedule')} className="w-full flex items-center gap-3 sm:gap-4 px-4 py-3 sm:py-4 text-xs sm:text-sm text-white hover:bg-gray-700 font-black uppercase tracking-widest transition-all rounded-xl mb-1">
                            <Clock size={16} className="text-purple-400 sm:w-5 sm:h-5"/> В очередь
                          </button>
                          <button onClick={() => handleUsePost('now')} className="w-full flex items-center gap-3 sm:gap-4 px-4 py-3 sm:py-4 text-xs sm:text-sm text-white hover:bg-gray-700 font-black uppercase tracking-widest transition-all rounded-xl border-t border-gray-700">
                            <Send size={16} className="text-blue-400 sm:w-5 sm:h-5"/> Прямо сейчас
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Кнопка Удалить */}
                    <button 
                      onClick={() => handleDeletePost(previewPost.id)}
                      title="Удалить из входящих"
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white bg-gray-800 transition-all active:scale-95"
                    >
                      <Trash2 size={18} className="sm:w-5 sm:h-5" />
                    </button>
                  </div>

                  <div className="w-px h-6 bg-gray-700 mx-1 hidden sm:block"></div>

                  {/* Закрыть окно */}
                  <button 
                    onClick={() => setPreviewPost(null)} 
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 rounded-xl sm:rounded-2xl transition-all active:scale-90"
                  >
                      <X size={20} className="sm:w-6 sm:h-6" />
                  </button>
                </div>
            </div>

            {/* --- КОНТЕНТ (Свободно скроллится внутри) --- */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
              
              <div className="flex items-center gap-3 sm:gap-5 mb-6 sm:mb-10 pb-6 sm:pb-8 border-b border-gray-800/30">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[1.2rem] sm:rounded-[1.5rem] bg-gray-900 overflow-hidden border-2 border-gray-800 p-0.5 sm:p-1 shrink-0">
                  {previewPost.sender?.avatarUrl ? <img src={previewPost.sender.avatarUrl} className="w-full h-full object-cover rounded-[1rem] sm:rounded-[1.1rem]"/> : <ImageIcon className="w-full h-full p-4 text-gray-600"/>}
                </div>
                <div className="min-w-0">
                  <h2 className="text-white font-black text-lg sm:text-2xl tracking-tighter leading-tight truncate">{previewPost.sender?.name || 'Неизвестный партнер'}</h2>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2">
                      <span className="text-[9px] sm:text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em] bg-emerald-500/10 px-2 sm:px-3 py-1 rounded-md sm:rounded-lg border border-emerald-500/20">
                        Входящий контент
                      </span>
                      <span className="text-[10px] sm:text-xs text-gray-500 font-bold flex items-center gap-1.5 sm:gap-2 truncate">
                        <Calendar size={12} className="sm:w-3.5 sm:h-3.5" />
                        {new Date(previewPost.createdAt).toLocaleString()}
                      </span>
                  </div>
                </div>
              </div>

              {previewPost.text && (
                <div className="mb-6 sm:mb-10 bg-gray-900/30 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-800/50">
                  <p className="text-gray-100 text-sm sm:text-lg leading-relaxed whitespace-pre-wrap font-medium break-words">
                    {previewPost.text}
                  </p>
                </div>
              )}

              <div className="mb-2">
                 <PhotoGrid mediaUrls={previewPost.mediaUrls} />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* === ПОЛНОЭКРАННЫЙ СЛАЙДЕР С НАВИГАЦИЕЙ === */}
      {fsImageIndex !== null && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black animate-in fade-in duration-200">
          
          <button 
            onClick={() => setFsImageIndex(null)} 
            className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 sm:right-8 w-12 h-12 sm:w-14 sm:h-14 bg-gray-900/80 text-white rounded-full flex items-center justify-center transition-all z-[210] active:scale-90"
          >
            <X size={24} className="sm:w-8 sm:h-8" />
          </button>

          <button 
            onClick={handlePrevPhoto} 
            disabled={fsImageIndex === 0}
            className="absolute left-2 sm:left-6 p-4 sm:p-6 text-white hover:text-[#0077FF] disabled:opacity-5 transition-all z-[210] active:scale-75"
          >
            <ChevronLeft size={40} className="sm:w-16 sm:h-16" />
          </button>

          <button 
            onClick={handleNextPhoto} 
            disabled={fsImageIndex === currentMediaList.length - 1}
            className="absolute right-2 sm:right-6 p-4 sm:p-6 text-white hover:text-[#0077FF] disabled:opacity-5 transition-all z-[210] active:scale-75"
          >
            <ChevronRight size={40} className="sm:w-16 sm:h-16" />
          </button>

          <div className="w-full h-full flex items-center justify-center p-4 sm:p-12 select-none">
            <img 
              key={fsImageIndex}
              src={currentMediaList[fsImageIndex]} 
              className="max-w-full max-h-[85vh] object-contain rounded-xl sm:rounded-2xl shadow-[0_0_80px_rgba(0,119,255,0.15)] animate-in zoom-in-95 duration-300" 
            />
          </div>

          <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-4 sm:gap-6 z-[210]">
             <div className="px-4 sm:px-6 py-1.5 sm:py-2 bg-gray-900/90 border border-gray-800 rounded-full text-white font-black text-[10px] sm:text-xs tracking-[0.3em] uppercase">
                {fsImageIndex + 1} / {currentMediaList.length}
             </div>
             <button 
               onClick={() => handleDownload(currentMediaList[fsImageIndex])}
               className="flex items-center gap-3 sm:gap-4 px-6 sm:px-10 py-3.5 sm:py-5 bg-white text-black rounded-xl sm:rounded-[2rem] font-black text-xs sm:text-sm uppercase tracking-widest transition-all active:scale-95 shadow-2xl"
             >
               <Download size={20} className="sm:w-6 sm:h-6" /> Сохранить фото
             </button>
          </div>
        </div>
      )}
    </div>
  );
}