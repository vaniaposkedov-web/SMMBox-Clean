import { useEffect, useState } from 'react';
import { 
  Users, Crown, MessageSquare, LogOut, Sun, Search, ShieldAlert, 
  Activity, Eye, X, Loader2, Settings, TrendingUp, CreditCard,
  BarChart3, Database, Wrench, AlertTriangle, Network, Package, Plus, Save
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  const [data, setData] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('finances'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [planUserSearch, setPlanUserSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [editPavilion, setEditPavilion] = useState('');
  const [isSavingPavilion, setIsSavingPavilion] = useState(false);

  const [proModal, setProModal] = useState({ isOpen: false, user: null });
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [proMonths, setProMonths] = useState(1);
  const [proCustomAmount, setProCustomAmount] = useState('');
  const [isSubmittingPro, setIsSubmittingPro] = useState(false);

  const [aiPrompt, setAiPrompt] = useState('');
  const [isSavingAi, setIsSavingAi] = useState(false);

  const [isDark, setIsDark] = useState(() => localStorage.getItem('adminTheme') !== 'light');

  // Фейковые данные для графиков, пока нет реальных
  const mockActivityData = [
    { time: '00:00', users: 12, posts: 5 }, { time: '04:00', users: 8, posts: 2 },
    { time: '08:00', users: 45, posts: 20 }, { time: '12:00', users: 120, posts: 85 },
    { time: '16:00', users: 142, posts: 110 }, { time: '20:00', users: 90, posts: 60 }
  ];

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
      if (res.status === 403 || res.status === 401) return navigate('/boss-login');
      const result = await res.json();
      if (result?.success) setData(result);

      const usersRes = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
      const usersData = await usersRes.json();
      if (usersData?.success) setAllUsers(usersData.users || []);

      const plansRes = await fetch('/api/admin/plans', { headers: { 'Authorization': `Bearer ${token}` } });
      const plansData = await plansRes.json();
      if (plansData?.success) setPlans(plansData.plans || []);

      const aiRes = await fetch('/api/admin/settings/ai', { headers: { 'Authorization': `Bearer ${token}` } });
      const aiData = await aiRes.json();
      if (aiData?.success) setAiPrompt(aiData.aiPrompt);

    } catch (e) { console.error('Ошибка загрузки данных:', e); }
    setLoading(false);
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const submitProGrant = async () => {
    setIsSubmittingPro(true);
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`/api/admin/users/${proModal.user.id}/grant-pro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ planId: selectedPlanId, months: Number(proMonths), customAmount: proCustomAmount ? Number(proCustomAmount) : null })
      });
      const result = await res.json();
      if (result?.success) {
        setProModal({ isOpen: false, user: null });
        fetchDashboardData(); 
      } else alert(result.error);
    } catch (e) { alert('Ошибка выдачи'); }
    setIsSubmittingPro(false);
  };

  const revokePro = async (userId) => {
    if (!window.confirm('Точно забрать подписку у пользователя?')) return;
    const token = localStorage.getItem('adminToken');
    try {
      await fetch(`/api/admin/users/${userId}/grant-pro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ months: 0 })
      });
      fetchDashboardData();
    } catch (e) {}
  };

  const saveAiPrompt = async () => {
    setIsSavingAi(true);
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch('/api/admin/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ aiPrompt })
      });
      if (res.ok) alert('Промпт ИИ сохранен!');
    } catch (e) {}
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
      if (result?.success) {
          setUserDetails(result);
          setEditPavilion(result.user.pavilion || ''); 
      }
    } catch (e) {}
    setLoadingDetails(false);
  };

  const savePavilion = async () => {
      setIsSavingPavilion(true);
      const token = localStorage.getItem('adminToken');
      try {
          const res = await fetch(`/api/admin/users/${userDetails.user.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ pavilion: editPavilion })
          });
          if (res.ok) {
              fetchDashboardData(); 
              alert('Доп. информация сохранена!');
          }
      } catch (e) { alert('Ошибка сохранения'); }
      setIsSavingPavilion(false);
  };

  const filteredUsers = allUsers.filter(u => 
    (u?.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u?.id && u.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u?.phone && u.phone.includes(searchQuery))
  );

  const planSearchFilteredUsers = allUsers.filter(u => 
    planUserSearch && ((u?.email && u.email.toLowerCase().includes(planUserSearch.toLowerCase())) || (u?.id && u.id.toLowerCase().includes(planUserSearch.toLowerCase())))
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

  const menuItems = [
    { id: 'finances', label: '1. Финансы', icon: TrendingUp },
    { id: 'users-stats', label: '2. Статистика юзеров', icon: BarChart3 },
    { id: 'users-db', label: '3. База пользователей', icon: Users },
    { id: 'plans', label: '4. Тарифы / Подписки', icon: Package },
    { id: 'prompts', label: '5. Промпты ИИ', icon: Settings },
    { id: 'maintenance', label: '6. Тех. работы', icon: Wrench },
    { id: 'backend-db', label: '7. Бэкенд / База', icon: Database },
    { id: 'errors', label: '8. Ошибки и Логи', icon: AlertTriangle },
    { id: 'partner-api', label: '9. API Партнеров', icon: Network },
  ];

  if (loading) return <div className={`min-h-[100dvh] ${theme.bg} flex justify-center items-center`}><Loader2 className="animate-spin text-blue-500" size={40}/></div>;

  return (
    <div translate="no" className={`min-h-[100dvh] ${theme.bg} ${theme.text} font-sans flex flex-col md:flex-row transition-colors`}>
      
      {/* СТЕКЛЯННОЕ БОКОВОЕ МЕНЮ */}
      <aside className={`w-full md:w-72 ${theme.card} border-b md:border-b-0 md:border-r shrink-0 flex flex-col md:min-h-screen sticky top-0 z-40`}>
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-blue-500" size={28} />
            <div>
              <h1 className="text-xl font-black uppercase tracking-widest leading-none">System Core</h1>
              <p className={`text-[10px] uppercase font-bold text-green-500 mt-1`}><Activity size={10} className="inline mr-1"/> Root Access</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto md:overflow-y-auto py-4 px-3 flex md:flex-col gap-2 hide-scrollbar">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-shrink-0 md:w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                  isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : `text-gray-400 hover:bg-gray-800/50 hover:text-white`
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-gray-500'} />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-800 flex gap-2">
           <button onClick={() => setIsDark(!isDark)} className={`flex-1 p-3 rounded-xl flex items-center justify-center bg-gray-800 text-yellow-400 hover:bg-gray-700 transition-colors`}><Sun size={18} /></button>
           <button onClick={() => { localStorage.removeItem('adminToken'); navigate('/boss-login'); }} className={`flex-[3] p-3 rounded-xl flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-sm transition-colors`}><LogOut size={16} className="mr-2"/> Выход</button>
        </div>
      </aside>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">

          {/* === 1. ФИНАНСЫ === */}
          {activeTab === 'finances' && (
            <>
              <div className="flex items-center justify-between mb-6">
                 <h2 className="text-2xl font-bold">Финансовая Аналитика</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-green-900 to-green-950 border border-green-500/30 rounded-2xl p-6 relative overflow-hidden">
                  <h3 className="text-green-400 text-xs font-bold uppercase mb-2">Выручка за сегодня</h3>
                  <p className="text-4xl font-black text-white">{data?.stats?.revenue?.today || 0} ₽</p>
                  <TrendingUp className="absolute right-[-10px] bottom-[-10px] text-green-500/20" size={100}/>
                </div>
                <div className="bg-gradient-to-br from-blue-900 to-blue-950 border border-blue-500/30 rounded-2xl p-6 relative overflow-hidden">
                  <h3 className="text-blue-400 text-xs font-bold uppercase mb-2">Выручка в этом месяце</h3>
                  <p className="text-4xl font-black text-white">{data?.stats?.revenue?.month || 0} ₽</p>
                  <CreditCard className="absolute right-[-10px] bottom-[-10px] text-blue-500/20" size={100}/>
                </div>
                <div className={`${theme.card} border rounded-2xl p-6`}>
                  <h3 className={`${theme.muted} text-xs font-bold uppercase mb-2`}>Всего заработано</h3>
                  <p className="text-4xl font-black">{data?.stats?.revenue?.total || 0} ₽</p>
                </div>
              </div>

              <div className={`${theme.card} border rounded-2xl p-6`}>
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><TrendingUp className="text-blue-500"/> Динамика дохода (Месяцы)</h2>
                <div className="h-72 w-full">
                  {data?.stats?.revenue?.chart && data.stats.revenue.chart.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.stats.revenue.chart}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#E5E7EB"} vertical={false} />
                        <XAxis dataKey="month" stroke="#9CA3AF" axisLine={false} tickLine={false} tickMargin={10} />
                        <YAxis stroke="#9CA3AF" axisLine={false} tickLine={false} tickFormatter={(value) => `${value}₽`} />
                        <Tooltip cursor={{ fill: isDark ? '#1F2937' : '#F3F4F6' }} contentStyle={{ backgroundColor: isDark ? '#111318' : '#fff', borderColor: isDark ? '#1F2937' : '#E5E7EB', borderRadius: '12px' }} formatter={(value) => [`${value} ₽`, 'Выручка']} />
                        <Bar dataKey="total" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 font-mono text-sm">НЕТ ДАННЫХ ДЛЯ ГРАФИКА</div>
                  )}
                </div>
              </div>

              <div className={`${theme.card} border rounded-2xl p-6`}>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><CreditCard className="text-green-500"/> Последние оплаты (История)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className={`${theme.tableHeader} uppercase text-xs font-bold ${theme.muted}`}>
                      <tr>
                        <th className="px-6 py-4">Сумма</th>
                        <th className="px-6 py-4">Клиент</th>
                        <th className="px-6 py-4">Тариф</th>
                        <th className="px-6 py-4 text-right">Дата</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${theme.border}`}>
                      {data?.recentTransactions?.map(t => (
                        <tr key={t.id} className={theme.rowHover}>
                          <td className="px-6 py-4 font-black text-green-500">+{t.amount} ₽</td>
                          <td className="px-6 py-4 font-bold">{t.user?.email || t.user?.id}</td>
                          <td className="px-6 py-4"><span className="bg-blue-600/20 text-blue-500 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-bold">{t.type}</span></td>
                          <td className="px-6 py-4 text-right text-xs text-gray-500">{new Date(t.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                      {(!data?.recentTransactions || data.recentTransactions.length === 0) && (
                        <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500 font-mono">История оплат пуста</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* === 2. СТАТИСТИКА ЮЗЕРОВ === */}
          {activeTab === 'users-stats' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold mb-4">Живая статистика и нагрузка</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`${theme.card} border rounded-2xl p-6`}>
                  <h3 className={`${theme.muted} text-xs uppercase font-bold mb-2`}>Общий онлайн сейчас</h3>
                  <p className="text-4xl font-black text-green-500 animate-pulse">24</p>
                  <p className="text-xs text-gray-500 mt-2">Активных соединений</p>
                </div>
                <div className={`${theme.card} border rounded-2xl p-6`}>
                  <h3 className={`${theme.muted} text-xs uppercase font-bold mb-2`}>Пиковая нагрузка (Сегодня)</h3>
                  <p className="text-4xl font-black text-blue-500">142</p>
                  <p className="text-xs text-gray-500 mt-2">Пользователей одновременно</p>
                </div>
                <div className={`${theme.card} border rounded-2xl p-6`}>
                  <h3 className={`${theme.muted} text-xs uppercase font-bold mb-2`}>Сгенерировано постов (Месяц)</h3>
                  <p className="text-4xl font-black text-purple-500">{data?.stats?.totalPosts || 0}</p>
                  <p className="text-xs text-gray-500 mt-2">Нейросетью и вручную</p>
                </div>
              </div>
              <div className={`${theme.card} border rounded-2xl p-6`}>
                 <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><Activity className="text-blue-500"/> График активности (Сутки)</h2>
                 <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mockActivityData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#E5E7EB"} vertical={false} />
                        <XAxis dataKey="time" stroke="#9CA3AF" axisLine={false} tickLine={false} />
                        <YAxis stroke="#9CA3AF" axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: isDark ? '#111318' : '#fff', borderColor: isDark ? '#1F2937' : '#E5E7EB', borderRadius: '12px' }} />
                        <Line type="monotone" dataKey="users" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} name="Пользователи" />
                        <Line type="monotone" dataKey="posts" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4 }} name="Посты" />
                      </LineChart>
                    </ResponsiveContainer>
                 </div>
              </div>
            </div>
          )}

          {/* === 3. БАЗА ПОЛЬЗОВАТЕЛЕЙ === */}
          {activeTab === 'users-db' && (
            <div className={`${theme.card} border rounded-2xl p-6`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                  <h2 className="text-xl font-bold">База знаний клиентов</h2>
                  <p className="text-sm text-gray-500">Всего юзеров: {data?.stats?.totalUsers || 0}</p>
                </div>
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Поиск по ID, Email, Телефону..." className={`w-full sm:w-80 pl-10 pr-4 py-2 ${theme.inputBg} border rounded-xl outline-none focus:border-blue-500 text-sm`} />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className={`${theme.tableHeader} uppercase text-xs font-bold ${theme.muted}`}>
                    <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Контакты</th>
                      <th className="px-6 py-4">Тариф</th>
                      <th className="px-6 py-4 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme.border}`}>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className={theme.rowHover}>
                        <td className="px-6 py-4 font-mono text-xs text-blue-500">{u.id}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold">{u.email || u.name}</div>
                          <div className="text-xs text-gray-500">{u.phone || 'Нет телефона'}</div>
                        </td>
                        <td className="px-6 py-4">
                          {u.isPro ? <div className="text-yellow-500 font-bold">{u.proPlanType || 'PRO'}<br/><span className="text-[10px] text-gray-500">до {u.proExpiresAt ? new Date(u.proExpiresAt).toLocaleDateString() : '∞'}</span></div> : <span className="text-gray-500 font-bold">FREE</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openUserDetails(u.id)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-colors mr-2">Досье</button>
                          <button onClick={() => setProModal({ isOpen: true, user: u })} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors">Управление подпиской</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* === 4. ТАРИФЫ И ПОДПИСКИ === */}
          {activeTab === 'plans' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-4">Настройка Тарифов (3 уровня)</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Рендер списка тарифов из БД */}
                  {plans.map(plan => (
                    <div key={plan.id} className={`${theme.card} border rounded-2xl p-6 relative flex flex-col`}>
                      <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                      <p className="text-3xl font-black text-blue-500 mb-4">{plan.price} ₽</p>
                      <ul className="text-sm text-gray-400 space-y-2 mb-6 flex-1">
                        <li>• Макс. аккаунтов: <span className="text-white font-bold">{plan.maxAccounts}</span></li>
                        <li>• Постов в день: <span className="text-white font-bold">{plan.maxPostsPerDay}</span></li>
                      </ul>
                      <button className="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold text-sm transition-colors text-white">Изменить лимиты</button>
                    </div>
                  ))}
                  {/* Кнопка добавления */}
                  <div className={`${theme.card} border border-dashed border-gray-600 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-gray-500 transition-colors cursor-pointer min-h-[250px]`}>
                    <Plus size={32} className="mb-2"/>
                    <span className="font-bold">Добавить новый тариф</span>
                  </div>
                </div>
              </div>

              {/* ПОИСК И ВЫДАЧА ПРЯМО СО СТРАНИЦЫ ТАРИФОВ */}
              <div className={`${theme.card} border rounded-2xl p-6`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Search className="text-blue-500"/> Быстрая выдача подписки</h2>
                <p className="text-sm text-gray-500 mb-4">Найдите пользователя по ID или Email, чтобы назначить, продлить или забрать подписку.</p>
                <input 
                  type="text" 
                  value={planUserSearch} 
                  onChange={(e) => setPlanUserSearch(e.target.value)} 
                  placeholder="Введите ID или Email..." 
                  className={`w-full max-w-md p-3 rounded-xl border ${theme.border} ${theme.inputBg} focus:border-blue-500 outline-none transition-colors mb-4`} 
                />
                
                {planUserSearch && (
                  <div className="border border-gray-800 rounded-xl overflow-hidden mt-4">
                    {planSearchFilteredUsers.map(u => (
                      <div key={u.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-black border-b border-gray-800 last:border-0 gap-4">
                        <div>
                          <div className="font-bold text-white">{u.email || 'Без Email'} <span className="text-gray-500 font-mono text-xs">({u.id})</span></div>
                          <div className="text-xs mt-1">Текущий статус: {u.isPro ? <span className="text-yellow-500 font-bold">{u.proPlanType || 'PRO'}</span> : <span className="text-gray-500">FREE</span>}</div>
                        </div>
                        <div className="flex gap-2">
                           {u.isPro && <button onClick={() => revokePro(u.id)} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-bold transition-colors">Забрать</button>}
                           <button onClick={() => setProModal({ isOpen: true, user: u })} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors">Выдать / Продлить</button>
                        </div>
                      </div>
                    ))}
                    {planSearchFilteredUsers.length === 0 && <div className="p-4 text-sm text-gray-500">Пользователь не найден.</div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === 5. ПРОМПТЫ НЕЙРОСЕТИ === */}
          {activeTab === 'prompts' && (
            <div className={`${theme.card} border rounded-2xl p-6 max-w-4xl`}>
               <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Settings className="text-purple-500"/> Системный Промпт (Генерация текста)</h2>
               <p className={`text-sm ${theme.muted} mb-6`}>Настройка инструкций, которые подгружаются в работу нейросети Gemini для всех пользователей. Это формирует стиль и логику написания постов.</p>
               <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} className={`w-full h-[400px] p-4 rounded-xl border ${theme.border} ${theme.inputBg} resize-none font-mono text-sm leading-relaxed outline-none focus:border-purple-500 transition-colors`} placeholder="Введите базовый промпт..." />
               <button onClick={saveAiPrompt} disabled={isSavingAi} className="mt-6 bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold transition-colors flex items-center gap-2">
                 {isSavingAi ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />} Сохранить конфигурацию
               </button>
            </div>
          )}

          {/* === 6. ТЕХНИЧЕСКИЕ РАБОТЫ === */}
          {activeTab === 'maintenance' && (
            <div className={`${theme.card} border border-orange-500/30 rounded-2xl p-8 max-w-3xl relative overflow-hidden`}>
               <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
               <div className="flex items-center gap-4 mb-6">
                 <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-500"><Wrench size={32}/></div>
                 <div>
                   <h2 className="text-2xl font-bold text-white">Полное отключение бэкенда</h2>
                   <p className="text-sm text-gray-400 mt-1">Блокирует доступ к API и фронтенду для защиты от атак или при проведении апдейтов.</p>
                 </div>
               </div>
               
               <div className="space-y-6">
                 <div>
                   <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Текст уведомления для пользователей</label>
                   <textarea className={`w-full h-24 p-4 rounded-xl border ${theme.border} ${theme.inputBg} resize-none outline-none focus:border-orange-500`} defaultValue="Сервер временно недоступен. Ведутся технические работы. Мы вернемся в ближайшее время!" />
                 </div>
                 <div className="flex items-center justify-between p-5 bg-black/50 border border-red-500/30 rounded-xl mt-6">
                   <div>
                     <span className="font-bold text-red-500 text-lg block">Активировать Maintenance Mode</span>
                     <span className="text-xs text-gray-500">Все пользователи будут немедленно отключены.</span>
                   </div>
                   <button className="w-16 h-8 bg-gray-800 rounded-full relative transition-colors focus:outline-none border border-gray-700">
                      <span className="absolute left-1 top-1 w-6 h-6 bg-gray-500 rounded-full transition-transform"></span>
                   </button>
                 </div>
               </div>
            </div>
          )}

          {/* === 7. БЭКЕНД И БАЗА ДАННЫХ === */}
          {activeTab === 'backend-db' && (
            <div className={`${theme.card} border rounded-2xl p-10 text-center`}>
               <Database className="mx-auto text-blue-500 mb-4" size={48} />
               <h3 className="text-xl font-bold text-white mb-2">Прямое управление Prisma DB</h3>
               <p className="text-sm text-gray-400 max-w-md mx-auto mb-8">Здесь будет интерфейс для полного копирования, скачивания дампов базы данных (PostgreSQL) на устройство и прямого просмотра ключевых сущностей.</p>
               <div className="flex justify-center gap-4">
                 <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors">Подключить Data Grid</button>
                 <button className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 rounded-xl font-bold transition-colors">Скачать дамп БД (.sql)</button>
               </div>
            </div>
          )}

          {/* === 8. ОШИБКИ И ЛОГИ === */}
          {activeTab === 'errors' && (
            <div className={`${theme.card} border border-red-500/20 rounded-2xl p-6`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2"><AlertTriangle className="text-red-500"/> Мониторинг Ошибок</h2>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-xs font-bold">Backend Logs</button>
                  <button className="px-3 py-1.5 bg-gray-800 text-gray-400 rounded-lg text-xs font-bold">Frontend Errors</button>
                </div>
              </div>
              
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 font-mono text-xs space-y-3 h-[500px] overflow-y-auto">
                {/* Пример того, как будут выглядеть логи с ID */}
                <div className="p-2 bg-red-900/10 border-l-2 border-red-500 rounded text-red-400">
                  [2026-04-16 12:05:22] ERROR: VkApi Auth Failed.<br/>
                  <span className="text-gray-500">User ID: <span className="text-blue-400 cursor-pointer hover:underline">123e4567-e89b-12d3-a456-426614174000</span></span><br/>
                  <span className="text-gray-500">Trace: at AuthController.login (/app/src/controllers...)</span>
                </div>
                <div className="p-2 border-l-2 border-yellow-500 rounded text-yellow-400">
                  [2026-04-16 12:10:45] WARN: High latency on Gemini API endpoint (2500ms).<br/>
                  <span className="text-gray-500">User ID: SYSTEM</span>
                </div>
                <div className="p-2 bg-red-900/10 border-l-2 border-red-500 rounded text-red-400">
                  [2026-04-16 12:15:00] FRONTEND ERROR: Cannot read properties of undefined (reading 'map').<br/>
                  <span className="text-gray-500">User ID: <span className="text-blue-400 cursor-pointer hover:underline">987f6543-e21b-88c2-b123-998877665544</span></span><br/>
                  <span className="text-gray-500">Route: /publish</span>
                </div>
              </div>
            </div>
          )}

          {/* === 9. API ДЛЯ ПАРТНЕРОВ === */}
          {activeTab === 'partner-api' && (
            <div className={`${theme.card} border rounded-2xl p-6 max-w-3xl`}>
               <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><Network className="text-emerald-500"/> API для интеграторов (Финансы партнеров)</h2>
               <p className="text-sm text-gray-400 mb-8">Отдельная закрытая страница. Здесь админ выставляет процент дохода, а партнер видит свою выручку.</p>
               
               <div className="space-y-6">
                 <div className="flex gap-6">
                   <div className="flex-1">
                     <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Процент отчислений (%)</label>
                     <input type="number" defaultValue="30" className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg} focus:border-emerald-500 outline-none`} />
                   </div>
                   <div className="flex-1">
                     <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Выплата за текущий месяц</label>
                     <div className="w-full p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold font-mono">14 500 ₽</div>
                   </div>
                 </div>
                 
                 <div className="p-5 bg-gray-900 border border-gray-800 rounded-xl">
                   <h4 className="font-bold text-white mb-4">Активные API Ключи партнера</h4>
                   <div className="flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-black rounded-lg border border-gray-800 gap-2">
                     <span className="text-sm font-mono text-emerald-400 break-all">sk_live_19827398127398127391...</span>
                     <span className="text-xs text-gray-500 whitespace-nowrap">Создан: 12.04.2026</span>
                   </div>
                   <button className="mt-4 text-sm text-blue-500 font-bold hover:text-blue-400 transition-colors">+ Сгенерировать новый ключ</button>
                 </div>
               </div>
            </div>
          )}

        </div>
      </main>

      {/* === МОДАЛКА: ДОСЬЕ ЮЗЕРА (ДЛЯ РАЗДЕЛА 3) === */}
      {isModalOpen && userDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`${theme.card} w-full max-w-2xl border rounded-3xl p-6 shadow-2xl relative overflow-y-auto max-h-[90vh]`}>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-5 right-5 p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"><X size={20} /></button>
            <h2 className="text-2xl font-black mb-6">Досье клиента</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2 text-sm bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <p><span className="text-gray-500 block text-xs uppercase mb-1">ID Пользователя</span> <span className="font-mono text-blue-400">{userDetails.user.id}</span></p>
                <p><span className="text-gray-500 block text-xs uppercase mb-1 mt-3">Email</span> <span className="font-bold">{userDetails.user.email}</span></p>
                <p><span className="text-gray-500 block text-xs uppercase mb-1 mt-3">Регистрация</span> {new Date(userDetails.user.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="space-y-2 text-sm bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <p><span className="text-gray-500 block text-xs uppercase mb-1">Тариф</span> {userDetails.user.isPro ? <span className="text-yellow-500 font-bold bg-yellow-500/10 px-2 py-0.5 rounded">{userDetails.user.proPlanType || 'PRO'}</span> : <span className="text-gray-400 font-bold bg-gray-800 px-2 py-0.5 rounded">FREE</span>}</p>
                <p><span className="text-gray-500 block text-xs uppercase mb-1 mt-3">Подключено соцсетей</span> <span className="font-bold">{userDetails.user.accounts?.length}</span></p>
                <p><span className="text-gray-500 block text-xs uppercase mb-1 mt-3">Сгенерировано постов</span> <span className="font-bold text-purple-400">{userDetails.postsCount}</span></p>
              </div>
            </div>

            <div className="p-5 bg-gray-900 border border-gray-800 rounded-xl">
               <label className="text-xs font-bold text-gray-500 mb-3 block uppercase">Доп. Инфо / Внутренний коммент (Например: Павильон)</label>
               <div className="flex flex-col sm:flex-row gap-3">
                 <input 
                   type="text" 
                   value={editPavilion} 
                   onChange={(e) => setEditPavilion(e.target.value)}
                   className="flex-1 p-3 rounded-lg border border-gray-700 bg-black text-white outline-none focus:border-blue-500 transition-colors"
                   placeholder="Укажите данные..."
                 />
                 <button onClick={savePavilion} disabled={isSavingPavilion} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold transition-colors whitespace-nowrap">
                   {isSavingPavilion ? <Loader2 className="animate-spin mx-auto" size={18}/> : 'Сохранить'}
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* === МОДАЛКА: ВЫДАЧА ТАРИФА === */}
      {proModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`${theme.card} w-full max-w-sm border rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95`}>
            <button onClick={() => setProModal({ isOpen: false, user: null })} className="absolute top-5 right-5 p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"><X size={20}/></button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Crown className="text-yellow-500"/> Управление подпиской</h2>
            <p className="text-xs text-gray-500 mb-6 truncate">Клиент: {proModal.user.email || proModal.user.id}</p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Выберите Тариф</label>
                <select 
                  value={selectedPlanId} 
                  onChange={e => setSelectedPlanId(e.target.value)}
                  className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg} focus:border-blue-500 outline-none transition-colors appearance-none`}
                >
                  <option value="">-- Выберите тариф --</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price}₽)</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Кол-во месяцев</label>
                <input 
                  type="number" 
                  min="1"
                  value={proMonths} 
                  onChange={e => setProMonths(e.target.value)} 
                  className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg} focus:border-blue-500 outline-none transition-colors`} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Сумма оплаты (Кастомная)</label>
                <input 
                  type="number" 
                  value={proCustomAmount} 
                  onChange={e => setProCustomAmount(e.target.value)} 
                  className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg} focus:border-blue-500 outline-none transition-colors`} 
                  placeholder="Оставьте пустым для авто-расчета" 
                />
                <p className="text-[10px] text-gray-500 mt-1">Эта сумма пойдет в графики "Финансы".</p>
              </div>
            </div>
            <button onClick={submitProGrant} disabled={isSubmittingPro} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center">
              {isSubmittingPro ? <Loader2 className="animate-spin" size={20} /> : 'Выдать / Обновить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}