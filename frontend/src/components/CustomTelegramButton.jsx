import { useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

export default function CustomTelegramButton({ onAuthCallback }) {
  const containerRef = useRef(null);

  useEffect(() => {
    // Очищаем контейнер при ререндере
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Имя бота (из файла .env или запасной вариант)
    const botName = import.meta.env.VITE_TG_BOT_NAME || 'smmbox_auth_bot';

    // ВОЗВРАЩАЕМ РАБОЧИЙ ОФИЦИАЛЬНЫЙ СКРИПТ
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large'); 
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.async = true;

    // Глобальная функция обратного вызова
    window.onTelegramAuth = (user) => {
      if (onAuthCallback) onAuthCallback(user);
    };
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    return () => {
      delete window.onTelegramAuth;
    };
  }, [onAuthCallback]);

  return (
    <div 
      className="relative w-14 h-14 min-w-[56px] min-h-[56px] shrink-0 rounded-full overflow-hidden group shadow-lg hover:scale-105 transition-all duration-300"
      title="Войти через Telegram"
    >
      {/* 1. ВИЗУАЛЬНЫЙ ДИЗАЙН (КРУГЛАЯ КНОПКА, ТОЧНАЯ КОПИЯ ВК) */}
      <div className="absolute inset-0 flex items-center justify-center bg-[#0088CC]/10 text-[#0088CC] group-hover:bg-[#0088CC] group-hover:text-white border border-[#0088CC]/20 transition-colors duration-300 pointer-events-none">
        <Send className="w-6 h-6 shrink-0 -ml-0.5" />
      </div>

      {/* 2. НЕВИДИМАЯ ОФИЦИАЛЬНАЯ КНОПКА ПОВЕРХ (ОНА ЛОВИТ КЛИК) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[60px] z-10 opacity-0 flex items-center justify-center cursor-pointer">
        <div ref={containerRef} className="cursor-pointer" />
      </div>
    </div>
  );
}