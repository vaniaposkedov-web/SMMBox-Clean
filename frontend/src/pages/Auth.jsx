import { useState } from 'react';
import { useStore } from '../store';
import { Mail, Lock, User, Phone, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

// ДОБАВЛЕН ИМПОРТ КНОПКИ ТЕЛЕГРАМ
import TelegramLoginButton from '../components/TelegramLoginButton';

export default function Auth() {
  const login = useStore((state) => state.login);
  const register = useStore((state) => state.register);
  // ДОСТАЕМ МЕТОД АВТОРИЗАЦИИ ТЕЛЕГРАМ ИЗ STORE
  const telegramLogin = useStore((state) => state.telegramLogin);
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [isVerification, setIsVerification] = useState(false); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(''); 
  const [code, setCode] = useState(''); 

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // === ЛОГИКА ВКОНТАКТЕ ===
  const VK_APP_ID = '54470861'; 
  const REDIRECT_URI = 'https://felicia-semivulcanized-leatha.ngrok-free.dev/auth';

  const handleVkClick = () => {
    window.location.href = `https://oauth.vk.com/authorize?client_id=${VK_APP_ID}&display=page&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=email&response_type=code`;
  };

  // === ДОБАВЛЕНА ЛОГИКА TELEGRAM ===
  const handleTelegramAuth = async (telegramData) => {
    setIsLoading(true);
    setError('');
    const result = await telegramLogin(telegramData);
    
    if (result.success) {
      navigate('/'); // Успешный вход — пускаем в систему
    } else {
      setError(result.error || 'Ошибка авторизации через Telegram');
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLogin && !isAccepted) return;
    setError('');
    setIsLoading(true);

    if (isLogin) {
      const result = await login(email, password);
      if (!result.success) setError(result.error);
      else navigate('/'); 
    } else {
      const result = await register(email, password, name, phone);
      if (!result.success) {
        setError(result.error);
      } else {
        setIsVerification(true); 
      }
    }
    setIsLoading(false);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка проверки кода');
      } else {
        useStore.setState({ user: data.user, token: data.token, isAuthenticated: true });
        localStorage.setItem('token', data.token);
        navigate('/'); 
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
    }
    setIsLoading(false);
  };

  // === ИНТЕРФЕЙС ВВОДА КОДА ===
  if (isVerification) {
    return (
      <div className="min-h-[100dvh] bg-admin-bg flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="w-full max-w-md bg-admin-card border border-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl relative z-10 text-center">
          <ShieldCheck className="mx-auto text-blue-500 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-white mb-2">Подтверждение Email</h2>
          <p className="text-gray-400 text-sm mb-6">
            Мы отправили 6-значный код на <br/><span className="text-white font-medium">{email}</span>
          </p>

          <form onSubmit={handleVerify} className="space-y-4">
            <input 
              type="text" 
              maxLength="6"
              value={code} 
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} 
              placeholder="Введите код (например 123456)" 
              required 
              className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-4 text-center text-xl tracking-widest outline-none focus:border-blue-500 transition-colors" 
            />
            {error && <p className="text-red-500 text-sm bg-red-500/10 py-2 rounded-lg">{error}</p>}
            
            <button 
              type="submit"
              disabled={isLoading || code.length !== 6} 
              className="w-full font-bold py-4 rounded-xl transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-lg disabled:opacity-50"
            >
              {isLoading ? 'Проверка...' : 'Завершить регистрацию'}
            </button>
            <button 
              type="button"
              onClick={() => setIsVerification(false)}
              className="text-gray-400 hover:text-white text-sm mt-4 flex items-center justify-center gap-2 w-full"
            >
              <ArrowLeft size={16} /> Вернуться назад
            </button>
          </form>
        </div>
      </div>
    );
  }

  // === ОСНОВНОЙ ИНТЕРФЕЙС ===
  return (
    <div className="min-h-[100dvh] bg-admin-bg flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-blue-500/10 blur-[100px] sm:blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-admin-card border border-gray-800 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl relative z-10">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wide text-white mb-1">
            SMM<span className="text-blue-500">BOXSS</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400">Панель управления автопостингом</p>
        </div>

        <div className="flex bg-gray-900 rounded-xl p-1 mb-5 sm:mb-6 border border-gray-800">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-3 sm:py-2.5 rounded-lg text-sm font-bold transition-all ${isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-3 sm:py-2.5 rounded-lg text-sm font-bold transition-all ${!isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          
          {!isLogin && (
            <>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Ваше Имя" 
                  required 
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors" 
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="Номер телефона" 
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors" 
                />
              </div>
            </>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="Email" 
              required 
              className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors" 
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input 
              type={showPassword ? "text" : "password"} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Пароль" 
              required 
              className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3.5 pl-12 pr-12 outline-none focus:border-blue-500 transition-colors" 
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-2 transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {!isLogin && (
            <div className="flex items-start gap-3 mt-4 p-3 bg-gray-900/60 rounded-xl border border-gray-800">
              <div className="flex items-center h-5 mt-0.5">
                <input 
                  type="checkbox" 
                  id="privacy"
                  checked={isAccepted}
                  onChange={(e) => setIsAccepted(e.target.checked)}
                  className="w-5 h-5 accent-blue-500"
                  required
                />
              </div>
              <label htmlFor="privacy" className="text-xs text-gray-400 cursor-pointer select-none">
                Я согласен(на) с{' '}
                <Link to="/privacy" target="_blank" className="text-blue-500 hover:text-blue-400 underline">
                  политикой конфиденциальности
                </Link>.
              </label>
            </div>
          )}

          {isLogin && (
            <div className="text-right mt-1 mb-2">
              <Link to="/forgot-password" className="text-sm text-blue-500 hover:text-blue-400 font-medium">
                Забыли пароль?
              </Link>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-xs text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20">
              {error}
            </p>
          )}

          <button 
            type="submit"
            disabled={isLoading || (!isLogin && !isAccepted)} 
            className="w-full font-bold py-4 rounded-xl transition-all mt-2 bg-blue-600 hover:bg-blue-500 text-white shadow-lg disabled:opacity-50"
          >
            {isLoading ? 'Загрузка...' : (isLogin ? 'Войти по паролю' : 'Создать аккаунт')}
          </button>
        </form>

        {/* КНОПКИ СОЦСЕТЕЙ */}
        <div className="mt-6 pt-6 border-t border-gray-800">
          <p className="text-center text-xs text-gray-500 mb-4">Или войдите через соцсети</p>
          <div className="flex flex-col gap-3">
            {/* ДОБАВЛЕНО onClick={handleVkClick} */}
            <button type="button" onClick={handleVkClick} className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-[#0077FF]/10 text-[#0077FF] hover:bg-[#0077FF] hover:text-white border border-[#0077FF]/20 font-medium transition-all">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.162 18.994c.609 0 .858-.406.851-.915-.031-1.917.714-2.949 2.059-1.604 1.488 1.488 1.796 2.519 3.603 2.519h3.2c.808 0 1.126-.26 1.126-.668 0-.863-1.533-2.825-2.852-4.22-.711-.753-.922-1.218-.178-2.43 1.086-1.76 2.519-4.136 2.519-5.402 0-.739-.39-1.082-1.187-1.082h-3.465c-.773 0-1.146.311-1.46.741-1.203 2.003-2.247 3.678-3.869 3.678-.512 0-.826-.189-.826-2.035 0-2.305.437-3.546-1.057-3.906-.681-.164-1.376-.233-2.853-.233-1.979 0-3.047.521-3.047 1.402 0 .522.547.74 1.171.843 1.33.221 1.531 1.082 1.531 2.888 0 2.214-.42 2.804-1.144 2.804-1.558 0-3.328-2.015-4.636-4.052-.403-.631-.76-1.008-1.543-1.008H.47c-.966 0-1.256.32-1.256.772 0 .682.892 2.75 4.144 7.281 2.735 3.791 5.98 5.627 9.804 5.627Z"/>
              </svg>
              ВКонтакте
            </button>
            
            {/* ИЗМЕНЕНА КНОПКА TELEGRAM НА НАШ КОМПОНЕНТ ВИДЖЕТА */}
            <div className="w-full flex justify-center py-1">
              <TelegramLoginButton 
                botName="smmbox_auth_bot" 
                onAuth={handleTelegramAuth} 
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}