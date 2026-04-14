import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, CheckCircle2, Clock, AlertCircle, Search,
  Calendar, Image as ImageIcon, Send, Trash2, 
  X, Share2, LayoutPanelLeft, ChevronRight, Download, 
  RefreshCw, MoreVertical, Loader2, Maximize2
} from 'lucide-react';

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
    console.error("Ошибка конвертации картинки:", e);
    return null;
  }
};

export default function PostsHistory() {
  const navigate = useNavigate();
  const { postsHistory, fetchPostsHistory, deleteScheduledPostAction, saveTempDraft } = useStore();
  
  const [activeTab, setActiveTab] = useState('published');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedPost, setSelectedPost] = useState(null); 
  const [fullscreenImage, setFullscreenImage] = useState(null); 
  
  const [showRetryMenu, setShowRetryMenu] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

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

  const handleDownload = async (imgUrl, index) => {
    try {
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `smmdeck_photo_${index + 1}.jpg`;
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
      let mediaUrls = [];
      try { mediaUrls = JSON.parse(selectedPost.mediaUrls || '[]'); } catch(e) {}
      
      const reconstructedPhotos = mediaUrls.map((base64str, index) => {
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

  const PhotoGrid = ({ mediaUrls, onImageClick }) => {
    const images = useMemo(() => {
      try { return JSON.parse(mediaUrls || '[]'); } catch(e) { return []; }
    }, [mediaUrls]);
    
    const count = images.length;
    if (count === 0) return null;

    const PhotoItem = ({ img, index, className = "" }) => (
      <div 
        onClick={() => onImageClick({ url: img, index })}
        className={`relative overflow-hidden group cursor-pointer ${className}`}
      >
        <img src={img} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={`media ${index}`} />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Maximize2 className="text-white drop-shadow-md" size={24} />
        </div>
      </div>
    );

    if (count === 1) return <PhotoItem img={images[0]} index={0} className="rounded-2xl border border-gray-800 max-h-[70vh] aspect-auto" />;
    
    if (count === 2) return (
        <div className="grid grid-cols-2 gap-2 aspect-[16/9]">
          <PhotoItem img={images[0]} index={0} className="rounded-l-2xl" />
          <PhotoItem img={images[1]} index={1} className="rounded-r-2xl" />
        </div>
    );

    if (count === 3) return (
        <div className="grid grid-cols-2 gap-2 aspect-[3/2]">
          <PhotoItem img={images[0]} index={0} className="rounded-l-2xl row-span-2" />
          <div className="grid grid-rows-2 gap-2">
            <PhotoItem img={images[1]} index={1} className="rounded-tr-2xl" />
            <PhotoItem img={images[2]} index={2} className="rounded-br-2xl" />
          </div>
        </div>
    );

    if (count === 4) return (
        <div className="grid grid-cols-2 gap-2 aspect-square">
          <PhotoItem img={images[0]} index={0} className="rounded-tl-2xl" />
          <PhotoItem img={images[1]} index={1} className="rounded-tr-2xl" />
          <PhotoItem img={images[2]} index={2} className="rounded-bl-2xl" />
          <PhotoItem img={images[3]} index={3} className="rounded-br-2xl" />
        </div>
    );

    return (
      <div className="grid grid-cols-2 gap-2 aspect-square">
        <PhotoItem img={images[0]} index={0} className="rounded-tl-2xl" />
        <PhotoItem img={images[1]} index={1} className="rounded-tr-2xl" />
        <PhotoItem img={images[2]} index={2} className="rounded-bl-2xl" />
        <div className="relative rounded-br-2xl overflow-hidden group cursor-pointer" onClick={() => onImageClick({ url: images[3], index: 3 })}>
          <img src={images[3]} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center border-l border-t border-gray-800">
            <span className="text-white text-4xl font-black">+{count - 3}</span>
            <span className="text-gray-300 text-xs mt-1 font-bold">фото</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 font-sans pb-20">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-admin-card border border-gray-800 p-6 rounded-3xl shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3 tracking-tighter">
            <LayoutPanelLeft className="text-[#0077FF]" size={28} />
            Контент-центр
          </h1>
          <p className="text-gray-500 text-sm mt-1">Вся история ваших публикаций</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input type="text" placeholder="Поиск по тексту..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-3 pl-12 pr-4 text-white outline-none focus:border-[#0077FF] transition-all shadow-inner"/>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 bg-gray-900/50 p-1.5 rounded-2xl border border-gray-800">
        {[
          { id: 'published', label: 'Отправлено', icon: CheckCircle2, color: 'text-emerald-400' },
          { id: 'scheduled', label: 'В плане', icon: Clock, color: 'text-purple-400' },
          { id: 'errors', label: 'Ошибки', icon: AlertCircle, color: 'text-rose-400' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-gray-800 text-white shadow-lg border border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}>
            <tab.icon size={18} className={activeTab === tab.id ? tab.color : 'text-gray-600'} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPosts.map(post => {
          let mediaCount = 0;
          try { mediaCount = JSON.parse(post.mediaUrls || '[]').length; } catch(e) {}
          
          return (
            <div key={post.id} onClick={() => setSelectedPost(post)}
              className="bg-admin-card border border-gray-800 rounded-3xl p-5 hover:border-gray-600 transition-all cursor-pointer group relative overflow-hidden shadow-lg flex flex-col h-full">
              <div className="flex gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 shrink-0 overflow-hidden relative">
                  {mediaCount > 0 ? (
                    <img src={JSON.parse(post.mediaUrls)[0]} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-700" size={24} />
                  )}
                  {mediaCount > 1 && (
                    <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded-lg font-bold border border-white/10">
                      +{mediaCount - 1}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-md bg-gray-800 overflow-hidden shrink-0 border border-gray-700">
                      {post.account?.avatarUrl ? <img src={post.account.avatarUrl} className="w-full h-full object-cover"/> : null}
                    </div>
                    <span className="text-xs font-bold text-gray-400 truncate">{post.account?.name || 'Аккаунт'}</span>
                  </div>
                  <p className="text-white text-sm line-clamp-2 font-medium leading-relaxed">
                    {post.text || <span className="text-gray-600 italic">Без текста</span>}
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-gray-800 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1.5 bg-gray-900 px-2 py-1 rounded-md">
                  <Calendar size={12} />
                  {new Date(post.publishAt || post.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <ChevronRight className="text-gray-600 group-hover:text-[#0077FF] transition-colors" size={18}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* === ИСПРАВЛЕННАЯ МОДАЛКА: Отступы (p-4) и Закругления (rounded-[2rem]) === */}
      {selectedPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          
          {isPreparing && (
            <div className="absolute inset-0 z-[160] bg-black/80 backdrop-blur-lg flex flex-col items-center justify-center rounded-[2rem]">
               <Loader2 className="animate-spin text-[#0077FF] mb-4" size={48} />
               <p className="text-white font-bold text-xl tracking-tight">Парсим медиафайлы...</p>
               <p className="text-gray-400 text-sm mt-1">Это займет пару секунд</p>
            </div>
          )}

          {/* КОНТЕЙНЕР: Теперь всегда с отступами и круглыми краями */}
          <div className="bg-admin-card w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative border border-gray-800 animate-in zoom-in-95 duration-300">
            
            {/* ЕДИНАЯ ШАПКА ДЛЯ ВСЕХ УСТРОЙСТВ */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800 bg-gray-900/90 backdrop-blur-md shrink-0 z-10">
                <h3 className="text-white font-bold text-sm sm:text-base flex items-center gap-2">
                  <LayoutPanelLeft size={18} className="text-[#0077FF]" />
                  Просмотр публикации
                </h3>
                <button onClick={() => setSelectedPost(null)} className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8 pb-[100px]">
              <div className="flex items-center gap-4 mb-6 md:mb-8 pb-6 border-b border-gray-800/50">
                <div className="w-14 h-14 rounded-2xl bg-gray-900 overflow-hidden border-2 border-gray-800 shrink-0 shadow-inner p-0.5">
                  {selectedPost.account?.avatarUrl ? <img src={selectedPost.account.avatarUrl} className="w-full h-full object-cover rounded-[14px]"/> : <ImageIcon className="text-gray-700 w-full h-full p-3"/>}
                </div>
                <div>
                  <h2 className="text-white font-black text-xl tracking-tight leading-tight break-words">{selectedPost.account?.name || 'Загрузка...'}</h2>
                  <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-blue-400 font-bold uppercase tracking-wider bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">{selectedPost.account?.provider}</span>
                      <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                        <Calendar size={13} />
                        {new Date(selectedPost.publishAt || selectedPost.createdAt).toLocaleString('ru-RU')}
                      </span>
                  </div>
                </div>
              </div>

              {selectedPost.text && (
                <div className="mb-8 md:mb-10">
                  <p className="text-gray-100 text-base md:text-lg leading-relaxed whitespace-pre-wrap break-words font-medium">
                    {selectedPost.text}
                  </p>
                </div>
              )}

              <div className="mb-4">
                 <PhotoGrid 
                    mediaUrls={selectedPost.mediaUrls} 
                    onImageClick={setFullscreenImage} 
                 />
              </div>
            </div>

            {/* ПЛАШКА С КНОПКАМИ СНИЗУ */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 border-t border-gray-800 bg-gray-900/90 backdrop-blur-lg shrink-0 z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button 
                  title="Поделиться с партнерами"
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20 transition-all active:scale-95"
                >
                  <Share2 size={20} />
                </button>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowRetryMenu(!showRetryMenu)}
                    title="Повторить пост"
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-purple-400 hover:bg-purple-500 hover:text-white border border-purple-500/20 transition-all active:scale-95"
                  >
                    <RefreshCw size={20} />
                  </button>
                  
                  {showRetryMenu && (
                    <div className="absolute bottom-16 left-0 w-56 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200 p-1.5">
                      <button onClick={() => handleDuplicatePost('schedule')} className="w-full flex items-center gap-3.5 px-4 py-3.5 text-sm text-white hover:bg-gray-800 font-bold transition-colors rounded-xl">
                        <Clock size={18} className="text-purple-400 shrink-0"/> Отложенный пост
                      </button>
                      <button onClick={() => handleDuplicatePost('now')} className="w-full flex items-center gap-3.5 px-4 py-3.5 text-sm text-white hover:bg-gray-800 font-bold transition-colors border-t border-gray-800 rounded-xl">
                        <Send size={18} className="text-blue-400 shrink-0"/> Запостить сейчас
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={() => handleDelete(selectedPost.id)}
                className="flex items-center gap-2.5 px-6 py-3.5 bg-gray-800 hover:bg-red-600/20 text-gray-400 hover:text-red-400 rounded-2xl font-bold text-sm transition-all active:scale-95 border border-gray-700 hover:border-red-500/30"
              >
                <Trash2 size={18} /> Удалить из истории
              </button>
            </div>

          </div>
        </div>
      )}

      {fullscreenImage && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
          <button onClick={() => setFullscreenImage(null)} className="absolute top-6 right-6 w-12 h-12 bg-gray-900/50 hover:bg-gray-800 text-white rounded-full flex items-center justify-center z-10">
            <X size={24} />
          </button>
          <div className="w-full h-[75vh] flex items-center justify-center p-4">
            <img src={fullscreenImage.url} alt="Fullscreen" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
          </div>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
            <button onClick={() => handleDownload(fullscreenImage.url, fullscreenImage.index)}
              className="flex items-center gap-3 px-8 py-4 bg-white hover:bg-gray-200 text-black rounded-2xl font-black transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              <Download size={20} /> Скачать
            </button>
          </div>
        </div>
      )}

    </div>
  );
}