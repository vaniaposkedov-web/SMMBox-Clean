import { useState } from 'react';
import { useStore } from '../store';
import { Mail, Lock, User, Phone, Eye, EyeOff, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import CustomTelegramButton from '../components/CustomTelegramButton';
import CustomVkButton from '../components/CustomVkButton';

export default function Auth() {
  const login = useStore((state) => state.login);
  const register = useStore((state) => state.register);
  const telegramLogin = useStore((state) => state.telegramLogin);
  const vkLogin = useStore((state) => state.vkLogin);

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

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) { setPhone(''); return; }
    let num = val;
    if (val.startsWith('7') || val.startsWith('8')) num = val.slice(1);
    let formatted = '+7';
    if (num.length > 0) formatted += ' (' + num.substring(0, 3);
    if (num.length >= 4) formatted += ') ' + num.substring(3, 6);
    if (num.length >= 7) formatted += '-' + num.substring(6, 8);
    if (num.length >= 9) formatted += '-' + num.substring(8, 10);
    setPhone(formatted);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError(''); setIsLoading(true);

    try {
      if (isLogin) {
        const result = await login(email, password);
        if (result.success) {
          window.location.href = '/'; 
        } else {
          if (result.error === 'EMAIL_NOT_VERIFIED') {
            setIsVerification(true);
            setError('Почта не подтверждена. Новый код отправлен.');
          } else {
            setError(result.error || 'Ошибка входа.');
          }
        }
      } else {
        if (!isAccepted) { setError('Нужно согласие с политикой'); setIsLoading(false); return; }
        if (password.length < 6) { setError('Пароль минимум 6 символов'); setIsLoading(false); return; }

        const result = await register(email, password, name, phone);
        if (result.success) {
          setIsVerification(true); 
        } else {
          setError(result.error || 'Ошибка регистрации');
        }
      }
    } catch (err) { setError('Ошибка соединения с сервером'); }
    setIsLoading(false);
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setError(''); setIsLoading(true);
    try {
      const verifyEmailCode = useStore.getState().verifyEmailCode;
      const result = await verifyEmailCode(email, code);
      if (result.success) {
        window.location.href = '/';
      } else {
        setError(result.error || 'Неверный код');
      }
    } catch(err) { setError('Ошибка соединения'); }
    setIsLoading(false);
  };

  const handleTelegramResponse = async (tgUser) => {
    setIsLoading(true);
    const result = await telegramLogin(tgUser);
    if (result.success) {
       window.location.href = '/';
    } else {
       setIsLoading(false);
       setError(result.error || 'Ошибка авторизации Telegram');
    }
  };

  const handleVkResponse = async (vkData) => {
    setIsLoading(true);
    const result = await vkLogin(vkData);
    if (result.success) {
       window.location.href = '/';
    } else {
       setIsLoading(false);
       setError(result.error || 'Ошибка авторизации ВКонтакте');
    }
  };

  if (isVerification) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-admin-bg p-4 sm:p-6 font-sans relative overflow-y-auto">
        <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="w-full max-w-md bg-admin-card border border-gray-800 rounded-[2rem] p-6 sm:p-8 shadow-2xl relative z-10 animate-in fade-in">
          <button onClick={() => setIsVerification(false)} className="flex items-center gap-2 text-gray-500 hover:text-white mb-6">
            <ArrowLeft size={20} /> <span className="font-medium">Назад</span>
          </button>
          <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6"><ShieldCheck size={28} /></div>
          <h2 className="text-2xl font-bold text-white mb-2">Подтверждение</h2>
          <p className="text-sm text-gray-400 mb-6">Код отправлен на <span className="text-white">{email}</span></p>

          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" className="w-full bg-gray-900 border border-gray-800 rounded-xl py-4 px-4 text-center tracking-[0.5em] text-lg text-white focus:border-blue-500 outline-none" maxLength="6" />
            <div className="min-h-[40px]">{error && <div className="text-red-500 text-xs text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20"><span>{error}</span></div>}</div>
            <button type="submit" disabled={isLoading || code.length !== 6} className="w-full font-bold py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">
              {isLoading ? <div className="flex justify-center items-center gap-2"><Loader2 className="animate-spin"/><span>Проверка...</span></div> : <span>Завершить регистрацию</span>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-admin-bg p-4 sm:p-6 font-sans relative py-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="absolute top-[10%] left-[10%] w-[300px] h-[300px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-admin-card border border-gray-800 rounded-[2rem] p-6 sm:p-8 shadow-2xl relative z-10 animate-in fade-in">
        <div className="flex justify-center mb-8">
           <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white"><ShieldCheck size={24} /></div>
             <span className="text-3xl font-black text-white">SMM<span className="text-blue-500">BOX</span></span>
           </div>
        </div>

        <div className="flex bg-gray-900 border border-gray-800 p-1 rounded-xl mb-6">
          <button onClick={() => { setIsLogin(true); setError(''); }} className={`flex-1 py-3 text-sm font-bold rounded-lg ${isLogin ? 'bg-gray-800 text-white border border-gray-700' : 'text-gray-500'}`}><span>Вход</span></button>
          <button onClick={() => { setIsLogin(false); setError(''); }} className={`flex-1 py-3 text-sm font-bold rounded-lg ${!isLogin ? 'bg-gray-800 text-white border border-gray-700' : 'text-gray-500'}`}><span>Регистрация</span></button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><User size={18} /></span><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя и Фамилия" required className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3.5 pl-11 pr-4 text-white focus:border-blue-500 outline-none" /></div>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Phone size={18} /></span><input type="tel" value={phone} onChange={handlePhoneChange} placeholder="+7 (___) ___-__-__" required className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3.5 pl-11 pr-4 text-white focus:border-blue-500 outline-none" /></div>
            </>
          )}

          <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Mail size={18} /></span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Электронная почта" required className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3.5 pl-11 pr-4 text-white focus:border-blue-500 outline-none" /></div>
          
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Lock size={18} /></span>
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" required className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3.5 pl-11 pr-12 text-white focus:border-blue-500 outline-none" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 p-2"><Eye size={18}/></button>
          </div>

          {!isLogin && (
            <div className="flex items-start gap-3 mt-4">
              <input type="checkbox" checked={isAccepted} onChange={(e) => setIsAccepted(e.target.checked)} className="w-5 h-5 mt-0.5 accent-blue-600 rounded" />
              <label className="text-sm text-gray-400 leading-relaxed">Согласен(на) с <Link to="/privacy" className="text-blue-500">политикой</Link>.</label>
            </div>
          )}

          <div className="min-h-[40px]">{error && <div className="text-red-500 text-xs text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20"><span>{error}</span></div>}</div>
          
          <button type="submit" disabled={isLoading || (!isLogin && !isAccepted)} className="w-full font-bold py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">
            {isLoading ? <div className="flex justify-center items-center gap-2"><Loader2 className="animate-spin"/><span>Загрузка...</span></div> : <span>{isLogin ? 'Войти' : 'Создать аккаунт'}</span>}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800">
          <p className="text-center text-xs text-gray-500 mb-5 font-medium uppercase">Быстрый вход через соцсети</p>
          <div className="flex flex-row justify-center gap-6">
             <CustomTelegramButton onAuthCallback={handleTelegramResponse} />
             <CustomVkButton onAuthCallback={handleVkResponse} />
          </div>
        </div>
      </div>
    </div>
  );
}