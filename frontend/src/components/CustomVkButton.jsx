import { useEffect } from 'react';
import * as VKID from '@vkid/sdk';

export default function CustomVkButton({ onAuth }) {
  useEffect(() => {
    VKID.Config.init({
      app: import.meta.env.VITE_VK_APP_ID || 54471878,
      redirectUrl: 'https://smmdeck.ru/auth',
      responseMode: VKID.ConfigResponseMode.Callback,
      mode: VKID.ConfigAuthMode.InNewWindow,
    });

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

      // 1. ЗАБИРАЕМ АВАТАР И ИМЯ ПРЯМО НА ФРОНТЕНДЕ (Самый надежный способ)
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
      className="w-14 h-14 min-w-[56px] min-h-[56px] shrink-0 flex items-center justify-center rounded-full bg-[#0077FF]/10 text-[#0077FF] hover:bg-[#0077FF] hover:text-white border border-[#0077FF]/20 transition-all duration-300 shadow-lg hover:scale-105 group"
    >
      <svg className="w-7 h-7 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M23.45 5.948c.166-.546 0-.948-.795-.948H20.03c-.668 0-.976.347-1.143.73 0 0-1.335 3.196-3.226 5.272-.612.602-.89.793-1.224.793-.167 0-.418-.191-.418-.738V5.948c0-.656-.184-.948-.74-.948H9.151c-.417 0-.668.304-.668.593 0 .621.946.765 1.043 2.513v3.798c0 .833-.153.984-.487.984-.89 0-3.055-3.211-4.34-6.885-.259-.71-.537-1-1.205-1H1.865c-.75 0-.9.347-.9.73 0 .682.89 4.07 4.145 8.551 2.17 3.06 5.225 4.72 8.008 4.72 1.67 0 1.875-.368 1.875-1.004V15.34c0-.736.158-.884.687-.884.39 0 1.057.192 2.615 1.667 1.78 1.749 2.073 2.532 3.074 2.532h2.625c.75 0 1.126-.368.91-1.096-.238-.724-1.084-1.775-2.215-3.022-.612-.71-1.53-1.475-1.809-1.858-.389-.491-.278-.71 0-1.147 0 0 3.2-4.426 3.533-5.584Z" />
      </svg>
    </button>
  );
}