import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Users, Instagram, Send, Activity, Plus, ArrowRight } from 'lucide-react';

// Наша кастомная иконка ВК
const VKIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.162 18.994c.609 0 .858-.406.851-.915-.031-1.917.714-2.949 2.059-1.604 1.488 1.488 1.796 2.519 3.603 2.519h3.2c.808 0 1.126-.26 1.126-.668 0-.863-1.421-2.386-2.625-3.504-1.686-1.543-1.676-1.626.022-3.881 2.277-3.03 3.144-4.759 3.033-5.527-.095-.65-1.365-.52-1.365-.52l-3.607.015c-.6 0-.97.161-1.315.823-1.076 2.059-2.222 4.144-3.563 5.483-.8.794-1.315.65-1.583-.028-.851-2.146-.662-3.858-.662-5.187 0-.756-.164-1.123-1.096-1.343-1.554-.366-3.193-.341-4.277-.023-.62.18-.836.42-.584.457.801.117 1.543.511 1.543 2.476 0 2.592-.518 3.034-1.215 3.034-.997 0-2.427-1.48-3.418-3.682-.397-.883-.734-1.126-1.48-1.126H1.544C.68 5.764.5 6.082.5 6.49c0 .863 1.944 4.882 4.609 8.355 2.593 3.38 5.738 4.149 8.053 4.149z" />
  </svg>
);

export default function Dashboard() {
  const navigate = useNavigate(); // Функция для программного перехода по страницам
  
  // Достаем данные из нашей БД
  const user = useStore((state) => state.user);
  const allAccounts = useStore((state) => state.accounts);
  
  // ФИЛЬТРУЕМ: Берем только те аккаунты, у которых userId совпадает с ID текущего пользователя
  const userAccounts = allAccounts.filter(acc => acc.userId === user?.id);
  
  // Считаем общую аудиторию: проходимся по всем аккаунтам юзера и суммируем подписчиков
  const totalFollowers = userAccounts.reduce((sum, acc) => sum + (acc.followers || 0), 0);

  // Берем первую букву имени для красивой аватарки (если имени вдруг нет, ставим смайлик)
  const avatarLetter = user?.name ? user.name.charAt(0).toUpperCase() : '😎';

  // Функция для определения иконки и цвета в зависимости от соцсети
  const renderNetworkIcon = (network) => {
    switch (network) {
      case 'ВКонтакте':
        return { icon: <VKIcon />, colorClass: 'text-blue-500 bg-blue-500/10' };
      case 'Instagram':
        return { icon: <Instagram size={20} />, colorClass: 'text-pink-500 bg-pink-500/10' };
      case 'Telegram':
        return { icon: <Send size={20} />, colorClass: 'text-blue-400 bg-blue-500/10' };
      default:
        return { icon: <Users size={20} />, colorClass: 'text-gray-400 bg-gray-800' };
    }
  };

  return (
    <div className="p-4 min-h-screen relative">
      
      {/* Динамическая шапка с именем пользователя */}
      <div className="flex justify-between items-center mb-6 mt-2">
        <div>
          <p className="text-gray-400 text-sm mb-1">Добро пожаловать,</p>
          <h1 className="text-2xl font-bold truncate max-w-[200px]">{user?.name}</h1>
        </div>
        <div className="w-12 h-12 bg-admin-accent/20 border-2 border-admin-accent rounded-full flex items-center justify-center text-admin-accent font-bold text-lg shrink-0 uppercase">
          {avatarLetter}
        </div>
      </div>

      {/* Карточка со статистикой (Считает реальные данные) */}
      <div className="bg-gradient-to-br from-admin-card to-gray-900 p-5 rounded-3xl border border-gray-800 mb-6 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-admin-accent/10 rounded-full blur-2xl"></div>
        
        <div className="flex items-center gap-2 text-gray-400 mb-2 relative z-10">
          <Users size={18} />
          <span className="text-sm font-medium">Общая аудитория</span>
        </div>
        
        <div className="flex items-end gap-3 mb-4 relative z-10">
          <span className="text-4xl font-bold">{totalFollowers.toLocaleString('ru-RU')}</span>
          {userAccounts.length > 0 && (
            <span className="text-sm text-green-400 flex items-center mb-1 font-medium">
              <TrendingUp size={14} className="mr-1" /> Активно
            </span>
          )}
        </div>
      </div>

      {/* Раздел: Подключенные аккаунты */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Мои аккаунты ({userAccounts.length})</h2>
        {userAccounts.length > 0 && (
          <button 
            onClick={() => navigate('/accounts')}
            className="text-admin-accent text-sm font-medium flex items-center gap-1 hover:text-blue-400"
          >
            <Plus size={16} /> Добавить
          </button>
        )}
      </div>

      {/* ЛОГИКА ОТОБРАЖЕНИЯ: Если аккаунтов нет или если они есть */}
      {userAccounts.length === 0 ? (
        
        /* Состояние пустоты (Empty State) */
        <div className="bg-admin-card border border-dashed border-gray-700 rounded-3xl p-6 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center text-gray-500 mb-4">
            <Users size={32} />
          </div>
          <h3 className="text-lg font-bold mb-2">Нет подключенных соцсетей</h3>
          <p className="text-gray-400 text-sm mb-6">
            Чтобы начать планировать посты и собирать статистику, привяжите свой первый аккаунт.
          </p>
          <button 
            onClick={() => navigate('/accounts')}
            className="bg-admin-accent text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
          >
            Подключить аккаунт <ArrowRight size={18} />
          </button>
        </div>

      ) : (

        /* Список реальных аккаунтов пользователя */
        <div className="space-y-3">
          {userAccounts.map((acc) => {
            const styles = renderNetworkIcon(acc.network);
            
            return (
              <div key={acc.id} className="bg-admin-card p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${styles.colorClass}`}>
                    {styles.icon}
                  </div>
                  <div>
                    <p className="font-bold text-sm line-clamp-1">{acc.name}</p>
                    <p className="text-xs text-gray-400">
                      {acc.network} • {acc.followers ? acc.followers.toLocaleString('ru-RU') : 0} подп.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Activity size={18} className="text-green-400 inline-block mb-1" />
                  <p className="text-xs text-green-400">OK</p>
                </div>
              </div>
            );
          })}
        </div>

      )}

    </div>
  )
}