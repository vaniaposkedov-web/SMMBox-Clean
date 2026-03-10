import { useState } from 'react';
import { useStore } from '../store';
import { Mail, Lock, User, Phone, Eye, EyeOff, ShieldCheck, ArrowLeft, Loader2, KeyRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import CustomTelegramButton from '../components/CustomTelegramButton';
import CustomVkButton from '../components/CustomVkButton';

export default function Auth() {
  const navigate = useNavigate();
  const telegramLogin = useStore((state) => state.telegramLogin);
  const vkLogin = useStore((state) => state.vkLogin);

  const [isLogin, setIsLogin] = useState(true);
  const [isVerification, setIsVerification] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false); // Новое состояние
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isAccepted, setIsAccepted] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) { setPhone(''); return; }
    if (val.startsWith('7') || val.startsWith('8')) {
      const p = val.substring(1, 11);
      setPhone(`+7 ${p.slice(0,3)} ${p.slice(3,6)} ${p.slice(6,8)} ${p.slice(8,10)}`.trim());
    } else {
      setPhone(`+${val.slice(0,11)}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      // 1. ЛОГИКА ВОССТАНОВЛЕНИЯ ПАРОЛЯ
      if (isForgotPassword) {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (res.ok) {
          setSuccessMsg('Ссылка для сброса пароля отправлена на вашу почту!');
          setTimeout(() => setIsForgotPassword(false), 3000);
        } else {
          setError(data.error || 'Ошибка при восстановлении');
        }
        setIsLoading(false);
        return;
      }

      // 2. ЛОГИКА ВВОДА КОДА ПОДТВЕРЖДЕНИЯ
      if (isVerification) {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code })
        });
        const data = await res.json();
        if (res.ok) {
           useStore.setState({ user: data.user, token: data.token });
           navigate(data.user.isOnboardingCompleted ? '/' : '/onboarding');
        } else {
           setError(data.error || 'Неверный код');
        }
        setIsLoading(false);
        return;
      }

      // 3. ЛОГИКА РЕГИСТРАЦИИ И ВХОДА
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin ? { email, password } : { email, password, name, phone };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (isLogin) {
          useStore.setState({ user: data.user, token: data.token });
          navigate(data.user.isOnboardingCompleted ? '/' : '/onboarding');
        } else {
          // После успешной регистрации переводим на ввод кода
          setIsVerification(true);
          setSuccessMsg('Код подтверждения отправлен на почту!');
        }
      } else {
        // Если логин выдал ошибку, что почта не подтверждена - переводим на ввод кода
        if (data.error === 'EMAIL_NOT_VERIFIED') {
          setIsVerification(true);
          setSuccessMsg('На вашу почту отправлен новый код подтверждения.');
        } else {
          setError(data.error || 'Произошла ошибка');
        }
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Декоративный фон */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md bg-[#0d0f13] border border-gray-800 rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-2xl relative z-10 animate-in slide-in-from-bottom-4 duration-500">
        
        {/* Кнопка "Назад" */}
        {(isVerification || isForgotPassword) && (
          <button 
            onClick={() => { setIsVerification(false); setIsForgotPassword(false); setError(''); setSuccessMsg(''); }} 
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-5 sm:mb-6"
          >
            <ArrowLeft size={18} /> <span className="text-sm font-medium">Назад</span>
          </button>
        )}

        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-500/10 text-blue-500 mb-4 border border-blue-500/20">
            {isForgotPassword ? <KeyRound size={24} className="sm:w-7 sm:h-7" /> : isVerification ? <ShieldCheck size={24} className="sm:w-7 sm:h-7" /> : <User size={24} className="sm:w-7 sm:h-7" />}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
            {isForgotPassword ? 'Сброс пароля' : isVerification ? 'Подтверждение почты' : isLogin ? 'С возвращением' : 'Создать аккаунт'}
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm">
            {isForgotPassword 
              ? 'Введите email, и мы отправим ссылку для сброса.'
              : isVerification 
              ? `Введите 6-значный код, отправленный на ${email}` 
              : isLogin 
              ? 'Войдите в свой аккаунт для продолжения' 
              : 'Заполните данные для начала работы'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          
          {isVerification && (
            <div className="relative">
              <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="000000" 
                value={code} 
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-12 pr-4 py-3 sm:py-4 text-white text-center tracking-[0.5em] text-lg sm:text-xl focus:border-blue-500 transition-colors focus:outline-none"
                required 
              />
            </div>
          )}

          {!isVerification && (
            <>
              {!isLogin && !isForgotPassword && (
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input type="text" placeholder="Имя профиля" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-11 pr-4 py-3 sm:py-4 text-white text-sm sm:text-base placeholder-gray-500 focus:border-blue-500 transition-colors focus:outline-none" required />
                </div>
              )}
              
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input type="email" placeholder="Email адрес" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-11 pr-4 py-3 sm:py-4 text-white text-sm sm:text-base placeholder-gray-500 focus:border-blue-500 transition-colors focus:outline-none" required />
              </div>

              {!isLogin && !isForgotPassword && (
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input type="text" placeholder="Телефон (необязательно)" value={phone} onChange={handlePhoneChange} className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-11 pr-4 py-3 sm:py-4 text-white text-sm sm:text-base placeholder-gray-500 focus:border-blue-500 transition-colors focus:outline-none" />
                </div>
              )}

              {!isForgotPassword && (
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input type={showPassword ? 'text' : 'password'} placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-11 pr-12 py-3 sm:py-4 text-white text-sm sm:text-base placeholder-gray-500 focus:border-blue-500 transition-colors focus:outline-none" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              )}

              {isLogin && !isForgotPassword && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs sm:text-sm text-blue-500 hover:text-blue-400 transition-colors">
                    Забыли пароль?
                  </button>
                </div>
              )}

              {!isLogin && !isForgotPassword && (
                <div className="flex items-start gap-2 sm:gap-3 mt-3 sm:mt-4">
                  <input type="checkbox" checked={isAccepted} onChange={(e) => setIsAccepted(e.target.checked)} className="w-4 h-4 sm:w-5 sm:h-5 mt-1 accent-blue-600 rounded shrink-0 cursor-pointer" />
                  <label className="text-xs sm:text-sm text-gray-400 leading-relaxed">Согласен(на) с <Link to="/privacy" className="text-blue-500 hover:underline">политикой конфиденциальности</Link>.</label>
                </div>
              )}
            </>
          )}

          <div className="min-h-[32px] sm:min-h-[40px] pt-1">
            {error && <div className="text-red-500 text-xs text-center bg-red-500/10 py-2 sm:py-3 rounded-xl border border-red-500/20">{error}</div>}
            {successMsg && <div className="text-green-500 text-xs text-center bg-green-500/10 py-2 sm:py-3 rounded-xl border border-green-500/20">{successMsg}</div>}
          </div>
          
          <button type="submit" disabled={isLoading || (!isLogin && !isVerification && !isForgotPassword && !isAccepted)} className="w-full font-bold py-3 sm:py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm sm:text-base disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20">
            {isLoading ? <div className="flex justify-center items-center gap-2"><Loader2 className="animate-spin" size={18}/></div> : 
              <span>{isForgotPassword ? 'Отправить ссылку' : isVerification ? 'Подтвердить' : isLogin ? 'Войти' : 'Создать аккаунт'}</span>
            }
          </button>
        </form>

        {/* Блок социальных сетей (скрыт при вводе кода или сбросе пароля) */}
        {!isVerification && !isForgotPassword && (
          <>
            <div className="mt-8 pt-6 border-t border-gray-800">
              <p className="text-center text-xs text-gray-500 mb-5 font-medium uppercase tracking-wider">Быстрый вход через соцсети</p>
              <div className="flex justify-center gap-4">
                <CustomTelegramButton onAuthCallback={telegramLogin} />
                <CustomVkButton onAuth={vkLogin} />
              </div>
            </div>

            <div className="mt-8 text-center text-sm text-gray-400">
              {isLogin ? "Нет аккаунта? " : "Уже есть аккаунт? "}
              <button onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }} className="text-blue-500 font-bold hover:text-blue-400 transition-colors">
                {isLogin ? 'Зарегистрироваться' : 'Войти'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}