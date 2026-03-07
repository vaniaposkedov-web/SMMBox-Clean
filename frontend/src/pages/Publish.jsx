import { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ImagePlus, X, Sparkles, ChevronRight, ChevronLeft, 
  Send, CheckCircle2, Share2, Users, LayoutTemplate,
  Search, CalendarClock, Clock, MessageSquare, Plus, Loader2,
  Settings, PenTool, Check
} from 'lucide-react';
import { useStore } from '../store';

// === ИКОНКИ СОЦСЕТЕЙ (SVG) ===
const IconVK = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93v6.14C2 20.67 3.33 22 8.93 22h6.14c5.6 0 6.93-1.33 6.93-6.93V8.93C22 3.33 20.67 2 15.07 2zm3.3 14.53h-1.55c-.52 0-.67-.41-1.58-1.33-.77-.79-1.07-.88-1.26-.88-.26 0-.34.08-.34.5v1.2c0 .32-.1.51-1.5.51-2.2 0-4.6-1.5-6.23-3.86C4.16 9.88 3.5 6.92 3.5 6.57c0-.28.1-.5.62-.5h1.56c.46 0 .61.22.8.72 1.25 3.5 2.92 5.51 3.73 5.51.21 0 .31-.1.31-.63V8.65c-.06-1.14-.34-1.25-1.08-1.25-.33 0-.15-.46.12-.64.41-.27 1.15-.29 1.76-.29.83 0 1.05.07 1.25.13.34.11.31.39.31 1.09v3.08c0 .41.18.51.3.51.25 0 .65-.18 1.48-1.02 1.22-1.34 2.1-3.64 2.4-4.57.14-.39.3-.57.77-.57h1.55c.61 0 .73.3.62.72-.25.86-1.74 3.12-2.51 4.14-.36.47-.46.61-.17 1 .23.33 1.05 1.02 1.5 1.58 1.01 1.23 1.3 1.77 1.48 2.05.21.31.06.63-.4.63z"/>
  </svg>
);

const IconTG = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
  </svg>
);

