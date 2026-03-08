import { useEffect, useState } from 'react';
import { Users, Crown, MessageSquare, Link as LinkIcon, LogOut, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
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
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/boss-login');
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><RefreshCw className="animate-spin text-red-500" size={32} /></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300 p-8 font-mono">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-white uppercase tracking-widest text-red-500">SMMBOX // SYSTEM CORE</h1>
          <button onClick={handleLogout} className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"><LogOut size={18} /> Disconnect</button>
        </div>

        {/* СТАТИСТИКА */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-black border border-gray-800 p-6 rounded-xl border-l-4 border-l-blue-500">
            <h3 className="text-gray-500 text-xs uppercase mb-2 flex items-center gap-2"><Users size={14}/> Всего юзеров</h3>
            <p className="text-3xl font-bold text-white">{data?.stats.totalUsers}</p>
          </div>
          <div className="bg-black border border-gray-800 p-6 rounded-xl border-l-4 border-l-yellow-500">
            <h3 className="text-gray-500 text-xs uppercase mb-2 flex items-center gap-2"><Crown size={14}/> PRO Аккаунты</h3>
            <p className="text-3xl font-bold text-white">{data?.stats.proUsers}</p>
          </div>
          <div className="bg-black border border-gray-800 p-6 rounded-xl border-l-4 border-l-emerald-500">
            <h3 className="text-gray-500 text-xs uppercase mb-2 flex items-center gap-2"><LinkIcon size={14}/> Привязано соцсетей</h3>
            <p className="text-3xl font-bold text-white">{data?.stats.totalAccounts}</p>
          </div>
          <div className="bg-black border border-gray-800 p-6 rounded-xl border-l-4 border-l-purple-500">
            <h3 className="text-gray-500 text-xs uppercase mb-2 flex items-center gap-2"><MessageSquare size={14}/> Всего постов</h3>
            <p className="text-3xl font-bold text-white">{data?.stats.totalPosts}</p>
          </div>
        </div>

        {/* СПИСОК ЮЗЕРОВ */}
        <h2 className="text-lg font-bold text-white uppercase mb-4">Последние регистрации</h2>
        <div className="bg-black border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-900/50 text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-6 py-4">Пользователь</th>
                <th className="px-6 py-4">Email / Phone</th>
                <th className="px-6 py-4">Статус</th>
                <th className="px-6 py-4">Дата регистрации</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data?.recentUsers.map(u => (
                <tr key={u.id} className="hover:bg-gray-900/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-white">{u.name || 'Без имени'}</td>
                  <td className="px-6 py-4">{u.email} <br/> <span className="text-xs text-gray-500">{u.phone}</span></td>
                  <td className="px-6 py-4">
                    {u.isPro ? <span className="text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded text-xs">PRO</span> : <span className="text-gray-500 bg-gray-800 px-2 py-1 rounded text-xs">Free</span>}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{new Date(u.createdAt).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}