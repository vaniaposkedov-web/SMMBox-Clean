import { useEffect, useState, useMemo, useCallback } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, CheckCircle2, Clock, AlertCircle, Search,
  Calendar, Image as ImageIcon, Send, Trash2, 
  X, Share2, LayoutPanelLeft, ChevronRight, Download, 
  RefreshCw, MoreVertical, Loader2, Maximize2, ChevronLeft
} from 'lucide-react';

// Утилита base64ToFile
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
  } catch (e) { return null; }
};

export default function PostsHistory() {
  const navigate = useNavigate();
  const { postsHistory, fetchPostsHistory, deleteScheduledPostAction, saveTempDraft } = useStore();
  
  const [activeTab, setActiveTab] = useState('published');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState(null); 
  const [fsImageIndex, setFsImageIndex] = useState(null); // Индекс для слайдера
  const [showRetryMenu, setShowRetryMenu] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  // === ИСПРАВЛЕНИЕ 1 & 3: БЛОКИРОВКА СКРОЛЛА ФОНА ===
  useEffect(() => {
    if (selectedPost || fsImageIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [selectedPost, fsImageIndex]);

  useEffect(() => { fetchPostsHistory(); }, [fetchPostsHistory]);

  const filteredPosts = useMemo(() => {
    let base = postsHistory || [];
    if (activeTab === 'published') base = base.filter(p => p.status === 'PUBLISHED');
    if (activeTab === 'scheduled') base = base.filter(p => p.status === 'SCHEDULED');
    if (activeTab === 'errors') base = base.filter(p => p.status === 'FAILED');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(p => (p.text && p.text.toLowerCase().includes(q)) || (p.account?.name && p.account.name.toLowerCase().includes(q)));
    }
    return base;
  }, [postsHistory, activeTab, searchQuery]);

  const currentMediaList = useMemo(() => {
    if (!selectedPost) return [];
    try { return JSON.parse(selectedPost.mediaUrls || '[]'); } catch(e) { return []; }
  }, [selectedPost]);

  // === ИСПРАВЛЕНИЕ 2: НАВИГАЦИЯ В СЛАЙДЕРЕ ===
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
      link.download = `photo_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) { window.open(imgUrl, '_blank'); }
  };

  const handleDuplicatePost = (mode) => {
    if (!selectedPost) return;
    setShowRetryMenu(false);
    setIsPreparing(true);
    setTimeout(() => {
      const reconstructedPhotos = currentMediaList.map((base64str, index) => {
        const file = base64ToFile(base64str, `dup_${index}.jpg`);
        return file ? { id: Math.random().toString(36), url: base64str, file } : null;
      }).filter(p => p);
      saveTempDraft({ text: selectedPost.text || '', photos: reconstructedPhotos, step: 1, view: 'wizard', publishMode: mode });
      setTimeout(() => { setIsPreparing(false); navigate('/publish'); }, 300);
    }, 600);
  };

  const PhotoGrid = ({ mediaUrls }) => {
    const images = useMemo(() => { try { return JSON.parse(mediaUrls || '[]'); } catch(e) { return []; } }, [mediaUrls]);
    if (images.length === 0) return null;

    return (
      <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {images.slice(0, 4).map((img, i) => (
          <div key={i} onClick={() => setFsImageIndex(i)} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-900 group cursor-pointer border border-gray-800">
            <img src={img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            {i === 3 && images.length > 4 && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <span className="text-white font-black text-2xl">+{images.length - 3}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Maximize2 className="text-white" size={20} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 font-sans pb-20">
      {/* Шапка */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-admin-card border border-gray-800 p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-black text-white flex items-center gap-3">
          <LayoutPanelLeft className="text-[#0077FF]" size={28} /> История
        </h1>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input type="text" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-3 pl-12 pr-4 text-white outline-none focus:border-[#0077FF] transition-all"/>
        </div>
      </div>

      {/* Табы */}
      <div className="grid grid-cols-3 gap-2 bg-gray-900/50 p-1.5 rounded-2xl border border-gray-800">
        {['published', 'scheduled', 'errors'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`py-3 rounded-xl text-sm font-bold transition-all ${activeTab === t ? 'bg-gray-800 text-white border border-gray-700 shadow-lg' : 'text-gray-500'}`}>
            {t === 'published' ? 'Отправлено' : t === 'scheduled' ? 'В плане' : 'Ошибки'}
          </button>
        ))}
      </div>

      {/* Карточки */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPosts.map(post => (
          <div key={post.id} onClick={() => setSelectedPost(post)} className="bg-admin-card border border-gray-800 rounded-3xl p-5 hover:border-gray-600 transition-all cursor-pointer shadow-lg flex flex-col h-full">
            <div className="flex gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 shrink-0 overflow-hidden">
                <img src={JSON.parse(post.mediaUrls || '[""]')[0]} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-400 mb-1">{post.account?.name}</p>
                <p className="text-white text-sm line-clamp-2 font-medium">{post.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Модалка детального просмотра */}
      {selectedPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in">
          {isPreparing && <div className="absolute inset-0 z-[110] bg-black/80 flex flex-col items-center justify-center rounded-[2.5rem]"><Loader2 className="animate-spin text-blue-500 mb-2" size={40}/><p className="text-white font-bold">Подготовка...</p></div>}
          
          <div className="bg-admin-card w-full max-w-3xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-gray-800 animate-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gray-900/90 shrink-0">
              <h3 className="text-white font-bold">Просмотр публикации</h3>
              <button onClick={() => setSelectedPost(null)} className="p-2 text-gray-400 bg-gray-800 rounded-xl"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-8 pb-32">
              <div className="flex items-center gap-4 mb-8">
                <img src={selectedPost.account?.avatarUrl} className="w-14 h-14 rounded-2xl object-cover border-2 border-gray-800" />
                <div>
                  <h2 className="text-white font-black text-xl">{selectedPost.account?.name}</h2>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{selectedPost.account?.provider} • {new Date(selectedPost.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <p className="text-gray-100 text-lg leading-relaxed whitespace-pre-wrap mb-8">{selectedPost.text}</p>
              <PhotoGrid mediaUrls={selectedPost.mediaUrls} />
            </div>
            {/* Кнопки */}
            <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-gray-800 bg-gray-900/90 flex items-center justify-between">
              <div className="flex gap-2">
                <button className="w-12 h-12 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20"><Share2/></button>
                <button onClick={() => setShowRetryMenu(!showRetryMenu)} className="w-12 h-12 rounded-2xl flex items-center justify-center text-purple-400 border border-purple-500/20 relative">
                  <RefreshCw/>
                  {showRetryMenu && (
                    <div className="absolute bottom-16 left-0 w-48 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-2 z-20">
                      <button onClick={() => handleDuplicatePost('now')} className="w-full text-left p-3 hover:bg-gray-800 rounded-xl text-white text-sm font-bold">Запостить сейчас</button>
                    </div>
                  )}
                </button>
              </div>
              <button onClick={() => { deleteScheduledPostAction(selectedPost.id); setSelectedPost(null); fetchPostsHistory(); }} className="px-6 py-3 bg-red-500/10 text-red-400 rounded-2xl font-bold border border-red-500/20"><Trash2 size={18}/></button>
            </div>
          </div>
        </div>
      )}

      {/* Слайдер на весь экран */}
      {fsImageIndex !== null && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in">
          <button onClick={() => setFsImageIndex(null)} className="absolute top-6 right-6 p-4 bg-gray-900/50 rounded-full text-white z-[160]"><X size={28}/></button>
          
          <button onClick={handlePrevPhoto} disabled={fsImageIndex === 0} className="absolute left-4 p-4 text-white disabled:opacity-20 transition-all z-[160]"><ChevronLeft size={48}/></button>
          <button onClick={handleNextPhoto} disabled={fsImageIndex === currentMediaList.length - 1} className="absolute right-4 p-4 text-white disabled:opacity-20 transition-all z-[160]"><ChevronRight size={48}/></button>

          <div className="w-full max-w-5xl h-[80vh] flex items-center justify-center p-4">
            <img src={currentMediaList[fsImageIndex]} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-90 duration-300" />
          </div>

          <div className="absolute bottom-10 flex flex-col items-center gap-4">
             <div className="px-4 py-2 bg-gray-900/80 rounded-full text-white font-bold text-sm tracking-widest">{fsImageIndex + 1} / {currentMediaList.length}</div>
             <button onClick={() => handleDownload(currentMediaList[fsImageIndex])} className="flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl font-black shadow-2xl"><Download size={20}/> Скачать оригинал</button>
          </div>
        </div>
      )}
    </div>
  );
}