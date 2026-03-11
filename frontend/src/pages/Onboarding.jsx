import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Info, Plus, Trash2, X, RefreshCw, Send, Loader2, Users, Check
} from 'lucide-react';

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
  const setVkhModal = useStore(state => state.setVkhModal);
  const linkSocialProfile = useStore(state => state.linkSocialProfile);

  // === ЛИМИТЫ И ПРОВЕРКИ ===
  const isLimitReached = accounts.length >= 10;
  const vkProfile = profiles.find(p => p.provider === 'VK');
  const tgProfile = profiles.find(p => p.provider === 'TELEGRAM');

  const handleVkAuth = async (data) => {
    if (!user || !user.id) return alert('Ошибка: ID пользователя не найден');
    try {
      const vkUser = data.profile || (data.session && data.session.user) || data.user || data;
      if (!vkUser || (!vkUser.id && !vkUser.uid && !vkUser.mid)) return alert('Ошибка: ВК не прислал ID');
      
      const providerAccountId = String(vkUser.id || vkUser.uid || vkUser.mid);
      const name = `${vkUser.first_name || 'Пользователь'} ${vkUser.last_name || ''}`.trim();
      const avatarUrl = vkUser.photo_100 || vkUser.photo || vkUser.photo_url || data.photo || '';
      const accessToken = data.accessToken || data.access_token || (data.session && data.session.sid) || '';

      const res = await linkSocialProfile(user.id, 'VK', providerAccountId, name, avatarUrl, accessToken);
      if (res.success) {
        await fetchProfiles(user.id);
      } else {
        alert('Ошибка сохранения ВК: ' + res.error);
      }
    } catch (error) {
      alert('Системная ошибка ВК: ' + error.message);
    }
  };

  // === СТАНДАРТНАЯ ЗАГРУЗКА ДАННЫХ ===
  useEffect(() => {
    if (user?.id) {
      fetchProfiles(user.id);
      fetchAccounts(user.id);
    }
  }, [user?.id, fetchProfiles, fetchAccounts]);

  // === REAL-TIME АВТО-ЧЕКЕР ДЛЯ TELEGRAM ===
  const [tgChecker, setTgChecker] = useState({ isWaiting: false, initialCount: 0 });

  useEffect(() => {
    let checkInterval = null;
    if (tgChecker.isWaiting && user?.id) {
      checkInterval = setInterval(async () => {
        await fetchProfiles(user.id); // Просто дергаем сервер
        
        // Берем свежие данные напрямую из глобального стейта
        const latestProfiles = useStore.getState().profiles; 
        const foundTg = latestProfiles.find(p => p.provider === 'TELEGRAM');
        
        if (foundTg) {
          clearInterval(checkInterval);
          await fetchAccounts(user.id);
          setTgChecker({ isWaiting: false, initialCount: 0 }); // Закрываем окно!
        }
      }, 3000);
    }
    return () => { if (checkInterval) clearInterval(checkInterval); };
  }, [tgChecker.isWaiting, user?.id, fetchProfiles, fetchAccounts]);

  // Запуск чекера
  const startTgLinking = () => {
    // 1. Открываем Deep Link ссылку в новой вкладке (наше железобетонное решение)
    window.open(`https://t.me/smmbox_auth_bot?start=bind_${user.id}`, '_blank');
    // 2. Включаем на сайте окно "Ожидания ТГ"
    setTgChecker({ isWaiting: true });
  };


  // === ФУНКЦИИ УПРАВЛЕНИЯ ===
  const handleFinish = async () => {
    await completeOnboarding();
    navigate('/profile'); // Уходим в кабинет
  };

  // Красивый рендеринг карточки аккаунта (группы/канала) из AccountsManager
  const renderAccountCard = (acc, icon, iconBg) => (
    <div className="flex items-center justify-between p-3.5 bg-gray-950/70 rounded-2xl border border-gray-800 shadow-inner gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`relative w-9 h-9 shrink-0 ${acc.isValid ? '' : 'filter grayscale'}`}>
          <img src={acc.avatarUrl || `https://ui-avatars.com/api/?name=${acc.name}&background=1f2937&color=fff`} className="w-full h-full rounded-xl object-cover" alt="" />
          <div className={`absolute -bottom-1 -right-1.5 w-5 h-5 rounded-md ${iconBg} border border-gray-900 flex items-center justify-center p-0.5 shadow-md`}>
            {icon}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-white font-semibold text-[13px] sm:text-sm truncate ${acc.isValid ? '' : 'text-gray-600'}`}>
            {acc.name}
          </div>
          {!acc.isValid && <div className="text-[10px] text-rose-500 font-medium truncate">{acc.errorMsg || 'Ошибка'}</div>}
        </div>
      </div>
      <button onClick={() => removeAccount(acc.id)} className="p-1.5 text-gray-500 hover:text-rose-500 rounded-lg transition-all shrink-0">
        <X size={16} />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col pt-8 pb-24 px-4 sm:px-6 relative overflow-hidden">
      {/* Декоративный фон */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#0077FF]/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#0088CC]/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-3xl w-full mx-auto space-y-8 sm:space-y-10 relative z-10">
        
        {/* === ШАПКА === */}
        <div className="text-center space-y-2 pt-2 sm:pt-6">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Подключение соцсетей</h1>
          <p className="text-[13px] sm:text-sm text-gray-400 max-w-sm mx-auto leading-snug px-4">
            Добавьте до 10 сообществ. Вы можете пропустить этот шаг и настроить всё позже.
          </p>
          <div className="inline-flex items-center gap-1.5 bg-gray-900/80 border border-gray-800 rounded-lg px-3 py-1.5 text-xs font-medium mt-2">
            <span className="text-gray-400">Добавлено:</span>
            <span className={isLimitReached ? "text-rose-500 font-bold" : "text-emerald-400 font-bold"}>
              {accounts.length} / 10
            </span>
          </div>
        </div>

        {/* ===================== КАРТОЧКА ВКОНТАКТЕ ===================== */}
        <div className="bg-gradient-to-br from-gray-900 to-[#0d0f13] border border-gray-800/80 rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#0077FF]/20 blur-[60px] rounded-full pointer-events-none"></div>
          
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-[#0077FF]/10 border border-[#0077FF]/20 flex items-center justify-center text-[#0077FF]">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">ВКонтакте</h2>
              <p className="text-xs sm:text-sm text-gray-400">Привязка групп и публичных страниц</p>
            </div>
          </div>

          {!vkProfile ? (
            <div className="flex flex-col items-center justify-center py-10 bg-gray-950/50 rounded-2xl border border-dashed border-gray-800 gap-5">
              <div className="text-center space-y-1">
                <p className="text-gray-200 text-base font-semibold">Ваш профиль ВК еще не привязан</p>
                <p className="text-gray-500 text-xs">Для добавления групп привяжите личный аккаунт ВК</p>
              </div>
              <CustomVkButton onAuth={handleVkAuth} className="w-max bg-[#0077FF] text-white px-10 py-3.5 rounded-xl font-bold flex items-center gap-2" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Шапка профиля ВК (Из AccountsManager) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-gray-800/60 rounded-xl border border-[#0077FF]/30 gap-3 sm:gap-2">
                <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto sm:flex-[2]">
                  <img src={vkProfile.avatarUrl || `https://ui-avatars.com/api/?name=${vkProfile.name}&background=0077FF&color=fff`} className="w-11 h-11 rounded-xl object-cover border border-gray-700 shrink-0" alt="VK" />
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-bold text-sm sm:text-base truncate leading-tight">{vkProfile.name}</div>
                    <div className="text-emerald-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Привязан</div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 shrink-0">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                     Стена Акт.
                  </span>
                  <button onClick={async () => { if (window.confirm('Отключить профиль?')) await removeSocialProfile(vkProfile.id); }} className="p-2 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              {/* Дерево элементов ВК */}
              <div className="flex flex-col gap-3.5 mt-3 sm:mt-4 ml-[24px] sm:ml-[28px] pl-4 sm:pl-6 border-l-2 border-gray-800/60 pb-2 relative">
                {accounts.filter(a => a.provider === 'VK').map(acc => (
                  <div key={acc.id} className="relative flex items-center">
                    {/* Линия связи */}
                    <div className="absolute top-1/2 -translate-y-1/2 -left-4 sm:-left-6 w-4 sm:w-6 h-[2px] bg-gray-800/60"></div>
                    <div className="w-full">{renderAccountCard(acc, <span className="font-bold text-[8px] text-white">K</span>, 'bg-[#0077FF]')}</div>
                  </div>
                ))}
                
                <div className="relative flex items-center w-full mt-1">
                    <div className="absolute top-1/2 -translate-y-1/2 -left-4 sm:-left-6 w-4 sm:w-6 h-[2px] bg-gray-800/60"></div>
                    <button 
                      onClick={() => setVkhModal(vkProfile.id, 'groups', vkProfile)}
                      disabled={isLimitReached}
                      className="w-full mt-2 bg-[#0077FF]/10 hover:bg-[#0077FF]/20 text-[#0077FF] border border-[#0077FF]/30 px-6 py-3 rounded-2xl transition-all flex items-center justify-center gap-2.5 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={18} /> Добавить сообщества
                    </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===================== КАРТОЧКА TELEGRAM ===================== */}
        <div className="bg-gradient-to-br from-gray-900 to-[#0d0f13] border border-gray-800/80 rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#0088CC]/20 blur-[60px] rounded-full pointer-events-none"></div>

          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-[#0088CC]/10 border border-[#0088CC]/20 flex items-center justify-center text-[#0088CC]">
              <Send size={24} className="ml-1" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">Telegram</h2>
              <p className="text-xs sm:text-sm text-gray-400">Ваши каналы и группы</p>
            </div>
          </div>

          {!tgProfile ? (
            <div className="flex flex-col items-center justify-center py-10 bg-gray-950/50 rounded-2xl border border-dashed border-gray-800 gap-5">
               <div className="text-center space-y-1">
                <p className="text-gray-200 text-base font-semibold">Ваш профиль Telegram не привязан</p>
                <p className="text-gray-500 text-xs">Для добавления каналов авторизуйтесь через бота</p>
              </div>
              <button 
                onClick={startTgLinking}
                className="w-full sm:w-max bg-[#0088CC] hover:bg-[#0077B3] text-white px-8 py-3.5 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-lg shadow-[#0088CC]/20 active:scale-95 text-sm"
              >
                <Send size={18} /> Привязать профиль через бота
              </button>
              <div className="text-[11px] text-gray-500 max-w-[250px] text-center mt-3">
                 Нажмите <b className="text-white">«Запустить»</b> в открывшемся боте, и профиль привяжется автоматически.
              </div>
            </div>
          ) : (
            <div className="space-y-4 relative z-10">
               {/* Шапка профиля ТГ */}
               <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-gray-800/60 rounded-xl border border-[#0088CC]/30 gap-3 sm:gap-2">
                <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto sm:flex-[2]">
                  <img src={tgProfile.avatarUrl || `https://ui-avatars.com/api/?name=${tgProfile.name}&background=0088CC&color=fff`} className="w-11 h-11 rounded-xl object-cover border border-gray-700 shrink-0" alt="TG" />
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-bold text-sm sm:text-base truncate leading-tight">{tgProfile.name}</div>
                    <div className="text-emerald-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Привязан</div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 shrink-0">
                   <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-400 bg-gray-700/40 px-2 py-1 rounded">
                     ID: {tgProfile.providerAccountId}
                  </span>
                  <button onClick={async () => { if (window.confirm('Отключить профиль?')) await removeSocialProfile(tgProfile.id); }} className="p-2 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              {/* Дерево элементов ТГ (Исправленные линии) */}
              <div className="flex flex-col gap-3.5 mt-3 sm:mt-4 ml-[24px] sm:ml-[28px] pl-4 sm:pl-6 border-l-2 border-gray-800/60 pb-2 relative">
                {accounts.filter(a => a.provider === 'TELEGRAM').map(acc => (
                  <div key={acc.id} className="relative flex items-center">
                    {/* Линии связи теперь ИДЕАЛЬНО центрированы */}
                    <div className="absolute top-1/2 -translate-y-1/2 -left-4 sm:-left-6 w-4 sm:w-6 h-[2px] bg-gray-800/60"></div>
                    <div className="w-full">{renderAccountCard(acc, <Send size={8} className="text-white"/>, 'bg-[#0088CC]')}</div>
                  </div>
                ))}
                
                <div className="relative flex items-center w-full mt-1">
                  {/* ИДЕАЛЬНО центрированная линия для кнопки + Добавить */}
                  <div className="absolute top-1/2 -translate-y-1/2 -left-4 sm:-left-6 w-4 sm:w-6 h-[2px] bg-gray-800/60"></div>
                  
                  {isLimitReached ? (
                    <button onClick={() => alert('Лимит исчерпан!')} className="flex-1 w-full bg-[#0088CC]/5 text-[#0088CC]/50 border border-[#0088CC]/10 px-4 py-3 rounded-2xl transition-all flex justify-center items-center gap-2 font-bold cursor-not-allowed">
                      <Plus size={18} /> Добавить канал/группу
                    </button>
                  ) : (
                    <a href="https://t.me/smmbox_auth_bot?startchannel=true&admin=post_messages+edit_messages+delete_messages" target="_blank" rel="noopener noreferrer" className="flex-1 w-full bg-[#0088CC]/10 hover:bg-[#0088CC]/20 text-[#0088CC] border border-[#0088CC]/30 px-6 py-3 rounded-2xl transition-all flex justify-center items-center gap-2 font-bold shadow-sm active:scale-95 text-center text-sm">
                      <Plus size={18} /> Добавить канал/группу
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* === КНОПКИ УПРАВЛЕНИЯ (ФУТЕР) === */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-6 sm:pt-8 mt-4 border-t border-gray-800/50 relative z-10">
          
          <button 
            onClick={handleFinish}
            disabled={accounts.length === 0}
            className={`w-full sm:w-auto px-6 py-3.5 sm:py-4 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg active:scale-95 order-1 sm:order-2 text-sm sm:text-base ${
              accounts.length > 0 
              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20" 
              : "bg-gray-800 text-gray-500"
            }`}
          >
            {accounts.length > 0 ? "Завершить настройку" : "Сначала добавьте сообщество"} <ArrowRight size={18} />
          </button>

          <button 
            onClick={handleFinish} 
            className="w-full sm:w-auto bg-gray-900/50 sm:bg-transparent border border-gray-800 sm:border-transparent text-gray-400 hover:text-white px-6 py-3.5 sm:py-4 rounded-xl font-medium transition-all order-2 sm:order-1 active:scale-95 text-sm"
          >
            Пропустить этот шаг
          </button>
          
        </div>

      </div>

      {/* === МОДАЛЬНОЕ ОКНО ОЖИДАНИЯ TELEGRAM (REAL-TIME ЧЕКЕР) === */}
      {tgChecker.isWaiting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0d0f13] border border-gray-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col items-center justify-center p-8 sm:p-10 gap-6">
            
            <div className="relative">
               <Loader2 className="animate-spin text-[#0088CC]" size={48} />
               <Send size={18} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
            </div>
            
            <div className="text-center space-y-2 relative z-10">
              <h3 className="text-xl font-black flex items-center justify-center gap-2 text-white">
                Ожидаем Telegram...
              </h3>
              <p className="text-sm text-gray-400">
                Откроется бот в Telegram. Нажмите <b className="text-white">«Запустить»</b> (или `/start`). Как только вы это сделаете, это окно закроется, и профиль привяжется сам.
              </p>
            </div>
            
            <button onClick={() => setTgChecker({ isWaiting: false, initialCount: 0 })} className="text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-all text-sm">
              Закрыть и привязать вручную
            </button>
          </div>
        </div>
      )}
    </div>
  );
}