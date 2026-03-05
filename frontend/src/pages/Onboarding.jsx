import { useState } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, X, Mail, Phone } from 'lucide-react';

export default function Onboarding() {
  const user = useStore(state => state.user);
  const navigate = useNavigate();
  
  // Шаги: 'welcome' -> 'choice' -> 'vk_setup' | 'tg_setup' -> 'offer_second' -> 'contacts' -> 'verify'
  const [step, setStep] = useState('welcome');
  const [firstChoice, setFirstChoice] = useState(null);
  
  // Состояния для форм
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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 relative">
      {/* Кнопка выхода в любой момент */}
      <button onClick={finishOnboarding} className="absolute top-6 right-6 text-gray-400 hover:text-white flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-xl transition-colors">
        <span>Пропустить настройку</span> <X size={18} />
      </button>

      <div className="max-w-2xl w-full bg-gray-800 rounded-3xl p-8 shadow-2xl">
        
        {/* ШАГ 1: ПРИВЕТСТВИЕ И ВЫБОР */}
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <h1 className="text-3xl font-bold text-white">Добро пожаловать! 👋</h1>
            <p className="text-gray-400 text-lg">Подключите каналы для автопостинга.</p>
            <div className="grid grid-cols-2 gap-4 mt-8">
               <button onClick={() => { setFirstChoice('vk'); setStep('vk_setup'); }} className="bg-blue-600 hover:bg-blue-500 transition-colors p-6 rounded-2xl text-white font-bold text-lg flex flex-col items-center gap-2">
                 ВКонтакте
               </button>
               <button onClick={() => { setFirstChoice('tg'); setStep('tg_setup'); }} className="bg-sky-500 hover:bg-sky-400 transition-colors p-6 rounded-2xl text-white font-bold text-lg flex flex-col items-center gap-2">
                 Telegram
               </button>
            </div>
          </div>
        )}

        {/* ШАГ 2a: НАСТРОЙКА ВК */}
        {step === 'vk_setup' && (
          <div className="space-y-6 text-center">
            <h2 className="text-2xl font-bold text-white">Настройка ВКонтакте</h2>
            <p className="text-gray-400">Предоставьте доступ для публикации в ваших группах.</p>
            
            {/* СЮДА ВСТАВИТЬ ЛОГИКУ КНОПКИ "ПОЛУЧИТЬ КЛЮЧ ВК" ИЗ AccountsManager */}
            <div className="bg-gray-900 p-6 rounded-2xl border border-gray-700 text-gray-500 text-sm">
              [Место для кнопки привязки токена ВК]
            </div>

            <button onClick={() => setStep(firstChoice === 'vk' ? 'offer_second' : 'contacts')} className="mt-6 w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
              Продолжить <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* ШАГ 2b: НАСТРОЙКА TG */}
        {step === 'tg_setup' && (
          <div className="space-y-6 text-center">
            <h2 className="text-2xl font-bold text-white">Настройка Telegram</h2>
            <p className="text-gray-400">Добавьте нашего бота в администраторы вашего канала.</p>
            
            {/* СЮДА ВСТАВИТЬ ЛОГИКУ ПОДКЛЮЧЕНИЯ TG ИЗ AccountsManager */}
            <div className="bg-gray-900 p-6 rounded-2xl border border-gray-700 text-gray-500 text-sm">
              [Место для ввода @username канала]
            </div>

            <button onClick={() => setStep(firstChoice === 'tg' ? 'offer_second' : 'contacts')} className="mt-6 w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
              Продолжить <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* ШАГ 3: ПРЕДЛОЖЕНИЕ ВТОРОЙ СЕТИ */}
        {step === 'offer_second' && (
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold text-white">Отлично!</h2>
            <p className="text-gray-400">Хотите сразу подключить {firstChoice === 'vk' ? 'Telegram' : 'ВКонтакте'}?</p>
            <div className="flex gap-4">
              <button onClick={() => setStep(firstChoice === 'vk' ? 'tg_setup' : 'vk_setup')} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-xl">
                Да, подключить
              </button>
              <button onClick={() => setStep('contacts')} className="flex-1 bg-gray-700 text-white font-bold py-4 rounded-xl">
                Позже
              </button>
            </div>
          </div>
        )}

        {/* ШАГ 4: КОНТАКТЫ */}
        {step === 'contacts' && (
          <div className="space-y-6 text-center">
            <h2 className="text-2xl font-bold text-white">Безопасность профиля</h2>
            <p className="text-gray-400">Укажите контакты для защиты аккаунта и уведомлений.</p>
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ваш Email" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-4 pl-12 pr-4 outline-none focus:border-blue-500" />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Номер телефона (опционально)" className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-4 pl-12 pr-4 outline-none focus:border-blue-500" />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-white text-black font-bold py-4 rounded-xl mt-4">
                {loading ? 'Отправка...' : 'Получить код подтверждения'}
              </button>
            </form>
          </div>
        )}

        {/* ШАГ 5: ПРОВЕРКА КОДА */}
        {step === 'verify' && (
          <div className="space-y-6 text-center">
            <ShieldCheck className="mx-auto text-blue-500" size={48} />
            <h2 className="text-2xl font-bold text-white">Введите код</h2>
            <p className="text-gray-400">Код отправлен на {email}</p>
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <input type="text" maxLength="6" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-4 text-center text-2xl tracking-widest outline-none focus:border-blue-500" />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading || code.length !== 6} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl">
                {loading ? 'Проверка...' : 'Завершить настройку'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}