import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Send, Info, CheckCircle2, Plus, Trash2, Copy, Check, Loader2 } from 'lucide-react';
import CustomTelegramButton from '../components/CustomTelegramButton';

export default function Onboarding() {
  const user = useStore(state => state.user);
  const profiles = useStore(state => state.profiles) || [];
  const accounts = useStore(state => state.accounts) || [];
  
  const fetchProfiles = useStore(state => state.fetchProfiles);
  const fetchAccounts = useStore(state => state.fetchAccounts);
  const linkSocialProfile = useStore(state => state.linkSocialProfile);
  const saveVkGroupWithToken = useStore(state => state.saveVkGroupWithToken);
  const saveTgAccounts = useStore(state => state.saveTgAccounts);
  const removeAccount = useStore(state => state.removeAccount);
  
  const navigate = useNavigate();
  
  const [step, setStep] = useState('welcome');
  const [firstChoice, setFirstChoice] = useState(null);
  
  const [tgInput, setTgInput] = useState('');
  const [tgChannels, setTgChannels] = useState([]); 
  
  const [vkStep, setVkStep] = useState(1);
  const [vkLinkInput, setVkLinkInput] = useState('');
  const [vkTokenInput, setVkTokenInput] = useState('');
  const [vkLoading, setVkLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);

  const isPro = user?.isPro || false;
  const limits = isPro ? 100 : 10;

  // --- ГЛОБАЛЬНЫЙ СЧЕТЧИК (Считает реальные аккаунты в БД + новые ТГ каналы, которые еще не сохранены) ---
  const currentTotalAccounts = accounts.length + tgChannels.length;

  const hasTgProfile = profiles.some(p => p.provider === 'TELEGRAM');
  // Фильтруем реальные ВК группы прямо из базы
  const vkConnectedGroups = accounts.filter(a => a.provider === 'VK');

  useEffect(() => {
    if (user?.id) {
      fetchProfiles(user.id);
      fetchAccounts(user.id);
    }
  }, [user]);

  // ПРОПУСТИТЬ ВСЁ И В ПРОФИЛЬ
  const handleSkipAll = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/complete-onboarding', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
        body: JSON.stringify({ userId: user?.id }) 
      });
      const data = await res.json();
      if (data.success) {
        useStore.setState({ user: data.user });
        window.location.href = '/'; 
      }
    } catch (err) {}
    setLoading(false);
  };

  // --- ЛОГИКА ВКОНТАКТЕ ---
  const handleAddVkGroup = async () => {
    if (!vkLinkInput.trim() || !vkTokenInput.trim()) return setError('Заполните оба поля');
    if (currentTotalAccounts >= limits) return setError(`Достигнут глобальный лимит: ${limits} аккаунтов.`);
    
    setVkLoading(true); setError('');
    const res = await saveVkGroupWithToken(user.id, vkLinkInput, vkTokenInput);
    
    if (res.success) {
      setVkLinkInput(''); 
      setVkTokenInput(''); 
      setVkStep(1); 
      await fetchAccounts(user.id); // Сразу обновляем БД, группа появится в списке ниже
    } else { 
      setError(res.error || 'Ошибка при добавлении'); 
    }
    setVkLoading(false);
  };

  const handleRemoveVkGroup = async (accountId) => {
    await removeAccount(accountId);
    await fetchAccounts(user.id);
  };

  // --- ЛОГИКА TELEGRAM ---
  const handleLinkTg = async (tgUser) => {
    setTgLoading(true); setError('');
    const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'TG User';
    const res = await linkSocialProfile(user.id, 'TELEGRAM', String(tgUser.id), name, tgUser.photo_url, '');
    if (res.success) {
      await fetchProfiles(user.id); 
    } else { 
      setError('Ошибка привязки Telegram'); 
    }
    setTgLoading(false);
  };

  const handleAddTgChannel = async () => {
    if (!tgInput.trim() || tgLoading) return;
    if (currentTotalAccounts >= limits) return setError(`Достигнут глобальный лимит: ${limits} аккаунтов.`);
    if (tgChannels.some(c => c.originalInput === tgInput.trim())) { setTgInput(''); return; }

    setTgLoading(true); setError('');
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
          chatId: data.chatId || data.username, 
          title: data.title, 
          username: data.username, 
          avatar: data.avatar 
        }]);
        setTgInput('');
      } else { 
        setError(data.error); 
      }
    } catch (err) { 
      setError('Ошибка сервера'); 
    }
    setTgLoading(false);
  };

  // ФУНКЦИЯ УДАЛЕНИЯ, ИЗ-ЗА КОТОРОЙ БЫЛА ОШИБКА - ТЕПЕРЬ ОНА ЕСТЬ!
  const removeTgChannel = (channelToRemove) => {
    setTgChannels(tgChannels.filter(c => c.chatId !== channelToRemove.chatId));
  };

  const saveTgAndContinue = async () => {
    if (tgChannels.length > 0) { 
      setLoading(true);
      await saveTgAccounts(user?.id, tgChannels); 
      setLoading(false);
    }
    firstChoice === 'tg' ? setStep('offer_second') : handleSkipAll();
  };

  return (
    <div className="min-h-[100dvh] bg-admin-bg flex flex-col items-center justify-center p-4 relative font-sans">
      <button onClick={handleSkipAll} className="absolute top-6 right-6 text-gray-400 hover:text-white flex items-center gap-2 bg-gray-900/50 border border-gray-800 px-4 py-2.5 rounded-xl z-20 transition-colors">
        <span className="text-sm font-medium">Пропустить настройки</span> <ArrowRight size={16} />
      </button>

      <div className="w-full max-w-xl bg-admin-card border border-gray-800/60 p-6 sm:p-10 rounded-[2rem] shadow-2xl relative z-10">
        
        {/* --- ЭКРАН ВЫБОРА --- */}
        {step === 'welcome' && (
          <div className="text-center space-y-6 animate-in fade-in">
            <h1 className="text-3xl font-bold text-white">Добро пожаловать! 👋</h1>
            <p className="text-gray-400">Давайте подключим ваши первые каналы для автоматической публикации.</p>
            <div className="grid grid-cols-2 gap-4 mt-6">
               <button onClick={() => { setFirstChoice('vk'); setStep('vk_setup'); }} className="group bg-[#0077FF]/10 hover:bg-[#0077FF]/20 border border-[#0077FF]/30 p-6 rounded-2xl text-[#0077FF] font-bold text-lg flex flex-col items-center gap-4 transition-all active:scale-95">
                 <div className="w-12 h-12 bg-[#0077FF] text-white rounded-xl flex items-center justify-center shadow-lg"><span className="text-2xl font-black">K</span></div>ВКонтакте
               </button>
               <button onClick={() => { setFirstChoice('tg'); setStep('tg_setup'); }} className="group bg-[#0088CC]/10 hover:bg-[#0088CC]/20 border border-[#0088CC]/30 p-6 rounded-2xl text-[#0088CC] font-bold text-lg flex flex-col items-center gap-4 transition-all active:scale-95">
                 <div className="w-12 h-12 bg-[#0088CC] text-white rounded-xl flex items-center justify-center shadow-lg"><Send size={22} /></div>Telegram
               </button>
            </div>
          </div>
        )}

        {/* --- ЭКРАН ВКОНТАКТЕ --- */}
        {step === 'vk_setup' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                <span className="w-6 h-6 bg-[#0077FF] rounded flex items-center justify-center text-xs text-white">K</span> ВКонтакте
              </h2>
              <p className="text-gray-400 mt-2">Добавление групп для постинга</p>
            </div>
            
            <div className="min-h-[40px]">{error && <div className="text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20 text-sm">{error}</div>}</div>
            
            <div className="space-y-4">
              {vkStep === 1 ? (
                <div className="flex flex-col gap-3">
                  <input type="text" value={vkLinkInput} onChange={(e) => setVkLinkInput(e.target.value)} placeholder="Ссылка на группу (vk.com/public...)" className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl p-4 outline-none focus:border-[#0077FF] transition-colors" />
                  <button onClick={() => { if (!vkLinkInput) return setError('Укажите ссылку на группу'); setError(''); setVkStep(2); }} className="w-full bg-gray-800 hover:bg-gray-700 text-white p-4 rounded-xl font-bold transition-colors">Далее</button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 animate-in slide-in-from-right-4">
                  <div className="bg-[#0077FF]/10 border border-[#0077FF]/20 p-5 rounded-2xl text-sm text-gray-300">
                    <p className="font-bold text-white mb-3 text-base">Инструкция:</p>
                    <ol className="list-decimal list-inside space-y-3">
                      <li>В настройках вашей группы ВК откройте <b>Работа с API</b>.</li>
                      <li>Нажмите <b>Создать ключ</b>.</li>
                      <li>Выберите права: <b>Управление, Фотографии, Стена</b>.</li>
                      <li>Скопируйте полученный ключ и вставьте его ниже.</li>
                    </ol>
                  </div>
                  <input type="text" value={vkTokenInput} onChange={(e) => setVkTokenInput(e.target.value)} placeholder="Ключ доступа (Токен)" className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl p-4 outline-none focus:border-[#0077FF]" />
                  <div className="flex gap-2">
                    <button onClick={() => setVkStep(1)} className="bg-gray-800 hover:bg-gray-700 px-6 py-4 rounded-xl text-white font-bold transition-colors">Назад</button>
                    <button onClick={handleAddVkGroup} disabled={vkLoading || !vkTokenInput} className="flex-1 bg-[#0077FF] hover:bg-[#0066DD] text-white py-4 rounded-xl font-bold disabled:opacity-50 transition-colors">
                      {vkLoading ? 'Проверка...' : 'Подключить группу'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ВИЗУАЛИЗАЦИЯ И УДАЛЕНИЕ ДОБАВЛЕННЫХ ГРУПП ВК */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">Всего аккаунтов (ВК + ТГ)</h3>
                <span className={`text-xs font-mono px-2 py-1 rounded-md ${currentTotalAccounts >= limits ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-300'}`}>
                  {currentTotalAccounts} / {limits}
                </span>
              </div>
              
              {vkConnectedGroups.length > 0 && (
                <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1 mt-4">
                  {vkConnectedGroups.map((group) => (
                    <div key={group.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 p-3 rounded-xl animate-in fade-in zoom-in-95">
                      <div className="flex items-center gap-3 min-w-0">
                        {group.avatarUrl ? <img src={group.avatarUrl} alt="avatar" className="w-10 h-10 rounded-full object-cover shrink-0" /> : <div className="w-10 h-10 rounded-full bg-[#0077FF]/20 flex items-center justify-center shrink-0"><span className="text-[#0077FF] font-bold">K</span></div>}
                        <span className="text-white text-sm font-medium truncate">{group.name}</span>
                      </div>
                      <button onClick={() => handleRemoveVkGroup(group.id)} className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-gray-800 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => { firstChoice === 'vk' ? setStep('offer_second') : handleSkipAll(); }} className="mt-6 w-full bg-white hover:bg-gray-200 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-95">
              <span>{vkConnectedGroups.length > 0 ? 'Продолжить' : 'Сделать позже'}</span> <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* --- ЭКРАН TELEGRAM --- */}
        {step === 'tg_setup' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2"><Send size={24} className="text-[#0088CC]" /> Telegram</h2>
              <p className="text-gray-400 mt-2">Добавление каналов для постинга</p>
            </div>
            
            <div className="min-h-[40px]">{error && <div className="text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20 text-sm">{error}</div>}</div>
            
            {!hasTgProfile ? (
              <div className="flex flex-col gap-4 text-center items-center">
                 <div className="bg-[#0088CC]/10 border border-[#0088CC]/20 rounded-2xl p-6 w-full">
                    <Info size={40} className="mx-auto text-[#0088CC] mb-4" />
                    <h3 className="text-white font-bold text-lg">Нужна авторизация</h3>
                    <p className="text-sm text-gray-300 mt-2 mb-6">Для управления каналами, пожалуйста, привяжите ваш профиль.</p>
                    <div className="flex justify-center"><CustomTelegramButton onAuthCallback={handleLinkTg} /></div>
                 </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#0088CC]/10 border border-[#0088CC]/20 rounded-2xl p-5 text-sm text-gray-300">
                  <p className="font-bold text-white mb-3 text-base">Как подключить канал:</p>
                  <ol className="list-decimal list-inside space-y-3">
                    <li>Откройте настройки вашего канала.</li>
                    <li>Перейдите в раздел <b>Администраторы</b>.</li>
                    <li>
                      Добавьте нашего бота в администраторы:
                      <div className="mt-2 inline-flex items-center gap-2">
                        <button onClick={() => { navigator.clipboard.writeText('@smmbox_auth_bot'); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg font-mono text-white flex items-center gap-1.5 transition-colors active:scale-95">
                          {copied ? <><Check size={14} className="text-green-500" /> Скопировано</> : <><Copy size={14} /> @smmbox_auth_bot</>}
                        </button>
                      </div>
                    </li>
                    <li>Дайте боту права на <b>публикацию сообщений</b>.</li>
                    <li>Вставьте ссылку на канал ниже.</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <input type="text" value={tgInput} onChange={(e) => setTgInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTgChannel()} placeholder="t.me/вашканал или @username" className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-xl p-4 outline-none focus:border-[#0088CC] transition-colors" />
                  <button onClick={handleAddTgChannel} disabled={tgLoading || !tgInput} className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-6 rounded-xl font-bold transition-colors">
                    {tgLoading ? <Loader2 size={20} className="animate-spin"/> : <Plus size={20}/>}
                  </button>
                </div>

                {/* ВИЗУАЛИЗАЦИЯ И УДАЛЕНИЕ ДОБАВЛЕННЫХ КАНАЛОВ ТГ */}
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase">Всего аккаунтов (ВК + ТГ)</h3>
                    <span className={`text-xs font-mono px-2 py-1 rounded-md ${currentTotalAccounts >= limits ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-300'}`}>
                      {currentTotalAccounts} / {limits}
                    </span>
                  </div>
                  
                  {tgChannels.length > 0 && (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1 mt-4">
                      {tgChannels.map((channel, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-gray-900 border border-gray-800 p-3 rounded-xl animate-in fade-in zoom-in-95">
                          <div className="flex items-center gap-3 min-w-0">
                            {channel.avatar ? <img src={channel.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover shrink-0" /> : <div className="w-10 h-10 rounded-full bg-[#0088CC]/20 flex items-center justify-center shrink-0"><Send size={16} className="text-[#0088CC]" /></div>}
                            <div className="flex flex-col min-w-0">
                              <span className="text-white text-sm font-medium truncate">{channel.title}</span>
                              <span className="text-gray-500 text-xs truncate">{channel.username}</span>
                            </div>
                          </div>
                          {/* КНОПКА УДАЛЕНИЯ, КОТОРАЯ ТЕПЕРЬ РАБОТАЕТ */}
                          <button onClick={() => removeTgChannel(channel)} className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-gray-800 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <button onClick={saveTgAndContinue} disabled={loading} className="mt-6 w-full bg-[#0088CC] hover:bg-[#0077B3] disabled:opacity-50 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-colors shadow-lg shadow-[#0088CC]/20 active:scale-95">
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <><span>{tgChannels.length > 0 ? 'Сохранить и продолжить' : 'Сделать позже'}</span> <ArrowRight size={18} /></>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- ЭКРАН УСПЕХА --- */}
        {step === 'offer_second' && (
          <div className="text-center space-y-6 animate-in fade-in">
            <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(34,197,94,0.2)]"><CheckCircle2 size={40} /></div>
            <h2 className="text-3xl font-bold text-white">Супер!</h2>
            <p className="text-gray-400">Первая соцсеть подключена. Настроить {firstChoice === 'vk' ? 'Telegram' : 'ВКонтакте'} прямо сейчас?</p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(firstChoice === 'vk' ? 'tg_setup' : 'vk_setup')} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-blue-500/20">Да, настроить</button>
              <button onClick={handleSkipAll} className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-bold py-4 rounded-xl transition-colors">В профиль</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}