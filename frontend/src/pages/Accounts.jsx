import { useEffect } from 'react';
import { useStore } from '../store';
import { Plus, Trash2, CheckCircle2, ExternalLink } from 'lucide-react';

// ВАЖНО: Вставь сюда ID своего приложения из настроек dev.vk.com
const VK_APP_ID = '54467208'; 

const VKIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.162 18.994c.609 0 .858-.406.851-.915-.031-1.917.714-2.949 2.059-1.604 1.488 1.488 1.796 2.519 3.603 2.519h3.2c.808 0 1.126-.26 1.126-.668 0-.863-1.421-2.386-2.625-3.504-1.686-1.543-1.676-1.626.022-3.881 2.277-3.03 3.144-4.759 3.033-5.527-.095-.65-1.365-.52-1.365-.52l-3.607.015c-.6 0-.97.161-1.315.823-1.076 2.059-2.222 4.144-3.563 5.483-.8.794-1.315.65-1.583-.028-.851-2.146-.662-3.858-.662-5.187 0-.756-.164-1.123-1.096-1.343-1.554-.366-3.193-.341-4.277-.023-.62.18-.836.42-.584.457.801.117 1.543.511 1.543 2.476 0 2.592-.518 3.034-1.215 3.034-.997 0-2.427-1.48-3.418-3.682-.397-.883-.734-1.126-1.48-1.126H1.544C.68 5.764.5 6.082.5 6.49c0 .863 1.944 4.882 4.609 8.355 2.593 3.38 5.738 4.149 8.053 4.149z" />
  </svg>
);

export default function Accounts() {
  const accounts = useStore((state) => state.accounts);
  const addAccount = useStore((state) => state.addAccount);
  const removeAccount = useStore((state) => state.removeAccount);
  const user = useStore((state) => state.user);

  // Показываем аккаунты только текущего пользователя
  const userAccounts = accounts.filter(acc => acc.userId === user?.id);

  // Этот эффект ловит возвращение пользователя с сайта ВК
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.replace('#', '?'));
      const accessToken = params.get('access_token');
      const vkUserId = params.get('user_id');

      if (accessToken && vkUserId) {
        // Создаем скрипт для обхода CORS и получения реального имени и аватарки из ВК
        const script = document.createElement('script');
        window.vkCallback = (result) => {
          if (result.response && result.response[0]) {
            const vkUser = result.response[0];
            const newAccount = {
              id: vkUserId, // Настоящий ID ВКонтакте
              network: 'ВКонтакте',
              name: `${vkUser.first_name} ${vkUser.last_name}`,
              photo: vkUser.photo_50, // Настоящая аватарка
              followers: 0, // Подписчиков можно получить отдельным запросом позже
              token: accessToken 
            };
            
            // Проверяем, чтобы не добавить один аккаунт дважды
            const exists = useStore.getState().accounts.find(a => a.id === vkUserId && a.userId === user?.id);
            if (!exists) {
              addAccount(newAccount);
            }
          }
          delete window.vkCallback;
          document.body.removeChild(script);
        };
        
        script.src = `https://api.vk.com/method/users.get?user_ids=${vkUserId}&fields=photo_50&access_token=${accessToken}&v=5.131&callback=vkCallback`;
        document.body.appendChild(script);
      }
      
      // Очищаем адресную строку от токена, чтобы было красиво
      window.history.replaceState(null, null, window.location.pathname);
    }
  }, [addAccount, user?.id]);

  // Функция для имитации подключения ВК (чтобы обойти блокировки их кабинета)
  const handleConnectVK = () => {
    // Создаем "фейковый", но реалистичный ответ от ВКонтакте
    const mockVKAccount = {
      id: Date.now(), // Уникальный номер
      network: 'ВКонтакте',
      name: user?.name + ' (Личная страница)', // Берем имя пользователя
      photo: 'https://vk.com/images/camera_50.png', // Стандартная аватарка ВК
      followers: Math.floor(Math.random() * 500) + 100, // Случайное число подписчиков от 100 до 600
      token: 'test-mock-token-12345'
    };
    
    // Мгновенно добавляем этот аккаунт в нашу базу
    addAccount(mockVKAccount);
    
    // Показываем уведомление (встроенным методом браузера для простоты)
    alert('✅ Тестовый аккаунт ВКонтакте успешно привязан!');
  };

  return (
    <div className="p-4 min-h-screen relative pb-24">
      <div className="flex justify-between items-center mb-6 mt-2">
        <h1 className="text-2xl font-bold">Управление аккаунтами</h1>
      </div>

      <div className="space-y-4">
        {userAccounts.length === 0 && (
          <p className="text-gray-500 text-center py-10">У вас пока нет подключенных аккаунтов.</p>
        )}

        {userAccounts.map((acc) => (
          <div key={acc.id} className="bg-admin-card p-5 rounded-2xl border border-gray-800 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              
              <div className="flex items-center gap-3">
                {/* Если ВК отдал реальную аватарку - показываем её, иначе иконку */}
                {acc.photo ? (
                  <img src={acc.photo} alt={acc.name} className="w-12 h-12 rounded-full border border-gray-700" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <VKIcon />
                  </div>
                )}
                
                <div>
                  <p className="font-bold text-base line-clamp-1">{acc.name}</p>
                  <div className="flex items-center gap-1 text-xs text-green-400 mt-1 font-medium">
                    <CheckCircle2 size={12} />
                    <span>Подключен</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Заметная кнопка удаления аккаунта */}
            <button 
              onClick={() => removeAccount(acc.id)}
              className="w-full flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 py-3 rounded-xl hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={18} />
              Удалить аккаунт
            </button>
          </div>
        ))}
      </div>

      <button 
        onClick={handleConnectVK}
        className="w-full mt-6 bg-blue-600/10 border-2 border-blue-600/30 text-blue-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-600/20 hover:border-blue-500 transition-all shadow-lg"
      >
        <Plus size={20} />
        Привязать ВКонтакте
        <ExternalLink size={16} className="opacity-50 ml-1" />
      </button>

      {/* Кнопка полного выхода из приложения */}
      <div className="mt-10 text-center">
        <button 
          onClick={() => useStore.getState().logout()} 
          className="text-gray-500 text-sm hover:text-red-400 font-medium"
        >
          Выйти из системы SMMBOX
        </button>
      </div>
    </div>
  )
}