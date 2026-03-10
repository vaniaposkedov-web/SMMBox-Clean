import { useEffect, useState } from 'react';
import { 
  Users, Crown, MessageSquare, Link as LinkIcon, LogOut, 
  RefreshCw, Sun, Moon, Search, ShieldAlert, CheckCircle2, 
  XCircle, Activity, Eye, X, User as UserIcon, Calendar, 
  Mail, Phone, LayoutDashboard, LayoutTemplate, Send, Key, Loader2
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

    } catch (e) {
      console.error('Ошибка загрузки админки:', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const handleTogglePro = async (userId) => {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-pro`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result?.success) {
        setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isPro: result.isPro } : u));
        fetchDashboardData(); 
      }
    } catch (e) {
      alert('Ошибка при изменении статуса');
    }
  };

  const openUserDetails = async (userId) => {
    setIsModalOpen(true);
    setLoadingDetails(true);
    setUserDetails(null);
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await res.json();
      if (result?.success) {
        setUserDetails(result);
      } else {
        alert(result?.error || 'Ошибка загрузки данных');
        setIsModalOpen(false);
      }
    } catch (e) {
      alert('Ошибка загрузки досье');
      setIsModalOpen(false);
    }
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
        <p className={`${theme.muted} font-mono animate-pulse text-sm sm:text-base`}>Установка защищенного соединения...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-[100dvh] ${theme.bg} ${theme.text} font-sans transition-colors duration-300 pb-10`}>
      
      {/* HEADER (АДАПТИВНЫЙ) */}
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
          <button 
            onClick={() => setIsDark(!isDark)} 
            className={`p-2 sm:p-2.5 rounded-xl transition-colors ${isDark ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={handleLogout} className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition-colors text-xs sm:text-sm ${isDark ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
            <LogOut size={16} /> <span className="hidden sm:inline">Выход</span>
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        
        {/* НАВИГАЦИЯ (С ГОРИЗОНТАЛЬНЫМ СКРОЛЛОМ НА МОБИЛЬНЫХ) */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 sm:mb-8 -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0">
          <button onClick={() => setActiveTab('overview')} className={`px-5 sm:px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all shrink-0 ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : `${theme.card} border ${theme.border} ${theme.muted} hover:${theme.text}`}`}>
            Мониторинг
          </button>
          <button onClick={() => setActiveTab('users')} className={`px-5 sm:px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all shrink-0 ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : `${theme.card} border ${theme.border} ${theme.muted} hover:${theme.text}`}`}>
            Управление клиентами
          </button>
        </div>

        {/*  ВКЛАДКА: МОНИТОРИНГ */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* СТАТИСТИКА (АДАПТИВНАЯ СЕТКА) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className={`${theme.card} border rounded-2xl p-4 sm:p-6 relative overflow-hidden group`}>
                <div className="absolute -right-4 -top-4 w-20 h-20 sm:w-24 sm:h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                <h3 className={`${theme.muted} text-[10px] sm:text-xs uppercase font-bold tracking-wider mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2`}><Users size={14} className="text-blue-500 shrink-0"/> <span className="truncate">Юзеры</span></h3>
                <p className="text-2xl sm:text-4xl font-black">{data?.stats?.totalUsers || 0}</p>
              </div>
              
              <div className={`${theme.card} border rounded-2xl p-4 sm:p-6 relative overflow-hidden group`}>
                <div className="absolute -right-4 -top-4 w-20 h-20 sm:w-24 sm:h-24 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/20 transition-all"></div>
                <h3 className={`${theme.muted} text-[10px] sm:text-xs uppercase font-bold tracking-wider mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2`}><Crown size={14} className="text-yellow-500 shrink-0"/> <span className="truncate">PRO</span></h3>
                <p className="text-2xl sm:text-4xl font-black">{data?.stats?.proUsers || 0}</p>
              </div>

              <div className={`${theme.card} border rounded-2xl p-4 sm:p-6 relative overflow-hidden group`}>
                <div className="absolute -right-4 -top-4 w-20 h-20 sm:w-24 sm:h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                <h3 className={`${theme.muted} text-[10px] sm:text-xs uppercase font-bold tracking-wider mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2`}><LinkIcon size={14} className="text-emerald-500 shrink-0"/> <span className="truncate">Соцсети</span></h3>
                <p className="text-2xl sm:text-4xl font-black">{data?.stats?.totalAccounts || 0}</p>
              </div>

              <div className={`${theme.card} border rounded-2xl p-4 sm:p-6 relative overflow-hidden group`}>
                <div className="absolute -right-4 -top-4 w-20 h-20 sm:w-24 sm:h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
                <h3 className={`${theme.muted} text-[10px] sm:text-xs uppercase font-bold tracking-wider mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2`}><MessageSquare size={14} className="text-purple-500 shrink-0"/> <span className="truncate">Посты</span></h3>
                <p className="text-2xl sm:text-4xl font-black">{data?.stats?.totalPosts || 0}</p>
              </div>
            </div>

            {/* НЕДАВНИЕ РЕГИСТРАЦИИ */}
            <div className={`${theme.card} border rounded-2xl p-4 sm:p-6`}>
              <h2 className="text-base sm:text-lg font-bold mb-4">Новые регистрации</h2>
              
              {/* МОБИЛЬНЫЙ ВИД (КАРТОЧКИ) */}
              <div className="grid grid-cols-1 gap-3 sm:hidden">
                {data?.recentUsers?.map(u => (
                  <div key={u.id} className={`p-4 rounded-xl border ${theme.border} ${theme.bg}`}>
                    <div className="flex justify-between items-start mb-2">
                       <div className="font-bold text-sm truncate pr-2">{u.email || 'Нет почты'}</div>
                       {u.isPro ? <span className="text-yellow-600 bg-yellow-500/10 px-2 py-0.5 rounded font-bold text-[9px] uppercase shrink-0">PRO</span> : <span className={`bg-gray-500/10 px-2 py-0.5 rounded font-bold text-[9px] uppercase shrink-0 ${theme.muted}`}>Free</span>}
                    </div>
                    <div className={`text-xs ${theme.muted} flex justify-between`}>
                      <span>{u.phone || 'Нет телефона'}</span>
                      <span>{new Date(u.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </div>
                ))}
              </div>

               {/* ПК ВИД (ТАБЛИЦА) */}
              <div className={`hidden sm:block border ${theme.border} rounded-xl overflow-hidden`}>
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
                        <td className="px-6 py-4 font-mono text-xs">{u.id?.split('-')[0]}...</td>
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

        {/* ВКЛАДКА: ПОЛЬЗОВАТЕЛИ (АДАПТИВНАЯ) */}
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

            {/* МОБИЛЬНЫЙ ВИД БАЗЫ (КАРТОЧКИ) */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {filteredUsers.length > 0 ? filteredUsers.map(u => (
                <div key={u.id} className={`p-4 rounded-xl border ${theme.border} ${theme.bg} flex flex-col gap-3`}>
                  <div className="flex justify-between items-start">
                     <div className="min-w-0 flex-1 pr-3">
                       <div className="font-bold text-sm truncate">{u.name || 'Без имени'}</div>
                       <div className={`text-xs mt-0.5 truncate ${theme.text}`}>{u.email || 'Нет почты'}</div>
                       <div className={`text-xs mt-0.5 ${theme.muted}`}>{u.phone || 'Нет телефона'}</div>
                     </div>
                     <div className="shrink-0">
                       {u.role === 'ADMIN' ? (
                          <span className="text-red-500 bg-red-500/10 px-2 py-1 rounded font-bold text-[9px] uppercase border border-red-500/20 flex items-center gap-1"><ShieldAlert size={10}/> ADMIN</span>
                        ) : (
                          <span className={`${theme.muted} bg-gray-500/10 px-2 py-1 rounded font-bold text-[9px] uppercase border border-gray-500/20`}>USER</span>
                        )}
                     </div>
                  </div>
                  
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => openUserDetails(u.id)} className={`flex-1 py-2.5 flex items-center justify-center gap-2 rounded-lg transition-colors border ${theme.border} ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-white hover:bg-gray-50 text-gray-900'} text-xs font-bold`}>
                      <Eye size={14} /> Досье
                    </button>
                    
                    {u.isPro ? (
                      <button onClick={() => handleTogglePro(u.id)} className="flex-1 py-2.5 flex items-center justify-center gap-1.5 bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 rounded-lg text-xs font-bold transition-all">
                        <XCircle size={14}/> Забрать PRO
                      </button>
                    ) : (
                      <button onClick={() => handleTogglePro(u.id)} className="flex-1 py-2.5 flex items-center justify-center gap-1.5 bg-blue-600 text-white border border-blue-600 rounded-lg text-xs font-bold transition-all shadow-sm">
                        <CheckCircle2 size={14}/> Выдать PRO
                      </button>
                    )}
                  </div>
                </div>
              )) : (
                <div className={`py-12 text-center text-sm ${theme.muted}`}>Пользователи не найдены</div>
              )}
            </div>

            {/* ПК ВИД БАЗЫ (ТАБЛИЦА) */}
            <div className={`hidden md:block border ${theme.border} rounded-xl overflow-hidden overflow-x-auto`}>
              <table className="w-full text-sm text-left min-w-[800px]">
                <thead className={`${theme.tableHeader} uppercase text-xs font-bold ${theme.muted}`}>
                  <tr>
                    <th className="px-6 py-4">ID (Копируется)</th>
                    <th className="px-6 py-4">Данные клиента</th>
                    <th className="px-6 py-4">Роль</th>
                    <th className="px-6 py-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme.border}`}>
                  {filteredUsers.length > 0 ? filteredUsers.map(u => (
                    <tr key={u.id} className={`${theme.rowHover} transition-colors group/row`}>
                      <td className="px-6 py-4 font-mono text-[11px] select-all cursor-copy text-blue-500">{u.id}</td>
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
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openUserDetails(u.id)} className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`} title="Посмотреть досье">
                            <Eye size={16} />
                          </button>
                          
                          {u.isPro ? (
                            <button onClick={() => handleTogglePro(u.id)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-yellow-500/10 hover:bg-red-500/10 text-yellow-600 hover:text-red-500 border border-yellow-500/20 hover:border-red-500/30 rounded-lg text-xs font-bold transition-all group">
                              <span className="group-hover:hidden flex items-center gap-1"><Crown size={14}/> PRO Активен</span>
                              <span className="hidden group-hover:flex items-center gap-1"><XCircle size={14}/> Забрать PRO</span>
                            </button>
                          ) : (
                            <button onClick={() => handleTogglePro(u.id)} className={`inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white ${isDark ? 'dark:bg-blue-600/10 dark:hover:bg-blue-600 dark:text-blue-400 dark:border-blue-500/30' : ''} border border-blue-200 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-blue-500/20`}>
                              <CheckCircle2 size={14}/> Выдать PRO
                            </button>
                          )}
                        </div>
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

      {/* === МОДАЛЬНОЕ ОКНО "ДОСЬЕ ПОЛЬЗОВАТЕЛЯ" (АДАПТИВНОЕ) === */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${theme.card} w-full max-w-3xl border rounded-[2rem] p-5 sm:p-6 shadow-2xl relative max-h-[90vh] sm:max-h-[85vh] flex flex-col mb-4 sm:mb-0`}>
            <button onClick={() => setIsModalOpen(false)} className={`absolute top-4 sm:top-5 right-4 sm:right-5 p-2 rounded-full transition-colors z-10 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
              <X size={20} />
            </button>
            
            <h2 className="text-xl sm:text-2xl font-black mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 pr-10">
              <UserIcon className="text-blue-500 shrink-0" size={24} /> <span className="truncate">Досье клиента</span>
            </h2>
            
            <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 sm:pr-2 space-y-4 sm:space-y-6 pb-2">
              {loadingDetails || !userDetails ? (
                 <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>
              ) : (
                <div className="space-y-4 sm:space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                  
                  {/* Базовая информация */}
                  <div className={`p-4 sm:p-5 rounded-2xl border ${theme.border} ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'} grid grid-cols-1 sm:grid-cols-2 gap-4`}>
                    <div>
                      <p className={`text-[10px] sm:text-xs uppercase font-bold tracking-wider ${theme.muted} mb-1`}>Имя и Фамилия</p>
                      <p className="font-bold text-base sm:text-lg">{userDetails?.user?.name || 'Не указано'}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] sm:text-xs uppercase font-bold tracking-wider ${theme.muted} mb-1`}>Павильон</p>
                      <p className="font-bold text-base sm:text-lg">{userDetails?.user?.pavilion ? <span className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-lg border border-blue-500/20 text-sm">{userDetails.user.pavilion}</span> : 'Нет данных'}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 sm:mt-2 text-sm">
                      <Mail size={16} className={`${theme.muted} shrink-0`}/> 
                      <span className={`truncate ${userDetails?.user?.email?.includes('.local') ? 'text-red-500 font-bold' : ''}`}>{userDetails?.user?.email || 'Нет'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 sm:mt-2 text-sm">
                      <Phone size={16} className={`${theme.muted} shrink-0`}/> 
                      <span>{userDetails?.user?.phone || 'Нет телефона'}</span>
                    </div>
                  </div>

                  {/* Технические данные */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${theme.border}`}>
                      <p className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-wider ${theme.muted} mb-1 flex items-center gap-1`}><Calendar size={12}/> Дата регистрации</p>
                      <p className="font-medium text-xs sm:text-sm">{userDetails?.user?.createdAt ? new Date(userDetails.user.createdAt).toLocaleDateString('ru-RU') : 'Нет данных'}</p>
                    </div>
                    <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${theme.border}`}>
                      <p className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-wider ${theme.muted} mb-1 flex items-center gap-1`}><Key size={12}/> Идентификатор</p>
                      <p className="font-mono text-[10px] truncate select-all text-blue-400">{userDetails?.user?.id}</p>
                    </div>
                    <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${theme.border}`}>
                      <p className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-wider ${theme.muted} mb-1 flex items-center gap-1`}><Activity size={12}/> Онбординг</p>
                      <p className="font-medium text-xs sm:text-sm">
                        {userDetails?.user?.isOnboardingCompleted ? <span className="text-green-500 flex items-center gap-1"><CheckCircle2 size={14}/> Пройден</span> : <span className="text-yellow-500 flex items-center gap-1"><RefreshCw size={14}/> В процессе</span>}
                      </p>
                    </div>
                  </div>

                  {/* Статистика активности */}
                  <h3 className="text-base sm:text-lg font-bold border-b border-gray-800 pb-2 mt-2 sm:mt-4 flex items-center gap-2"><LayoutDashboard size={16} className="text-purple-500"/> Активность</h3>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border ${theme.border} flex items-center justify-between`}>
                      <div>
                        <p className={`text-[10px] sm:text-xs uppercase font-bold tracking-wider ${theme.muted}`}>Групп</p>
                        <p className="text-2xl sm:text-3xl font-black mt-1">{userDetails?.user?.accounts?.length || 0}</p>
                      </div>
                      <LinkIcon size={24} className="text-gray-700 opacity-20 sm:w-8 sm:h-8" />
                    </div>
                    <div className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border ${theme.border} flex items-center justify-between`}>
                      <div>
                        <p className={`text-[10px] sm:text-xs uppercase font-bold tracking-wider ${theme.muted}`}>Постов</p>
                        <p className="text-2xl sm:text-3xl font-black mt-1">{userDetails?.postsCount || 0}</p>
                      </div>
                      <MessageSquare size={24} className="text-gray-700 opacity-20 sm:w-8 sm:h-8" />
                    </div>
                  </div>

                  {/* Список подключенных групп */}
                  {userDetails?.user?.accounts?.length > 0 && (
                    <div className="space-y-2 sm:space-y-3">
                      <p className={`text-[10px] sm:text-xs uppercase font-bold tracking-wider ${theme.muted}`}>Список групп / каналов</p>
                      <div className={`border ${theme.border} rounded-xl overflow-hidden`}>
                        {userDetails.user.accounts.map(acc => (
                          <div key={acc.id} className={`flex items-center justify-between p-3 border-b ${theme.border} last:border-0 ${isDark ? 'bg-gray-900/30' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-2">
                              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded flex items-center justify-center font-bold text-[8px] sm:text-[10px] text-white shrink-0 ${acc.provider === 'VK' ? 'bg-[#0077FF]' : 'bg-sky-500'}`}>
                                {acc.provider === 'VK' ? 'VK' : 'TG'}
                              </div>
                              <p className="font-bold text-xs sm:text-sm truncate">{acc.name}</p>
                            </div>
                            {acc.isValid ? <span className="shrink-0 text-[9px] sm:text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded font-bold uppercase">Активен</span> : <span className="shrink-0 text-[9px] sm:text-[10px] text-red-500 bg-red-500/10 px-2 py-0.5 rounded font-bold uppercase">Ошибка</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Шаблоны */}
                  <div className={`p-3 sm:p-4 rounded-xl border ${theme.border} ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                    <h4 className="text-xs sm:text-sm font-bold flex items-center gap-2 mb-2"><LayoutTemplate size={14} className="text-blue-500"/> Глобальные настройки</h4>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs sm:text-sm">
                      <p><span className={theme.muted}>Подпись:</span> {userDetails?.user?.globalSignature ? <span className="text-blue-500 font-bold">Настроена</span> : 'Нет'}</p>
                      <p><span className={theme.muted}>Водяной знак:</span> {userDetails?.user?.globalWatermark ? <span className="text-blue-500 font-bold">Настроен ({userDetails.user.globalWatermark.type})</span> : 'По умолчанию'}</p>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}