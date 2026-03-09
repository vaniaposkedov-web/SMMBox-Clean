import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, X, Send, Info, CheckCircle2, Plus, Trash2, Copy, Check, Loader2, UserCircle } from 'lucide-react';
import CustomTelegramButton from '../components/CustomTelegramButton';

export default function Onboarding() {
  const user = useStore(state => state.user);
  const profiles = useStore(state => state.profiles) || [];
  const fetchProfiles = useStore(state => state.fetchProfiles);
  const linkSocialProfile = useStore(state => state.linkSocialProfile);
  const saveVkGroupWithToken = useStore(state => state.saveVkGroupWithToken);
  const saveTgAccounts = useStore(state => state.saveTgAccounts);
  
  const navigate = useNavigate();
  
  const [step, setStep] = useState('welcome');
  const [firstChoice, setFirstChoice] = useState(null);
  
  const [tgInput, setTgInput] = useState('');
  const [tgChannels, setTgChannels] = useState([]); 
  
  const [vkStep, setVkStep] = useState(1);
  const [vkLinkInput, setVkLinkInput] = useState('');
  const [vkTokenInput, setVkTokenInput] = useState('');
  const [vkLoading, setVkLoading] = useState(false);
  const [vkConnectedGroups, setVkConnectedGroups] = useState([]);
  const [isVkProfileLoading, setIsVkProfileLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);

  const isPro = user?.isPro || false;
  const limits = isPro ? 100 : 10;

  // Жесткая проверка: наличие токена значит, что ВК полностью авторизован
  const hasVkToken = profiles.some(p => p.provider === 'VK' && p.accessToken && p.accessToken.length > 5);
  const vkProfile = profiles.find(p => p.provider === 'VK');
  const hasTgProfile = profiles.some(p => p.provider === 'TELEGRAM');

  useEffect(() => {
    if (user?.id) fetchProfiles(user.id);
  }, [user]);

  // ПРОПУСТИТЬ ВСЁ И В ПРОФИЛЬ
  const handleSkipAll = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/complete-onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ userId: user?.id }) 
      });
      const data = await res.json();
      if (data.success) {
        useStore.setState({ user: data.user });
        window.location.href = '/'; 
      } else {
        setError('Ошибка при завершении');
      }
    } catch (err) {}
    setLoading(false);
  };

  const handleVkConnectProfile = () => {
    setIsVkProfileLoading(true); setError('');
    const cleanAppId = String(import.meta.env.VITE_VK_APP_ID || '54471878').replace(/['"]/g, '').trim();
    const cleanRedirectUri = String(import.meta.env.VITE_VK_REDIRECT_URI || 'https://smmdeck.ru/api/accounts/vk/callback').replace(/['"]/g, '').trim();
    const url = `https://oauth.vk.com/authorize?client_id=${cleanAppId}&display=popup&redirect_uri=${encodeURIComponent(cleanRedirectUri)}&scope=groups,wall,photos,video,docs,offline&response_type=code&v=5.199`;

    const popup = window.open(url, 'vk_auth', `width=600,height=700,top=${window.screen.height/2-350},left=${window.screen.width/2-300},status=yes,scrollbars=yes`);
    
    const messageListener = async (event) => {
      if (event.data?.type === 'VK_GROUPS_LOADED') {
        const { accessToken, profile } = event.data.payload;
        const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Профиль ВК';
        const res = await linkSocialProfile(user.id, 'VK', profile.id, name, profile.photo_100, accessToken);
        if (res.success) { setVkStep(1); } else { setError(res.error || 'Ошибка привязки'); }
        setIsVkProfileLoading(false); window.removeEventListener('message', messageListener);
      } else if (event.data?.type === 'VK_AUTH_ERROR') {
        setError('Ошибка ВК: ' + event.data.error);
        setIsVkProfileLoading(false); window.removeEventListener('message', messageListener);
      }
    };
    window.addEventListener('message', messageListener);
    const checkClosed = setInterval(() => {
      if (popup?.closed) { clearInterval(checkClosed); setIsVkProfileLoading(false); window.removeEventListener('message', messageListener); }
    }, 1000);
  };

  const handleAddVkGroup = async () => {
    if (!vkLinkInput.trim() || !vkTokenInput.trim()) return setError('Заполните оба поля');
    setVkLoading(true); setError('');
    const res = await saveVkGroupWithToken(user.id, vkLinkInput, vkTokenInput);
    if (res.success) {
      setVkConnectedGroups(prev => [...prev, { name: res.group?.name, avatar: res.group?.avatar, link: vkLinkInput }]);
      setVkLinkInput(''); setVkTokenInput(''); setVkStep(1); 
    } else { setError(res.error || 'Ошибка при добавлении'); }
    setVkLoading(false);
  };

  // ЕСЛИ ЮЗЕР ПРИВЯЗЫВАЕТ ТГ ЧЕРЕЗ КНОПКУ (ЕСЛИ РЕГАЛСЯ ПО ПОЧТЕ)
  const handleLinkTg = async (tgUser) => {
    setTgLoading(true); setError('');
    const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'TG User';
    const res = await linkSocialProfile(user.id, 'TELEGRAM', String(tgUser.id), name, tgUser.photo_url, '');
    if (res.success) { await fetchProfiles(user.id); } else { setError('Ошибка привязки Telegram'); }
    setTgLoading(false);
  };

  const handleAddTgChannel = async () => {
    if (!tgInput.trim() || tgLoading) return;
    setTgLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/tg-chat-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: tgInput }) });
      const data = await res.json();
      if (data.success) {
        setTgChannels([...tgChannels, { chatId: data.chatId || data.username, title: data.title, username: data.username, avatar: data.avatar }]);
        setTgInput('');
      } else { setError(data.error); }
    } catch (err) { setError('Ошибка сервера'); }
    setTgLoading(false);
  };

  return (
    <div className="min-h-[100dvh] bg-admin-bg flex flex-col items-center justify-center p-4 relative font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      <button onClick={handleSkipAll} className="absolute top-6 right-6 text-gray-400 hover:text-white flex items-center gap-2 bg-gray-900/50 border border-gray-800 px-4 py-2.5 rounded-xl z-20 transition-all">
        <span className="text-sm font-medium">Пропустить настройки</span> <ArrowRight size={16} />
      </button>

      <div className="w-full max-w-xl bg-admin-card border border-gray-800/60 p-6 sm:p-10 rounded-[2rem] shadow-2xl relative z-10">
        
        {step === 'welcome' && (
          <div className="text-center space-y-6 animate-in fade-in">
            <h1 className="text-3xl font-bold text-white">Добро пожаловать! 👋</h1>
            <p className="text-gray-400">Давайте подключим ваши первые каналы для публикации постов.</p>
            <div className="grid grid-cols-2 gap-4 mt-6">
               <button onClick={() => { setFirstChoice('vk'); setStep('vk_setup'); }} className="group bg-[#0077FF]/10 hover:bg-[#0077FF]/20 border border-[#0077FF]/30 p-6 rounded-2xl text-[#0077FF] font-bold text-lg flex flex-col items-center gap-4 transition-all">
                 <div className="w-12 h-12 bg-[#0077FF] text-white rounded-xl flex items-center justify-center shadow-lg"><span className="text-2xl font-black">K</span></div>ВКонтакте
               </button>
               <button onClick={() => { setFirstChoice('tg'); setStep('tg_setup'); }} className="group bg-[#0088CC]/10 hover:bg-[#0088CC]/20 border border-[#0088CC]/30 p-6 rounded-2xl text-[#0088CC] font-bold text-lg flex flex-col items-center gap-4 transition-all">
                 <div className="w-12 h-12 bg-[#0088CC] text-white rounded-xl flex items-center justify-center shadow-lg"><Send size={22} /></div>Telegram
               </button>
            </div>
          </div>
        )}

        {step === 'vk_setup' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="text-center"><h2 className="text-2xl font-bold text-white">ВКонтакте</h2><p className="text-gray-400 mt-2">Добавление групп для постинга</p></div>
            <div className="min-h-[40px]">{error && <div className="text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20 text-sm">{error}</div>}</div>
            
            {/* ТРЕБУЕТСЯ АВТОРИЗАЦИЯ */}
            {!hasVkToken ? (
              <div className="flex flex-col gap-4 text-center">
                 <div className="bg-[#0077FF]/10 border border-[#0077FF]/20 rounded-2xl p-5">
                    <UserCircle size={40} className="mx-auto text-[#0077FF] mb-3" />
                    <h3 className="text-white font-bold">Нужен доступ к API</h3>
                    <p className="text-sm text-gray-300 mt-2">Для публикации в группы необходимо дать разрешение приложению ВКонтакте.</p>
                 </div>
                 <button onClick={handleVkConnectProfile} disabled={isVkProfileLoading} className="w-full bg-[#0077FF] hover:bg-[#0066DD] text-white py-4 rounded-xl font-bold text-base shadow-lg">
                  {isVkProfileLoading ? 'Привязка...' : 'Авторизовать ВКонтакте'}
                </button>
              </div>
            ) : (
              /* АВТОРИЗОВАН -> ДОБАВЛЕНИЕ ГРУПП */
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 p-4 rounded-2xl">
                   <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center"><CheckCircle2 className="text-emerald-500" size={20} /></div>
                   <div>
                     <p className="text-white font-bold">{vkProfile?.name || 'Профиль ВК'}</p>
                     <p className="text-gray-400 text-xs">Доступ к API получен</p>
                   </div>
                </div>

                {vkStep === 1 ? (
                  <div className="flex flex-col gap-3">
                    <input type="text" value={vkLinkInput} onChange={(e) => setVkLinkInput(e.target.value)} placeholder="Ссылка на группу (vk.com/public...)" className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl p-4 outline-none focus:border-[#0077FF]" />
                    <button onClick={() => { if (!vkLinkInput) return setError('Укажите ссылку'); setError(''); setVkStep(2); }} className="w-full bg-gray-800 hover:bg-gray-700 text-white p-4 rounded-xl font-bold">Далее</button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="bg-[#0077FF]/10 p-4 rounded-xl text-sm text-gray-300">В настройках группы создайте API-ключ (Управление, Фото, Стена) и вставьте ниже.</div>
                    <input type="text" value={vkTokenInput} onChange={(e) => setVkTokenInput(e.target.value)} placeholder="Ключ доступа (Токен)" className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl p-4 outline-none" />
                    <div className="flex gap-2">
                      <button onClick={() => setVkStep(1)} className="bg-gray-800 px-6 py-4 rounded-xl text-white font-bold">Назад</button>
                      <button onClick={handleAddVkGroup} disabled={vkLoading} className="flex-1 bg-[#0077FF] text-white py-4 rounded-xl font-bold">{vkLoading ? 'Проверка...' : 'Подключить'}</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {vkConnectedGroups.length > 0 && (
              <div className="mt-4"><h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Подключены ({vkConnectedGroups.length})</h3></div>
            )}

            {hasVkToken && (
              <button onClick={() => { firstChoice === 'vk' ? setStep('offer_second') : handleSkipAll(); }} className="mt-6 w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2">
                <span>{vkConnectedGroups.length > 0 ? 'Продолжить' : 'Сделать позже'}</span> <ArrowRight size={18} />
              </button>
            )}
          </div>
        )}

        {step === 'tg_setup' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="text-center"><h2 className="text-2xl font-bold text-white">Telegram</h2><p className="text-gray-400 mt-2">Добавление каналов для постинга</p></div>
            <div className="min-h-[40px]">{error && <div className="text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20 text-sm">{error}</div>}</div>
            
            {/* ЕСЛИ НЕТ ТГ-ПРОФИЛЯ (Регистрация по почте) */}
            {!hasTgProfile ? (
              <div className="flex flex-col gap-4 text-center items-center">
                 <div className="bg-[#0088CC]/10 border border-[#0088CC]/20 rounded-2xl p-5 w-full">
                    <Send size={40} className="mx-auto text-[#0088CC] mb-3" />
                    <h3 className="text-white font-bold">Привязка аккаунта</h3>
                    <p className="text-sm text-gray-300 mt-2 mb-4">Для управления каналами нужно привязать ваш Telegram-профиль.</p>
                    <div className="flex justify-center">
                      <CustomTelegramButton onAuthCallback={handleLinkTg} />
                    </div>
                 </div>
              </div>
            ) : (
              /* ЕСЛИ ТГ ПРИВЯЗАН (Или регались через ТГ) */
              <div className="space-y-4">
                <div className="bg-[#0088CC]/10 border border-[#0088CC]/20 rounded-2xl p-4 text-sm text-gray-300">
                  <p className="font-bold text-white mb-2">Добавьте нашего бота:</p>
                  <button onClick={() => { navigator.clipboard.writeText('@smmbox_auth_bot'); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="bg-gray-800 px-3 py-2 rounded-lg font-mono text-white flex items-center gap-2">
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />} @smmbox_auth_bot
                  </button>
                  <p className="mt-2">Дайте ему права на публикацию и вставьте ссылку на канал ниже.</p>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={tgInput} onChange={(e) => setTgInput(e.target.value)} placeholder="t.me/канал" className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-xl p-4 outline-none" />
                  <button onClick={handleAddTgChannel} disabled={tgLoading} className="bg-gray-800 text-white px-6 rounded-xl font-bold">{tgLoading ? '...' : <Plus size={20}/>}</button>
                </div>
                {tgChannels.length > 0 && <div className="text-sm text-gray-400 mt-2">Добавлено каналов: {tgChannels.length}</div>}
                
                <button onClick={async () => {
                  if (tgChannels.length > 0) { await saveTgAccounts(user?.id, tgChannels); }
                  firstChoice === 'tg' ? setStep('offer_second') : handleSkipAll();
                }} className="mt-6 w-full bg-[#0088CC] text-white font-bold py-4 rounded-xl flex justify-center gap-2">
                  <span>Продолжить</span> <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'offer_second' && (
          <div className="text-center space-y-6 animate-in fade-in">
            <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={32} /></div>
            <h2 className="text-3xl font-bold text-white">Супер!</h2>
            <p className="text-gray-400">Настроить сообщества для {firstChoice === 'vk' ? 'Telegram' : 'ВКонтакте'} прямо сейчас?</p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(firstChoice === 'vk' ? 'tg_setup' : 'vk_setup')} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-xl">Да, настроить</button>
              <button onClick={handleSkipAll} className="flex-1 bg-gray-800 text-white font-bold py-4 rounded-xl">В профиль</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}