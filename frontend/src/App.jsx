import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
// ВСЕ иконки, которые мы используем, должны быть тут:
import { LayoutDashboard, CalendarDays, Users, LogOut, Box, Search, Settings as SettingsIcon, Shield } from 'lucide-react';
import { useStore } from './store'; 

// Подключаем все страницы
import Dashboard from './pages/Dashboard';
import Planner from './pages/Planner';
import Accounts from './pages/Accounts';
import Auth from './pages/Auth'; 
import ContentSearch from './pages/ContentSearch';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';

// --- БОКОВОЕ МЕНЮ ДЛЯ ПК ---
function Sidebar() {
  const logout = useStore((state) => state.logout);

  return (
    <aside className="hidden md:flex flex-col w-64 bg-admin-card border-r border-gray-800 h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3 border-b border-gray-800">
        <div className="w-8 h-8 bg-admin-accent rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
          <Box size={20} />
        </div>
        <span className="text-xl font-bold tracking-wide">SMM<span className="text-admin-accent">BOX</span></span>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <NavLink to="/" className={({isActive}) => `flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${isActive ? 'bg-admin-accent/10 text-admin-accent' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
          <LayoutDashboard size={20} /> Дашборд
        </NavLink>
        <NavLink to="/planner" className={({isActive}) => `flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${isActive ? 'bg-admin-accent/10 text-admin-accent' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
          <CalendarDays size={20} /> Контент-план
        </NavLink>
        <NavLink to="/search" className={({isActive}) => `flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${isActive ? 'bg-admin-accent/10 text-admin-accent' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
          <Search size={20} /> Поиск контента
        </NavLink>
        <NavLink to="/accounts" className={({isActive}) => `flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${isActive ? 'bg-admin-accent/10 text-admin-accent' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
          <Users size={20} /> Мои аккаунты
        </NavLink>
        <NavLink to="/settings" className={({isActive}) => `flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${isActive ? 'bg-admin-accent/10 text-admin-accent' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
          <SettingsIcon size={20} /> Настройки
        </NavLink>
        
        <div className="pt-4 mt-4 border-t border-gray-800">
          <NavLink to="/admin" className={({isActive}) => `flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${isActive ? 'bg-red-500/10 text-red-400' : 'text-gray-500 hover:bg-gray-800 hover:text-white'}`}>
            <Shield size={20} /> Админ-панель
          </NavLink>
        </div>
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button onClick={() => logout()} className="flex items-center gap-3 w-full p-3 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all font-medium">
          <LogOut size={20} /> Выйти
        </button>
      </div>
    </aside>
  );
}

// --- НИЖНЕЕ МЕНЮ ДЛЯ ТЕЛЕФОНОВ ---
// --- НИЖНЕЕ МЕНЮ ДЛЯ ТЕЛЕФОНОВ ---
function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-admin-card/95 backdrop-blur-xl border-t border-gray-800 flex justify-between px-2 py-2 pb-safe z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      
      <NavLink to="/" className={({isActive}) => `flex flex-col items-center flex-1 p-2 rounded-xl transition-colors ${isActive ? 'text-admin-accent' : 'text-gray-500 hover:text-gray-300'}`}>
        <LayoutDashboard size={22} />
        <span className="text-[10px] mt-1 font-medium">Дашборд</span>
      </NavLink>

      <NavLink to="/search" className={({isActive}) => `flex flex-col items-center flex-1 p-2 rounded-xl transition-colors ${isActive ? 'text-admin-accent' : 'text-gray-500 hover:text-gray-300'}`}>
        <Search size={22} />
        <span className="text-[10px] mt-1 font-medium">Поиск</span>
      </NavLink>

      {/* ИСПРАВЛЕННАЯ КНОПКА ПОСТОВ */}
      <NavLink to="/planner" className={({isActive}) => `flex flex-col items-center flex-1 p-2 rounded-xl transition-colors ${isActive ? 'text-admin-accent' : 'text-gray-500 hover:text-gray-300'}`}>
        {({ isActive }) => (
          <>
            <div className={`p-1.5 rounded-lg mb-0.5 ${isActive ? 'bg-admin-accent/20' : 'bg-transparent'}`}>
              <CalendarDays size={22} />
            </div>
            <span className="text-[10px] font-medium">Посты</span>
          </>
        )}
      </NavLink>

      <NavLink to="/accounts" className={({isActive}) => `flex flex-col items-center flex-1 p-2 rounded-xl transition-colors ${isActive ? 'text-admin-accent' : 'text-gray-500 hover:text-gray-300'}`}>
        <Users size={22} />
        <span className="text-[10px] mt-1 font-medium">Аккаунты</span>
      </NavLink>

      <NavLink to="/settings" className={({isActive}) => `flex flex-col items-center flex-1 p-2 rounded-xl transition-colors ${isActive ? 'text-admin-accent' : 'text-gray-500 hover:text-gray-300'}`}>
        <SettingsIcon size={22} />
        <span className="text-[10px] mt-1 font-medium">Настройки</span>
      </NavLink>

    </nav>
  );
}

// --- ГЛАВНЫЙ КОМПОНЕНТ ---
function App() {
  const user = useStore((state) => state.user);

  if (!user) {
    return <Auth />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-admin-bg text-admin-text flex font-sans">
        <Sidebar />
        <main className="flex-1 w-full pb-20 md:pb-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto w-full">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/planner" element={<Planner />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/search" element={<ContentSearch />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default App;