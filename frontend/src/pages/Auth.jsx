import { useState } from 'react';
import { useStore } from '../store';
import { AlertCircle } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  
  // Поля формы
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Состояние для ошибок
  const [error, setError] = useState('');

  // Достаем функции из базы
  const login = useStore((state) => state.login);
  const register = useStore((state) => state.register);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(''); // Очищаем старые ошибки

    // Валидация (проверки) перед отправкой в БД
    if (!email.includes('@') || !email.includes('.')) {
      setError('Пожалуйста, введите корректный email адрес');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }
    if (!isLogin && name.trim().length < 2) {
      setError('Имя должно содержать минимум 2 буквы');
      return;
    }

    // Попытка связи с базой данных
    try {
      if (isLogin) {
        login(email, password);
      } else {
        register(email, password, name);
      }
    } catch (err) {
      // Если store.js выкинул ошибку (неверный пароль, нет юзера), показываем её
      setError(err.message);
      
      // Если пользователя нет в базе, автоматически предлагаем регистрацию (удобство для клиента)
      if (err.message.includes('не найден')) {
        setTimeout(() => setIsLogin(false), 2000); // Переключим на регистрацию через 2 секунды
      }
    }
  };

  // Функция для переключения между Входом и Регистрацией
  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError(''); // Очищаем ошибки при переключении
    setPassword(''); // В целях безопасности очищаем пароль
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-admin-card p-6 rounded-3xl border border-gray-800 shadow-2xl relative overflow-hidden">
        
        {/* Декоративное свечение */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-admin-accent/20 rounded-full blur-3xl"></div>

        <h1 className="text-2xl font-bold text-center mb-6 relative z-10">
          {isLogin ? 'Вход в SMMBOX' : 'Регистрация'}
        </h1>

        {/* Блок вывода ошибок */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-xl mb-4 flex items-start gap-2 relative z-10 animate-pulse">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          
          {/* Поле "Имя" показываем ТОЛЬКО при регистрации */}
          {!isLogin && (
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Ваше имя</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-admin-bg border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-admin-accent transition-colors"
                placeholder="Например, Алексей"
              />
            </div>
          )}

          <div>
            <label className="text-sm text-gray-400 mb-1 block">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-admin-bg border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-admin-accent transition-colors"
              placeholder="name@example.com"
            />
          </div>
          
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Пароль</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-admin-bg border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-admin-accent transition-colors"
              placeholder="Минимум 6 символов"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-admin-accent text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-colors mt-2 shadow-lg shadow-blue-500/20"
          >
            {isLogin ? 'Войти в панель' : 'Создать аккаунт'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6 relative z-10">
          {isLogin ? 'Нет аккаунта? ' : 'Уже зарегистрированы? '}
          <button 
            onClick={toggleMode}
            type="button"
            className="text-admin-accent font-medium hover:underline"
          >
            {isLogin ? 'Создать сейчас' : 'Войти'}
          </button>
        </p>
      </div>
    </div>
  );
}