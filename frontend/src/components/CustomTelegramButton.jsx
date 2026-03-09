import { useEffect, useRef } from 'react';

export default function CustomTelegramButton({ onAuthCallback }) {
  const containerRef = useRef(null);

  useEffect(() => {
    // Очищаем контейнер от возможных дубликатов кнопки при ререндере React
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // === РЕШЕНИЕ ОШИБКИ: Задаем запасное имя бота ===
    // Если переменная окружения пуста, скрипт возьмет 'smmbox_auth_bot'
    const botName = import.meta.env.VITE_TG_BOT_NAME || 'smmbox_auth_bot';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12'); // Закругление краев под наш дизайн
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.async = true;

    // Глобальная функция обратного вызова, которую вызывает Telegram после входа
    window.onTelegramAuth = (user) => {
      if (onAuthCallback) onAuthCallback(user);
    };
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    // Очистка при размонтировании
    return () => {
      delete window.onTelegramAuth;
    };
  }, [onAuthCallback]);

  return (
    <div className="flex justify-center transition-transform hover:scale-105 active:scale-95">
      <div ref={containerRef} className="overflow-hidden rounded-xl shadow-lg"></div>
    </div>
  );
}