import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ImagePlus, X, Sparkles, ChevronRight, ChevronLeft, 
  Send, CheckCircle2, Share2, Users, LayoutTemplate,
  Search, CalendarClock, Clock, Loader2,
  Settings, PenTool, Check, Trash2, Plus, 
  AlertCircle // <-- ОБЯЗАТЕЛЬНО ДОЛЖНА БЫТЬ ДОБАВЛЕНА СЮДА
} from 'lucide-react';
import { useStore } from '../store';

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
  
  const publishDraft = useStore((state) => state.publishDraft); // ✅ ОБЯЗАТЕЛЬНО ДОБАВИТЬ ЭТУ СТРОКУ
  const navigate = useNavigate();
  
  // Состояния для публикации
  const [scheduleTime, setScheduleTime] = useState('');
  const { 
    user, accounts, fetchAccounts, globalSettings, fetchGlobalSettings, 
    tempDraft, saveTempDraft, createPostAction,
    myPartners, sharePostAction, fetchPartnerData
  } = useStore();
  const [postTime, setPostTime] = useState('');
  const isRestored = useRef(false);

  const [view, setView] = useState('start'); 
  const [step, setStep] = useState(1);
  
  const [photos, setPhotos] = useState([]);
  const [text, setText] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  
  const [applyWatermark, setApplyWatermark] = useState(true);
  const [applySignature, setApplySignature] = useState(true);
  
  const [publishMode, setPublishMode] = useState('now');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  

  const [isImprovingAI, setIsImprovingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const [isPublishing, setIsPublishing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState('idle'); 
  const [selectedPartners, setSelectedPartners] = useState([]);
  // === ДОБАВЬТЕ ЭТУ СТРОКУ ===
  const [toastMessage, setToastMessage] = useState(null);

  const [editPost, setEditPost] = useState(null);
  const [editTab, setEditTab] = useState('text');
  const [editText, setEditText] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);

  const fileInputRef = useRef(null);

  const MAX_PHOTOS = 10;
  const MAX_CHARS = 1000;

 

  const scheduledPostsRaw = useStore(state => state.scheduledPosts) || [];
  const watermarkSettings = useStore(state => state.watermarkSettings);
  const fetchScheduledPosts = useStore(state => state.fetchScheduledPosts);
  const deleteScheduledPostAction = useStore(state => state.deleteScheduledPostAction);

  
  const [isSharing, setIsSharing] = useState(false);
  const handleShareToPartners = async () => {
    if (selectedPartners.length === 0) return;
    setIsSharing(true);
    
    try {
      const base64Images = await Promise.all(photos.map(p => fileToBase64(p.file)));
      const res = await sharePostAction(text, base64Images, selectedPartners);
      
      if (res?.success) {
        // Убрали все setTimeout для закрытия!
        // React 18 автоматически склеит эти обновления и обновит DOM без краша.
        setShowPartnerModal(false);
        setIsSharing(false);
        setSelectedPartners([]);
        
        setToastMessage('Пост успешно отправлен!');
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        setIsSharing(false);
        setToastMessage('Ошибка при отправке поста');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (error) {
      setIsSharing(false);
      setToastMessage('Ошибка при обработке фотографий');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };
  

  useEffect(() => {
    if (user?.id) fetchScheduledPosts();
  }, [user?.id, fetchScheduledPosts, view]);

  const realScheduledPosts = useMemo(() => {
    if (!Array.isArray(scheduledPostsRaw)) return [];

    return scheduledPostsRaw.map(p => {
      const d = new Date(p.publishAt || p.createdAt);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const localISODate = `${year}-${month}-${day}`;
      
      const prov = (p.account?.provider || '').toUpperCase();
      
      return {
        id: p.id,
        date: localISODate,
        time: d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        text: p.text || 'Без текста',
        network: prov === 'VK' ? 'VK' : 'TG',
        color: prov === 'VK' ? 'bg-blue-500' : 'bg-sky-500',
        accountName: p.account?.name || 'Аккаунт',
        accountAvatar: p.account?.avatarUrl || null, // ФИКС: Сохраняем аватарку
        status: p.status, 
        rawPublishAt: p.publishAt
      };
    });
  }, [scheduledPostsRaw]);

  const calendarDays = useMemo(() => {
    return Array.from({length: 14}).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);


  

  const groupedAccounts = useMemo(() => {
    const filtered = accounts.filter(acc => {
      // Жесткая защита от null и undefined
      const name = acc?.name || '';
      const prov = acc?.provider || '';
      const query = searchQuery?.toLowerCase() || '';
      
      return name.toLowerCase().includes(query) || prov.toLowerCase().includes(query);
    });
    
    return filtered.reduce((acc, curr) => {
      // Приводим провайдер к ВЕРХНЕМУ регистру (VK, TELEGRAM), чтобы не плодить дубликаты
      const prov = (curr.provider || 'unknown').toUpperCase();
      if (!acc[prov]) acc[prov] = [];
      acc[prov].push(curr);
      return acc;
    }, {});
  }, [searchQuery, accounts]);

  useEffect(() => {
    if (user?.id) {
      fetchAccounts(user.id);
      fetchGlobalSettings();
      fetchPartnerData(user.id);
      fetchScheduledPosts(); 
    }
  }, [user?.id]);

  useEffect(() => {
    if (tempDraft && !isRestored.current) {
      if (tempDraft.text) setText(tempDraft.text);
      if (tempDraft.photos) setPhotos(tempDraft.photos); 
      if (tempDraft.selectedAccounts) setSelectedAccounts(tempDraft.selectedAccounts);
      if (tempDraft.applyWatermark !== undefined) setApplyWatermark(tempDraft.applyWatermark);
      if (tempDraft.applySignature !== undefined) setApplySignature(tempDraft.applySignature);
      if (tempDraft.step) setStep(tempDraft.step);
      if (tempDraft.view) setView(tempDraft.view);
      if (tempDraft.publishMode) setPublishMode(tempDraft.publishMode);
      if (tempDraft.scheduleTime) setScheduleTime(tempDraft.scheduleTime);
      if (tempDraft.selectedCalendarDate) setSelectedCalendarDate(tempDraft.selectedCalendarDate);
    }
    isRestored.current = true;
  }, [tempDraft]);

  useEffect(() => {
    if (!isRestored.current || !saveTempDraft || step === 4) return; 
    const timer = setTimeout(() => {
      saveTempDraft({ 
        text, selectedAccounts, applyWatermark, applySignature,
        step, view, publishMode, scheduleTime, selectedCalendarDate
      });
    }, 500); 
    return () => clearTimeout(timer);
  }, [text, selectedAccounts, applyWatermark, applySignature, step, view, publishMode, scheduleTime, selectedCalendarDate, saveTempDraft]);

  const toggleAccount = (id) => {
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const toggleAllAccounts = () => {
    if (selectedAccounts.length === accounts.length && accounts.length > 0) {
      setSelectedAccounts([]); 
    } else {
      setSelectedAccounts(accounts.map(a => a.id)); 
    }
  };

  const togglePartner = (partnerId) => {
    setSelectedPartners(prev => 
      prev.includes(partnerId) 
        ? prev.filter(id => id !== partnerId) // Если уже выбран - убираем
        : [...prev, partnerId] // Если не выбран - добавляем
    );
  };

 



  const handleGlobalToggle = (type) => {
    if (type === 'watermark') setApplyWatermark(prev => !prev);
    else setApplySignature(prev => !prev);
  };

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
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          } else if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = error => reject(error);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Найди старую функцию handleAiAction и замени её на эту:
  const handleAiAction = async () => {
    if (!text.trim()) return;

    setIsImprovingAI(true);
    setAiProgress(0);

    // 📌 ЗАГЛУШКА СИСТЕМНОГО ПРОМПТА (Потом можно брать из globalSettings)
    const systemPrompt = "Ты профессиональный SMM-маркетолог. Твоя задача: улучшить предоставленный текст поста. Исправь ошибки, сделай текст более вовлекающим, разбей на удобные абзацы и добавь 2-3 подходящих эмодзи. Не выдумывай факты и цены, которых нет в оригинале.";

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
        currentProgress += Math.floor(Math.random() * 12) + 4;
        if (currentProgress > 95) currentProgress = 95;
        setAiProgress(currentProgress);
    }, 400);

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
              text: text, // Оригинальный текст пользователя
              systemPrompt: systemPrompt // Инструкция для ИИ
            })
        });

        const data = await response.json();
        clearInterval(progressInterval);
        setAiProgress(100);
        
        setTimeout(() => {
            if (data.success && data.text) setText(data.text);
            else alert(data.error || 'Ошибка при генерации текста');
            setIsImprovingAI(false);
        }, 500);

    } catch (error) {
        clearInterval(progressInterval);
        setIsImprovingAI(false);
        alert('Ошибка соединения с нейросетью.');
    }
  };

