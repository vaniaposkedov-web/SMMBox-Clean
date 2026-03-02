import { useState } from 'react';
import { useStore } from '../store';
import { Box, AlertCircle } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [pavilion, setPavilion] = useState('');
  const [error, setError] = useState('');

  const login = useStore((state) => state.login);
  const register = useStore((state) => state.register);
  const user = useStore((state) => state.user);

  // Регулярное выражение: Ожидает текст, пробелы, цифры и обязательный дефис
  const pavilionRegex = /^[А-Яа-яЁёA-Za-z0-9\s]+-\d+[а-яА-Яa-zA-Z]?$/;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      const result = await login(email, password);
      if (!result.success) setError(result.error);
    } else {
      if (!pavilionRegex.test(pavilion.trim())) {
        setError('Неверный формат павильона. Пример: Корпус Б 2Г-37а или СТ7-43');
        return;
      }
      const result = await register(email, password, name, pavilion.trim());
      if (!result.success) setError(result.error);
    }
  };

  if (user) return null;

  return (
    <div className="min-h-screen bg-admin-bg flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-admin-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
          <Box size={24} />
        </div>
        <span className="text-3xl font-bold tracking-wide text-white">SMM<span className="text-admin-accent">BOX</span></span>
      </div>

      <div className="bg-admin-card border border-gray-800 rounded-3xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          {isLogin ? 'Вход в систему' : 'Регистрация'}
        </h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Ваше Имя</label>
                <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-admin-accent" placeholder="Иван Иванов" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Номер павильона (Место)</label>
                <input required type="text" value={pavilion} onChange={(e) => setPavilion(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-admin-accent" placeholder="Например: Корпус Б 2Г-37а" />
                <p className="text-xs text-gray-500 mt-1">Обязательно используйте дефис для указания места.</p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-2">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-admin-accent" placeholder="test@test.com" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Пароль</label>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-admin-accent" placeholder="••••••••" />
          </div>

          <button type="submit" className="w-full bg-admin-accent text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-600 transition-colors mt-4">
            {isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-sm text-gray-400 hover:text-white transition-colors">
            {isLogin ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
          </button>
        </div>
      </div>
    </div>
  );
}