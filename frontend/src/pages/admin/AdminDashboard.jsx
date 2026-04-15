import { useEffect, useState } from 'react';
import { 
  Users, Crown, MessageSquare, Link as LinkIcon, LogOut, 
  RefreshCw, Sun, Moon, Search, ShieldAlert, CheckCircle2, 
  XCircle, Activity, Eye, X, User as UserIcon, Calendar, 
  Mail, Phone, LayoutDashboard, LayoutTemplate, Send, Key, Loader2, DollarSign, Settings, TrendingUp, CreditCard
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  const [data, setData] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('clients'); 
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

  const [isDark, setIsDark] = useState(() => localStorage.getItem('adminTheme') !== 'light');

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

      const aiRes = await fetch('/api/admin/settings/ai', { headers: { 'Authorization': `Bearer ${token}` } });
      const aiData = await aiRes.json();
      if (aiData?.success) setAiPrompt(aiData.aiPrompt);

    } catch (e) { console.error('Ошибка:', e); }
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

  if (loading) return <div className={`min-h-[100dvh] ${theme.bg} flex justify-center items-center`}><Loader2 className="animate-spin text-blue-500" size={40}/></div>;

  return (
    <div translate="no" className={`min-h-[100dvh] ${theme.bg} ${theme.text} font-sans transition-colors pb-10`}>
      
      <header className={`${theme.card} border-b sticky top-0 z-40 px-4 sm:px-6 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <ShieldAlert className="text-red-500" size={28} />
          <div>
            <h1 className="text-xl font-black uppercase tracking-widest leading-none">System Core</h1>
            <p className={`text-[10px] uppercase font-bold text-green-500 mt-1`}><Activity size={10} className="inline mr-1"/> Secure</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setIsDark(!isDark)} className="p-2 bg-gray-800 text-yellow-400 rounded-xl"><Sun size={18} /></button>
          <button onClick={() => { localStorage.removeItem('adminToken'); navigate('/boss-login'); }} className="px-4 py-2 bg-red-500/10 text-red-500 rounded-xl font-bold text-sm"><LogOut size={16} className="inline mr-2"/>Выход</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        
        {/* НАВИГАЦИЯ */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-8">
          <button onClick={() => setActiveTab('clients')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all shrink-0 ${activeTab === 'clients' ? 'bg-blue-600 text-white' : `${theme.card} border ${theme.border} ${theme.muted}`}`}>Мониторинг Клиентов</button>
          <button onClick={() => setActiveTab('finances')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all shrink-0 ${activeTab === 'finances' ? 'bg-green-600 text-white' : `${theme.card} border ${theme.border} ${theme.muted}`}`}>Финансы и Выручка</button>
          <button onClick={() => setActiveTab('database')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all shrink-0 ${activeTab === 'database' ? 'bg-blue-600 text-white' : `${theme.card} border ${theme.border} ${theme.muted}`}`}>База данных (Все)</button>
          <button onClick={() => setActiveTab('settings')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all shrink-0 ${activeTab === 'settings' ? 'bg-purple-600 text-white' : `${theme.card} border ${theme.border} ${theme.muted}`}`}>Промпт Нейросети</button>
        </div>

        {/* === ВКЛАДКА: МОНИТОРИНГ КЛИЕНТОВ === */}
        {activeTab === 'clients' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className={`${theme.card} border rounded-2xl p-6 relative overflow-hidden`}>
                <h3 className={`${theme.muted} text-xs uppercase font-bold mb-2`}><Users size={14} className="inline mr-2 text-blue-500"/>Всего юзеров</h3>
                <p className="text-4xl font-black">{data?.stats?.totalUsers}</p>
              </div>
              <div className={`${theme.card} border rounded-2xl p-6 relative overflow-hidden`}>
                <h3 className={`${theme.muted} text-xs uppercase font-bold mb-2`}><Crown size={14} className="inline mr-2 text-yellow-500"/>С подпиской PRO</h3>
                <p className="text-4xl font-black">{data?.stats?.proUsers}</p>
              </div>
              <div className={`${theme.card} border rounded-2xl p-6 relative overflow-hidden`}>
                <h3 className={`${theme.muted} text-xs uppercase font-bold mb-2`}><LinkIcon size={14} className="inline mr-2 text-emerald-500"/>Групп подключено</h3>
                <p className="text-4xl font-black">{data?.stats?.totalAccounts}</p>
              </div>
              <div className={`${theme.card} border rounded-2xl p-6 relative overflow-hidden`}>
                <h3 className={`${theme.muted} text-xs uppercase font-bold mb-2`}><MessageSquare size={14} className="inline mr-2 text-purple-500"/>Постов создано</h3>
                <p className="text-4xl font-black">{data?.stats?.totalPosts}</p>
              </div>
            </div>

            <div className={`${theme.card} border rounded-2xl p-6`}>
              <h2 className="text-lg font-bold mb-4">Новые регистрации</h2>
              <table className="w-full text-sm text-left">
                <thead className={`${theme.tableHeader} uppercase text-xs font-bold ${theme.muted}`}>
                  <tr>
                    <th className="px-6 py-4">Клиент</th>
                    <th className="px-6 py-4">Статус</th>
                    <th className="px-6 py-4">Дата</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme.border}`}>
                  {data?.recentUsers?.map(u => (
                    <tr key={u.id}>
                      <td className="px-6 py-4 font-bold">{u.email || u.name}</td>
                      <td className="px-6 py-4">{u.isPro ? <span className="text-yellow-500 font-bold">PRO</span> : <span className={theme.muted}>Free</span>}</td>
                      <td className="px-6 py-4">{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === ВКЛАДКА: ФИНАНСЫ === */}
        {activeTab === 'finances' && (
          <div className="space-y-6 animate-in fade-in">
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
                      <Tooltip
                        cursor={{ fill: isDark ? '#1F2937' : '#F3F4F6' }}
                        contentStyle={{ 
                          backgroundColor: isDark ? '#111318' : '#fff', 
                          borderColor: isDark ? '#1F2937' : '#E5E7EB', 
                          borderRadius: '12px' 
                        }}
                        formatter={(value) => [`${value} ₽`, 'Выручка']}
                      />
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
                  {(!data?.recentTransactions || data.recentTransactions.length === 0) && (
                    <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">Пока нет оплат</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === ВКЛАДКА: БАЗА ДАННЫХ === */}
        {activeTab === 'database' && (
          <div className={`${theme.card} border rounded-2xl p-6 animate-in fade-in`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Управление клиентами</h2>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Поиск..." className={`w-72 ${theme.inputBg} border rounded-xl py-2 px-4 outline-none focus:border-blue-500`} />
            </div>

            <table className="w-full text-sm text-left">
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
                      <div className="text-xs text-gray-500">{u.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      {u.isPro ? <div className="text-yellow-500 font-bold">Активен<br/><span className="text-[10px] text-gray-500">до {u.proExpiresAt ? new Date(u.proExpiresAt).toLocaleDateString() : '∞'}</span></div> : <span className="text-gray-500">Нет</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openUserDetails(u.id)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg mr-2"><Eye size={16}/></button>
                      {u.isPro ? (
                        <button onClick={() => revokePro(u.id)} className="px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-xs font-bold">Забрать PRO</button>
                      ) : (
                        <button onClick={() => setProModal({ isOpen: true, user: u })} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Выдать PRO</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* === ВКЛАДКА: НЕЙРОСЕТЬ === */}
        {activeTab === 'settings' && (
          <div className={`${theme.card} border rounded-2xl p-6 max-w-4xl animate-in fade-in`}>
             <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Settings className="text-purple-500"/> Системный Промпт ИИ</h2>
             <p className={`text-sm ${theme.muted} mb-6`}>Текст ниже диктует нейросети Gemini правила поведения для генерации постов.</p>
             <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} className={`w-full h-[400px] p-4 rounded-xl border ${theme.border} ${theme.inputBg} resize-none font-mono text-sm leading-relaxed`} placeholder="Введи промпт..." />
             <button onClick={saveAiPrompt} disabled={isSavingAi} className="mt-4 bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold transition-colors">
               {isSavingAi ? 'Сохранение...' : 'Сохранить промпт'}
             </button>
          </div>
        )}

      </div>

      {/* МОДАЛКА: ДОСЬЕ */}
      {isModalOpen && userDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`${theme.card} w-full max-w-2xl border rounded-3xl p-6 shadow-2xl relative`}>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-5 right-5 p-2 bg-gray-800 rounded-full"><X size={20} /></button>
            <h2 className="text-2xl font-black mb-6">Досье клиента</h2>
            <div className="space-y-2 text-sm mb-6">
              <p><span className="text-gray-500">ID:</span> {userDetails.user.id}</p>
              <p><span className="text-gray-500">Email:</span> {userDetails.user.email}</p>
              <p><span className="text-gray-500">Подключенных групп:</span> {userDetails.user.accounts?.length}</p>
              <p><span className="text-gray-500">Сгенерировано постов:</span> {userDetails.postsCount}</p>
            </div>

            {/* РЕДАКТИРОВАНИЕ ПАВИЛЬОНА */}
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
               <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Рабочий павильон</label>
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={editPavilion} 
                   onChange={(e) => setEditPavilion(e.target.value)}
                   className="flex-1 p-2.5 rounded-lg border border-gray-700 bg-black text-white outline-none"
                   placeholder="Укажите павильон..."
                 />
                 <button onClick={savePavilion} disabled={isSavingPavilion} className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-lg font-bold">
                   {isSavingPavilion ? '...' : 'Сохранить'}
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА: ВЫДАЧА PRO */}
      {proModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`${theme.card} w-full max-w-sm border rounded-3xl p-6 shadow-2xl relative`}>
            <button onClick={() => setProModal({ isOpen: false, user: null })} className="absolute top-5 right-5 p-2 bg-gray-800 rounded-full"><X size={20}/></button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Crown className="text-yellow-500"/> Выдача PRO</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Кол-во месяцев</label>
                <input 
                  type="number" 
                  min="1"
                  value={proMonths} 
                  onChange={e => setProMonths(e.target.value)} 
                  className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg}`} 
                  placeholder="Например: 1 или 12"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Оплачено (Рублей)</label>
                <input type="number" value={proAmount} onChange={e => setProAmount(e.target.value)} className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg}`} placeholder="2000" />
              </div>
            </div>
            <button onClick={submitProGrant} disabled={isSubmittingPro} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl">Выдать подписку</button>
          </div>
        </div>
      )}
    </div>
  );
}