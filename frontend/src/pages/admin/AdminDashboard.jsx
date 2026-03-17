import { useEffect, useState } from 'react';
import { 
  Users, Crown, MessageSquare, Link as LinkIcon, LogOut, 
  RefreshCw, Sun, Moon, Search, ShieldAlert, CheckCircle2, 
  XCircle, Activity, Eye, X, User as UserIcon, Calendar, 
  Mail, Phone, LayoutDashboard, LayoutTemplate, Send, Key, Loader2, DollarSign, Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  const [data, setData] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('overview'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // === НОВЫЕ СТЕЙТЫ ДЛЯ PRO И ИИ ===
  const [proModal, setProModal] = useState({ isOpen: false, user: null });
  const [proMonths, setProMonths] = useState(1);
  const [proAmount, setProAmount] = useState(2000);
  const [isSubmittingPro, setIsSubmittingPro] = useState(false);

  const [aiPrompt, setAiPrompt] = useState('');
  const [isSavingAi, setIsSavingAi] = useState(false);

  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('adminTheme') !== 'light';
  });

  useEffect(() => {
    localStorage.setItem('adminTheme', isDark ? 'dark' : 'light');
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const token = localStorage.getItem('adminToken');
    if (!token) return navigate('/boss-login');

    try {
      const res = await fetch('/api/admin/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 403 || res.status === 401) {
        localStorage.removeItem('adminToken');
        return navigate('/boss-login');
      }
      const result = await res.json();
      if (result?.success) setData(result);

      const usersRes = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
      const usersData = await usersRes.json();
      if (usersData?.success) setAllUsers(usersData.users || []);

      // Загружаем настройки ИИ
      const aiRes = await fetch('/api/admin/settings/ai', { headers: { 'Authorization': `Bearer ${token}` } });
      const aiData = await aiRes.json();
      if (aiData?.success) setAiPrompt(aiData.aiPrompt);

    } catch (e) {
      console.error('Ошибка загрузки админки:', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDashboardData(); }, []);

  // === НОВАЯ ЛОГИКА ВЫДАЧИ PRO ===
  const submitProGrant = async () => {
    setIsSubmittingPro(true);
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`/api/admin/users/${proModal.user.id}/grant-pro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ months: Number(proMonths), amount: Number(proAmount) })
      });
      const result = await res.json();
      if (result?.success) {
        setProModal({ isOpen: false, user: null });
        fetchDashboardData(); 
      } else {
        alert(result.error || 'Ошибка выдачи');
      }
    } catch (e) {
      alert('Ошибка при изменении статуса');
    }
    setIsSubmittingPro(false);
  };

  const revokePro = async (userId) => {
    if (!window.confirm('Точно забрать PRO у пользователя?')) return;
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`/api/admin/users/${userId}/grant-pro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ months: 0, amount: 0 })
      });
      const result = await res.json();
      if (result?.success) fetchDashboardData();
    } catch (e) {}
  };

  // === ЛОГИКА СОХРАНЕНИЯ ПРОМПТА ИИ ===
  const saveAiPrompt = async () => {
    setIsSavingAi(true);
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch('/api/admin/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ aiPrompt })
      });
      if (res.ok) alert('Промпт успешно сохранен!');
    } catch (e) {
      alert('Ошибка сохранения');
    }
    setIsSavingAi(false);
  };

  const openUserDetails = async (userId) => {
    setIsModalOpen(true);
    setLoadingDetails(true);
    setUserDetails(null);
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await res.json();
      if (result?.success) setUserDetails(result);
    } catch (e) {}
    setLoadingDetails(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/boss-login');
  };

  const filteredUsers = allUsers.filter(u => 
    (u?.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u?.id && u.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u?.phone && u.phone.includes(searchQuery))
  );

  const theme = {
    bg: isDark ? 'bg-[#0a0a0a]' : 'bg-gray-100',
    card: isDark ? 'bg-[#111318] border-gray-800' : 'bg-white border-gray-200 shadow-sm',
    text: isDark ? 'text-white' : 'text-gray-900',
    muted: isDark ? 'text-gray-500' : 'text-gray-500',
    inputBg: isDark ? 'bg-black border-gray-800 text-white' : 'bg-gray-50 border-gray-200 text-gray-900',
    tableHeader: isDark ? 'bg-gray-900/50' : 'bg-gray-50',
    rowHover: isDark ? 'hover:bg-gray-900/30' : 'hover:bg-gray-50',
    border: isDark ? 'border-gray-800' : 'border-gray-200'
  };

  if (loading) {
    return (
      <div className={`min-h-[100dvh] ${theme.bg} flex flex-col items-center justify-center transition-colors px-4 text-center`}>
        <RefreshCw className="animate-spin text-blue-500 mb-4" size={40} />
      </div>
    );
  }

  return (
    <div className={`min-h-[100dvh] ${theme.bg} ${theme.text} font-sans transition-colors duration-300 pb-10`}>
      
      <header className={`${theme.card} border-b sticky top-0 z-40 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center border border-red-500/20 shrink-0">
            <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-xl font-black uppercase tracking-widest leading-none">System Core</h1>
            <p className={`text-[8px] sm:text-[10px] uppercase font-bold tracking-widest ${theme.muted} mt-1`}><Activity size={10} className="inline mr-1 mb-0.5 text-green-500"/> Connection Secure</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => setIsDark(!isDark)} className={`p-2 sm:p-2.5 rounded-xl transition-colors ${isDark ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={handleLogout} className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition-colors text-xs sm:text-sm ${isDark ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
            <LogOut size={16} /> <span className="hidden sm:inline">Выход</span>
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        
        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 sm:mb-8 -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0">
          <button onClick={() => setActiveTab('overview')} className={`px-5 sm:px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all shrink-0 ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : `${theme.card} border ${theme.border} ${theme.muted} hover:${theme.text}`}`}>Мониторинг</button>
          <button onClick={() => setActiveTab('users')} className={`px-5 sm:px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all shrink-0 ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : `${theme.card} border ${theme.border} ${theme.muted} hover:${theme.text}`}`}>Управление клиентами</button>
          <button onClick={() => setActiveTab('settings')} className={`px-5 sm:px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all shrink-0 ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : `${theme.card} border ${theme.border} ${theme.muted} hover:${theme.text}`}`}>Настройки Системы</button>
        </div>

        {/* ВКЛАДКА: МОНИТОРИНГ */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6">
              <div className={`${theme.card} border rounded-2xl p-4 sm:p-6 relative overflow-hidden group`}>
                <h3 className={`${theme.muted} text-[10px] sm:text-xs uppercase font-bold tracking-wider mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2`}><Users size={14} className="text-blue-500 shrink-0"/> <span className="truncate">Юзеры</span></h3>
                <p className="text-2xl sm:text-4xl font-black">{data?.stats?.totalUsers || 0}</p>
              </div>
              <div className={`${theme.card} border rounded-2xl p-4 sm:p-6 relative overflow-hidden group`}>
                <h3 className={`${theme.muted} text-[10px] sm:text-xs uppercase font-bold tracking-wider mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2`}><Crown size={14} className="text-yellow-500 shrink-0"/> <span className="truncate">PRO</span></h3>
                <p className="text-2xl sm:text-4xl font-black">{data?.stats?.proUsers || 0}</p>
              </div>
              <div className={`${theme.card} border rounded-2xl p-4 sm:p-6 relative overflow-hidden group`}>
                <h3 className={`${theme.muted} text-[10px] sm:text-xs uppercase font-bold tracking-wider mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2`}><LinkIcon size={14} className="text-emerald-500 shrink-0"/> <span className="truncate">Соцсети</span></h3>
                <p className="text-2xl sm:text-4xl font-black">{data?.stats?.totalAccounts || 0}</p>
              </div>
              <div className={`${theme.card} border rounded-2xl p-4 sm:p-6 relative overflow-hidden group`}>
                <h3 className={`${theme.muted} text-[10px] sm:text-xs uppercase font-bold tracking-wider mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2`}><MessageSquare size={14} className="text-purple-500 shrink-0"/> <span className="truncate">Посты</span></h3>
                <p className="text-2xl sm:text-4xl font-black">{data?.stats?.totalPosts || 0}</p>
              </div>
              {/* ФИНАНСЫ */}
              <div className={`${theme.card} border border-green-500/30 rounded-2xl p-4 sm:p-6 relative overflow-hidden group`}>
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-green-500/10 rounded-full blur-2xl transition-all"></div>
                <h3 className={`${theme.muted} text-[10px] sm:text-xs uppercase font-bold tracking-wider mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2`}><DollarSign size={14} className="text-green-500 shrink-0"/> <span className="truncate">Выручка PRO</span></h3>
                <p className="text-2xl sm:text-4xl font-black text-green-500">{data?.stats?.totalRevenue || 0} ₽</p>
              </div>
            </div>

            <div className={`${theme.card} border rounded-2xl p-4 sm:p-6`}>
              <h2 className="text-base sm:text-lg font-bold mb-4">Новые регистрации</h2>
              <div className={`border ${theme.border} rounded-xl overflow-hidden overflow-x-auto`}>
                <table className="w-full text-sm text-left min-w-[600px]">
                  <thead className={`${theme.tableHeader} uppercase text-xs font-bold ${theme.muted}`}>
                    <tr>
                      <th className="px-6 py-4">Контакты</th>
                      <th className="px-6 py-4">Статус</th>
                      <th className="px-6 py-4">Дата</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme.border}`}>
                    {data?.recentUsers?.map(u => (
                      <tr key={u.id} className={`${theme.rowHover} transition-colors`}>
                        <td className="px-6 py-4">
                          <div className="font-bold">{u.email || 'Нет почты'}</div>
                          <div className={`text-xs ${theme.muted}`}>{u.phone || 'Нет телефона'}</div>
                        </td>
                        <td className="px-6 py-4">
                          {u.isPro ? <span className="text-yellow-600 bg-yellow-500/10 px-2 py-1 rounded font-bold text-[10px] uppercase">PRO до {u.proExpiresAt ? new Date(u.proExpiresAt).toLocaleDateString() : '∞'}</span> : <span className={`bg-gray-500/10 px-2 py-1 rounded font-bold text-[10px] uppercase ${theme.muted}`}>Free</span>}
                        </td>
                        <td className={`px-6 py-4 text-xs ${theme.muted}`}>{new Date(u.createdAt).toLocaleDateString('ru-RU')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ВКЛАДКА: ПОЛЬЗОВАТЕЛИ */}
        {activeTab === 'users' && (
          <div className={`${theme.card} border rounded-2xl p-4 sm:p-6 animate-in fade-in duration-300`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2"><Users className="text-blue-500"/> База клиентов</h2>
              <div className="relative w-full sm:w-72">
                <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.muted}`} />
                <input 
                  type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по Email или ID..."
                  className={`w-full ${theme.inputBg} border rounded-xl py-3 sm:py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors`}
                />
              </div>
            </div>

            <div className={`border ${theme.border} rounded-xl overflow-hidden overflow-x-auto`}>
              <table className="w-full text-sm text-left min-w-[800px]">
                <thead className={`${theme.tableHeader} uppercase text-xs font-bold ${theme.muted}`}>
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Данные клиента</th>
                    <th className="px-6 py-4">Статус PRO</th>
                    <th className="px-6 py-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme.border}`}>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className={`${theme.rowHover} transition-colors group/row`}>
                      <td className="px-6 py-4 font-mono text-[11px] text-blue-500">{u.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold">{u.name || 'Без имени'}</div>
                        <div className="text-sm mt-0.5">{u.email || 'Нет почты'}</div>
                      </td>
                      <td className="px-6 py-4">
                        {u.isPro ? (
                          <div className="text-yellow-600 font-bold text-xs">
                            Активен <br/> <span className="text-[10px] text-gray-500 font-normal">до {u.proExpiresAt ? new Date(u.proExpiresAt).toLocaleDateString() : 'Бессрочно'}</span>
                          </div>
                        ) : (
                          <span className={`bg-gray-500/10 px-2 py-1 rounded font-bold text-[10px] uppercase ${theme.muted}`}>Нет</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openUserDetails(u.id)} className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}><Eye size={16} /></button>
                          
                          {u.isPro ? (
                            <button onClick={() => revokePro(u.id)} className="px-4 py-2 bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 rounded-lg text-xs font-bold transition-all">Забрать PRO</button>
                          ) : (
                            <button onClick={() => setProModal({ isOpen: true, user: u })} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm">Выдать PRO</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ВКЛАДКА: НАСТРОЙКИ СИСТЕМЫ (НЕЙРОСЕТЬ) */}
        {activeTab === 'settings' && (
          <div className={`${theme.card} border rounded-2xl p-6 animate-in fade-in duration-300 max-w-4xl`}>
             <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings className="text-purple-500"/> Настройки Нейросети</h2>
             <p className={`text-sm ${theme.muted} mb-4`}>Этот текст отправляется искусственному интеллекту при каждой генерации. Опишите в нем правила, тон общения и ограничения.</p>
             
             <textarea 
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className={`w-full h-80 p-4 rounded-xl border ${theme.border} ${theme.inputBg} resize-none font-mono text-sm leading-relaxed`}
                placeholder="Введи системный промпт..."
             />
             
             <button onClick={saveAiPrompt} disabled={isSavingAi} className="mt-4 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-50">
               {isSavingAi ? 'Сохранение...' : 'Сохранить промпт'}
             </button>
          </div>
        )}

      </div>

      {/* === МОДАЛКА: ДОСЬЕ ПОЛЬЗОВАТЕЛЯ === */}
      {isModalOpen && userDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`${theme.card} w-full max-w-3xl border rounded-[2rem] p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto`}>
            <button onClick={() => setIsModalOpen(false)} className={`absolute top-5 right-5 p-2 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}><X size={20} /></button>
            <h2 className="text-2xl font-black mb-6">Досье клиента</h2>
            {/* Оставил базу досье */}
            <p>ID: {userDetails.user.id}</p>
            <p>Email: {userDetails.user.email}</p>
            <p>Групп: {userDetails.user.accounts?.length}</p>
            <p>Постов: {userDetails.postsCount}</p>
            
            {/* ИСТОРИЯ ПЛАТЕЖЕЙ В ДОСЬЕ */}
            <h3 className="font-bold mt-6 mb-2">История платежей</h3>
            {userDetails.user.transactions?.length > 0 ? (
               <ul className="space-y-2">
                 {userDetails.user.transactions.map(t => (
                   <li key={t.id} className={`p-3 rounded-lg border ${theme.border} text-sm flex justify-between`}>
                     <span>Выдача PRO</span>
                     <span className="font-bold text-green-500">+{t.amount} ₽</span>
                     <span className={theme.muted}>{new Date(t.createdAt).toLocaleDateString()}</span>
                   </li>
                 ))}
               </ul>
            ) : <p className={`text-sm ${theme.muted}`}>Нет транзакций</p>}
          </div>
        </div>
      )}

      {/* === НОВАЯ МОДАЛКА: ВЫДАЧА PRO И ЗАПИСЬ ОПЛАТЫ === */}
      {proModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${theme.card} w-full max-w-md border border-gray-700 rounded-[2rem] p-6 shadow-2xl relative`}>
            <button onClick={() => setProModal({ isOpen: false, user: null })} className={`absolute top-5 right-5 p-2 rounded-full ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100'}`}><X size={20} /></button>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><Crown className="text-yellow-500"/> Выдача PRO</h2>
            <p className={`text-sm ${theme.muted} mb-6`}>Для {proModal.user?.email || proModal.user?.name}</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className={`text-xs font-bold uppercase ${theme.muted} mb-2 block`}>Срок действия (месяцев)</label>
                <select value={proMonths} onChange={e => setProMonths(e.target.value)} className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg} outline-none`}>
                  <option value="1">1 месяц</option>
                  <option value="3">3 месяца</option>
                  <option value="6">Полгода</option>
                  <option value="12">1 год</option>
                  <option value="120">Навсегда (10 лет)</option>
                </select>
              </div>
              <div>
                <label className={`text-xs font-bold uppercase ${theme.muted} mb-2 block`}>Фактическая сумма оплаты (₽)</label>
                <input 
                  type="number" value={proAmount} onChange={e => setProAmount(e.target.value)}
                  className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg} outline-none`}
                  placeholder="2000"
                />
                <p className={`text-[10px] mt-1 ${theme.muted}`}>Эта сумма пойдет в график общей выручки.</p>
              </div>
            </div>

            <button onClick={submitProGrant} disabled={isSubmittingPro} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50">
              {isSubmittingPro ? 'Оформление...' : 'Подтвердить выдачу'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}