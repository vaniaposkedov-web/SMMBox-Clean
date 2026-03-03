import { useState } from 'react';
import { useStore } from '../store';
import { Mail, Lock, User, MapPin, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Auth() {
  const login = useStore((state) => state.login);
  const register = useStore((state) => state.register);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [pavilion, setPavilion] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Состояние для "глазка"

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLogin && !isAccepted) return;

    setError('');
    setIsLoading(true);

    let result;
    if (isLogin) {
      result = await login(email, password);
    } else {
      result = await register(email, password, name, pavilion);
    }

    if (!result.success) setError(result.error);
    setIsLoading(false);
  };

  return (
    <div className="min-h-[100dvh] bg-admin-bg flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-blue-500/10 blur-[100px] sm:blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-admin-card border border-gray-800 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl relative z-10">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wide text-white mb-1 sm:mb-2">
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
                  autoComplete="name"
                  autoCapitalize="words" // Имя с большой буквы
                  spellCheck="false"
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3.5 sm:py-3 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors text-base" 
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input 
                  type="text" 
                  value={pavilion} 
                  onChange={(e) => setPavilion(e.target.value)} 
                  placeholder="Номер павильона" 
                  autoComplete="off"
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3.5 sm:py-3 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors text-base" 
                />
              </div>
            </>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input 
              type="email" 
              inputMode="email" // Показывает @ на клавиатуре
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="Email" 
              required 
              autoComplete="email" // Для автозаполнения
              autoCapitalize="none" // Отключаем большую букву
              autoCorrect="off" // Отключаем Т9
              spellCheck="false" // Отключаем подчеркивание
              className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3.5 sm:py-3 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors text-base" 
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
              autoComplete={isLogin ? "current-password" : "new-password"} // Подсказка для менеджера паролей
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3.5 sm:py-3 pl-12 pr-12 outline-none focus:border-blue-500 transition-colors text-base" 
            />
            {/* Кнопка "Глазок" с увеличенной зоной нажатия */}
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-2 transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {!isLogin && (
            <div className="flex items-start gap-3 mt-4 sm:mt-6 mb-2 sm:mb-4 p-3 sm:p-4 bg-gray-900/60 rounded-xl sm:rounded-2xl border border-gray-800">
              <div className="flex items-center h-6 sm:h-5 mt-0.5">
                <input 
                  type="checkbox" 
                  id="privacy"
                  checked={isAccepted}
                  onChange={(e) => setIsAccepted(e.target.checked)}
                  className="w-5 h-5 accent-blue-500 bg-gray-800 border-gray-700 rounded cursor-pointer"
                  required
                />
              </div>
              <label htmlFor="privacy" className="text-xs sm:text-sm text-gray-400 leading-snug cursor-pointer select-none">
                Я ознакомлен(а) и согласен(на) с{' '}
                <Link to="/privacy" target="_blank" className="text-blue-500 hover:text-blue-400 underline font-medium">
                  политикой конфиденциальности
                </Link>
                {' '}и даю согласие на обработку данных.
              </label>
            </div>
          )}

          {isLogin && (
            <div className="text-right mt-1 mb-2">
              <Link to="/forgot-password" className="text-sm text-blue-500 hover:text-blue-400 font-medium p-2 -mr-2">
                Забыли пароль?
              </Link>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-xs sm:text-sm text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20 mb-2 sm:mb-4">
              {error}
            </p>
          )}

          <button 
            type="submit"
            disabled={isLoading || (!isLogin && !isAccepted)} 
            className="w-full font-bold py-4 rounded-xl transition-all mt-2 
              disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500
              bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98]"
          >
            {isLoading ? 'Загрузка...' : (isLogin ? 'Войти в аккаунт' : 'Создать аккаунт')}
          </button>

        </form>
      </div>
    </div>
  );
}