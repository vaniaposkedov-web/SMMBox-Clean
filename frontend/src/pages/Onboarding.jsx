import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, X, Mail, Phone, Send, Info, CheckCircle2, Plus, Trash2, Copy, Check, Loader2, CheckSquare, Square } from 'lucide-react';

export default function Onboarding() {
  const user = useStore(state => state.user);
  const saveVkAccounts = useStore(state => state.saveVkAccounts);
  const navigate = useNavigate();
  
  const [step, setStep] = useState('welcome');
  const [firstChoice, setFirstChoice] = useState(null);
  
  const [tgInput, setTgInput] = useState('');
  const [tgChannels, setTgChannels] = useState([]); 
  const [vkConnected, setVkConnected] = useState(false);

  // === НОВЫЕ СОСТОЯНИЯ ДЛЯ ВК ===
  const [vkGroupsFetched, setVkGroupsFetched] = useState([]);
  const [selectedVkGroups, setSelectedVkGroups] = useState([]);
  const [vkAccessToken, setVkAccessToken] = useState('');
  const [isVkLoading, setIsVkLoading] = useState(false);
  const [isVkSaving, setIsVkSaving] = useState(false);

  const [email, setEmail] = useState(user?.email && !user.email.includes('.local') ? user.email : '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [copied, setCopied] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);

  // Вместо vkGroupsFetched и selectedVkGroups добавьте:
  const [vkStep, setVkStep] = useState(1);
  const [vkLinkInput, setVkLinkInput] = useState('');
  const [vkTokenInput, setVkTokenInput] = useState('');
  const [vkLoading, setVkLoading] = useState(false);
  const [vkConnectedGroups, setVkConnectedGroups] = useState([]);

  const saveVkGroupWithToken = useStore(state => state.saveVkGroupWithToken);

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

  const handleAddVkGroup = async () => {
  if (!vkLinkInput.trim() || !vkTokenInput.trim()) return setError('Заполните оба поля');
  setVkLoading(true); setError('');
  
  const res = await saveVkGroupWithToken(user.id, vkLinkInput, vkTokenInput);
  if (res.success) {
    setVkConnectedGroups([...vkConnectedGroups, vkLinkInput]);
    setVkLinkInput(''); setVkTokenInput('');
  } else {
    setError(res.error || 'Ошибка при добавлении');
  }
  setVkLoading(false);
};

  // === ЛОГИКА АВТОРИЗАЦИИ И ВЫБОРА ГРУПП ВК ===
  const handleVkConnect = () => {
    setIsVkLoading(true);
    setError('');

    const cleanAppId = String(import.meta.env.VITE_VK_APP_ID || '54471878').replace(/['"]/g, '').trim();
    const cleanRedirectUri = String(import.meta.env.VITE_VK_REDIRECT_URI || 'https://smmdeck.ru/api/accounts/vk/callback').replace(/['"]/g, '').trim();
    const scope = 'groups,wall,photos,video,docs,offline';
    const url = `https://oauth.vk.com/authorize?client_id=${cleanAppId}&display=popup&redirect_uri=${encodeURIComponent(cleanRedirectUri)}&scope=${scope}&response_type=code&v=5.199`;

    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const popup = window.open(url, 'vk_auth', `width=${width},height=${height},top=${top},left=${left},status=yes,scrollbars=yes`);
    
    const messageListener = (event) => {
      if (event.data?.type === 'VK_GROUPS_LOADED') {
        const { accessToken, groups } = event.data.payload;
        setVkAccessToken(accessToken);
        setVkGroupsFetched(groups);
        setSelectedVkGroups(groups.map(g => g.id));
        setIsVkLoading(false);
        window.removeEventListener('message', messageListener);
      } else if (event.data?.type === 'VK_AUTH_ERROR') {
        setError('Ошибка авторизации ВК: ' + event.data.error);
        setIsVkLoading(false);
        window.removeEventListener('message', messageListener);
      }
    };

    window.addEventListener('message', messageListener);

    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        if (isVkLoading) {
          setIsVkLoading(false);
          window.removeEventListener('message', messageListener);
        }
      }
    }, 1000);
  };

  const toggleVkGroup = (id) => {
    setSelectedVkGroups(prev => prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]);
  };

  const handleSaveVkGroups = async () => {
    if (selectedVkGroups.length === 0) return setError('Выберите хотя бы одну группу');
    setIsVkSaving(true);
    setError('');

    const groupsToSave = vkGroupsFetched.filter(g => selectedVkGroups.includes(g.id));
    const result = await saveVkAccounts(user.id, vkAccessToken, groupsToSave);
    
    if (result.success) {
      setVkConnected(true);
      setVkGroupsFetched([]); 
    } else {
      setError(result.error);
    }
    setIsVkSaving(false);
  };

  const handleAddTgChannel = async () => {
    if (!tgInput.trim() || tgLoading) return;
    if (tgChannels.some(c => c.originalInput === tgInput.trim())) { setTgInput(''); return; }
    setTgLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/tg-chat-info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: tgInput })
      });
      const data = await res.json();
      if (data.success) {
        setTgChannels([...tgChannels, { 
          originalInput: tgInput.trim(), 
          chatId: data.chatId || data.username, 
          title: data.title, 
          username: data.username, 
          avatar: data.avatar 
        }]);
        setTgInput('');
      } else { setError(data.error); }
    } catch (err) { setError('Ошибка соединения с сервером'); }
    setTgLoading(false);
  };

  const handleRemoveTgChannel = (channelToRemove) => setTgChannels(tgChannels.filter(c => c !== channelToRemove));
  
  const handleCopyBot = () => { 
    navigator.clipboard.writeText('@smmbox_auth_bot'); 
    setCopied(true); 
    setTimeout(() => setCopied(false), 2000); 
  };

  const handleContactsOrFinish = () => {
    // Проверяем: если почта нормальная (не .local) и уже подтверждена — пропускаем 'contacts'
    if (user?.email && !user.email.includes('.local') && user?.isEmailVerified) {
      finishOnboarding(); // Сразу завершаем онбординг
    } else {
      setStep('contacts'); // Иначе просим ввести почту
    }
  };

  const finishOnboarding = async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) { setError('Сессия истекла. Пожалуйста, войдите заново.'); setLoading(false); return; }
      
      if (tgChannels.length > 0) {
        const res = await useStore.getState().saveTgAccounts(user?.id, tgChannels);
        if (!res.success) {
          setError(res.error); 
          setLoading(false);
          return; 
        }
      }

      const res = await fetch('/api/auth/complete-onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ userId: user?.id }) 
      });
      const data = await res.json();
      if (data.success) { useStore.setState({ user: data.user }); navigate('/profile'); } 
      else { setError(data.error || 'Ошибка при завершении настройки'); }
    } catch (err) { setError('Ошибка соединения при сохранении профиля'); }
    setLoading(false);
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (phone && phone.length < 18) return setError('Пожалуйста, введите номер телефона полностью');
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/request-link-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, email }) });
      const data = await res.json();
      if (data.success) setStep('verify'); else setError(data.error);
    } catch (err) { setError('Ошибка соединения с сервером'); }
    setLoading(false);
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/verify-link-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, email, code, phone }) });
      const data = await res.json();
      if (data.success) { finishOnboarding(); } else { setError(data.error); }
    } catch (err) { setError('Ошибка соединения'); }
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] bg-admin-bg flex flex-col items-center justify-center p-4 relative overflow-y-auto overflow-x-hidden font-sans py-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] sm:w-[600px] sm:h-[600px] bg-blue-600/10 blur-[90px] sm:blur-[130px] rounded-full pointer-events-none"></div>

      <button onClick={finishOnboarding} className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 sm:right-6 text-gray-400 hover:text-white flex items-center justify-center gap-2 bg-gray-900/50 backdrop-blur-md border border-gray-800 px-4 py-2.5 rounded-xl transition-all z-20 hover:bg-gray-800 min-h-[44px] active:scale-95">
        <span className="text-sm font-medium">Пропустить</span> <X size={16} />
      </button>

      <div className="w-full max-w-xl bg-admin-card/80 backdrop-blur-2xl border border-gray-800/60 p-6 sm:p-10 rounded-[2rem] sm:rounded-3xl shadow-2xl relative z-10 mt-14 sm:mt-0 my-auto">
        
        {step === 'welcome' && (
          <div className="text-center space-y-4 sm:space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">Добро пожаловать! 👋</h1>
            <p className="text-gray-400 text-sm sm:text-lg leading-relaxed">Давайте подключим ваши первые каналы для автоматической публикации постов.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-6 pt-2">
               <button onClick={() => { setFirstChoice('vk'); setStep('vk_setup'); }} className="group relative overflow-hidden bg-[#0077FF]/10 hover:bg-[#0077FF]/20 border border-[#0077FF]/30 transition-all p-4 sm:p-6 rounded-2xl text-[#0077FF] font-bold text-base sm:text-lg flex flex-row sm:flex-col items-center justify-center sm:gap-3 gap-4 min-h-[80px] sm:min-h-[140px] active:scale-95">
                 <div className="w-12 h-12 bg-[#0077FF] text-white rounded-xl flex items-center justify-center shadow-lg shadow-[#0077FF]/30 group-hover:scale-110 transition-transform">
                    <span className="text-2xl font-black">K</span>
                 </div>
                 ВКонтакте
               </button>
               <button onClick={() => { setFirstChoice('tg'); setStep('tg_setup'); }} className="group relative overflow-hidden bg-[#0088CC]/10 hover:bg-[#0088CC]/20 border border-[#0088CC]/30 transition-all p-4 sm:p-6 rounded-2xl text-[#0088CC] font-bold text-base sm:text-lg flex flex-row sm:flex-col items-center justify-center sm:gap-3 gap-4 min-h-[80px] sm:min-h-[140px] active:scale-95">
                 <div className="w-12 h-12 bg-[#0088CC] text-white rounded-xl flex items-center justify-center shadow-lg shadow-[#0088CC]/30 group-hover:scale-110 transition-transform">
                    <Send size={22} className="ml-1" />
                 </div>
                 Telegram
               </button>
            </div>
          </div>
        )}

        {step === 'vk_setup' && (
          <div className="space-y-5 sm:space-y-6 text-left animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="text-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Сообщества ВКонтакте</h2>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">Подключение групп по API-ключу (без паролей).</p>
            </div>
            
            {/* ЗАЩИЩЕННЫЙ КОНТЕЙНЕР ДЛЯ ОШИБКИ (Предотвращает краш) */}
            <div className="min-h-[48px]">
              {error ? (
                <p className="text-red-400 bg-red-400/10 py-3 px-4 rounded-xl border border-red-400/20 text-xs sm:text-sm text-left animate-in fade-in">
                  {error}
                </p>
              ) : null}
            </div>
            
            <div className="space-y-3 mt-1 text-left">
              {vkStep === 1 ? (
                <div className="flex flex-col gap-3 animate-in fade-in">
                  <input 
                    type="text" value={vkLinkInput} onChange={(e) => setVkLinkInput(e.target.value)}
                    placeholder="Ссылка на группу (vk.com/public123)" 
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 outline-none focus:border-[#0077FF] min-h-[48px]"
                  />
                  {/* Обернули текст в SPAN */}
                  <button onClick={() => {
                    if (!vkLinkInput.trim()) return setError('Укажите ссылку на группу');
                    setError(''); setVkStep(2);
                  }} disabled={!vkLinkInput} className="w-full bg-[#0077FF] hover:bg-[#0066DD] text-white px-6 py-3.5 rounded-xl font-bold disabled:opacity-50 transition-colors">
                    <span>Далее: Инструкция по ключу</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4">
                  <div className="bg-[#0077FF]/10 border border-[#0077FF]/20 rounded-2xl p-4 text-sm text-gray-300">
                    <p className="font-bold text-white mb-2">Группа найдена! Теперь нужен API-ключ:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Зайдите в настройки вашей группы → <b>Работа с API</b></li>
                      <li>Нажмите <b>Создать ключ</b></li>
                      <li>Выберите права: <b>Управление, Фотографии, Стена</b></li>
                    </ol>
                  </div>
                  <input 
                    type="text" value={vkTokenInput} onChange={(e) => setVkTokenInput(e.target.value)}
                    placeholder="Ключ доступа (Токен)" 
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 outline-none focus:border-[#0077FF] min-h-[48px]"
                  />
                  <div className="flex gap-3">
                    <button onClick={() => setVkStep(1)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-3.5 rounded-xl font-bold transition-colors">
                      <span>Назад</span>
                    </button>
                    {/* Обернули текст загрузки и кнопки в SPAN */}
                    <button onClick={handleAddVkGroup} disabled={vkLoading || !vkTokenInput} className="flex-1 bg-[#0077FF] hover:bg-[#0066DD] text-white px-6 py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors">
                    {vkLoading ? (
                        <span className="flex items-center gap-2"><Loader2 className="animate-spin" /> Проверка...</span>
                    ) : (
                        <span>Подключить группу</span>
                    )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {vkConnectedGroups.length > 0 && (
              <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl mt-4 text-center">
                <CheckCircle2 className="mx-auto text-green-500 mb-1" size={24} />
                <p className="text-green-500 font-bold text-sm">Добавлено групп: {vkConnectedGroups.length}</p>
              </div>
            )}

            <button 
              onClick={() => { firstChoice === 'vk' ? setStep('offer_second') : handleContactsOrFinish(); }} 
              className="mt-6 w-full bg-white text-black font-bold py-3.5 sm:py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors text-base min-h-[48px] active:scale-95"
            >
              <span>{vkConnectedGroups.length > 0 ? 'Продолжить' : 'Пропустить шаг'}</span> <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === 'tg_setup' && (
          <div className="space-y-5 sm:space-y-6 text-left animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="text-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Каналы Telegram</h2>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">Добавьте неограниченное количество каналов.</p>
            </div>
            
            <div className="min-h-[48px] mb-2">
            {error ? (
                <p className="text-red-400 bg-red-400/10 py-3 px-4 rounded-xl border border-red-400/20 text-xs sm:text-sm text-left animate-in fade-in">
                {error}
                </p>
            ) : null}
            </div>
            
            <div className="bg-[#0088CC]/10 border border-[#0088CC]/20 rounded-2xl p-4 sm:p-5 space-y-3">
              <h3 className="text-[#0088CC] font-bold flex items-center gap-2 mb-2 text-sm sm:text-base">
                <Info size={18} /> Как подключить:
              </h3>
              <ol className="list-decimal list-inside text-gray-300 text-xs sm:text-sm space-y-2 ml-1 leading-relaxed">
                <li>Перейдите в настройки канала (раздел <b>Администраторы</b>).</li>
                <li className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                  <span>Добавьте бота:</span>
                  <button onClick={handleCopyBot} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs sm:text-sm transition-all active:scale-95 text-white bg-gray-800 border border-gray-700 min-h-[36px]">
                    {copied ? <><Check size={14} className="text-green-500" /> Скопировано</> : <><Copy size={14} /> @smmbox_auth_bot</>}
                  </button>
                </li>
                <li>Выдайте права на <b>публикацию сообщений</b>.</li>
                <li>Вставьте ссылку на канал ниже и нажмите «Добавить».</li>
              </ol>
            </div>

            <div className="space-y-4 mt-4 sm:mt-6">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <input 
                  type="text" value={tgInput} onChange={(e) => setTgInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTgChannel()}
                  placeholder="t.me/канал или @username" 
                  className="flex-1 w-full min-w-0 bg-gray-900 border border-gray-700 text-white rounded-xl py-3 sm:py-3.5 px-4 outline-none focus:border-[#0088CC] transition-colors placeholder:text-gray-500 text-base sm:text-sm min-h-[48px]"
                />
                <button onClick={handleAddTgChannel} disabled={!tgInput.trim() || tgLoading} className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-5 sm:px-6 py-3 rounded-xl border border-gray-700 transition-colors flex items-center justify-center shrink-0 min-h-[48px] active:scale-95 font-bold text-sm">
                  {tgLoading ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={18} className="mr-1"/> Добавить</>}
                </button>
              </div>

              {tgChannels.length > 0 && (
                <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                  {tgChannels.map((channel, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-900/50 border border-gray-800 p-3 sm:p-4 rounded-xl animate-in fade-in slide-in-from-bottom-2 min-h-[56px]">
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
                        {channel.avatar ? <img src={channel.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover border border-gray-700 shrink-0" /> : <div className="w-10 h-10 rounded-full bg-[#0088CC]/20 flex items-center justify-center shrink-0"><Send size={16} className="text-[#0088CC]" /></div>}
                        <div className="flex flex-col min-w-0">
                          <span className="text-gray-200 text-sm font-medium truncate">{channel.title}</span>
                          <span className="text-gray-500 text-xs truncate">{channel.username}</span>
                        </div>
                      </div>
                      <button onClick={() => handleRemoveTgChannel(channel)} className="text-gray-500 hover:text-red-400 bg-gray-800 hover:bg-red-500/10 w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center transition-colors shrink-0 active:scale-95"><Trash2 size={18} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              disabled={tgLoading}
              onClick={async () => {
                if (tgChannels.length > 0) {
                  setTgLoading(true);
                  setError('');
                  const res = await useStore.getState().saveTgAccounts(user?.id, tgChannels);
                  setTgLoading(false);
                  if (!res.success) { setError(res.error); return; }
                }
                firstChoice === 'tg' ? setStep('offer_second') : handleContactsOrFinish();
              }} 
              className="mt-6 w-full bg-[#0088CC] disabled:opacity-50 text-white font-bold py-3.5 sm:py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#0077b3] transition-colors shadow-lg shadow-[#0088CC]/20 text-base min-h-[48px] active:scale-95"
            >
              {tgLoading ? <Loader2 className="animate-spin" size={18} /> : null}
              <span>{tgChannels.length > 0 ? `Продолжить (${tgChannels.length})` : 'Пропустить шаг'}</span> 
              {!tgLoading && <ArrowRight size={18} />}
            </button>
          </div>
        )}

        {step === 'offer_second' && (
          <div className="text-center space-y-5 sm:space-y-6 animate-in fade-in zoom-in-95 duration-500 py-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2"><CheckCircle2 size={32} /></div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Отличное начало!</h2>
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-sm mx-auto">Хотите сразу настроить сообщества для {firstChoice === 'vk' ? 'Telegram' : 'ВКонтакте'}?</p>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button onClick={() => setStep(firstChoice === 'vk' ? 'tg_setup' : 'vk_setup')} className="flex-1 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-bold py-3.5 sm:py-4 rounded-xl shadow-lg shadow-blue-500/20 text-base min-h-[48px] active:scale-95">Да, настроить</button>
              <button onClick={handleContactsOrFinish} className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors text-white font-bold py-3.5 sm:py-4 rounded-xl text-base min-h-[48px] active:scale-95">Сделаю позже</button>
            </div>
          </div>
        )}

        {step === 'contacts' && (
          <div className="space-y-5 sm:space-y-6 text-center animate-in fade-in slide-in-from-right-8 duration-500">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Безопасность профиля</h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed">Укажите контакты для защиты аккаунта, восстановления пароля и важных уведомлений.</p>
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ваш реальный Email" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3.5 sm:py-4 pl-11 sm:pl-12 pr-4 outline-none focus:border-blue-500 transition-colors text-base sm:text-sm min-h-[48px]" />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input type="tel" value={phone} onChange={handlePhoneChange} placeholder="+7 (999) 000-00-00" className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3.5 sm:py-4 pl-11 sm:pl-12 pr-4 outline-none focus:border-blue-500 transition-colors text-base sm:text-sm min-h-[48px]" />
              </div>
              {error && <p className="text-red-400 bg-red-400/10 py-3 px-4 rounded-xl border border-red-400/20 text-xs sm:text-sm text-left">{error}</p>}
              
              <button type="submit" disabled={loading} className="w-full bg-white text-black font-bold py-3.5 sm:py-4 rounded-xl mt-4 hover:bg-gray-200 transition-colors shadow-lg shadow-white/10 text-base min-h-[48px] active:scale-95 disabled:opacity-70 flex justify-center items-center gap-2">
                {loading ? <><Loader2 className="animate-spin" size={18} /> Отправка кода...</> : 'Получить код подтверждения'}
              </button>
            </form>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-5 sm:space-y-6 text-center animate-in fade-in zoom-in-95 duration-500 py-2">
            <ShieldCheck className="mx-auto text-blue-500 sm:w-16 sm:h-16" size={48} />
            <h2 className="text-xl sm:text-2xl font-bold text-white">Введите код</h2>
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed">Шестизначный код отправлен на почту <br/><span className="text-white font-medium">{email}</span></p>
            <form onSubmit={handleVerifyCode} className="space-y-4 pt-2">
              <input type="text" maxLength="6" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-4 sm:py-5 text-center text-2xl sm:text-3xl tracking-[0.5em] outline-none focus:border-blue-500 transition-colors text-base sm:text-lg min-h-[60px] font-mono" />
              {error && <p className="text-red-400 bg-red-400/10 py-3 px-4 rounded-xl border border-red-400/20 text-xs sm:text-sm text-left">{error}</p>}
              
              <button type="submit" disabled={loading || code.length !== 6} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 sm:py-4 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20 text-base min-h-[48px] active:scale-95 flex justify-center items-center gap-2 mt-2">
                {loading ? <><Loader2 className="animate-spin" size={18} /> Проверка...</> : 'Завершить настройку'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}