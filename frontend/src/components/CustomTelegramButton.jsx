import { useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

export default function CustomTelegramButton({ onAuthCallback }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Глобальная функция-колбэк для Telegram
    window.onTelegramAuth = (user) => {
      if (onAuthCallback) onAuthCallback(user);
    };

    // Создаем скрипт
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', import.meta.env.VITE_TG_BOT_NAME || 'smmbox_auth_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.async = true;

    container.appendChild(script);

    // Строгая очистка при ререндере или размонтировании (спасает от StrictMode React'а)
    return () => {
      container.innerHTML = '';
      delete window.onTelegramAuth;
    };
  }, [onAuthCallback]);

  const handleFallbackClick = () => {
    alert('Клик заблокирован! Telegram-виджет не загрузился. Убедитесь, что выключен AdBlock или защита от слежения в браузере (например, "Щит" в Brave).');
  };

  return (
    <div 
      onClick={handleFallbackClick}
      className="relative w-14 h-14 min-w-[56px] min-h-[56px] shrink-0 rounded-full overflow-hidden group shadow-lg transition-all duration-300 bg-[#0088CC]/10 border border-[#0088CC]/20 hover:scale-105 cursor-pointer"
      title="Войти через Telegram"
    >
      <div className="absolute inset-0 flex items-center justify-center text-[#0088CC] group-hover:bg-[#0088CC] group-hover:text-white transition-colors duration-300 z-10 pointer-events-none">
        <Send className="w-6 h-6 shrink-0 -ml-0.5" />
      </div>

      <div 
        ref={containerRef}
        className="absolute inset-0 z-20 opacity-[0.01] overflow-hidden flex items-center justify-center scale-[2.5]"
      />
    </div>
  );
}