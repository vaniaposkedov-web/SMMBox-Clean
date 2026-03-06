import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { Share2, Plus, Trash2, CheckCircle2, RefreshCw, XCircle, ChevronDown, ChevronUp, Copy, Check, AlertTriangle } from 'lucide-react';

export default function AccountsManager() {
  const user = useStore((state) => state.user);
  const accounts = useStore((state) => state.accounts);
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  const verifyAccountsStatus = useStore((state) => state.verifyAccountsStatus);
  const removeAccount = useStore((state) => state.removeAccount);
  const token = useStore((state) => state.token);

  // Состояния
  const [newGroupName, setNewGroupName] = useState(''); 
  const [isAddingTg, setIsAddingTg] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchAccounts(user.id).then(() => {
        if (verifyAccountsStatus) verifyAccountsStatus();
      });
    }
  }, [user]);

  const handleManualVerify = async (e) => {
    if (e) e.stopPropagation();
    setIsVerifying(true);
    if (verifyAccountsStatus) await verifyAccountsStatus();
    setIsVerifying(false);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const copyBotName = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText('@smmbox_auth_bot');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddTg = async () => {
    if (!newGroupName.trim()) return alert('Введите ссылку или @username канала!');
    setIsAddingTg(true);

    try {
      const infoRes = await fetch(`/api/auth/tg-chat-info`, {
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

      const saveRes = await fetch(`/api/accounts/tg/save`, {
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
        await fetchAccounts(user.id); 
        if (verifyAccountsStatus) verifyAccountsStatus(); 
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
          <Share2 className="text-admin-accent" /> <span className="inline-block">Подключить соцсети</span>
        </h2>
        
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 space-y-4 shadow-inner">
          <h3 className="text-white font-bold flex items-center gap-2"><span>Подключение Telegram канала</span></h3>
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
              <span className="flex items-center justify-center">
                {isAddingTg ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />} 
              </span>
              <span>{isAddingTg ? 'Добавление...' : 'Добавить ТГ'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- СПИСОК ГРУПП (АККОРДЕОН) --- */}
      <div className="flex items-center justify-between">
         <h2 className="text-xl font-bold text-white"><span>Мои каналы и группы</span></h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {accounts.map(acc => (
          <div 
            key={acc.id} 
            className={`border rounded-3xl overflow-hidden shadow-xl transition-all duration-300 ${
              acc.isValid 
                ? 'border-green-500/30 bg-green-500/5 hover:border-green-500/50' 
                : 'border-red-500/40 bg-red-500/5 hover:border-red-500/60'
            }`}
          >
            {/* ШАПКА КАРТОЧКИ */}
            <div 
              onClick={() => toggleExpand(acc.id)}
              className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <img src={acc.avatarUrl || 'https://via.placeholder.com/150'} alt="avatar" className="w-12 h-12 rounded-full border-2 border-gray-800 object-cover" />
                <div>
                  <h3 className="font-bold text-white line-clamp-1"><span>{acc.name}</span></h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider bg-gray-900 px-2 py-0.5 rounded-full border border-gray-800"><span>{acc.provider}</span></span>
                    {acc.isValid ? (
                      <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle2 size={12} /> <span>Подключено</span></span>
                    ) : (
                      <span className="text-[10px] text-red-400 flex items-center gap-1"><XCircle size={12} /> <span>Нет доступа</span></span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-gray-500 shrink-0 ml-2">
                {expandedId === acc.id ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
              </div>
            </div>

            {/* РАСКРЫВАЮЩЕЕСЯ ТЕЛО КАРТОЧКИ */}
            {expandedId === acc.id && (
              <div className="p-5 border-t border-gray-800/50 bg-gray-950/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                
                {/* Инструкция, если бот не работает */}
                {!acc.isValid && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm">
                    <p className="font-bold text-red-400 flex items-center gap-2 mb-3">
                      <XCircle size={16} /> <span>Требуется настройка!</span>
                    </p>
                    <p className="text-gray-300 mb-3">
                      <span>{acc.errorMsg || 'Боту не хватает прав для публикации постов.'}</span>
                    </p>
                    <ol className="list-decimal list-inside text-gray-400 mt-3 space-y-2 text-xs">
                      <li><span>Откройте настройки канала в Telegram</span></li>
                      <li><span>Раздел "Администраторы" -&gt; "Добавить администратора"</span></li>
                      <li className="flex items-center gap-2 flex-wrap mt-1 mb-1">
                        <span>Найдите и добавьте бота:</span> 
                        <span className="bg-gray-900 border border-gray-700 text-white px-2 py-1 rounded-md font-mono flex items-center gap-2">
                          <span>@smmbox_auth_bot</span>
                          <button onClick={copyBotName} className="text-gray-400 hover:text-white transition-colors">
                            {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                          </button>
                        </span>
                      </li>
                      <li><span>Выдайте права на публикацию сообщений</span></li>
                      <li><span>Нажмите кнопку «Обновить статус» ниже</span></li>
                    </ol>
                  </div>
                )}

                {/* Предупреждение о водяном знаке */}
                {!acc.watermark && acc.isValid && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-start gap-3">
                    <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-yellow-500/90"><span>Водяной знак не настроен. Посты будут без защиты.</span></p>
                  </div>
                )}

                {/* Кнопки управления */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={handleManualVerify}
                    disabled={isVerifying}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white py-2.5 rounded-xl text-sm transition-colors"
                  >
                    <span className="flex items-center justify-center">
                      <RefreshCw size={16} className={isVerifying ? 'animate-spin text-blue-400' : ''} />
                    </span>
                    <span>{isVerifying ? 'Проверка...' : 'Обновить статус'}</span>
                  </button>

                  <button 
                    onClick={() => removeAccount(acc.id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2.5 rounded-xl text-sm transition-colors border border-red-500/20"
                  >
                    <span className="flex items-center justify-center"><Trash2 size={16} /></span>
                    <span>Удалить канал</span>
                  </button>
                </div>

                {acc.isValid && (
                  <button className="w-full mt-2 bg-admin-accent hover:bg-blue-600 text-white py-3 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-500/20">
                    <span>Настроить дизайн</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}