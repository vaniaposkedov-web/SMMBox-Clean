import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { Search, UserPlus, UserCheck, UserX, Loader2, Check, Trash2, Users, Inbox, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PartnersManager() {
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  
  const myPartners = useStore((state) => state.myPartners) || [];
  const outgoingRequests = useStore((state) => state.outgoingRequests) || [];
  
  // Достаем уведомления и метод для их скрытия
  const notifications = useStore((state) => state.notifications) || [];
  const markNotificationAsRead = useStore((state) => state.markNotificationAsRead);
  
  const searchUsersFromApi = useStore((state) => state.searchUsersFromApi);
  const sendRequest = useStore((state) => state.sendPartnershipRequest);
  const removePartner = useStore((state) => state.removePartnerAction);

  const [activeTab, setActiveTab] = useState('partners'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Фильтруем непрочитанные уведомления, которые являются ответами на наши заявки
  const requestResponses = notifications.filter(n => 
    !n.isRead && (n.text.includes('принял') || n.text.includes('отклонил') || n.text.includes('прекратил'))
  );

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
      await removePartner(user.id, partnerId);
    }
  };

  return (
    <div className="w-full space-y-6 sm:space-y-8 font-sans pb-24 md:pb-12">
      
      {/* === ШАПКА === */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 bg-admin-card border border-gray-800 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl">
        <div>
           <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3 sm:gap-4 tracking-tighter">
              <Users className="text-[#0077FF]" size={28} /> 
              <span>Управление партнерами</span>
           </h1>
           <p className="text-gray-500 font-medium mt-1 text-sm sm:text-base">
             Находите партнеров для кросс-постинга и делитесь контентом
           </p>
        </div>
      </div>

      {/* === ТАБЫ === */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-gray-900/50 p-1.5 sm:p-2 rounded-[1.5rem] sm:rounded-[1.8rem] border border-gray-800">
        {[
          { id: 'partners', label: `Мои (${myPartners.length})`, icon: UserCheck, color: 'text-emerald-400' },
          { id: 'search', label: 'Поиск новых', icon: Search, color: 'text-[#0077FF]' },
          { id: 'outgoing', label: `Ожидают ответа (${outgoingRequests.length})`, icon: Inbox, color: 'text-purple-400' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4 rounded-[1.2rem] sm:rounded-2xl text-xs sm:text-sm font-black transition-all ${activeTab === tab.id ? 'bg-gray-800 text-white shadow-xl border border-gray-700 translate-y-[-1px]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <tab.icon size={18} className={activeTab === tab.id ? tab.color : 'text-gray-600'} />
            <span className="hidden xs:inline uppercase tracking-wider">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* === КОНТЕНТ === */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        
        {/* ВКЛАДКА: МОИ ПАРТНЕРЫ */}
        {activeTab === 'partners' && (
          <div className="space-y-4">
            <h2 className="text-xs sm:text-sm font-black text-gray-500 uppercase tracking-[0.2em] px-2 sm:px-4 mb-4">Активные партнеры</h2>
            {myPartners.length === 0 ? (
              <div className="bg-admin-card border border-gray-800 border-dashed p-10 rounded-[2rem] text-center flex flex-col items-center">
                <Users className="text-gray-700 mb-4" size={48} />
                <p className="text-gray-500 font-bold">У вас пока нет добавленных партнеров.</p>
                <button onClick={() => setActiveTab('search')} className="mt-4 text-[#0077FF] font-bold hover:underline text-sm">
                  Найти партнеров
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {myPartners.map((partner) => (
                  <div key={partner.id} className="bg-admin-card border border-gray-800 p-5 rounded-[1.5rem] sm:rounded-[2rem] flex flex-col justify-between shadow-lg hover:border-gray-600 transition-all group">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-14 h-14 rounded-[1.2rem] bg-gray-900 border border-gray-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-gray-400">
                         {partner.avatarUrl ? <img src={partner.avatarUrl} className="w-full h-full object-cover"/> : partner.name?.substring(0,2).toUpperCase() || '??'}
                      </div>
                      <div className="min-w-0 flex-1">
                         <h4 className="text-white font-bold text-lg truncate pr-2">{partner.name || 'Без имени'}</h4>
                         <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] sm:text-xs font-black text-gray-500 truncate uppercase tracking-widest bg-gray-900 px-2 py-0.5 rounded-md border border-gray-800">
                             ID: {partner.id?.split('-')[0]}
                           </span>
                           <span className="text-xs text-[#0077FF] font-black uppercase tracking-widest">
                             ПАВ. {partner.pavilion || '?'}
                           </span>
                         </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemovePartner(partner.id)} 
                      className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 transition-all hover:text-white font-bold text-sm mt-auto"
                    >
                      <Trash2 size={16} /> Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА: ПОИСК НОВЫХ */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500"><Search size={18} /></span>
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Введите ID, имя или павильон партнера..." 
                className="w-full bg-admin-card border border-gray-800 rounded-[1.5rem] py-4 sm:py-5 pl-12 pr-4 text-white focus:outline-none focus:border-[#0077FF] transition-colors placeholder:text-gray-600 shadow-xl font-medium text-sm sm:text-base"
              />
              {isSearching && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-[#0077FF]" size={20} />}
            </div>

            {searchQuery.length === 0 && (
              <div className="text-center text-gray-500 py-10">
                <Search size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Начните вводить данные для поиска пользователей.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {searchResults.map((resUser) => {
                const { id, name, pavilion, avatarUrl, status } = resUser;
                return (
                  <div key={id} className="bg-admin-card border border-gray-800 p-5 rounded-[1.5rem] sm:rounded-[2rem] flex flex-col justify-between shadow-lg hover:border-gray-600 transition-all">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-14 h-14 rounded-[1.2rem] bg-gray-900 border border-gray-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-gray-400">
                         {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover"/> : name?.substring(0,2).toUpperCase() || '??'}
                      </div>
                      <div className="min-w-0 flex-1">
                         <h4 className="text-white font-bold text-lg truncate pr-2">{name || 'Без имени'}</h4>
                         <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] sm:text-xs font-black text-gray-500 truncate uppercase tracking-widest bg-gray-900 px-2 py-0.5 rounded-md border border-gray-800">
                             ID: {id?.split('-')[0]}
                           </span>
                           <span className="text-xs text-[#0077FF] font-black uppercase tracking-widest">
                             ПАВ. {pavilion || '?'}
                           </span>
                         </div>
                      </div>
                    </div>
                    
                    <div className="w-full mt-auto">
                      {status === 'NONE' && (
                        <button 
                          onClick={() => handleSendRequest(id)} 
                          className="w-full flex items-center justify-center gap-2 bg-[#0077FF] hover:bg-[#0066CC] text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#0077FF]/20 active:scale-95"
                        >
                          <UserPlus size={18} /> Отправить заявку
                        </button>
                      )}
                      {status === 'PENDING' && (
                        <div className="w-full flex items-center justify-center gap-2 text-yellow-500 text-sm font-bold bg-yellow-500/10 py-3 rounded-xl">
                          <Check size={16} /> Заявка отправлена
                        </div>
                      )}
                      {status === 'PARTNER' && (
                        <div className="w-full flex items-center justify-center gap-2 text-emerald-500 text-sm font-bold bg-emerald-500/10 py-3 rounded-xl">
                          <UserCheck size={16} /> Уже партнер
                        </div>
                      )}
                      {status === 'INCOMING' && (
                        <button 
                          onClick={() => navigate('/requests')} 
                          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-500/20 active:scale-95"
                        >
                          Входящая заявка (Смотреть)
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ВКЛАДКА: ОЖИДАЮТ ОТВЕТА (И ИСТОРИЯ ОТВЕТОВ) */}
        {activeTab === 'outgoing' && (
          <div className="space-y-8">
            
            {/* ЕСЛИ НЕТ НИ ЗАЯВОК В ОЖИДАНИИ, НИ НОВЫХ ОТВЕТОВ */}
            {outgoingRequests.length === 0 && requestResponses.length === 0 ? (
              <div className="bg-admin-card border border-gray-800 border-dashed p-10 rounded-[2rem] text-center flex flex-col items-center">
                <Inbox className="text-gray-700 mb-4" size={48} />
                <p className="text-gray-500 font-bold">У вас нет активных исходящих заявок и новых ответов.</p>
              </div>
            ) : (
              <>
                {/* БЛОК 1: В ОЖИДАНИИ */}
                {outgoingRequests.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-xs sm:text-sm font-black text-gray-500 uppercase tracking-[0.2em] px-2 sm:px-4 mb-4">В процессе ожидания</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {outgoingRequests.map((req) => (
                        <div key={req.id} className="bg-admin-card border border-gray-800 p-5 rounded-[1.5rem] sm:rounded-[2rem] flex flex-col justify-between shadow-lg">
                          <div className="flex items-center gap-4 mb-5">
                            <div className="w-14 h-14 rounded-[1.2rem] bg-gray-900 border border-gray-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-gray-400">
                               {req.receiver?.avatarUrl ? <img src={req.receiver.avatarUrl} className="w-full h-full object-cover"/> : req.receiver?.name?.substring(0,2).toUpperCase() || '??'}
                            </div>
                            <div className="min-w-0 flex-1">
                               <h4 className="text-white font-bold text-lg truncate pr-2">{req.receiver?.name || 'Без имени'}</h4>
                               <span className="text-xs text-[#0077FF] font-black uppercase tracking-widest mt-1 block">
                                 ПАВ. {req.receiver?.pavilion || '?'}
                               </span>
                            </div>
                          </div>
                          
                          <div className="w-full flex items-center justify-center gap-2 text-yellow-500 text-sm font-bold bg-yellow-500/10 py-3 rounded-xl mt-auto">
                            <Loader2 size={16} className="animate-spin" /> Ждем решения
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* БЛОК 2: ОТВЕТЫ НА ЗАЯВКИ (ИЗ УВЕДОМЛЕНИЙ) */}
                {requestResponses.length > 0 && (
                  <div className={`space-y-4 ${outgoingRequests.length > 0 ? 'pt-6 border-t border-gray-800/50' : ''}`}>
                    <h2 className="text-xs sm:text-sm font-black text-gray-500 uppercase tracking-[0.2em] px-2 sm:px-4 mb-4">Ответы партнеров</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {requestResponses.map((note) => {
                        const isSuccess = note.type === 'SUCCESS' || note.text.includes('принял');

                        return (
                          <div key={note.id} className={`relative p-5 rounded-[1.5rem] sm:rounded-[2rem] flex flex-col justify-between shadow-lg border ${isSuccess ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                            
                            {/* Кнопка "Скрыть карточку" */}
                            <button
                              onClick={() => markNotificationAsRead(note.id)}
                              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white bg-gray-900/50 hover:bg-gray-800 rounded-full transition-all"
                              title="Ознакомлен"
                            >
                              <X size={14} />
                            </button>

                            <div className="flex items-start gap-4 mb-5 pr-8">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isSuccess ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                                 {isSuccess ? <UserCheck size={24} /> : <UserX size={24} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                 <p className="text-sm sm:text-base text-gray-300 font-medium leading-relaxed mt-1">
                                   {note.text}
                                 </p>
                              </div>
                            </div>
                            
                            <div className="mt-auto pt-2">
                              <span className={`inline-block text-[10px] sm:text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${isSuccess ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                {isSuccess ? 'Заявка принята' : 'В партнерстве отказано'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
      </div>
    </div>
  );
}