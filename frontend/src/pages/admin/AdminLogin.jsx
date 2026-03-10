import { useState } from 'react';
import { ShieldAlert, Lock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('adminToken', data.token); 
        navigate('/system-core-dashboard'); 
      } else {
        setError(data.error || 'Доступ запрещен');
      }
    } catch (err) {
      setError('Ошибка соединения');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#0a0a0a] border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6 text-red-500">
          <ShieldAlert size={48} />
        </div>
        <h1 className="text-xl font-bold text-white text-center tracking-widest uppercase mb-8">Restricted Area</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" value={email} onChange={e => setEmail(e.target.value)} 
            placeholder="System Email" required
            className="w-full bg-black border border-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:border-red-500 font-mono text-sm"
          />
          <div className="relative">
            <input 
              type="password" value={password} onChange={e => setPassword(e.target.value)} 
              placeholder="Passphrase" required
              className="w-full bg-black border border-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:border-red-500 font-mono text-sm"
            />
          </div>
          {error && <p className="text-red-500 text-xs text-center font-mono">{error}</p>}
          
          <button disabled={isLoading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2 mt-4 uppercase tracking-widest text-sm">
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}