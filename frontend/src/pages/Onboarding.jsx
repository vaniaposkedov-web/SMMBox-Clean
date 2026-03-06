import { useState } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, X, Mail, Phone, Send, Info, CheckCircle2, Plus, Trash2, Copy, Check } from 'lucide-react';

export default function Onboarding() {
  const user = useStore(state => state.user);
  const navigate = useNavigate();
  
  const [step, setStep] = useState('welcome');
  const [firstChoice, setFirstChoice] = useState(null);
  
  const [tgInput, setTgInput] = useState('');
  const [tgChannels, setTgChannels] = useState([]); 
  const [vkConnected, setVkConnected] = useState(false);

  const [email, setEmail] = useState(user?.email && !user.email.includes('.local') ? user.email : '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [copied, setCopied] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);

const handlePhoneChange = (e) => {
  // Оставляем только цифры
  const val = e.target.value.replace(/\D/g, '');
  if (!val) {
    setPhone('');
    return;
  }
  
  // Убираем 7 или 8 в начале, если юзер ввел их
  let num = val;
  if (val.startsWith('7') || val.startsWith('8')) {
    num = val.slice(1);
  }

  // Строим маску жестко
  let formatted = '+7';
  if (num.length > 0) formatted += ' (' + num.substring(0, 3);
  if (num.length >= 4) formatted += ') ' + num.substring(3, 6);
  if (num.length >= 7) formatted += '-' + num.substring(6, 8);
  if (num.length >= 9) formatted += '-' + num.substring(8, 10);

  setPhone(formatted);
};

  const handleAddTgChannel = async () => {
    if (!tgInput.trim() || tgLoading) return;
    if (tgChannels.some(c => c.originalInput === tgInput.trim())) {
      setTgInput('');
      return;
    }
    setTgLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/tg-chat-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: tgInput })
      });
      const data = await res.json();

      if (data.success) {
        setTgChannels([...tgChannels, { 
          originalInput: tgInput.trim(),
          title: data.title,
          username: data.username,
          avatar: data.avatar 
        }]);
        setTgInput('');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
    }
    setTgLoading(false);
  };

  const handleRemoveTgChannel = (channelToRemove) => {
    setTgChannels(tgChannels.filter(c => c !== channelToRemove));
  };

  const handleCopyBot = () => {
    navigator.clipboard.writeText('@smmbox_auth_bot');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const finishOnboarding = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Сессия истекла. Пожалуйста, войдите заново.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/auth/complete-onboarding', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ userId: user?.id }) 
      });
      
      const data = await res.json();
      
      if (data.success) {
        useStore.setState({ user: data.user });
        navigate('/profile');
      } else {
        setError(data.error || 'Ошибка при завершении настройки');
      }
    } catch (err) {
      console.error(err);
      setError('Ошибка соединения при сохранении профиля');
    }
    setLoading(false);
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (phone && phone.length < 18) {
      setError('Пожалуйста, введите номер телефона полностью');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/request-link-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email })
      });
      const data = await res.json();
      if (data.success) setStep('verify');
      else setError(data.error);
    } catch (err) {
      setError('Ошибка соединения с сервером');
    }
    setLoading(false);
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-link-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email, code, phone })
      });
      const data = await res.json();
      if (data.success) {
        finishOnboarding(); 
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Ошибка соединения');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] bg-admin-bg flex flex-col items-center justify-center p-3 sm:p-4 relative overflow-x-hidden font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] sm:w-[600px] sm:h-[600px] bg-blue-600/10 blur-[90px] sm:blur-[130px] rounded-full pointer-events-none"></div>

      <button onClick={finishOnboarding} className="absolute top-4 right-4 sm:top-6 sm:right-6 text-gray-400 hover:text-white flex items-center gap-2 bg-gray-900/50 backdrop-blur-md border border-gray-800 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all z-20 hover:bg-gray-800">
        <span className="text-xs sm:text-sm font-medium">Пропустить</span> <X size={16} />
      </button>

      <div className="w-full max-w-xl bg-admin-card/80 backdrop-blur-2xl border border-gray-800/60 p-5 sm:p-10 rounded-2xl sm:rounded-3xl shadow-2xl relative z-10 mt-10 sm:mt-0">
        
        {step === 'welcome' && (
          <div className="text-center space-y-4 sm:space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">Добро пожаловать! 👋</h1>
            <p className="text-gray-400 text-sm sm:text-lg">Давайте подключим ваши первые каналы для автоматической публикации постов.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-6 pt-2">
               <button onClick={() => { setFirstChoice('vk'); setStep('vk_setup'); }} className="group relative overflow-hidden bg-[#0077FF]/10 hover:bg-[#0077FF]/20 border border-[#0077FF]/30 transition-all p-4 sm:p-6 rounded-2xl text-[#0077FF] font-bold text-base sm:text-lg flex flex-row sm:flex-col items-center justify-center sm:gap-3 gap-4">
                 <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#0077FF] text-white rounded-xl flex items-center justify-center shadow-lg shadow-[#0077FF]/30 group-hover:scale-110 transition-transform">
                    <span className="text-xl sm:text-2xl font-black">K</span>
                 </div>
                 ВКонтакте
               </button>
               <button onClick={() => { setFirstChoice('tg'); setStep('tg_setup'); }} className="group relative overflow-hidden bg-[#0088CC]/10 hover:bg-[#0088CC]/20 border border-[#0088CC]/30 transition-all p-4 sm:p-6 rounded-2xl text-[#0088CC] font-bold text-base sm:text-lg flex flex-row sm:flex-col items-center justify-center sm:gap-3 gap-4">
                 <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#0088CC] text-white rounded-xl flex items-center justify-center shadow-lg shadow-[#0088CC]/30 group-hover:scale-110 transition-transform">
                    <Send size={20} className="ml-1 sm:w-6 sm:h-6" />
                 </div>
                 Telegram
               </button>
            </div>
          </div>
        )}

        {step === 'vk_setup' && (
          <div className="space-y-5 sm:space-y-6 text-center animate-in fade-in slide-in-from-right-8 duration-500">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Сообщества ВКонтакте</h2>
            <p className="text-gray-400 text-xs sm:text-sm">Привяжите аккаунт, чтобы выбрать все группы и паблики, в которых вы хотите публиковать посты.</p>
            {!vkConnected ? (
              <div className="bg-gray-900/50 backdrop-blur-sm p-6 sm:p-8 rounded-2xl border border-gray-700 my-4 sm:my-6">
                <button onClick={() => setVkConnected(true)} className="bg-[#0077FF] hover:bg-[#0066DD] text-white font-bold py-3 px-4 sm:px-6 text-sm sm:text-base rounded-xl transition-colors shadow-lg shadow-[#0077FF]/30 mx-auto block w-full sm:w-auto">
                  Привязать аккаунт ВКонтакте
                </button>
              </div>
            ) : (
              <div className="bg-green-500/10 border border-green-500/20 p-5 sm:p-6 rounded-2xl my-4 sm:my-6">
                <CheckCircle2 className="mx-auto text-green-500 mb-2 sm:mb-3" size={28} />
                <h3 className="text-green-500 font-bold mb-1 text-sm sm:text-base">Аккаунт успешно привязан!</h3>
                <p className="text-xs sm:text-sm text-gray-400">Список ваших сообществ появится в панели управления.</p>
              </div>
            )}
            <button onClick={() => setStep(firstChoice === 'vk' ? 'offer_second' : 'contacts')} className="w-full bg-white text-black font-bold py-3.5 sm:py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors shadow-lg shadow-white/10 text-base">
              Продолжить <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === 'tg_setup' && (
          <div className="space-y-5 sm:space-y-6 text-left animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="text-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Каналы Telegram</h2>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">Добавьте неограниченное количество каналов.</p>
            </div>
            
            <div className="bg-[#0088CC]/10 border border-[#0088CC]/20 rounded-2xl p-4 sm:p-5 space-y-3">
              <h3 className="text-[#0088CC] font-semibold flex items-center gap-2 mb-2 text-sm sm:text-base">
                <Info size={16} /> Как подключить каналы:
              </h3>
              <ol className="list-decimal list-inside text-gray-300 text-xs sm:text-sm space-y-2 ml-1">
                <li>Перейдите в настройки канала (раздел <b>Администраторы</b>).</li>
                <li className="flex flex-wrap items-center gap-1 mt-1">
                  Добавьте бота: 
                  <button 
                    key={copied ? 'copied' : 'not-copied'} 
                    onClick={handleCopyBot}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-xs transition-all active:scale-95 ${copied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-900 text-white border border-gray-700 hover:border-gray-500'}`}
                    >
                    {copied ? (
                        <>
                        <Check size={12} /> <span>Скопировано</span>
                        </>
                    ) : (
                        <>
                        <Copy size={12} /> <span>@smmbox_auth_bot</span>
                        </>
                    )}
                    </button>
                </li>
                <li>Выдайте права на <b>публикацию сообщений</b>.</li>
                <li>Вставьте ссылку на канал ниже и нажмите «Добавить».</li>
              </ol>
            </div>

            <div className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={tgInput}
                  onChange={(e) => setTgInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTgChannel()}
                  placeholder="t.me/канал или @username" 
                  className="flex-1 w-full min-w-0 bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-3 sm:px-4 outline-none focus:border-[#0088CC] transition-colors placeholder:text-gray-500 text-base"
                />
                <button 
                  onClick={handleAddTgChannel}
                  disabled={!tgInput.trim()}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-3 sm:px-4 rounded-xl border border-gray-700 transition-colors flex items-center justify-center flex-shrink-0"
                >
                  <Plus size={20} />
                </button>
              </div>

              {tgChannels.length > 0 && (
                <div className="space-y-2 max-h-32 sm:max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                  {tgChannels.map((channel, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-900/50 border border-gray-800 p-2.5 sm:p-3 rounded-xl animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                        {channel.avatar ? (
                          <img src={channel.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-gray-700 flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#0088CC]/20 flex items-center justify-center flex-shrink-0">
                            <Send size={14} className="text-[#0088CC]" />
                          </div>
                        )}
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-gray-200 text-sm font-medium truncate">{channel.title}</span>
                          <span className="text-gray-500 text-xs truncate">{channel.username}</span>
                        </div>
                      </div>
                      <button onClick={() => handleRemoveTgChannel(channel)} className="text-gray-500 hover:text-red-400 transition-colors p-2 flex-shrink-0">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setStep(firstChoice === 'tg' ? 'offer_second' : 'contacts')} className="mt-4 sm:mt-6 w-full bg-[#0088CC] text-white font-bold py-3.5 sm:py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#0077b3] transition-colors shadow-lg shadow-[#0088CC]/20 text-base">
              {/* Исправление 3: Обернули меняющийся текст в <span> */}
              <span>{tgChannels.length > 0 ? `Продолжить (${tgChannels.length})` : 'Пропустить'}</span> <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === 'offer_second' && (
          <div className="text-center space-y-5 sm:space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-1 sm:mb-2">
              <CheckCircle2 size={28} className="sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Отличное начало!</h2>
            <p className="text-gray-400 text-sm sm:text-base">Хотите сразу настроить сообщества для {firstChoice === 'vk' ? 'Telegram' : 'ВКонтакте'}?</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 sm:pt-4">
              <button onClick={() => setStep(firstChoice === 'vk' ? 'tg_setup' : 'vk_setup')} className="flex-1 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-bold py-3.5 sm:py-4 rounded-xl shadow-lg shadow-blue-500/20 text-base">
                Да, настроить
              </button>
              <button onClick={() => setStep('contacts')} className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors text-white font-bold py-3.5 sm:py-4 rounded-xl text-base">
                Сделаю позже
              </button>
            </div>
          </div>
        )}

        {step === 'contacts' && (
          <div className="space-y-5 sm:space-y-6 text-center animate-in fade-in slide-in-from-right-8 duration-500">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Безопасность профиля</h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6">Укажите контакты для защиты аккаунта, восстановления пароля и важных уведомлений.</p>
            
            <form onSubmit={handleRequestCode} className="space-y-3 sm:space-y-4">
              <div className="relative">
                <Mail className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="Ваш реальный Email" 
                  required 
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3.5 sm:py-4 pl-10 sm:pl-12 pr-4 outline-none focus:border-blue-500 transition-colors text-base" 
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={handlePhoneChange} 
                  placeholder="+7 (999) 000-00-00" 
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3.5 sm:py-4 pl-10 sm:pl-12 pr-4 outline-none focus:border-blue-500 transition-colors text-base" 
                />
              </div>
              
              {error && <p className="text-red-400 bg-red-400/10 py-2 px-3 rounded-lg border border-red-400/20 text-xs sm:text-sm text-left">{error}</p>}
              
              <button type="submit" disabled={loading} className="w-full bg-white text-black font-bold py-3.5 sm:py-4 rounded-xl mt-2 sm:mt-4 hover:bg-gray-200 transition-colors shadow-lg shadow-white/10 text-base">
                {/* Исправление 3: Обернули меняющийся текст в <span> */}
                <span>{loading ? 'Отправка кода...' : 'Получить код подтверждения'}</span>
              </button>
            </form>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-5 sm:space-y-6 text-center animate-in fade-in zoom-in-95 duration-500">
            <ShieldCheck className="mx-auto text-blue-500 sm:w-12 sm:h-12" size={40} />
            <h2 className="text-xl sm:text-2xl font-bold text-white">Введите код</h2>
            <p className="text-gray-400 text-sm">Шестизначный код отправлен на <br/><span className="text-white font-medium">{email}</span></p>
            
            <form onSubmit={handleVerifyCode} className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
              <input 
                type="text" 
                maxLength="6" 
                value={code} 
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} 
                placeholder="000000" 
                required 
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3.5 sm:py-4 text-center text-2xl sm:text-3xl tracking-widest outline-none focus:border-blue-500 transition-colors text-base" 
              />
              
              {error && <p className="text-red-400 bg-red-400/10 py-2 px-3 rounded-lg border border-red-400/20 text-xs sm:text-sm">{error}</p>}
              
              <button type="submit" disabled={loading || code.length !== 6} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 sm:py-4 rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20 text-base">
                {/* Исправление 3: Обернули меняющийся текст в <span> */}
                <span>{loading ? 'Проверка...' : 'Завершить настройку'}</span>
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}