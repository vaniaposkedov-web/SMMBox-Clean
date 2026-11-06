import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import { useStore } from '../store';

// Вход по одноразовой ссылке от поддержки. Ссылка срабатывает по кнопке, чтобы её не израсходовал случайный переход.
export default function RecoverAccess() {
  const { code } = useParams();
  const navigate = useNavigate();
  const recoverAccess = useStore((state) => state.recoverAccess);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEnter = async () => {
    setIsLoading(true);
    setError('');
    const result = await recoverAccess(code);
    setIsLoading(false);
    if (result.success) navigate('/profile?tab=settings&recovered=1', { replace: true });
    else setError(result.error || 'Не удалось войти. Попробуйте ещё раз.');
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0d0f13] border border-gray-800 rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-2xl text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-500/10 text-blue-500 mb-4 border border-blue-500/20">
          <KeyRound size={24} className="sm:w-7 sm:h-7" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Восстановление доступа</h1>
        <p className="text-gray-400 text-xs sm:text-sm mb-6">
          Поддержка выдала вам ссылку для входа. Она работает один раз. После входа привяжите новый Telegram или ВКонтакте в разделе «Настройки».
        </p>
        <button onClick={handleEnter} disabled={isLoading} className="w-full font-bold py-3 sm:py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm sm:text-base disabled:opacity-50 transition-colors flex justify-center items-center gap-2">
          {isLoading && <Loader2 className="animate-spin" size={18} />} Войти в аккаунт
        </button>
        {error && <div role="status" className="text-red-500 text-xs text-center bg-red-500/10 py-2 sm:py-3 px-3 rounded-xl border border-red-500/20 mt-4">{error}</div>}
      </div>
    </div>
  );
}
