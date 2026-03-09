import { useState } from 'react';
import { useStore } from '../store';
import { Mail, Lock, User, Phone, Eye, EyeOff, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

// ИМПОРТИРУЕМ НАШИ КНОПКИ СОЦСЕТЕЙ
import CustomTelegramButton from '../components/CustomTelegramButton';
import CustomVkButton from '../components/CustomVkButton';

export default function Auth() {
  const login = useStore((state) => state.login);
  const register = useStore((state) => state.register);
  const telegramLogin = useStore((state) => state.telegramLogin);
  const vkLogin = useStore((state) => state.vkLogin);
  const navigate = useNavigate();

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

  // === ФУНКЦИЯ ФОРМАТИРОВАНИЯ НОМЕРА ТЕЛЕФОНА ===
  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) { 
      setPhone(''); 
      return; 
    }
    let num = val;
    if (val.startsWith('7') || val.startsWith('8')) num = val.slice(1);
    
    let formatted = '+7';
    if (num.length > 0) formatted += ' (' + num.substring(0, 3);
    if (num.length >= 4) formatted += ') ' + num.substring(3, 6);
    if (num.length >= 7) formatted += '-' + num.substring(6, 8);
    if (num.length >= 9) formatted += '-' + num.substring(8, 10);
    
    setPhone(formatted);
  };

  // === ЛОГИКА АВТОРИЗАЦИИ ЧЕРЕЗ STATE ===
  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const result = await login(email, password);
        if (result.success) {
          navigate('/profile');
        } else {
          // ЕСЛИ СЕРВЕР ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ
          if (result.error === 'EMAIL_NOT_VERIFIED') {
            setIsVerification(true);
            setError('Почта не подтверждена. Мы отправили вам новый код.');
          } else {
            setError(result.error || 'Ошибка входа');
          }
        }
      } else {
        if (!isAccepted) {
          setError('Необходимо согласие с политикой конфиденциальности');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Пароль должен быть не менее 6 символов');
          setIsLoading(false);
          return;
        }
        if (phone && phone.length < 18) {
          setError('Пожалуйста, введите номер телефона полностью');
          setIsLoading(false);
          return;
        }

        const result = await register(email, password, name, phone);
        if (result.success) {
          setIsVerification(true); 
        } else {
          setError(result.error || 'Ошибка регистрации');
        }
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
    }
    setIsLoading(false);
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const verifyEmailCode = useStore.getState().verifyEmailCode;
      const result = await verifyEmailCode(email, code);
      if (result.success) {
        navigate('/onboarding'); // Код верный! Пускаем в систему
      } else {
        setError(result.error || 'Неверный код');
      }
    } catch(err) {
      setError('Ошибка соединения');
    }
    setIsLoading(false);
  };

  // === ОБРАБОТКА ВХОДА ЧЕРЕЗ СОЦСЕТИ ===
  const handleTelegramResponse = async (tgUser) => {
    setIsLoading(true);
    const result = await telegramLogin(tgUser);
    setIsLoading(false);
    if (result.success) {
       navigate(result.isNewUser ? '/onboarding' : '/profile');
    } else {
       setError(result.error || 'Ошибка авторизации через Telegram');
    }
  };

  const handleVkResponse = async (vkData) => {
    setIsLoading(true);
    const result = await vkLogin(vkData);
    setIsLoading(false);
    if (result.success) {
       navigate(result.isNewUser ? '/onboarding' : '/profile');
    } else {
       setError(result.error || 'Ошибка авторизации через ВКонтакте');
    }
  };

  if (isVerification) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-admin-bg p-4 sm:p-6 font-sans relative overflow-y-auto">
        {/* Фоновые эффекты */}
        <div className="absolute top-1/4 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-blue-600/20 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-purple-600/20 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-admin-card border border-gray-800 rounded-[2rem] sm:rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300">
          <button onClick={() => setIsVerification(false)} className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-colors min-h-[44px] -ml-2 px-2 rounded-lg">
            <ArrowLeft size={20} /> <span className="text-sm font-medium">Назад</span>
          </button>
          <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6">
            <ShieldCheck size={28} />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Подтверждение</h2>
          <p className="text-sm text-gray-400 mb-6 sm:mb-8 leading-relaxed">
            Мы отправили код на вашу почту <span className="text-white font-medium">{email}</span>
          </p>

          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <div className="relative">
              <input 
                type="text" 
                value={code} 
                onChange={(e) => setCode(e.target.value)} 
                placeholder="Введите 6-значный код" 
                className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 sm:py-4 px-4 text-center tracking-[0.5em] text-base sm:text-lg text-white focus:outline-none focus:border-blue-500 transition-colors min-h-[52px]"
                maxLength="6"
              />
            </div>
            <div className="min-h-[48px] flex flex-col justify-end mt-2">
            {error ? (
              <p className="text-red-500 text-xs text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20 animate-in fade-in">{error}</p>
            ) : null}
          </div>
          
          <button type="submit" disabled={isLoading || (!isLogin && !isAccepted)} className="w-full font-bold py-3.5 sm:py-4 rounded-xl transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 disabled:opacity-50 active:scale-95 flex justify-center items-center gap-2 min-h-[52px]">
            {isLoading ? (
              <span className="flex items-center gap-2"><Loader2 size={20} className="animate-spin"/> Загрузка...</span>
            ) : (
              <span>{isLogin ? 'Войти по паролю' : 'Создать аккаунт'}</span>
            )}
          </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-admin-bg p-4 sm:p-6 font-sans relative overflow-y-auto py-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Декоративные блюр-пятна на фоне */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none flex items-center justify-center">
         <div className="absolute top-[10%] left-[10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-blue-600/10 rounded-full blur-[100px] sm:blur-[150px]"></div>
         <div className="absolute bottom-[10%] right-[10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-purple-600/10 rounded-full blur-[100px] sm:blur-[150px]"></div>
      </div>

      <div className="w-full max-w-md bg-admin-card border border-gray-800 rounded-[2rem] sm:rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300">
        
        <div className="flex justify-center mb-6 sm:mb-8">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
               <ShieldCheck size={24} className="sm:w-7 sm:h-7" />
             </div>
             <span className="text-2xl sm:text-3xl font-black tracking-tight text-white">SMM<span className="text-blue-500">BOX</span></span>
           </div>
        </div>

        <div className="flex bg-gray-900 border border-gray-800 p-1 rounded-xl sm:rounded-2xl mb-6 sm:mb-8">
          <button 
            onClick={() => { setIsLogin(true); setError(''); }} 
            className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl transition-all min-h-[44px] ${isLogin ? 'bg-gray-800 text-white shadow-sm border border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Вход
          </button>
          <button 
            onClick={() => { setIsLogin(false); setError(''); }} 
            className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl transition-all min-h-[44px] ${!isLogin ? 'bg-gray-800 text-white shadow-sm border border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><User size={18} className="sm:w-5 sm:h-5" /></span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя и Фамилия" required className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 sm:py-3.5 pl-11 sm:pl-12 pr-4 text-base sm:text-sm text-white focus:outline-none focus:border-blue-500 transition-colors min-h-[48px]" />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Phone size={18} className="sm:w-5 sm:h-5" /></span>
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={handlePhoneChange} 
                  placeholder="+7 (___) ___-__-__" 
                  required 
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 sm:py-3.5 pl-11 sm:pl-12 pr-4 text-base sm:text-sm text-white focus:outline-none focus:border-blue-500 transition-colors min-h-[48px]" 
                />
              </div>
            </>
          )}

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Mail size={18} className="sm:w-5 sm:h-5" /></span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Электронная почта" required className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 sm:py-3.5 pl-11 sm:pl-12 pr-4 text-base sm:text-sm text-white focus:outline-none focus:border-blue-500 transition-colors min-h-[48px]" />
          </div>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Lock size={18} className="sm:w-5 sm:h-5" /></span>
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" required className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 sm:py-3.5 pl-11 sm:pl-12 pr-12 text-base sm:text-sm text-white focus:outline-none focus:border-blue-500 transition-colors min-h-[48px]" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors">
              {showPassword ? <EyeOff size={18} className="sm:w-5 sm:h-5"/> : <Eye size={18} className="sm:w-5 sm:h-5"/>}
            </button>
          </div>

          {!isLogin && (
            <div className="flex items-start gap-3 mt-4 pt-2">
              <div className="flex items-center justify-center min-w-[24px] min-h-[24px] mt-0.5">
                <input 
                  type="checkbox" 
                  checked={isAccepted} 
                  onChange={(e) => setIsAccepted(e.target.checked)} 
                  id="privacy" 
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer" 
                />
              </div>
              <label htmlFor="privacy" className="text-xs sm:text-sm text-gray-400 cursor-pointer select-none leading-relaxed">
                Я согласен(на) с <Link to="/privacy" target="_blank" className="text-blue-500 hover:text-blue-400 underline">политикой конфиденциальности</Link>.
              </label>
            </div>
          )}

          {isLogin && (
            <div className="text-right mt-2 mb-2">
              <Link to="/forgot-password" title="forgot" className="text-xs sm:text-sm text-blue-500 hover:text-blue-400 font-medium py-2 px-1 rounded-lg">Забыли пароль?</Link>
            </div>
          )}
          
          {error && <p className="text-red-500 text-xs text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20 animate-in fade-in">{error}</p>}
          
          <button type="submit" disabled={isLoading || (!isLogin && !isAccepted)} className="w-full font-bold py-3.5 sm:py-4 rounded-xl transition-all mt-4 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 disabled:opacity-50 active:scale-95 flex justify-center items-center gap-2 min-h-[52px]">
            {isLoading ? <><Loader2 size={20} className="animate-spin"/> Загрузка...</> : (isLogin ? 'Войти по паролю' : 'Создать аккаунт')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800">
          <p className="text-center text-xs text-gray-500 mb-5 font-medium uppercase tracking-wider">Быстрый вход через соцсети</p>
          <div className="flex flex-row items-center justify-center gap-4 sm:gap-6">
             <CustomTelegramButton onAuthCallback={handleTelegramResponse} />
             <CustomVkButton onAuthCallback={handleVkResponse} />
          </div>
        </div>
      </div>
    </div>
  );
}