import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { 
  Send, Calendar, Image as ImageIcon, CheckCircle2, 
  Loader2, AlertCircle, ChevronRight, ChevronLeft, 
  Sparkles, Trash2, Users, X
} from 'lucide-react';

export default function Publish() {
  const user = useStore((state) => state.user);
  const accounts = useStore((state) => state.accounts);
  const fetchAccounts = useStore((state) => state.fetchAccounts);
  const createPostAction = useStore((state) => state.createPostAction);
  const myPartners = useStore((state) => state.myPartners);

  // Достаем черновик из стора (сохраняется при F5)
  const draft = useStore((state) => state.publishDraft);
  const updateDraft = useStore((state) => state.updatePublishDraft);
  const clearDraft = useStore((state) => state.clearPublishDraft);

  const [isPublishing, setIsPublishing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Модалка для отправки партнерам
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  useEffect(() => {
    if (user) fetchAccounts(user.id);
  }, [user, fetchAccounts]);

  // === ЛОГИКА ШАГОВ ===
  const nextStep = () => updateDraft({ step: draft.step + 1 });
  const prevStep = () => updateDraft({ step: draft.step - 1 });

  // === ИМИТАЦИЯ ЗАГРУЗКИ ФОТО ===
  const handleAddMockPhoto = () => {
    if (draft.photos.length >= 10) return;
    const mockUrls = [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=400&fit=crop'
    ];
    const randomPhoto = mockUrls[Math.floor(Math.random() * mockUrls.length)];
    updateDraft({ photos: [...draft.photos, randomPhoto] });
  };

  const removePhoto = (index) => {
    const newPhotos = [...draft.photos];
    newPhotos.splice(index, 1);
    updateDraft({ photos: newPhotos });
  };

  // === AI ИМИТАЦИЯ ===
  const handleAiImprove = () => {
    if (!draft.text.trim()) return setErrorMsg('Сначала напишите хотя бы пару слов.');
    setErrorMsg('');
    setIsAiLoading(true);
    
    // Имитируем запрос к нейросети (задержка 1.5 сек)
    setTimeout(() => {
      const improvedText = `🔥 НОВИНКА В НАЛИЧИИ 🔥\n\n${draft.text}\n\n✅ Премиум качество\n📦 Отправка в день заказа\n👇 Успейте забронировать!`;
      updateDraft({ text: improvedText.slice(0, 1000) }); // Соблюдаем лимит
      setIsAiLoading(false);
    }, 1500);
  };

  // === ФИНАЛЬНАЯ ПУБЛИКАЦИЯ ===
  const handlePublish = async () => {
    setErrorMsg('');
    if (draft.accountIds.length === 0) return setErrorMsg('Выберите хотя бы одну группу.');
    if (draft.isScheduled && !draft.publishDate) return setErrorMsg('Укажите дату и время.');

    setIsPublishing(true);
    const result = await createPostAction(draft.text, draft.photos, draft.accountIds, draft.isScheduled ? draft.publishDate : null);
    setIsPublishing(false);

    if (result.success) {
      updateDraft({ step: 4 }); // Переход на экран успеха
    } else {
      setErrorMsg(result.error);
    }
  };

  // === РЕНДЕР ПРОГРЕСС-БАРА ===
  const StepIndicator = ({ number, title }) => (
    <div className={`flex flex-col items-center gap-2 ${draft.step >= number ? 'text-admin-accent' : 'text-gray-600'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${draft.step >= number ? 'bg-admin-accent text-white shadow-lg shadow-blue-500/30' : 'bg-gray-800 text-gray-500'}`}>
        {draft.step > number ? <CheckCircle2 size={20} /> : number}
      </div>
      <span className="text-xs font-medium hidden sm:block">{title}</span>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto min-h-[calc(100vh-8rem)] flex flex-col">
      <h1 className="text-2xl font-bold mb-8 flex items-center gap-2 text-white">
        <Send className="text-admin-accent" /> Создание публикации
      </h1>

      {/* ПРОГРЕСС БАР (Скрыт на финальном шаге) */}
      {draft.step < 4 && (
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute left-0 top-5 w-full h-0.5 bg-gray-800 -z-10"></div>
          <div className="absolute left-0 top-5 h-0.5 bg-admin-accent -z-10 transition-all duration-500" style={{ width: `${(draft.step - 1) * 50}%` }}></div>
          <StepIndicator number={1} title="Фотографии" />
          <StepIndicator number={2} title="Описание" />
          <StepIndicator number={3} title="Публикация" />
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
          <AlertCircle size={20} /> <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      <div className="flex-1 bg-admin-card border border-gray-800 rounded-3xl p-6 md:p-10 shadow-xl relative overflow-hidden">
        
        {/* ================= ШАГ 1: ФОТОГРАФИИ ================= */}
        {draft.step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Загрузите фотографии</h2>
                <p className="text-gray-400 text-sm mt-1">Добавьте товар лицом. Партнеры получат эти фото без водяных знаков.</p>
              </div>
              <span className={`text-sm font-bold ${draft.photos.length === 10 ? 'text-red-400' : 'text-admin-accent'}`}>
                {draft.photos.length} / 10
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
              {draft.photos.map((url, idx) => (
                <div key={idx} className="aspect-square rounded-xl border border-gray-700 relative group overflow-hidden bg-gray-900">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(idx)} className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              
              {draft.photos.length < 10 && (
                <button onClick={handleAddMockPhoto} className="aspect-square rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-admin-accent hover:bg-admin-accent/10 transition-all cursor-pointer">
                  <ImageIcon size={28} className="mb-2" />
                  <span className="text-xs font-medium text-center px-2">Добавить фото</span>
                </button>
              )}
            </div>

            <div className="flex justify-end">
              <button 
                onClick={nextStep} 
                disabled={draft.photos.length === 0}
                className="bg-admin-accent hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
              >
                Далее <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ================= ШАГ 2: ОПИСАНИЕ И AI ================= */}
        {draft.step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-xl font-bold text-white">Описание товара</h2>
              <span className={`text-sm font-bold ${draft.text.length >= 1000 ? 'text-red-400' : 'text-gray-400'}`}>
                {draft.text.length} / 1000
              </span>
            </div>

            <div className="relative mb-8">
              <textarea 
                value={draft.text}
                onChange={(e) => updateDraft({ text: e.target.value.slice(0, 1000) })}
                placeholder="Опишите товар: цена, размеры, материал..."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-4 text-white h-56 resize-none focus:outline-none focus:border-admin-accent transition-all"
              />
              
              {/* КНОПКА AI */}
              <button 
                onClick={handleAiImprove}
                disabled={isAiLoading || !draft.text.trim()}
                className="absolute bottom-4 right-4 bg-purple-500/20 text-purple-400 hover:bg-purple-500 hover:text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all border border-purple-500/30"
              >
                {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isAiLoading ? 'Улучшаем...' : 'Улучшить через AI'}
              </button>
            </div>

            <div className="flex justify-between">
              <button onClick={prevStep} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all">
                <ChevronLeft size={18} /> Назад
              </button>
              <button onClick={nextStep} className="bg-admin-accent hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all">
                Далее <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ================= ШАГ 3: ПУБЛИКАЦИЯ ================= */}
        {draft.step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold text-white mb-6">Куда и когда публикуем?</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Аккаунты */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-400 mb-2">Выберите группы:</label>
                {accounts.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-gray-900 p-4 rounded-xl border border-gray-800">Нет подключенных групп.</p>
                ) : (
                  accounts.map(acc => (
                    <label key={acc.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${draft.accountIds.includes(acc.id) ? 'bg-admin-accent/10 border-admin-accent' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-gray-600 text-admin-accent bg-gray-800"
                        checked={draft.accountIds.includes(acc.id)}
                        onChange={() => {
                          const newIds = draft.accountIds.includes(acc.id) 
                            ? draft.accountIds.filter(id => id !== acc.id) 
                            : [...draft.accountIds, acc.id];
                          updateDraft({ accountIds: newIds });
                        }}
                      />
                      <img src={acc.avatarUrl} className="w-8 h-8 rounded-full border border-gray-700" alt="" />
                      <span className="text-sm font-bold text-white truncate">{acc.name}</span>
                    </label>
                  ))
                )}
              </div>

              {/* Время */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">Время выхода:</label>
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-900 border border-gray-800 rounded-xl">
                  <input type="radio" checked={!draft.isScheduled} onChange={() => updateDraft({ isScheduled: false })} className="w-4 h-4 text-admin-accent" />
                  <span className="text-white text-sm">Опубликовать сейчас</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-900 border border-gray-800 rounded-xl">
                  <input type="radio" checked={draft.isScheduled} onChange={() => updateDraft({ isScheduled: true })} className="w-4 h-4 text-admin-accent" />
                  <span className="text-white text-sm">Отложить публикацию</span>
                </label>
                {draft.isScheduled && (
                  <input 
                    type="datetime-local" 
                    value={draft.publishDate}
                    onChange={(e) => updateDraft({ publishDate: e.target.value })}
                    className="w-full bg-gray-900 border border-admin-accent/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-admin-accent"
                  />
                )}
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-800">
              <button onClick={prevStep} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all">
                <ChevronLeft size={18} /> Назад
              </button>
              <button onClick={handlePublish} disabled={isPublishing} className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-green-500/20">
                {isPublishing ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                {isPublishing ? 'Отправка...' : 'Опубликовать'}
              </button>
            </div>
          </div>
        )}

        {/* ================= ШАГ 4: УСПЕХ И ПАРТНЕРЫ ================= */}
        {draft.step === 4 && (
          <div className="text-center py-10 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={50} className="text-green-500" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Пост успешно создан!</h2>
            <p className="text-gray-400 max-w-md mx-auto mb-10">Ваши публикации отправлены в очередь. Уникальные подписи и водяные знаки применены автоматически.</p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => setShowPartnerModal(true)} className="w-full sm:w-auto bg-admin-accent hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-500/30">
                <Users size={20} /> Отправить партнерам
              </button>
              <button onClick={clearDraft} className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-xl font-bold transition-all">
                Новая публикация
              </button>
            </div>
          </div>
        )}

      </div>

      {/* === МОДАЛЬНОЕ ОКНО ДЛЯ ОТПРАВКИ ПАРТНЕРАМ === */}
      {showPartnerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setShowPartnerModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
              <X size={24} />
            </button>
            
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Users className="text-admin-accent" /> Поделиться товаром
            </h3>
            <p className="text-sm text-gray-400 mb-6">Выберите партнеров, которым хотите отправить товар. Они получат фото без ваших водяных знаков.</p>

            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2 mb-6">
              {myPartners.length === 0 ? (
                <p className="text-center text-gray-500 py-4">У вас пока нет партнеров.</p>
              ) : (
                myPartners.map(p => (
                  <label key={p.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-xl border border-gray-800 cursor-pointer hover:border-gray-700 transition-colors">
                    <div>
                      <span className="text-white font-bold block">{p.name}</span>
                      <span className="text-xs text-admin-accent">{p.pavilion}</span>
                    </div>
                    <input type="checkbox" className="w-5 h-5 rounded border-gray-600 text-admin-accent bg-gray-800 focus:ring-admin-accent" />
                  </label>
                ))
              )}
            </div>

            <button onClick={() => {
              alert('Эта логика появится на следующем шаге разработки (Бэкенд)!');
              setShowPartnerModal(false);
              clearDraft();
            }} className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold transition-all">
              Отправить выбранным
            </button>
          </div>
        </div>
      )}

    </div>
  );
}