import { useEffect } from 'react';
import * as VKID from '@vkid/sdk';

export default function CustomVkButton({ onAuth }) {
  useEffect(() => {
    VKID.Config.init({
      app: import.meta.env.VITE_VK_APP_ID || 54490006,
      

      redirectUrl: window.location.origin + window.location.pathname, 
      
      responseMode: VKID.ConfigResponseMode.Callback,
      mode: VKID.ConfigAuthMode.InNewWindow,
    });

    // 1. ПЕРЕХВАТЧИК: Читаем ссылку
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
        // 2. ЕСЛИ МЫ ВО ВСПЛЫВАЮЩЕМ ОКНЕ (POPUP)
        if (window.opener) {
          window.opener.postMessage({ type: 'VK_POPUP_SUCCESS', code, deviceId }, '*');
          window.close(); // Убиваем popup
          return;
        } else {
          // Если обычный редирект
          window.history.replaceState({}, document.title, window.location.pathname);
          processTokens(code, deviceId);
        }
      }
    }

    // 3. СЛУШАТЕЛЬ В ГЛАВНОМ ОКНЕ: Ждем сообщение от popup
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'VK_POPUP_SUCCESS') {
        processTokens(event.data.code, event.data.deviceId);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onAuth]);

  const processTokens = async (code, deviceId) => {
    try {
      const tokens = await VKID.Auth.exchangeCode(code, deviceId);
      let userId = tokens.user_id || tokens.id;
      
      if (!userId && tokens.id_token) {
        try {
          const decodedJwt = JSON.parse(atob(tokens.id_token.split('.')[1]));
          userId = decodedJwt.user_id || decodedJwt.sub || decodedJwt.vk_account_id;
        } catch (e) {}
      }

      let firstName = '';
      let lastName = '';
      let avatar = '';

      try {
        const userInfoRes = await VKID.Auth.userInfo(tokens.access_token);
        const userObj = userInfoRes.user || userInfoRes;
        userId = userId || userObj.id || userObj.user_id;
        firstName = userObj.first_name || '';
        lastName = userObj.last_name || '';
        avatar = userObj.avatar || userObj.photo_100 || '';
      } catch (e) {
        console.error('Не удалось получить данные профиля ВК', e);
      }

      if (onAuth && userId) {
        onAuth({
          access_token: tokens.access_token,
          user_id: userId,
          id: userId,
          email: tokens.email || null,
          first_name: firstName,
          last_name: lastName,
          photo_100: avatar
        });
      }
    } catch (error) {
      console.error('Ошибка авторизации ВК:', error);
    }
  };

  const handleVkLogin = () => {
    VKID.Auth.login().then((res) => {
      const code = res.code || res.payload?.code;
      const deviceId = res.device_id || res.payload?.device_id;
      if (code && deviceId) processTokens(code, deviceId);
    }).catch((err) => console.error('Ошибка окна авторизации ВК:', err));
  };

  return (
    <div 
      onClick={handleVkLogin}
      className="relative w-14 h-14 min-w-[56px] min-h-[56px] shrink-0 rounded-full overflow-hidden group shadow-lg transition-all duration-300 bg-[#0077FF]/10 border border-[#0077FF]/20 hover:scale-105 cursor-pointer"
      title="Войти через ВКонтакте"
    >
      <div className="absolute inset-0 flex items-center justify-center text-[#0077FF] group-hover:bg-[#0077FF] group-hover:text-white transition-colors duration-300 z-10">
        <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 7.5L7.5 16.5L12 7.5L16.5 16.5L20 7.5" />
        </svg>
      </div>
    </div>
  );
}