import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, Settings, LogOut, ShieldAlert, ArrowLeft } from 'lucide-react';

import { useStore } from '../store';
import { Bell } from 'lucide-react';

function AdminSidebar() {
  const navigate = useNavigate();

  const linkClass = ({isActive}) => 
    `flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${isActive ? 'bg-rose-500/10 text-rose-500' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`;

  return (
    <aside className="hidden md:flex flex-col w-64 bg-gray-950 border-r border-gray-800 h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3 border-b border-gray-800">
        <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-rose-600/20">
          <ShieldAlert size={20} />
        </div>
        <span className="text-xl font-bold tracking-wide text-white">ADMIN<span className="text-rose-500">PANEL</span></span>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <NavLink to="/admin" end className={linkClass}><LayoutDashboard size={20} /> Дашборд</NavLink>
        <NavLink to="/admin/users" className={linkClass}><Users size={20} /> Пользователи</NavLink>
        <NavLink to="/admin/finances" className={linkClass}><CreditCard size={20} /> Финансы</NavLink>
        <NavLink to="/admin/settings" className={linkClass}><Settings size={20} /> Настройки</NavLink>
      </nav>

      <div className="p-4 border-t border-gray-800 space-y-2">
        <button onClick={() => navigate('/profile')} className="flex items-center gap-3 w-full p-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition-all font-medium">
          <ArrowLeft size={20} /> В приложение
        </button>
      </div>
    </aside>
  );
}

function AdminBottomNav() {
  const linkClass = ({isActive}) => 
    `flex flex-col items-center flex-1 p-2 rounded-xl transition-colors ${isActive ? 'text-rose-500' : 'text-gray-500 hover:text-gray-300'}`;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-gray-950/95 backdrop-blur-xl border-t border-gray-800 flex justify-between px-2 py-2 pb-safe z-40">
      <NavLink to="/admin" end className={linkClass}><LayoutDashboard size={22} /><span className="text-[10px] mt-1 font-medium">Обзор</span></NavLink>
      <NavLink to="/admin/users" className={linkClass}><Users size={22} /><span className="text-[10px] mt-1 font-medium">Юзеры</span></NavLink>
      <NavLink to="/admin/finances" className={linkClass}><CreditCard size={22} /><span className="text-[10px] mt-1 font-medium">Финансы</span></NavLink>
      <NavLink to="/admin/settings" className={linkClass}><Settings size={22} /><span className="text-[10px] mt-1 font-medium">Система</span></NavLink>
    </nav>
  );
}

export default function AdminLayout() {
  return (
    <div className="min-h-[100dvh] bg-admin-bg text-admin-text flex font-sans">
      <AdminSidebar />
      <main className="flex-1 w-full pb-20 md:pb-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full p-4 md:p-8">
          {/* Сюда будут подгружаться страницы админки */}
          <Outlet /> 
        </div>
      </main>
      <AdminBottomNav />
    </div>
  );
}