import { useState } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, X, Mail, Phone, Send, Info, CheckCircle2, Plus, Trash2 } from 'lucide-react';

export default function Onboarding() {
  const user = useStore(state => state.user);
  const navigate = useNavigate();
  
  // Шаги: 'welcome' -> 'choice' -> 'vk_setup' | 'tg_setup' -> 'offer_second' -> 'contacts' -> 'verify'
  const [step, setStep] = useState('welcome');
  const [firstChoice, setFirstChoice] = useState(null);
  
  // Состояния для множественного добавления Telegram
  const [tgInput, setTgInput] = useState('');
  const [tgChannels, setTgChannels] = useState([]); 
  
  // Состояния для ВК (визуальная заглушка для будущего списка групп)
  const [vkConnected, setVkConnected] = useState(false);

  // Состояния для форм контактов
  const [email, setEmail] = useState(user?.email && !user.email.includes('.local') ? user.email : '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Логика добавления и удаления ТГ каналов в список
  const handleAddTgChannel = () => {
    if (!tgInput.trim()) return;
    if (!tgChannels.includes(tgInput.trim())) {
      setTgChannels([...tgChannels, tgInput.trim()]);
    }
    setTgInput(''); // Очищаем поле после добавления
  };

  const handleRemoveTgChannel = (channelToRemove) => {
    setTgChannels(tgChannels.filter(c => c !== channelToRemove));
  };

  // Завершение онбординга (Отправка на бэкенд)
  const finishOnboarding = async () => {
    setLoading(true);
    try {
      // Здесь в будущем можно добавить отправку массива tgChannels и vkGroups на бэкенд
      const res = await fetch('/api/auth/complete-onboarding', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success) {
        useStore.setState({ user: data.user });
        navigate('/profile');
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // Отправка кода на почту
  const handleRequestCode = async (e) => {
    e.preventDefault();
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
      setError('Ошибка соединения');
    }
    setLoading(false);
  };

  // Проверка кода почты
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
      if (data.success) finishOnboarding();
      else setError(data.error);
    } catch (err) {
      setError('Ошибка соединения');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] bg-admin-bg flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* КРАСИВЫЙ ФОН С БЛЮРОМ */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] bg-blue-600/10 blur-[100px] sm:blur-[130px] rounded-full pointer-events-none"></div>

      {/* Кнопка выхода */}
      <button onClick={finishOnboarding} className="absolute top-6 right-6 text-gray-400 hover:text-white flex items-center gap-2 bg-gray-900/50 backdrop-blur-md border border-gray-800 px-4 py-2.5 rounded-xl transition-all z-20 hover:bg-gray-800">
        <span className="text-sm font-medium">Пропустить настройку</span> <X size={16} />
      </button>

      {/* ГЛАВНАЯ КАРТОЧКА */}
      <div className="w-full max-w-xl bg-admin-card/60 backdrop-blur-2xl border border-gray-800/60 p-8 sm:p-10 rounded-3xl shadow-2xl relative z-10">
        
        {/* ШАГ 1: ПРИВЕТСТВИЕ И ВЫБОР */}
        {step === 'welcome' && (
          <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Добро пожаловать! 👋</h1>
            <p className="text-gray-400 text-base sm:text-lg">Давайте подключим ваши первые каналы для автоматической публикации постов.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-4">
               <button onClick={() => { setFirstChoice('vk'); setStep('vk_setup'); }} className="group relative overflow-hidden bg-[#0077FF]/10 hover:bg-[#0077FF]/20 border border-[#0077FF]/30 transition-all p-6 rounded-2xl text-[#0077FF] font-bold text-lg flex flex-col items-center gap-3">
                 <div className="w-12 h-12 bg-[#0077FF] text-white rounded-xl flex items-center justify-center shadow-lg shadow-[#0077FF]/30 group-hover:scale-110 transition-transform">
                    <span className="text-2xl font-black">K</span>
                 </div>
                 ВКонтакте
               </button>
               <button onClick={() => { setFirstChoice('tg'); setStep('tg_setup'); }} className="group relative overflow-hidden bg-[#0088CC]/10 hover:bg-[#0088CC]/20 border border-[#0088CC]/30 transition-all p-6 rounded-2xl text-[#0088CC] font-bold text-lg flex flex-col items-center gap-3">
                 <div className="w-12 h-12 bg-[#0088CC] text-white rounded-xl flex items-center justify-center shadow-lg shadow-[#0088CC]/30 group-hover:scale-110 transition-transform">
                    <Send size={24} className="ml-1" />
                 </div>
                 Telegram
               </button>
            </div>
          </div>
        )}

        {/* ШАГ 2a: НАСТРОЙКА ВК (МНОЖЕСТВЕННАЯ) */}
        {step === 'vk_setup' && (
          <div className="space-y-6 text-center animate-in fade-in slide-in-from-right-8 duration-500">
            <h2 className="text-2xl font-bold text-white">Сообщества ВКонтакте</h2>
            <p className="text-gray-400 text-sm">Привяжите аккаунт, чтобы выбрать все группы и паблики, в которых вы хотите публиковать посты.</p>
            
            {!vkConnected ? (
              <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-700 my-6">
                <button 
                  onClick={() => setVkConnected(true)} // В будущем здесь будет вызов авторизации ВК
                  className="bg-[#0077FF] hover:bg-[#0066DD] text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-[#0077FF]/30 mx-auto block"
                >
                  Привязать аккаунт ВКонтакте
                </button>
              </div>
            ) : (
              <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-2xl my-6">
                <CheckCircle2 className="mx-auto text-green-500 mb-3" size={32} />
                <h3 className="text-green-500 font-bold mb-1">Аккаунт успешно привязан!</h3>
                <p className="text-sm text-gray-400">Список ваших сообществ для выбора появится в панели управления.</p>
              </div>
            )}

            <button 
              onClick={() => setStep(firstChoice === 'vk' ? 'offer_second' : 'contacts')} 
              className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors shadow-lg shadow-white/10"
            >
              Продолжить <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* ШАГ 2b: НАСТРОЙКА TG (МНОЖЕСТВЕННАЯ С ИНСТРУКЦИЕЙ) */}
        {step === 'tg_setup' && (
          <div className="space-y-6 text-left animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">Каналы Telegram</h2>
              <p className="text-gray-400 text-sm mt-2">Добавьте неограниченное количество каналов.</p>
            </div>
            
            {/* Блок с инструкцией */}
            <div className="bg-[#0088CC]/10 border border-[#0088CC]/20 rounded-2xl p-5 space-y-3">
              <h3 className="text-[#0088CC] font-semibold flex items-center gap-2 mb-2">
                <Info size={18} /> Как подключить каналы:
              </h3>
              <ol className="list-decimal list-inside text-gray-300 text-sm space-y-2.5 ml-1">
                <li>Откройте настройки вашего канала в Telegram.</li>
                <li>Перейдите в раздел <b>Администраторы</b>.</li>
                <li>Добавьте бота <span className="bg-gray-900 px-2 py-0.5 rounded text-white font-mono text-xs select-all">@smmbox_auth_bot</span> в администраторы.</li>
                <li>Выдайте ему права на <b>публикацию сообщений</b>.</li>
                <li>Вставьте ссылку на канал ниже и нажмите «Добавить».</li>
              </ol>
            </div>

            {/* Добавление нескольких каналов */}
            <div className="space-y-4 mt-6">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={tgInput}
                  onChange={(e) => setTgInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTgChannel()}
                  placeholder="t.me/ваш_канал или @username" 
                  className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 outline-none focus:border-[#0088CC] transition-colors placeholder:text-gray-600"
                />
                <button 
                  onClick={handleAddTgChannel}
                  disabled={!tgInput.trim()}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 rounded-xl border border-gray-700 transition-colors flex items-center justify-center"
                >
                  <Plus size={24} />
                </button>
              </div>

              {/* Список добавленных каналов */}
              {tgChannels.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {tgChannels.map((channel, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-900/50 border border-gray-800 p-3 rounded-xl animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Send size={16} className="text-[#0088CC] flex-shrink-0" />
                        <span className="text-gray-200 text-sm truncate">{channel}</span>
                      </div>
                      <button onClick={() => handleRemoveTgChannel(channel)} className="text-gray-500 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={() => setStep(firstChoice === 'tg' ? 'offer_second' : 'contacts')} 
              className="mt-6 w-full bg-[#0088CC] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#0077b3] transition-colors shadow-lg shadow-[#0088CC]/20"
            >
              {tgChannels.length > 0 ? `Продолжить (${tgChannels.length} добавлено)` : 'Пропустить этот шаг'} <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* ШАГ 3: ПРЕДЛОЖЕНИЕ ВТОРОЙ СЕТИ */}
        {step === 'offer_second' && (
          <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white">Отличное начало!</h2>
            <p className="text-gray-400">Хотите сразу настроить сообщества для {firstChoice === 'vk' ? 'Telegram' : 'ВКонтакте'}?</p>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button onClick={() => setStep(firstChoice === 'vk' ? 'tg_setup' : 'vk_setup')} className="flex-1 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20">
                Да, настроить
              </button>
              <button onClick={() => setStep('contacts')} className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors text-white font-bold py-4 rounded-xl">
                Сделаю позже
              </button>
            </div>
          </div>
        )}

        {/* ШАГ 4: КОНТАКТЫ */}
        {step === 'contacts' && (
          <div className="space-y-6 text-center animate-in fade-in slide-in-from-right-8 duration-500">
            <h2 className="text-2xl font-bold text-white">Безопасность профиля</h2>
            <p className="text-gray-400 text-sm mb-6">Укажите контакты для защиты аккаунта, восстановления пароля и важных уведомлений.</p>
            
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ваш реальный Email" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Номер телефона (опционально)" className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors" />
              </div>
              
              {error && <p className="text-red-400 bg-red-400/10 py-2 rounded-lg border border-red-400/20 text-sm">{error}</p>}
              
              <button type="submit" disabled={loading} className="w-full bg-white text-black font-bold py-4 rounded-xl mt-4 hover:bg-gray-200 transition-colors shadow-lg shadow-white/10">
                {loading ? 'Отправка кода...' : 'Получить код подтверждения'}
              </button>
            </form>
          </div>
        )}

        {/* ШАГ 5: ПРОВЕРКА КОДА */}
        {step === 'verify' && (
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-500">
            <ShieldCheck className="mx-auto text-blue-500" size={48} />
            <h2 className="text-2xl font-bold text-white">Введите код</h2>
            <p className="text-gray-400">Шестизначный код отправлен на <br/><span className="text-white font-medium">{email}</span></p>
            
            <form onSubmit={handleVerifyCode} className="space-y-4 pt-2">
              <input type="text" maxLength="6" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-4 text-center text-3xl tracking-widest outline-none focus:border-blue-500 transition-colors" />
              
              {error && <p className="text-red-400 bg-red-400/10 py-2 rounded-lg border border-red-400/20 text-sm">{error}</p>}
              
              <button type="submit" disabled={loading || code.length !== 6} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20">
                {loading ? 'Проверка...' : 'Завершить настройку'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}