import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Mail, Lock, User, Phone, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

// ИМПОРТ НАШЕЙ КАСТОМНОЙ КНОПКИ ТЕЛЕГРАМ
import CustomTelegramButton from '../components/CustomTelegramButton';

export default function Auth() {
  const login = useStore((state) => state.login);
  const register = useStore((state) => state.register);
  const telegramLogin = useStore((state) => state.telegramLogin);
  const vkLogin = useStore((state) => state.vkLogin);
  const navigate = useNavigate();
  const location = useLocation();

  const [isLogin, setIsLogin] = useState(true);
  const [isVerification, setIsVerification] = useState(false); 
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAccepted, setIsAccepted] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(''); 
  const [code, setCode] = useState(''); 

  const VK_APP_ID = 54471878; 
  const REDIRECT_URI = 'https://smmdeck.ru/auth';

  // === 1. ПЕРЕХВАТ КОДА ОТ ВКОНТАКТЕ ===
// === ИНИЦИАЛИЗАЦИЯ VK ID (LOW-CODE) И ПЕРЕХВАТ ТОКЕНА ===
  useEffect(() => {
    const initVK = () => {
      const VKID = window.VKIDSDK;
      if (VKID) {
        VKID.Config.init({
          app: 54471878, // Ваш VK_APP_ID
          redirectUrl: 'https://smmdeck.ru/auth',
          responseMode: VKID.ConfigResponseMode.Callback, // Работает через виджет без перезагрузки
          source: VKID.ConfigSource.LOWCODE,
          scope: 'email',
        });

        const oAuth = new VKID.OAuthList();
        const container = document.getElementById('vk-oauth-container');

        if (container) {
          container.innerHTML = ''; // Очистка контейнера перед рендером
          oAuth.render({
            container: container,
            oauthList: ['vkid'],
            scheme: VKID.Scheme.DARK,
            styles: { height: 56, borderRadius: 28 }
          })
          .on(VKID.WidgetEvents.ERROR, (err) => {
            console.error("VK SDK ERROR:", err);
          })
          .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, (payload) => {
            setIsLoading(true);
            
            // 1. SDK ВК сам обменивает код из payload на access_token
            VKID.Auth.exchangeCode(payload.code, payload.device_id)
              .then(async (data) => {
                // data содержит готовый { access_token, user_id, email }
                
                // 2. Отправляем готовые данные на наш бэкенд
                const result = await vkLogin({
                  access_token: data.access_token,
                  user_id: data.user_id,
                  email: data.email || null
                });

                if (result.success) {
                  if (result.requiresEmailVerification) setIsVerification(true);
                  else navigate('/');
                } else {
                  setError(result.error || 'Ошибка входа через ВКонтакте');
                }
                setIsLoading(false);
              })
              .catch((err) => {
                console.error('Ошибка обмена токена ВК:', err);
                setError('Не удалось получить токен авторизации ВК');
                setIsLoading(false);
              });
          });
        }
      }
    };

    // Динамическая загрузка скрипта, если его еще нет
    if (!document.getElementById('vk-sdk-script')) {
      const script = document.createElement('script');
      script.id = 'vk-sdk-script';
      script.src = 'https://unpkg.com/@vkid/sdk@3.0.0/dist-sdk/umd/index.js';
      script.async = true;
      script.onload = initVK;
      document.body.appendChild(script);
    } else {
      initVK();
    }
  }, [navigate, vkLogin]);

  

  const handleTelegramAuth = async (telegramData) => {
    setIsLoading(true);
    setError('');
    const result = await telegramLogin(telegramData);
    if (result.success) navigate('/'); 
    else setError(result.error || 'Ошибка авторизации через Telegram');
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
      if (!result.success) setError(result.error);
      else setIsVerification(true); 
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
        useStore.setState({ user: data.user, token: data.token });
        localStorage.setItem('token', data.token);
        navigate('/'); 
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
    }
    setIsLoading(false);
  };

  if (isVerification) {
    return (
      <div className="min-h-[100dvh] bg-admin-bg flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="w-full max-w-md bg-admin-card border border-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl relative z-10 text-center">
          <ShieldCheck className="mx-auto text-blue-500 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-white mb-2">Подтверждение Email</h2>
          <p className="text-gray-400 text-sm mb-6">Мы отправили 6-значный код на <br/><span className="text-white font-medium">{email}</span></p>

          <form onSubmit={handleVerify} className="space-y-4">
            <input type="text" maxLength="6" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" required className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-4 text-center text-xl tracking-widest outline-none focus:border-blue-500 transition-colors" />
            {error && <p className="text-red-500 text-sm bg-red-500/10 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={isLoading || code.length !== 6} className="w-full font-bold py-4 rounded-xl transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-lg disabled:opacity-50">
              {isLoading ? 'Проверка...' : 'Завершить регистрацию'}
            </button>
            <button type="button" onClick={() => setIsVerification(false)} className="text-gray-400 hover:text-white text-sm mt-4 flex items-center justify-center gap-2 w-full"><ArrowLeft size={16} /> Вернуться назад</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-admin-bg flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-blue-500/10 blur-[100px] sm:blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-admin-card border border-gray-800 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl relative z-10">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wide text-white mb-1">SMM<span className="text-blue-500">BOXSS</span></h1>
          <p className="text-xs sm:text-sm text-gray-400">Панель управления автопостингом</p>
        </div>

        <div className="flex bg-gray-900 rounded-xl p-1 mb-5 sm:mb-6 border border-gray-800">
          <button type="button" onClick={() => { setIsLogin(true); setError(''); }} className={`flex-1 py-3 sm:py-2.5 rounded-lg text-sm font-bold transition-all ${isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>Вход</button>
          <button type="button" onClick={() => { setIsLogin(false); setError(''); }} className={`flex-1 py-3 sm:py-2.5 rounded-lg text-sm font-bold transition-all ${!isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>Регистрация</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {!isLogin && (
            <>
              <div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} /><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше Имя" required className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors" /></div>
              <div className="relative"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} /><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Номер телефона" className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors" /></div>
            </>
          )}
          <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors" /></div>
          <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} /><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" required className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3.5 pl-12 pr-12 outline-none focus:border-blue-500 transition-colors" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-2 transition-colors">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
          </div>

          {!isLogin && (
            <div className="flex items-start gap-3 mt-4 p-3 bg-gray-900/60 rounded-xl border border-gray-800">
              <input type="checkbox" id="privacy" checked={isAccepted} onChange={(e) => setIsAccepted(e.target.checked)} className="w-5 h-5 accent-blue-500 mt-0.5" required />
              <label htmlFor="privacy" className="text-xs text-gray-400 cursor-pointer select-none">Я согласен(на) с <Link to="/privacy" target="_blank" className="text-blue-500 hover:text-blue-400 underline">политикой конфиденциальности</Link>.</label>
            </div>
          )}

          {isLogin && <div className="text-right mt-1 mb-2"><Link to="/forgot-password" title="forgot" className="text-sm text-blue-500 hover:text-blue-400 font-medium">Забыли пароль?</Link></div>}
          {error && <p className="text-red-500 text-xs text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20">{error}</p>}
          
          <button type="submit" disabled={isLoading || (!isLogin && !isAccepted)} className="w-full font-bold py-4 rounded-xl transition-all mt-2 bg-blue-600 hover:bg-blue-500 text-white shadow-lg disabled:opacity-50">
            {isLoading ? 'Загрузка...' : (isLogin ? 'Войти по паролю' : 'Создать аккаунт')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800">
          <p className="text-center text-xs text-gray-500 mb-5">Быстрый вход через соцсети</p>
          <div className="flex items-center justify-center gap-8">
            
            {/* КРУГЛАЯ КНОПКА ВК */}
            <div className="relative w-14 h-14 hover:scale-105 transition-all duration-300">
              <div id="vk-oauth-container" className="absolute inset-0 flex items-center justify-center z-20"></div>
              <div className="absolute inset-0 bg-[#0077FF]/10 rounded-full border border-[#0077FF]/20 z-10"></div>
            </div>
            
            <CustomTelegramButton botId="8750764796" onAuth={handleTelegramAuth} />

          </div>
        </div>

      </div>
    </div>
  );
}