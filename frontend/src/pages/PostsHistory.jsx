import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, CheckCircle2, Clock, AlertCircle, Search,
  Calendar, Image as ImageIcon, Send, Trash2, 
  X, Share2, LayoutPanelLeft, ChevronRight, Download, 
  RefreshCw, MoreVertical, Loader2, PlusSquare
} from 'lucide-react';

// Утилита для конвертации base64 в объект File (нужна для передачи в Publish.jsx)
const base64ToFile = (base64String, filename) => {
  try {
    const arr = base64String.split(',');
    if (arr.length < 2) return null; // Если это просто URL, а не base64
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
  
  const [selectedPost, setSelectedPost] = useState(null); // Модалка поста
  const [fullscreenImage, setFullscreenImage] = useState(null); // Fullscreen картинки
  
  const [showRetryMenu, setShowRetryMenu] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepProgress, setPrepProgress] = useState(0);

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

  // === СКАЧИВАНИЕ ФОТО (Кроссплатформенное) ===
  const handleDownload = async (imgUrl, index) => {
    try {
      // Пытаемся получить Blob, чтобы заставить браузер именно СКАЧАТЬ файл
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
      console.error('Ошибка при скачивании Blob, открываем в новой вкладке', error);
      // Фолбэк для iOS Safari, если CORS блокирует fetch
      window.open(imgUrl, '_blank');
    }
  };

  // === ПОВТОР ПОСТА (Перенос в Publish.jsx) ===
  const handleDuplicatePost = (mode) => {
    if (!selectedPost) return;
    setShowRetryMenu(false);
    setIsPreparing(true);
    setPrepProgress(10);

    // Эмуляция сборки и обработки файлов
    const interval = setInterval(() => {
      setPrepProgress(p => (p < 90 ? p + 20 : p));
    }, 150);

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

      clearInterval(interval);
      setPrepProgress(100);

      // Сохраняем черновик в Zustand и указываем шаг и режим
      saveTempDraft({ 
        text: selectedPost.text || '', 
        photos: reconstructedPhotos,
        step: 1, // Пользователь окажется на вкладке "Фото"
        view: 'wizard',
        publishMode: mode // 'now' или 'schedule'
      });

      // Перекидываем на страницу публикации
      setTimeout(() => {
        setIsPreparing(false);
        navigate('/publish');
      }, 300);

    }, 800);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Удалить этот пост из истории?')) {
      await deleteScheduledPostAction(id);
      setSelectedPost(null);
      fetchPostsHistory();
    }
  };

  return (
    <div className="w-full space-y-6 font-sans pb-20">
      
      {/* Шапка с Поиском */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-admin-card border border-gray-800 p-6 rounded-3xl shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <LayoutPanelLeft className="text-[#0077FF]" size={28} />
            История публикаций
          </h1>
          <p className="text-gray-500 text-sm mt-1">Управление отправленным контентом</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text"
            placeholder="Поиск по тексту или группе..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-3 pl-12 pr-4 text-white outline-none focus:border-[#0077FF] transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Табы категорий */}
      <div className="grid grid-cols-3 gap-2 bg-gray-900/50 p-1.5 rounded-2xl border border-gray-800">
        {[
          { id: 'published', label: 'Отправлено', icon: CheckCircle2, color: 'text-emerald-400' },
          { id: 'scheduled', label: 'В плане', icon: Clock, color: 'text-purple-400' },
          { id: 'errors', label: 'Ошибки', icon: AlertCircle, color: 'text-rose-400' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-gray-800 text-white shadow-lg border border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <tab.icon size={18} className={activeTab === tab.id ? tab.color : 'text-gray-600'} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Сетка карточек постов */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPosts.map(post => (
          <div 
            key={post.id} 
            onClick={() => setSelectedPost(post)}
            className="bg-admin-card border border-gray-800 rounded-3xl p-5 hover:border-gray-600 transition-all cursor-pointer group relative overflow-hidden shadow-lg flex flex-col h-full"
          >
            <div className="flex gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 shrink-0 overflow-hidden relative">
                {post.mediaUrls && JSON.parse(post.mediaUrls).length > 0 ? (
                  <img src={JSON.parse(post.mediaUrls)[0]} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-700" size={24} />
                )}
                {post.mediaUrls && JSON.parse(post.mediaUrls).length > 1 && (
                  <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded-lg font-bold border border-white/10">
                    +{JSON.parse(post.mediaUrls).length - 1}
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
        ))}
      </div>

      {/* === 1. ДЕТАЛЬНАЯ МОДАЛКА === */}
      {selectedPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm sm:p-6 animate-in fade-in duration-200">
          
          {/* Прогресс-бар загрузки (перенос в Publish) */}
          {isPreparing && (
            <div className="absolute inset-0 z-[150] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center rounded-[2rem]">
               <Loader2 className="animate-spin text-[#0077FF] mb-4" size={40} />
               <p className="text-white font-bold mb-2">Подготовка поста...</p>
               <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden">
                 <div className="h-full bg-[#0077FF] transition-all duration-150" style={{ width: `${prepProgress}%` }}></div>
               </div>
            </div>
          )}

          <div className="bg-[#0d0f13] w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative border border-gray-800/50">
            
            {/* ШАПКА (Стикки) */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md shrink-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-800 overflow-hidden border border-gray-700">
                  {selectedPost.account?.avatarUrl ? <img src={selectedPost.account.avatarUrl} className="w-full h-full object-cover"/> : null}
                </div>
                <div>
                  <p className="text-white font-bold text-sm sm:text-base leading-tight truncate max-w-[150px] sm:max-w-xs">{selectedPost.account?.name}</p>
                  <p className="text-[10px] text-gray-400">{new Date(selectedPost.publishAt || selectedPost.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2 relative">
                <button 
                  title="Поделиться с партнерами"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-colors"
                >
                  <Share2 size={18} />
                </button>
                
                {/* Кнопка Повторить с Dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => setShowRetryMenu(!showRetryMenu)}
                    title="Повторить / Изменить"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-purple-400 hover:bg-purple-500/20 transition-colors"
                  >
                    <RefreshCw size={18} />
                  </button>
                  
                  {showRetryMenu && (
                    <div className="absolute right-0 top-12 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50 animate-in slide-in-from-top-2">
                      <button onClick={() => handleDuplicatePost('schedule')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-gray-800 font-bold transition-colors">
                        <Clock size={16} className="text-purple-400"/> Отложенный пост
                      </button>
                      <button onClick={() => handleDuplicatePost('now')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-gray-800 font-bold transition-colors border-t border-gray-800">
                        <Send size={16} className="text-blue-400"/> Запостить сейчас
                      </button>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => handleDelete(selectedPost.id)}
                  title="Удалить из истории"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
                
                <div className="w-px h-6 bg-gray-700 mx-1"></div>

                <button onClick={() => setSelectedPost(null)} className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white transition-colors bg-gray-900/50">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* КОНТЕНТ ПОСТА (Скроллится) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 pb-12">
              
              {/* Фотографии */}
              {selectedPost.mediaUrls && JSON.parse(selectedPost.mediaUrls).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                  {JSON.parse(selectedPost.mediaUrls).map((imgUrl, i) => (
                    <div 
                      key={i} 
                      onClick={() => setFullscreenImage({ url: imgUrl, index: i })}
                      className="aspect-square bg-gray-900 rounded-xl overflow-hidden border border-gray-800 relative group cursor-pointer"
                    >
                      <img src={imgUrl} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt="media" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ImageIcon className="text-white drop-shadow-md" size={24} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Текст */}
              <div className="bg-gray-900/40 border border-gray-800/50 p-5 rounded-2xl">
                {selectedPost.text ? (
                  <p className="text-gray-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
                    {selectedPost.text}
                  </p>
                ) : (
                  <p className="text-gray-600 italic text-center py-4">В этом посте нет текста</p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* === 2. FULL-SCREEN ПРОСМОТР ФОТО === */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
          
          {/* Кнопка Закрыть */}
          <button 
            onClick={() => setFullscreenImage(null)} 
            className="absolute top-6 right-6 w-12 h-12 bg-gray-900/50 hover:bg-gray-800 text-white rounded-full flex items-center justify-center transition-colors z-10"
          >
            <X size={24} />
          </button>

          {/* Изображение */}
          <div className="w-full h-[75vh] flex items-center justify-center p-4">
            <img 
              src={fullscreenImage.url} 
              alt="Fullscreen" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" 
            />
          </div>

          {/* Кнопка Скачать (Кроссплатформенная) */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
            <button 
              onClick={() => handleDownload(fullscreenImage.url, fullscreenImage.index)}
              className="flex items-center gap-3 px-8 py-4 bg-white hover:bg-gray-200 text-black rounded-2xl font-black text-sm sm:text-base transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            >
              <Download size={20} /> Скачать на устройство
            </button>
          </div>
        </div>
      )}

    </div>
  );
}