import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { Search, UserPlus, UserMinus, UserCheck, Loader2 } from 'lucide-react';

export default function PartnersManager() {
  const user = useStore((state) => state.user);
  const myPartners = useStore((state) => state.myPartners);
  
  const searchUsersFromApi = useStore((state) => state.searchUsersFromApi);
  const sendRequest = useStore((state) => state.sendPartnershipRequest);
  const removePartner = useStore((state) => state.removePartnerAction);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sentRequestsLocal, setSentRequestsLocal] = useState([]); // Локально запоминаем, кому только что кинули заявку

  // === УМНЫЙ ПОИСК С ЗАДЕРЖКОЙ (DEBOUNCE) ===
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        setIsSearching(true);
        // Обращаемся к нашей функции в store.js, которая стучится на бэкенд
        const results = await searchUsersFromApi(searchQuery, user.id);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]); // Если поле пустое, очищаем результаты
      }
    }, 500); // Ждем 500мс после последнего нажатия клавиши

    return () => clearTimeout(searchTimer);
  }, [searchQuery, user.id, searchUsersFromApi]);

  // Проверка статуса для кнопок в поиске
  const getStatus = (targetId) => {
    // Если он уже в наших партнерах
    if (myPartners.some(p => p.id === targetId)) return 'PARTNER';
    // Если мы только что в этой сессии кинули ему заявку
    if (sentRequestsLocal.includes(targetId)) return 'SENT';
    return 'NONE';
  };

  const handleSendRequest = async (targetId) => {
    await sendRequest(user.id, targetId);
    setSentRequestsLocal([...sentRequestsLocal, targetId]); // Меняем кнопку на "Отправлено"
  };

  return (
    <div className="space-y-8">
      
      {/* --- БЛОК 1: МОИ ПАРТНЕРЫ --- */}
      <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          Мои партнеры 
          <span className="bg-admin-accent text-white text-xs px-2 py-1 rounded-full">{myPartners?.length || 0}</span>
        </h2>
        
        {!myPartners || myPartners.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            У вас пока нет партнеров. Воспользуйтесь поиском ниже.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myPartners.map(partner => (
              <div key={partner.id} className="bg-gray-900 border border-gray-800 p-4 rounded-2xl flex items-center justify-between transition-all hover:border-gray-700">
                <div>
                  <h3 className="font-bold text-white">{partner.name}</h3>
                  <span className="text-xs bg-gray-800 text-admin-accent px-2 py-1 rounded-md mt-1 inline-block">
                    {partner.pavilion}
                  </span>
                </div>
                <button 
                  onClick={() => {
                    if(window.confirm(`Вы уверены, что хотите прекратить сотрудничество с ${partner.name}?`)) {
                      removePartner(user.id, partner.id);
                    }
                  }}
                  className="p-2 text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors"
                  title="Прекратить сотрудничество"
                >
                  <UserMinus size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- БЛОК 2: ЖИВОЙ ПОИСК --- */}
      <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-white">Найти поставщика</h2>
        
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Введите имя или павильон (например: СТ7-43)..."
            className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 pl-12 pr-12 text-white focus:outline-none focus:border-admin-accent focus:ring-1 focus:ring-admin-accent transition-all"
          />
          {/* Крутилка загрузки, когда идет запрос к БД */}
          {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-admin-accent animate-spin" size={18} />}
        </div>

        <div className="space-y-3">
          {searchResults.map(foundUser => {
            const status = getStatus(foundUser.id);
            return (
              <div key={foundUser.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-900/50 border border-gray-800/50 p-4 rounded-xl gap-4">
                <div>
                  <h3 className="font-bold text-white text-lg">{foundUser.name}</h3>
                  <p className="text-sm text-gray-400 mt-0.5">Павильон: <span className="text-admin-accent font-medium">{foundUser.pavilion}</span></p>
                </div>

                {status === 'NONE' && (
                  <button onClick={() => handleSendRequest(foundUser.id)} className="flex items-center justify-center gap-2 bg-admin-accent text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 w-full sm:w-auto">
                    <UserPlus size={16} /> Добавить
                  </button>
                )}
                
                {status === 'SENT' && (
                  <span className="flex items-center justify-center gap-2 text-yellow-500 text-sm font-medium bg-yellow-500/10 px-5 py-2.5 rounded-xl w-full sm:w-auto">
                    Заявка отправлена
                  </span>
                )}

                {status === 'PARTNER' && (
                  <span className="flex items-center justify-center gap-2 text-green-500 text-sm font-medium bg-green-500/10 px-5 py-2.5 rounded-xl w-full sm:w-auto">
                    <UserCheck size={16} /> Ваш партнер
                  </span>
                )}
              </div>
            )
          })}
          
          {searchQuery.length > 1 && !isSearching && searchResults.length === 0 && (
            <div className="text-center text-gray-500 py-6 bg-gray-900/30 rounded-xl border border-gray-800/30">
              Пользователь с таким павильоном не найден.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}