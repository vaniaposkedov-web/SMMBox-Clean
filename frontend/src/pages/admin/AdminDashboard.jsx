import { useEffect, useState } from 'react';
import { 
  Users, Crown, MessageSquare, LogOut, Sun, Search, ShieldAlert, 
  Activity, Eye, X, Loader2, Settings, TrendingUp, CreditCard,
  BarChart3, Database, Wrench, AlertTriangle, Network, Package, Plus, Save, User as UserIcon,
  Sparkles, ChevronDown, Download
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
  
  const [activeTab, setActiveTab] = useState('users-db'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [planUserSearch, setPlanUserSearch] = useState('');
  
  // === СОСТОЯНИЕ ДОСЬЕ ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [dossierTab, setDossierTab] = useState('main'); // Вкладки внутри досье
  const [editPavilion, setEditPavilion] = useState('');
  const [isSavingPavilion, setIsSavingPavilion] = useState(false);

const [proModal, setProModal] = useState({ isOpen: false, user: null });
  const [selectedPlanType, setSelectedPlanType] = useState('Базовый');
  const [proMonths, setProMonths] = useState(1);
  const [proDays, setProDays] = useState(0);
  const [proCustomAmount, setProCustomAmount] = useState('');
  const [isSubmittingPro, setIsSubmittingPro] = useState(false);

  const [aiPrompt, setAiPrompt] = useState('');
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [promptHistory, setPromptHistory] = useState(() => JSON.parse(localStorage.getItem('adminPromptHistory') || '[]'));

  const [aiLogs, setAiLogs] = useState([]);
  const [aiLogsPage, setAiLogsPage] = useState(1);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [aiLogSearch, setAiLogSearch] = useState('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const loadAiLogs = async (pageNum = 1, search = aiLogSearch, append = false) => {
    setIsLoadingLogs(true);
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`/api/admin/settings/ai/logs?page=${pageNum}&search=${search}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result?.success) {
        if (append) setAiLogs(prev => [...prev, ...result.logs]);
        else setAiLogs(result.logs);
        
        setHasMoreLogs(result.hasMore);
        setAiLogsPage(pageNum);
      }
    } catch (e) {}
    setIsLoadingLogs(false);
  };

  const handleLogSearch = () => loadAiLogs(1, aiLogSearch, false);

  // Автозагрузка логов при переходе на вкладку
  useEffect(() => {
    if (activeTab === 'prompts') loadAiLogs(1, '', false);
  }, [activeTab]);

  const [isDark, setIsDark] = useState(() => localStorage.getItem('adminTheme') !== 'light');

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

const submitProGrant = async (isRevoke = false) => {
    // ЗАЩИТА ОТ БАГА REACT: если isRevoke это объект события (клик), приравниваем к false
    const revokeFlag = typeof isRevoke === 'boolean' ? isRevoke : false;
    
    // Обязуем выбрать тариф, если его нет и это не удаление
    if (!revokeFlag && !selectedPlanType && !proModal.user?.isPro) {
      return alert('Пожалуйста, выберите тариф!');
    }

    setIsSubmittingPro(true);
    const token = localStorage.getItem('adminToken');
    
    const payload = revokeFlag 
      ? { planType: selectedPlanType, months: 0, days: 0, customAmount: null }
      : { planType: selectedPlanType || undefined, months: Number(proMonths), days: Number(proDays), customAmount: proCustomAmount ? Number(proCustomAmount) : null };

    try {
      const res = await fetch(`/api/admin/users/${proModal.user.id}/grant-pro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result?.success) {
        setProModal({ isOpen: false, user: null });
        setProMonths(1);
        setProDays(0);
        fetchDashboardData(); 
        if (isModalOpen && userDetails && userDetails.user.id === proModal.user.id) openUserDetails(proModal.user.id);
      } else alert(result.error);
    } catch (e) { alert('Ошибка выдачи'); }
    setIsSubmittingPro(false);
  };

  const revokePro = async (userId) => {
    if (!window.confirm('Точно забрать подписку?')) return;
    const token = localStorage.getItem('adminToken');
    try {
      await fetch(`/api/admin/users/${userId}/grant-pro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ months: 0 })
      });
      fetchDashboardData();
      if (isModalOpen && userDetails && userDetails.user.id === userId) openUserDetails(userId);
    } catch (e) {}
  };

  const exportPrompt = () => {
    const element = document.createElement("a");
    const file = new Blob([aiPrompt], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "ai_prompt.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const importPrompt = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setAiPrompt(event.target.result);
    reader.readAsText(file);
    e.target.value = null; // сброс инпута
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
      if (res.ok) {
        alert('Промпт ИИ сохранен!');
        // Обновляем историю: добавляем текущий, убираем дубли, оставляем последние 10
        setPromptHistory(prev => {
          const newHist = [aiPrompt, ...prev.filter(p => p !== aiPrompt)].slice(0, 10);
          localStorage.setItem('adminPromptHistory', JSON.stringify(newHist));
          return newHist;
        });
      }
    } catch (e) {}
    setIsSavingAi(false);
  };

  const openUserDetails = async (userId) => {
    setIsModalOpen(true);
    setLoadingDetails(true);
    setDossierTab('main');
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
            <div className="space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Живая статистика и нагрузка</h2>
                <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Данные в реальном времени
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`${theme.card} border rounded-2xl p-6 relative overflow-hidden`}>
                  <h3 className={`${theme.muted} text-xs uppercase font-bold mb-2`}>Примерный онлайн сейчас</h3>
                  <p className="text-4xl font-black text-green-500 animate-pulse">{data?.stats?.currentOnline || 0}</p>
                  <p className="text-xs text-gray-500 mt-2">Активных пользователей за последний час</p>
                  <Activity className="absolute right-[-10px] bottom-[-10px] text-green-500/10" size={80}/>
                </div>
                
                <div className={`${theme.card} border rounded-2xl p-6 relative overflow-hidden`}>
                  <h3 className={`${theme.muted} text-xs uppercase font-bold mb-2`}>Пиковая нагрузка (Сегодня)</h3>
                  <p className="text-4xl font-black text-blue-500">{data?.stats?.peakLoad || 0}</p>
                  <p className="text-xs text-gray-500 mt-2">Максимум пользователей одновременно</p>
                  <TrendingUp className="absolute right-[-10px] bottom-[-10px] text-blue-500/10" size={80}/>
                </div>
                
                <div className={`${theme.card} border rounded-2xl p-6 relative overflow-hidden`}>
                  <h3 className={`${theme.muted} text-xs uppercase font-bold mb-2`}>Сгенерировано постов (Сегодня)</h3>
                  <div className="flex items-end gap-3">
                    <p className="text-4xl font-black text-purple-500">{data?.stats?.postsToday || 0}</p>
                    <span className="text-sm font-bold text-gray-500 mb-1">/ {data?.stats?.totalPosts || 0} за всё время</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Нейросетью и вручную</p>
                  <MessageSquare className="absolute right-[-10px] bottom-[-10px] text-purple-500/10" size={80}/>
                </div>
              </div>

              <div className={`${theme.card} border rounded-2xl p-6`}>
                 <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><Activity className="text-blue-500"/> График активности (Сутки)</h2>
                 <div className="h-72 w-full">
                    {data?.stats?.activityChart && data.stats.activityChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.stats.activityChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#E5E7EB"} vertical={false} />
                          <XAxis dataKey="time" stroke="#9CA3AF" axisLine={false} tickLine={false} />
                          <YAxis stroke="#9CA3AF" axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: isDark ? '#111318' : '#fff', borderColor: isDark ? '#1F2937' : '#E5E7EB', borderRadius: '12px' }} 
                            itemStyle={{ fontWeight: 'bold' }}
                          />
                          <Line type="monotone" dataKey="users" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} name="Пользователи (оценка)" />
                          <Line type="monotone" dataKey="posts" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4 }} name="Создано постов" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-500 font-mono text-sm flex-col gap-2">
                        <Activity size={32} className="opacity-20"/>
                        СЕГОДНЯ АКТИВНОСТИ ПОКА НЕТ
                      </div>
                    )}
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
                          <button onClick={() => setProModal({ isOpen: true, user: u })} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors">Выдать PRO</button>
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
              {/* Карточки тарифов */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map(plan => (
                  <div key={plan.id} className={`${theme.card} border rounded-2xl p-6 relative overflow-hidden`}>
                    <Package className={`absolute right-[-20px] bottom-[-20px] ${isDark ? 'text-gray-800' : 'text-gray-100'}`} size={120} />
                    <h3 className="text-xl font-black mb-2 relative z-10">{plan.name}</h3>
                    <p className="text-3xl font-bold text-blue-500 relative z-10 mb-4">{plan.price} ₽ <span className="text-sm text-gray-500 font-normal">/ мес</span></p>
                    <ul className="space-y-2 text-sm text-gray-400 relative z-10">
                      <li className="flex items-center gap-2">• Аккаунтов: {plan.maxAccounts}</li>
                      <li className="flex items-center gap-2">• Постов в день: {plan.maxPostsPerDay}</li>
                    </ul>
                  </div>
                ))}
              </div>

              {/* Управление подписками */}
              <div className={`${theme.card} border rounded-2xl p-6`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2"><Crown className="text-yellow-500"/> Управление подписками</h2>
                    <p className="text-sm text-gray-500 mt-1">Продление и выдача тарифов клиентам</p>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input type="text" value={planUserSearch} onChange={(e) => setPlanUserSearch(e.target.value)} placeholder="Поиск (Email, ID)..." className={`w-full pl-10 pr-4 py-2 ${theme.inputBg} border rounded-xl outline-none focus:border-blue-500 text-sm`} />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className={`${theme.tableHeader} uppercase text-xs font-bold ${theme.muted}`}>
                      <tr>
                        <th className="px-6 py-4">Клиент</th>
                        <th className="px-6 py-4">Текущий тариф</th>
                        <th className="px-6 py-4 text-right">Действие</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${theme.border}`}>
                      {(planUserSearch ? planSearchFilteredUsers : allUsers).slice(0, 50).map(u => (
                        <tr key={u.id} className={theme.rowHover}>
                          <td className="px-6 py-4">
                            <div className="font-bold">{u.email || u.name}</div>
                            <div className="font-mono text-xs text-gray-500">{u.id}</div>
                          </td>
                          <td className="px-6 py-4">
                            {u.isPro ? (
                              <div className="flex flex-col">
                                <span className="text-yellow-500 font-bold bg-yellow-500/10 px-2 py-1 rounded w-max text-xs">{u.proPlanType || 'PRO'}</span>
                                <span className="text-xs text-gray-500 mt-1">До {new Date(u.proExpiresAt).toLocaleDateString()} ({Math.ceil((new Date(u.proExpiresAt) - new Date()) / (1000 * 60 * 60 * 24))} дн.)</span>
                              </div>
                            ) : (
                              <span className="text-gray-500 font-bold bg-gray-800 px-2 py-1 rounded w-max text-xs">FREE</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => setProModal({ isOpen: true, user: u })} className="px-4 py-2 bg-blue-600/20 text-blue-500 hover:bg-blue-600/40 font-bold rounded-lg text-xs transition-colors">Выдать / Продлить</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className={`${theme.card} border rounded-2xl p-6`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2"><Settings className="text-blue-500"/> Настройка Промпта ИИ</h2>
                  <p className="text-sm text-gray-500 mt-1">Основная инструкция для нейросети при улучшении текста</p>
                </div>
                <div className="flex gap-2">
                  <input type="file" accept=".txt" id="import-prompt" className="hidden" onChange={importPrompt} />
                  <button onClick={() => document.getElementById('import-prompt').click()} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-colors">
                    Загрузить .txt
                  </button>
                  <button onClick={exportPrompt} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-colors">
                    Скачать .txt
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className={`w-full h-64 p-4 rounded-xl border ${theme.border} ${theme.inputBg} focus:border-blue-500 outline-none transition-colors resize-none leading-relaxed`}
                    placeholder="Введите системный промпт для ИИ..."
                  />
                  <button
                    onClick={saveAiPrompt}
                    disabled={isSavingAi}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center gap-2"
                  >
                    {isSavingAi ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Сохранить промпт
                  </button>
                </div>

                {/* ⚡ ОБНОВЛЕННАЯ ИСТОРИЯ ПРОМПТОВ */}
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider">История промптов</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {promptHistory.map((histPrompt, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setAiPrompt(histPrompt)} 
                        className={`p-2.5 rounded-xl border cursor-pointer transition-colors text-sm flex items-center justify-between gap-2 ${aiPrompt === histPrompt ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-sm' : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:bg-gray-800'}`}
                      >
                        <div className="flex-1 min-w-0">
                           <p className="text-[10px] font-bold mb-0.5 text-gray-500 uppercase">Версия {promptHistory.length - idx}</p>
                           <p className="truncate text-xs">{histPrompt}</p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const element = document.createElement("a");
                            const file = new Blob([histPrompt], {type: 'text/plain'});
                            element.href = URL.createObjectURL(file);
                            element.download = `ai_prompt_v${promptHistory.length - idx}.txt`;
                            document.body.appendChild(element);
                            element.click();
                            document.body.removeChild(element);
                          }}
                          className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors shrink-0"
                          title="Скачать .txt"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    ))}
                    {promptHistory.length === 0 && (
                      <p className="text-sm text-gray-500 italic p-4 bg-gray-900/30 rounded-xl border border-gray-800 border-dashed text-center">История пуста.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ⚡ ОБНОВЛЕННЫЕ КОМПАКТНЫЕ ЛОГИ ИИ */}
              <div className="mt-8 pt-6 border-t border-gray-800">
                <div className="flex flex-col sm:flex-row justify-end mb-4 gap-4">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input 
                      type="text" 
                      value={aiLogSearch} 
                      onChange={(e) => setAiLogSearch(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && handleLogSearch()}
                      placeholder="Поиск по ID клиента..." 
                      className={`w-full sm:w-64 p-2.5 rounded-xl border ${theme.border} ${theme.inputBg} focus:border-purple-500 outline-none text-sm transition-colors`} 
                    />
                    <button onClick={handleLogSearch} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-purple-500/20 active:scale-95">
                      Найти
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {aiLogs.map(log => {
                    const isExpanded = expandedLogId === log.id;
                    return (
                      <div key={log.id} className="bg-gray-900/40 border border-gray-800 rounded-xl p-3 sm:p-4 flex flex-col transition-all hover:bg-gray-900/60 shadow-sm">
                         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex flex-wrap gap-2 items-center">
                              <span className="bg-blue-600/20 border border-blue-500/30 text-blue-400 font-mono text-[10px] sm:text-xs px-2 py-1 rounded-md font-bold">ID: {log.userId}</span>
                              <span className="text-xs sm:text-sm font-bold text-gray-300">{log.user?.email || 'Удален'}</span>
                              <span className="text-[10px] text-gray-500 font-medium bg-gray-800 px-2 py-1 rounded-md">
                                {new Date(log.createdAt).toLocaleString('ru-RU')}
                              </span>
                            </div>

                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className={`text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${isExpanded ? 'bg-gray-800 text-gray-400' : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'}`}
                            >
                              {isExpanded ? 'Скрыть детали' : 'Показать логи'}
                              <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                         </div>
                         
                         {isExpanded && (
                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 mt-3 border-t border-gray-800/50 animate-in fade-in slide-in-from-top-2">
                              <div className="space-y-2 flex flex-col">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Settings size={12}/> Запрос к ИИ (С промптом)</span>
                                <div className="bg-black/60 border border-gray-800 p-3.5 rounded-xl text-xs sm:text-sm text-gray-300 h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap font-mono flex-1 leading-relaxed">
                                  {log.prompt}
                                </div>
                              </div>
                              <div className="space-y-2 flex flex-col">
                                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5"><Sparkles size={12}/> Итоговый ответ</span>
                                <div className="bg-purple-500/5 border border-purple-500/20 p-3.5 rounded-xl text-xs sm:text-sm text-gray-200 h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap flex-1 shadow-inner leading-relaxed">
                                  {log.result}
                                </div>
                              </div>
                           </div>
                         )}
                      </div>
                    );
                  })}
                  
                  {aiLogs.length === 0 && !isLoadingLogs && (
                    <div className="text-center py-8 text-gray-500 bg-gray-900/20 rounded-2xl border border-gray-800 border-dashed">
                      <Search size={32} className="mx-auto mb-3 opacity-20" />
                      <p className="font-medium text-sm">Записей не найдено</p>
                    </div>
                  )}

                  {hasMoreLogs && (
                    <button 
                      onClick={() => loadAiLogs(aiLogsPage + 1, aiLogSearch, true)} 
                      disabled={isLoadingLogs}
                      className="w-full mt-2 py-3.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-all flex justify-center items-center gap-2 active:scale-95 text-sm"
                    >
                      {isLoadingLogs ? <Loader2 size={16} className="animate-spin" /> : <ChevronDown size={16} />}
                      Загрузить еще
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          
          
          {activeTab === 'maintenance' && (<div className={`${theme.card} border border-orange-500/30 rounded-2xl p-8 max-w-3xl`}><h2>Технические работы (UI Готов)</h2></div>)}
          {activeTab === 'backend-db' && (<div className={`${theme.card} border rounded-2xl p-10 text-center`}><h2>Прямой доступ к БД (UI Готов)</h2></div>)}
          {activeTab === 'errors' && (<div className={`${theme.card} border border-red-500/20 rounded-2xl p-6`}><h2>Логи и ошибки (UI Готов)</h2></div>)}
          {activeTab === 'partner-api' && (<div className={`${theme.card} border rounded-2xl p-6 max-w-3xl`}><h2>API для партнеров (UI Готов)</h2></div>)}
        </div>
      </main>

      {/* === НОВОЕ УМНОЕ ДОСЬЕ КЛИЕНТА С ВКЛАДКАМИ === */}
      {isModalOpen && userDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`${theme.card} w-full max-w-4xl border rounded-3xl shadow-2xl relative flex flex-col max-h-[90vh]`}>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-5 right-5 p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors z-10"><X size={20} /></button>

            {/* Шапка досье и навигация */}
            <div className="p-6 border-b border-gray-800 shrink-0">
              <h2 className="text-2xl font-black flex items-center gap-3">
                <UserIcon className="text-blue-500" /> Досье клиента
              </h2>
              <p className="text-sm text-gray-500 mt-1">{userDetails.user.email || 'Без Email'} <span className="font-mono bg-gray-900 px-2 py-0.5 rounded ml-2">{userDetails.user.id}</span></p>

              <div className="flex gap-2 mt-6 overflow-x-auto hide-scrollbar pb-2">
                 <button onClick={()=>setDossierTab('main')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors shrink-0 ${dossierTab==='main' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Сводка</button>
                 <button onClick={()=>setDossierTab('accounts')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors shrink-0 ${dossierTab==='accounts' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Соцсети ({userDetails.user.accounts?.length || 0})</button>
                 <button onClick={()=>setDossierTab('posts')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors shrink-0 ${dossierTab==='posts' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Посты ({userDetails.postsCount})</button>
                 <button onClick={()=>setDossierTab('finances')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors shrink-0 ${dossierTab==='finances' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Оплаты ({userDetails.user.transactions?.length || 0})</button>
              </div>
            </div>

            {/* Контент досье (Скроллится) */}
            <div className="p-6 overflow-y-auto flex-1">
              
              {/* Вкладка: Сводка */}
              {dossierTab === 'main' && (
                <div className="animate-in fade-in space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 text-sm bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                      <p><span className="text-gray-500 block text-xs uppercase mb-1">Регистрация</span> {new Date(userDetails.user.createdAt).toLocaleString()}</p>
                      <p><span className="text-gray-500 block text-xs uppercase mb-1 mt-3">Телефон</span> <span className="font-bold">{userDetails.user.phone || 'Не указан'}</span></p>
                      <p><span className="text-gray-500 block text-xs uppercase mb-1 mt-3">Имя</span> <span className="font-bold">{userDetails.user.name || 'Не указано'}</span></p>
                    </div>
                    <div className="space-y-2 text-sm bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                      <p><span className="text-gray-500 block text-xs uppercase mb-1">Тариф</span> {userDetails.user.isPro ? <span className="text-yellow-500 font-bold bg-yellow-500/10 px-2 py-0.5 rounded">{userDetails.user.proPlanType || 'PRO'} до {new Date(userDetails.user.proExpiresAt).toLocaleDateString()}</span> : <span className="text-gray-400 font-bold bg-gray-800 px-2 py-0.5 rounded">FREE</span>}</p>
                      <button onClick={() => setProModal({ isOpen: true, user: userDetails.user })} className="mt-4 w-full py-2 bg-blue-600/20 text-blue-500 hover:bg-blue-600/30 font-bold rounded-lg transition-colors">Управление подпиской</button>
                    </div>
                  </div>

                  <div className="p-5 bg-gray-900 border border-gray-800 rounded-xl">
                    <label className="text-xs font-bold text-gray-500 mb-3 block uppercase">Доп. Инфо / Рабочий павильон</label>
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
              )}

              {/* Вкладка: Соцсети */}
              {dossierTab === 'accounts' && (
                <div className="animate-in fade-in">
                  <table className="w-full text-sm text-left">
                    <thead className={`${theme.tableHeader} uppercase text-xs font-bold ${theme.muted}`}>
                      <tr><th className="px-4 py-3">Платформа</th><th className="px-4 py-3">Название</th><th className="px-4 py-3">Статус</th><th className="px-4 py-3">Дата добавления</th></tr>
                    </thead>
                    <tbody className={`divide-y ${theme.border}`}>
                      {userDetails.user.accounts?.map(acc => (
                        <tr key={acc.id} className={theme.rowHover}>
                          <td className="px-4 py-3 font-bold capitalize">{acc.provider}</td>
                          <td className="px-4 py-3">{acc.name}</td>
                          <td className="px-4 py-3">{acc.isValid ? <span className="text-green-500">Активен</span> : <span className="text-red-500">Токен истек</span>}</td>
                          <td className="px-4 py-3 text-gray-500">{new Date(acc.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {!userDetails.user.accounts?.length && <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-500">Нет подключенных аккаунтов</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Вкладка: Посты */}
              {dossierTab === 'posts' && (
                <div className="animate-in fade-in">
                  <p className="text-xs text-gray-500 mb-4 uppercase font-bold">Последние 10 сгенерированных постов</p>
                  <div className="space-y-3">
                    {userDetails.recentPosts?.map(post => (
                      <div key={post.id} className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-blue-400">{post.account.provider} / {post.account.name}</span>
                          <span className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-gray-300 line-clamp-2">{post.text || 'Без текста (только медиа)'}</p>
                        <div className="mt-2 text-xs font-mono text-gray-500">Статус: {post.status}</div>
                      </div>
                    ))}
                    {!userDetails.recentPosts?.length && <div className="text-center text-gray-500 py-8">История постов пуста</div>}
                  </div>
                </div>
              )}

              {/* Вкладка: Финансы */}
              {dossierTab === 'finances' && (
                <div className="animate-in fade-in">
                  <table className="w-full text-sm text-left">
                    <thead className={`${theme.tableHeader} uppercase text-xs font-bold ${theme.muted}`}>
                      <tr><th className="px-4 py-3">Сумма</th><th className="px-4 py-3">Тип</th><th className="px-4 py-3">Дата</th></tr>
                    </thead>
                    <tbody className={`divide-y ${theme.border}`}>
                      {userDetails.user.transactions?.map(tr => (
                        <tr key={tr.id} className={theme.rowHover}>
                          <td className="px-4 py-3 font-black text-green-500">+{tr.amount} ₽</td>
                          <td className="px-4 py-3 font-mono text-xs">{tr.type}</td>
                          <td className="px-4 py-3 text-gray-500">{new Date(tr.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                      {!userDetails.user.transactions?.length && <tr><td colSpan="3" className="px-4 py-8 text-center text-gray-500">Транзакций нет</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Вкладка: Партнеры */}
              {dossierTab === 'partners' && (
                <div className="animate-in fade-in grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase">Отправленные инвайты (Рефералы)</h3>
                    {userDetails.user.sentRequests?.map(req => (
                      <div key={req.id} className="p-3 bg-gray-900 border border-gray-800 rounded-lg mb-2 text-sm">
                        <span className="text-white">{req.receiver.email || req.receiver.id}</span>
                        <span className="text-xs text-gray-500 block mt-1">{req.receiver.isPro ? 'Платный юзер' : 'Free юзер'}</span>
                      </div>
                    ))}
                    {!userDetails.user.sentRequests?.length && <p className="text-xs text-gray-600">Нет приглашенных юзеров</p>}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase">Кто пригласил (Аплайн)</h3>
                    // КАК ДОЛЖНО БЫТЬ:
                        {userDetails.user.receivedRequests?.map(req => (
                          <div key={req.id} className="p-3 bg-gray-900 border border-gray-800 rounded-lg mb-2 text-sm">
                            <span className="text-white">{req.requester.email || req.requester.id}</span>
                          </div>
                        ))}
                    {!userDetails.user.receivedRequests?.length && <p className="text-xs text-gray-600">Зарегистрировался сам</p>}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* === МОДАЛКА: ВЫДАЧА ТАРИФА (Осталась без изменений) === */}
      {proModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`${theme.card} w-full max-w-sm border rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95`}>
            <button onClick={() => setProModal({ isOpen: false, user: null })} className="absolute top-5 right-5 p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"><X size={20}/></button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Crown className="text-yellow-500"/> Управление подпиской</h2>
            <p className="text-xs text-gray-500 mb-6 truncate">Клиент: {proModal.user.email || proModal.user.id}</p>
            
            <div className="space-y-4 mb-6">
              {proModal.user?.isPro && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-4">
                  <p className="text-xs text-yellow-500 font-bold uppercase mb-1">Текущая подписка активна</p>
                  <p className="text-sm text-gray-300">Тариф: {proModal.user.proPlanType}</p>
                  <p className="text-sm text-gray-300">Действует до: {new Date(proModal.user.proExpiresAt).toLocaleDateString()}</p>
                  <p className="text-xs text-gray-500 mt-2">Новое время будет прибавлено к текущей дате.</p>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Выберите Тариф</label>
                <select value={selectedPlanType} onChange={e => setSelectedPlanType(e.target.value)} className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg} focus:border-blue-500 outline-none transition-colors`}>
                  <option value="">-- Выберите тариф --</option>
                  <option value="Базовый">Базовый (1000₽)</option>
                  <option value="Расширенный">Расширенный (1800₽)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Месяцы (+/-)</label>
                  <input type="number" value={proMonths} onChange={e => setProMonths(e.target.value)} className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg} focus:border-blue-500 outline-none transition-colors`} placeholder="Можно с минусом" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Дни (+/-)</label>
                  <input type="number" value={proDays} onChange={e => setProDays(e.target.value)} className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg} focus:border-blue-500 outline-none transition-colors`} placeholder="Можно с минусом" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Сумма оплаты (Кастомная)</label>
                <input type="number" value={proCustomAmount} onChange={e => setProCustomAmount(e.target.value)} className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg} focus:border-blue-500 outline-none transition-colors`} placeholder="Оставьте пустым для авто-расчета" />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => submitProGrant(true)} 
                disabled={isSubmittingPro} 
                className="w-1/3 bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-500/20 font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center"
              >
                Забрать
              </button>
              <button 
                onClick={() => submitProGrant(false)} 
                disabled={isSubmittingPro} 
                className="w-2/3 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center"
              >
                {isSubmittingPro ? <Loader2 className="animate-spin" size={20} /> : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>



      )}
    </div>
  );
}