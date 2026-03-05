import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Mail, Lock, User, Phone, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

// ИМПОРТ НАШЕЙ НОВОЙ КАСТОМНОЙ КНОПКИ ТЕЛЕГРАМ
import CustomTelegramButton from '../components/CustomTelegramButton';

export default function Auth() {
  const login = useStore((state) => state.login);
  const register = useStore((state) => state.register);
  const telegramLogin = useStore((state) => state.telegramLogin);
  const navigate = useNavigate();
  const location = useLocation();

  const [isLogin, setIsLogin] = useState(true);
  const [isVerification, setIsVerification] = useState(false); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(''); 
  const [code, setCode] = useState(''); 
  const vkLogin = useStore((state) => state.vkLogin);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // === ЛОГИКА ВКОНТАКТЕ ===
  const VK_APP_ID = '54471878'; // Вставили новый ID
  const REDIRECT_URI = 'https://smmdeck.ru/auth';

  const handleVkClick = () => {
    window.location.href = `https://oauth.vk.com/authorize?client_id=${VK_APP_ID}&display=page&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=email&response_type=code`;
  };

  // === ЛОГИКА TELEGRAM ===
  const handleTelegramAuth = async (telegramData) => {
    setIsLoading(true);
    setError('');
    const result = await telegramLogin(telegramData);
    
    if (result.success) {
      navigate('/'); 
    } else {
      setError(result.error || 'Ошибка авторизации через Telegram');
    }
    setIsLoading(false);
  };

  // === ИНТЕГРАЦИЯ VK ID LOW-CODE ===
  // === ИНТЕГРАЦИЯ VK ID LOW-CODE ===
  useEffect(() => {
    // 1. Создаем скрипт динамически
    const script = document.createElement('script');
    // Используем точную версию для стабильности
    script.src = 'https://unpkg.com/@vkid/sdk@3.0.0/dist-sdk/umd/index.js'; 
    script.async = true;
    document.body.appendChild(script);

    // 2. Когда скрипт загрузился, инициализируем виджет
    script.onload = () => {
      if ('VKIDSDK' in window) {
        const VKID = window.VKIDSDK;

        VKID.Config.init({
          app: 54471878,
          redirectUrl: 'https://smmdeck.ru/auth',
          responseMode: VKID.ConfigResponseMode.Callback, // Важно для работы без перезагрузки
          source: VKID.ConfigSource.LOWCODE,
          scope: 'email', // Запрашиваем email
        });

        const oAuth = new VKID.OAuthList();
        const container = document.getElementById('vk-oauth-container');

        if (container) {
          oAuth.render({
            container: container,
            oauthList: ['vkid'],
            // === НОВЫЕ ПАРАМЕТРЫ СТИЛИЗАЦИИ ВИДЖЕТА ===
            scheme: VKID.Scheme.DARK, // Темная тема
            styles: {
              height: 56,       // Высота виджета ровно 56px
              borderRadius: 28  // Делает виджет идеально круглым
            }
          })
          .on(VKID.WidgetEvents.ERROR, (error) => {
             console.error('VKID Ошибка виджета:', error);
             setError('Произошла ошибка при загрузке виджета ВК');
          })
          .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, function (payload) {
            setIsLoading(true);
            const code = payload.code;
            const deviceId = payload.device_id;

            // Фронтенд обменивает код на токены
            VKID.Auth.exchangeCode(code, deviceId)
              .then(async (data) => {
                // data содержит access_token, user_id и другие данные
                // Отправляем их в наш Zustand store
                const result = await useStore.getState().vkLogin(data);
                
                if (result.success) {
                  navigate('/'); // Успешный вход
                } else {
                  setError(result.error || 'Ошибка при входе через ВК');
                }
                setIsLoading(false);
              })
              .catch((error) => {
                console.error('Ошибка обмена кода ВК:', error);
                setError('Не удалось обменять код авторизации');
                setIsLoading(false);
              });
          });
        }
      }
    };

    // Очистка скрипта при размонтировании компонента (уходе со страницы)
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [navigate]);

    // Очистка при размонтировании компонента


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
      const res = await fetch('/api/auth/verify-email', {
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

        {/* === БЛОК СОЦСЕТЕЙ: КРУГЛЫЕ КНОПКИ === */}
        <div className="mt-8 pt-6 border-t border-gray-800">
          <p className="text-center text-xs text-gray-500 mb-5">Быстрый вход через соцсети</p>
          
          <div className="flex items-center justify-center gap-6">
            
            {/* КРУГЛАЯ КНОПКА ВК */}
            
            <div 
              id="vk-oauth-container" 
              className="w-14 h-14 shrink-0 rounded-full overflow-hidden shadow-lg hover:scale-105 transition-transform duration-300 flex items-center justify-center"
            ></div>
            
            {/* КРУГЛАЯ КНОПКА TELEGRAM */}
            {/* ВАЖНО: ЗАМЕНИ botId НА ЦИФРЫ ИЗ СВОЕГО ТОКЕНА */}
            <CustomTelegramButton 
              botId="8750764796" 
              onAuth={handleTelegramAuth} 
            />

          </div>
        </div>

      </div>
    </div>
  );
}