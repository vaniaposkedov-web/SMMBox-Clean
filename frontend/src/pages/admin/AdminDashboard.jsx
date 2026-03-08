import { useEffect, useState } from 'react';
import { 
  Users, Crown, MessageSquare, Link as LinkIcon, LogOut, 
  RefreshCw, Sun, Moon, Search, ShieldAlert, CheckCircle2, XCircle, Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  const [data, setData] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Состояния интерфейса
  const [activeTab, setActiveTab] = useState('overview'); // overview, users
  const [searchQuery, setSearchQuery] = useState('');
  
  // Тема (День/Ночь)
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('adminTheme') !== 'light';
  });

  useEffect(() => {
    localStorage.setItem('adminTheme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const token = localStorage.getItem('adminToken');
    if (!token) return navigate('/boss-login');

    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 403 || res.status === 401) {
        localStorage.removeItem('adminToken');
        return navigate('/boss-login');
      }
      const result = await res.json();
      if (result.success) setData(result);

      // Сразу грузим всех юзеров для вкладки "Пользователи"
      const usersRes = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const usersData = await usersRes.json();
      if (usersData.success) setAllUsers(usersData.users);

    } catch (e) {
      console.error('Ошибка загрузки админки:', e);
    }
    setLoading(false);
  };

  useEffect(() => { 
    fetchDashboardData(); 
  }, []);

  const handleTogglePro = async (userId) => {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-pro`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        // Обновляем список локально, чтобы не перезагружать всю страницу
        setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isPro: result.isPro } : u));
        fetchDashboardData(); // Обновляем статистику в фоне
      }
    } catch (e) {
      alert('Ошибка при изменении статуса');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/boss-login');
  };

  // Фильтрация пользователей
  const filteredUsers = allUsers.filter(u => 
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.id && u.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.phone && u.phone.includes(searchQuery))
  );

  // --- СТИЛИ ТЕМЫ ---
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
      <div className={`min-h-screen ${theme.bg} flex flex-col items-center justify-center transition-colors`}>
        <RefreshCw className="animate-spin text-blue-500 mb-4" size={32} />
        <p className={`${theme.muted} font-mono animate-pulse`}>Установка защищенного соединения...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} font-sans transition-colors duration-300`}>
      
      {/* HEADER */}
      <header className={`${theme.card} border-b sticky top-0 z-50 px-6 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center border border-red-500/20">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-widest leading-none">System Core</h1>
            <p className={`text-[10px] uppercase font-bold tracking-widest ${theme.muted} mt-1`}><Activity size={10} className="inline mr-1 mb-0.5 text-green-500"/> Connection Secure</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsDark(!isDark)} 
            className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={handleLogout} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors ${isDark ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
            <LogOut size={16} /> Выход
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        
        {/* НАВИГАЦИЯ */}
        <div className="flex gap-2 mb-8">
          <button onClick={() => setActiveTab('overview')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : `${theme.card} ${theme.muted} hover:${theme.text}`}`}>
            Мониторинг
          </button>
          <button onClick={() => setActiveTab('users')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : `${theme.card} ${theme.muted} hover:${theme.text}`}`}>
            Управление клиентами
          </button>
        </div>

        {/* === ВКЛАДКА: МОНИТОРИНГ === */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* СТАТИСТИКА */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className={`${theme.card} border rounded-2xl p-6 relative overflow-hidden group`}>
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                <h3 className={`${theme.muted} text-xs uppercase font-bold tracking-wider mb-2 flex items-center gap-2`}><Users size={14} className="text-blue-500"/> Всего юзеров</h3>
                <p className="text-4xl font-black">{data?.stats?.totalUsers || 0}</p>
              </div>
              
              <div className={`${theme.card} border rounded-2xl p-6 relative overflow-hidden group`}>
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/20 transition-all"></div>
                <h3 className={`${theme.muted} text-xs uppercase font-bold tracking-wider mb-2 flex items-center gap-2`}><Crown size={14} className="text-yellow-500"/> PRO Аккаунты</h3>
                <p className="text-4xl font-black">{data?.stats?.proUsers || 0}</p>
              </div>

              <div className={`${theme.card} border rounded-2xl p-6 relative overflow-hidden group`}>
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                <h3 className={`${theme.muted} text-xs uppercase font-bold tracking-wider mb-2 flex items-center gap-2`}><LinkIcon size={14} className="text-emerald-500"/> Соцсети (Группы)</h3>
                <p className="text-4xl font-black">{data?.stats?.totalAccounts || 0}</p>
              </div>

              <div className={`${theme.card} border rounded-2xl p-6 relative overflow-hidden group`}>
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
                <h3 className={`${theme.muted} text-xs uppercase font-bold tracking-wider mb-2 flex items-center gap-2`}><MessageSquare size={14} className="text-purple-500"/> Опубликовано</h3>
                <p className="text-4xl font-black">{data?.stats?.totalPosts || 0}</p>
              </div>
            </div>

            {/* НЕДАВНИЕ РЕГИСТРАЦИИ (КРАТКО) */}
            <div className={`${theme.card} border rounded-2xl p-6`}>
              <h2 className="text-lg font-bold mb-4">Новые регистрации</h2>
              <div className={`border ${theme.border} rounded-xl overflow-hidden`}>
                <table className="w-full text-sm text-left">
                  <thead className={`${theme.tableHeader} uppercase text-xs font-bold ${theme.muted}`}>
                    <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Контакты</th>
                      <th className="px-6 py-4">Статус</th>
                      <th className="px-6 py-4">Дата</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme.border}`}>
                    {data?.recentUsers?.map(u => (
                      <tr key={u.id} className={`${theme.rowHover} transition-colors`}>
                        <td className="px-6 py-4 font-mono text-xs">{u.id.split('-')[0]}...</td>
                        <td className="px-6 py-4">
                          <div className="font-bold">{u.email || 'Нет почты'}</div>
                          <div className={`text-xs ${theme.muted}`}>{u.phone || 'Нет телефона'}</div>
                        </td>
                        <td className="px-6 py-4">
                          {u.isPro ? <span className="text-yellow-600 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20 font-bold text-[10px] uppercase">PRO</span> : <span className={`bg-gray-500/10 px-2 py-1 rounded border border-gray-500/20 font-bold text-[10px] uppercase ${theme.muted}`}>Free</span>}
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

        {/* === ВКЛАДКА: ПОЛЬЗОВАТЕЛИ (ВЫДАЧА PRO) === */}
        {activeTab === 'users' && (
          <div className={`${theme.card} border rounded-2xl p-6 animate-in fade-in duration-300`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2"><Users className="text-blue-500"/> База клиентов</h2>
              <div className="relative w-full sm:w-72">
                <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.muted}`} />
                <input 
                  type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по Email или ID..."
                  className={`w-full ${theme.inputBg} border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors`}
                />
              </div>
            </div>

            <div className={`border ${theme.border} rounded-xl overflow-hidden overflow-x-auto`}>
              <table className="w-full text-sm text-left min-w-[800px]">
                <thead className={`${theme.tableHeader} uppercase text-xs font-bold ${theme.muted}`}>
                  <tr>
                    <th className="px-6 py-4">ID (Копируется)</th>
                    <th className="px-6 py-4">Данные клиента</th>
                    <th className="px-6 py-4">Роль</th>
                    <th className="px-6 py-4 text-right">Управление PRO</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme.border}`}>
                  {filteredUsers.length > 0 ? filteredUsers.map(u => (
                    <tr key={u.id} className={`${theme.rowHover} transition-colors`}>
                      <td className="px-6 py-4 font-mono text-[11px] select-all cursor-copy text-blue-500" title="Нажмите, чтобы выделить">{u.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold">{u.name || 'Без имени'}</div>
                        <div className="text-sm mt-0.5">{u.email || 'Нет почты'}</div>
                        <div className={`text-xs ${theme.muted}`}>{u.phone || 'Нет телефона'}</div>
                      </td>
                      <td className="px-6 py-4">
                        {u.role === 'ADMIN' ? (
                          <span className="text-red-500 bg-red-500/10 px-2 py-1 rounded font-bold text-[10px] uppercase border border-red-500/20"><ShieldAlert size={10} className="inline mr-1 mb-0.5"/> ADMIN</span>
                        ) : (
                          <span className={`${theme.muted} bg-gray-500/10 px-2 py-1 rounded font-bold text-[10px] uppercase border border-gray-500/20`}>USER</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {u.isPro ? (
                          <button onClick={() => handleTogglePro(u.id)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-yellow-500/10 hover:bg-red-500/10 text-yellow-600 hover:text-red-500 border border-yellow-500/20 hover:border-red-500/30 rounded-lg text-xs font-bold transition-all group">
                            <span className="group-hover:hidden flex items-center gap-1"><Crown size={14}/> PRO Активен</span>
                            <span className="hidden group-hover:flex items-center gap-1"><XCircle size={14}/> Забрать PRO</span>
                          </button>
                        ) : (
                          <button onClick={() => handleTogglePro(u.id)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-600/10 dark:hover:bg-blue-600 dark:text-blue-400 dark:border-blue-500/30 border border-blue-200 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-blue-500/20">
                            <CheckCircle2 size={14}/> Выдать PRO
                          </button>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" className={`px-6 py-12 text-center ${theme.muted}`}>Пользователи не найдены</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}