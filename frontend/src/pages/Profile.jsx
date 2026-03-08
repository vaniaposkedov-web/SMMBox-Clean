import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { 
  User, Mail, Shield, Edit2, Clock, X, Hash, Camera, 
  Check, Copy, CalendarClock, CheckCircle2, AlertCircle, BarChart3, 
  Settings as SettingsIcon, LayoutDashboard, Lock, Eye, Share2, 
  Phone, Key, Users, Send, Loader2, Search, Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// === ИКОНКИ СОЦСЕТЕЙ ===
const IconVK = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93v6.14C2 20.67 3.33 22 8.93 22h6.14c5.6 0 6.93-1.33 6.93-6.93V8.93C22 3.33 20.67 2 15.07 2zm3.3 14.53h-1.55c-.52 0-.67-.41-1.58-1.33-.77-.79-1.07-.88-1.26-.88-.26 0-.34.08-.34.5v1.2c0 .32-.1.51-1.5.51-2.2 0-4.6-1.5-6.23-3.86C4.16 9.88 3.5 6.92 3.5 6.57c0-.28.1-.5.62-.5h1.56c.46 0 .61.22.8.72 1.25 3.5 2.92 5.51 3.73 5.51.21 0 .31-.1.31-.63V8.65c-.06-1.14-.34-1.25-1.08-1.25-.33 0-.15-.46.12-.64.41-.27 1.15-.29 1.76-.29.83 0 1.05.07 1.25.13.34.11.31.39.31 1.09v3.08c0 .41.18.51.3.51.25 0 .65-.18 1.48-1.02 1.22-1.34 2.1-3.64 2.4-4.57.14-.39.3-.57.77-.57h1.55c.61 0 .73.3.62.72-.25.86-1.74 3.12-2.51 4.14-.36.47-.46.61-.17 1 .23.33 1.05 1.02 1.5 1.58 1.01 1.23 1.3 1.77 1.48 2.05.21.31.06.63-.4.63z"/>
  </svg>
);

const IconTG = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
  </svg>
);

