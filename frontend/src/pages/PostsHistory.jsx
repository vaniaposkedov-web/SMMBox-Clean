import { useEffect, useState, useMemo, useCallback } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, CheckCircle2, Clock, AlertCircle, Search,
  Calendar, Image as ImageIcon, Send, Trash2, 
  X, Share2, LayoutPanelLeft, ChevronRight, Download, 
  RefreshCw, Loader2, Maximize2, ChevronLeft, PlusCircle, ChevronUp,
  Users, Check, ChevronDown
} from 'lucide-react';

// === ЖЕЛЕЗОБЕТОННЫЙ ПАРСЕР КАРТИНОК (Адаптирован под пути из postController.js) ===
const getImageUrl = (url) => {
  if (!url) return '';
  // Если это уже полный URL или Base64
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url;
  
  let finalUrl = url;
  
  // Если путь начинается с /uploads/ (как возвращает saveImageToFile в контроллере)
  if (finalUrl.startsWith('/uploads/')) {
    // Обычно статика проксируется через /api/ или висит на корне бэкенда
    finalUrl = `/api${finalUrl}`; 
  } 
  // Если в базе только имя файла
  else if (!finalUrl.includes('/')) {
    finalUrl = `/api/uploads/posts/${finalUrl}`;
  }
  // Защита от двойных слэшей
  finalUrl = finalUrl.replace(/\/+/g, '/');
  if (!finalUrl.startsWith('/')) finalUrl = '/' + finalUrl;
  
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}${finalUrl}`;
};

const parseMediaUrls = (mediaStr) => {
  if (!mediaStr || mediaStr === '[]' || mediaStr === '""') return [];
  
  try {
    // 1. Пытаемся распарсить как JSON
    let parsed = typeof mediaStr === 'string' ? JSON.parse(mediaStr) : mediaStr;
    // 2. Иногда база возвращает JSON внутри строки (двойная сериализация)
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    
    if (!Array.isArray(parsed)) parsed = parsed ? [parsed] : [];

    // Извлекаем URL, даже если сервер прислал массив объектов (карусель)
    return parsed.map(item => {
      if (typeof item === 'object' && item !== null) {
        return item.url || item.file || item.path || item.src || '';
      }
      return String(item).trim();
    }).filter(Boolean);
  } catch (e) {
    // 3. FALLBACK: Если JSON битый (например, Postgres-массив {url1,url2}), выдираем пути регуляркой
    if (typeof mediaStr === 'string') {
      const matches = mediaStr.match(/(\/uploads\/posts\/|http)[^,}\s"']+/gi);
      return matches || [];
    }
    return [];
  }
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
    // Определяем расширение по MIME-типу (webp/jpg)
    const mimeType = blob.type || 'image/webp';
    let finalFilename = filename;
    if (mimeType.includes('webp')) finalFilename = finalFilename.replace('.jpg', '.webp');
    return new File([blob], finalFilename, { type: mimeType });
  } catch (e) { return null; }
};

export default function PostsHistory() {
  const navigate = useNavigate();
  const { 
    postsHistory, fetchPostsHistory, deleteScheduledPostAction, saveTempDraft, 
    myPartners, sharePostAction 
  } = useStore();
  
  const [activeTab, setActiveTab] = useState('published');
  const [searchQuery, setSearchQuery] = useState('');
  
  // === ПАГИНАЦИЯ И ЗАГРУЗКА ===
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12); // Загружаем по 12 постов
  
  const [selectedPost, setSelectedPost] = useState(null); 
  const [fsImageIndex, setFsImageIndex] = useState(null); 
  
  const [showRetryMenu, setShowRetryMenu] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [selectedPartners, setSelectedPartners] = useState([]);
  const [partnerStatus, setPartnerStatus] = useState('idle');
  const [isSharing, setIsSharing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (selectedPost || fsImageIndex !== null || showPartnerModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [selectedPost, fsImageIndex, showPartnerModal]);

  useEffect(() => {
    const loadData = async () => {
      setIsInitialLoading(true);
      await fetchPostsHistory();
      setIsInitialLoading(false);
    };
    loadData();
  }, [fetchPostsHistory]);

  // Сброс пагинации при смене таба или поиске
  useEffect(() => {
    setVisibleCount(12);
  }, [activeTab, searchQuery]);

  const filteredPosts = useMemo(() => {
    let base = postsHistory || [];
    if (activeTab === 'published') base = base.filter(p => p.status === 'PUBLISHED');
    if (activeTab === 'scheduled') base = base.filter(p => p.status === 'SCHEDULED');
    if (activeTab === 'errors') base = base.filter(p => p.status === 'FAILED');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(p => 
        (p.text && p.text.toLowerCase().includes(q)) || 
        (p.account?.name && p.account.name.toLowerCase().includes(q))
      );
    }
    return base;
  }, [postsHistory, activeTab, searchQuery]);

  // Список постов для текущего отображения
  const visiblePosts = useMemo(() => {
    return filteredPosts.slice(0, visibleCount);
  }, [filteredPosts, visibleCount]);

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => prev + 12);
      setIsLoadingMore(false);
    }, 600);
  };

  const currentMediaList = useMemo(() => parseMediaUrls(selectedPost?.mediaUrls), [selectedPost]);

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
      const response = await fetch(getImageUrl(imgUrl));
      const blob = await response.blob();
      const ext = blob.type.includes('webp') ? 'webp' : 'jpg';
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `smmdeck_${Date.now()}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      window.open(getImageUrl(imgUrl), '_blank');
    }
  };

  const handleDuplicatePost = async (mode) => {
    if (!selectedPost) return;
    setShowRetryMenu(false);
    setIsPreparing(true);

    try {
      const reconstructedPhotos = await Promise.all(currentMediaList.map(async (url, index) => {
        const file = await urlToFile(url, `duplicate_${index}.webp`);
        return file ? {
          id: `dup_${Math.random().toString(36).substr(2, 9)}`,
          url: getImageUrl(url),
          file: file
        } : null;
      }));

      saveTempDraft({ 
        text: selectedPost.text || '', 
        photos: reconstructedPhotos.filter(p => p !== null),
        step: 1, 
        view: 'wizard',
        publishMode: mode 
      });

      setIsPreparing(false);
      navigate('/publish');
    } catch (error) {
      setIsPreparing(false);
      alert("Не удалось загрузить файлы поста. Попробуйте еще раз.");
    }
  };

  const togglePartner = (partnerId) => {
    setSelectedPartners(prev => prev.includes(partnerId) ? prev.filter(id => id !== partnerId) : [...prev, partnerId]);
  };

  const handleShareToPartners = async () => {
    if (selectedPartners.length === 0) return;
    
    setIsSharing(true);
    setPartnerStatus('sending');
    
    try {
      const blobs = await Promise.all(currentMediaList.map(url => urlToFile(url, 'share.webp')));
      const validBlobs = blobs.filter(b => b !== null);
      
      const res = await sharePostAction(selectedPost.text, validBlobs, selectedPartners);
      
      if (res?.success) {
        setPartnerStatus('sent');
        setIsSharing(false);
        setToastMessage('Отправлено партнерам!');
        
        setTimeout(() => {
          setShowPartnerModal(false);
          setSelectedPartners([]);
          setPartnerStatus('idle');
          setTimeout(() => setToastMessage(null), 3000);
        }, 1500);
      } else {
        setIsSharing(false);
        setPartnerStatus('idle');
        setToastMessage('Ошибка при отправке: ' + (res?.error || ''));
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (error) {
      setIsSharing(false);
      setPartnerStatus('idle');
      setToastMessage('Ошибка соединения при отправке');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Удалить этот пост из истории?')) {
      await deleteScheduledPostAction(id);
      setSelectedPost(null);
      fetchPostsHistory();
    }
  };

  return (
    <div className="w-full space-y-6 sm:space-y-8 font-sans pb-24 md:pb-12 pt-4 sm:pt-8 relative min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 bg-admin-card border border-gray-800 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3 sm:gap-4 tracking-tighter">
            <LayoutPanelLeft className="text-[#0077FF]" size={28} />
            История контента
          </h1>
          <p className="text-gray-500 font-medium mt-1 text-sm sm:text-base">Архив и управление вашими публикациями</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Поиск по тексту или аккаунту..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-3.5 pl-12 pr-6 text-white outline-none focus:border-[#0077FF] transition-all shadow-inner font-medium text-sm sm:text-base"
          />
        </div>
      </div>

      {/* TABS */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-gray-900/50 p-1.5 sm:p-2 rounded-[1.5rem] sm:rounded-[1.8rem] border border-gray-800">
        {[
          { id: 'published', label: 'Отправлено', icon: CheckCircle2, color: 'text-emerald-400' },
          { id: 'scheduled', label: 'В плане', icon: Clock, color: 'text-purple-400' },
          { id: 'errors', label: 'Ошибки', icon: AlertCircle, color: 'text-rose-400' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4 rounded-[1.2rem] sm:rounded-2xl text-[10px] sm:text-sm font-black transition-all ${activeTab === tab.id ? 'bg-gray-800 text-white shadow-xl border border-gray-700 translate-y-[-1px]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <tab.icon size={18} className={activeTab === tab.id ? tab.color : 'text-gray-600'} />
            <span className="hidden xs:inline uppercase tracking-wider">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENT AREA */}
      {isInitialLoading ? (
        <div className="bg-admin-card border border-gray-800 p-16 rounded-[2.5rem] flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="w-12 h-12 text-[#0077FF] animate-spin mb-4" />
          <div className="w-48 h-1.5 bg-gray-900 rounded-full overflow-hidden mb-4">
             <div className="h-full bg-gradient-to-r from-[#0077FF] to-purple-500 animate-pulse w-full"></div>
          </div>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Загрузка архива...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="bg-admin-card border border-gray-800 border-dashed p-10 rounded-[2.5rem] text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
          <LayoutPanelLeft className="text-gray-700 mb-4" size={48} />
          <p className="text-gray-500 font-bold">В этой категории пока пусто</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 animate-in fade-in duration-500">
            {visiblePosts.map(post => {
              const mediaArr = parseMediaUrls(post.mediaUrls);
              const firstImage = mediaArr.length > 0 ? getImageUrl(mediaArr[0]) : null;

              return (
                <div 
                  key={post.id} 
                  onClick={() => setSelectedPost(post)}
                  className="bg-admin-card border border-gray-800 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 hover:border-gray-600 transition-all cursor-pointer group shadow-lg flex flex-col h-full active:scale-[0.98]"
                >
                  <div className="flex gap-4 sm:gap-5 mb-4 sm:mb-5">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[1.2rem] bg-gray-900 border border-gray-800 shrink-0 flex items-center justify-center overflow-hidden relative">
                       {firstImage ? (
                         <img 
                          src={firstImage} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} 
                          alt="preview" 
                        />
                       ) : null}
                       <div className={`w-full h-full items-center justify-center bg-gray-900 ${firstImage ? 'hidden' : 'flex'}`}>
                          <ImageIcon className="text-gray-700 w-8 h-8" />
                       </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-gray-800 overflow-hidden border border-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                          {post.account?.avatarUrl ? <img src={getImageUrl(post.account?.avatarUrl)} className="w-full h-full object-cover"/> : post.account?.name?.substring(0,2).toUpperCase()}
                        </div>
                        <span className="text-[10px] sm:text-xs font-black text-gray-500 truncate uppercase tracking-widest">{post.account?.name}</span>
                      </div>
                      <p className="text-white text-sm sm:text-base line-clamp-2 font-bold leading-relaxed">{post.text || 'Без текста'}</p>
                    </div>
                  </div>
                  <div className="mt-auto pt-4 sm:pt-5 border-t border-gray-800 flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] font-black text-gray-500 flex items-center gap-1.5 sm:gap-2 bg-gray-900 px-2.5 sm:px-3 py-1.5 rounded-xl border border-gray-800">
                      <Calendar size={12} className="text-[#0077FF]"/>
                      {new Date(post.publishAt || post.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <ChevronRight className="text-gray-700 group-hover:text-[#0077FF] transition-all group-hover:translate-x-1" size={20}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* LOAD MORE BUTTON */}
          {filteredPosts.length > visibleCount && (
            <div className="flex justify-center mt-8 mb-4">
              <button 
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="flex items-center gap-2 px-8 py-4 bg-gray-900 border border-gray-700 hover:border-[#0077FF] hover:bg-gray-800 hover:text-white text-gray-400 rounded-2xl font-bold transition-all active:scale-95 shadow-xl group disabled:opacity-50"
              >
                {isLoadingMore ? <Loader2 className="animate-spin text-[#0077FF]" size={18} /> : <ChevronDown size={18} className="group-hover:translate-y-0.5 transition-transform" />}
                <span>{isLoadingMore ? 'Загрузка...' : 'Посмотреть еще'}</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* DETAIL MODAL */}
      {selectedPost && (
        <div className="fixed inset-0 z-[100] flex flex-col sm:items-center sm:justify-center bg-black/95 sm:bg-black/80 sm:backdrop-blur-xl animate-in fade-in duration-200">
          
          {isPreparing && (
            <div className="absolute inset-0 z-[160] bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center">
               <Loader2 className="animate-spin text-[#0077FF] mb-6" size={48} />
               <p className="text-white font-black text-xl tracking-tighter uppercase">Подготовка файлов...</p>
            </div>
          )}

          <div className="bg-[#0f1115] w-full h-full sm:h-auto sm:max-h-[90dvh] md:max-w-[500px] sm:rounded-[2.5rem] shadow-2xl flex flex-col relative border-0 sm:border border-gray-800/50 animate-in zoom-in-95 duration-200 overflow-hidden">
            
            <div className="flex items-center justify-between px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 shrink-0 border-b border-gray-800/50">
                <div className="min-w-0 flex-1">
                  <h2 className="text-white font-bold text-xl tracking-tight truncate">
                    {selectedPost.account?.name || 'Аккаунт'}
                  </h2>
                  <p className="text-blue-400 text-[10px] mt-1 font-black uppercase tracking-[0.2em]">
                    {selectedPost.account?.provider === 'partner' ? 'Обмен с партнером' : 'Публикация в сеть'}
                  </p>
                </div>
                <button 
                  onClick={() => { setSelectedPost(null); setShowRetryMenu(false); }} 
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-700 rounded-full transition-all active:scale-90"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 bg-[#0f1115]">
              {currentMediaList.length > 0 && (
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-4 mb-4 -mx-1 px-1">
                   {currentMediaList.map((img, i) => (
                      <div 
                        key={i} 
                        onClick={() => setFsImageIndex(i)}
                        className="relative w-[110px] h-[110px] rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer group"
                      >
                        <img src={getImageUrl(img)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Maximize2 className="text-white" size={20} />
                        </div>
                      </div>
                   ))}
                </div>
              )}

              <div className="bg-[#181a20] rounded-[2rem] p-5 border border-gray-800/60">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center overflow-hidden border border-gray-700 shrink-0 text-xs font-bold text-gray-400">
                       {selectedPost.account?.avatarUrl ? <img src={getImageUrl(selectedPost.account.avatarUrl)} className="w-full h-full object-cover"/> : selectedPost.account?.name?.substring(0,2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                       <p className="text-white font-bold text-sm truncate">{selectedPost.account?.name}</p>
                       <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                         {new Date(selectedPost.publishAt || selectedPost.createdAt).toLocaleString('ru-RU', {day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'})}
                       </p>
                    </div>
                 </div>
                 <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                   {selectedPost.text || <span className="italic text-gray-600">Текст отсутствует</span>}
                 </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800/50 bg-[#0f1115] pb-[max(1.5rem,env(safe-area-inset-bottom))] shrink-0 flex flex-col gap-3">
               <div className="flex gap-3">
                 <button onClick={() => handleDelete(selectedPost.id)} className="flex-1 bg-[#181a20] hover:bg-red-500/10 border border-gray-800 hover:border-red-500/30 text-gray-500 hover:text-red-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2">
                   <Trash2 size={16} /> Удалить
                 </button>
                 <button onClick={() => setShowPartnerModal(true)} className="flex-[2] bg-[#181a20] hover:bg-purple-500/10 border border-gray-800 hover:border-purple-500/30 text-purple-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2">
                   <Share2 size={16} /> Партнеру
                 </button>
               </div>
               
               <div className="w-full relative">
                 <button onClick={() => setShowRetryMenu(!showRetryMenu)} className="w-full bg-[#0077FF] hover:bg-[#0066CC] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-[0_10px_30px_rgba(0,119,255,0.2)] flex justify-center items-center gap-2">
                   <RefreshCw size={16} /> Повторить пост
                   <ChevronUp size={16} className={`transition-transform duration-300 ${showRetryMenu ? 'rotate-180' : ''}`} />
                 </button>
                 {showRetryMenu && (
                   <div className="absolute bottom-[calc(100%+0.75rem)] left-0 right-0 bg-[#181a20] border border-gray-700 rounded-3xl shadow-2xl p-1.5 z-50 animate-in slide-in-from-bottom-2 duration-200">
                     <button onClick={() => handleDuplicatePost('now')} className="w-full flex items-center justify-center gap-2 px-4 py-4 text-[10px] uppercase tracking-widest text-white hover:bg-gray-800 font-black transition-all rounded-2xl mb-1">
                       <Send size={14} className="text-[#0077FF]"/> Сейчас
                     </button>
                     <button onClick={() => handleDuplicatePost('schedule')} className="w-full flex items-center justify-center gap-2 px-4 py-4 text-[10px] uppercase tracking-widest text-white hover:bg-gray-800 font-black transition-all rounded-2xl border-t border-gray-700/50">
                       <Clock size={14} className="text-purple-400"/> В очередь
                     </button>
                   </div>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* PARTNER MODAL */}
      {showPartnerModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowPartnerModal(false)}></div>
          <div className="relative w-full max-w-md bg-[#111318] border border-gray-800 rounded-[2.5rem] shadow-2xl flex flex-col z-10 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/50">
              <h3 className="text-lg font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                <Users size={20} className="text-purple-500" /> Выберите партнеров
              </h3>
              <button onClick={() => setShowPartnerModal(false)} className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 max-h-[40vh] overflow-y-auto custom-scrollbar">
              {myPartners.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <Users size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-xs font-bold">Партнеры не найдены</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myPartners.map(partner => (
                    <div 
                      key={partner.id} 
                      onClick={() => togglePartner(partner.id)} 
                      className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer border transition-all ${selectedPartners.includes(partner.id) ? 'bg-purple-500/10 border-purple-500/50' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}
                    >
                      <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${selectedPartners.includes(partner.id) ? 'bg-purple-500 border-purple-500' : 'border-gray-700'}`}>
                        {selectedPartners.includes(partner.id) && <Check size={14} className="text-white" />}
                      </div>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gray-800 shrink-0 overflow-hidden border border-gray-700 flex justify-center items-center text-xs font-bold text-gray-400">
                          {partner.avatarUrl ? <img src={getImageUrl(partner.avatarUrl)} className="w-full h-full object-cover"/> : partner.name?.substring(0,2).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-bold text-white truncate">{partner.name}</p>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{partner.pavilion}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex gap-3">
              <button onClick={() => setShowPartnerModal(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                Отмена
              </button>
              <button 
                onClick={handleShareToPartners} 
                disabled={isSharing || selectedPartners.length === 0 || partnerStatus === 'sent'} 
                className={`flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex justify-center items-center gap-2 shadow-lg text-white ${partnerStatus === 'sent' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/20 disabled:opacity-50'}`}
              >
                {isSharing ? <Loader2 size={18} className="animate-spin" /> : partnerStatus === 'sent' ? <CheckCircle2 size={18} /> : <Send size={18} />}
                <span>{isSharing ? 'Отправка...' : partnerStatus === 'sent' ? 'Готово!' : `Отправить (${selectedPartners.length})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[400] bg-emerald-500/95 backdrop-blur-md text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center justify-center gap-3 animate-in slide-in-from-top-4 duration-300 font-black text-xs uppercase tracking-widest border border-emerald-400/50">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FULLSCREEN IMAGE VIEWER */}
      {fsImageIndex !== null && (
        <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center bg-black animate-in fade-in duration-200">
          <button onClick={() => setFsImageIndex(null)} className="absolute top-8 right-8 w-14 h-14 bg-gray-900/80 text-white rounded-full flex items-center justify-center transition-all z-[510] active:scale-90">
            <X size={24} />
          </button>
          
          <button 
            onClick={handlePrevPhoto} 
            disabled={fsImageIndex === 0} 
            className="absolute left-6 p-6 text-white hover:text-[#0077FF] disabled:opacity-5 transition-all z-[510] active:scale-75"
          >
            <ChevronLeft size={48} />
          </button>
          
          <button 
            onClick={handleNextPhoto} 
            disabled={fsImageIndex === currentMediaList.length - 1} 
            className="absolute right-6 p-6 text-white hover:text-[#0077FF] disabled:opacity-5 transition-all z-[510] active:scale-75"
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

          <div className="absolute bottom-12 flex flex-col items-center gap-6 z-[510]">
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