import { useState } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, X, Mail, Phone, Send, Info, CheckCircle2 } from 'lucide-react';

export default function Onboarding() {
  const user = useStore(state => state.user);
  const navigate = useNavigate();
  
  // Шаги: 'welcome' -> 'choice' -> 'vk_setup' | 'tg_setup' -> 'offer_second' -> 'contacts' -> 'verify'
  const [step, setStep] = useState('welcome');
  const [firstChoice, setFirstChoice] = useState(null);
  
  // Состояния для форм
  const [tgChannel, setTgChannel] = useState(''); // <--- Новое состояние для поля ТГ
  const [email, setEmail] = useState(user?.email && !user.email.includes('.local') ? user.email : '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Завершение онбординга
  const finishOnboarding = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/complete-onboarding', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success) {
        useStore.setState({ user: data.user });
        navigate('/profile');
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // Отправка кода на почту
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/request-link-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email })
      });
      const data = await res.json();
      if (data.success) setStep('verify');
      else setError(data.error);
    } catch (err) {
      setError('Ошибка соединения');
    }
    setLoading(false);
  };

  // Проверка кода почты
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-link-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email, code, phone })
      });
      const data = await res.json();
      if (data.success) finishOnboarding();
      else setError(data.error);
    } catch (err) {
      setError('Ошибка соединения');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] bg-admin-bg flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* КРАСИВЫЙ ФОН С БЛЮРОМ (Стиль проекта) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] bg-blue-600/10 blur-[100px] sm:blur-[130px] rounded-full pointer-events-none"></div>

      {/* Кнопка выхода */}
      <button onClick={finishOnboarding} className="absolute top-6 right-6 text-gray-400 hover:text-white flex items-center gap-2 bg-gray-900/50 backdrop-blur-md border border-gray-800 px-4 py-2.5 rounded-xl transition-all z-20 hover:bg-gray-800">
        <span className="text-sm font-medium">Пропустить настройку</span> <X size={16} />
      </button>

      {/* ГЛАВНАЯ КАРТОЧКА (Glassmorphism) */}
      <div className="w-full max-w-xl bg-admin-card/60 backdrop-blur-2xl border border-gray-800/60 p-8 sm:p-10 rounded-3xl shadow-2xl relative z-10">
        
        {/* ШАГ 1: ПРИВЕТСТВИЕ И ВЫБОР */}
        {step === 'welcome' && (
          <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Добро пожаловать! 👋</h1>
            <p className="text-gray-400 text-base sm:text-lg">Давайте подключим ваши первые каналы для автоматической публикации постов.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-4">
               <button onClick={() => { setFirstChoice('vk'); setStep('vk_setup'); }} className="group relative overflow-hidden bg-[#0077FF]/10 hover:bg-[#0077FF]/20 border border-[#0077FF]/30 transition-all p-6 rounded-2xl text-[#0077FF] font-bold text-lg flex flex-col items-center gap-3">
                 <div className="w-12 h-12 bg-[#0077FF] text-white rounded-xl flex items-center justify-center shadow-lg shadow-[#0077FF]/30 group-hover:scale-110 transition-transform">
                    <span className="text-2xl font-black">K</span>
                 </div>
                 ВКонтакте
               </button>
               <button onClick={() => { setFirstChoice('tg'); setStep('tg_setup'); }} className="group relative overflow-hidden bg-[#0088CC]/10 hover:bg-[#0088CC]/20 border border-[#0088CC]/30 transition-all p-6 rounded-2xl text-[#0088CC] font-bold text-lg flex flex-col items-center gap-3">
                 <div className="w-12 h-12 bg-[#0088CC] text-white rounded-xl flex items-center justify-center shadow-lg shadow-[#0088CC]/30 group-hover:scale-110 transition-transform">
                    <Send size={24} className="ml-1" />
                 </div>
                 Telegram
               </button>
            </div>
          </div>
        )}

        {/* ШАГ 2a: НАСТРОЙКА ВК */}
        {step === 'vk_setup' && (
          <div className="space-y-6 text-center animate-in fade-in slide-in-from-right-8 duration-500">
            <h2 className="text-2xl font-bold text-white">Подключение ВКонтакте</h2>
            <p className="text-gray-400 text-sm">Предоставьте доступ, чтобы система могла публиковать посты от вашего имени или в ваших группах.</p>
            
            {/* Заглушка под ВК */}
            <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-dashed border-gray-700 text-gray-500 text-sm my-8">
              [Здесь скоро появится кнопка подключения ВК]
            </div>

            <button onClick={() => setStep(firstChoice === 'vk' ? 'offer_second' : 'contacts')} className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors shadow-lg shadow-white/10">
              Продолжить <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* ШАГ 2b: НАСТРОЙКА TG (С ИНСТРУКЦИЕЙ) */}
        {step === 'tg_setup' && (
          <div className="space-y-6 text-left animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">Подключение Telegram</h2>
              <p className="text-gray-400 text-sm mt-2">Следуйте инструкции, чтобы привязать ваш канал.</p>
            </div>
            
            {/* Блок с инструкцией */}
            <div className="bg-[#0088CC]/10 border border-[#0088CC]/20 rounded-2xl p-5 space-y-3">
              <h3 className="text-[#0088CC] font-semibold flex items-center gap-2 mb-2">
                <Info size={18} /> Как подключить канал:
              </h3>
              <ol className="list-decimal list-inside text-gray-300 text-sm space-y-2.5 ml-1">
                <li>Откройте настройки вашего канала в Telegram.</li>
                <li>Перейдите в раздел <b>Администраторы</b>.</li>
                <li>Добавьте нашего бота <span className="bg-gray-900 px-2 py-0.5 rounded text-white font-mono text-xs">@ИмяВашегоБота</span> в список админов.</li>
                <li>Выдайте боту права на <b>публикацию сообщений</b>.</li>
                <li>Вставьте ссылку на канал ниже.</li>
              </ol>
            </div>

            {/* Рабочее поле ввода */}
            <div className="space-y-2 mt-6">
              <label className="text-sm font-medium text-gray-400 ml-1">Ссылка на канал или @username</label>
              <input 
                type="text" 
                value={tgChannel}
                onChange={(e) => setTgChannel(e.target.value)}
                placeholder="Например: t.me/tes_bota_haha" 
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-4 px-4 outline-none focus:border-[#0088CC] transition-colors placeholder:text-gray-600"
              />
            </div>

            <button 
              onClick={() => {
                // Здесь позже добавим логику сохранения канала в базу
                console.log("Сохраняем ТГ канал:", tgChannel);
                setStep(firstChoice === 'tg' ? 'offer_second' : 'contacts');
              }} 
              disabled={!tgChannel.trim()}
              className="mt-6 w-full bg-[#0088CC] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#0077b3] disabled:opacity-50 disabled:hover:bg-[#0088CC] transition-colors shadow-lg shadow-[#0088CC]/20"
            >
              Подтвердить и продолжить <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* ШАГ 3: ПРЕДЛОЖЕНИЕ ВТОРОЙ СЕТИ */}
        {step === 'offer_second' && (
          <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white">Канал успешно добавлен!</h2>
            <p className="text-gray-400">Хотите сразу настроить интеграцию с {firstChoice === 'vk' ? 'Telegram' : 'ВКонтакте'}?</p>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button onClick={() => setStep(firstChoice === 'vk' ? 'tg_setup' : 'vk_setup')} className="flex-1 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20">
                Да, настроить
              </button>
              <button onClick={() => setStep('contacts')} className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors text-white font-bold py-4 rounded-xl">
                Сделаю позже
              </button>
            </div>
          </div>
        )}

        {/* ШАГ 4: КОНТАКТЫ */}
        {step === 'contacts' && (
          <div className="space-y-6 text-center animate-in fade-in slide-in-from-right-8 duration-500">
            <h2 className="text-2xl font-bold text-white">Безопасность профиля</h2>
            <p className="text-gray-400 text-sm mb-6">Укажите контакты для защиты аккаунта, восстановления пароля и важных уведомлений.</p>
            
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ваш реальный Email" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Номер телефона (опционально)" className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors" />
              </div>
              
              {error && <p className="text-red-400 bg-red-400/10 py-2 rounded-lg border border-red-400/20 text-sm">{error}</p>}
              
              <button type="submit" disabled={loading} className="w-full bg-white text-black font-bold py-4 rounded-xl mt-4 hover:bg-gray-200 transition-colors shadow-lg shadow-white/10">
                {loading ? 'Отправка кода...' : 'Получить код подтверждения'}
              </button>
            </form>
          </div>
        )}

        {/* ШАГ 5: ПРОВЕРКА КОДА */}
        {step === 'verify' && (
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-500">
            <ShieldCheck className="mx-auto text-blue-500" size={48} />
            <h2 className="text-2xl font-bold text-white">Введите код</h2>
            <p className="text-gray-400">Шестизначный код отправлен на <br/><span className="text-white font-medium">{email}</span></p>
            
            <form onSubmit={handleVerifyCode} className="space-y-4 pt-2">
              <input type="text" maxLength="6" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-4 text-center text-3xl tracking-widest outline-none focus:border-blue-500 transition-colors" />
              
              {error && <p className="text-red-400 bg-red-400/10 py-2 rounded-lg border border-red-400/20 text-sm">{error}</p>}
              
              <button type="submit" disabled={loading || code.length !== 6} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20">
                {loading ? 'Проверка...' : 'Завершить настройку'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}