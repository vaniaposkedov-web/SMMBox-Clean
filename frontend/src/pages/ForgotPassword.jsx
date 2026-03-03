import { useState } from 'react';
import { Mail, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Произошла ошибка при отправке');
      
      setMessage(data.message || 'Письмо для восстановления отправлено');
    } catch (err) {
      setError(err.message || 'Не удалось связаться с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-admin-bg flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-blue-500/10 blur-[100px] sm:blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-admin-card border border-gray-800 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl relative z-10">
        
        <Link to="/auth" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors p-2 -ml-2 rounded-lg active:bg-gray-800">
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Назад ко входу</span>
        </Link>

        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Восстановление</h2>
        <p className="text-sm sm:text-base text-gray-400 mb-6 sm:mb-8">
          Введите email, указанный при регистрации, и мы отправим ссылку для сброса пароля.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input 
              type="email" 
              inputMode="email"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="Ваш Email" 
              required 
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3.5 sm:py-3 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors text-base"
            />
          </div>

          {message && <p className="text-green-500 text-sm text-center bg-green-500/10 py-3 rounded-xl border border-green-500/20">{message}</p>}
          {error && <p className="text-red-500 text-sm text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20">{error}</p>}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full font-bold py-4 rounded-xl transition-all mt-2 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? 'Отправка...' : 'Отправить письмо'}
          </button>
        </form>
      </div>
    </div>
  );
}