export default function Publish() {
  // ИЗМЕНЕНО: Достаем createPostAction из стора!
  const { user, accounts, fetchAccounts, globalSettings, fetchGlobalSettings, tempDraft, saveTempDraft, createPostAction } = useStore();
  const isRestored = useRef(false);

  const [view, setView] = useState('start'); 
  const [step, setStep] = useState(1);
  
  const [photos, setPhotos] = useState([]);
  const [text, setText] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  
  const [applyWatermark, setApplyWatermark] = useState(true);
  const [applySignature, setApplySignature] = useState(true);
  const [accountOverrides, setAccountOverrides] = useState({});

  const [publishMode, setPublishMode] = useState('now');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scheduleTime, setScheduleTime] = useState('');

  const [isImprovingAI, setIsImprovingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const [isPublishing, setIsPublishing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState('idle'); 
  const fileInputRef = useRef(null);

  const MAX_PHOTOS = 10;
  const MAX_CHARS = 1000;

  const mockScheduledPosts = [
    { id: 1, date: new Date().toISOString().split('T')[0], time: '14:30', text: 'Поступление новых кроссовок...', network: 'VK', color: 'bg-blue-600' },
  ];

  const calendarDays = useMemo(() => {
    return Array.from({length: 14}).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const groupedAccounts = useMemo(() => {
    const filtered = accounts.filter(acc => 
      acc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      acc.provider.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return filtered.reduce((acc, curr) => {
      if (!acc[curr.provider]) acc[curr.provider] = [];
      acc[curr.provider].push(curr);
      return acc;
    }, {});
  }, [searchQuery, accounts]);

  // === ЗАГРУЗКА И ВОССТАНОВЛЕНИЕ (С СОХРАНЕНИЕМ ШАГА) ===
  useEffect(() => {
    if (user?.id) {
      fetchAccounts(user.id);
      fetchGlobalSettings();
    }
  }, [user?.id, fetchAccounts, fetchGlobalSettings]);

  useEffect(() => {
    if (tempDraft && !isRestored.current) {
      if (tempDraft.text) setText(tempDraft.text);
      if (tempDraft.selectedAccounts) setSelectedAccounts(tempDraft.selectedAccounts);
      if (tempDraft.accountOverrides) setAccountOverrides(tempDraft.accountOverrides);
      if (tempDraft.applyWatermark !== undefined) setApplyWatermark(tempDraft.applyWatermark);
      if (tempDraft.applySignature !== undefined) setApplySignature(tempDraft.applySignature);
      
      // ВОТ ЭТО ПОЧИНИТ ПРОБЛЕМУ СО СБРОСОМ: восстанавливаем экран, на котором был пользователь!
      if (tempDraft.step) setStep(tempDraft.step);
      if (tempDraft.view) setView(tempDraft.view);
      if (tempDraft.publishMode) setPublishMode(tempDraft.publishMode);
      if (tempDraft.scheduleTime) setScheduleTime(tempDraft.scheduleTime);
      if (tempDraft.selectedCalendarDate) setSelectedCalendarDate(tempDraft.selectedCalendarDate);
    }
    isRestored.current = true;
  }, [tempDraft]);

  // === АВТОСОХРАНЕНИЕ В ПАМЯТЬ ===
  // === 1. ЗАМЕНИ ЭТОТ БЛОК ЦЕЛИКОМ ===
  useEffect(() => {
    // ВАЖНО: Добавили step === 4, чтобы он не пытался воскресить удаленный черновик
    if (!isRestored.current || !saveTempDraft || step === 4) return; 
    const timer = setTimeout(() => {
      saveTempDraft({ 
        text, selectedAccounts, accountOverrides, applyWatermark, applySignature,
        step, view, publishMode, scheduleTime, selectedCalendarDate
      });
    }, 500); 
    return () => clearTimeout(timer);
  }, [text, selectedAccounts, accountOverrides, applyWatermark, applySignature, step, view, publishMode, scheduleTime, selectedCalendarDate, saveTempDraft]);
  

  const toggleAccount = (id) => {
    setSelectedAccounts(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const toggleAllAccounts = () => {
    if (selectedAccounts.length === accounts.length && accounts.length > 0) {
      setSelectedAccounts([]); 
    } else {
      setSelectedAccounts(accounts.map(a => a.id)); 
    }
  };

  const getEffectiveSetting = (accountId, settingType) => {
    if (accountOverrides[accountId] && accountOverrides[accountId].mode === 'custom') {
      return accountOverrides[accountId][settingType];
    }
    return settingType === 'watermark' ? applyWatermark : applySignature;
  };

  const handleModeChange = (accountId, newMode) => {
    setAccountOverrides(prev => {
      if (newMode === 'template') {
        const next = { ...prev };
        delete next[accountId];
        return next;
      } else {
        return {
          ...prev,
          [accountId]: {
            mode: 'custom',
            watermark: applyWatermark,
            signature: applySignature
          }
        };
      }
    });
  };

  const handleOverride = (accountId, settingType) => {
    setAccountOverrides(prev => {
      let currentVal = getEffectiveSetting(accountId, settingType);
      if (prev[accountId] && prev[accountId][settingType] !== undefined) {
        currentVal = prev[accountId][settingType];
      }
      return {
        ...prev,
        [accountId]: {
          ...(prev[accountId] || { mode: 'custom' }),
          [settingType]: !currentVal
        }
      };
    });
  };

  const handleGlobalToggle = (type) => {
    if (type === 'watermark') setApplyWatermark(prev => !prev);
    else setApplySignature(prev => !prev);
  };

  // === ОБРАБОТЧИКИ ФОТО ===
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newPhotos = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(file),
      file
    }));

    setPhotos(prev => {
      const combined = [...prev, ...newPhotos];
      if (combined.length > MAX_PHOTOS) {
        alert(`Максимум ${MAX_PHOTOS} фотографий!`);
        return combined.slice(0, MAX_PHOTOS);
      }
      return combined;
    });
  };

  const removePhoto = (idToRemove) => {
    setPhotos(prev => prev.filter(p => p.id !== idToRemove));
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
  };

  // === ИНТЕГРАЦИЯ НЕЙРОСЕТИ ===
  const handleAiAction = async (actionType, customPrompt = '') => {
    const textToProcess = actionType === 'rewrite' ? text : customPrompt;
    if (!textToProcess) return;

    setIsImprovingAI(true);
    setShowAiModal(false);
    setAiPrompt('');
    setAiProgress(0);

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
        currentProgress += Math.floor(Math.random() * 12) + 4;
        if (currentProgress > 95) currentProgress = 95;
        setAiProgress(currentProgress);
    }, 400);

    try {
        let base64Images = [];
        if (photos.length > 0) {
            const photosToProcess = photos.slice(0, 2);
            base64Images = await Promise.all(photosToProcess.map(p => fileToBase64(p.file)));
        }

        const token = localStorage.getItem('token');
        
        const response = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                prompt: textToProcess, 
                action: actionType,
                images: base64Images 
            })
        });

        const data = await response.json();
        
        clearInterval(progressInterval);
        setAiProgress(100);
        
        setTimeout(() => {
            if (data.success) {
                setText(data.text);
            } else {
                alert(data.error || 'Ошибка при генерации текста');
            }
            setIsImprovingAI(false);
            setAiProgress(0);
        }, 500);

    } catch (error) {
        clearInterval(progressInterval);
        setIsImprovingAI(false);
        setAiProgress(0);
        console.error('Ошибка ИИ:', error);
        alert('Ошибка соединения с нейросетью. Проверьте API ключ на бэкенде.');
    }
  };

  // === ЗАМЕНИ ЭТУ ФУНКЦИЮ ЦЕЛИКОМ ===
  // === 2. ЗАМЕНИ ЭТУ ФУНКЦИЮ ЦЕЛИКОМ ===
  const handlePublish = async () => {
    if (selectedAccounts.length === 0) return setTimeout(() => alert('Выберите хотя бы один аккаунт!'), 10);
    if (publishMode === 'schedule' && (!selectedCalendarDate || !scheduleTime)) return setTimeout(() => alert('Укажите дату и время для отложенного поста!'), 10);
    
    setIsPublishing(true);

    try {
        const base64Images = await Promise.all(photos.map(p => fileToBase64(p.file)));

        const accountsData = selectedAccounts.map(id => ({
          accountId: id,
          applyWatermark: getEffectiveSetting(id, 'watermark'),
          applySignature: getEffectiveSetting(id, 'signature')
        }));

        const publishAt = publishMode === 'schedule' ? `${selectedCalendarDate}T${scheduleTime}:00` : null;

        const result = await createPostAction(text, base64Images, selectedAccounts, accountsData, publishAt);

        if (result.success) {
            setIsPublishing(false);
            // Задержка 50мс спасает React от конфликта удаления кнопки и перерисовки шагов
            setTimeout(() => {
                if (saveTempDraft) saveTempDraft(null); 
                setStep(4); 
            }, 50);
        } else {
            setIsPublishing(false);
            // Если вылезет 400 ошибка, мы увидим этот текст, а не черный экран
            setTimeout(() => alert(result.error || 'Ошибка 400: Файлы слишком большие или сервер отверг запрос'), 50);
        }
    } catch (error) {
        console.error('Критическая ошибка публикации:', error);
        setIsPublishing(false);
        setTimeout(() => alert('Произошла ошибка. Бэкенд не отвечает.'), 50);
    }
  };

  const handleSendToPartners = () => {
    setPartnerStatus('sending');
    setTimeout(() => {
      setPartnerStatus('sent');
    }, 2000);
  };

  // === ЗАМЕНИ ЭТУ ФУНКЦИЮ ЦЕЛИКОМ ===
  const resetForm = () => {
    setPhotos([]);
    setText('');
    setSelectedAccounts([]);
    setAccountOverrides({});
    setScheduleTime('');
    setStep(1);
    setIsPublishing(false); // <-- Добавили этот сброс сюда
    setShowPartnerModal(false);
    setPartnerStatus('idle');
    setView('start'); 
    if (saveTempDraft) saveTempDraft(null);
  };

  // ==========================================
  // РЕНДЕР: ЭКРАН 1 - ВЫБОР РЕЖИМА (СТАРТ)
  // ==========================================
  if (view === 'start') {
    return (
      <div className="min-h-[100dvh] bg-admin-bg p-4 sm:p-8 flex flex-col items-center justify-center animate-fade-in relative pb-24 md:pb-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-3xl flex items-center justify-center mb-6 relative z-10 border border-blue-500/20">
          <LayoutTemplate size={32} />
        </div>
        
        <h1 className="text-2xl sm:text-4xl font-bold text-white mb-3 text-center relative z-10">Создание публикации</h1>
        <p className="text-gray-400 mb-10 text-center max-w-md relative z-10">
          Выберите, хотите ли вы отправить пост прямо сейчас или запланировать его в контент-плане.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-2xl relative z-10">
          
          <button 
            onClick={() => { setPublishMode('now'); setView('wizard'); setStep(1); }} 
            className="bg-admin-card border border-gray-800 hover:border-blue-500 rounded-[2rem] p-6 sm:p-8 flex flex-col items-center text-center transition-all group active:scale-95 shadow-xl hover:shadow-blue-500/10"
          >
            <div className="w-20 h-20 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mb-5 group-hover:scale-110 transition-transform border border-blue-500/20">
              <Send size={32} className="ml-1" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Запостить сейчас</h3>
            <p className="text-sm text-gray-400">Мгновенная публикация во все выбранные социальные сети</p>
          </button>

          <button 
            onClick={() => setView('calendar')} 
            className="bg-admin-card border border-gray-800 hover:border-purple-500 rounded-[2rem] p-6 sm:p-8 flex flex-col items-center text-center transition-all group active:scale-95 shadow-xl hover:shadow-purple-500/10"
          >
            <div className="w-20 h-20 bg-purple-500/10 text-purple-500 rounded-full flex items-center justify-center mb-5 group-hover:scale-110 transition-transform border border-purple-500/20">
              <CalendarClock size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Отложенный пост</h3>
            <p className="text-sm text-gray-400">Откройте календарь, выберите дату и запланируйте публикацию</p>
          </button>

        </div>
      </div>
    );
  }

  // ==========================================
  // РЕНДЕР: ЭКРАН 2 - КАЛЕНДАРЬ
  // ==========================================
  if (view === 'calendar') {
    const selectedDateObj = new Date(selectedCalendarDate);
    const postsForSelectedDate = mockScheduledPosts.filter(p => p.date === selectedCalendarDate);

    return (
      <div className="min-h-[100dvh] bg-admin-bg p-4 sm:p-8 pb-32 md:pb-8 animate-fade-in">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => setView('start')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors p-2 -ml-2 rounded-lg active:bg-gray-800">
            <span className="flex items-center justify-center"><ChevronLeft size={24} className="sm:w-5 sm:h-5" /></span>
            <span className="font-medium">Назад к выбору</span>
          </button>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Контент-план</h2>
          <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 mb-4">
            {calendarDays.map((d) => {
              const isoDate = d.toISOString().split('T')[0];
              const isSelected = isoDate === selectedCalendarDate;
              const dayName = d.toLocaleDateString('ru-RU', { weekday: 'short' });
              const dayNum = d.getDate();
              const hasPosts = mockScheduledPosts.some(p => p.date === isoDate);
              return (
                <button 
                  key={isoDate}
                  onClick={() => setSelectedCalendarDate(isoDate)}
                  className={`relative flex flex-col items-center justify-center min-w-[72px] h-[88px] rounded-2xl border transition-all active:scale-95 shrink-0
                    ${isSelected ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-admin-card border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                >
                  <span className="text-xs uppercase font-medium mb-1">{dayName}</span>
                  <span className="text-2xl font-bold">{dayNum}</span>
                  {hasPosts && !isSelected && <div className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full"></div>}
                </button>
              )
            })}
          </div>

          <div className="mt-2">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock size={20} className="text-purple-500" />
              Запланировано на {selectedDateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </h3>
            <div className="space-y-3">
              {postsForSelectedDate.length > 0 ? (
                postsForSelectedDate.map(post => (
                  <div key={post.id} className="bg-admin-card border border-gray-800 p-4 rounded-2xl flex items-center justify-between gap-4 transition-colors hover:bg-gray-900/80">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${post.color}`}>
                        {post.network}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-medium text-sm truncate">{post.text}</p>
                        <p className="text-purple-400 text-xs mt-1 font-bold">{post.time}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-admin-card border border-gray-800 border-dashed rounded-3xl p-8 text-center">
                  <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CalendarClock size={28} className="text-gray-600" />
                  </div>
                  <p className="text-gray-300 font-medium">Свободный день</p>
                  <p className="text-gray-500 text-sm mt-1">На эту дату пока нет запланированных публикаций.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="fixed bottom-[72px] md:bottom-0 left-0 md:left-64 right-0 bg-admin-card/95 backdrop-blur-xl border-t border-gray-800 p-4 z-30 transition-all shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="max-w-3xl mx-auto">
            <button 
              onClick={() => {
                 setPublishMode('schedule');
                 setView('wizard');
                 setStep(1);
              }}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 active:scale-95 flex justify-center items-center gap-2"
            >
              <span className="flex items-center gap-2"><Plus size={20} /> Запостить ещё на эту дату</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // РЕНДЕР: ЭКРАН 3 - ВИЗАРД (САМА ПУБЛИКАЦИЯ)
  // ==========================================
  return (
    <div className="min-h-[100dvh] bg-admin-bg pb-32 md:pb-8 font-sans relative animate-fade-in">
      <div className="p-4 sm:p-8 max-w-3xl mx-auto">
        
        {step < 4 && (
          <div className="mb-6">
            <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 px-1">
              <span className={step >= 1 ? (publishMode === 'schedule' ? 'text-purple-500' : 'text-blue-500') : ''}>1. Фото</span>
              <span className={step >= 2 ? (publishMode === 'schedule' ? 'text-purple-500' : 'text-blue-500') : ''}>2. Текст</span>
              <span className={step >= 3 ? (publishMode === 'schedule' ? 'text-purple-500' : 'text-blue-500') : ''}>3. Настройки</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden flex">
              <div className={`h-full transition-all duration-500 ${publishMode === 'schedule' ? 'bg-purple-500' : 'bg-blue-500'} ${step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full'}`}></div>
            </div>
          </div>
        )}

        {/* ШАГ 1: ФОТОГРАФИИ */}
        {step === 1 && (
          <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl animate-fade-in">
            <h2 className="text-xl font-bold text-white mb-1">Загрузите фотографии</h2>
            <p className="text-sm text-gray-400 mb-6">От 1 до {MAX_PHOTOS} снимков.</p>

            {photos.length === 0 ? (
              <button onClick={() => fileInputRef.current?.click()} className={`w-full border-2 border-dashed border-gray-700 bg-gray-900/50 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 transition-all group ${publishMode === 'schedule' ? 'hover:border-purple-500 hover:bg-purple-500/5' : 'hover:border-blue-500 hover:bg-blue-500/5'}`}>
                <div className={`w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center text-gray-400 transition-all ${publishMode === 'schedule' ? 'group-hover:bg-purple-500/20 group-hover:text-purple-500' : 'group-hover:bg-blue-500/20 group-hover:text-blue-500'}`}>
                  <ImagePlus size={32} />
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">Нажмите для выбора фото</p>
                  <p className="text-gray-500 text-sm mt-1">До 10 файлов (JPEG, PNG)</p>
                </div>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative aspect-square rounded-2xl overflow-hidden group border border-gray-800">
                      <img src={photo.url} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <button onClick={() => removePhoto(photo.id)} className="absolute top-2 right-2 bg-red-500/90 text-white p-1.5 rounded-xl hover:bg-red-50 active:scale-90 transition-all">
                        <span className="flex items-center justify-center"><X size={16} /></span>
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button onClick={() => fileInputRef.current?.click()} className={`aspect-square rounded-2xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-500 transition-colors ${publishMode === 'schedule' ? 'hover:border-purple-500 hover:text-purple-500' : 'hover:border-blue-500 hover:text-blue-500'}`}>
                      <ImagePlus size={24} className="mb-1" />
                      <span className="text-xs font-bold">Ещё</span>
                    </button>
                  )}
                </div>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept="image/*" />
          </div>
        )}

        {/* ШАГ 2: ТЕКСТ И НЕЙРОСЕТЬ */}
        {step === 2 && (
          <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl animate-fade-in relative">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Описание поста</h2>
                <p className="text-sm text-gray-400">Напишите текст или поручите это ИИ</p>
              </div>
              <div className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border ${
                (text || '').length >= MAX_CHARS 
                  ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                  : (text || '').length > MAX_CHARS * 0.8 
                    ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' 
                    : 'bg-gray-900 text-gray-500 border-gray-800'
              }`}>
                {(text || '').length} / {MAX_CHARS}
              </div>
            </div>

            <div className={`relative border border-gray-800 rounded-2xl overflow-hidden bg-gray-900 transition-all ${publishMode === 'schedule' ? 'focus-within:border-purple-500' : 'focus-within:border-blue-500'}`}>
              
              {isImprovingAI && (
                <div className="absolute inset-0 z-20 bg-gray-900/80 backdrop-blur-[2px] flex flex-col items-center justify-center animate-fade-in rounded-2xl">
                  <div className="relative mb-4 flex items-center justify-center">
                    <Loader2 className="text-purple-500 animate-spin absolute" size={48} />
                    <Sparkles className="text-purple-400 animate-pulse" size={20} />
                  </div>
                  <h3 className="text-white font-bold mb-1 text-lg">Нейросеть пишет текст...</h3>
                  <p className="text-gray-400 text-xs mb-4">Анализируем фото и подбираем слова</p>
                  
                  <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden shadow-inner relative">
                    <div 
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 ease-out"
                      style={{ width: `${aiProgress}%` }}
                    ></div>
                  </div>
                  <span className="text-purple-400 font-bold text-xs mt-2">{aiProgress}%</span>
                </div>
              )}

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Расскажите о товаре, укажите цены, размеры и особенности..."
                className="w-full min-h-[200px] bg-transparent p-4 text-white text-base resize-none outline-none placeholder:text-gray-600"
              />
              
              <div className="bg-gray-800/50 p-3 border-t border-gray-800 flex flex-wrap gap-2 justify-between items-center">
                <span className="text-xs text-gray-500 hidden sm:block">Поддерживаются эмодзи 🚀</span>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                  <button 
                    onClick={() => setShowAiModal(true)} 
                    disabled={isImprovingAI} 
                    className="w-full sm:w-auto flex justify-center items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                  >
                    ✨ Написать с нуля
                  </button>

                  <button 
                    onClick={() => handleAiAction('rewrite')} 
                    disabled={isImprovingAI || !(text || '').trim()} 
                    className="w-full sm:w-auto flex justify-center items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Sparkles size={16} /> Улучшить текст
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ШАГ 3: ВЫБОР АККАУНТОВ И НАСТРОЙКИ */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            
            {/* БЛОК 1: ВЫБОР АККАУНТОВ С ГРУППИРОВКОЙ */}
            <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Куда опубликовать?</h2>
                  <p className="text-sm text-gray-400">Выберите аккаунты для отправки (выбрано {selectedAccounts.length})</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-48">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Search size={16} /></span>
                    <input 
                      type="text" 
                      placeholder="Поиск..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full bg-gray-900 border border-gray-800 rounded-xl py-2 pl-9 pr-3 text-sm text-white outline-none transition-all ${publishMode === 'schedule' ? 'focus:border-purple-500' : 'focus:border-blue-500'}`}
                    />
                  </div>
                  <button onClick={toggleAllAccounts} className={`text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap transition-colors ${publishMode === 'schedule' ? 'text-purple-500 bg-purple-500/10 hover:bg-purple-500/20' : 'text-blue-500 bg-blue-500/10 hover:bg-blue-500/20'}`}>
                    {selectedAccounts.length === accounts.length && accounts.length > 0 ? 'Снять все' : 'Выбрать все'}
                  </button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {Object.keys(groupedAccounts).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm mb-2">Аккаунты не найдены</p>
                    {accounts.length === 0 && <p className="text-xs text-gray-600">Подключите соцсети в разделе "Аккаунты"</p>}
                  </div>
                ) : (
                  Object.entries(groupedAccounts).map(([provider, providerAccounts]) => (
                    <div key={provider} className="mb-4 last:mb-0">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pl-1 flex items-center gap-2">
                        {provider === 'vk' ? 'ВКонтакте' : provider === 'tg' ? 'Telegram' : provider}
                        <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full text-[10px] ml-2">{providerAccounts.length}</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {providerAccounts.map(acc => {
                          const isSelected = selectedAccounts.includes(acc.id);
                          const isWatermarkActive = getEffectiveSetting(acc.id, 'watermark');
                          const isSignatureActive = getEffectiveSetting(acc.id, 'signature');
                          const overrideMode = accountOverrides[acc.id]?.mode || 'template';
                          const avatarSrc = acc.avatarUrl || acc.photo_url || acc.avatar;
                          const iconColor = provider === 'vk' ? 'text-blue-500' : 'text-sky-400';
                          
                          return (
                            <div 
                              key={acc.id}
                              className={`flex flex-col rounded-2xl border transition-all overflow-hidden group
                                ${isSelected ? (publishMode === 'schedule' ? 'bg-gray-800 border-purple-500/50 shadow-md shadow-purple-500/10' : 'bg-gray-800 border-blue-500/50 shadow-md shadow-blue-500/10') : 'bg-gray-900/50 border-gray-800 hover:border-gray-700 hover:bg-gray-800'}`}
                            >
                              <div 
                                onClick={() => toggleAccount(acc.id)}
                                className="flex items-center gap-3 p-3 w-full text-left cursor-pointer"
                              >
                                <div className="relative w-10 h-10 rounded-xl shrink-0 bg-gray-800 flex items-center justify-center font-bold text-gray-400 border border-gray-700">
                                  {avatarSrc ? (
                                    <img src={avatarSrc} alt={acc.name} className="w-full h-full object-cover rounded-xl" />
                                  ) : (
                                    <span className="text-sm">{acc.name.substring(0, 2).toUpperCase()}</span>
                                  )}
                                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 bg-gray-900 rounded-full border-2 border-gray-800 flex items-center justify-center ${iconColor}`}>
                                    {provider === 'vk' ? <IconVK /> : <IconTG />}
                                  </div>
                                </div>
                                
                                <div className="flex-1 min-w-0 pr-2">
                                  <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>{acc.name}</p>
                                  {isSelected && (
                                    <div className="flex gap-2 mt-0.5">
                                      <span className={`text-[10px] flex items-center gap-1 ${isWatermarkActive ? 'text-blue-400' : 'text-gray-500'}`}>
                                        <Check size={10} className={isWatermarkActive ? 'block' : 'hidden'} />
                                        <span className={!isWatermarkActive ? 'line-through' : ''}>Знак</span>
                                      </span>
                                      <span className={`text-[10px] flex items-center gap-1 ${isSignatureActive ? 'text-purple-400' : 'text-gray-500'}`}>
                                        <Check size={10} className={isSignatureActive ? 'block' : 'hidden'} />
                                        <span className={!isSignatureActive ? 'line-through' : ''}>Подпись</span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? (publishMode === 'schedule' ? 'border-purple-500 bg-purple-500' : 'border-blue-500 bg-blue-500') : 'border-gray-600 group-hover:border-gray-500'}`}>
                                  <CheckCircle2 size={12} className={`text-white ${isSelected ? 'block' : 'hidden'}`} />
                                </div>
                              </div>

                              {isSelected && (
                                <div className="bg-gray-900/50 border-t border-gray-700/50 px-3 py-2 flex flex-col gap-2 cursor-default">
                                  
                                  {/* ВЫБОР РЕЖИМА */}
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Настройки:</label>
                                    <select
                                      className={`bg-gray-950 text-white text-[11px] p-1 rounded border border-gray-700 outline-none transition-all ${publishMode === 'schedule' ? 'focus:border-purple-500' : 'focus:border-blue-500'}`}
                                      value={overrideMode}
                                      onChange={(e) => handleModeChange(acc.id, e.target.value)}
                                    >
                                      <option value="template">По шаблону</option>
                                      <option value="custom">Свои</option>
                                    </select>
                                  </div>

                                  {/* ИНДИВИДУАЛЬНЫЕ ПЕРЕКЛЮЧАТЕЛИ */}
                                  {overrideMode === 'custom' && (
                                    <div className="flex items-center justify-between pt-1 border-t border-gray-800/50">
                                      <span className="text-[10px] text-gray-400">Только для этой группы:</span>
                                      <div className="flex gap-2">
                                        <button 
                                          onClick={() => handleOverride(acc.id, 'watermark')}
                                          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors ${isWatermarkActive ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                                        >
                                          <Settings size={12}/> Знак
                                        </button>
                                        <button 
                                          onClick={() => handleOverride(acc.id, 'signature')}
                                          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors ${isSignatureActive ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                                        >
                                          <PenTool size={12}/> Подпись
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* БЛОК 2: ГЛОБАЛЬНЫЕ НАСТРОЙКИ КОНТЕНТА */}
            <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl">
               <h2 className="text-xl font-bold text-white mb-1">Глобальный шаблон</h2>
               <p className="text-sm text-gray-400 mb-4">Применить по умолчанию ко всем группам</p>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${applyWatermark ? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-800'}`} onClick={() => handleGlobalToggle('watermark')}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${applyWatermark ? 'bg-blue-500/20 text-blue-500' : 'bg-gray-800 text-gray-500'}`}>
                        <Settings size={20} />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">Водяной знак</p>
                        <p className="text-xs text-gray-400">Наложить на фото</p>
                      </div>
                    </div>
                    <div className={`w-12 h-6 rounded-full transition-colors relative ${applyWatermark ? 'bg-blue-500' : 'bg-gray-700'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${applyWatermark ? 'left-7' : 'left-1'}`}></div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${applySignature ? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-800'}`} onClick={() => handleGlobalToggle('signature')}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${applySignature ? 'bg-purple-500/20 text-purple-500' : 'bg-gray-800 text-gray-500'}`}>
                        <PenTool size={20} />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">Подпись (Текст)</p>
                        <p className="text-xs text-gray-400">В конец сообщения</p>
                      </div>
                    </div>
                    <div className={`w-12 h-6 rounded-full transition-colors relative ${applySignature ? 'bg-purple-500' : 'bg-gray-700'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${applySignature ? 'left-7' : 'left-1'}`}></div>
                    </div>
                  </div>

               </div>
               
               {(!globalSettings?.watermark && applyWatermark) ? (
                  <p className="text-xs text-yellow-500 mt-3 flex items-center gap-1">
                    ⚠️ В глобальных настройках не задан водяной знак. Он не будет применен.
                  </p>
               ) : null}
            </div>

            {/* БЛОК 3: НАСТРОЙКИ ВРЕМЕНИ */}
            <div className="bg-admin-card border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl">
              {publishMode === 'schedule' ? (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-purple-500/10 text-purple-500 rounded-2xl flex items-center justify-center shrink-0">
                      <CalendarClock size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Время публикации</h2>
                      <p className="text-sm text-gray-400">Пост будет отправлен автоматически</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-gray-900/50 p-4 rounded-2xl border border-gray-800/50">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Дата</label>
                      <input 
                        type="date" 
                        value={selectedCalendarDate}
                        onChange={(e) => setSelectedCalendarDate(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-all" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Время</label>
                      <input 
                        type="time" 
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-all" 
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center shrink-0">
                    <Send size={24} className="ml-1" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Мгновенная публикация</h2>
                    <p className="text-sm text-gray-400">Пост будет отправлен сразу после нажатия кнопки</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ШАГ 4: УСПЕХ */}
        {step === 4 && (
          <div className="bg-admin-card border border-gray-800 rounded-3xl p-8 shadow-xl text-center animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-green-500/10 to-transparent pointer-events-none"></div>
            
            <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={48} />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-2">
              {publishMode === 'schedule' ? 'Пост запланирован!' : 'Успешно опубликовано!'}
            </h2>
            <p className="text-gray-400 mb-8 max-w-sm mx-auto">
              Ваш контент отправлен в {selectedAccounts.length} аккаунт(а/ов).
            </p>

            <div className="space-y-3">
              <button onClick={resetForm} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-4 rounded-xl font-bold transition-all border border-gray-700">
                <span className="flex items-center gap-2"><LayoutTemplate size={20} /> Вернуться в меню</span>
              </button>
              
              <button onClick={() => setShowPartnerModal(true)} className={`w-full flex items-center justify-center gap-2 text-white py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 ${publishMode === 'schedule' ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/20' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20'}`}>
                <span className="flex items-center gap-2"><Share2 size={20} /> Отправить партнерам</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* === МОДАЛЬНОЕ ОКНО "НАПИСАТЬ С НУЛЯ" === */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-admin-card w-full max-w-md border border-gray-800 rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setShowAiModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white bg-gray-900 rounded-full p-2 transition-colors">
              <span className="flex items-center justify-center"><X size={20} /></span>
            </button>

            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-purple-500/10 text-purple-500">
              <Sparkles size={32} />
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">О чем написать пост?</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Напишите короткую мысль. Нейросеть проанализирует загруженные фотографии и создаст сочный, естественный текст.
            </p>

            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Например: Скидка 50% на стикеры 'ЗАКРЫВАЮ', в наличии 10 штук..."
              className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 text-white resize-none outline-none focus:border-purple-500 transition-colors h-32 mb-4"
              autoFocus
            />

            <button 
              onClick={() => handleAiAction('generate', aiPrompt)}
              disabled={!aiPrompt.trim() || isImprovingAI}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:grayscale active:scale-95"
            >
              <Sparkles size={18} /> Сгенерировать пост
            </button>
          </div>
        </div>
      )}

      {/* НИЖНЯЯ ПАНЕЛЬ НАВИГАЦИИ */}
      {step < 4 && (
        <div className="fixed bottom-[72px] md:bottom-0 left-0 md:left-64 right-0 bg-admin-card/95 backdrop-blur-xl border-t border-gray-800 p-4 z-30 transition-all shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            
            <button 
              onClick={() => {
                if (step === 1) setView(publishMode === 'schedule' ? 'calendar' : 'start');
                else setStep(step - 1);
              }} 
              className="w-14 h-14 shrink-0 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white rounded-2xl transition-colors active:scale-95"
            >
              <span className="flex items-center justify-center"><ChevronLeft size={24} /></span>
            </button>

            {/* === 3. ЗАМЕНИ ВЕСЬ ТЕГ <button> НА ЭТОТ === */}
            <button 
              onClick={() => {
                if (step === 1 && photos.length === 0) return setTimeout(() => alert('Добавьте хотя бы 1 фото!'), 10);
                if (step === 2 && !text.trim() && !isImprovingAI) return setTimeout(() => alert('Напишите текст поста!'), 10);
                if (step === 3) return handlePublish();
                setStep(step + 1);
              }}
              disabled={isPublishing}
              className={`flex-1 flex items-center justify-center gap-2 h-14 rounded-2xl font-bold text-base transition-all active:scale-95
                ${step === 3 ? (publishMode === 'schedule' ? 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-500/25' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/25') : 'bg-white text-black hover:bg-gray-200'}`}
            >
              {/* СТАБИЛЬНЫЙ УЗЕЛ ЗАЩИЩАЕТ ОТ ОШИБКИ REMOVECHILD */}
              <span className="flex items-center gap-2 pointer-events-none">
                {isPublishing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" /> Обработка...
                  </>
                ) : step === 3 ? (
                  publishMode === 'schedule' ? (
                    <><CalendarClock size={20}/> Запланировать</>
                  ) : (
                    <><Send size={20}/> Опубликовать</>
                  )
                ) : (
                  <>
                    <span className="hidden sm:inline">Продолжить</span>
                    <span className="sm:hidden">Далее</span> 
                    <ChevronRight size={20}/>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      )}

      {showPartnerModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-admin-card w-full max-w-md border border-gray-800 rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setShowPartnerModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white bg-gray-900 rounded-full p-2">
              <span className="flex items-center justify-center"><X size={20} /></span>
            </button>

            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${publishMode === 'schedule' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
              <Users size={32} />
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">Рассылка партнерам</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Пост без водяных знаков будет отправлен вашим партнерам в Telegram-бот для проверки.
            </p>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6 space-y-3">
              <div className="flex items-start gap-3 text-sm text-gray-400">
                <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                <span>Партнер получит уведомление в бот</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-gray-400">
                <MessageSquare size={16} className={`${publishMode === 'schedule' ? 'text-purple-500' : 'text-blue-500'} shrink-0 mt-0.5`} />
                <span>Отказ обязательно сопровождается причиной</span>
              </div>
            </div>

            {partnerStatus === 'idle' && (
              <button onClick={handleSendToPartners} className={`w-full text-white py-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 ${publishMode === 'schedule' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                <span className="flex items-center gap-2"><Send size={18} /> Разослать сейчас</span>
              </button>
            )}

            {partnerStatus === 'sending' && (
              <button disabled className="w-full bg-gray-800 text-gray-400 py-4 rounded-xl font-bold flex justify-center items-center gap-2">
                <span className="flex items-center gap-2">
                  <span className="animate-spin w-5 h-5 border-2 border-gray-500 border-t-white rounded-full"></span> Отправка...
                </span>
              </button>
            )}

            {partnerStatus === 'sent' && (
              <div className="text-center py-2 animate-fade-in">
                <div className="text-green-500 flex justify-center mb-2"><CheckCircle2 size={32} /></div>
                <p className="text-white font-bold">Успешно отправлено!</p>
                <button onClick={resetForm} className={`mt-6 text-sm font-bold hover:underline ${publishMode === 'schedule' ? 'text-purple-500' : 'text-blue-500'}`}>
                  В главное меню
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}