import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { Search, UserPlus, UserCheck, Loader2, Check, Trash2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PartnersManager() {
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  
  // Данные из стора
  const myPartners = useStore((state) => state.myPartners) || [];
  const incomingRequests = useStore((state) => state.incomingRequests) || [];
  const outgoingRequests = useStore((state) => state.outgoingRequests) || [];
  
  const searchUsersFromApi = useStore((state) => state.searchUsersFromApi);
  const sendRequest = useStore((state) => state.sendPartnershipRequest);
  const removePartner = useStore((state) => state.removePartnerAction);

  const [activeTab, setActiveTab] = useState('partners'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Умный поиск с задержкой (Debounce)
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        setIsSearching(true);
        const results = await searchUsersFromApi(searchQuery, user?.id);
        setSearchResults(results || []);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(searchTimer);
  }, [searchQuery, user?.id, searchUsersFromApi]);

  const handleSendRequest = async (receiverId) => {
    const res = await sendRequest(user.id, receiverId);
    if (res?.success) {
      setSearchResults(prev => prev.map(u => u.id === receiverId ? { ...u, status: 'PENDING' } : u));
    } else {
      alert(res?.error || 'Ошибка при отправке заявки');
    }
  };

  const handleRemovePartner = async (partnerId) => {
    if (window.confirm('Вы уверены, что хотите удалить этого партнера? Вы больше не сможете обмениваться постами.')) {
      await removePartner(partnerId);
    }
  };

  return (
    <div className="w-full max-w-[98%] 2xl:max-w-[1800px] mx-auto px-4 md:px-8 pt-6 lg:pt-10 pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-12 animate-fade-in font-sans">
      
      {/* ГЛАВНЫЙ ЗАГОЛОВОК СТРАНИЦЫ */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-2 flex items-center gap-2 sm:gap-3 text-white">
          <Users className="text-[#0077FF]" size={28} /> 
          <span>Партнеры</span>
        </h1>
        <p className="text-gray-400 text-sm sm:text-base">
          Находите партнеров для совместного кросс-постинга и делитесь контентом.
        </p>
      </div>

      {/* АДАПТИВНЫЕ ВКЛАДКИ (Горизонтальный скролл на мобильных) */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 sm:mb-8 pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
        <button 
          onClick={() => setActiveTab('partners')} 
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all min-h-[44px] shrink-0 ${activeTab === 'partners' ? 'bg-[#0077FF] text-white shadow-lg shadow-[#0077FF]/20' : 'bg-admin-card border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
          Мои партнеры 
          {myPartners.length > 0 && <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'partners' ? 'bg-white/20' : 'bg-gray-800'}`}>{myPartners.length}</span>}
        </button>
        <button 
          onClick={() => setActiveTab('search')} 
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all min-h-[44px] shrink-0 ${activeTab === 'search' ? 'bg-[#0077FF] text-white shadow-lg shadow-[#0077FF]/20' : 'bg-admin-card border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
          Поиск новых
        </button>
        <button 
          onClick={() => setActiveTab('outgoing')} 
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all min-h-[44px] shrink-0 ${activeTab === 'outgoing' ? 'bg-[#0077FF] text-white shadow-lg shadow-[#0077FF]/20' : 'bg-admin-card border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
          Исходящие заявки
          {outgoingRequests.length > 0 && <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'outgoing' ? 'bg-white/20' : 'bg-gray-800'}`}>{outgoingRequests.length}</span>}
        </button>
      </div>

      <div className="bg-admin-card border border-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl">
        
        {/* === ВКЛАДКА: МОИ ПАРТНЕРЫ === */}
        {activeTab === 'partners' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {myPartners.length === 0 ? (
              <div className="text-center text-gray-500 py-10 sm:py-12 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
                <Users size={40} className="mx-auto mb-3 sm:mb-4 opacity-20" />
                <p className="text-sm sm:text-base px-4">У вас пока нет добавленных партнеров.</p>
                <button onClick={() => setActiveTab('search')} className="mt-4 text-[#0077FF] font-bold hover:underline text-sm min-h-[44px] px-4">
                  Найти партнеров
                </button>
              </div>
            ) : (
              myPartners.map((partner) => (
                <div key={partner.id} className="bg-gray-900 border border-gray-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors hover:border-gray-700">
                  <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto min-w-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-800 flex items-center justify-center font-bold text-gray-400 text-sm sm:text-base shrink-0 border border-gray-700 overflow-hidden">
                       {partner.avatarUrl ? <img src={partner.avatarUrl} className="w-full h-full object-cover"/> : partner.name?.substring(0,2).toUpperCase() || '??'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-white text-base sm:text-lg truncate pr-2">{partner.name || 'Без имени'}</h3>
                      <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1 truncate">Павильон: <span className="text-[#0077FF] font-bold bg-[#0077FF]/10 px-2 py-0.5 rounded ml-1">{partner.pavilion || '?'}</span></p>
                    </div>
                  </div>
                  
                  <div className="flex w-full sm:w-auto gap-2 sm:gap-3 shrink-0">
                    <button 
                      onClick={() => handleRemovePartner(partner.id)} 
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 px-4 sm:px-5 py-3 sm:py-2.5 rounded-xl transition-colors border border-gray-700 hover:border-red-500/30 text-sm font-bold min-h-[44px]"
                    >
                      <Trash2 size={16} /> <span>Удалить</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* === ВКЛАДКА: ПОИСК НОВЫХ === */}
        {activeTab === 'search' && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-500"><Search size={18} /></span>
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Введите ID, имя или павильон..." 
                className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 sm:py-4 pl-10 sm:pl-12 pr-4 text-base sm:text-sm text-white focus:outline-none focus:border-[#0077FF] transition-colors placeholder:text-gray-600 shadow-inner min-h-[48px] sm:min-h-[52px]"
              />
              {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[#0077FF]" size={18} />}
            </div>

            <div className="space-y-3 sm:space-y-4">
              {searchQuery.length === 0 && (
                <div className="text-center text-gray-500 py-8 sm:py-10 bg-gray-900/30 rounded-2xl">
                  <p className="text-sm">Начните вводить данные для поиска.</p>
                </div>
              )}

              {searchResults.map((resUser) => {
                const { id, name, pavilion, avatarUrl, status } = resUser;
                return (
                  <div key={id} className="bg-gray-900 border border-gray-800 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors hover:border-gray-700">
                    <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto min-w-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-800 flex items-center justify-center font-bold text-gray-400 text-sm sm:text-base shrink-0 border border-gray-700 overflow-hidden">
                         {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover"/> : name?.substring(0,2).toUpperCase() || '??'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2 truncate">
                          <span className="truncate">{name || 'Без имени'}</span>
                          <span className="text-[10px] sm:text-xs font-mono text-gray-500 bg-gray-950 px-2 py-0.5 rounded border border-gray-800 shrink-0">ID: {id?.split('-')[0]}</span>
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1 truncate">Павильон: <span className="text-[#0077FF] font-bold bg-[#0077FF]/10 px-2 py-0.5 rounded ml-1">{pavilion || '?'}</span></p>
                      </div>
                    </div>
                    
                    <div className="flex w-full md:w-auto gap-2 shrink-0">
                      {status === 'NONE' && (
                        <button 
                          onClick={() => handleSendRequest(id)} 
                          className="w-full md:w-auto flex flex-1 items-center justify-center gap-2 bg-[#0077FF] hover:bg-[#0066CC] text-white px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#0077FF]/20 active:scale-95 min-h-[48px]"
                        >
                          <UserPlus size={18} /> <span className="truncate">Отправить заявку</span>
                        </button>
                      )}
                      {status === 'PENDING' && (
                        <span className="w-full md:w-auto flex items-center justify-center gap-2 text-yellow-500 text-xs sm:text-sm font-bold bg-yellow-500/10 border border-yellow-500/20 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl min-h-[48px] truncate">
                          <Check size={16} className="shrink-0"/> <span className="truncate">Заявка отправлена</span>
                        </span>
                      )}
                      {status === 'PARTNER' && (
                        <span className="w-full md:w-auto flex items-center justify-center gap-2 text-emerald-500 text-xs sm:text-sm font-bold bg-emerald-500/10 border border-emerald-500/20 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl min-h-[48px] truncate">
                          <UserCheck size={16} className="shrink-0"/> <span className="truncate">Уже партнер</span>
                        </span>
                      )}
                      {status === 'INCOMING' && (
                        <button 
                          onClick={() => navigate('/requests')} 
                          className="w-full md:w-auto flex flex-1 items-center justify-center gap-2 bg-purple-600 text-white px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-purple-500/20 hover:bg-purple-500 transition-colors min-h-[48px] active:scale-95 truncate"
                        >
                          Посмотреть заявку
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              
              {searchQuery.length > 1 && !isSearching && searchResults.length === 0 && (
                <div className="text-center text-gray-500 py-10 sm:py-12 bg-gray-900 rounded-2xl border border-gray-800 border-dashed px-4">
                  <p className="text-sm sm:text-base">Пользователь с такими данными не найден.</p>
                  <p className="text-xs mt-1">Проверьте правильность ID или имени.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === ВКЛАДКА: ИСХОДЯЩИЕ ЗАЯВКИ === */}
        {activeTab === 'outgoing' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {outgoingRequests.length === 0 ? (
              <div className="text-center text-gray-500 py-10 sm:py-12 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
                <UserPlus size={40} className="mx-auto mb-3 sm:mb-4 opacity-20" />
                <p className="text-sm sm:text-base px-4">У вас нет отправленных заявок в ожидании.</p>
              </div>
            ) : (
              outgoingRequests.map((req) => (
                <div key={req.id} className="bg-gray-900 border border-gray-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
                  <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto min-w-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-800 flex items-center justify-center font-bold text-gray-400 text-sm sm:text-base shrink-0 border border-gray-700 overflow-hidden">
                       {req.receiver?.avatarUrl ? <img src={req.receiver.avatarUrl} className="w-full h-full object-cover"/> : req.receiver?.name?.substring(0,2).toUpperCase() || '??'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-white text-base sm:text-lg truncate">{req.receiver?.name || 'Без имени'}</h3>
                      <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1 truncate">Павильон: <span className="text-[#0077FF] font-bold bg-[#0077FF]/10 px-2 py-0.5 rounded ml-1">{req.receiver?.pavilion || '?'}</span></p>
                    </div>
                  </div>
                  
                  <div className="flex w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
                    <span className="w-full sm:w-auto flex items-center justify-center gap-2 text-yellow-500 text-xs sm:text-sm font-bold bg-yellow-500/10 border border-yellow-500/20 px-4 sm:px-5 py-3 sm:py-2.5 rounded-xl min-h-[48px] sm:min-h-[44px]">
                      <Loader2 size={16} className="animate-spin shrink-0"/> <span className="truncate">Ожидание ответа</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        
      </div>
    </div>
  );
}