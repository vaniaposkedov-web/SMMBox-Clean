import { useEffect } from 'react';

export default function CustomTelegramButton({ botId, onAuth }) {
  useEffect(() => {
    const handleTelegramMessage = (event) => {
      if (event.origin !== 'https://oauth.telegram.org') return;

      try {
        const data = JSON.parse(event.data);
        if (data && data.event === 'auth_result') {
          if (window.TelegramAuthWindow) {
            window.TelegramAuthWindow.close();
          }
          onAuth(data.result);
        }
      } catch (e) {
        // Игнорируем технические сообщения
      }
    };

    window.addEventListener('message', handleTelegramMessage);
    return () => window.removeEventListener('message', handleTelegramMessage);
  }, [onAuth]);

  const handleLogin = () => {
    const width = 550;
    const height = 470;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    const authUrl = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(window.location.origin)}&request_access=write`;

    window.TelegramAuthWindow = window.open(
      authUrl,
      'TelegramAuth',
      `width=${width},height=${height},left=${left},top=${top},status=0,location=0,menubar=0,toolbar=0`
    );
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      title="Войти через Telegram"
      // Добавлены жесткие размеры и запрет на сжатие (shrink-0, min-w, min-h)
      className="w-14 h-14 min-w-[56px] min-h-[56px] shrink-0 flex items-center justify-center rounded-full bg-[#229ED9]/10 text-[#229ED9] hover:bg-[#229ED9] hover:text-white border border-[#229ED9]/20 transition-all duration-300 shadow-lg hover:scale-105"
    >
      {/* Иконка тоже защищена от сжатия */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-7 h-7 shrink-0" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.35-.01-.99-.19-1.48-.35-.6-.2-1.08-.31-1.02-.66.03-.18.29-.37.78-.58 3.05-1.33 5.09-2.21 6.12-2.64 2.91-1.21 3.51-1.42 3.9-1.43.09 0 .28.02.39.1.1.06.13.15.14.24-.01.04-.01.12-.03.22z"/>
      </svg>
    </button>
  );
}