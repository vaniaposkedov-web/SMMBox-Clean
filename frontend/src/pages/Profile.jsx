import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { 
  User, Mail, Shield, Edit2, X, Hash, Camera, 
  Check, Copy, CalendarClock, CheckCircle2, AlertCircle, 
  Settings as SettingsIcon, LayoutDashboard, Lock, 
  Phone, Key, Users, Send, Loader2, Plus, Crown, MessageCircle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

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

  const fileInputRef = useRef(null);

  const fetchCurrentUser = useStore((state) => state.fetchCurrentUser);

  const PRO_MANAGER_TG = 'bnbslow'; 
  const [showProModal, setShowProModal] = useState(false);
  const [selectedPlanModal, setSelectedPlanModal] = useState('PRO'); // 'BASIC' или 'PRO'

  const [activeTab, setActiveTab] = useState('overview');
  
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

  const location = useLocation();
  const [highlightForm, setHighlightForm] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchAccounts(user.id);
      fetchScheduledPosts();
    }
  }, [user?.id, fetchAccounts, fetchScheduledPosts]);


  useEffect(() => {
    // При каждом заходе в Профиль или при F5 — обновляем данные пользователя
    fetchCurrentUser();
  }, []);

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

  // 🛡️ Форматирование номера телефона под маску +7 (999) 999-99-99
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

  // 🛡️ Умное сохранение профиля с валидацией номера телефона
  const handleSave = async () => {
    if (!name.trim() || !pavilion.trim() || !phone.trim()) {
      alert('Пожалуйста, заполните все обязательные поля: Имя, Павильон, Телефон.');
      return;
    }
    
    // Проверка на то, что номер введен до конца маски
    if (phone.length < 18) {
      alert('Пожалуйста, введите полный номер телефона.');
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

  const handleOpenProModal = () => {
    setShowProModal(true);
  };

  const handleBuyPro = () => {
    const planName = selectedPlanModal === 'PRO' ? 'Расширенный (PRO) за 1800 руб/мес' : 'Базовый за 1000 руб/мес';
    const message = `Здравствуйте! 👋\n\nЯ хочу приобрести подписку "${planName}" для платформы SADOVODPS.\n\nМой ID в системе: ${user.id}`;
    const tgLink = `https://t.me/${PRO_MANAGER_TG}?text=${encodeURIComponent(message)}`;
    window.open(tgLink, '_blank');
    setShowProModal(false);
  };

  

 const handleSupportClick = () => {
    const message = `Здравствуйте! Мой ID: ${user?.id || 'Неизвестен'}. У меня возникла проблема:`;
    const tgLink = `https://t.me/${PRO_MANAGER_TG}?text=${encodeURIComponent(message)}`;
    window.open(tgLink, '_blank', 'noopener,noreferrer');
  };

  const getRegMethod = () => {
    if (user?.telegramId) return 'Telegram';
    if (user?.vkId) return 'ВКонтакте';
    return 'Почта';
  };

  // --- ЛОГИКА ТИПА ТАРИФА ---
  const isSubscriptionActive = user?.isPro && (!user?.proExpiresAt || new Date(user.proExpiresAt) > new Date());
  const planType = isSubscriptionActive ? user?.proPlanType?.toUpperCase() : 'FREE';
  const isAdvanced = planType?.includes('РАСШИРЕН') || planType === 'PRO';
  const isBasic = planType?.includes('БАЗОВ') || planType === 'BASIC';

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
      <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 pt-10 sm:p-8 shadow-xl relative overflow-hidden mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full pointer-events-none"></div>
        
        {/* ⚡ ПЛАШКА "САДОВОД SP" */}
        <div className="absolute top-0 left-0 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[10px] sm:text-xs font-black px-4 py-1.5 rounded-br-2xl shadow-lg shadow-green-500/20 uppercase tracking-widest z-20">
          SADOVODPS
        </div>

        {/* ⚡ КНОПКА ПОДДЕРЖКИ (Справа сверху) */}
        <button
          onClick={handleSupportClick}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 z-20 shadow-lg"
        >
          <MessageCircle size={14} className="sm:w-4 sm:h-4 shrink-0" />
          <span>Поддержка</span>
        </button>

        <div className="relative group shrink-0 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gray-900 rounded-full flex items-center justify-center border-4 border-gray-800 shadow-inner overflow-hidden transition-all group-hover:border-blue-500/50 mt-2 sm:mt-0">
            {previewUrl ? <img src={previewUrl} alt="Аватар" className="w-full h-full object-cover" /> : <User size={40} className="text-gray-500" />}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white" size={24} />
            </div>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
        </div>

        <div className="flex-1 text-center sm:text-left z-10 w-full min-w-0 mt-2 sm:mt-0">
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
            {isSubscriptionActive && (
              <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1.5">
                <Crown size={12} className="shrink-0" /> Тариф: {user.proPlanType?.toUpperCase().includes('БАЗОВ') || user.proPlanType === 'BASIC' ? 'Базовый' : 'Расширенный'} (осталось {Math.max(0, Math.ceil((new Date(user.proExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)))} дн.)
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

            {/* Баннер Тарифов */}
            <div className="lg:col-span-3 bg-gradient-to-r from-purple-900 to-indigo-900 border border-purple-500/30 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xl relative overflow-hidden mt-2 flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6">
              <div className="absolute -right-10 -top-10 w-32 h-32 sm:w-40 sm:h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10 text-center sm:text-left min-w-0">
                <h3 className="text-lg sm:text-2xl font-extrabold text-white mb-2 flex items-center justify-center sm:justify-start gap-2">
                  <Crown className={isSubscriptionActive ? "text-yellow-400" : "text-purple-400"} size={24} /> 
                  {isAdvanced ? 'У вас активен Расширенный тариф!' : isBasic ? 'У вас активен Базовый тариф!' : 'Расширьте лимиты с новыми тарифами'}
                </h3>
                <p className="text-gray-300 text-xs sm:text-base max-w-2xl leading-relaxed">
                  {isAdvanced 
                    ? 'Вам доступны максимальные лимиты (20 ВК / 8 ТГ), автопостинг и все премиум функции платформы.' 
                    : isBasic
                    ? 'Вам доступны лимиты (15 ВК / 5 ТГ). Хотите больше? Подключите Расширенный тариф (20 ВК / 8 ТГ) и снимите все ограничения!'
                    : 'Не хватает лимитов? Подключите Базовый или Расширенный тариф и управляйте до 20 аккаунтами ВК и 8 каналами Telegram!'}
                </p>
              </div>
              {!isAdvanced && (
                <button onClick={handleOpenProModal} className="relative z-10 shrink-0 bg-yellow-500 hover:bg-yellow-400 text-black px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-extrabold transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] active:scale-95 w-full sm:w-auto min-h-[48px]">
                  {isBasic ? 'Улучшить тариф' : 'Выбрать тариф'}
                </button>
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
                    maxLength={18}
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

      {/* === МОДАЛЬНОЕ ОКНО ОФОРМЛЕНИЯ ТАРИФА === */}
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
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-5 uppercase tracking-wide">Тарифы</h3>
              
              <div className="text-left mb-6 space-y-4">
                {/* Базовый тариф */}
                <div 
                  onClick={() => setSelectedPlanModal('BASIC')}
                  className={`p-4 sm:p-5 rounded-2xl cursor-pointer transition-all border ${selectedPlanModal === 'BASIC' ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-[#14171c] border-gray-800/80 hover:border-gray-600 shadow-inner'}`}
                >
                  <h4 className="text-lg sm:text-xl font-bold text-white mb-2 flex items-center justify-between">
                    <span>Базовый — <span className="text-emerald-500">1000 ₽ / мес</span></span>
                    {selectedPlanModal === 'BASIC' && <CheckCircle2 size={20} className="text-emerald-500" />}
                  </h4>
                  <ul className="text-gray-300 space-y-1.5 text-sm">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>До 15 аккаунтов ВКонтакте</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>До 5 каналов Telegram</li>
                  </ul>
                </div>

                {/* ПРО тариф */}
                <div 
                  onClick={() => setSelectedPlanModal('PRO')}
                  className={`p-4 sm:p-5 rounded-2xl relative overflow-hidden cursor-pointer transition-all border ${selectedPlanModal === 'PRO' ? 'bg-[#EAB308]/10 border-[#EAB308]/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-[#14171c] border-[#EAB308]/20 hover:border-[#EAB308]/40 shadow-inner'}`}
                >
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-[#EAB308] to-[#F59E0B] text-black text-[10px] font-bold px-2 py-1 rounded-bl-xl uppercase">PRO</div>
                  <h4 className="text-lg sm:text-xl font-bold text-white mb-2">Расширенный — <span className="text-[#EAB308]">1800 ₽ / мес</span></h4>
                  <ul className="text-gray-300 space-y-1.5 text-sm">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#EAB308] shrink-0"></span>До 20 аккаунтов ВКонтакте</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#EAB308] shrink-0"></span>До 8 каналов Telegram</li>
                  </ul>
                </div>
              </div>

              <div className="bg-[#14171c] border border-gray-800/80 p-4 rounded-2xl text-left mb-5 shadow-inner">
                <p className="text-gray-300 leading-relaxed text-[13px] sm:text-sm">
                  Оплата прямым переводом на карту. Нажмите кнопку ниже, чтобы получить реквизиты в Telegram. Подписка активируется <span className="text-[#10B981] font-bold">в течение суток</span>!
                </p>
              </div>
            </div>

            <button onClick={handleBuyPro} className="w-full bg-[#229ED9] hover:bg-[#1C87BA] text-white py-4 sm:py-5 rounded-2xl font-bold transition-all flex justify-center items-center gap-2 shadow-[0_4px_20px_rgba(34,158,217,0.3)] active:scale-95 text-base sm:text-lg">
              <Send size={22} className="shrink-0 -ml-1" /> Написать менеджеру
            </button>
          </div>
        </div>
      )}

    </div>
  );
}