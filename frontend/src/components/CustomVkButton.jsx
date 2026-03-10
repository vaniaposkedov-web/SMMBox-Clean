import { useEffect } from 'react';
import * as VKID from '@vkid/sdk';

export default function CustomVkButton({ onAuth }) {
  useEffect(() => {
    // Инициализация
    VKID.Config.init({
      app: import.meta.env.VITE_VK_APP_ID || 54471878,
      redirectUrl: 'https://smmdeck.ru/auth',
      responseMode: VKID.ConfigResponseMode.Callback,
      mode: VKID.ConfigAuthMode.InNewWindow,
    });

    // Перехватчик на случай жесткого редиректа страницы
    const params = new URLSearchParams(window.location.search);
    const payloadStr = params.get('payload');
    const codeStr = params.get('code');

    if (payloadStr || codeStr) {
      let code = codeStr;
      let deviceId = params.get('device_id');

      if (payloadStr) {
        try {
          const payload = JSON.parse(payloadStr);
          code = payload.code || code;
          deviceId = payload.device_id || deviceId;
        } catch (e) {}
      }

      if (code && deviceId) {
        window.history.replaceState({}, document.title, window.location.pathname);
        processTokens(code, deviceId);
      }
    }
  }, [onAuth]);

  // Главная функция обработки и отправки на бэкенд
  // Главная функция обработки и отправки на бэкенд
  const processTokens = async (code, deviceId) => {
    try {
      const tokens = await VKID.Auth.exchangeCode(code, deviceId);
      
      let userId = tokens.user_id || tokens.id;

      // 1. Вскрываем id_token (JWT), куда ВК теперь прячет ID пользователя
      if (!userId && tokens.id_token) {
        try {
          // Декодируем base64 payload из JWT-токена
          const payloadBase64 = tokens.id_token.split('.')[1];
          const decodedJwt = JSON.parse(atob(payloadBase64));
          // По стандарту OpenID ID хранится в поле 'sub' или 'user_id'
          userId = decodedJwt.user_id || decodedJwt.sub || decodedJwt.vk_account_id;
        } catch (e) {
          console.error('Ошибка распаковки id_token:', e);
        }
      }
      
      // 2. Крайняя страховка: запрос к API
      if (!userId) {
        try {
          const userInfo = await VKID.Auth.userInfo(tokens.access_token);
          userId = userInfo?.user?.id || userInfo?.id || userInfo?.user_id || userInfo?.response?.[0]?.id;
        } catch (e) {}
      }

      // Если ID так и не найден, не бьем бэкенд запросами, а выводим ошибку
      if (!userId) {
        alert('Ошибка: ВКонтакте не вернул ID пользователя. Повторите попытку позже.');
        return;
      }

      // 3. Отправляем в стор идеальный объект, который ждет бэкенд
      if (onAuth) {
        onAuth({
          access_token: tokens.access_token,
          user_id: userId,
          email: tokens.email || null,
        });
      }
    } catch (error) {
      console.error('Ошибка авторизации ВК:', error);
    }
  };

  const handleVkLogin = () => {
    VKID.Auth.login()
      .then((res) => {
        const code = res.code || res.payload?.code;
        const deviceId = res.device_id || res.payload?.device_id;
        
        if (code && deviceId) {
          processTokens(code, deviceId);
        }
      })
      .catch((err) => console.error('Ошибка окна авторизации ВК:', err));
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