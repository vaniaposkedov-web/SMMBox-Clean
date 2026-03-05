import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { Share2, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function AccountsManager() {
  const user = useStore((state) => state.user);
  const accounts = useStore((state) => state.accounts);
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  const addMockAccount = useStore((state) => state.addMockAccount);
  const removeAccount = useStore((state) => state.removeAccount);
  const [tgChannelUrl, setTgChannelUrl] = useState('');
  const [isTgConnecting, setIsTgConnecting] = useState(false);

  // --- СОСТОЯНИЯ ---
  const [newGroupName, setNewGroupName] = useState(''); // Для теста Telegram
  const [vkTokenUrl, setVkTokenUrl] = useState('');     // Для ссылки-токена ВК
  const [isVkConnecting, setIsVkConnecting] = useState(false);

  // Загружаем аккаунты при открытии страницы
  useEffect(() => {
    if (user) fetchAccounts(user.id);
  }, [user, fetchAccounts]);

  // --- ФУНКЦИИ ---

  // Имитация добавления Telegram
  const handleAddMock = (provider) => {
    if (!newGroupName.trim()) return alert('Введите название группы!');
    addMockAccount(user.id, newGroupName, provider);
    setNewGroupName('');
  };

  // Отправка ссылки ВК на бэкенд
  const handleVkTokenSubmit = async () => {
    if (!vkTokenUrl) return alert('Сначала вставьте скопированную ссылку!');
    setIsVkConnecting(true);
    
    try {
      const res = await fetch('http://localhost:5000/api/accounts/vk/add-by-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, tokenUrl: vkTokenUrl })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setVkTokenUrl(''); // Очищаем поле
        fetchAccounts(user.id); // Обновляем список групп на экране
        alert(`Успешно! Добавлено групп: ${data.count}`);
      } else {
        alert(data.error || 'Произошла ошибка при добавлении');
      }
    } catch (e) {
      alert('Ошибка соединения с сервером');
    }
    
    setIsVkConnecting(false);
  };


  // Отправка ссылки на Telegram канал на бэкенд
  const handleTgSubmit = async () => {
    if (!tgChannelUrl) return alert('Введите ссылку на канал!');
    setIsTgConnecting(true);
    
    try {
      const res = await fetch('http://localhost:5000/api/accounts/tg/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, channelUrl: tgChannelUrl })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setTgChannelUrl(''); // Очищаем поле
        fetchAccounts(user.id); // Обновляем список групп на экране
        alert('Telegram канал успешно подключен!');
      } else {
        alert(data.error || 'Произошла ошибка при добавлении');
      }
    } catch (e) {
      alert('Ошибка соединения с сервером');
    }
    
    setIsTgConnecting(false);
  };

  // --- ИНТЕРФЕЙС ---
  return (
    <div className="space-y-8">
      {/* --- БЛОК ДОБАВЛЕНИЯ СОЦСЕТЕЙ --- */}
      <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          <Share2 className="text-admin-accent" /> Подключить соцсети
        </h2>
        
        {/* НОВЫЙ БЛОК: ВКонтакте */}
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 space-y-4 shadow-inner mb-6">
          <h3 className="text-white font-bold flex items-center gap-2">Подключение ВКонтакте</h3>
          
          <ol className="text-sm text-gray-400 list-decimal pl-4 space-y-2">
            <li>Нажмите кнопку ниже (откроется окно ВКонтакте). Разрешите доступ.</li>
            <li>После этого в адресной строке появится длинная ссылка (начинается с oauth.vk.com/blank.html). Скопируйте её <b>целиком</b>.</li>
          </ol>
          
          <a 
            // Поменяй 54468937 на ID твоего Android/iOS приложения, если он другой
            href="https://oauth.vk.com/authorize?client_id=54468937&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=groups,wall,photos,offline&response_type=token&v=5.131"
            target="_blank" 
            rel="noreferrer"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold inline-block transition-all shadow-lg shadow-blue-500/30"
          >
            1. Получить ссылку-ключ ВК
          </a>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-800">
            <input 
              type="text" 
              value={vkTokenUrl}
              onChange={(e) => setVkTokenUrl(e.target.value)}
              placeholder="Вставьте скопированную ссылку (blank.html#access_token=...) сюда..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
            />
            <button 
              onClick={handleVkTokenSubmit}
              disabled={isVkConnecting}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
            >
              {isVkConnecting ? 'Подключение...' : '2. Подключить'}
            </button>
          </div>
        </div>

        {/* НОВЫЙ БЛОК: Telegram */}
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 space-y-4 shadow-inner">
          <h3 className="text-white font-bold flex items-center gap-2">Подключение Telegram канала</h3>
          
          <ol className="text-sm text-gray-400 list-decimal pl-4 space-y-2">
            <li>Добавьте нашего бота <b>@smmbox_auth_bot</b> (или имя вашего бота) в администраторы вашего канала.</li>
            <li>Дайте боту права на "Публикацию сообщений".</li>
            <li>Введите @username вашего канала или ссылку на него ниже.</li>
          </ol>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-800">
            <input 
              type="text" 
              value={tgChannelUrl}
              onChange={(e) => setTgChannelUrl(e.target.value)}
              placeholder="Например: @my_channel или t.me/my_channel"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 transition-all"
            />
            <button 
              onClick={handleTgSubmit}
              disabled={isTgConnecting}
              className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isTgConnecting ? 'Проверка...' : <><Plus size={18} /> Подключить ТГ</>}
            </button>
          </div>
        </div>
      </div>

      {/* --- СПИСОК ПОДКЛЮЧЕННЫХ АККАУНТОВ --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-admin-card border border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <img src={acc.avatarUrl} alt="avatar" className="w-12 h-12 rounded-full border-2 border-gray-700" />
                <div>
                  <h3 className="font-bold text-white">{acc.name}</h3>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">{acc.provider}</span>
                </div>
              </div>
              <button onClick={() => removeAccount(acc.id)} className="text-gray-500 hover:text-red-500 transition-colors p-2">
                <Trash2 size={18} />
              </button>
            </div>

            {/* ПРОВЕРКА НА ВОДЯНОЙ ЗНАК */}
            {!acc.watermark ? (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-3">
                <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-bold text-red-400">Водяной знак не настроен!</p>
                  <p className="text-xs text-red-400/80 mt-1">Посты в эту группу будут публиковаться без защиты.</p>
                </div>
              </div>
            ) : (
              <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-3">
                <CheckCircle2 className="text-green-500 shrink-0" size={18} />
                <p className="text-sm font-medium text-green-500">Дизайн и подпись настроены</p>
              </div>
            )}
            
            <button className="w-full mt-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
              Перейти к настройке дизайна
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}