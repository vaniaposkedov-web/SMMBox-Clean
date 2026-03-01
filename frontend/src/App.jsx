import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users } from 'lucide-react';
import { useStore } from './store'; // Подключаем хранилище

import Dashboard from './pages/Dashboard';
import Planner from './pages/Planner';
import Accounts from './pages/Accounts';
import Auth from './pages/Auth'; // Подключаем страницу логина

function BottomNav() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 w-full bg-admin-card border-t border-gray-800 flex justify-around p-3 pb-safe z-40">
      <Link to="/" className={`flex flex-col items-center transition-colors ${location.pathname === '/' ? 'text-admin-accent' : 'text-gray-500'}`}><LayoutDashboard size={24} /><span className="text-[10px] mt-1 font-medium">Дашборд</span></Link>
      <Link to="/planner" className={`flex flex-col items-center transition-colors ${location.pathname === '/planner' ? 'text-admin-accent' : 'text-gray-500'}`}><CalendarDays size={24} /><span className="text-[10px] mt-1 font-medium">Посты</span></Link>
      <Link to="/accounts" className={`flex flex-col items-center transition-colors ${location.pathname === '/accounts' ? 'text-admin-accent' : 'text-gray-500'}`}><Users size={24} /><span className="text-[10px] mt-1 font-medium">Аккаунты</span></Link>
    </nav>
  );
}

function App() {
  // Проверяем, есть ли пользователь в системе
  const user = useStore((state) => state.user);

  // Если пользователя нет, показываем ТОЛЬКО страницу логина
  if (!user) {
    return <Auth />;
  }

  // Если пользователь есть, показываем основное приложение
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-admin-bg text-admin-text pb-20">
        <main className="max-w-md mx-auto w-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/accounts" element={<Accounts />} />
            {/* Перенаправляем любые неизвестные ссылки на главную */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default App;