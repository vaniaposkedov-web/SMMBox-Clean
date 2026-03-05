import { useEffect } from 'react';

export default function CustomTelegramButton({ botId, onAuth }) {
  useEffect(() => {
    const handleTelegramMessage = (event) => {
      // Проверяем, что сообщение пришло именно от официального сервера Telegram
      if (event.origin !== 'https://oauth.telegram.org') return;

      try {
        const data = JSON.parse(event.data);
        if (data && data.event === 'auth_result') {
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
    
    // Формируем ссылку на окно авторизации (работает только на HTTPS!)
    const authUrl = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(window.location.origin)}&embed=1&request_access=write`;

    window.open(
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
      className="w-14 h-14 flex items-center justify-center rounded-full bg-[#229ED9]/10 text-[#229ED9] hover:bg-[#229ED9] hover:text-white border border-[#229ED9]/20 transition-all duration-300 shadow-lg hover:scale-105 shrink-0"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.717-.962 4.384-1.362 5.693-.169.563-.372.75-.572.769-.439.041-.772-.287-1.197-.565-.664-.436-1.04-.707-1.684-1.132-.746-.491-.262-.761.163-1.202.111-.116 2.044-1.871 2.081-2.031.005-.02.01-.093-.032-.131-.042-.037-.105-.024-.15-.014-.064.014-1.09.691-3.078 2.029-.291.201-.555.3-.791.293-.261-.007-.763-.15-.1.137-.367-.145-.724-.316-1.028-.488-.309-.174-.247-.36-.051-.572.257-.277.513-.513.769-.769.103-.103.207-.207.311-.311.513-.513 1.026-1.026 1.539-1.539.103-.103.207-.207.311-.311.257-.277.513-.513.769-.769 1.026-1.026 2.052-2.052 3.078-3.078.257-.277.513-.513.769-.769.513-.513 1.026-1.026 1.539-1.539.103-.103.207-.207.311-.311zm-8.414 7.221c.201.201.3.439.293.71-.007.261-.15.763-.488 1.028-.174.309-.36.247-.572.051-.277-.257-.513-.513-.769-.769-.103-.103-.207-.207-.311-.311-.513-.513-1.026-1.026-1.539-1.539-.103-.103-.207-.207-.311-.311-.277-.257-.513-.513-.769-.769 1.026-1.026 2.052-2.052 3.078-3.078-.277-.257-.513-.513-.769-.769-.513-.513-1.026-1.026-1.539-1.539zm.311.311c.103.103.207.207.311.311.277.257.513.513.769.769 1.026 1.026 2.052 2.052 3.078 3.078.277.257.513.513.769.769.513.513 1.026 1.026 1.539 1.539"/>
      </svg>
    </button>
  );
}