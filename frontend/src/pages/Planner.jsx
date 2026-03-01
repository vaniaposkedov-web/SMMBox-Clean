import { useState } from 'react';
import { Clock, Instagram, Send, Plus, X, Image as ImageIcon } from 'lucide-react';

// Временные данные для календаря
const DATES = [
  { id: 1, day: 'Пн', num: 12 },
  { id: 2, day: 'Вт', num: 13 },
  { id: 3, day: 'Ср', num: 14 },
  { id: 4, day: 'Чт', num: 15 },
  { id: 5, day: 'Пт', num: 16 },
  { id: 6, day: 'Сб', num: 17 },
  { id: 7, day: 'Вс', num: 18 },
];

// Временные данные для постов
const POSTS = [
  { id: 1, text: 'Анонс новой коллекции весна-лето! 🔥 Не пропустите скидки...', time: '10:00', network: 'Instagram' },
  { id: 2, text: 'Полезный пост: 5 способов улучшить охваты в соцсетях.', time: '15:30', network: 'Telegram' },
];

export default function Planner() {
  const [activeDate, setActiveDate] = useState(13);
  
  // НОВОЕ: Состояние для всплывающего окна (false - закрыто, true - открыто)
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="p-4 relative min-h-screen">
      
      {/* Шапка страницы */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Контент-план</h1>
      </div>

      {/* Горизонтальный календарь */}
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
        {DATES.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveDate(item.num)}
            className={`flex flex-col items-center justify-center min-w-[60px] h-[80px] rounded-2xl transition-all ${
              activeDate === item.num 
                ? 'bg-admin-accent text-white shadow-lg shadow-blue-500/30' 
                : 'bg-admin-card text-gray-400 border border-gray-800'
            }`}
          >
            <span className="text-sm mb-1">{item.day}</span>
            <span className={`text-xl font-bold ${activeDate === item.num ? 'text-white' : 'text-gray-200'}`}>
              {item.num}
            </span>
          </button>
        ))}
      </div>

      {/* Список постов */}
      <div className="mt-4 space-y-4">
        <h2 className="text-gray-400 text-sm font-medium mb-2">Запланировано на {activeDate} число:</h2>
        {POSTS.map((post) => (
          <div key={post.id} className="bg-admin-card p-4 rounded-2xl border border-gray-800">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                {post.network === 'Instagram' ? <Instagram size={16} className="text-pink-500" /> : <Send size={16} className="text-blue-400" />}
                <span>{post.network}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-admin-accent bg-blue-500/10 px-2 py-1 rounded-lg">
                <Clock size={14} />
                <span>{post.time}</span>
              </div>
            </div>
            <p className="text-sm text-gray-200 line-clamp-3">{post.text}</p>
          </div>
        ))}
      </div>

      {/* НОВОЕ: Обновленная кнопка Плюс. Теперь при клике она меняет isModalOpen на true */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-24 right-4 bg-admin-accent text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 hover:bg-blue-600 transition-colors z-10"
      >
        <Plus size={28} />
      </button>

      {/* НОВОЕ: Всплывающее окно. Показывается только если isModalOpen === true */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50">
          
          {/* Сама панель, которая "выезжает" снизу */}
          <div className="bg-admin-bg w-full h-[85vh] rounded-t-3xl border-t border-gray-800 p-5 flex flex-col">
            
            {/* Шапка окна с кнопкой закрытия */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Новый пост</h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-2 bg-admin-card rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Поле для ввода текста */}
            <textarea 
              className="w-full bg-admin-card border border-gray-800 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-admin-accent resize-none min-h-[150px] mb-6"
              placeholder="О чем хотите рассказать своей аудитории?..."
            ></textarea>

            {/* Выбор соцсети */}
            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-3 font-medium">Куда публикуем?</p>
              <div className="flex gap-3">
                <button className="flex-1 flex items-center justify-center gap-2 bg-admin-card border border-admin-accent text-admin-accent py-3 rounded-xl">
                  <Instagram size={18} /> Instagram
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 bg-admin-card border border-gray-800 text-gray-400 py-3 rounded-xl hover:text-white transition-colors">
                  <Send size={18} /> Telegram
                </button>
              </div>
            </div>

            {/* Кнопки "Прикрепить фото" и "Выбрать время" */}
            <div className="flex gap-3 mb-auto">
                <button className="flex items-center justify-center gap-2 bg-admin-card border border-gray-800 text-gray-300 py-3 px-4 rounded-xl hover:text-white transition-colors">
                  <ImageIcon size={20} /> Фото
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 bg-admin-card border border-gray-800 text-gray-300 py-3 px-4 rounded-xl hover:text-white transition-colors">
                  <Clock size={20} /> Сегодня, 18:00
                </button>
            </div>

            {/* Главная кнопка публикации */}
            <button className="w-full bg-admin-accent text-white font-bold py-4 rounded-xl mt-4 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">
              Запланировать публикацию
            </button>

          </div>
        </div>
      )}

    </div>
  )
}