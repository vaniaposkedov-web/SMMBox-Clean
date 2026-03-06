import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { Share2, Trash2, AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';

export default function AccountsManager() {
  const user = useStore((state) => state.user);
  const accounts = useStore((state) => state.accounts);
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  const verifyAccountsStatus = useStore((state) => state.verifyAccountsStatus);
  const removeAccount = useStore((state) => state.removeAccount);

  const [isVerifying, setIsVerifying] = useState(false);

  // При загрузке страницы: скачиваем аккаунты и фоном запускаем проверку их работоспособности
  useEffect(() => {
    if (user) {
      fetchAccounts(user.id).then(() => {
        verifyAccountsStatus();
      });
    }
  }, [user]);

  const handleManualVerify = async () => {
    setIsVerifying(true);
    await verifyAccountsStatus();
    setIsVerifying(false);
  };

  return (
    <div className="space-y-8">
      {/* ... Блок добавления соцсетей (оставляем твой код) ... */}

      <div className="flex items-center justify-between">
         <h2 className="text-xl font-bold text-white">Мои каналы и группы</h2>
         <button 
           onClick={handleManualVerify} 
           disabled={isVerifying}
           className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
         >
           <RefreshCw size={16} className={isVerifying ? 'animate-spin text-blue-500' : ''} />
           {isVerifying ? 'Проверка...' : 'Обновить статусы'}
         </button>
      </div>

      {/* --- СПИСОК ПОДКЛЮЧЕННЫХ АККАУНТОВ --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {accounts.map(acc => (
          <div key={acc.id} className={`bg-admin-card border ${acc.isValid ? 'border-gray-800' : 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]'} rounded-3xl p-6 shadow-xl relative overflow-hidden group`}>
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <img src={acc.avatarUrl || 'https://via.placeholder.com/150'} alt="avatar" className="w-12 h-12 rounded-full border-2 border-gray-700" />
                <div>
                  <h3 className="font-bold text-white line-clamp-1">{acc.name}</h3>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">{acc.provider}</span>
                </div>
              </div>
              <button onClick={() => removeAccount(acc.id)} className="text-gray-500 hover:text-red-500 transition-colors p-2">
                <Trash2 size={18} />
              </button>
            </div>

            {/* === ИНДИКАТОР РАБОТОСПОСОБНОСТИ (ПРАВА БОТА) === */}
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

            {/* ПРОВЕРКА НА ВОДЯНОЙ ЗНАК */}
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