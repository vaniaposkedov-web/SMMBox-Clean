import { useState } from 'react';
import { useStore } from '../store';
import { 
  FileText, CheckCircle2, Clock, AlertCircle, 
  Calendar, Image as ImageIcon, Send, MoreVertical, Trash2, Edit3 
} from 'lucide-react';

export default function PostsHistory() {
  // Достаем посты из стора (если они там уже есть)
  const posts = useStore((state) => state.posts) || [];
  const scheduledPosts = useStore((state) => state.scheduledPosts) || [];
  
  const [activeTab, setActiveTab] = useState('published');

  // Фильтруем посты для вкладок
  const publishedPosts = posts.filter(p => p.status !== 'error');
  const errorPosts = posts.filter(p => p.status === 'error' || p.isError);

  // Функция для выбора нужного массива в зависимости от вкладки
  const getCurrentPosts = () => {
    switch(activeTab) {
      case 'published': return publishedPosts;
      case 'scheduled': return scheduledPosts;
      case 'errors': return errorPosts;
      default: return [];
    }
  };

  const currentList = getCurrentPosts();

  // --- ВРЕМЕННЫЕ ЗАГЛУШКИ ДЛЯ КРАСОТЫ (пока нет бэкенда) ---
  // Если постов нет, покажем демо-данные, чтобы вы оценили дизайн
  const displayList = currentList.length > 0 ? currentList : (
    activeTab === 'published' ? [
      { id: 1, text: 'Всем привет! Это первый тестовый пост через новую платформу. Полет нормальный! 🚀', date: 'Сегодня, 14:30', status: 'published', accounts: ['VK', 'TG'], images: 1 }
    ] : activeTab === 'scheduled' ? [
      { id: 2, text: 'Напоминание о завтрашнем вебинаре. Не пропустите трансляцию!', date: 'Завтра, 18:00', status: 'scheduled', accounts: ['TG'], images: 0 }
    ] : []
  );

  return (
    <div className="w-full space-y-6 sm:space-y-8 font-sans pb-10">
      
      {/* === ГЛАВНЫЙ ЗАГОЛОВОК === */}
      <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-3xl p-5 sm:p-8 shadow-lg">
        <h1 className="text-xl sm:text-3xl font-extrabold text-white flex items-center gap-3 tracking-tight">
          <FileText className="text-blue-500 shrink-0" size={28} /> 
          <span>История постов</span>
        </h1>
        <p className="text-gray-400 mt-2 text-sm max-w-xl leading-relaxed">
          Здесь хранятся все ваши публикации. Отслеживайте статус отправки, редактируйте отложенные посты и проверяйте ошибки.
        </p>
      </div>

      {/* === ВКЛАДКИ === */}
      <div className="bg-admin-card border border-gray-800 rounded-2xl p-1.5 flex flex-wrap sm:flex-nowrap gap-1">
        <button 
          onClick={() => setActiveTab('published')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all min-h-[48px] ${activeTab === 'published' ? 'bg-gray-800 text-white shadow-sm border border-gray-700' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'}`}
        >
          <CheckCircle2 size={18} className={activeTab === 'published' ? 'text-emerald-400' : ''} />
          <span>Опубликованные</span>
        </button>
        <button 
          onClick={() => setActiveTab('scheduled')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all min-h-[48px] ${activeTab === 'scheduled' ? 'bg-gray-800 text-white shadow-sm border border-gray-700' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'}`}
        >
          <Clock size={18} className={activeTab === 'scheduled' ? 'text-blue-400' : ''} />
          <span>Отложенные</span>
        </button>
        <button 
          onClick={() => setActiveTab('errors')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all min-h-[48px] ${activeTab === 'errors' ? 'bg-gray-800 text-white shadow-sm border border-gray-700' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'}`}
        >
          <AlertCircle size={18} className={activeTab === 'errors' ? 'text-rose-400' : ''} />
          <span>С ошибкой</span>
        </button>
      </div>

      {/* === СПИСОК ПОСТОВ === */}
      <div className="space-y-4">
        {displayList.length === 0 ? (
          <div className="bg-admin-card border border-gray-800 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4 border border-gray-800">
              {activeTab === 'published' && <CheckCircle2 size={32} className="text-gray-600" />}
              {activeTab === 'scheduled' && <Clock size={32} className="text-gray-600" />}
              {activeTab === 'errors' && <AlertCircle size={32} className="text-gray-600" />}
            </div>
            <h3 className="text-white font-bold text-lg mb-2">Здесь пока пусто</h3>
            <p className="text-gray-500 text-sm max-w-md">
              {activeTab === 'published' && 'Вы еще не опубликовали ни одного поста через платформу.'}
              {activeTab === 'scheduled' && 'У вас нет запланированных публикаций на будущее.'}
              {activeTab === 'errors' && 'Отлично! У вас нет постов с ошибками публикации.'}
            </p>
          </div>
        ) : (
          displayList.map((post) => (
            <div key={post.id} className="bg-admin-card border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors shadow-lg group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center border border-gray-700 shrink-0">
                    <ImageIcon size={18} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm line-clamp-2 leading-relaxed">
                      {post.text || 'Без текста...'}
                    </p>
                  </div>
                </div>
                <button className="text-gray-500 hover:text-white p-1 rounded-lg transition-colors shrink-0 opacity-0 group-hover:opacity-100">
                  <MoreVertical size={20} />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-800/50">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-gray-900 px-2.5 py-1.5 rounded-lg border border-gray-800">
                    <Calendar size={14} /> {post.date}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    {post.accounts?.map((acc, i) => (
                      <span key={i} className="text-[10px] font-bold text-white bg-blue-600 px-2 py-1 rounded-md uppercase">
                        {acc}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeTab === 'scheduled' && (
                    <button className="flex items-center gap-2 text-xs font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors">
                      <Edit3 size={14} /> Изменить
                    </button>
                  )}
                  {activeTab === 'errors' && (
                    <button className="flex items-center gap-2 text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg transition-colors">
                      <Send size={14} /> Переотправить
                    </button>
                  )}
                  <button className="text-gray-500 hover:text-rose-500 p-1.5 rounded-lg bg-gray-900 hover:bg-rose-500/10 transition-colors">
                    <Trash2 size={16} />
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