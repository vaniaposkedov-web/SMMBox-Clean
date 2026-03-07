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
        const results = await searchUsersFromApi(searchQuery, user.id);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(searchTimer);
  }, [searchQuery, user.id, searchUsersFromApi]);

  const getStatus = (targetId) => {
    if (myPartners.some(p => p.id === targetId)) return 'PARTNER';
    if (outgoingRequests.some(r => r.receiverId === targetId)) return 'SENT';
    if (incomingRequests.some(r => r.requesterId === targetId)) return 'INCOMING';
    return 'NONE';
  };

  return (
    <div className="w-full space-y-6 pb-20 translate-no" translate="no">
      
      {/* === ШАПКА === */}
      <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-2xl p-6 sm:p-8 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <Users className="text-blue-500" size={30} /> Партнеры
          </h1>
          <p className="text-gray-400 mt-2 text-sm max-w-xl leading-relaxed">
            Находите поставщиков и делитесь контентом.
          </p>
        </div>
        {/* Кнопка быстрого перехода к заявкам */}
        {incomingRequests.length > 0 && (
          <button onClick={() => navigate('/requests')} className="w-full sm:w-auto bg-blue-600/20 text-blue-400 border border-blue-500/30 px-5 py-3 sm:py-2 rounded-xl text-sm font-bold flex justify-center items-center gap-2 hover:bg-blue-600 hover:text-white transition-colors shadow-sm">
            Есть новые заявки ({incomingRequests.length})
          </button>
        )}
      </div>

      {/* === НАВИГАЦИЯ (ТАБЫ) === */}
      <div className="flex bg-[#0f1115] rounded-xl border border-[#1f222a] p-1.5 overflow-x-auto custom-scrollbar shadow-inner max-w-md">
        <button onClick={() => setActiveTab('partners')} className={`flex-1 py-3 text-[13px] uppercase tracking-wider font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'partners' ? 'bg-[#1e2028] text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>
          <UserCheck size={16}/> Мои партнеры
        </button>
        <button onClick={() => setActiveTab('search')} className={`flex-1 py-3 text-[13px] uppercase tracking-wider font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'search' ? 'bg-[#1e2028] text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>
          <Search size={16}/> Поиск
        </button>
      </div>

      {/* === РАБОЧАЯ ОБЛАСТЬ === */}
      <div className="bg-[#13151A] border border-[#1E2028] rounded-3xl shadow-xl overflow-hidden min-h-[400px]">
        
        {/* --- ВЛАДКА 1: МОИ ПАРТНЕРЫ --- */}
        {activeTab === 'partners' && (
          <div className="p-4 sm:p-8 animate-in fade-in duration-300">
            {myPartners.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 space-y-4 bg-[#0f1115] border border-dashed border-[#1f222a] rounded-2xl">
                <Users size={56} className="opacity-20" />
                <p className="text-[15px] text-center px-4">У вас пока нет активных партнеров.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
                {myPartners.map(partner => (
                  <div key={partner.id} className="bg-[#0f1115] border border-[#1f222a] p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition-all hover:border-gray-700 shadow-inner group">
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-white text-lg truncate">{partner.name || 'Без имени'}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[10px] bg-[#1a1d24] text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-md uppercase font-bold tracking-wider shrink-0">
                          Павильон: {partner.pavilion || '?'}
                        </span>
                        {partner.phone && <span className="text-[11px] text-gray-500 font-medium bg-[#13151A] px-2 py-1 rounded-md border border-[#1f222a] shrink-0">{partner.phone}</span>}
                      </div>
                      {/* Вывод ID партнера */}
                      <p className="text-[10px] text-gray-600 font-mono mt-2.5 truncate">ID: {partner.id}</p>
                    </div>
                    <button onClick={() => { if(window.confirm(`Прекратить сотрудничество с ${partner.name}?`)) removePartner(user.id, partner.id); }} className="w-full sm:w-12 h-10 sm:h-12 flex items-center justify-center text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors shrink-0 shadow-sm" title="Удалить партнера">
                      <span className="sm:hidden font-bold flex items-center gap-2 text-sm"><Trash2 size={16} /> Удалить партнера</span>
                      <Trash2 size={20} className="hidden sm:block" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- ВЛАДКА 2: ПОИСК --- */}
        {activeTab === 'search' && (
          <div className="p-4 sm:p-8 animate-in fade-in duration-300">
            <div className="relative mb-6 sm:mb-8">
              <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input 
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по ID, Павильону (СТ7-43) или Имени..."
                className="w-full bg-[#0f1115] border border-[#1f222a] shadow-inner rounded-2xl py-4 pl-12 sm:pl-14 pr-12 text-[15px] text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
              {isSearching && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={20} />}
            </div>

            <div className="space-y-4">
              {searchResults.map(foundUser => {
                const status = getStatus(foundUser.id);
                return (
                  <div key={foundUser.id} className="flex flex-col md:flex-row md:items-center justify-between bg-[#0f1115] border border-[#1f222a] p-4 sm:p-5 rounded-2xl gap-5 hover:border-gray-700 transition-colors shadow-inner overflow-hidden">
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-white text-lg truncate">{foundUser.name || 'Без имени'}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[11px] text-gray-400">Павильон: <span className="text-blue-400 font-bold uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded ml-1">{foundUser.pavilion || 'Не указан'}</span></span>
                        {foundUser.phone && <span className="text-[11px] text-gray-500 bg-[#13151A] px-2 py-0.5 rounded border border-[#1f222a]">{foundUser.phone}</span>}
                      </div>
                      {/* Вывод ID в поиске */}
                      <p className="text-[10px] text-gray-600 font-mono mt-2.5 truncate">ID: {foundUser.id}</p>
                    </div>

                    <div className="shrink-0 w-full md:w-auto">
                      {status === 'NONE' && (
                        <button onClick={() => sendRequest(user.id, foundUser.id)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3.5 rounded-xl text-sm font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20">
                          <UserPlus size={18} /> Пригласить
                        </button>
                      )}
                      {status === 'SENT' && (
                         <span className="w-full md:w-auto flex items-center justify-center gap-2 text-yellow-500 text-sm font-bold bg-yellow-500/10 border border-yellow-500/20 px-6 py-3.5 rounded-xl shadow-sm"><Check size={18}/> Заявка отправлена</span>
                      )}
                      {status === 'PARTNER' && (
                        <span className="w-full md:w-auto flex items-center justify-center gap-2 text-emerald-500 text-sm font-bold bg-emerald-500/10 border border-emerald-500/20 px-6 py-3.5 rounded-xl shadow-sm"><UserCheck size={18} /> Партнер</span>
                      )}
                      {status === 'INCOMING' && (
                        <button onClick={() => navigate('/requests')} className="w-full md:w-auto flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-purple-500/20 hover:bg-purple-500 transition-colors">Посмотреть заявку</button>
                      )}
                    </div>
                  </div>
                )
              })}
              
              {searchQuery.length > 1 && !isSearching && searchResults.length === 0 && (
                <div className="text-center text-gray-500 py-12 bg-[#0f1115] rounded-2xl border border-[#1f222a] border-dashed px-4">
                  По вашему запросу ничего не найдено.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}