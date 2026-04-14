import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { 
  FileText, CheckCircle2, Clock, AlertCircle, 
  Calendar, Image as ImageIcon, Send, MoreVertical, Trash2, Edit3, Loader2
} from 'lucide-react';

export default function PostsHistory() {
  const { postsHistory, fetchPostsHistory, retryFailedPost, deleteScheduledPostAction } = useStore();
  const [activeTab, setActiveTab] = useState('published');
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    fetchPostsHistory();
  }, [fetchPostsHistory]);

  // Фильтруем реальные данные по статусам из БД
  const publishedPosts = postsHistory.filter(p => p.status === 'PUBLISHED');
  const scheduledPosts = postsHistory.filter(p => p.status === 'SCHEDULED');
  const errorPosts = postsHistory.filter(p => p.status === 'FAILED');

  const getCurrentList = () => {
    switch(activeTab) {
      case 'published': return publishedPosts;
      case 'scheduled': return scheduledPosts;
      case 'errors': return errorPosts;
      default: return [];
    }
  };

  const currentList = getCurrentList();

  const handleRetry = async (id) => {
    setLoadingId(id);
    await retryFailedPost(id);
    setLoadingId(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Удалить этот пост из истории?')) {
      await deleteScheduledPostAction(id);
      fetchPostsHistory(); // Обновляем список после удаления
    }
  };

  return (
    <div className="w-full space-y-6 sm:space-y-8 font-sans pb-10">
      
      {/* Заголовок */}
      <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-3xl p-5 sm:p-8 shadow-lg">
        <h1 className="text-xl sm:text-3xl font-extrabold text-white flex items-center gap-3 tracking-tight">
          <FileText className="text-blue-500 shrink-0" size={28} /> 
          <span>История публикаций</span>
        </h1>
        <p className="text-gray-400 mt-2 text-sm max-w-xl leading-relaxed">
          Управляйте вашим контентом: отслеживайте статус, исправляйте ошибки и планируйте ленту.
        </p>
      </div>

      {/* Вкладки */}
      <div className="bg-admin-card border border-gray-800 rounded-2xl p-1.5 flex flex-wrap sm:flex-nowrap gap-1">
        <button onClick={() => setActiveTab('published')} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all min-h-[48px] ${activeTab === 'published' ? 'bg-gray-800 text-white shadow-sm border border-gray-700' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'}`}>
          <CheckCircle2 size={18} className={activeTab === 'published' ? 'text-emerald-400' : ''} />
          <span>Опубликованные</span>
        </button>
        <button onClick={() => setActiveTab('scheduled')} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all min-h-[48px] ${activeTab === 'scheduled' ? 'bg-gray-800 text-white shadow-sm border border-gray-700' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'}`}>
          <Clock size={18} className={activeTab === 'scheduled' ? 'text-blue-400' : ''} />
          <span>Отложенные</span>
        </button>
        <button onClick={() => setActiveTab('errors')} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all min-h-[48px] ${activeTab === 'errors' ? 'bg-gray-800 text-white shadow-sm border border-gray-700' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'}`}>
          <AlertCircle size={18} className={activeTab === 'errors' ? 'text-rose-400' : ''} />
          <span>Ошибки</span>
        </button>
      </div>

      {/* Список */}
      <div className="space-y-4">
        {currentList.length === 0 ? (
          <div className="bg-admin-card border border-gray-800 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center">
            <h3 className="text-white font-bold text-lg mb-2">Пусто</h3>
            <p className="text-gray-500 text-sm">В этой категории пока нет записей.</p>
          </div>
        ) : (
          currentList.map((post) => (
            <div key={post.id} className="bg-admin-card border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors shadow-lg group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-900 rounded-xl overflow-hidden border border-gray-700 shrink-0 flex items-center justify-center">
                    {post.mediaUrls && JSON.parse(post.mediaUrls).length > 0 ? (
                      <img src={JSON.parse(post.mediaUrls)[0]} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <ImageIcon size={20} className="text-gray-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm line-clamp-2 leading-relaxed">
                      {post.text || 'Без текста...'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-900 rounded-lg border border-gray-800">
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-800">
                      {post.account?.avatarUrl && <img src={post.account.avatarUrl} alt="acc" className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">{post.account?.provider}</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                    <Calendar size={12} /> {new Date(post.publishAt || post.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {activeTab === 'errors' && (
                    <button 
                      onClick={() => handleRetry(post.id)}
                      disabled={loadingId === post.id}
                      className="flex items-center gap-2 text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                    >
                      {loadingId === post.id ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} 
                      Повторить
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(post.id)}
                    className="p-2 text-gray-500 hover:text-rose-500 bg-gray-900 hover:bg-rose-500/10 rounded-xl transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}