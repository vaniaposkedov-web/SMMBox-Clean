import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet } from 'react-router-dom';
import { PlusSquare, Inbox, Settings as SettingsIcon, User, Crown, Box, LogOut, ShieldAlert } from 'lucide-react'; // Добавил ShieldAlert
import { useStore } from './store'; 

// --- СТРАНИЦЫ ДЛЯ АВТОРИЗОВАННЫХ ---
import Publish from './pages/Publish';
import Requests from './pages/Requests';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Subscription from './pages/Subscription';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Onboarding from './pages/Onboarding'; // <--- ИМПОРТИРУЕМ НАШ ПУТЕВОДИТЕЛЬ

// --- СТРАНИЦЫ АВТОРИЗАЦИИ И ВОССТАНОВЛЕНИЯ ---
import Auth from './pages/Auth'; 
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// --- АДМИНКА ---
import AdminRoute from './components/AdminRoute';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';

// --- БОКОВОЕ МЕНЮ ДЛЯ ПК (ОБЫЧНЫЙ ЮЗЕР) ---
function Sidebar() {
  const logout = useStore((state) => state.logout);
  const user = useStore((state) => state.user);

  const linkClass = ({isActive}) => 
    `flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${isActive ? 'bg-admin-accent/10 text-admin-accent' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`;

  return (
    <aside className="hidden md:flex flex-col w-64 bg-admin-card border-r border-gray-800 h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3 border-b border-gray-800">
        <div className="w-8 h-8 bg-admin-accent rounded-lg flex items-center justify-center text-white">
          <Box size={20} />
        </div>
        <span className="text-xl font-bold tracking-wide">SMM<span className="text-admin-accent">BOXSS</span></span>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <NavLink to="/profile" className={linkClass}><User size={20} /> Профиль</NavLink>
        <NavLink to="/publish" className={linkClass}><PlusSquare size={20} /> Опубликовать</NavLink>
        <NavLink to="/requests" className={linkClass}><Inbox size={20} /> Заявки</NavLink>
        <NavLink to="/settings" className={linkClass}><SettingsIcon size={20} /> Настройки</NavLink>
        <NavLink to="/subscription" className={linkClass}><Crown size={20} /> Подписка</NavLink>
      </nav>

      <div className="p-4 border-t border-gray-800 space-y-2">
        {user?.role === 'ADMIN' && (
          <NavLink to="/admin" className="flex items-center gap-3 w-full p-3 rounded-xl bg-gradient-to-r from-rose-600/10 to-transparent text-rose-500 hover:bg-rose-600/20 transition-all font-bold">
            <ShieldAlert size={20} /> Панель Админа
          </NavLink>
        )}
        <button onClick={() => logout()} className="flex items-center gap-3 w-full p-3 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all font-medium">
          <LogOut size={20} /> Выйти
        </button>
      </div>
    </aside>
  );
}

// --- НИЖНЕЕ МЕНЮ ДЛЯ ТЕЛЕФОНОВ (ОБЫЧНЫЙ ЮЗЕР) ---
function BottomNav() {
  const linkClass = ({isActive}) => 
    `flex flex-col items-center flex-1 p-2 rounded-xl transition-colors ${isActive ? 'text-admin-accent' : 'text-gray-500 hover:text-gray-300'}`;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-admin-card/95 backdrop-blur-xl border-t border-gray-800 flex justify-between px-2 py-2 pb-safe z-40">
      <NavLink to="/profile" className={linkClass}><User size={22} /><span className="text-[10px] mt-1 font-medium">Профиль</span></NavLink>
      <NavLink to="/publish" className={linkClass}><PlusSquare size={22} /><span className="text-[10px] mt-1 font-medium">Пост</span></NavLink>
      <NavLink to="/requests" className={linkClass}><Inbox size={22} /><span className="text-[10px] mt-1 font-medium">Заявки</span></NavLink>
      <NavLink to="/settings" className={linkClass}><SettingsIcon size={22} /><span className="text-[10px] mt-1 font-medium">Настройки</span></NavLink>
      <NavLink to="/subscription" className={linkClass}><Crown size={22} /><span className="text-[10px] mt-1 font-medium">Тариф</span></NavLink>
    </nav>
  );
}

// --- КАРКАС ОБЫЧНОГО ПОЛЬЗОВАТЕЛЯ ---
function UserLayout() {
  return (
    <div className="min-h-screen bg-admin-bg text-admin-text flex font-sans">
      <Sidebar />
      <main className="flex-1 w-full pb-20 md:pb-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

// --- ГЛАВНЫЙ КОМПОНЕНТ ---
// --- ГЛАВНЫЙ КОМПОНЕНТ ---
function App() {
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout); // Достаем функцию выхода
  const token = localStorage.getItem('token'); // Проверяем реальный токен

  // === ЖЕСТКАЯ ПРОВЕРКА СЕССИИ ===
  // Если есть юзер, но кто-то удалил токен - принудительно очищаем кэш
  if (user && !token) {
    logout();
    return null; // Ждем пока Zustand очистится
  }

  // === ВЕТКА 1: ЕСЛИ ПОЛЬЗОВАТЕЛЬ НЕ АВТОРИЗОВАН ===
  if (!user || !token) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // ... дальше ваш код ВЕТКИ 2 И 3 без изменений ...

  // === ВЕТКИ 2 И 3: АВТОРИЗОВАН ===
  return (
    <BrowserRouter>
      <Routes>
        
        {/* --- ПУТЕВОДИТЕЛЬ (ДЛЯ НОВИЧКОВ) --- */}
        <Route 
          path="/onboarding" 
          element={user.isOnboardingCompleted ? <Navigate to="/profile" replace /> : <Onboarding />} 
        />

        {/* --- СТАНДАРТНЫЙ ИНТЕРФЕЙС (ТОЛЬКО ЕСЛИ ПРОШЕЛ ПУТЕВОДИТЕЛЬ) --- */}
        <Route element={!user.isOnboardingCompleted ? <Navigate to="/onboarding" replace /> : <UserLayout />}>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
        </Route>

        {/* --- АДМИН ПАНЕЛЬ --- */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* Любая другая ссылка вернет в профиль (или в путеводитель, если он не пройден) */}
        <Route path="*" element={<Navigate to={!user.isOnboardingCompleted ? "/onboarding" : "/profile"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;