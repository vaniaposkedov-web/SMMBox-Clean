import { useEffect } from 'react';
import * as VKID from '@vkid/sdk';

export default function CustomVkButton({ onAuth }) {
  useEffect(() => {
    // 1. Инициализируем SDK строго по документации
    // PKCE (codeVerifier/codeChallenge) сгенерируется SDK автоматически!
    VKID.Config.init({
      app: 54471878, // ID вашего приложения
      redirectUrl: 'https://smmdeck.ru/auth', // Обязательно совпадает со ссылкой в настройках приложения ВК
      responseMode: VKID.ConfigResponseMode.Callback, // Работа в режиме callback (вернет payload)
      mode: VKID.ConfigAuthMode.InNewWindow, // Открывать в новом окне
    });

    // 2. БЛОК РЕДИРЕКТА: Если окно заблокировалось и ВК обновил текущую страницу
    const params = new URLSearchParams(window.location.search);
    const payloadStr = params.get('payload');
    
    if (payloadStr) {
      try {
        const payload = JSON.parse(payloadStr);
        if (payload.code && payload.device_id) {
          // Мгновенно очищаем адресную строку от мусора ВК
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Вызываем обмен (SDK сам достанет сгенерированный ранее codeVerifier из LocalStorage)
          VKID.Auth.exchangeCode(payload.code, payload.device_id)
            .then((tokens) => {
              if (onAuth) onAuth({
                access_token: tokens.access_token,
                user_id: tokens.user_id,
                email: tokens.email || null,
              });
            })
            .catch(err => console.error('VKID SDK: Ошибка обмена кода после редиректа:', err));
        }
      } catch (e) {
        console.error('VKID SDK: Ошибка чтения ответа от ВК', e);
      }
    }
  }, [onAuth]);

  const handleVkLogin = () => {
    // 3. Запуск авторизации через модуль Auth (под свой дизайн)
    VKID.Auth.login()
      .then((res) => {
        // Если InNewWindow сработал идеально (popup открылся и закрылся без редиректа страницы)
        const code = res.code || res.payload?.code;
        const deviceId = res.device_id || res.payload?.device_id;
        
        if (code && deviceId) {
          VKID.Auth.exchangeCode(code, deviceId)
            .then((tokens) => {
              if (onAuth) onAuth({
                access_token: tokens.access_token,
                user_id: tokens.user_id,
                email: tokens.email || null,
              });
            })
            .catch(err => console.error('VKID SDK: Ошибка обмена кода в popup:', err));
        }
      })
      .catch((err) => {
        console.error('VKID SDK: Ошибка окна авторизации:', err);
      });
  };

  return (
    <button
      type="button"
      onClick={handleVkLogin}
      title="Войти через ВКонтакте"
      className="w-14 h-14 min-w-[56px] min-h-[56px] shrink-0 flex items-center justify-center rounded-full bg-[#0077FF]/10 text-[#0077FF] hover:bg-[#0077FF] hover:text-white border border-[#0077FF]/20 transition-all duration-300 shadow-lg hover:scale-105"
    >
      <svg viewBox="0 0 24 24" className="w-7 h-7 shrink-0" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.077 7.103c.5-.062 1.157-.105 1.705.105.434.166.77.568.868 1.018.156.714.156 1.84.156 2.923 0 1.083 0 2.21-.156 2.923-.098.45-.434.852-.868 1.018-.548.21-1.205.167-1.705.105-2.071-.257-2.618-.94-3.044-1.616-.217-.343-.39-.708-.57-1.071-.143-.289-.282-.574-.465-.828-.275-.38-.63-.615-1.078-.615H9.68v2.96c0 .416-.307.755-.718.775H7.72c-.41 0-.74-.338-.74-.755V9.01c0-.417.33-.755.74-.755h1.242c.41 0 .717.339.717.755v2.914c0 .063.023.123.064.168.041.045.097.071.156.071h.122c.21 0 .39-.126.495-.315.118-.214.22-.44.316-.653.167-.37.336-.74.557-1.085.424-.666.963-1.325 3.018-1.57.17-.021.343-.032.518-.032h.15z"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm4.212-14.93c-2.316-.287-6.108-.287-8.424 0-1.125.139-2.062 1.053-2.228 2.167-.22 1.488-.22 4.038 0 5.526.166 1.114 1.103 2.028 2.228 2.167 2.316.287 6.108.287 8.424 0 1.125-.139 2.062-1.053 2.228-2.167.22-1.488.22-4.038 0-5.526-.166-1.114-1.103-2.028-2.228-2.167z"/>
      </svg>
    </button>
  );
}