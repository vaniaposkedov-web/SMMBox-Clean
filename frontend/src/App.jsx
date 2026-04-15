import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet } from 'react-router-dom';
import { 
  PlusSquare, Inbox, Settings as SettingsIcon, User, Users, Box, LogOut, 
  MoreHorizontal, ChevronDown, ChevronUp, Layers, FileText, BarChart2, Droplet, PenTool, Bell 
} from 'lucide-react';
import { useStore } from './store'; 

import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';

// --- СТРАНИЦЫ ДЛЯ АВТОРИЗОВАННЫХ ---
import Publish from './pages/Publish';
import Requests from './pages/Requests';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Onboarding from './pages/Onboarding'; 
import PartnersManager from './components/settings/PartnersManager';
import PostsHistory from './pages/PostsHistory';
import SignatureConstructor from './pages/SignatureConstructor';

// === НАШИ НОВЫЕ ПОДКЛЮЧЕННЫЕ РАЗДЕЛЫ ===
import AccountsManager from './components/settings/AccountsManager';
import WatermarkConstructor from './components/settings/WatermarkConstructor';

// --- СТРАНИЦЫ АВТОРИЗАЦИИ И ВОССТАНОВЛЕНИЯ ---
import Auth from './pages/Auth'; 
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// --- ВРЕМЕННЫЕ ЗАГЛУШКИ ДЛЯ НОВЫХ РАЗДЕЛОВ ---
const DummyPage = ({ title }) => (
  <div className="p-8 text-center text-gray-400">
    <h1 className="text-2xl text-white font-bold mb-4">{title}</h1>
    <p>Эта страница находится в разработке (Скоро здесь будет функционал как в SMMBox).</p>
  </div>
);

