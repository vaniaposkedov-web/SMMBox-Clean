import { useEffect, useState, useMemo, useCallback } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, CheckCircle2, Clock, AlertCircle, Search,
  Calendar, Image as ImageIcon, Send, Trash2, 
  X, Share2, LayoutPanelLeft, ChevronRight, Download, 
  RefreshCw, MoreVertical, Loader2, Maximize2, ChevronLeft
} from 'lucide-react';

// === Утилита для восстановления файлов из истории ===
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

export default function PostsHistory() {
  const navigate = useNavigate();
  const { postsHistory, fetchPostsHistory, deleteScheduledPostAction, saveTempDraft } = useStore();
  
  const [activeTab, setActiveTab] = useState('published');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedPost, setSelectedPost] = useState(null); 
  const [fsImageIndex, setFsImageIndex] = useState(null); // Индекс для полноэкранного слайдера
  
  const [showRetryMenu, setShowRetryMenu] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  // === ИСПРАВЛЕНИЕ: БЛОКИРОВКА СКРОЛЛА ФОНА ===
  useEffect(() => {
    if (selectedPost || fsImageIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [selectedPost, fsImageIndex]);

  useEffect(() => {
    fetchPostsHistory();
  }, [fetchPostsHistory]);

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

  // Массив медиа выбранного поста для слайдера
  const currentMediaList = useMemo(() => {
    if (!selectedPost) return [];
    try {
      return JSON.parse(selectedPost.mediaUrls || '[]');
    } catch(e) { return []; }
  }, [selectedPost]);

  // === НАВИГАЦИЯ СЛАЙДЕРА ===
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
      link.download = `smmdeck_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      window.open(imgUrl, '_blank');
    }
  };

  const handleDuplicatePost = (mode) => {
    if (!selectedPost) return;
    setShowRetryMenu(false);
    setIsPreparing(true);

    setTimeout(() => {
      const reconstructedPhotos = currentMediaList.map((base64str, index) => {
        const file = base64ToFile(base64str, `duplicate_${index}.jpg`);
        return file ? {
          id: `dup_${Math.random().toString(36).substr(2, 9)}`,
          url: base64str,
          file: file
        } : null;
      }).filter(p => p !== null);

      saveTempDraft({ 
        text: selectedPost.text || '', 
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

  const handleDelete = async (id) => {
    if (window.confirm('Удалить этот пост из истории?')) {
      await deleteScheduledPostAction(id);
      setSelectedPost(null);
      fetchPostsHistory();
    }
  };

  // Компонент сетки (до 10 фото)
  const PhotoGrid = ({ mediaUrls }) => {
    const images = useMemo(() => {
      try { return JSON.parse(mediaUrls || '[]'); } catch(e) { return []; }
    }, [mediaUrls]);
    
    if (images.length === 0) return null;

    return (
      <div className={`grid gap-3 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {images.slice(0, 4).map((img, i) => (
          <div 
            key={i} 
            onClick={() => setFsImageIndex(i)}
            className="relative aspect-square rounded-[1.5rem] overflow-hidden bg-gray-900 group cursor-pointer border border-gray-800"
          >
            <img src={img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="media" />
            {i === 3 && images.length > 4 && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center border-l border-t border-gray-700">
                <span className="text-white text-3xl font-black">+{images.length - 3}</span>
                <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">фото</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Maximize2 className="text-white drop-shadow-lg" size={28} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full space-y-8 font-sans pb-20">
      
      {/* Шапка */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-admin-card border border-gray-800 p-8 rounded-[2.5rem] shadow-2xl">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-4 tracking-tighter">
            <LayoutPanelLeft className="text-[#0077FF]" size={32} />
            История контента
          </h1>
          <p className="text-gray-500 font-medium mt-1">Архив и управление вашими публикациями</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input 
            type="text" 
            placeholder="Поиск по тексту или аккаунту..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-4 pl-14 pr-6 text-white outline-none focus:border-[#0077FF] transition-all shadow-inner font-medium"
          />
        </div>
      </div>

      {/* Табы */}
      <div className="grid grid-cols-3 gap-3 bg-gray-900/50 p-2 rounded-[1.8rem] border border-gray-800">
        {[
          { id: 'published', label: 'Отправлено', icon: CheckCircle2, color: 'text-emerald-400' },
          { id: 'scheduled', label: 'В плане', icon: Clock, color: 'text-purple-400' },
          { id: 'errors', label: 'Ошибки', icon: AlertCircle, color: 'text-rose-400' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-black transition-all ${activeTab === tab.id ? 'bg-gray-800 text-white shadow-xl border border-gray-700 translate-y-[-2px]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <tab.icon size={20} className={activeTab === tab.id ? tab.color : 'text-gray-600'} />
            <span className="hidden sm:inline uppercase tracking-wider">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Сетка постов */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPosts.map(post => (
          <div 
            key={post.id} 
            onClick={() => setSelectedPost(post)}
            className="bg-admin-card border border-gray-800 rounded-[2rem] p-6 hover:border-gray-600 transition-all cursor-pointer group shadow-lg flex flex-col h-full active:scale-[0.98]"
          >
            <div className="flex gap-5 mb-5">
              <div className="w-20 h-20 rounded-[1.2rem] bg-gray-900 border border-gray-800 shrink-0 overflow-hidden relative">
                <img src={JSON.parse(post.mediaUrls || '[""]')[0]} className="w-full h-full object-cover" alt="prev" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-gray-800 overflow-hidden border border-gray-700">
                    {post.account?.avatarUrl && <img src={post.account.avatarUrl} className="w-full h-full object-cover"/>}
                  </div>
                  <span className="text-xs font-black text-gray-500 truncate uppercase tracking-widest">{post.account?.name}</span>
                </div>
                <p className="text-white text-sm line-clamp-2 font-bold leading-relaxed">{post.text || 'Без текста'}</p>
              </div>
            </div>
            <div className="mt-auto pt-5 border-t border-gray-800 flex items-center justify-between">
              <span className="text-[11px] font-black text-gray-500 flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-800">
                <Calendar size={14} className="text-[#0077FF]"/>
                {new Date(post.publishAt || post.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <ChevronRight className="text-gray-700 group-hover:text-[#0077FF] transition-all group-hover:translate-x-1" size={22}/>
            </div>
          </div>
        ))}
      </div>

      {/* === МОДАЛКА ПРОСМОТРА ПОСТА === */}
      {selectedPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          
          {isPreparing && (
            <div className="absolute inset-0 z-[160] bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center rounded-[2.5rem]">
               <Loader2 className="animate-spin text-[#0077FF] mb-6" size={56} />
               <p className="text-white font-black text-2xl tracking-tighter uppercase">Реконструкция данных...</p>
            </div>
          )}

          <div className="bg-[#0d0f13] w-full max-w-4xl max-h-[92vh] rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden relative border border-gray-800/50 animate-in zoom-in-95 duration-300">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-gray-800/50 bg-gray-900/50 shrink-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-2xl text-[#0077FF]">
                    <FileText size={24}/>
                  </div>
                  <h3 className="text-white font-black text-xl tracking-tight uppercase">Детали публикации</h3>
                </div>
                <button 
                  onClick={() => setSelectedPost(null)} 
                  className="p-3 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-2xl transition-all active:scale-90"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10 pb-40">
              
              {/* Profile Bar */}
              <div className="flex items-center gap-5 mb-10 pb-8 border-b border-gray-800/30">
                <div className="w-16 h-16 rounded-[1.5rem] bg-gray-900 overflow-hidden border-2 border-gray-800 p-1 shrink-0">
                  <img src={selectedPost.account?.avatarUrl} className="w-full h-full object-cover rounded-[1.1rem]"/>
                </div>
                <div>
                  <h2 className="text-white font-black text-2xl tracking-tighter leading-tight">{selectedPost.account?.name}</h2>
                  <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em] bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
                        {selectedPost.account?.provider}
                      </span>
                      <span className="text-xs text-gray-500 font-bold flex items-center gap-2">
                        <Calendar size={14} />
                        {new Date(selectedPost.publishAt || selectedPost.createdAt).toLocaleString()}
                      </span>
                  </div>
                </div>
              </div>

              {/* Text Block */}
              {selectedPost.text && (
                <div className="mb-12 bg-gray-900/30 p-8 rounded-[2rem] border border-gray-800/50">
                  <p className="text-gray-100 text-lg md:text-xl leading-relaxed whitespace-pre-wrap font-medium">
                    {selectedPost.text}
                  </p>
                </div>
              )}

              {/* Photo Grid */}
              <div className="mb-6">
                 <PhotoGrid mediaUrls={selectedPost.mediaUrls} />
              </div>
            </div>

            {/* Fixed Action Panel */}
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 border-t border-gray-800 bg-gray-900/95 backdrop-blur-2xl flex items-center justify-between gap-4 z-10">
              <div className="flex items-center gap-3">
                <button 
                  title="Поделиться с партнерами"
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20 transition-all active:scale-95 shadow-lg shadow-blue-500/10"
                >
                  <Share2 size={24} />
                </button>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowRetryMenu(!showRetryMenu)}
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-purple-400 hover:bg-purple-500 hover:text-white border border-purple-500/20 transition-all active:scale-95"
                  >
                    <RefreshCw size={24} />
                  </button>
                  
                  {showRetryMenu && (
                    <div className="absolute bottom-20 left-0 w-64 bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl p-2 z-50 animate-in slide-in-from-bottom-4 duration-300">
                      <button onClick={() => handleDuplicatePost('schedule')} className="w-full flex items-center gap-4 px-5 py-4 text-sm text-white hover:bg-gray-800 font-black uppercase tracking-widest transition-all rounded-2xl mb-1">
                        <Clock size={20} className="text-purple-400"/> В очередь
                      </button>
                      <button onClick={() => handleDuplicatePost('now')} className="w-full flex items-center gap-4 px-5 py-4 text-sm text-white hover:bg-gray-800 font-black uppercase tracking-widest transition-all rounded-2xl border-t border-gray-800">
                        <Send size={20} className="text-blue-400"/> Прямо сейчас
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={() => handleDelete(selectedPost.id)}
                className="flex items-center gap-3 px-8 py-4 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all active:scale-95 border border-red-500/20"
              >
                <Trash2 size={20} /> Удалить архив
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === ПОЛНОЭКРАННЫЙ СЛАЙДЕР С НАВИГАЦИЕЙ === */}
      {fsImageIndex !== null && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black animate-in fade-in duration-300">
          
          {/* Controls */}
          <button 
            onClick={() => setFsImageIndex(null)} 
            className="absolute top-8 right-8 w-14 h-14 bg-gray-900/80 hover:bg-white hover:text-black text-white rounded-full flex items-center justify-center transition-all z-[210] active:scale-90"
          >
            <X size={32} />
          </button>

          {/* Left Arrow */}
          <button 
            onClick={handlePrevPhoto} 
            disabled={fsImageIndex === 0}
            className="absolute left-6 p-6 text-white hover:text-[#0077FF] disabled:opacity-5 transition-all z-[210] active:scale-75"
          >
            <ChevronLeft size={64}/>
          </button>

          {/* Right Arrow */}
          <button 
            onClick={handleNextPhoto} 
            disabled={fsImageIndex === currentMediaList.length - 1}
            className="absolute right-6 p-6 text-white hover:text-[#0077FF] disabled:opacity-5 transition-all z-[210] active:scale-75"
          >
            <ChevronRight size={64}/>
          </button>

          {/* Image Container */}
          <div className="w-full h-full flex items-center justify-center p-6 md:p-12 select-none">
            <img 
              key={fsImageIndex}
              src={currentMediaList[fsImageIndex]} 
              className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_80px_rgba(0,119,255,0.15)] animate-in zoom-in-95 duration-500" 
            />
          </div>

          {/* Footer Info & Download */}
          <div className="absolute bottom-12 flex flex-col items-center gap-6 z-[210]">
             <div className="px-6 py-2 bg-gray-900/90 border border-gray-800 rounded-full text-white font-black text-xs tracking-[0.3em] uppercase">
                {fsImageIndex + 1} / {currentMediaList.length}
             </div>
             <button 
               onClick={() => handleDownload(currentMediaList[fsImageIndex])}
               className="flex items-center gap-4 px-10 py-5 bg-white hover:bg-gray-200 text-black rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-2xl"
             >
               <Download size={24}/> Сохранить фото
             </button>
          </div>
        </div>
      )}

    </div>
  );
}