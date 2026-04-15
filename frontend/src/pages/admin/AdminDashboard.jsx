import { useEffect, useState } from 'react';
import { 
  Users, Crown, MessageSquare, LogOut, Sun, Search, ShieldAlert, 
  Activity, Eye, X, Send, Loader2, Settings, TrendingUp, CreditCard,
  BarChart3, Database, Wrench, AlertTriangle, Network, Package
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  // === СТЕЙТЫ ДАННЫХ ===
  const [data, setData] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // === НАВИГАЦИЯ (9 РАЗДЕЛОВ) ===
  const [activeTab, setActiveTab] = useState('finances'); 
  
  // === СТЕЙТЫ ДЛЯ МОДАЛОК И ФОРМ ===
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [editPavilion, setEditPavilion] = useState('');
  const [isSavingPavilion, setIsSavingPavilion] = useState(false);

  const [proModal, setProModal] = useState({ isOpen: false, user: null });
  const [proMonths, setProMonths] = useState(1);
  const [proAmount, setProAmount] = useState(2000);
  const [isSubmittingPro, setIsSubmittingPro] = useState(false);

  const [aiPrompt, setAiPrompt] = useState('');
  const [isSavingAi, setIsSavingAi] = useState(false);

  // === ТЕМА ===
  const [isDark, setIsDark] = useState(() => localStorage.getItem('adminTheme') !== 'light');

  useEffect(() => {
    localStorage.setItem('adminTheme', isDark ? 'dark' : 'light');
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  // === ЗАГРУЗКА ДАННЫХ ===
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

      const aiRes = await fetch('/api/admin/settings/ai', { headers: { 'Authorization': `Bearer ${token}` } });
      const aiData = await aiRes.json();
      if (aiData?.success) setAiPrompt(aiData.aiPrompt);

    } catch (e) { console.error('Ошибка:', e); }
    setLoading(false);
  };

  useEffect(() => { fetchDashboardData(); }, []);

  // === ОБРАБОТЧИКИ (PRO, ПАВИЛЬОН, ИИ) ===
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
      } else alert(result.error);
    } catch (e) { alert('Ошибка выдачи'); }
    setIsSubmittingPro(false);
  };

  const revokePro = async (userId) => {
    if (!window.confirm('Точно забрать PRO?')) return;
    const token = localStorage.getItem('adminToken');
    try {
      await fetch(`/api/admin/users/${userId}/grant-pro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ months: 0, amount: 0 })
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
              alert('Павильон успешно изменен!');
          }
      } catch (e) { alert('Ошибка сохранения'); }
      setIsSavingPavilion(false);
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

  // МАССИВ МЕНЮ ДЛЯ 9 РАЗДЕЛОВ
  const menuItems = [
    { id: 'finances', label: '1. Финансы', icon: TrendingUp },
    { id: 'users-stats', label: '2. Статистика юзеров', icon: BarChart3 },
    { id: 'users-db', label: '3. База пользователей', icon: Users },
    { id: 'plans', label: '4. Тарифы / Подписки', icon: Package },
    { id: 'prompts', label: '5. Промпты ИИ', icon: Settings },
    { id: 'maintenance', label: '6. Тех. работы', icon: Wrench },
    { id: 'backend-db', label: '7. Backend / База данных', icon: Database },
    { id: 'errors', label: '8. Ошибки и Логи', icon: AlertTriangle },
    { id: 'partner-api', label: '9. API для партнеров', icon: Network },
  ];

  if (loading) return <div className={`min-h-[100dvh] ${theme.bg} flex justify-center items-center`}><Loader2 className="animate-spin text-blue-500" size={40}/></div>;

  return (
    <div translate="no" className={`min-h-[100dvh] ${theme.bg} ${theme.text} font-sans flex flex-col md:flex-row transition-colors`}>
      
      {/* === БОКОВОЕ МЕНЮ === */}
      <aside className={`w-full md:w-72 ${theme.card} border-r shrink-0 flex flex-col md:min-h-screen sticky top-0 z-40`}>
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-red-500" size={28} />
            <div>
              <h1 className="text-xl font-black uppercase tracking-widest leading-none">System Core</h1>
              <p className={`text-[10px] uppercase font-bold text-green-500 mt-1`}><Activity size={10} className="inline mr-1"/> Secure</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                  isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : `text-gray-400 hover:bg-gray-800/50 hover:text-white`
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-gray-500'} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-800 flex gap-2">
           <button onClick={() => setIsDark(!isDark)} className={`flex-1 p-3 rounded-xl flex items-center justify-center bg-gray-800 text-yellow-400`}><Sun size={18} /></button>
           <button onClick={() => { localStorage.removeItem('adminToken'); navigate('/boss-login'); }} className={`flex-[3] p-3 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500 font-bold text-sm`}><LogOut size={16} className="mr-2"/> Выход</button>
        </div>
      </aside>

      {/* === ОСНОВНОЙ КОНТЕНТ === */}
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">

          {/* === 1. ФИНАНСЫ === */}
          {activeTab === 'finances' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-green-900 to-green-950 border border-green-500/30 rounded-2xl p-8">
                  <h3 className="text-green-400 text-sm font-bold uppercase mb-2">Выручка за сегодня</h3>
                  <p className="text-5xl font-black text-white">{data?.stats?.revenue?.today || 0} ₽</p>
                </div>
                <div className="bg-gradient-to-br from-blue-900 to-blue-950 border border-blue-500/30 rounded-2xl p-8">
                  <h3 className="text-blue-400 text-sm font-bold uppercase mb-2">Выручка в этом месяце</h3>
                  <p className="text-5xl font-black text-white">{data?.stats?.revenue?.month || 0} ₽</p>
                </div>
                <div className={`${theme.card} border rounded-2xl p-8`}>
                  <h3 className={`${theme.muted} text-sm font-bold uppercase mb-2`}>Всего заработано</h3>
                  <p className="text-5xl font-black">{data?.stats?.revenue?.total || 0} ₽</p>
                </div>
              </div>

              <div className={`${theme.card} border rounded-2xl p-6`}>
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><TrendingUp className="text-blue-500"/> Динамика выручки (6 мес)</h2>
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
                    <div className="h-full flex items-center justify-center text-gray-500">Пока нет оплат для отображения графика</div>
                  )}
                </div>
              </div>

              <div className={`${theme.card} border rounded-2xl p-6`}>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><CreditCard className="text-green-500"/> Последние оплаты</h2>
                <table className="w-full text-sm text-left">
                  <thead className={`${theme.tableHeader} uppercase text-xs font-bold ${theme.muted}`}>
                    <tr>
                      <th className="px-6 py-4">Сумма</th>
                      <th className="px-6 py-4">Клиент</th>
                      <th className="px-6 py-4">Назначение</th>
                      <th className="px-6 py-4 text-right">Дата</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme.border}`}>
                    {data?.recentTransactions?.map(t => (
                      <tr key={t.id} className={theme.rowHover}>
                        <td className="px-6 py-4 font-black text-green-500">+{t.amount} ₽</td>
                        <td className="px-6 py-4 font-bold">{t.user?.email || t.user?.name}</td>
                        <td className="px-6 py-4"><span className="bg-gray-800 text-white px-2 py-1 rounded text-xs font-bold">Оплата PRO</span></td>
                        <td className="px-6 py-4 text-right text-xs text-gray-400">{new Date(t.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* === 2. ПОЛЬЗОВАТЕЛИ: ОБЩАЯ СТАТИСТИКА === */}
          {activeTab === 'users-stats' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold mb-4">Статистика активности пользователей</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`${theme.card} border rounded-2xl p-6`}>
                  <h3 className={`${theme.muted} text-xs uppercase font-bold mb-2`}>Онлайн сейчас</h3>
                  <p className="text-4xl font-black text-green-500 animate-pulse">24</p>
                  <p className="text-xs text-gray-500 mt-2">WebSocket соединения</p>
                </div>
                <div className={`${theme.card} border rounded-2xl p-6`}>
                  <h3 className={`${theme.muted} text-xs uppercase font-bold mb-2`}>Пиковая нагрузка (сутки)</h3>
                  <p className="text-4xl font-black text-blue-500">142</p>
                  <p className="text-xs text-gray-500 mt-2">Одновременных сессий</p>
                </div>
                <div className={`${theme.card} border rounded-2xl p-6`}>
                  <h3 className={`${theme.muted} text-xs uppercase font-bold mb-2`}>Сгенерировано постов за 24ч</h3>
                  <p className="text-4xl font-black text-purple-500">890</p>
                </div>
              </div>
              <div className={`${theme.card} border rounded-2xl p-10 text-center`}>
                 <Activity className="mx-auto text-gray-600 mb-4" size={48} />
                 <h3 className="text-lg font-bold text-gray-400">График активности в разработке</h3>
                 <p className="text-sm text-gray-500">Здесь будет тепловая карта активности юзеров по часам.</p>
              </div>
            </div>
          )}

          {/* === 3. БАЗА ПОЛЬЗОВАТЕЛЕЙ === */}
          {activeTab === 'users-db' && (
            <div className={`${theme.card} border rounded-2xl p-6`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-xl font-bold">Управление клиентами ({data?.stats?.totalUsers})</h2>
                <div className="relative">
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
                      <th className="px-6 py-4">Статус PRO</th>
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
                          {u.isPro ? <div className="text-yellow-500 font-bold">Активен<br/><span className="text-[10px] text-gray-500">до {u.proExpiresAt ? new Date(u.proExpiresAt).toLocaleDateString() : '∞'}</span></div> : <span className="text-gray-500">Нет</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openUserDetails(u.id)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg mr-2 transition-colors"><Eye size={16}/></button>
                          {u.isPro ? (
                            <button onClick={() => revokePro(u.id)} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-bold transition-colors">Забрать PRO</button>
                          ) : (
                            <button onClick={() => setProModal({ isOpen: true, user: u })} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors">Выдать PRO</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* === 4. ТАРИФЫ / ПОДПИСКИ === */}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Управление тарифами</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Карточка тарифа (заглушка) */}
                <div className={`${theme.card} border rounded-2xl p-6 relative`}>
                   <h3 className="text-xl font-bold text-white mb-2">PRO Месяц</h3>
                   <p className="text-3xl font-black text-blue-500 mb-4">1990 ₽</p>
                   <ul className="text-sm text-gray-400 space-y-2 mb-6">
                     <li>• Неограниченно постов</li>
                     <li>• Приоритет нейросети</li>
                     <li>• Поддержка 24/7</li>
                   </ul>
                   <button className="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold text-sm transition-colors">Редактировать</button>
                </div>
                 <div className={`${theme.card} border border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-gray-500 transition-colors cursor-pointer`}>
                   <Package size={32} className="mb-2"/>
                   <span className="font-bold">Создать новый тариф</span>
                </div>
              </div>
            </div>
          )}

          {/* === 5. ПРОМПТЫ === */}
          {activeTab === 'prompts' && (
            <div className={`${theme.card} border rounded-2xl p-6 max-w-4xl`}>
               <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Settings className="text-purple-500"/> Системный Промпт ИИ</h2>
               <p className={`text-sm ${theme.muted} mb-6`}>Текст ниже диктует нейросети Gemini правила поведения для генерации постов. Применяется ко всем пользователям системы.</p>
               <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} className={`w-full h-[400px] p-4 rounded-xl border ${theme.border} ${theme.inputBg} resize-none font-mono text-sm leading-relaxed outline-none focus:border-purple-500 transition-colors`} placeholder="Введи системный промпт..." />
               <button onClick={saveAiPrompt} disabled={isSavingAi} className="mt-4 bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold transition-colors">
                 {isSavingAi ? 'Сохранение...' : 'Сохранить промпт'}
               </button>
            </div>
          )}

          {/* === 6. ТЕХНИЧЕСКИЕ РАБОТЫ === */}
          {activeTab === 'maintenance' && (
            <div className={`${theme.card} border border-orange-500/30 rounded-2xl p-8 max-w-3xl`}>
               <div className="flex items-center gap-4 mb-6">
                 <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-500"><Wrench size={32}/></div>
                 <div>
                   <h2 className="text-2xl font-bold text-white">Режим обслуживания</h2>
                   <p className="text-sm text-gray-400">Блокирует доступ к сайту для всех пользователей, кроме администраторов.</p>
                 </div>
               </div>
               
               <div className="space-y-4">
                 <div>
                   <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Текст уведомления для пользователей</label>
                   <textarea className={`w-full h-24 p-3 rounded-xl border ${theme.border} ${theme.inputBg} resize-none`} defaultValue="На сервере проводятся технические работы. Мы вернемся через 15 минут!" />
                 </div>
                 <div className="flex items-center justify-between p-4 bg-black/50 border border-gray-800 rounded-xl mt-6">
                   <span className="font-bold text-white">Включить Maintenance Mode</span>
                   <button className="w-14 h-8 bg-gray-700 rounded-full relative transition-colors focus:outline-none">
                      <span className="absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform"></span>
                   </button>
                 </div>
               </div>
            </div>
          )}

          {/* === 7. BACKEND / БАЗА ДАННЫХ === */}
          {activeTab === 'backend-db' && (
            <div className={`${theme.card} border rounded-2xl p-10 text-center`}>
               <Database className="mx-auto text-blue-500 mb-4" size={48} />
               <h3 className="text-xl font-bold text-white mb-2">Прямой доступ к таблицам</h3>
               <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">Здесь будет интерфейс (Data Grid) для прямого редактирования, удаления и просмотра всех записей БД без написания SQL-запросов.</p>
               <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors">Подключить интерфейс БД</button>
            </div>
          )}

          {/* === 8. ОШИБКИ И ЛОГИ === */}
          {activeTab === 'errors' && (
            <div className={`${theme.card} border border-red-500/20 rounded-2xl p-6`}>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><AlertTriangle className="text-red-500"/> Системные Логи (Backend & Frontend)</h2>
              <div className="bg-black border border-gray-800 rounded-xl p-4 font-mono text-xs space-y-2 h-[500px] overflow-y-auto">
                <div className="text-gray-500">[2026-04-16 12:00:01] INFO: Server started on port 5000</div>
                <div className="text-red-400">[2026-04-16 12:05:22] ERROR: PrismaClientKnownRequestError: Record to update not found. (User ID: 123)</div>
                <div className="text-yellow-400">[2026-04-16 12:10:45] WARN: High latency on Gemini API endpoint (2500ms)</div>
                <div className="text-gray-500 mt-10 text-center">--- Логи будут подтягиваться из Docker контейнеров или таблицы SystemLog ---</div>
              </div>
            </div>
          )}

          {/* === 9. API ДЛЯ ПАРТНЕРОВ === */}
          {activeTab === 'partner-api' && (
            <div className={`${theme.card} border rounded-2xl p-6 max-w-3xl`}>
               <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><Network className="text-emerald-500"/> API для партнеров (Интеграторы)</h2>
               <p className="text-sm text-gray-400 mb-8">Настройка реферальной системы и выдача токенов для сторонних сервисов.</p>
               
               <div className="space-y-6">
                 <div>
                   <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Базовый % отчислений партнеру</label>
                   <input type="number" defaultValue="30" className={`w-32 p-3 rounded-xl border ${theme.border} ${theme.inputBg}`} />
                 </div>
                 
                 <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                   <h4 className="font-bold text-white mb-2">Активные API Ключи</h4>
                   <div className="flex justify-between items-center py-2 border-b border-gray-800">
                     <span className="text-sm font-mono text-emerald-400">sk_live_1982739812739812...</span>
                     <span className="text-xs text-gray-500">Создан: 12.04.2026</span>
                   </div>
                   <button className="mt-4 text-sm text-blue-500 font-bold hover:text-blue-400">+ Сгенерировать новый ключ</button>
                 </div>
               </div>
            </div>
          )}

        </div>
      </main>

      {/* === МОДАЛКА: ДОСЬЕ ЮЗЕРА (ДЛЯ РАЗДЕЛА 3) === */}
      {isModalOpen && userDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`${theme.card} w-full max-w-2xl border rounded-3xl p-6 shadow-2xl relative`}>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-5 right-5 p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"><X size={20} /></button>
            <h2 className="text-2xl font-black mb-6">Досье клиента</h2>
            <div className="space-y-2 text-sm mb-6">
              <p><span className="text-gray-500">ID:</span> <span className="font-mono text-blue-400">{userDetails.user.id}</span></p>
              <p><span className="text-gray-500">Email:</span> {userDetails.user.email}</p>
              <p><span className="text-gray-500">Подключенных групп:</span> {userDetails.user.accounts?.length}</p>
              <p><span className="text-gray-500">Сгенерировано постов:</span> {userDetails.postsCount}</p>
              {userDetails.user.isPro && (
                <p><span className="text-gray-500">PRO до:</span> <span className="text-yellow-500 font-bold">{userDetails.user.proExpiresAt ? new Date(userDetails.user.proExpiresAt).toLocaleString() : 'Бессрочно'}</span></p>
              )}
            </div>

            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
               <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Рабочий павильон (внутренний коммент)</label>
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={editPavilion} 
                   onChange={(e) => setEditPavilion(e.target.value)}
                   className="flex-1 p-2.5 rounded-lg border border-gray-700 bg-black text-white outline-none focus:border-blue-500"
                   placeholder="Например: 2Г-44..."
                 />
                 <button onClick={savePavilion} disabled={isSavingPavilion} className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg font-bold transition-colors">
                   {isSavingPavilion ? <Loader2 className="animate-spin" size={18}/> : 'Сохранить'}
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* === МОДАЛКА: ВЫДАЧА PRO (ДЛЯ РАЗДЕЛА 3) === */}
      {proModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`${theme.card} w-full max-w-sm border rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95`}>
            <button onClick={() => setProModal({ isOpen: false, user: null })} className="absolute top-5 right-5 p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"><X size={20}/></button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Crown className="text-yellow-500"/> Выдача PRO</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Кол-во месяцев</label>
                <input 
                  type="number" 
                  min="1"
                  value={proMonths} 
                  onChange={e => setProMonths(e.target.value)} 
                  className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg} focus:border-blue-500 outline-none transition-colors`} 
                  placeholder="Например: 1 или 12"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Оплачено (Рублей)</label>
                <input type="number" value={proAmount} onChange={e => setProAmount(e.target.value)} className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg} focus:border-blue-500 outline-none transition-colors`} placeholder="2000" />
              </div>
            </div>
            <button onClick={submitProGrant} disabled={isSubmittingPro} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center">
              {isSubmittingPro ? <Loader2 className="animate-spin" size={20} /> : 'Выдать подписку'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}