const handlePublish = async () => {
    // Проверка: заполнены ли данные профиля
    const isVulnerable = user?.email?.includes('.local') || !user?.phone;
    if (isVulnerable) {
      setToastMessage('Заполните оставшиеся данные в профиле!');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    if (selectedAccounts.length === 0) {
      return setTimeout(() => alert('Выберите хотя бы один аккаунт!'), 10);
    }
    
    // Если включен режим отложенной публикации, время обязательно
    if (publishMode === 'schedule' && !scheduleTime) {
      return setTimeout(() => alert('Укажите время публикации!'), 10);
    }
    
    setIsPublishing(true);

    try {
        const base64Images = await Promise.all(photos.map(p => fileToBase64(p.file)));
        
        const accountsData = selectedAccounts.map(id => {
          const acc = accounts.find(a => a.id === id);
          
          const wmConfig = (acc?.watermark !== null && acc?.watermark !== undefined) 
            ? acc.watermark 
            : (applyWatermark ? (globalSettings?.watermark || watermarkSettings) : null);
            
          const sigText = (acc?.signature !== null && acc?.signature !== undefined) 
            ? acc.signature 
            : (applySignature ? (globalSettings?.signature || '') : null);

          return {
            accountId: id,
            applyWatermark: !!wmConfig,
            applySignature: !!sigText,
            watermarkConfig: wmConfig,
            signatureText: sigText
          };
        });

        let publishAt = null;
        if (publishMode === 'schedule') {
            const baseDate = selectedCalendarDate || new Date().toLocaleDateString('en-CA'); 
            const [year, month, day] = baseDate.split('-');
            const [hours, minutes] = scheduleTime.split(':');
            
            const localDate = new Date();
            localDate.setFullYear(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
            localDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
            
            publishAt = localDate.toISOString(); 
        }

        const result = await createPostAction(text, base64Images, accountsData, publishAt);

        if (result.success) {
            setIsPublishing(false);
            
            if (saveTempDraft) saveTempDraft(null); 
            
            await fetchScheduledPosts(); 
            setStep(4); 
        } else {
            setIsPublishing(false);
            setTimeout(() => alert(result.error || 'Ошибка сервера'), 50);
        }
    } catch (error) {
        console.error("Ошибка при публикации:", error);
        setIsPublishing(false);
        setTimeout(() => alert('Произошла ошибка соединения с сервером.'), 50);
    }
  };

  const handleSendToPartners = async () => {
    if (selectedPartners.length === 0) return alert('Выберите хотя бы одного партнера!');
    setPartnerStatus('sending');
    
    try {
      const base64Images = await Promise.all(photos.map(p => fileToBase64(p.file)));
      const result = await sharePostAction(text, base64Images, selectedPartners);
      
      if (result.success) {
         setPartnerStatus('sent');
         setSelectedPartners([]); 
      } else {
         alert(result.error || 'Ошибка при отправке');
         setPartnerStatus('idle');
      }
    } catch (e) {
      alert('Ошибка соединения с сервером');
      setPartnerStatus('idle');
    }
  };

  const openEditModal = (post) => {
    setEditPost(post);
    setEditTab('text');
    setEditText(post.text);
    
    const d = new Date(post.rawPublishAt);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    setEditDate(`${year}-${month}-${day}`);
    setEditTime(`${hours}:${minutes}`);
  };

  const handleUpdatePost = async () => {
    setIsUpdatingPost(true);
    try {
      const token = localStorage.getItem('token');
      const [year, month, day] = editDate.split('-');
      const [hours, minutes] = editTime.split(':');
      const localDate = new Date(year, month - 1, day, hours, minutes);
      const newIsoDate = localDate.toISOString();

      const res = await fetch(`/api/posts/scheduled/${editPost.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text: editText, publishAt: newIsoDate })
      });
      
      if (res.ok) {
         await fetchScheduledPosts();
         setEditPost(null);
      } else {
         alert('Ошибка при обновлении поста на сервере');
      }
    } catch (e) {
      alert('Ошибка соединения с сервером');
    }
    setIsUpdatingPost(false);
  };

    

  const resetForm = () => {
    setPhotos([]);
    setText('');
    setSelectedAccounts([]);
    setScheduleTime('');
    setStep(1);
    setIsPublishing(false); 
    setShowPartnerModal(false);
    setSelectedPartners([]); 
    setPartnerStatus('idle');
    setView('start'); 
    if (saveTempDraft) saveTempDraft(null);
  };

  const isVulnerable = user?.email?.includes('.local') || !user?.phone || !user?.pavilion;

  if (isVulnerable) {
    return (
      <div className="min-h-[100dvh] bg-admin-bg px-4 py-8 flex flex-col items-center justify-center animate-fade-in relative z-50">
        <div className="bg-admin-card border border-red-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-[0_0_40px_rgba(239,68,68,0.1)]">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 border border-red-500/20">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">Публикация недоступна</h2>
          <p className="text-gray-400 text-sm sm:text-base mb-6 sm:mb-8 leading-relaxed">
            Для создания постов необходимо заполнить профиль: укажите настоящую почту, номер телефона и ваш рабочий павильон.
          </p>
          <button 
            onClick={() => navigate('/profile?tab=settings&highlight=true')} 
            className="w-full bg-red-600 hover:bg-red-500 text-white py-3.5 sm:py-4 rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95"
          >
            Перейти к заполнению
          </button>
        </div>
      </div>
    );
  }

  if (view === 'start') {
    return (
      // Добавлен key="start-view"
      <div key="start-view" className="min-h-[100dvh] bg-admin-bg px-4 py-8 flex flex-col items-center justify-center animate-fade-in relative pb-24 md:pb-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-3xl flex items-center justify-center mb-6 relative z-10 border border-blue-500/20">
          <LayoutTemplate size={32} />
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold text-white mb-3 text-center relative z-10">Создание публикации</h1>
        <p className="text-gray-400 mb-8 sm:mb-10 text-center max-w-md relative z-10 text-sm sm:text-base">
          Выберите, хотите ли вы отправить пост прямо сейчас или запланировать его в контент-плане.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl relative z-10">
          <button onClick={() => { setPublishMode('now'); setView('wizard'); setStep(1); }} className="bg-admin-card border border-gray-800 hover:border-blue-500 rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 flex flex-col items-center text-center transition-all group active:scale-95 shadow-xl hover:shadow-blue-500/10">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-110 transition-transform border border-blue-500/20">
              <Send size={28} className="ml-1 sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Запостить сейчас</h3>
            <p className="text-xs sm:text-sm text-gray-400">Мгновенная публикация во все выбранные социальные сети</p>
          </button>

          <button onClick={() => { fetchScheduledPosts(); setView('calendar'); }} className="bg-admin-card border border-gray-800 hover:border-purple-500 rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 flex flex-col items-center text-center transition-all group active:scale-95 shadow-xl hover:shadow-purple-500/10">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-500/10 text-purple-500 rounded-full flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-110 transition-transform border border-purple-500/20">
              <CalendarClock size={28} className="sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Отложенный пост</h3>
            <p className="text-xs sm:text-sm text-gray-400">Откройте календарь, выберите дату и запланируйте публикацию</p>
          </button>
        </div>
      </div>
    );
  }

  if (view === 'calendar') {
    const selectedDateObj = new Date(selectedCalendarDate);
    const postsForSelectedDate = realScheduledPosts.filter(p => p.date === selectedCalendarDate);

    return (
      // Добавлен key="calendar-view"
      <div key="calendar-view" className="min-h-[100dvh] bg-admin-bg px-4 py-6 sm:p-8 pb-32 md:pb-8 animate-fade-in">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => setView('start')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 sm:mb-6 transition-colors min-h-[44px] px-2 -ml-2 rounded-xl active:bg-gray-800 w-max">
            <ChevronLeft size={24} />
            <span className="font-medium text-sm sm:text-base">Назад к выбору</span>
          </button>
          
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">Контент-план</h2>
          
          <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 mb-2 sm:mb-4">
            {calendarDays.map((d) => {
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              const isoDate = `${year}-${month}-${day}`;
              
              const isSelected = isoDate === selectedCalendarDate;
              const dayName = d.toLocaleDateString('ru-RU', { weekday: 'short' });
              const dayNum = d.getDate();
              
              const hasPosts = realScheduledPosts.some(p => p.date === isoDate);
              
              return (
                <button 
                  key={isoDate} onClick={() => setSelectedCalendarDate(isoDate)}
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
              {selectedDateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </h3>
            
            <div className="space-y-3">
              {postsForSelectedDate.length > 0 ? (
                postsForSelectedDate.map(post => (
                  <div key={post.id} className={`bg-admin-card border border-gray-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-gray-900/80 group ${post.status === 'PUBLISHED' ? 'opacity-80 grayscale-[30%] bg-gray-900/50' : ''}`}>
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl shrink-0 bg-gray-800 flex items-center justify-center text-white border border-gray-700/50">
                        {post.accountAvatar ? (
                          <img src={post.accountAvatar} alt={post.accountName} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <span className="text-xs font-bold text-gray-400">{post.accountName.substring(0, 2).toUpperCase()}</span>
                        )}
                        <div className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-[#111318] flex items-center justify-center ${post.color}`}>
                          <div className="w-2.5 h-2.5 flex items-center justify-center text-white">
                            {post.network === 'VK' ? <IconVK /> : <IconTG />}
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium text-sm line-clamp-2 leading-snug break-words ${post.status === 'PUBLISHED' ? 'text-gray-300' : 'text-white'}`}>
                          {post.text}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-gray-400 text-[11px] bg-gray-800 px-2 py-0.5 rounded-md truncate max-w-[120px]">{post.accountName}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                          <span className="text-purple-400 text-xs font-bold flex items-center gap-1">
                            <Clock size={12} /> {post.time}
                          </span>
                          {post.status === 'PUBLISHED' && (
                            <span className="text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <CheckCircle2 size={10} /> Отправлен
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 shrink-0 pt-3 border-t border-gray-800 sm:pt-0 sm:border-t-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {post.status === 'SCHEDULED' && (
                        <button onClick={() => openEditModal(post)} className="w-11 h-11 sm:w-10 sm:h-10 rounded-xl bg-gray-900 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 flex items-center justify-center transition-colors border border-gray-800 hover:border-blue-500/30">
                          <PenTool size={18} />
                        </button>
                      )}
                      <button onClick={() => deleteScheduledPostAction(post.id)} className="w-11 h-11 sm:w-10 sm:h-10 rounded-xl bg-gray-900 hover:bg-red-500/20 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors border border-gray-800 hover:border-red-500/30">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-admin-card border border-gray-800 border-dashed rounded-3xl p-8 text-center">
                  <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4"><CalendarClock size={28} className="text-gray-600" /></div>
                  <p className="text-gray-300 font-medium">Свободный день</p>
                  <p className="text-gray-500 text-sm mt-1">На эту дату пока нет запланированных публикаций.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="fixed bottom-[72px] md:bottom-0 left-0 md:left-64 right-0 bg-admin-card/95 backdrop-blur-xl border-t border-gray-800 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4 z-30 transition-all shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="max-w-3xl mx-auto">
            <button onClick={() => { setPublishMode('schedule'); setView('wizard'); setStep(1); }} className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 active:scale-95 flex justify-center items-center gap-2">
              <Plus size={20} /> Запостить ещё на эту дату
            </button>
          </div>
        </div>

        {/* === ИСПРАВЛЕНИЕ: ВЕРСТКА ДАТЫ И ВРЕМЕНИ В РЕДАКТИРОВАНИИ === */}
        {editPost && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-0 sm:p-4">
            <div className="bg-admin-card w-full max-w-lg border-t sm:border border-gray-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[90vh] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6">
              <button onClick={() => setEditPost(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white bg-gray-900 w-10 h-10 rounded-full flex items-center justify-center transition-colors z-10"><X size={20} /></button>
              <h3 className="text-xl font-bold text-white mb-4 pr-12">Редактирование</h3>
              
              <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-4 border-b border-gray-800 pb-2">
                <button onClick={() => setEditTab('text')} className={`px-4 py-2 min-h-[44px] text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${editTab === 'text' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}>Текст</button>
                <button onClick={() => setEditTab('settings')} className={`px-4 py-2 min-h-[44px] text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${editTab === 'settings' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}>Время</button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 sm:pr-2 mb-4">
                {editTab === 'text' && (
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full min-h-[200px] bg-gray-900 border border-gray-800 rounded-xl p-4 text-white text-base resize-none outline-none focus:border-purple-500 transition-colors" />
                )}
                {editTab === 'settings' && (
                  <div className="space-y-4">
                    {/* ДОБАВЛЕНО min-w-0 для предотвращения разрыва сетки */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="flex flex-col min-w-0">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1">Дата</label>
                        <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full min-w-0 appearance-none bg-gray-900 border border-gray-700 rounded-xl px-3 sm:px-4 py-3 text-base sm:text-sm text-white outline-none focus:border-purple-500 transition-colors h-[48px]" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1">Время</label>
                        <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-full min-w-0 appearance-none bg-gray-900 border border-gray-700 rounded-xl px-3 sm:px-4 py-3 text-base sm:text-sm text-white outline-none focus:border-purple-500 transition-colors h-[48px]" />
                      </div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl mt-2">
                      <p className="text-xs sm:text-sm text-blue-400 font-medium flex items-start gap-2 leading-snug"><Settings size={18} className="shrink-0 mt-0.5" /> Для изменения знака, подписи или фото, отмените эту публикацию и создайте новую.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 sm:pt-4 border-t border-gray-800 flex flex-col sm:flex-row gap-3">
                 <button onClick={() => setEditPost(null)} className="flex-1 py-3.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-colors order-2 sm:order-1 min-h-[48px]">Отмена</button>
                 <button onClick={handleUpdatePost} disabled={isUpdatingPost} className="flex-[2] py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-colors flex justify-center items-center gap-2 order-1 sm:order-2 shadow-lg shadow-purple-500/20 min-h-[48px]">
                   {isUpdatingPost ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />} {isUpdatingPost ? 'Сохранение...' : 'Сохранить'}
                 </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    // Добавлен key="wizard-view"
    <div key="wizard-view" className="min-h-[100dvh] bg-admin-bg pb-[120px] md:pb-24 font-sans relative animate-fade-in">
      <div className="p-4 sm:p-8 max-w-3xl mx-auto">
        
        {step < 4 && (
          <div className="mb-6">
            <div className="flex justify-between text-[10px] sm:text-xs font-bold text-gray-500 mb-2 px-1">
              <span className={step >= 1 ? (publishMode === 'schedule' ? 'text-purple-500' : 'text-blue-500') : ''}>1. Фото</span>
              <span className={step >= 2 ? (publishMode === 'schedule' ? 'text-purple-500' : 'text-blue-500') : ''}>2. Текст</span>
              <span className={step >= 3 ? (publishMode === 'schedule' ? 'text-purple-500' : 'text-blue-500') : ''}>3. Настройки</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden flex">
              <div className={`h-full transition-all duration-500 ${publishMode === 'schedule' ? 'bg-purple-500' : 'bg-blue-500'} ${step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full'}`}></div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="bg-admin-card border border-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl animate-fade-in">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-1">Загрузите фотографии</h2>
            <p className="text-xs sm:text-sm text-gray-400 mb-5">От 1 до {MAX_PHOTOS} снимков.</p>

            {photos.length === 0 ? (
              <button onClick={() => fileInputRef.current?.click()} className={`w-full border-2 border-dashed border-gray-700 bg-gray-900/50 rounded-3xl p-8 sm:p-10 flex flex-col items-center justify-center gap-4 transition-all group ${publishMode === 'schedule' ? 'hover:border-purple-500 hover:bg-purple-500/5' : 'hover:border-blue-500 hover:bg-blue-500/5'}`}>
                <div className={`w-14 h-14 sm:w-16 sm:h-16 bg-gray-800 rounded-2xl flex items-center justify-center text-gray-400 transition-all ${publishMode === 'schedule' ? 'group-hover:bg-purple-500/20 group-hover:text-purple-500' : 'group-hover:bg-blue-500/20 group-hover:text-blue-500'}`}>
                  <ImagePlus size={28} className="sm:w-8 sm:h-8" />
                </div>
                <div className="text-center">
                  <p className="text-white font-medium text-sm sm:text-base">Нажмите для выбора фото</p>
                  <p className="text-gray-500 text-xs sm:text-sm mt-1">До 10 файлов (JPEG, PNG)</p>
                </div>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative aspect-square rounded-2xl overflow-hidden group border border-gray-800">
                      <img src={photo.url || photo.preview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block"></div>
                      <button onClick={() => removePhoto(photo.id)} className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-red-500/90 text-white w-8 h-8 sm:w-auto sm:h-auto sm:p-1.5 rounded-xl flex items-center justify-center hover:bg-red-500 active:scale-90 transition-all z-10">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button onClick={() => fileInputRef.current?.click()} className={`aspect-square rounded-2xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-500 transition-colors active:scale-95 ${publishMode === 'schedule' ? 'hover:border-purple-500 hover:text-purple-500' : 'hover:border-blue-500 hover:text-blue-500'}`}>
                      <ImagePlus size={24} className="mb-1" />
                      <span className="text-[10px] sm:text-xs font-bold">Ещё</span>
                    </button>
                  )}
                </div>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept="image/*" />
          </div>
        )}

        {step === 2 && (
          <div className="bg-admin-card border border-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl animate-fade-in relative">
            <div className="flex justify-between items-end mb-4">
              <div className="pr-4">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-1">Описание поста</h2>
                <p className="text-xs sm:text-sm text-gray-400">Напишите текст или поручите это ИИ</p>
              </div>
              <div className={`text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1.5 rounded-lg transition-colors border shrink-0 ${(text || '').length >= MAX_CHARS ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-gray-900 text-gray-500 border-gray-800'}`}>
                {(text || '').length} / {MAX_CHARS}
              </div>
            </div>

            <div className={`relative border border-gray-800 rounded-2xl overflow-hidden bg-gray-900 transition-all ${publishMode === 'schedule' ? 'focus-within:border-purple-500' : 'focus-within:border-blue-500'}`}>
              
              {isImprovingAI && (
                <div className="absolute inset-0 z-20 bg-gray-900/80 backdrop-blur-[2px] flex flex-col items-center justify-center animate-fade-in rounded-2xl">
                  <div className="relative mb-4 flex items-center justify-center">
                    <Loader2 className="text-purple-500 animate-spin absolute" size={40} />
                    <Sparkles className="text-purple-400 animate-pulse" size={18} />
                  </div>
                  <h3 className="text-white font-bold mb-1 text-sm sm:text-lg">Нейросеть пишет текст...</h3>
                  <div className="w-3/4 max-w-[200px] h-2 bg-gray-800 rounded-full overflow-hidden shadow-inner relative mt-3 sm:mt-4">
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300" style={{ width: `${aiProgress}%` }}></div>
                  </div>
                </div>
              )}

              <textarea
                value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Расскажите о товаре, укажите цены, размеры и особенности..."
                className="w-full min-h-[180px] sm:min-h-[200px] bg-transparent p-4 text-base text-white resize-none outline-none placeholder:text-gray-600"
              />
              
              <div className="bg-gray-800/50 p-3 border-t border-gray-800 flex flex-wrap gap-2 justify-between items-center">
                <span className="text-xs text-gray-500 hidden sm:block">Поддерживаются эмодзи 🚀</span>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button 
                    onClick={handleAiAction} 
                    disabled={isImprovingAI || !(text || '').trim()} 
                    className="w-full sm:w-auto flex justify-center items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-3 sm:py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all shadow-lg shadow-purple-500/20 min-h-[44px]"
                  >
                    <Sparkles size={16} /> Улучшить текст
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            
            {/* === НОВЫЙ БЛОК ВРЕМЕНИ СВЕРХУ (только если выбран отложенный постинг) === */}
            {publishMode === 'schedule' && (
              <div className="bg-admin-card border border-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                    <Clock size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white mb-1">Время публикации</h2>
                    <p className="text-xs sm:text-sm text-gray-400">
                      Укажите точное время
                      {publishDraft?.publishDate && <span className="text-purple-400 ml-1">(на {publishDraft.publishDate})</span>}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input 
                    type="time" 
                    value={scheduleTime} 
                    onChange={(e) => setScheduleTime(e.target.value)} 
                    className="flex-1 sm:w-auto min-w-[120px] appearance-none bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-lg font-medium text-white outline-none focus:border-purple-500 transition-colors h-[50px] cursor-pointer" 
                  />
                  {scheduleTime && (
                    <button 
                      onClick={() => setScheduleTime('')} 
                      className="w-[50px] h-[50px] flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 shrink-0"
                      title="Очистить время"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* === БЛОК ВЫБОРА АККАУНТОВ === */}
            <div className="bg-admin-card border border-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-1">Куда опубликовать?</h2>
                  <p className="text-xs sm:text-sm text-gray-400">Выберите аккаунты (выбрано {selectedAccounts.length})</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-48">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Search size={16} /></span>
                    <input type="text" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full bg-gray-900 border border-gray-800 rounded-xl py-2 sm:py-2 pl-9 pr-3 text-base sm:text-sm text-white outline-none min-h-[44px] sm:min-h-0 ${publishMode === 'schedule' ? 'focus:border-purple-500' : 'focus:border-blue-500'}`} />
                  </div>
                  <button onClick={toggleAllAccounts} className={`text-[10px] sm:text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap min-h-[44px] sm:min-h-0 shrink-0 ${publishMode === 'schedule' ? 'text-purple-500 bg-purple-500/10' : 'text-blue-500 bg-blue-500/10'}`}>
                    {selectedAccounts.length === accounts.length && accounts.length > 0 ? 'Снять все' : 'Выбрать все'}
                  </button>
                </div>
              </div>

              <div className="pr-1 sm:pr-2 space-y-4">
                {Object.keys(groupedAccounts).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm mb-2">Аккаунты не найдены</p>
                  </div>
                ) : (
                  Object.entries(groupedAccounts).map(([provider, providerAccounts]) => (
                    <div key={provider} className="mb-4 last:mb-0">
                      <h3 className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pl-1 flex items-center gap-2">
                        {provider === 'VK' ? 'ВКонтакте' : provider === 'TELEGRAM' ? 'Telegram' : provider}
                        <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] ml-2">{providerAccounts.length}</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        {providerAccounts.map(acc => {
                          const isSelected = selectedAccounts.includes(acc.id);
                          const avatarSrc = acc.avatarUrl || acc.photo_url || acc.avatar;
                          const iconColor = provider === 'vk' ? 'text-blue-500' : 'text-sky-400';
                          
                          return (
                            <div 
                              key={acc.id} 
                              onClick={() => toggleAccount(acc.id)} 
                              className={`flex flex-col rounded-xl border transition-all overflow-hidden cursor-pointer active:scale-95 ${isSelected ? (publishMode === 'schedule' ? 'bg-purple-500/10 border-purple-500/50 shadow-sm' : 'bg-blue-500/10 border-blue-500/50 shadow-sm') : 'bg-gray-900/50 border-gray-800 hover:border-gray-700 hover:bg-gray-800/50'}`}
                            >
                              <div className="flex items-center gap-2.5 p-2.5 w-full text-left min-h-[48px]">
                                <div className="relative w-8 h-8 rounded-lg shrink-0 bg-gray-800 flex items-center justify-center font-bold text-gray-400 border border-gray-700">
                                  {avatarSrc ? <img src={avatarSrc} alt={acc.name} className="w-full h-full object-cover rounded-lg" /> : <span className="text-[10px] sm:text-xs">{acc.name.substring(0, 2).toUpperCase()}</span>}
                                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 bg-gray-900 rounded-full border-2 border-gray-800 flex items-center justify-center ${iconColor}`}>
                                    <div className="w-2.5 h-2.5 flex items-center justify-center">
                                      {provider.toLowerCase() === 'vk' ? <IconVK /> : <IconTG />}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0 pr-1">
                                  <p className={`text-[11px] sm:text-xs font-bold truncate transition-colors ${isSelected ? 'text-white' : 'text-gray-400'}`}>{acc.name}</p>
                                </div>
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? (publishMode === 'schedule' ? 'border-purple-500 bg-purple-500' : 'border-blue-500 bg-blue-500') : 'border-gray-600'}`}>
                                  <CheckCircle2 size={10} className={`text-white ${isSelected ? 'block' : 'hidden'}`} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="bg-admin-card border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-green-500/10 to-transparent pointer-events-none"></div>
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6"><CheckCircle2 size={40} className="sm:w-12 sm:h-12" /></div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{publishMode === 'schedule' ? 'Пост запланирован!' : 'Успешно опубликовано!'}</h2>
            <p className="text-sm sm:text-base text-gray-400 mb-8 max-w-sm mx-auto">Ваш контент отправлен в {selectedAccounts.length} аккаунт(а/ов).</p>
            <div className="space-y-3">
              <button onClick={resetForm} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-4 rounded-xl font-bold border border-gray-700 transition-colors">
                <LayoutTemplate size={20} /> <span>В главное меню</span>
              </button>
              <button 
                onClick={() => setShowPartnerModal(true)} 
                className="w-full sm:w-auto px-8 py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20 active:scale-95"
              >
                <Share2 size={18} /> Поделиться с партнерами
              </button>
            </div>
          </div>
        )}

      </div>

      

      {step < 4 && (
        <div className="fixed bottom-[72px] md:bottom-0 left-0 md:left-64 right-0 bg-admin-card/95 backdrop-blur-xl border-t border-gray-800 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4 z-30 transition-all shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <button onClick={() => { if (step === 1) setView(publishMode === 'schedule' ? 'calendar' : 'start'); else setStep(step - 1); }} className="w-14 h-14 shrink-0 flex items-center justify-center bg-gray-800 text-white rounded-2xl hover:bg-gray-700 transition-colors">
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={() => {
                if (step === 1 && photos.length === 0) return setTimeout(() => alert('Добавьте хотя бы 1 фото!'), 10);
                if (step === 2 && !text.trim() && !isImprovingAI) return setTimeout(() => alert('Напишите текст поста!'), 10);
                if (step === 3) return handlePublish();
                setStep(step + 1);
              }}
              disabled={isPublishing}
              className={`flex-1 flex items-center justify-center gap-2 h-14 rounded-2xl font-bold text-base transition-all active:scale-95
                ${step === 3 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white text-black'}`}
            >
              <span className={`pointer-events-none items-center gap-2 ${isPublishing ? 'flex' : 'hidden'}`}><Loader2 size={20} className="animate-spin" /> Обработка...</span>
              <span className={`pointer-events-none items-center gap-2 ${(!isPublishing && step === 3) ? 'flex' : 'hidden'}`}><Send size={18}/> Опубликовать</span>
              <span className={`pointer-events-none items-center gap-2 ${(!isPublishing && step < 3) ? 'flex' : 'hidden'}`}>Далее <ChevronRight size={20}/></span>
            </button>
          </div>
        </div>
      )}



      {/* === МОДАЛЬНОЕ ОКНО ВЫБОРА ПАРТНЕРОВ === */}
      {showPartnerModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowPartnerModal(false)}></div>
          <div className="relative w-full max-w-md bg-[#111318] border border-gray-800 rounded-2xl shadow-2xl flex flex-col z-10 overflow-hidden">
            
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800 bg-gray-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-purple-500" /> Выберите партнеров
              </h3>
              <button onClick={() => setShowPartnerModal(false)} className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {myPartners.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">У вас пока нет добавленных партнеров.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myPartners.map(partner => (
                    <div 
                      key={partner.id} 
                      onClick={() => togglePartner(partner.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${selectedPartners.includes(partner.id) ? 'bg-purple-500/10 border-purple-500/30' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${selectedPartners.includes(partner.id) ? 'bg-purple-500 border-purple-500' : 'border-gray-600'}`}>
                        {selectedPartners.includes(partner.id) && <Check size={14} className="text-white" />}
                      </div>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gray-800 shrink-0 overflow-hidden border border-gray-700 flex justify-center items-center text-xs font-bold text-gray-400">
                          {partner.avatarUrl ? <img src={partner.avatarUrl} className="w-full h-full object-cover"/> : partner.name?.substring(0,2).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-bold text-white truncate">{partner.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{partner.pavilion}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex gap-3">
              <button onClick={() => setShowPartnerModal(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition-all text-sm">
                Отмена
              </button>
              <button 
                onClick={handleShareToPartners} 
                disabled={isSharing || selectedPartners.length === 0} 
                className="flex-[2] bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 text-sm active:scale-95 shadow-lg shadow-purple-500/20"
              >
                {isSharing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {isSharing ? 'Отправка...' : `Отправить (${selectedPartners.length})`}
              </button>
            </div>

          </div>
        </div>
      )}

      
      {/* === КАСТОМНОЕ УВЕДОМЛЕНИЕ (TOAST) === */}
      {toastMessage && (
        <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500/95 backdrop-blur-md text-white px-4 py-3 sm:px-6 sm:py-3.5 rounded-2xl shadow-[0_10px_40px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 sm:gap-3 animate-in slide-in-from-top-4 fade-in duration-300 font-bold border border-emerald-400/50 w-[90vw] max-w-sm sm:max-w-md text-sm sm:text-base text-center leading-snug">
          <CheckCircle2 size={20} className="shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}