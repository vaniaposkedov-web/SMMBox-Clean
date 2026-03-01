// frontend/src/pages/ContentSearch.jsx
import { Search, Heart, MessageCircle, Share2, Copy } from 'lucide-react';

// Заглушки "вирусных" постов
const MOCK_VIRAL_POSTS = [
  { id: 1, group: 'Бизнес Идеи', text: 'Топ 5 нейросетей для бизнеса в 2024 году. Сохраняй, чтобы не потерять...', likes: 4500, comments: 342, image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=400&auto=format&fit=crop' },
  { id: 2, group: 'Юмор IT', text: 'Когда джун случайно удалил продакшен базу данных 😅', likes: 12000, comments: 890, image: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=400&auto=format&fit=crop' },
  { id: 3, group: 'Психология', text: 'Как избежать выгорания на удаленке: правило 3-х часов.', likes: 3200, comments: 150, image: null },
];

export default function ContentSearch() {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Поиск контента</h1>
        <p className="text-gray-400 text-sm">Находите популярные посты по вашей тематике и забирайте их себе в план.</p>
      </div>

      {/* Строка поиска */}
      <div className="relative mb-8">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="text-gray-500" size={20} />
        </div>
        <input 
          type="text" 
          className="w-full bg-admin-card border border-gray-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-admin-accent focus:ring-1 focus:ring-admin-accent transition-all"
          placeholder="Например: криптовалюта, психология, рецепты..."
        />
        <button className="absolute inset-y-2 right-2 bg-admin-accent text-white px-6 rounded-xl font-medium hover:bg-blue-600 transition-colors">
          Найти
        </button>
      </div>

      {/* Сетка постов */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_VIRAL_POSTS.map(post => (
          <div key={post.id} className="bg-admin-card border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 flex items-center gap-3 border-b border-gray-800/50">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex-shrink-0"></div>
              <p className="font-bold text-sm text-gray-200">{post.group}</p>
            </div>
            
            {post.image && (
              <img src={post.image} alt="post media" className="w-full h-48 object-cover" />
            )}
            
            <div className="p-4 flex-1">
              <p className="text-sm text-gray-300 line-clamp-4">{post.text}</p>
            </div>

            <div className="p-4 bg-gray-900/50 flex justify-between items-center mt-auto">
              <div className="flex gap-4 text-gray-400 text-sm">
                <span className="flex items-center gap-1"><Heart size={16} /> {post.likes}</span>
                <span className="flex items-center gap-1"><MessageCircle size={16} /> {post.comments}</span>
              </div>
              
              <button className="flex items-center gap-2 bg-blue-500/10 text-admin-accent px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-500/20 transition-colors">
                <Copy size={16} /> Забрать
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}