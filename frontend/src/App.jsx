import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { PlusSquare, Inbox, Settings as SettingsIcon, User, Crown, Box, LogOut } from 'lucide-react';
import { useStore } from './store'; 

import Auth from './pages/Auth'; 
import Publish from './pages/Publish';
import Requests from './pages/Requests';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Subscription from './pages/Subscription';

// --- БОКОВОЕ МЕНЮ ДЛЯ ПК ---
function Sidebar() {
  const logout = useStore((state) => state.logout);

  const linkClass = ({isActive}) => 
    `flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${isActive ? 'bg-admin-accent/10 text-admin-accent' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`;

  return (
    <aside className="hidden md:flex flex-col w-64 bg-admin-card border-r border-gray-800 h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3 border-b border-gray-800">
        <div className="w-8 h-8 bg-admin-accent rounded-lg flex items-center justify-center text-white">
          <Box size={20} />
        </div>
        <span className="text-xl font-bold tracking-wide">SMM<span className="text-admin-accent">BOX</span></span>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <NavLink to="/publish" className={linkClass}><PlusSquare size={20} /> Опубликовать</NavLink>
        <NavLink to="/requests" className={linkClass}><Inbox size={20} /> Заявки</NavLink>
        <NavLink to="/settings" className={linkClass}><SettingsIcon size={20} /> Настройки</NavLink>
        <NavLink to="/profile" className={linkClass}><User size={20} /> Профиль</NavLink>
        <NavLink to="/subscription" className={linkClass}><Crown size={20} /> Подписка</NavLink>
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
function BottomNav() {
  const linkClass = ({isActive}) => 
    `flex flex-col items-center flex-1 p-2 rounded-xl transition-colors ${isActive ? 'text-admin-accent' : 'text-gray-500 hover:text-gray-300'}`;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-admin-card/95 backdrop-blur-xl border-t border-gray-800 flex justify-between px-2 py-2 pb-safe z-40">
      <NavLink to="/publish" className={linkClass}><PlusSquare size={22} /><span className="text-[10px] mt-1 font-medium">Пост</span></NavLink>
      <NavLink to="/requests" className={linkClass}><Inbox size={22} /><span className="text-[10px] mt-1 font-medium">Заявки</span></NavLink>
      <NavLink to="/settings" className={linkClass}><SettingsIcon size={22} /><span className="text-[10px] mt-1 font-medium">Настройки</span></NavLink>
      <NavLink to="/profile" className={linkClass}><User size={22} /><span className="text-[10px] mt-1 font-medium">Профиль</span></NavLink>
      <NavLink to="/subscription" className={linkClass}><Crown size={22} /><span className="text-[10px] mt-1 font-medium">Тариф</span></NavLink>
    </nav>
  );
}

// --- ГЛАВНЫЙ КОМПОНЕНТ ---
function App() {
  const user = useStore((state) => state.user);

  // Если пока хочешь пускать без пароля - закомментируй эти 3 строки
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
              {/* Перенаправляем корень сразу на "Опубликовать" */}
              <Route path="/" element={<Navigate to="/publish" replace />} />
              
              <Route path="/publish" element={<Publish />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/subscription" element={<Subscription />} />
              
              <Route path="*" element={<Navigate to="/publish" replace />} />
            </Routes>
          </div>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default App;