// --- БОКОВОЕ МЕНЮ ДЛЯ ПК (ОБЫЧНЫЙ ЮЗЕР) ---
function Sidebar() {
  const logout = useStore((state) => state.logout);
  const user = useStore((state) => state.user);
  
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // ⚡ УМНАЯ ЛОГИКА УВЕДОМЛЕНИЙ
  const incomingRequests = useStore((state) => state.incomingRequests) || [];
  const unreadNotifications = (useStore((state) => state.notifications) || []).filter(n => !n.isRead && !n.text.includes('поделился с вами новой'));
  const unreadShared = (useStore((state) => state.sharedIncoming) || []).filter(p => !p.isPublished);
  
  // Считаем бейджи для каждого раздела
  const partnersBadgeCount = incomingRequests.length;
  const notificationsBadgeCount = incomingRequests.length + unreadNotifications.length + unreadShared.length;

  const linkClass = ({isActive}) => 
    `flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${isActive ? 'bg-admin-accent/10 text-admin-accent' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`;

  const subLinkClass = ({isActive}) => 
    `flex items-center gap-3 p-2.5 rounded-xl transition-all text-sm font-medium ${isActive ? 'text-admin-accent bg-admin-accent/5' : 'text-gray-500 hover:text-white'}`;

  return (
    <aside className="hidden md:flex flex-col w-64 bg-admin-card border-r border-gray-800 h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3 border-b border-gray-800">
        <div className="w-8 h-8 bg-admin-accent rounded-lg flex items-center justify-center text-white">
          <Box size={20} />
        </div>
        <span className="text-xl font-bold tracking-wide">SMM<span className="text-admin-accent">DECK</span></span>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        <NavLink to="/profile" className={linkClass}><User size={20} /> Профиль</NavLink>
        
        {/* ⚡ ВКЛАДКА ПАРТНЕРОВ С БЕЙДЖЕМ */}
        <NavLink to="/partners" className={({isActive}) => `flex items-center justify-between p-3 rounded-xl transition-all font-medium ${isActive ? 'bg-admin-accent/10 text-admin-accent' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Users size={20} />
              {partnersBadgeCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse border-2 border-admin-card" />}
            </div>
            <span>Партнеры</span>
          </div>
          {partnersBadgeCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">{partnersBadgeCount}</span>
          )}
        </NavLink>

        <NavLink to="/publish" className={linkClass}>
          <PlusSquare size={20} /> Создать пост
        </NavLink>

        {/* ⚡ ИЗМЕНЕННАЯ ВКЛАДКА УВЕДОМЛЕНИЙ (КОЛОКОЛЬЧИК) */}
        <NavLink to="/requests" className={({isActive}) => `flex items-center justify-between p-3 rounded-xl transition-all font-medium ${isActive ? 'bg-admin-accent/10 text-admin-accent' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell size={20} />
              {notificationsBadgeCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse border-2 border-admin-card" />}
            </div>
            <span>Уведомления</span>
          </div>
          {notificationsBadgeCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">{notificationsBadgeCount}</span>
          )}
        </NavLink>

        {/* === МЕНЮ "ЕЩЕ" === */}
        <div className="pt-2 pb-1 border-t border-gray-800/50 mt-2">
          <button 
            onClick={() => setIsMoreOpen(!isMoreOpen)} 
            className="flex w-full items-center justify-between p-3 rounded-xl transition-all font-medium text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <div className="flex items-center gap-3">
              <MoreHorizontal size={20} />
              <span>Еще</span>
            </div>
            {isMoreOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {isMoreOpen && (
            <div className="pl-4 pr-2 py-2 mt-1 space-y-1 border-l-2 border-gray-800/50 ml-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <NavLink to="/publish" className={subLinkClass}><PlusSquare size={16} /> Создать пост</NavLink>
              <NavLink to="/accounts" className={subLinkClass}><Layers size={16} /> Аккаунты и страницы</NavLink>
              <NavLink to="/posts" className={subLinkClass}><FileText size={16} /> Посты</NavLink>
              <NavLink to="/analytics" className={subLinkClass}><BarChart2 size={16} /> Аналитика</NavLink>
              <NavLink to="/watermark" className={subLinkClass}><Droplet size={16} /> Водяной знак</NavLink>
              <NavLink to="/signatures" className={subLinkClass}><PenTool size={16} /> Подписи к постам</NavLink>
            </div>
          )}
        </div>
      </nav>

      <div className="p-4 border-t border-gray-800 space-y-2">
        <button onClick={() => logout()} className="flex items-center gap-3 w-full p-3 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all font-medium">
          <LogOut size={20} /> Выйти
        </button>
      </div>
    </aside>
  );
}

/// --- НИЖНЕЕ МЕНЮ ДЛЯ ТЕЛЕФОНОВ (ОБЫЧНЫЙ ЮЗЕР) ---
function BottomNav() {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // ⚡ УМНАЯ ЛОГИКА УВЕДОМЛЕНИЙ
  const incomingRequests = useStore((state) => state.incomingRequests) || [];
  const unreadNotifications = (useStore((state) => state.notifications) || []).filter(n => !n.isRead && !n.text.includes('поделился с вами новой'));
  const unreadShared = (useStore((state) => state.sharedIncoming) || []).filter(p => !p.isPublished);

  const partnersBadgeCount = incomingRequests.length;
  const notificationsBadgeCount = incomingRequests.length + unreadNotifications.length + unreadShared.length;

  const linkClass = ({isActive}) => 
    `flex flex-col items-center flex-1 p-2 rounded-xl transition-colors ${isActive ? 'text-admin-accent' : 'text-gray-500 hover:text-gray-300'}`;

  const popoverLinkClass = ({isActive}) => 
    `flex flex-col items-center justify-center p-3 bg-gray-900 rounded-xl transition-all ${isActive ? 'text-admin-accent border border-admin-accent/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`;

  return (
    <>
      {isMoreMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm" onClick={() => setIsMoreMenuOpen(false)}>
          <div className="absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-2 right-2 bg-admin-card border border-gray-800 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-3 gap-3">
              <NavLink to="/publish" onClick={() => setIsMoreMenuOpen(false)} className={popoverLinkClass}>
                <PlusSquare size={22} className="mb-2" />
                <span className="text-[10px] text-center leading-tight">Создать<br/>пост</span>
              </NavLink>
              <NavLink to="/accounts" onClick={() => setIsMoreMenuOpen(false)} className={popoverLinkClass}>
                <Layers size={22} className="mb-2" />
                <span className="text-[10px] text-center leading-tight">Аккаунты и<br/>страницы</span>
              </NavLink>
              <NavLink to="/posts" onClick={() => setIsMoreMenuOpen(false)} className={popoverLinkClass}>
                <FileText size={22} className="mb-2" />
                <span className="text-[10px] text-center leading-tight">Посты</span>
              </NavLink>
              <NavLink to="/analytics" onClick={() => setIsMoreMenuOpen(false)} className={popoverLinkClass}>
                <BarChart2 size={22} className="mb-2" />
                <span className="text-[10px] text-center leading-tight">Аналитика</span>
              </NavLink>
              <NavLink to="/watermark" onClick={() => setIsMoreMenuOpen(false)} className={popoverLinkClass}>
                <Droplet size={22} className="mb-2" />
                <span className="text-[10px] text-center leading-tight">Водяной<br/>знак</span>
              </NavLink>
              <NavLink to="/signatures" onClick={() => setIsMoreMenuOpen(false)} className={popoverLinkClass}>
                <PenTool size={22} className="mb-2" />
                <span className="text-[10px] text-center leading-tight">Подписи к<br/>постам</span>
              </NavLink>
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-admin-card/95 backdrop-blur-xl border-t border-gray-800 flex justify-between px-1 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] z-[100]">
        <NavLink to="/profile" className={linkClass} onClick={() => setIsMoreMenuOpen(false)}>
          <User size={22} /><span className="text-[10px] mt-1 font-medium">Профиль</span>
        </NavLink>
        
        {/* ⚡ ПАРТНЕРЫ С БЕЙДЖЕМ */}
        <NavLink to="/partners" className={linkClass} onClick={() => setIsMoreMenuOpen(false)}>
          <div className="relative">
            <Users size={22} />
            {partnersBadgeCount > 0 && <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-admin-card" />}
          </div>
          <span className="text-[10px] mt-1 font-medium">Партнеры</span>
        </NavLink>

        <NavLink to="/publish" onClick={() => setIsMoreMenuOpen(false)} className="relative flex flex-col items-center justify-center px-2 -mt-6">
           <div className="w-14 h-14 bg-[#0077FF] rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_rgba(0,119,255,0.4)] border-[4px] border-admin-card active:scale-95 transition-transform">
              <PlusSquare size={26} className="ml-0.5" />
           </div>
           <span className="text-[10px] mt-1.5 font-bold text-gray-300">Пост</span>
        </NavLink>

        {/* ⚡ УВЕДОМЛЕНИЯ С БЕЙДЖЕМ (ЗАМЕНИЛИ INBOX НА BELL) */}
        <NavLink to="/requests" className={linkClass} onClick={() => setIsMoreMenuOpen(false)}>
          <div className="relative">
            <Bell size={22} />
            {notificationsBadgeCount > 0 && <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-admin-card animate-pulse" />}
          </div>
          <span className="text-[10px] mt-1 font-medium">Уведомления</span>
        </NavLink>
        
        <button onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} className={`flex flex-col items-center flex-1 p-2 rounded-xl transition-colors ${isMoreMenuOpen ? 'text-admin-accent' : 'text-gray-500 hover:text-gray-300'}`}>
          <MoreHorizontal size={22} />
          <span className="text-[10px] mt-1 font-medium">Еще</span>
        </button>
      </nav>
    </>
  );
}

// --- КАРКАС ОБЫЧНОГО ПОЛЬЗОВАТЕЛЯ ---
function UserLayout() {
  const user = useStore((state) => state.user);
  const fetchPartnerData = useStore((state) => state.fetchPartnerData);
  const fetchSharedPosts = useStore((state) => state.fetchSharedPosts);

  useEffect(() => {
    if (user?.id) {
      fetchPartnerData(user.id);
      fetchSharedPosts();

      const interval = setInterval(() => {
        fetchPartnerData(user.id);
        fetchSharedPosts();
      }, 15000);
      
      return () => clearInterval(interval);
    }
  }, [user?.id, fetchPartnerData, fetchSharedPosts]);

  return (
    <div className="min-h-screen bg-admin-bg text-admin-text flex font-sans">
      <Sidebar />
      <main className="flex-1 w-full pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

// --- ГЛАВНЫЙ КОМПОНЕНТ ---
function App() {
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const token = localStorage.getItem('token'); 

  useEffect(() => {
    if (user && !token) {
      logout();
    }
  }, [user, token, logout]);

  if (user && !token) {
    return null; 
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
          <Route path="/boss-login" element={<AdminLogin />} />
          <Route path="/system-core-dashboard" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
          
        </Routes>
      </BrowserRouter>
    );
  }

  // === ВЕТКИ 2 И 3: АВТОРИЗОВАН ===
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />

        <Route element={<UserLayout />}>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/partners" element={<PartnersManager />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          
          {/* === НАШИ НОВЫЕ РОУТЫ ИЗ ВКЛАДКИ "ЕЩЕ" === */}
          <Route path="/accounts" element={<AccountsManager />} />
          <Route path="/watermark" element={<WatermarkConstructor />} />
          <Route path="/posts" element={<PostsHistory />} />
          <Route path="/analytics" element={<DummyPage title="Аналитика" />} />
          <Route path="/signatures" element={<SignatureConstructor />} />
        </Route>

        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/boss-login" element={<AdminLogin />} />
        <Route path="/system-core-dashboard" element={<AdminDashboard />} />

        <Route path="*" element={<Navigate to="/profile" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;