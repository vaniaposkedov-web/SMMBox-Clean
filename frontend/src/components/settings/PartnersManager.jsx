import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { Search, UserPlus, UserMinus, UserCheck, Loader2, Bell, Check, X, Trash2, Users } from 'lucide-react';

export default function PartnersManager() {
  const user = useStore((state) => state.user);
  
  // Данные из стора
  const myPartners = useStore((state) => state.myPartners) || [];
  const incomingRequests = useStore((state) => state.incomingRequests) || [];
  const outgoingRequests = useStore((state) => state.outgoingRequests) || [];
  const notifications = useStore((state) => state.notifications) || [];
  
  // Методы из стора
  const fetchPartnerData = useStore((state) => state.fetchPartnerData);
  const searchUsersFromApi = useStore((state) => state.searchUsersFromApi);
  const sendRequest = useStore((state) => state.sendPartnershipRequest);
  const acceptPartnership = useStore((state) => state.acceptPartnership);
  const declinePartnership = useStore((state) => state.declinePartnership);
  const removePartner = useStore((state) => state.removePartnerAction);
  const clearNotifications = useStore((state) => state.clearNotifications);

  const [activeTab, setActiveTab] = useState('partners'); // partners, search, requests
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Загружаем данные при старте
  useEffect(() => {
    if (user?.id) fetchPartnerData(user.id);
  }, [user?.id, fetchPartnerData]);

  // Умный поиск с задержкой
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        setIsSearching(true);
        const results = await searchUsersFromApi(searchQuery, user.id);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(searchTimer);
  }, [searchQuery, user.id, searchUsersFromApi]);

  // Проверка статуса в поиске
  const getStatus = (targetId) => {
    if (myPartners.some(p => p.id === targetId)) return 'PARTNER';
    if (outgoingRequests.some(r => r.receiverId === targetId)) return 'SENT';
    if (incomingRequests.some(r => r.requesterId === targetId)) return 'INCOMING';
    return 'NONE';
  };

  // Бейджи для вкладок
  const requestsBadge = incomingRequests.length + notifications.length;

  return (
    <div className="w-full space-y-6 pb-20 translate-no" translate="no">
      
      {/* === ШАПКА === */}
      <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
          <Users className="text-blue-500" size={28} /> Управление партнерами
        </h1>
        <p className="text-gray-400 mt-2 text-sm max-w-xl">
          Находите поставщиков, отправляйте заявки и делитесь контентом в один клик.
        </p>
      </div>

      {/* === НАВИГАЦИЯ (ТАБЫ) === */}
      <div className="flex bg-[#0f1115] rounded-xl border border-[#1f222a] p-1.5 overflow-x-auto custom-scrollbar">
        <button onClick={() => setActiveTab('partners')} className={`flex-1 min-w-[120px] py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'partners' ? 'bg-[#1e2028] text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>
          <UserCheck size={16}/> Мои партнеры <span className="bg-[#13151A] text-gray-400 px-2 py-0.5 rounded-full text-[10px] border border-[#1f222a]">{myPartners.length}</span>
        </button>
        <button onClick={() => setActiveTab('search')} className={`flex-1 min-w-[120px] py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'search' ? 'bg-[#1e2028] text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>
          <Search size={16}/> Поиск
        </button>
        <button onClick={() => setActiveTab('requests')} className={`flex-1 min-w-[120px] py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'requests' ? 'bg-[#1e2028] text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>
          <Bell size={16}/> Заявки {requestsBadge > 0 && <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] animate-pulse">{requestsBadge}</span>}
        </button>
      </div>

      {/* === РАБОЧАЯ ОБЛАСТЬ === */}
      <div className="bg-[#13151A] border border-[#1E2028] rounded-3xl shadow-xl overflow-hidden min-h-[400px]">
        
        {/* --- ВЛАДКА 1: МОИ ПАРТНЕРЫ --- */}
        {activeTab === 'partners' && (
          <div className="p-6 sm:p-8 animate-in fade-in duration-300">
            {myPartners.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 space-y-4">
                <Users size={48} className="opacity-20" />
                <p>У вас пока нет партнеров.</p>
                <button onClick={() => setActiveTab('search')} className="text-blue-400 font-bold hover:underline text-sm">Найти поставщиков</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {myPartners.map(partner => (
                  <div key={partner.id} className="bg-[#0f1115] border border-[#1f222a] p-5 rounded-2xl flex items-center justify-between transition-all hover:border-gray-700 shadow-inner group">
                    <div>
                      <h3 className="font-bold text-white text-lg">{partner.name || 'Без имени'}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] bg-[#1a1d24] text-blue-400 border border-blue-500/20 px-2 py-1 rounded-md uppercase font-bold tracking-wider">
                          Павильон: {partner.pavilion || '?'}
                        </span>
                        {partner.phone && <span className="text-[11px] text-gray-500">{partner.phone}</span>}
                      </div>
                    </div>
                    <button onClick={() => { if(window.confirm(`Прекратить сотрудничество с ${partner.name}?`)) removePartner(user.id, partner.id); }} className="w-10 h-10 flex items-center justify-center text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors shrink-0" title="Удалить партнера">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- ВЛАДКА 2: ПОИСК --- */}
        {activeTab === 'search' && (
          <div className="p-6 sm:p-8 animate-in fade-in duration-300">
            <div className="relative mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input 
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по Имени, Павильону (СТ7-43), ID или Телефону..."
                className="w-full bg-[#0f1115] border border-[#1f222a] shadow-inner rounded-2xl py-4 pl-12 pr-12 text-[15px] text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
              {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={20} />}
            </div>

            <div className="space-y-3">
              {searchResults.map(foundUser => {
                const status = getStatus(foundUser.id);
                return (
                  <div key={foundUser.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#0f1115] border border-[#1f222a] p-5 rounded-2xl gap-4 hover:border-gray-700 transition-colors">
                    <div>
                      <h3 className="font-bold text-white text-lg">{foundUser.name || 'Без имени'}</h3>
                      <p className="text-[13px] text-gray-400 mt-1">Павильон: <span className="text-blue-400 font-bold">{foundUser.pavilion || 'Не указан'}</span></p>
                    </div>

                    {status === 'NONE' && (
                      <button onClick={() => sendRequest(user.id, foundUser.id)} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20 w-full sm:w-auto">
                        <UserPlus size={16} /> Пригласить
                      </button>
                    )}
                    {status === 'SENT' && (
                       <span className="flex items-center justify-center gap-2 text-yellow-500 text-sm font-bold bg-yellow-500/10 border border-yellow-500/20 px-6 py-3 rounded-xl w-full sm:w-auto"><Check size={16}/> Заявка отправлена</span>
                    )}
                    {status === 'PARTNER' && (
                      <span className="flex items-center justify-center gap-2 text-emerald-500 text-sm font-bold bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-xl w-full sm:w-auto"><UserCheck size={16} /> Партнер</span>
                    )}
                    {status === 'INCOMING' && (
                      <button onClick={() => setActiveTab('requests')} className="flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-purple-500/20 w-full sm:w-auto">Посмотреть заявку</button>
                    )}
                  </div>
                )
              })}
              
              {searchQuery.length > 1 && !isSearching && searchResults.length === 0 && (
                <div className="text-center text-gray-500 py-10 bg-[#0f1115] rounded-2xl border border-[#1f222a] border-dashed">
                  По вашему запросу ничего не найдено.
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- ВЛАДКА 3: ЗАЯВКИ И УВЕДОМЛЕНИЯ --- */}
        {activeTab === 'requests' && (
          <div className="p-6 sm:p-8 animate-in fade-in duration-300 space-y-10">
            
            {/* Секция Входящих заявок */}
            <div>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                Входящие заявки <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px]">{incomingRequests.length}</span>
              </h2>
              {incomingRequests.length === 0 ? (
                <p className="text-sm text-gray-600 italic">Новых заявок нет.</p>
              ) : (
                <div className="space-y-3">
                  {incomingRequests.map(req => (
                    <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-blue-500/5 border border-blue-500/20 p-5 rounded-2xl gap-4">
                      <div>
                         <h3 className="font-bold text-white text-lg">{req.requester.name}</h3>
                         <p className="text-sm text-gray-400 mt-1">Хочет стать вашим партнером. Павильон: <span className="text-blue-400 font-bold">{req.requester.pavilion}</span></p>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => declinePartnership(req.id)} className="flex-1 sm:flex-none w-12 h-12 flex items-center justify-center bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition-colors"><X size={20}/></button>
                         <button onClick={() => acceptPartnership(req.id)} className="flex-1 sm:flex-none px-6 h-12 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-colors"><Check size={18}/> Принять</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Секция Уведомлений */}
            <div className="pt-6 border-t border-[#1f222a]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  Уведомления <span className="bg-gray-700 text-white px-2 py-0.5 rounded-full text-[10px]">{notifications.length}</span>
                </h2>
                {notifications.length > 0 && (
                  <button onClick={() => clearNotifications(user.id)} className="text-[11px] font-bold text-gray-500 hover:text-white uppercase tracking-wider transition-colors">Очистить всё</button>
                )}
              </div>

              {notifications.length === 0 ? (
                <p className="text-sm text-gray-600 italic">Уведомлений нет.</p>
              ) : (
                <div className="space-y-3">
                  {notifications.map(note => (
                    <div key={note.id} className="bg-[#0f1115] border border-[#1f222a] p-4 rounded-xl flex gap-3 items-start">
                      <div className="p-2 bg-gray-800/50 rounded-lg shrink-0 mt-1"><Bell size={16} className="text-gray-400"/></div>
                      <p className="text-sm text-gray-300 leading-relaxed pt-1">{note.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}