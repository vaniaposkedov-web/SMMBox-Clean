import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
// Импортируйте иконки и ваши методы для привязки из AccountsManager

export default function Onboarding() {
  const user = useStore(state => state.user);
  const navigate = useNavigate();
  
  // Шаги: 'welcome', 'vk_setup', 'tg_setup', 'finish'
  const [step, setStep] = useState('welcome');

  useEffect(() => {
    if (!user) return;
    // Логика маршрутизации после приветствия
    if (user.isOnboardingCompleted) {
      navigate('/admin/dashboard');
    }
  }, [user, navigate]);

  const handleStart = () => {
    if (user.vkId) setStep('vk_setup');
    else if (user.telegramId) setStep('tg_setup');
    else setStep('choice'); // Если вошел по почте - даем выбор
  };

  const finishOnboarding = async () => {
    // Вызываем наш новый API
    await fetch('/api/auth/complete-onboarding', {
       method: 'POST',
       headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    // Обновляем стейт и уходим в дашборд
    window.location.href = '/admin/dashboard'; 
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-gray-800 rounded-3xl p-8 shadow-2xl">
        
        {/* PROGRESS BAR */}
        <div className="flex gap-2 mb-8">
          <div className={`h-2 flex-1 rounded-full ${step === 'welcome' ? 'bg-blue-500' : 'bg-green-500'}`} />
          <div className={`h-2 flex-1 rounded-full ${['vk_setup', 'tg_setup'].includes(step) ? 'bg-blue-500' : 'bg-gray-700'}`} />
          <div className={`h-2 flex-1 rounded-full ${step === 'finish' ? 'bg-blue-500' : 'bg-gray-700'}`} />
        </div>

        {/* ШАГ 1: ПРИВЕТСТВИЕ */}
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <h1 className="text-3xl font-bold text-white">Добро пожаловать в SMMBox! 👋</h1>
            <p className="text-gray-400">
              {user.vkId ? 'Мы видим, вы вошли через ВКонтакте.' : 
               user.telegramId ? 'Мы видим, вы вошли через Telegram.' : 
               'Давайте подготовим ваше рабочее пространство.'}
              <br/>Подключим ваши группы прямо сейчас, чтобы сразу начать работу?
            </p>
            <button onClick={handleStart} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold">
              Начать настройку
            </button>
            <button onClick={finishOnboarding} className="text-gray-500 block w-full mt-4">Пропустить</button>
          </div>
        )}

        {/* ШАГ 2: ВЫБОР (ДЛЯ ПОЧТЫ) */}
        {step === 'choice' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white text-center">С чего начнем?</h2>
            <div className="grid grid-cols-2 gap-4">
               <button onClick={() => setStep('vk_setup')} className="bg-blue-600 p-6 rounded-xl text-white">ВКонтакте</button>
               <button onClick={() => setStep('tg_setup')} className="bg-sky-500 p-6 rounded-xl text-white">Telegram</button>
            </div>
          </div>
        )}

        {/* ШАГ 3: ПОДКЛЮЧЕНИЕ VK (переносим UI из AccountsManager) */}
        {step === 'vk_setup' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Подключение ВКонтакте</h2>
            {/* ТУТ ВАШ КОД ИЗ AccountsManager (Кнопка получения ключа и инпут) */}
            <div className="mt-8 flex justify-between">
               <button onClick={finishOnboarding} className="text-gray-500">Пропустить</button>
               {/* Предлагаем ТГ, если его нет */}
               <button onClick={() => setStep(user.telegramId ? 'finish' : 'tg_setup')} className="bg-white text-black px-6 py-2 rounded-xl">
                 Далее
               </button>
            </div>
          </div>
        )}

        {/* ШАГ 4: ПОДКЛЮЧЕНИЕ TELEGRAM */}
        {step === 'tg_setup' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Подключение Telegram каналов</h2>
             {/* ТУТ ВАШ КОД ИЗ AccountsManager (Инструкция про добавление бота и инпут @username) */}
            <div className="mt-8 flex justify-between">
               <button onClick={finishOnboarding} className="text-gray-500">Пропустить</button>
               <button onClick={() => setStep(user.vkId ? 'finish' : 'vk_setup')} className="bg-white text-black px-6 py-2 rounded-xl">
                 Далее
               </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}