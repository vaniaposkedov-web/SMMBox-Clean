import { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';

export default function CustomTelegramButton({ onAuthCallback }) {
  const widgetRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (widgetRef.current) {
      widgetRef.current.innerHTML = '';
    }

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;

    if (widgetRef.current) {
      widgetRef.current.appendChild(script);
    }

    return () => {
      if (window.onTelegramAuth) {
        delete window.onTelegramAuth;
      }
    };
  }, []);

  const handleCustomClick = async () => {
    setIsLoading(true);
    
    const botName = import.meta.env.VITE_TG_BOT_NAME || 'smmbox_auth_bot';

    if (!window.Telegram || !window.Telegram.Login || !window.Telegram.Login.open) {
      alert('Ошибка загрузки виджета Telegram. Пожалуйста, обновите страницу.');
      setIsLoading(false);
      return;
    }

    try {
      const user = await new Promise((resolve, reject) => {
        window.Telegram.Login.open(
          botName,
          { request_access: 'write' },
          (user) => {
            if (user) resolve(user);
            else reject(new Error('Авторизация отменена пользователем.'));
          }
        );
      });

      if (onAuthCallback) {
        onAuthCallback(user);
      }
    } catch (err) {
      console.error('Ошибка авторизации через Telegram:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleCustomClick}
        disabled={isLoading}
        title="Войти через Telegram"
        // Классы 1 в 1 как у кнопки ВКонтакте, только цвет #0088CC
        className="w-14 h-14 min-w-[56px] min-h-[56px] shrink-0 flex items-center justify-center rounded-full bg-[#0088CC]/10 text-[#0088CC] hover:bg-[#0088CC] hover:text-white border border-[#0088CC]/20 transition-all duration-300 shadow-lg hover:scale-105 disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="animate-spin w-7 h-7 shrink-0" />
        ) : (
          <Send className="w-6 h-6 shrink-0 -ml-0.5" />
        )}
      </button>

      {/* Скрытый контейнер для скрипта, чтобы он не ломал верстку */}
      <div ref={widgetRef} style={{ display: 'none' }} />
    </>
  );
}