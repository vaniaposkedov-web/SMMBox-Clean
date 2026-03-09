import { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';

export default function CustomTelegramButton({ onAuthCallback }) {
  const widgetRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Чистим скрытый контейнер при перерендере, чтобы не плодить скрипты
    if (widgetRef.current) {
      widgetRef.current.innerHTML = '';
    }

    // Внедряем ТОЛЬКО скрипт без каких-либо атрибутов.
    // Нам нужен просто объект window.Telegram.
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;

    if (widgetRef.current) {
      widgetRef.current.appendChild(script);
    }

    // Убедимся, что глобальная функция очищена
    return () => {
      if (window.onTelegramAuth) {
        delete window.onTelegramAuth;
      }
    };
  }, []);

  const handleCustomClick = async () => {
    setIsLoading(true);
    setError('');

    // Берем имя бота (env или fallback)
    const botName = import.meta.env.VITE_TG_BOT_NAME || 'smmbox_auth_bot';

    // Проверяем, загрузился ли Telegram-скрипт и есть ли нужный метод
    if (!window.Telegram || !window.Telegram.Login || !window.Telegram.Login.open) {
      setError('Ошибка загрузки Telegram виджета. Пожалуйста, обновите страницу.');
      setIsLoading(false);
      return;
    }

    try {
      // Это программный метод вызова окна авторизации.
      // Официальный метод, который позволяет использовать свои кнопки. Он возвращает Promise.
      const user = await new Promise((resolve, reject) => {
        window.Telegram.Login.open(
          botName,
          {
            request_access: 'write',
          },
          // Это колбэк, который вызывается, когда окно авторизации Telegram сообщает о результате.
          (user) => {
            if (user) {
              resolve(user);
            } else {
              reject(new Error('Авторизация отменена пользователем.'));
            }
          }
        );
      });

      // Передаем данные пользователя в ваш колбэк
      if (onAuthCallback) {
        onAuthCallback(user);
      }
    } catch (err) {
      setError(err.message || 'Ошибка авторизации через Telegram');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center transition-all animate-fade-in group w-full">
      {/* КРУГЛАЯ КАСТОМНАЯ КНОПКА TELEGRAM */}
      <button 
        onClick={handleCustomClick}
        disabled={isLoading}
        type="button"
        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 relative group
          ${isLoading ? 'bg-gray-800' : 'bg-[#0088CC] hover:bg-[#0077b3]'}
          active:scale-95 disabled:opacity-70 shadow-lg shadow-[#0088CC]/30 hover:shadow-[#0088CC]/50 border border-[#0088CC]/20 hover:border-[#0088CC]/40`}>
        
        {isLoading ? (
          <Loader2 className="animate-spin text-white" size={24} />
        ) : (
          <Send className="text-white group-hover:scale-110 transition-transform" size={24} />
        )}
      </button>

      {/* Вывод ошибки, если есть */}
      {error && <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 text-center px-1 font-medium bg-red-500/10 py-1.5 rounded-lg border border-red-500/20">{error}</p>}
      
      {/* Скрытый контейнер, который просто держит скрипт на странице */}
      <div ref={widgetRef} style={{ display: 'none' }} />
    </div>
  );
}