export default function Profile() {
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const updateUser = useStore((state) => state.updateUser);
  const requestEmailLink = useStore((state) => state.requestEmailLink);
  const verifyEmailLink = useStore((state) => state.verifyEmailLink);

  // === ДАННЫЕ ИЗ СТОРА ===
  const accounts = useStore((state) => state.accounts) || [];
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  
  const scheduledPostsRaw = useStore((state) => state.scheduledPosts) || [];
  const fetchScheduledPosts = useStore((state) => state.fetchScheduledPosts);
  
  const myPartners = useStore((state) => state.myPartners) || [];
  const fetchPartnerData = useStore((state) => state.fetchPartnerData);
  const sharePostAction = useStore((state) => state.sharePostAction);

  const fileInputRef = useRef(null);

  // === СОСТОЯНИЯ ВКЛАДОК И МОДАЛОК ===
  const [activeTab, setActiveTab] = useState('overview'); 
  const [postFilter, setPostFilter] = useState('all'); 
  
  const [viewPostModal, setViewPostModal] = useState(null); 
  const [sharePostModal, setSharePostModal] = useState(null); 
  
  // === СОСТОЯНИЯ ШЕРИНГА ===
  const [selectedPartners, setSelectedPartners] = useState([]);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // === СОСТОЯНИЯ ФОРМЫ ПРОФИЛЯ ===
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  
  const [name, setName] = useState(user?.name || '');
  const [pavilion, setPavilion] = useState(user?.pavilion || '');
  const [phone, setPhone] = useState(user?.phone || ''); 
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(user?.avatarUrl || null);

  // === СОСТОЯНИЯ БЕЗОПАСНОСТИ ===
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);

  // === СОСТОЯНИЯ ПРИВЯЗКИ (КРАСНАЯ ПЛАШКА) ===
  const [realEmail, setRealEmail] = useState('');
  const [realPhone, setRealPhone] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState('');

  // Загружаем данные при открытии профиля
  useEffect(() => {
    if (user?.id) {
      fetchAccounts(user.id);
      fetchScheduledPosts();
      fetchPartnerData(user.id);
    }
  }, [user?.id, fetchAccounts, fetchScheduledPosts, fetchPartnerData]);

  // Умная маска для телефона (+7 (XXX) XXX-XX-XX)
  const formatPhoneNumber = (value) => {
    let input = value.replace(/\D/g, '');
    if (!input) return '';
    if (input[0] === '7' || input[0] === '8') input = input.substring(1);
    let formatted = '+7';
    if (input.length > 0) formatted += ' (' + input.substring(0, 3);
    if (input.length >= 4) formatted += ') ' + input.substring(3, 6);
    if (input.length >= 7) formatted += '-' + input.substring(6, 8);
    if (input.length >= 9) formatted += '-' + input.substring(8, 10);
    return formatted;
  };

  // Вычисляем статистику
  const stats = useMemo(() => {
    let published = 0;
    let scheduled = 0;
    if (Array.isArray(scheduledPostsRaw)) {
      scheduledPostsRaw.forEach(p => {
        if (p.status === 'PUBLISHED') published++;
        if (p.status === 'SCHEDULED') scheduled++;
      });
    }
    return { published, scheduled, accountsCount: accounts.length };
  }, [scheduledPostsRaw, accounts]);

  // Формируем список постов с парсингом картинок
  const processedPosts = useMemo(() => {
    if (!Array.isArray(scheduledPostsRaw)) return [];
    return [...scheduledPostsRaw]
      .sort((a, b) => new Date(b.publishAt || b.createdAt).getTime() - new Date(a.publishAt || a.createdAt).getTime())
      .map(p => {
        let parsedMedia = [];
        try { parsedMedia = p.mediaUrls ? JSON.parse(p.mediaUrls) : []; } catch(e) { parsedMedia = []; }

        return {
            ...p,
            media: parsedMedia,
            statusLower: p.status.toLowerCase(),
            formattedDate: new Date(p.publishAt || p.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
            network: p.account?.provider === 'vk' ? 'VK' : 'TG',
            networkColor: p.account?.provider === 'vk' ? 'text-blue-500 bg-blue-500/10 border-blue-500/20' : 'text-sky-400 bg-sky-400/10 border-sky-400/20',
            networkBg: p.account?.provider === 'vk' ? 'bg-blue-600' : 'bg-sky-500',
            accountName: p.account?.name || 'Аккаунт удален'
        };
      });
  }, [scheduledPostsRaw]);

  // Фильтруем посты
  const filteredPosts = useMemo(() => {
    if (postFilter === 'all') return processedPosts;
    return processedPosts.filter(p => p.statusLower === postFilter);
  }, [processedPosts, postFilter]);

  if (!user) return null;
  const isVulnerable = user?.email?.includes('.local') || !user?.phone;

  // === ОБРАБОТЧИКИ ПРОФИЛЯ ===
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setIsEditing(true);
      setActiveTab('settings');
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const formData = new FormData();
    formData.append('userId', user.id);
    formData.append('name', name);
    formData.append('pavilion', pavilion);
    formData.append('phone', phone);
    if (avatarFile) formData.append('avatar', avatarFile);

    const result = await updateUser(formData);
    if (result.success) {
      setIsEditing(false);
      setAvatarFile(null);
    } else {
      alert(result.error || 'Ошибка при сохранении');
    }
    setIsSaving(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setName(user?.name || '');
    setPavilion(user?.pavilion || '');
    setPhone(user?.phone || '');
    setAvatarFile(null);
    setPreviewUrl(user?.avatarUrl || null);
  };

  // === ОБРАБОТЧИКИ ПАРОЛЯ И ПОЧТЫ ===
  const handlePasswordReset = async () => {
    if (!user.email || user.email.includes('.local')) {
      return alert('Сначала привяжите настоящий Email!');
    }
    setIsResettingPassword(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      if (response.ok) {
        setPasswordResetSent(true);
        setTimeout(() => setPasswordResetSent(false), 5000);
      } else {
        alert('Ошибка при отправке ссылки сброса');
      }
    } catch (e) {
      alert('Ошибка сети');
    }
    setIsResettingPassword(false);
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setIsLinking(true);
    setLinkError('');
    const res = await requestEmailLink(user.id, realEmail);
    if (res.success) setIsCodeSent(true);
    else setLinkError(res.error || 'Ошибка при отправке кода');
    setIsLinking(false);
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setIsLinking(true);
    setLinkError('');
    const res = await verifyEmailLink(user.id, realEmail, verifyCode, realPhone);
    if (res.success) {
      useStore.setState({ user: { ...user, email: realEmail, phone: realPhone || user.phone } });
      setIsCodeSent(false);
      setRealEmail('');
      setRealPhone('');
      setVerifyCode('');
    } else {
      setLinkError(res.error || 'Неверный код подтверждения');
    }
    setIsLinking(false);
  };

  // === ОБРАБОТЧИКИ ШЕРИНГА ===
  const togglePartner = (id) => {
    setSelectedPartners(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const executeSharePost = async () => {
    if (selectedPartners.length === 0) return alert('Выберите хотя бы одного партнера!');
    setIsSharing(true);
    try {
      const result = await sharePostAction(sharePostModal.text, sharePostModal.media, selectedPartners);
      if (result.success) {
         setShareSuccess(true);
         setTimeout(() => {
            setShareSuccess(false);
            setSharePostModal(null);
            setSelectedPartners([]);
         }, 2000);
      } else {
         alert(result.error || 'Ошибка при отправке');
      }
    } catch (e) {
      alert('Ошибка соединения с сервером');
    }
    setIsSharing(false);
  };

  const getRegMethod = () => {
    if (user?.telegramId) return 'Telegram';
    if (user?.vkId) return 'ВКонтакте';
    return 'Почта';
  };

  const StatusBadge = ({ status }) => {
    const s = status || 'draft';
    const styles = {
      published: 'bg-green-500/10 text-green-500 border-green-500/20',
      scheduled: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      error: 'bg-red-500/10 text-red-500 border-red-500/20',
      draft: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    };
    const icons = {
      published: <CheckCircle2 size={14} />,
      scheduled: <CalendarClock size={14} />,
      error: <AlertCircle size={14} />,
      draft: <Edit2 size={14} />
    };
    const labels = { published: 'Опубликовано', scheduled: 'В очереди', error: 'Ошибка', draft: 'Черновик' };

    return (
      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${styles[s] || styles.draft}`}>
        {icons[s] || icons.draft} {labels[s] || labels.draft}
      </span>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-admin-bg p-4 sm:p-8 pb-24 md:pb-8 font-sans">
      
      {/* === УМНАЯ ПЛАШКА ЗАПРОСА ДАННЫХ === */}
      {isVulnerable && (
        <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-3xl p-5 sm:p-6 mb-6 shadow-xl relative overflow-hidden animate-fade-in">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-4">
              <div className="bg-red-500/20 p-3 rounded-full text-red-500 shrink-0">
                <AlertCircle size={28} />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-1">Заполните профиль!</h3>
                <p className="text-gray-400 text-sm">Для полноценной работы укажите настоящую почту и номер телефона.</p>
              </div>
            </div>
            
            {!isCodeSent ? (
              <form onSubmit={handleRequestCode} className="flex flex-col sm:flex-row w-full lg:w-auto gap-3 shrink-0 mt-2 lg:mt-0">
                <div className="relative">
                  <input type="email" value={realEmail} onChange={(e) => setRealEmail(e.target.value)} placeholder="Укажите Email" required className="w-full sm:w-48 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-500 transition-colors" />
                  {linkError && <p className="text-red-500 text-xs mt-1 absolute -bottom-5 left-0 w-max">{linkError}</p>}
                </div>
                {!user?.phone && (
                   <input 
                     type="tel" 
                     value={realPhone} 
                     onChange={(e) => setRealPhone(formatPhoneNumber(e.target.value))} 
                     placeholder="+7 (___) ___-__-__" 
                     required 
                     className="w-full sm:w-48 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-500 transition-colors" 
                   />
                )}
                <button type="submit" disabled={isLinking} className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shrink-0">
                  {isLinking ? 'Отправка...' : 'Подтвердить'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="flex flex-col sm:flex-row w-full lg:w-auto gap-3 shrink-0 mt-2 lg:mt-0">
                <div className="relative">
                  <input type="text" maxLength="6" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))} placeholder="Код из письма" required className="w-full sm:w-36 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm text-center tracking-widest outline-none focus:border-green-500 transition-colors" />
                  {linkError && <p className="text-red-500 text-xs mt-1 absolute -bottom-5 left-0 w-max">{linkError}</p>}
                </div>
                <button type="submit" disabled={isLinking || verifyCode.length !== 6} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shrink-0">
                  {isLinking ? 'Проверка...' : 'Завершить'}
                </button>
                <button type="button" onClick={() => setIsCodeSent(false)} className="px-4 text-sm text-gray-400 hover:text-white transition-colors">Отмена</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ШАПКА ПРОФИЛЯ */}
      <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full pointer-events-none"></div>
        
        <div className="relative group shrink-0 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="w-20 h-20 sm:w-28 sm:h-28 bg-gray-900 rounded-full flex items-center justify-center border-4 border-gray-800 shadow-inner overflow-hidden transition-all group-hover:border-blue-500/50">
            {previewUrl ? <img src={previewUrl} alt="Аватар" className="w-full h-full object-cover" /> : <User size={40} className="text-gray-500" />}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white" size={24} />
            </div>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
        </div>

        <div className="flex-1 text-center sm:text-left z-10 w-full">
          <h1 className="text-2xl font-bold text-white leading-tight mb-3">{user.name || 'Пользователь'}</h1>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 max-w-xl mx-auto sm:mx-0 bg-gray-900/50 p-4 rounded-2xl border border-gray-800/50">
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Mail size={14} className="text-gray-500 shrink-0" /> 
              <span className={`truncate ${user.email.includes('.local') ? "text-red-400 font-medium" : "text-gray-300"}`}>
                {user.email.includes('.local') ? 'Не указан' : user.email}
              </span>
            </p>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Phone size={14} className="text-gray-500 shrink-0" /> 
              <span className={!user.phone ? "text-red-400 font-medium" : "text-gray-300"}>
                {user.phone || 'Не указан'}
              </span>
            </p>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Key size={14} className="text-gray-500 shrink-0" /> 
              <span className="text-gray-300">Вход через {getRegMethod()}</span>
            </p>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Hash size={14} className="text-gray-500 shrink-0" /> 
              <span className="text-gray-300 truncate">ID: {user.id}</span>
              <button onClick={handleCopyId} className="ml-1 hover:text-white transition-colors shrink-0">
                {copiedId ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4">
            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <Shield size={12} /> {user.role === 'ADMIN' ? 'Администратор' : 'Пользователь'}
            </span>
            {user.pavilion && (
              <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5">
                <LayoutDashboard size={12} /> Павильон: {user.pavilion}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* НАВИГАЦИЯ (ВКЛАДКИ) */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 border-b border-gray-800 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-900/50 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'}`}>
          <LayoutDashboard size={18} /> Обзор
        </button>
        <button onClick={() => setActiveTab('posts')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'posts' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-900/50 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'}`}>
          <BarChart3 size={18} /> Мои посты
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-900/50 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'}`}>
          <SettingsIcon size={18} /> Настройки
        </button>
      </div>

      {/* СОДЕРЖИМОЕ ВКЛАДОК */}
      <div className="space-y-6">
        
        {/* === ВКЛАДКА: ОБЗОР === */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 animate-fade-in">
            
            {/* Статистика постов */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
               <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all"></div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500" /> Опубликовано
                  </h3>
                  <span className="text-5xl font-extrabold text-white">{stats.published}</span>
                  <p className="text-sm text-gray-500 mt-2 font-medium">Успешных постов за все время</p>
               </div>

               <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <CalendarClock size={16} className="text-purple-500" /> В очереди
                  </h3>
                  <span className="text-5xl font-extrabold text-white">{stats.scheduled}</span>
                  <p className="text-sm text-gray-500 mt-2 font-medium">Запланировано в контент-плане</p>
               </div>
            </div>

            {/* Быстрые действия и аккаунты */}
            <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
               <div>
                 <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                   <Users size={16} className="text-blue-500" /> Мои аккаунты
                 </h3>
                 <div className="flex items-end gap-3 mb-6">
                    <span className="text-5xl font-extrabold text-white">{stats.accountsCount}</span>
                    <span className="text-gray-500 font-medium mb-1">соцсетей подключено</span>
                 </div>
               </div>
               
               <button onClick={() => navigate('/publish')} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 flex justify-center items-center gap-2 active:scale-95">
                 <Plus size={20} /> Создать пост
               </button>
            </div>
            
          </div>
        )}

        {/* === ВКЛАДКА: МОИ ПОСТЫ === */}
        {activeTab === 'posts' && (
          <div className="bg-admin-card border border-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                 <BarChart3 className="text-blue-500" size={24} /> История публикаций
              </h2>
              
              {/* Фильтры */}
              <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 overflow-x-auto hide-scrollbar">
                 <button onClick={() => setPostFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${postFilter === 'all' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>Все</button>
                 <button onClick={() => setPostFilter('published')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${postFilter === 'published' ? 'bg-green-500/20 text-green-400 shadow-sm' : 'text-gray-400 hover:text-white'}`}>Опубликованы</button>
                 <button onClick={() => setPostFilter('scheduled')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${postFilter === 'scheduled' ? 'bg-purple-500/20 text-purple-400 shadow-sm' : 'text-gray-400 hover:text-white'}`}>В очереди</button>
              </div>
            </div>
            
            <div className="space-y-4">
              {filteredPosts.length > 0 ? (
                filteredPosts.map((post) => (
                  <div key={post.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-gray-900 hover:bg-gray-800 transition-colors rounded-2xl border border-gray-800 group ${post.statusLower === 'published' ? 'opacity-90' : ''}`}>
                    <div className="flex items-start gap-4 overflow-hidden w-full sm:w-auto flex-1">
                      
                      {/* Иконка или превью */}
                      <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold border relative overflow-hidden ${post.networkColor}`}>
                        {post.media && post.media.length > 0 ? (
                           <>
                             <img src={post.media[0]} alt="media" className="w-full h-full object-cover opacity-80" />
                             <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-tl-lg flex items-center justify-center p-1 ${post.networkBg} text-white`}>
                               {post.network === 'VK' ? <IconVK /> : <IconTG />}
                             </div>
                           </>
                        ) : (
                           <div className="w-6 h-6">
                             {post.network === 'VK' ? <IconVK /> : <IconTG />}
                           </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-medium line-clamp-2 leading-snug pr-2">{post.text}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <StatusBadge status={post.statusLower} />
                          <span className="w-1 h-1 rounded-full bg-gray-700 hidden sm:block"></span>
                          <p className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                            <Clock size={12} /> {post.formattedDate}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Кнопки действий */}
                    <div className="flex items-center gap-2 pt-3 sm:pt-0 border-t border-gray-800 sm:border-t-0 sm:ml-auto w-full sm:w-auto justify-end shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setViewPostModal(post)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 border border-gray-700"
                      >
                        <Eye size={14} /> Подробнее
                      </button>
                      <button 
                        onClick={() => setSharePostModal(post)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                      >
                        <Share2 size={14} /> Партнерам
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
                    <Search size={24} />
                  </div>
                  <p className="text-gray-400 font-bold text-lg">Посты не найдены</p>
                  <p className="text-gray-600 text-sm mt-1">Попробуйте изменить фильтр или создайте новый пост.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === ВКЛАДКА: НАСТРОЙКИ === */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 animate-fade-in">
            
            {/* Редактирование профиля */}
            <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                <Edit2 size={20} className="text-blue-500" /> Личные данные
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block font-bold uppercase tracking-wider">Имя и Фамилия</label>
                  <input type="text" value={name} onChange={(e) => {setName(e.target.value); setIsEditing(true);}} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3.5 text-white text-sm focus:border-blue-500 outline-none transition-all shadow-inner" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block font-bold uppercase tracking-wider">Рабочий Павильон</label>
                  <input type="text" value={pavilion} onChange={(e) => {setPavilion(e.target.value); setIsEditing(true);}} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3.5 text-white text-sm focus:border-blue-500 outline-none transition-all shadow-inner" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block font-bold uppercase tracking-wider">Номер телефона</label>
                  <input 
                    type="tel" 
                    value={phone} 
                    onChange={(e) => { setPhone(formatPhoneNumber(e.target.value)); setIsEditing(true); }} 
                    placeholder="+7 (___) ___-__-__"
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3.5 text-white text-sm focus:border-blue-500 outline-none transition-all shadow-inner" 
                  />
                </div>
                
                {isEditing && (
                  <div className="flex gap-3 pt-4 border-t border-gray-800 mt-6">
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20">
                      {isSaving ? <><Loader2 size={18} className="animate-spin"/> Сохранение...</> : 'Сохранить изменения'}
                    </button>
                    <button onClick={cancelEdit} className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-3.5 rounded-xl text-sm font-bold transition-colors border border-gray-700">
                      Отмена
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Безопасность и выход */}
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl">
                <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                  <Shield size={20} className="text-emerald-500" /> Безопасность
                </h2>
                
                <div className="space-y-3">
                  <button 
                    onClick={handlePasswordReset}
                    disabled={isResettingPassword || passwordResetSent}
                    className="w-full flex items-center justify-between p-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl transition-all text-left group disabled:opacity-70 active:scale-95"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${passwordResetSent ? 'bg-emerald-500/20 text-emerald-500' : 'bg-gray-800 group-hover:bg-gray-700 text-gray-400'}`}>
                        {passwordResetSent ? <CheckCircle2 size={20} /> : <Lock size={20} />}
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">{passwordResetSent ? 'Письмо отправлено!' : 'Изменить пароль'}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{passwordResetSent ? 'Проверьте вашу почту' : 'Получить ссылку на сброс'}</p>
                      </div>
                    </div>
                    {!passwordResetSent && (
                      isResettingPassword ? <Loader2 size={18} className="text-gray-500 animate-spin" /> : <SettingsIcon size={18} className="text-gray-600 group-hover:text-white transition-colors" />
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-center items-center text-center">
                <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4 border border-gray-800">
                   <User size={24} className="text-gray-500" />
                </div>
                <p className="text-sm text-gray-400 mb-6 font-medium">Аккаунт создан: <br/><span className="text-white text-base">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'}) : 'Недавно'}</span></p>
                <button onClick={() => logout()} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-4 rounded-xl text-sm font-bold transition-colors flex justify-center items-center gap-2">
                  Выйти из системы
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* === МОДАЛЬНОЕ ОКНО ПРОСМОТРА ПОСТА === */}
      {viewPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-admin-card w-full max-w-lg border border-gray-800 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <button onClick={() => setViewPostModal(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white bg-gray-900 rounded-full p-2 transition-colors">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6 pr-8">
               <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${viewPostModal.networkColor}`}>
                 <div className="w-5 h-5">
                   {viewPostModal.network === 'VK' ? <IconVK /> : <IconTG />}
                 </div>
               </div>
               <div>
                 <h3 className="text-white font-bold text-lg leading-none">{viewPostModal.accountName}</h3>
                 <p className="text-gray-500 text-xs mt-1 font-medium">{viewPostModal.formattedDate}</p>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-4">
               {/* Картинки */}
               {viewPostModal.media && viewPostModal.media.length > 0 && (
                 <div className={`grid gap-2 mb-4 ${viewPostModal.media.length === 1 ? 'grid-cols-1' : viewPostModal.media.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                   {viewPostModal.media.map((img, i) => (
                     <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-800 bg-gray-900">
                       <img src={img} alt="Post media" className="w-full h-full object-cover" />
                     </div>
                   ))}
                 </div>
               )}
               {/* Текст */}
               <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
                 <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                   {viewPostModal.text || <span className="text-gray-600 italic">Текст отсутствует</span>}
                 </p>
               </div>
            </div>

            <div className="pt-4 border-t border-gray-800 flex justify-between items-center">
              <StatusBadge status={viewPostModal.statusLower} />
              <button 
                onClick={() => { setSharePostModal(viewPostModal); setViewPostModal(null); }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
              >
                <Share2 size={16} /> Поделиться
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === МОДАЛЬНОЕ ОКНО ШЕРИНГА ПАРТНЕРАМ === */}
      {sharePostModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-admin-card w-full max-w-md border border-gray-800 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <button onClick={() => setSharePostModal(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white bg-gray-900 rounded-full p-2 transition-colors">
              <X size={20} />
            </button>

            <div className="w-14 h-14 rounded-2xl flex shrink-0 items-center justify-center mb-4 bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Share2 size={28} />
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2 shrink-0">Отправить партнерам</h3>
            <p className="text-gray-400 text-sm mb-5 shrink-0">
              Выберите партнеров, которые получат этот пост для перепубликации.
            </p>

            <div className="overflow-y-auto custom-scrollbar pr-2 mb-4 space-y-2 flex-1 min-h-[150px] bg-gray-900/30 p-2 rounded-2xl border border-gray-800/50">
              {myPartners.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="w-12 h-12 bg-gray-800 rounded-full flex justify-center items-center mx-auto mb-3"><Users size={20}/></div>
                  <p className="font-medium">У вас пока нет партнеров.</p>
                  <p className="text-xs mt-1">Добавьте их в разделе настроек.</p>
                </div>
              ) : (
                myPartners.map(partner => {
                  const isSelected = selectedPartners.includes(partner.id);
                  return (
                    <div 
                      key={partner.id} 
                      onClick={() => togglePartner(partner.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${isSelected ? 'bg-blue-500/10 border-blue-500/50' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}
                    >
                       <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'}`}>
                         {isSelected && <Check size={14} className="text-white"/>}
                       </div>
                       <div>
                         <p className="text-white text-sm font-bold">{partner.name || 'Без имени'}</p>
                         <p className="text-gray-500 text-xs">Павильон: {partner.pavilion || '?'}</p>
                       </div>
                    </div>
                  )
                })
              )}
            </div>

            {shareSuccess ? (
              <div className="text-center py-3 bg-green-500/10 border border-green-500/20 rounded-xl animate-fade-in shrink-0">
                <div className="text-green-500 flex justify-center mb-1"><CheckCircle2 size={24} /></div>
                <p className="text-green-500 font-bold text-sm">Успешно отправлено!</p>
              </div>
            ) : (
              <button 
                onClick={executeSharePost} 
                disabled={myPartners.length === 0 || isSharing}
                className="w-full shrink-0 text-white py-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 shadow-lg shadow-blue-500/20"
              >
                {isSharing ? <><Loader2 className="animate-spin" size={18}/> Отправка...</> : <><Send size={18} /> Разослать выбранным</>}
              </button>
            )}
            
            {/* Предупреждение о медиафайлах, если это уже опубликованный пост */}
            {sharePostModal?.statusLower === 'published' && (!sharePostModal.media || sharePostModal.media.length === 0) && (
              <p className="text-center text-[10px] text-gray-500 mt-3 leading-tight">
                *Уже опубликованные посты отправляются без картинок (так как фото были удалены с сервера для экономии места).
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}