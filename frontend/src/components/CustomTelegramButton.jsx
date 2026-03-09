import { useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

export default function CustomTelegramButton({ onAuthCallback }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    const botName = import.meta.env.VITE_TG_BOT_NAME || 'smmbox_auth_bot';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.async = true;

    window.onTelegramAuth = (user) => {
      if (onAuthCallback) onAuthCallback(user);
    };
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    return () => {
      if (window.onTelegramAuth) {
        delete window.onTelegramAuth;
      }
    };
  }, [onAuthCallback]);

  const handleFallbackClick = () => {
    // ВАЖНО: Клик доходит до этой функции ТОЛЬКО если невидимый iframe Telegram
    // не поймал его. Значит, виджет заблокирован браузером.
    alert('Клик заблокирован! Ваш браузер (или AdBlock / защита от слежения) вырезал скрипт Telegram. Пожалуйста, отключите щит защиты в браузере или AdBlock для этого сайта и обновите страницу.');
  };

  return (
    <div 
      onClick={handleFallbackClick}
      className="relative w-14 h-14 min-w-[56px] min-h-[56px] shrink-0 rounded-full overflow-hidden group shadow-lg transition-all duration-300 bg-[#0088CC]/10 border border-[#0088CC]/20 hover:scale-105 cursor-pointer"
      title="Войти через Telegram"
    >
      {/* 1. ВИЗУАЛЬНАЯ ЧАСТЬ (Всегда внизу, клики проходят сквозь неё) */}
      <div className="absolute inset-0 flex items-center justify-center text-[#0088CC] group-hover:bg-[#0088CC] group-hover:text-white transition-colors duration-300 z-10 pointer-events-none">
        <Send className="w-6 h-6 shrink-0 -ml-0.5" />
      </div>

      {/* 2. ЖЕЛЕЗОБЕТОННЫЙ ХАК: opacity-[0.01] обходит защиту браузера */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[200px] h-[200px] opacity-[0.01] flex items-center justify-center">
        {/* scale-[4] делает iframe гигантским, промахнуться мимо него нереально */}
        <div ref={containerRef} className="transform scale-[4] origin-center cursor-pointer pointer-events-auto" />
      </div>
    </div>
  );
}