import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { 
  User, Mail, Shield, Edit2, Clock, X, Hash, Camera, 
  Check, Copy, CalendarClock, CheckCircle2, AlertCircle, BarChart3, 
  Settings as SettingsIcon, LayoutDashboard, Lock, Eye, Share2, 
  Phone, Key, Users, Send, Loader2, Search, Plus, Crown
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';


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

  
  const accounts = useStore((state) => state.accounts) || [];
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  
  const scheduledPostsRaw = useStore((state) => state.scheduledPosts) || [];
  const fetchScheduledPosts = useStore((state) => state.fetchScheduledPosts);
  
  const myPartners = useStore((state) => state.myPartners) || [];
  const fetchPartnerData = useStore((state) => state.fetchPartnerData);
  const sharePostAction = useStore((state) => state.sharePostAction);

  const fileInputRef = useRef(null);

  
  const PRO_MANAGER_TG = 'bnbslow'; 
  const [showProModal, setShowProModal] = useState(false);

  
  const [activeTab, setActiveTab] = useState('overview'); 
  const [postFilter, setPostFilter] = useState('all'); 
  
  const [viewPostModal, setViewPostModal] = useState(null); 
  const [sharePostModal, setSharePostModal] = useState(null); 
  
 
  const [selectedPartners, setSelectedPartners] = useState([]);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  
  const [name, setName] = useState(user?.name || '');
  const [pavilion, setPavilion] = useState(user?.pavilion || '');
  const [phone, setPhone] = useState(user?.phone || ''); 
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(user?.avatarUrl || null);

  
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);

 
  const [realEmail, setRealEmail] = useState('');
  const [realPhone, setRealPhone] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    if (user?.id) {
      fetchAccounts(user.id);
      fetchScheduledPosts();
      fetchPartnerData(user.id);
    }
  }, [user?.id, fetchAccounts, fetchScheduledPosts, fetchPartnerData]);

 
  const location = useLocation();
  const [highlightForm, setHighlightForm] = useState(false);
  
  // ... твои вызовы useStore ...

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('tab') === 'settings') {
      setActiveTab('settings');
    }
    if (searchParams.get('highlight') === 'true') {
      setHighlightForm(true);
      setTimeout(() => {
        document.getElementById('personal-data-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      setTimeout(() => setHighlightForm(false), 3000);
    }
  }, [location.search]);

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
            networkBg: p.account?.provider === 'vk' ? 'bg-[#0077FF]' : 'bg-[#229ED9]',
            accountName: p.account?.name || 'Аккаунт удален'
        };
      });
  }, [scheduledPostsRaw]);

  const filteredPosts = useMemo(() => {
    if (postFilter === 'all') return processedPosts;
    return processedPosts.filter(p => p.statusLower === postFilter);
  }, [processedPosts, postFilter]);

  if (!user) return null;
  const isVulnerable = user?.email?.includes('.local') || !user?.phone || !user?.pavilion;

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
    if (!name || !pavilion || !phone) {
      alert('Пожалуйста, заполните все обязательные поля: Имя, Павильон, Телефон.');
      return;
    }
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

  const handleOpenProModal = () => {
    setShowProModal(true);
  };

  const handleBuyPro = () => {
    const message = `Здравствуйте! 👋\n\nЯ хочу приобрести подписку PRO для SMMBOX за 2000 руб.\nМой ID в системе: ${user.id}`;
    const tgLink = `https://t.me/${PRO_MANAGER_TG}?text=${encodeURIComponent(message)}`;
    window.open(tgLink, '_blank');
    setShowProModal(false);
  };

  const togglePartner = (id) => {
    setSelectedPartners(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const executeSharePost = async () => {
    if (selectedPartners.length === 0) return;
    setIsSharing(true);
    
    try {
      const result = await sharePostAction(sharePostModal.text, sharePostModal.media, selectedPartners);
      if (result.success) {
         setShareSuccess(true);
         
         // БЕЗОПАСНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ ЗАКРЫТИЯ:
         setTimeout(() => {
            setSharePostModal(null); // 1. Сначала скрываем окно из DOM
            
            setTimeout(() => { // 2. Ждем 100мс и только потом чистим стейты
               setShareSuccess(false);
               setSelectedPartners([]);
               setIsSharing(false);
            }, 100);
            
         }, 1500); // Показываем галочку "Успешно" полторы секунды
         
      } else {
         setIsSharing(false);
         alert(result.error || 'Ошибка при отправке');
      }
    } catch (e) {
      setIsSharing(false);
      alert('Ошибка соединения с сервером');
    }
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
      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold border shrink-0 ${styles[s] || styles.draft}`}>
        {icons[s] || icons.draft} {labels[s] || labels.draft}
      </span>
    );
  };

  return (
    <div className="w-full pt-6 lg:pt-10 pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-12 px-4 md:px-8 font-sans">
      
      {/* УМНАЯ ПЛАШКА ЗАПРОСА ДАННЫХ */}
      {isVulnerable && (
        <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-3xl p-5 sm:p-6 mb-6 shadow-xl relative overflow-hidden animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-red-500/20 p-2.5 sm:p-3 rounded-full text-red-500 shrink-0">
                <AlertCircle size={24} className="sm:w-7 sm:h-7" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base sm:text-lg mb-0.5">Заполните профиль!</h3>
                <p className="text-red-200/80 text-xs sm:text-sm">Для доступа к публикациям укажите почту, телефон и павильон.</p>
              </div>
            </div>
            
            <button 
              onClick={() => {
                setActiveTab('settings');
                setHighlightForm(true);
                setTimeout(() => document.getElementById('personal-data-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                setTimeout(() => setHighlightForm(false), 3000);
              }}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-500/20 shrink-0 active:scale-95"
            >
              Перейти к заполнению
            </button>
          </div>
        </div>
      )}

      {/* ШАПКА ПРОФИЛЯ */}
      <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-8 shadow-xl relative overflow-hidden mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full pointer-events-none"></div>
        
        <div className="relative group shrink-0 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gray-900 rounded-full flex items-center justify-center border-4 border-gray-800 shadow-inner overflow-hidden transition-all group-hover:border-blue-500/50">
            {previewUrl ? <img src={previewUrl} alt="Аватар" className="w-full h-full object-cover" /> : <User size={40} className="text-gray-500" />}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white" size={24} />
            </div>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
        </div>

        <div className="flex-1 text-center sm:text-left z-10 w-full min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-3 truncate">{user.name || 'Пользователь'}</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 max-w-xl mx-auto sm:mx-0 bg-gray-900/50 p-4 rounded-2xl border border-gray-800/50 text-left">
            <p className="text-gray-400 text-sm flex items-center gap-2 min-w-0">
              <Mail size={14} className="text-gray-500 shrink-0" /> 
              <span className={`truncate ${user.email?.includes('.local') ? "text-red-400 font-medium" : "text-gray-300"}`}>
                {user.email?.includes('.local') ? 'Не указан' : user.email}
              </span>
            </p>
            <p className="text-gray-400 text-sm flex items-center gap-2 min-w-0">
              <Phone size={14} className="text-gray-500 shrink-0" /> 
              <span className={`truncate ${!user.phone ? "text-red-400 font-medium" : "text-gray-300"}`}>
                {user.phone || 'Не указан'}
              </span>
            </p>
            <p className="text-gray-400 text-sm flex items-center gap-2 min-w-0">
              <Key size={14} className="text-gray-500 shrink-0" /> 
              <span className="text-gray-300 truncate">Вход: {getRegMethod()}</span>
            </p>
            <p className="text-gray-400 text-sm flex items-center gap-2 min-w-0">
              <Hash size={14} className="text-gray-500 shrink-0" /> 
              <span className="text-gray-300 truncate">ID: {user.id?.split('-')[0]}</span>
              <button onClick={handleCopyId} className="ml-1 hover:text-white transition-colors shrink-0">
                {copiedId ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4">
            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1.5">
              <Shield size={12} /> {user.role === 'ADMIN' ? 'Администратор' : 'Пользователь'}
            </span>
            {user.pavilion && (
              <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1.5 truncate max-w-full">
                <LayoutDashboard size={12} className="shrink-0" /> <span className="truncate">Павильон: {user.pavilion}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* НАВИГАЦИЯ (ВКЛАДКИ) */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 sm:mb-8 pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
        <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all min-h-[44px] shrink-0 ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-900/50 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'}`}>
          <LayoutDashboard size={18} /> Обзор
        </button>
        <button onClick={() => setActiveTab('posts')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all min-h-[44px] shrink-0 ${activeTab === 'posts' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-900/50 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'}`}>
          <BarChart3 size={18} /> Мои посты
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all min-h-[44px] shrink-0 ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-900/50 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'}`}>
          <SettingsIcon size={18} /> Настройки
        </button>
      </div>

      {/* СОДЕРЖИМОЕ ВКЛАДОК */}
      <div className="space-y-6">
        
        {/* ВКЛАДКА: ОБЗОР  */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Статистика постов */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-3 sm:gap-6">
               <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-16 h-16 sm:w-24 sm:h-24 bg-green-500/10 rounded-full blur-xl sm:blur-2xl group-hover:bg-green-500/20 transition-all"></div>
                  <h3 className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 sm:gap-2">
                    <CheckCircle2 size={16} className="text-green-500 shrink-0" /> <span className="truncate">Опубликовано</span>
                  </h3>
                  <span className="text-3xl sm:text-5xl font-extrabold text-white">{stats.published}</span>
               </div>

               <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-16 h-16 sm:w-24 sm:h-24 bg-purple-500/10 rounded-full blur-xl sm:blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
                  <h3 className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 sm:gap-2">
                    <CalendarClock size={16} className="text-purple-500 shrink-0" /> <span className="truncate">В очереди</span>
                  </h3>
                  <span className="text-3xl sm:text-5xl font-extrabold text-white">{stats.scheduled}</span>
               </div>
            </div>

            {/* Быстрые действия и аккаунты */}
            <div className="bg-admin-card border border-gray-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between relative overflow-hidden h-full">
               <div>
                 <h3 className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                   <Users size={16} className="text-blue-500" /> Мои аккаунты
                 </h3>
                 <div className="flex items-end gap-3 mb-6">
                    <span className="text-4xl sm:text-5xl font-extrabold text-white leading-none">{stats.accountsCount}</span>
                    <span className="text-gray-500 font-medium mb-1 text-sm sm:text-base">подключено</span>
                 </div>
               </div>
               
               <button onClick={() => navigate('/publish')} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 sm:py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 flex justify-center items-center gap-2 active:scale-95 min-h-[48px]">
                 <Plus size={20} /> Создать пост
               </button>
            </div>

            {/* Баннер PRO */}
            <div className="lg:col-span-3 bg-gradient-to-r from-purple-900 to-indigo-900 border border-purple-500/30 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xl relative overflow-hidden mt-2 flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6">
              <div className="absolute -right-10 -top-10 w-32 h-32 sm:w-40 sm:h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10 text-center sm:text-left min-w-0">
                <h3 className="text-lg sm:text-2xl font-extrabold text-white mb-2 flex items-center justify-center sm:justify-start gap-2">
                  <Crown className={user?.isPro ? "text-yellow-400" : "text-purple-400"} size={24} /> 
                  {user?.isPro ? 'У вас активна PRO подписка!' : 'Снимите все ограничения с PRO'}
                </h3>
                <p className="text-gray-300 text-xs sm:text-base max-w-2xl leading-relaxed">
                  {user?.isPro 
                    ? 'Вам доступны безлимитные аккаунты, автопостинг и все премиум функции платформы.' 
                    : 'Подключите безлимитное количество аккаунтов ВКонтакте и Telegram. Забудьте об ограничениях и развивайте бизнес быстрее!'}
                </p>
              </div>
              {!user?.isPro && (
                <button onClick={handleOpenProModal} className="relative z-10 shrink-0 bg-yellow-500 hover:bg-yellow-400 text-black px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-extrabold transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] active:scale-95 w-full sm:w-auto min-h-[48px]">
                  Подключить PRO
                </button>
              )}
            </div>
            
          </div>
        )}

        {/* ВКЛАДКА: МОИ ПОСТЫ  */}
        {activeTab === 'posts' && (
          <div className="bg-admin-card border border-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                 <BarChart3 className="text-blue-500 shrink-0" size={24} /> История публикаций
              </h2>
              
              {/* Фильтры */}
              <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                 <button onClick={() => setPostFilter('all')} className={`px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all min-h-[40px] sm:min-h-0 ${postFilter === 'all' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>Все</button>
                 <button onClick={() => setPostFilter('published')} className={`px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all min-h-[40px] sm:min-h-0 ${postFilter === 'published' ? 'bg-green-500/20 text-green-400 shadow-sm' : 'text-gray-400 hover:text-white'}`}>Опубликованы</button>
                 <button onClick={() => setPostFilter('scheduled')} className={`px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all min-h-[40px] sm:min-h-0 ${postFilter === 'scheduled' ? 'bg-purple-500/20 text-purple-400 shadow-sm' : 'text-gray-400 hover:text-white'}`}>В очереди</button>
              </div>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              {filteredPosts.length > 0 ? (
                filteredPosts.map((post) => (
                  <div key={post.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-gray-900 hover:bg-gray-800 transition-colors rounded-2xl border border-gray-800 group ${post.statusLower === 'published' ? 'opacity-90' : ''}`}>
                    <div className="flex items-start gap-3 sm:gap-4 overflow-hidden w-full sm:w-auto flex-1">
                      
                      {/* Иконка или превью */}
                      <div className="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0">
                        <div className={`w-full h-full rounded-xl flex items-center justify-center text-sm font-bold border overflow-hidden ${post.media && post.media.length > 0 ? 'border-gray-700 bg-gray-800' : post.networkColor}`}>
                          {post.media && post.media.length > 0 ? (
                             <img src={post.media[0]} alt="media" className="w-full h-full object-cover" />
                          ) : (
                             <div className="w-6 h-6 flex items-center justify-center">
                               {post.network === 'VK' ? <IconVK /> : <IconTG />}
                             </div>
                          )}
                        </div>
                        
                        {post.media && post.media.length > 0 && (
                          <div className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center border-[2px] border-gray-900 ${post.networkBg} text-white shadow-sm z-10`}>
                             <div className="w-3 h-3 flex items-center justify-center">
                               {post.network === 'VK' ? <IconVK /> : <IconTG />}
                             </div>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-white font-medium line-clamp-2 leading-snug pr-2 break-words">{post.text}</p>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                          <StatusBadge status={post.statusLower} />
                          <span className="w-1 h-1 rounded-full bg-gray-700 hidden sm:block"></span>
                          <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 font-medium">
                            <Clock size={12} /> {post.formattedDate}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Кнопки действий */}
                    <div className="flex items-center gap-2 pt-3 sm:pt-0 border-t border-gray-800 sm:border-t-0 sm:ml-auto w-full sm:w-auto justify-end shrink-0 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setViewPostModal(post)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 border border-gray-700 min-h-[44px]"
                      >
                        <Eye size={14} /> Подробнее
                      </button>
                      <button 
                        onClick={() => setSharePostModal(post)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/20 min-h-[44px]"
                      >
                        <Share2 size={14} /> Партнерам
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 sm:py-16 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-gray-500">
                    <Search size={24} />
                  </div>
                  <p className="text-gray-400 font-bold text-base sm:text-lg">Посты не найдены</p>
                  <p className="text-gray-600 text-xs sm:text-sm mt-1">Попробуйте изменить фильтр или создайте новый пост.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === ВКЛАДКА: НАСТРОЙКИ === */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Редактирование профиля */}
            <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-8 shadow-xl">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-5 sm:mb-6 flex items-center gap-2">
                <Edit2 size={20} className="text-blue-500" /> Личные данные
              </h2>
              
              <div 
                id="personal-data-form" 
                className={`space-y-3 transition-all duration-700 ${highlightForm ? 'ring-4 ring-red-500/60 bg-red-500/10 p-4 rounded-2xl scale-[1.02]' : 'p-1'}`}
              >
                <div>
                  <label className="text-[10px] sm:text-xs text-gray-500 mb-1.5 block font-bold uppercase tracking-wider">Имя и Фамилия <span className="text-red-500">*</span></label>
                  <input type="text" value={name} onChange={(e) => {setName(e.target.value); setIsEditing(true);}} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all shadow-inner min-h-[40px]" />
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs text-gray-500 mb-1.5 block font-bold uppercase tracking-wider">Рабочий Павильон <span className="text-red-500">*</span></label>
                  <input type="text" value={pavilion} onChange={(e) => {setPavilion(e.target.value); setIsEditing(true);}} placeholder="Например: 2-1-15" className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all shadow-inner min-h-[40px]" />
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs text-gray-500 mb-1.5 block font-bold uppercase tracking-wider">Номер телефона <span className="text-red-500">*</span></label>
                  <input 
                    type="tel" 
                    value={phone} 
                    onChange={(e) => { setPhone(formatPhoneNumber(e.target.value)); setIsEditing(true); }} 
                    placeholder="+7 (___) ___-__-__"
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all shadow-inner min-h-[40px]" 
                  />
                </div>
                
                {isEditing && (
                  <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-gray-800 mt-4">
                    <button onClick={handleSave} disabled={isSaving} className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50 min-h-[40px] order-1 sm:order-2">
                      {isSaving ? <><Loader2 size={16} className="animate-spin"/> Сохранение...</> : 'Сохранить'}
                    </button>
                    <button onClick={cancelEdit} className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors border border-gray-700 min-h-[40px] order-2 sm:order-1">
                      Отмена
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Безопасность и выход */}
            <div className="space-y-4 sm:space-y-6 flex flex-col">
              <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-8 shadow-xl">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-5 sm:mb-6 flex items-center gap-2">
                  <Shield size={20} className="text-emerald-500" /> Безопасность
                </h2>
                
                <div className="space-y-3">
                  <button 
                    onClick={handlePasswordReset}
                    disabled={isResettingPassword || passwordResetSent}
                    className="w-full flex items-center justify-between p-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl transition-all text-left group disabled:opacity-70 active:scale-95 min-h-[64px]"
                  >
                    <div className="flex items-center gap-4 min-w-0 pr-2">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${passwordResetSent ? 'bg-emerald-500/20 text-emerald-500' : 'bg-gray-800 group-hover:bg-gray-700 text-gray-400'}`}>
                        {passwordResetSent ? <CheckCircle2 size={20} /> : <Lock size={20} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm sm:text-base font-bold truncate">{passwordResetSent ? 'Письмо отправлено!' : 'Изменить пароль'}</p>
                        <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5 truncate">{passwordResetSent ? 'Проверьте вашу почту' : 'Получить ссылку на сброс'}</p>
                      </div>
                    </div>
                    {!passwordResetSent && (
                      isResettingPassword ? <Loader2 size={18} className="text-gray-500 animate-spin shrink-0" /> : <SettingsIcon size={18} className="text-gray-600 group-hover:text-white transition-colors shrink-0" />
                    )}
                  </button>

                  {/* === НАЧАЛО НОВОГО БЛОКА: ДОКУМЕНТЫ ПОДПИСАНЫ === */}
                  <div className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-2xl">
                    <div className="flex items-center gap-4 min-w-0 pr-2">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 bg-green-500/10 text-green-500">
                        <CheckCircle2 size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm sm:text-base font-bold truncate">Документы подписаны</p>
                        <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5 truncate">Пользовательское соглашение</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate('/privacy')} 
                      className="text-blue-500 hover:text-blue-400 p-2 text-sm font-bold transition-colors shrink-0"
                    >
                      Читать
                    </button>
                  </div>
                  {/* === КОНЕЦ НОВОГО БЛОКА === */}

                </div>
              </div>

              <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-center items-center text-center flex-1">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-900 rounded-full flex items-center justify-center mb-4 border border-gray-800">
                   <User size={28} className="text-gray-500" />
                </div>
                <p className="text-xs sm:text-sm text-gray-400 mb-6 font-medium">Аккаунт создан: <br/><span className="text-white text-sm sm:text-base">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'}) : 'Недавно'}</span></p>
                <button onClick={() => logout()} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-3.5 sm:py-4 rounded-xl text-sm font-bold transition-colors flex justify-center items-center gap-2 min-h-[48px] active:scale-95">
                  Выйти из системы
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* === МОДАЛЬНОЕ ОКНО ПРОСМОТРА ПОСТА (BOTTOM SHEET НА MOBILE) === */}
      {viewPostModal && (
        <div className="fixed inset-0 z-200 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-admin-card w-full max-w-lg border-t sm:border border-gray-800 rounded-t-[2rem] sm:rounded-3xl p-5 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl relative flex flex-col max-h-[90vh] sm:max-h-[85vh] transition-transform">
            <button onClick={() => setViewPostModal(null)} className="absolute top-4 sm:top-5 right-4 sm:right-5 text-gray-500 hover:text-white bg-gray-900 rounded-full p-2 sm:p-2.5 transition-colors z-10">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-5 sm:mb-6 pr-10">
               <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border border-gray-700/50 ${viewPostModal.networkColor}`}>
                 <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
                   {viewPostModal.network === 'VK' ? <IconVK /> : <IconTG />}
                 </div>
               </div>
               <div className="min-w-0 flex-1">
                 <h3 className="text-white font-bold text-base sm:text-lg leading-tight truncate">{viewPostModal.accountName}</h3>
                 <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5 font-medium truncate">{viewPostModal.formattedDate}</p>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 sm:pr-2 mb-4">
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
               <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 sm:p-5">
                 <p className="text-gray-300 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed break-words">
                   {viewPostModal.text || <span className="text-gray-600 italic">Текст отсутствует</span>}
                 </p>
               </div>
            </div>

            <div className="pt-4 border-t border-gray-800 flex justify-between items-center gap-3">
              <StatusBadge status={viewPostModal.statusLower} />
              <button 
                onClick={() => { setSharePostModal(viewPostModal); setViewPostModal(null); }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20 active:scale-95 min-h-[44px]"
              >
                <Share2 size={16} /> <span className="hidden sm:inline">Поделиться</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === МОДАЛЬНОЕ ОКНО ШЕРИНГА ПАРТНЕРАМ (ИСПРАВЛЕННОЕ) === */}
      {sharePostModal && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end sm:justify-center items-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          
          <div className="absolute inset-0" onClick={() => setSharePostModal(null)}></div>

          <div className="bg-admin-card w-full max-w-md border-t sm:border border-gray-800 rounded-t-[2rem] sm:rounded-3xl shadow-2xl relative flex flex-col max-h-[85vh] sm:max-h-[90vh] z-10 overflow-hidden">
            
            {/* ШАПКА */}
            <div className="p-5 sm:p-6 shrink-0 border-b border-gray-800 bg-gray-900/50">
              <button onClick={() => setSharePostModal(null)} className="absolute top-5 right-5 text-gray-500 hover:text-white bg-gray-800 rounded-full p-2 transition-colors">
                <X size={20} />
              </button>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <Share2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-1 pr-10">Отправить партнерам</h3>
              <p className="text-gray-400 text-xs sm:text-sm">
                Выберите, кто получит этот пост для публикации.
              </p>
            </div>

            {/* СКРОЛЛИРУЕМЫЙ СПИСОК ПАРТНЕРОВ */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-2 bg-black/20">
              {myPartners.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="w-12 h-12 bg-gray-800 rounded-full flex justify-center items-center mx-auto mb-3"><Users size={20}/></div>
                  <p className="font-medium text-sm">У вас пока нет партнеров.</p>
                </div>
              ) : (
                myPartners.map(partner => {
                  const isSelected = selectedPartners.includes(partner.id);
                  return (
                    <div 
                      key={partner.id} 
                      onClick={() => togglePartner(partner.id)}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${isSelected ? 'bg-blue-500/10 border-blue-500/50' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}
                    >
                       <div className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'}`}>
                         {isSelected && <Check size={14} className="text-white"/>}
                       </div>
                       <div className="min-w-0 flex-1">
                         <p className="text-white text-sm font-bold truncate">{partner.name || 'Без имени'}</p>
                         <p className="text-gray-500 text-[10px] sm:text-xs truncate">Павильон: {partner.pavilion || '?'}</p>
                       </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* ПРИЛИПШАЯ К НИЗУ КНОПКА (С УЧЕТОМ АЙФОНОВ) */}
            <div className="p-5 sm:p-6 shrink-0 border-t border-gray-800 bg-gray-900/50 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {shareSuccess ? (
                <div className="text-center py-3.5 bg-green-500/10 border border-green-500/20 rounded-xl animate-in zoom-in-95 duration-200">
                  <p className="text-green-500 font-bold text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 size={20} /> Успешно отправлено!
                  </p>
                </div>
              ) : (
                <button 
                  onClick={executeSharePost} 
                  disabled={myPartners.length === 0 || isSharing}
                  className="w-full text-white py-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  {isSharing ? <><Loader2 className="animate-spin" size={18}/> Отправка...</> : <><Send size={18} /> Разослать выбранным</>}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* === МОДАЛЬНОЕ ОКНО ОФОРМЛЕНИЯ PRO === */}
      {showProModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#1e2128] w-full max-w-[460px] border-t sm:border border-gray-800 rounded-t-[2rem] sm:rounded-3xl p-6 sm:p-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-8 shadow-2xl relative transition-transform">
            
            <button onClick={() => setShowProModal(false)} className="absolute top-4 sm:top-5 right-4 sm:right-5 text-gray-500 hover:text-white bg-[#14171c] rounded-full p-2.5 transition-colors z-10">
              <X size={22} />
            </button>

            <div className="w-20 h-20 sm:w-[88px] sm:h-[88px] bg-[#EAB308] rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5 shadow-[0_0_40px_rgba(234,179,8,0.15)]">
              <Crown size={40} className="text-black" />
            </div>
            
            <div className="text-center">
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white mb-5 uppercase tracking-wide">ПРО</h3>
              
              <div className="text-gray-300 text-base sm:text-lg mb-6 leading-relaxed space-y-3 sm:space-y-4">
                <p>
                  Стоимость безлимитной PRO-подписки составляет <span className="text-[#EAB308] font-bold block sm:inline mt-1 sm:mt-0">2000 ₽ в месяц</span>
                </p>
                <p className="text-gray-400 text-sm sm:text-base">
                  Оплата производится прямым переводом на банковскую карту.
                </p>
                
                <div className="bg-[#14171c] border border-gray-800/80 p-5 sm:p-6 rounded-2xl text-left mt-6 space-y-4 shadow-inner">
                  <p className="text-gray-300 leading-relaxed text-sm sm:text-[15px]">
                    Нажмите кнопку ниже, чтобы перейти в Telegram. Наш менеджер ответит вам в течение <span className="text-white font-bold">нескольких часов</span> и пришлет реквизиты. 
                  </p>
                  <p className="text-gray-300 leading-relaxed text-sm sm:text-[15px]">
                    Подписка будет активирована <span className="text-[#10B981] font-bold">в течение суток</span> после оплаты!
                  </p>
                </div>
              </div>
            </div>

            <button onClick={handleBuyPro} className="w-full mt-2 bg-[#229ED9] hover:bg-[#1C87BA] text-white py-4 sm:py-5 rounded-2xl font-bold transition-all flex justify-center items-center gap-2 shadow-[0_4px_20px_rgba(34,158,217,0.3)] active:scale-95 text-base sm:text-lg">
              <Send size={22} className="shrink-0 -ml-1" /> Написать обращение
            </button>
          </div>
        </div>
      )}

    </div>
  );
}