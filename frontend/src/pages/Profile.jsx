import { useState, useRef } from 'react';
import { useStore } from '../store';
import { 
  User, Mail, Shield, Crown, Edit2, Clock, Save, X, Hash, Camera, 
  Check, Copy, CalendarClock, CheckCircle2, AlertCircle, BarChart3, 
  Settings as SettingsIcon, LayoutDashboard, Lock, Zap, Eye, Share2, Phone, Key
} from 'lucide-react';

export default function Profile() {
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const updateUser = useStore((state) => state.updateUser);
  const requestEmailLink = useStore((state) => state.requestEmailLink);
  const verifyEmailLink = useStore((state) => state.verifyEmailLink);

  const fileInputRef = useRef(null);

  // Состояния
  const [activeTab, setActiveTab] = useState('overview'); 
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  
  // Данные формы
  const [name, setName] = useState(user?.name || '');
  const [pavilion, setPavilion] = useState(user?.pavilion || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(user?.avatarUrl || null);

  // Состояния для привязки Email
  const [realEmail, setRealEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState('');

  // === МОКОВЫЕ ДАННЫЕ ===
  const subscription = {
    plan: 'Базовый',
    daysLeft: 14,
    totalDays: 14, 
    postsUsed: 3,
    postsLimit: 50, 
  };

  const recentPosts = [
    { id: 1, text: 'Новая поставка кроссовок Nike...', status: 'published', date: 'Сегодня, 14:30', network: 'VK' },
    { id: 2, text: 'Скидки 50% на весь ассортимент...', status: 'scheduled', date: 'Завтра, 10:00', network: 'VK' },
    { id: 3, text: 'Обзор новинок этой недели...', status: 'error', date: 'Вчера, 18:00', network: 'TG' },
  ];
  // ======================

  if (!user) return null;

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
    setAvatarFile(null);
    setPreviewUrl(user?.avatarUrl || null);
  };

  const handleViewPost = (postId) => {
    alert(`Открытие подробностей поста #${postId}`);
  };

  const handleSharePost = (postId) => {
    alert(`Ссылка на пост #${postId} скопирована для партнеров!`);
  };

  // === ЛОГИКА ОТПРАВКИ И ПРОВЕРКИ КОДА НА ПОЧТУ ===
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setIsLinking(true);
    setLinkError('');
    const res = await requestEmailLink(user.id, realEmail);
    if (res.success) {
      setIsCodeSent(true);
    } else {
      setLinkError(res.error || 'Ошибка при отправке кода');
    }
    setIsLinking(false);
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setIsLinking(true);
    setLinkError('');
    const res = await verifyEmailLink(user.id, realEmail, verifyCode);
    if (res.success) {
      useStore.setState({ user: { ...user, email: realEmail } });
      setIsCodeSent(false);
      setRealEmail('');
      setVerifyCode('');
    } else {
      setLinkError(res.error || 'Неверный код подтверждения');
    }
    setIsLinking(false);
  };

  // Определяем способ регистрации
  const getRegMethod = () => {
    if (user?.telegramId) return 'Telegram';
    if (user?.vkId) return 'ВКонтакте';
    return 'Почта / Пароль';
  };

  const StatusBadge = ({ status }) => {
    const styles = {
      published: 'bg-green-500/10 text-green-500 border-green-500/20',
      scheduled: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      error: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    const icons = {
      published: <CheckCircle2 size={14} />,
      scheduled: <CalendarClock size={14} />,
      error: <AlertCircle size={14} />,
    };
    const labels = { published: 'Опубликовано', scheduled: 'Запланировано', error: 'Ошибка' };

    return (
      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${styles[status]}`}>
        {icons[status]} {labels[status]}
      </span>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-admin-bg p-4 sm:p-8 pb-24 md:pb-8 font-sans">
      
      {/* ПЛАШКА ПРИВЯЗКИ EMAIL ДЛЯ ТЕЛЕГРАМ-ЮЗЕРОВ */}
      {user?.email?.includes('@telegram.local') && (
        <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-3xl p-5 sm:p-6 mb-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-4">
              <div className="bg-red-500/20 p-3 rounded-full text-red-500 shrink-0">
                <AlertCircle size={28} />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-1">Ваш аккаунт уязвим!</h3>
                <p className="text-gray-400 text-sm">Привяжите реальную почту для восстановления пароля и получения уведомлений.</p>
              </div>
            </div>
            
            {!isCodeSent ? (
              <form onSubmit={handleRequestCode} className="flex flex-col sm:flex-row w-full lg:w-auto gap-3 shrink-0 mt-2 lg:mt-0">
                <div className="relative flex-1 sm:w-64">
                  <input 
                    type="email" 
                    value={realEmail}
                    onChange={(e) => setRealEmail(e.target.value)}
                    placeholder="Ваш реальный Email" 
                    required
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:border-red-500 outline-none transition-all"
                  />
                  {linkError && <p className="text-red-500 text-xs mt-1 absolute -bottom-5 left-0">{linkError}</p>}
                </div>
                <button 
                  type="submit" 
                  disabled={isLinking}
                  className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shrink-0"
                >
                  {isLinking ? 'Отправка...' : 'Получить код'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="flex flex-col sm:flex-row w-full lg:w-auto gap-3 shrink-0 mt-2 lg:mt-0">
                <div className="relative flex-1 sm:w-64">
                  <input 
                    type="text" 
                    maxLength="6"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Код из письма" 
                    required
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm text-center tracking-widest focus:border-green-500 outline-none transition-all"
                  />
                  {linkError && <p className="text-red-500 text-xs mt-1 absolute -bottom-5 left-0">{linkError}</p>}
                </div>
                <button 
                  type="submit" 
                  disabled={isLinking || verifyCode.length !== 6}
                  className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shrink-0"
                >
                  {isLinking ? 'Проверка...' : 'Подтвердить'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsCodeSent(false)} 
                  className="px-4 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Отмена
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ШАПКА ПРОФИЛЯ */}
      <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full pointer-events-none"></div>
        
        {/* Аватар */}
        <div className="relative group shrink-0 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="w-20 h-20 sm:w-28 sm:h-28 bg-gray-900 rounded-full flex items-center justify-center border-4 border-gray-800 shadow-inner overflow-hidden transition-all group-hover:border-blue-500/50">
            {previewUrl ? (
              <img src={previewUrl} alt="Аватар" className="w-full h-full object-cover" />
            ) : (
              <User size={40} className="text-gray-500" />
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white" size={24} />
            </div>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
        </div>

        {/* Инфо */}
        <div className="flex-1 text-center sm:text-left z-10 w-full">
          <h1 className="text-2xl font-bold text-white leading-tight mb-3">{user.name || 'Пользователь'}</h1>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 max-w-xl mx-auto sm:mx-0 bg-gray-900/50 p-4 rounded-2xl border border-gray-800/50">
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Mail size={14} className="text-gray-500" /> 
              <span className="text-gray-300">{user.email}</span>
            </p>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Phone size={14} className="text-gray-500" /> 
              <span className="text-gray-300">{user.phone || 'Не указан'}</span>
            </p>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Key size={14} className="text-gray-500" /> 
              <span className="text-gray-300">Вход через {getRegMethod()}</span>
            </p>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Hash size={14} className="text-gray-500" /> 
              <span className="text-gray-300">ID: {user.id}</span>
              <button onClick={handleCopyId} className="ml-1 hover:text-white transition-colors">
                {copiedId ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4">
            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5">
              <Shield size={12} /> {user.role === 'ADMIN' ? 'Администратор' : 'Пользователь'}
            </span>
            {user.pavilion && (
              <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-lg text-xs font-medium">
                📍 Павильон: {user.pavilion}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* МОБИЛЬНЫЕ ВКЛАДКИ */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 border-b border-gray-800 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-900/50 text-gray-400 hover:text-white hover:bg-gray-800'}`}>
          <LayoutDashboard size={18} /> Обзор
        </button>
        <button onClick={() => setActiveTab('posts')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${activeTab === 'posts' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-900/50 text-gray-400 hover:text-white hover:bg-gray-800'}`}>
          <BarChart3 size={18} /> Мои посты
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-900/50 text-gray-400 hover:text-white hover:bg-gray-800'}`}>
          <SettingsIcon size={18} /> Настройки
        </button>
      </div>

      {/* СОДЕРЖИМОЕ ВКЛАДОК */}
      <div className="space-y-6">
        
        {/* === ВКЛАДКА: ОБЗОР === */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            
            {/* Карточка Базового Тарифа */}
            <div className="lg:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Zap className="text-blue-500" size={24} /> Тариф {subscription.plan}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">Стартовые лимиты. Идеально для начала.</p>
                </div>
                <button className="w-full sm:w-auto bg-gradient-to-r from-yellow-600/20 to-orange-600/20 hover:from-yellow-500/30 hover:to-orange-500/30 text-yellow-500 border border-yellow-500/30 px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2 shadow-lg shadow-yellow-500/5">
                  <Crown size={16} /> Перейти на PRO
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Осталось дней:</span>
                    <span className="font-bold text-white">{subscription.daysLeft} из {subscription.totalDays}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden border border-gray-700">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2.5 rounded-full" style={{ width: `${(subscription.daysLeft / subscription.totalDays) * 100}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Лимит постов (в месяц):</span>
                    <span className="font-bold text-white">{subscription.postsUsed} / {subscription.postsLimit}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden border border-gray-700">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2.5 rounded-full" style={{ width: `${(subscription.postsUsed / subscription.postsLimit) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Быстрая статистика */}
            <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-center">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Статистика</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded-2xl border border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/10 p-2 rounded-xl text-blue-500"><CalendarClock size={20} /></div>
                    <span className="text-sm font-medium text-white">В очереди</span>
                  </div>
                  <span className="text-lg font-bold text-white">1</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded-2xl border border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500/10 p-2 rounded-xl text-green-500"><CheckCircle2 size={20} /></div>
                    <span className="text-sm font-medium text-white">Опубликовано</span>
                  </div>
                  <span className="text-lg font-bold text-white">{subscription.postsUsed}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === ВКЛАДКА: МОИ ПОСТЫ === */}
        {activeTab === 'posts' && (
          <div className="bg-admin-card border border-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Недавние посты</h2>
              <button className="text-sm text-blue-500 hover:text-white transition-colors">Смотреть все</button>
            </div>
            
            <div className="space-y-4">
              {recentPosts.map((post) => (
                <div key={post.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-gray-900 hover:bg-gray-800 transition-colors rounded-2xl border border-gray-800 group">
                  <div className="flex items-start gap-4 overflow-hidden w-full sm:w-auto flex-1">
                    <div className="w-10 h-10 shrink-0 bg-gray-800 rounded-xl flex items-center justify-center text-sm font-bold text-gray-400 border border-gray-700">
                      {post.network}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-medium truncate">{post.text}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={12} /> {post.date}
                        </p>
                        <StatusBadge status={post.status} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-3 sm:pt-0 border-t border-gray-800 sm:border-t-0 sm:ml-auto w-full sm:w-auto justify-end shrink-0">
                    <button 
                      onClick={() => handleViewPost(post.id)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition-all active:scale-95"
                    >
                      <Eye size={14} /> <span className="sm:hidden md:block">Подробнее</span>
                    </button>
                    <button 
                      onClick={() => handleSharePost(post.id)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl text-xs font-bold transition-all active:scale-95 border border-blue-500/10"
                    >
                      <Share2 size={14} /> <span className="sm:hidden md:block">Партнерам</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === ВКЛАДКА: НАСТРОЙКИ === */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            
            {/* Редактирование профиля */}
            <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                <Edit2 size={18} className="text-blue-500" /> Основные данные
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block font-medium uppercase tracking-wider">Имя и Фамилия</label>
                  <input type="text" value={name} onChange={(e) => {setName(e.target.value); setIsEditing(true);}} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block font-medium uppercase tracking-wider">Рабочий Павильон</label>
                  <input type="text" value={pavilion} onChange={(e) => {setPavilion(e.target.value); setIsEditing(true);}} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none transition-all" />
                </div>
                
                {isEditing && (
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50">
                      {isSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button onClick={cancelEdit} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors">
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Безопасность и выход */}
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl">
                <h2 className="text-lg font-bold text-white mb-4">Безопасность</h2>
                <button className="w-full flex items-center justify-between p-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl transition-colors text-left group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-800 group-hover:bg-gray-700 rounded-full flex items-center justify-center">
                      <Lock size={18} className="text-gray-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">Изменить пароль</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl">
                <p className="text-xs text-gray-500 mb-4 text-center">Зарегистрирован: {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : 'Недавно'}</p>
                <button onClick={() => logout()} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-3 rounded-xl text-sm font-bold transition-colors flex justify-center items-center gap-2">
                  Выйти из аккаунта
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}