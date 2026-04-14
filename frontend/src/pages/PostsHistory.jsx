import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store';
import { 
  FileText, CheckCircle2, Clock, AlertCircle, Search,
  Calendar, Image as ImageIcon, Send, MoreVertical, Trash2, 
  X, ExternalLink, Share2, LayoutPanelLeft, ChevronRight
} from 'lucide-react';

export default function PostsHistory() {
  const { postsHistory, fetchPostsHistory, retryFailedPost, deleteScheduledPostAction } = useStore();
  const [activeTab, setActiveTab] = useState('published');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState(null); // Для модалки детального вида

  useEffect(() => {
    fetchPostsHistory();
  }, [fetchPostsHistory]);

  // 1. Улучшенная фильтрация и поиск
  const filteredPosts = useMemo(() => {
    let base = postsHistory;
    
    // Фильтр по табам
    if (activeTab === 'published') base = base.filter(p => p.status === 'PUBLISHED');
    if (activeTab === 'scheduled') base = base.filter(p => p.status === 'SCHEDULED');
    if (activeTab === 'errors') base = base.filter(p => p.status === 'FAILED');

    // Поиск по тексту поста или названию группы
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(p => 
        (p.text && p.text.toLowerCase().includes(q)) || 
        (p.account?.name && p.account.name.toLowerCase().includes(q))
      );
    }
    return base;
  }, [postsHistory, activeTab, searchQuery]);

  return (
    <div className="w-full space-y-6 font-sans pb-20">
      
      {/* Шапка с Поиском */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-admin-card border border-gray-800 p-6 rounded-3xl shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <LayoutPanelLeft className="text-blue-500" size={28} />
            Контент-центр
          </h1>
          <p className="text-gray-500 text-sm mt-1">Управление всеми вашими публикациями</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text"
            placeholder="Поиск по постам или группам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-3 pl-12 pr-4 text-white outline-none focus:border-blue-500 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Табы категорий */}
      <div className="grid grid-cols-3 gap-2 bg-gray-900/50 p-1.5 rounded-2xl border border-gray-800">
        {[
          { id: 'published', label: 'Отправлено', icon: CheckCircle2, color: 'text-emerald-400' },
          { id: 'scheduled', label: 'В плане', icon: Clock, color: 'text-blue-400' },
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

      {/* Сетка карточек */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPosts.map(post => (
          <div 
            key={post.id} 
            onClick={() => setSelectedPost(post)}
            className="bg-admin-card border border-gray-800 rounded-3xl p-5 hover:border-blue-500/50 transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex gap-4">
              {/* Превью фото */}
              <div className="w-20 h-20 rounded-2xl bg-gray-900 border border-gray-800 shrink-0 overflow-hidden relative">
                {post.mediaUrls && JSON.parse(post.mediaUrls).length > 0 ? (
                  <img src={JSON.parse(post.mediaUrls)[0]} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-700" />
                )}
                {post.mediaUrls && JSON.parse(post.mediaUrls).length > 1 && (
                  <div className="absolute bottom-1 right-1 bg-black/60 text-[10px] text-white px-1.5 rounded-md">
                    +{JSON.parse(post.mediaUrls).length - 1}
                  </div>
                )}
              </div>

              {/* Инфо */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center p-1">
                    {/* Тут можно сделать иконку соцсети в зависимости от post.account.provider */}
                    <span className="text-[8px] font-black text-white">
                      {post.account?.provider?.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gray-400 truncate">{post.account?.name || 'Аккаунт'}</span>
                </div>
                <p className="text-white text-sm line-clamp-2 font-medium leading-relaxed">
                  {post.text || 'Без текста...'}
                </p>
              </div>
              
              <ChevronRight className="text-gray-700 group-hover:text-blue-500 transition-colors" />
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1.5">
                <Calendar size={12} />
                {new Date(post.publishAt || post.createdAt).toLocaleString('ru-RU')}
              </span>
              <div className="flex items-center gap-2">
                 <button className="p-2 bg-gray-900 rounded-xl text-gray-500 hover:text-purple-400 transition-colors">
                    <Share2 size={16} />
                 </button>
                 <button className="p-2 bg-gray-900 rounded-xl text-gray-500 hover:text-rose-500 transition-colors">
                    <Trash2 size={16} />
                 </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* === ДЕТАЛЬНАЯ МОДАЛКА (Задание №3) === */}
      {selectedPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setSelectedPost(null)}></div>
          <div className="relative w-full max-w-4xl bg-admin-card border border-gray-800 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
            
            {/* Левая часть: Галерея */}
            <div className="w-full md:w-1/2 bg-black flex items-center justify-center p-2 relative">
               <button onClick={() => setSelectedPost(null)} className="absolute top-4 left-4 z-10 p-3 bg-gray-900/80 text-white rounded-full md:hidden">
                  <X size={20} />
               </button>
               <div className="grid grid-cols-1 gap-2 w-full h-full overflow-y-auto custom-scrollbar p-2">
                  {JSON.parse(selectedPost.mediaUrls || '[]').map((img, i) => (
                    <img key={i} src={img} className="w-full rounded-2xl object-contain" alt={`Slide ${i}`} />
                  ))}
               </div>
            </div>

            {/* Правая часть: Контент */}
            <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col overflow-y-auto">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                     <img src={selectedPost.account?.avatarUrl} className="w-12 h-12 rounded-2xl object-cover border border-gray-700" />
                     <div>
                        <h3 className="text-white font-bold">{selectedPost.account?.name}</h3>
                        <p className="text-xs text-blue-500 font-bold uppercase tracking-widest">{selectedPost.account?.provider}</p>
                     </div>
                  </div>
                  <button onClick={() => setSelectedPost(null)} className="hidden md:flex p-3 bg-gray-900 text-gray-500 hover:text-white rounded-2xl transition-all">
                    <X size={20} />
                  </button>
               </div>

               <div className="flex-1">
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3">Текст публикации</h4>
                  <div className="text-gray-200 leading-relaxed whitespace-pre-wrap text-base">
                    {selectedPost.text}
                  </div>
               </div>

               <div className="mt-10 pt-6 border-t border-gray-800 space-y-4">
                  <div className="flex gap-3">
                    <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                      <ExternalLink size={18} /> Открыть пост
                    </button>
                    <button className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-purple-500/20">
                      <Share2 size={18} /> Партнерам
                    </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}