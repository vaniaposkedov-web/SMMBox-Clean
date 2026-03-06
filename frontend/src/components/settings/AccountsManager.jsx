import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { Share2, Plus, Trash2, AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';

export default function AccountsManager() {
  const user = useStore((state) => state.user);
  const accounts = useStore((state) => state.accounts);
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  const verifyAccountsStatus = useStore((state) => state.verifyAccountsStatus);
  const removeAccount = useStore((state) => state.removeAccount);
  const token = useStore((state) => state.token); // Нам нужен токен для POST запросов

  // Состояния
  const [newGroupName, setNewGroupName] = useState(''); 
  const [isAddingTg, setIsAddingTg] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Загружаем аккаунты при открытии страницы
  useEffect(() => {
    if (user?.id) {
      fetchAccounts(user.id).then(() => {
        // Запускаем проверку прав после загрузки
        if (verifyAccountsStatus) verifyAccountsStatus();
      });
    }
  }, [user]);

  // Ручная проверка статусов
  const handleManualVerify = async () => {
    setIsVerifying(true);
    if (verifyAccountsStatus) await verifyAccountsStatus();
    setIsVerifying(false);
  };

  // === РЕАЛЬНОЕ ДОБАВЛЕНИЕ КАНАЛА TELEGRAM ===
  const handleAddTg = async () => {
    if (!newGroupName.trim()) return alert('Введите ссылку или @username канала!');
    setIsAddingTg(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      // 1. Ищем информацию о канале через Telegram API бота
      const infoRes = await fetch(`${apiUrl}/api/auth/tg-chat-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: newGroupName })
      });
      const infoData = await infoRes.json();

      if (!infoData.success) {
        alert(infoData.error || 'Канал не найден. Бот добавлен в администраторы?');
        setIsAddingTg(false);
        return;
      }

      // 2. Сохраняем канал в базу данных к пользователю
      const saveRes = await fetch(`${apiUrl}/api/accounts/tg/save`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          userId: user.id,
          channels: [{
            chatId: infoData.chatId || infoData.username, 
            title: infoData.title,
            avatar: infoData.avatar
          }]
        })
      });
      const saveData = await saveRes.json();

      if (saveData.success) {
        setNewGroupName('');
        await fetchAccounts(user.id); // Сразу обновляем список на экране
        if (verifyAccountsStatus) verifyAccountsStatus(); // Сразу проверяем права
        alert('Группа успешно добавлена!');
      } else {
        alert(saveData.error || 'Ошибка сохранения аккаунта');
      }
    } catch (error) {
      console.error(error);
      alert('Ошибка соединения с сервером');
    }
    setIsAddingTg(false);
  };

  return (
    <div className="space-y-8">
      {/* --- БЛОК ДОБАВЛЕНИЯ СОЦСЕТЕЙ --- */}
      <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          <Share2 className="text-admin-accent" /> Подключить соцсети
        </h2>
        
        {/* Блок: Telegram */}
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 space-y-4 shadow-inner">
          <h3 className="text-white font-bold flex items-center gap-2">Подключение Telegram канала</h3>
          <p className="text-sm text-gray-400">Сначала добавьте вашего бота в администраторы канала, затем введите ссылку на канал ниже.</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <input 
              type="text" 
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Например: @mychannel или t.me/mychannel"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-sky-500 transition-all"
            />
            <button 
              onClick={handleAddTg} 
              disabled={isAddingTg}
              className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isAddingTg ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />} 
              {isAddingTg ? 'Добавление...' : 'Добавить ТГ'}
            </button>
          </div>
        </div>
      </div>

      {/* --- СПИСОК ГРУПП --- */}
      <div className="flex items-center justify-between">
         <h2 className="text-xl font-bold text-white">Мои группы</h2>
         <button 
           onClick={handleManualVerify} 
           disabled={isVerifying}
           className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
         >
           <RefreshCw size={16} className={isVerifying ? 'animate-spin text-blue-500' : ''} />
           {isVerifying ? 'Проверка...' : 'Обновить статусы'}
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {accounts.map(acc => (
          <div key={acc.id} className={`bg-admin-card border ${acc.isValid ? 'border-gray-800' : 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]'} rounded-3xl p-6 shadow-xl relative overflow-hidden group`}>
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <img src={acc.avatarUrl || 'https://via.placeholder.com/150'} alt="avatar" className="w-12 h-12 rounded-full border-2 border-gray-700 object-cover" />
                <div>
                  <h3 className="font-bold text-white line-clamp-1">{acc.name}</h3>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">{acc.provider}</span>
                </div>
              </div>
              <button onClick={() => removeAccount(acc.id)} className="text-gray-500 hover:text-red-500 transition-colors p-2">
                <Trash2 size={18} />
              </button>
            </div>

            {/* Индикаторы статуса */}
            {acc.isValid ? (
               <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-3">
                 <CheckCircle2 className="text-green-500 shrink-0" size={18} />
                 <p className="text-sm font-medium text-green-500">Бот подключен и имеет права</p>
               </div>
            ) : (
               <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-3">
                 <XCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                 <div>
                   <p className="text-sm font-bold text-red-400">Ошибка подключения!</p>
                   <p className="text-xs text-red-400/80 mt-1">{acc.errorMsg || 'Выдайте боту права администратора'}</p>
                 </div>
               </div>
            )}

            {/* Проверка на водяной знак */}
            {!acc.watermark && acc.isValid && (
              <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-start gap-3">
                <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-yellow-500/90">Водяной знак не настроен. Посты будут без защиты.</p>
              </div>
            )}
            
            <button className="w-full mt-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
              Настроить дизайн
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}