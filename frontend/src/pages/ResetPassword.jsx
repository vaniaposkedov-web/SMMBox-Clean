import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { Lock, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
  const { token } = useParams(); // Берем токен из URL
  const navigate = useNavigate();
  const resetPasswordAction = useStore((state) => state.resetPasswordAction);
  
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return setErrorMsg('Пароль должен быть не менее 6 символов');
    
    setStatus('loading');
    const result = await resetPasswordAction(token, password);
    
    if (result.success) {
      setStatus('success');
      setTimeout(() => navigate('/auth'), 3000); // Редирект на логин через 3 сек
    } else {
      setStatus('error');
      setErrorMsg(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-admin-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-admin-card border border-gray-800 p-8 rounded-3xl shadow-2xl">
        {status === 'success' ? (
          <div className="text-center py-6">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white">Пароль изменен</h2>
            <p className="text-gray-400 mt-2">Сейчас вы будете перенаправлены на страницу входа...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-2">Новый пароль</h2>
            <p className="text-gray-400 text-sm mb-6">Придумайте надежный пароль для вашего аккаунта.</p>
            
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Новый пароль (от 6 символов)" 
                required
                className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl py-3 pl-12 pr-4 outline-none focus:border-blue-500"
              />
            </div>
            
            {status === 'error' && <p className="text-red-500 text-sm">{errorMsg}</p>}
            
            <button disabled={status === 'loading'} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50">
              {status === 'loading' ? 'Сохранение...' : 'Сохранить пароль'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}