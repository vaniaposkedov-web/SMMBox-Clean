import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Info, CheckCircle2, Plus, Trash2, 
  Check, Loader2, RefreshCw, X, Users, ChevronRight, Send
} from 'lucide-react';
import CustomTelegramButton from '../components/CustomTelegramButton';
import CustomVkButton from '../components/CustomVkButton';

export default function Onboarding() {
  const navigate = useNavigate();
  const user = useStore(state => state.user);
  const token = useStore(state => state.token);
  const profiles = useStore(state => state.profiles) || [];
  const accounts = useStore(state => state.accounts) || [];
  
  const fetchProfiles = useStore(state => state.fetchProfiles);
  const fetchAccounts = useStore(state => state.fetchAccounts);
  const completeOnboarding = useStore(state => state.completeOnboarding);
  const removeSocialProfile = useStore(state => state.removeSocialProfile);
  const removeAccount = useStore(state => state.removeAccount);
  const linkSocialProfile = useStore(state => state.linkSocialProfile);

  // === ЛИМИТЫ И ПРОВЕРКИ ===
  const isLimitReached = accounts.length >= 10;
  const vkProfile = profiles.find(p => p.provider === 'VK');
  const tgProfile = profiles.find(p => p.provider === 'TELEGRAM');

  // Загружаем данные при старте
  useEffect(() => {
    if (user?.id) {
      fetchProfiles(user.id);
      fetchAccounts(user.id);
    }
  }, [user?.id, fetchProfiles, fetchAccounts]);

  // === ЖЕЛЕЗОБЕТОННЫЕ ОБРАБОТЧИКИ АВТОРИЗАЦИИ ===
  const handleVkAuth = async (data) => {
    alert('✅ ВК передал данные сайту!');
    console.log('VK Payload:', data);
    
    if (!user || !user.id) {
      return alert('❌ Ошибка: ID пользователя не найден. Обновите страницу.');
    }

    try {
      await linkSocialProfile('VK', data);
      await fetchProfiles(user.id);
      alert('🎉 ВК успешно привязан!');
    } catch (error) {
      alert('❌ Ошибка сервера при сохранении ВК: ' + error.message);
    }
  };

  const handleTgAuth = async (data) => {
    alert('✅ Telegram передал данные сайту!');
    console.log('TG Payload:', data);
    
    if (!user || !user.id) {
      return alert('❌ Ошибка: ID пользователя не найден. Обновите страницу.');
    }

    try {
      await linkSocialProfile('TELEGRAM', data);
      await fetchProfiles(user.id);
      alert('🎉 Telegram успешно привязан!');
    } catch (error) {
      alert('❌ Ошибка сервера при сохранении TG: ' + error.message);
    }
  };

  // === ЛОГИКА ЗАВЕРШЕНИЯ / ПРОПУСКА ===
  const handleFinish = async () => {
    await completeOnboarding();
    navigate('/profile'); // Перенаправляем в кабинет
  };

  // === ЛОГИКА ВКОНТАКТЕ (ХАК ИЗ ACCOUNTS MANAGER) ===
  const [vkHackModal, setVkHackModal] = useState({ isOpen: false, profileId: null, step: 1, pastedUrl: '', tempToken: '' });
  const [isFetchingGroups, setIsFetchingGroups] = useState(false);
  const [vkGroupsList, setVkGroupsList] = useState([]);
  const [vkSelectedGroups, setVkSelectedGroups] = useState([]);

  const startVkHackAuth = (profileId) => {
    if (isLimitReached) return alert('Достигнут лимит в 10 сообществ!');
    setVkSelectedGroups([]); setVkGroupsList([]);
    setVkHackModal({ isOpen: true, profileId, step: 1, pastedUrl: '', tempToken: '' });
  };

  const openKateMobileAuth = () => {
    window.open(`https://oauth.vk.com/authorize?client_id=2685278&scope=groups,manage,wall,photos,offline&response_type=token&redirect_uri=https://oauth.vk.com/blank.html&display=popup`, '_blank', 'width=600,height=500');
  };

  const fetchGroupsViaJsonp = (accessToken) => {
    return new Promise((resolve) => {
      const callbackName = 'vkJsonpCallback_' + Math.round(100000 * Math.random());
      window[callbackName] = function(data) {
        delete window[callbackName];
        document.body.removeChild(script);
        if (data.error) resolve({ error: data.error.error_msg });
        else resolve({ groups: data.response ? data.response.items : [] });
      };
      const script = document.createElement('script');
      script.src = `https://api.vk.com/method/groups.get?extended=1&filter=admin,editor&access_token=${accessToken}&v=5.199&callback=${callbackName}`;
      script.onerror = () => {
        delete window[callbackName];
        document.body.removeChild(script);
        resolve({ error: 'Ошибка сети ВКонтакте' });
      };
      document.body.appendChild(script);
    });
  };

  const handlePasteUrl = async () => {
    const tokenMatch = vkHackModal.pastedUrl.match(/access_token=([^&]+)/);
    if (!tokenMatch) return alert('Ссылка не содержит токен! Скопируйте всю строку.');
    
    const extractedToken = tokenMatch[1];
    setVkHackModal(prev => ({ ...prev, tempToken: extractedToken, step: 2 }));
    setIsFetchingGroups(true);

    const res = await fetchGroupsViaJsonp(extractedToken);
    if (res.error) {
      alert(`Ошибка ВК: ${res.error}`);
      setVkHackModal(prev => ({ ...prev, step: 1 }));
    } else {
      const existingIds = accounts.filter(a => a.provider === 'VK').map(a => a.providerId);
      setVkGroupsList(res.groups.filter(g => !existingIds.includes(String(g.id))));
    }
    setIsFetchingGroups(false);
  };

  const saveHackGroups = async () => {
    if (accounts.length + vkSelectedGroups.length > 10) {
      return alert('Вы не можете добавить больше 10 сообществ суммарно!');
    }
    setIsFetchingGroups(true);
    const groupsToSave = vkGroupsList.filter(g => vkSelectedGroups.includes(g.id)).map(g => ({
      id: g.id, name: g.name, avatarUrl: g.photo_100, accessToken: vkHackModal.tempToken
    }));

    try {
      const res = await fetch('/api/accounts/vk/save-group-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, profileId: vkHackModal.profileId, groups: groupsToSave })
      });
      const data = await res.json();
      if (data.success) {
        await fetchAccounts(user.id);
        setVkHackModal({ isOpen: false, profileId: null, step: 1, pastedUrl: '', tempToken: '' });
      } else alert(data.error || 'Ошибка сохранения');
    } catch (e) { alert('Ошибка сети'); }
    setIsFetchingGroups(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col pt-8 pb-24 px-4 sm:px-6 relative overflow-hidden">
      {/* Декоративный фон */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#0077FF]/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#0088CC]/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-3xl w-full mx-auto space-y-8 sm:space-y-10 relative z-10">
        
        {/* === ШАПКА === */}
        <div className="text-center space-y-3 pt-6">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">Настройка аккаунта</h1>
          <p className="text-sm sm:text-base text-gray-400 max-w-xl mx-auto">
            Подключите профили соцсетей и добавьте до 10 сообществ. Вы можете пропустить этот шаг и сделать это позже в настройках.
          </p>
          <div className="inline-flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-full px-4 py-1.5 text-sm font-medium mt-4">
            <span className="text-gray-400">Добавлено сообществ:</span>
            <span className={isLimitReached ? "text-rose-500 font-bold" : "text-emerald-400 font-bold"}>
              {accounts.length} / 10
            </span>
          </div>
        </div>

        {/* === БЛОК ВКОНТАКТЕ === */}
        <div className="bg-gradient-to-br from-gray-900 to-[#0d0f13] border border-gray-800/80 rounded-3xl p-5 sm:p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#0077FF]/10 flex items-center justify-center text-[#0077FF]">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">ВКонтакте</h2>
              <p className="text-xs sm:text-sm text-gray-400">Группы и личные страницы</p>
            </div>
          </div>

          {!vkProfile ? (
            <div className="flex flex-col items-center justify-center py-8 bg-gray-950/50 rounded-2xl border border-dashed border-gray-800">
              <p className="text-gray-500 text-sm mb-4 text-center px-4">Для добавления групп привяжите свой профиль ВК</p>
              <CustomVkButton onAuth={handleVkAuth} />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Карточка профиля ВК (Из AccountsManager) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-800/60 rounded-xl border border-[#0077FF]/30 gap-3 sm:gap-2">
                <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto sm:flex-[2]">
                  <img src={vkProfile.avatarUrl} className="w-10 h-10 rounded-full object-cover border border-gray-700 shrink-0" alt="VK" />
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-bold text-sm sm:text-base truncate leading-tight">{vkProfile.name}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 shrink-0">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider bg-emerald-400/10 px-2 py-1 rounded-md">Привязан</span>
                  <button onClick={async () => { if (window.confirm('Отключить профиль?')) await removeSocialProfile(vkProfile.id); }} className="p-1.5 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Список добавленных групп ВК */}
              <div className="pl-4 sm:pl-6 border-l-2 border-gray-800/60 space-y-2 mt-2">
                {accounts.filter(a => a.provider === 'VK').map(acc => (
                  <div key={acc.id} className="flex items-center justify-between bg-gray-900/40 p-2 sm:p-3 rounded-xl border border-gray-800/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={acc.avatarUrl} className="w-8 h-8 rounded-full shrink-0" alt=""/>
                      <span className="text-sm font-medium truncate">{acc.name}</span>
                    </div>
                    <button onClick={() => removeAccount(acc.id)} className="text-gray-500 hover:text-rose-500 p-1"><X size={16}/></button>
                  </div>
                ))}
                
                <button 
                  onClick={() => startVkHackAuth(vkProfile.id)}
                  disabled={isLimitReached}
                  className="w-full mt-2 bg-[#0077FF]/10 hover:bg-[#0077FF]/20 text-[#0077FF] border border-[#0077FF]/30 px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-bold text-sm disabled:opacity-50"
                >
                  <Plus size={18} /> Добавить сообщества
                </button>
              </div>
            </div>
          )}
        </div>

        {/* === БЛОК TELEGRAM === */}
        <div className="bg-gradient-to-br from-gray-900 to-[#0d0f13] border border-gray-800/80 rounded-3xl p-5 sm:p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#0088CC]/10 flex items-center justify-center text-[#0088CC]">
              <Send size={24} className="ml-1" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Telegram</h2>
              <p className="text-xs sm:text-sm text-gray-400">Ваши каналы</p>
            </div>
          </div>

          {!tgProfile ? (
            <div className="flex flex-col items-center justify-center py-8 bg-gray-950/50 rounded-2xl border border-dashed border-gray-800">
              <p className="text-gray-500 text-sm mb-4 text-center px-4">Для добавления каналов авторизуйтесь через Telegram</p>
              <CustomTelegramButton onAuthCallback={handleTgAuth} />
            </div>
          ) : (
            <div className="space-y-4">
               {/* Карточка профиля TG */}
               <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-800/60 rounded-xl border border-[#0088CC]/30 gap-3 sm:gap-2">
                <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto sm:flex-[2]">
                  <img src={tgProfile.avatarUrl} className="w-10 h-10 rounded-full object-cover border border-gray-700 shrink-0" alt="TG" />
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-bold text-sm sm:text-base truncate leading-tight">{tgProfile.name}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 shrink-0">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider bg-emerald-400/10 px-2 py-1 rounded-md">Привязан</span>
                  <button onClick={async () => { if (window.confirm('Отключить профиль?')) await removeSocialProfile(tgProfile.id); }} className="p-1.5 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Список добавленных каналов TG */}
              <div className="pl-4 sm:pl-6 border-l-2 border-gray-800/60 space-y-2 mt-2">
                {accounts.filter(a => a.provider === 'TELEGRAM').map(acc => (
                  <div key={acc.id} className="flex items-center justify-between bg-gray-900/40 p-2 sm:p-3 rounded-xl border border-gray-800/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={acc.avatarUrl} className="w-8 h-8 rounded-full shrink-0" alt=""/>
                      <span className="text-sm font-medium truncate">{acc.name}</span>
                    </div>
                    <button onClick={() => removeAccount(acc.id)} className="text-gray-500 hover:text-rose-500 p-1"><X size={16}/></button>
                  </div>
                ))}
                
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  {isLimitReached ? (
                    <button onClick={() => alert('Лимит исчерпан!')} className="flex-1 bg-[#0088CC]/5 text-[#0088CC]/50 border border-[#0088CC]/10 px-4 py-3 rounded-xl flex justify-center items-center gap-2 font-bold text-sm cursor-not-allowed">
                      <Plus size={18} /> Добавить канал
                    </button>
                  ) : (
                    <a href="https://t.me/smmbox_auth_bot?startchannel=true&admin=post_messages+edit_messages+delete_messages" target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#0088CC]/10 hover:bg-[#0088CC]/20 text-[#0088CC] border border-[#0088CC]/30 px-4 py-3 rounded-xl transition-all flex justify-center items-center gap-2 font-bold text-sm">
                      <Plus size={18} /> Добавить канал
                    </a>
                  )}
                  <button onClick={() => fetchAccounts(user.id)} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-xl transition-all flex justify-center items-center">
                    <RefreshCw size={18} />
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">Нажмите кнопку, выберите канал в Telegram и нажмите Обновить.</p>
              </div>
            </div>
          )}
        </div>

        {/* === КНОПКИ УПРАВЛЕНИЯ (ФУТЕР) === */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-800/50">
          <button 
            onClick={handleFinish} 
            className="w-full sm:w-auto text-gray-400 hover:text-white px-6 py-3 font-medium transition-colors order-2 sm:order-1"
          >
            Пропустить
          </button>
          
          <button 
            onClick={handleFinish}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg active:scale-95 order-1 sm:order-2 ${
              accounts.length > 0 
              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20" 
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {accounts.length > 0 ? "Завершить настройку" : "Перейти в кабинет"} <ArrowRight size={18} />
          </button>
        </div>

      </div>

      {/* === МОДАЛЬНОЕ ОКНО ВК === */}
      {vkHackModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0d0f13] border border-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 shrink-0">
              <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                <Users size={20} className="text-[#0077FF]" /> Подключение ВК
              </h3>
              <button onClick={() => setVkHackModal(prev => ({ ...prev, isOpen: false }))} className="text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 p-1.5 rounded-lg transition-all"><X size={20}/></button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar">
              {vkHackModal.step === 1 ? (
                <div className="space-y-5">
                  <div className="bg-[#0077FF]/10 border border-[#0077FF]/20 rounded-xl p-4 text-sm text-blue-200">
                    Нажмите кнопку ниже, разрешите доступ, скопируйте всю ссылку из адресной строки и вставьте сюда.
                  </div>
                  <button onClick={openKateMobileAuth} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white py-3.5 rounded-xl font-bold transition-all flex justify-center items-center gap-2">
                    Получить ссылку <ChevronRight size={18} />
                  </button>
                  <div className="relative">
                    <input 
                      type="text" placeholder="https://oauth.vk.com/blank.html#access_token=..." 
                      value={vkHackModal.pastedUrl} onChange={e => setVkHackModal(prev => ({...prev, pastedUrl: e.target.value}))}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3.5 text-white text-sm focus:border-[#0077FF] outline-none placeholder-gray-600"
                    />
                  </div>
                  <button onClick={handlePasteUrl} disabled={!vkHackModal.pastedUrl} className="w-full bg-[#0077FF] hover:bg-[#0066CC] disabled:bg-gray-800 disabled:text-gray-500 text-white py-3.5 rounded-xl font-bold transition-all active:scale-95">
                    Далее
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-300 text-sm px-1 mb-3">Выберите сообщества ({vkGroupsList.length}):</h4>
                  {isFetchingGroups ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-500"><Loader2 className="animate-spin text-[#0077FF]" size={32}/><span>Загружаем...</span></div>
                  ) : vkGroupsList.length === 0 ? (
                    <p className="text-gray-500 text-center py-6">Нет доступных сообществ</p>
                  ) : (
                    vkGroupsList.map(group => (
                      <div key={group.id} onClick={() => setVkSelectedGroups(prev => prev.includes(group.id) ? prev.filter(id => id !== group.id) : [...prev, group.id])} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${vkSelectedGroups.includes(group.id) ? 'bg-[#0077FF]/10 border-[#0077FF]/30' : 'bg-gray-900/50 border-gray-800 hover:border-gray-600'}`}>
                        <div className="flex items-center gap-3 min-w-0"><img src={group.photo_100} className="w-10 h-10 rounded-full shrink-0" alt=""/><span className="text-white font-medium text-sm truncate">{group.name}</span></div>
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${vkSelectedGroups.includes(group.id) ? 'bg-[#0077FF] border-[#0077FF]' : 'border-gray-600'}`}>{vkSelectedGroups.includes(group.id) && <Check size={14} className="text-white" />}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {vkHackModal.step === 2 && (
              <div className="p-4 sm:p-5 border-t border-gray-800 bg-[#0d0f13] shrink-0">
                <button onClick={saveHackGroups} disabled={vkSelectedGroups.length === 0 || isFetchingGroups} className="w-full bg-[#0077FF] hover:bg-[#0066CC] disabled:bg-gray-800 disabled:text-gray-500 text-white py-3.5 rounded-xl font-bold transition-all flex justify-center items-center gap-2 active:scale-95">
                  Добавить ({vkSelectedGroups.length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}