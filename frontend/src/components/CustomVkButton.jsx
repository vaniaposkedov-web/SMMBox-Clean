import { useEffect } from 'react';
import * as VKID from '@vkid/sdk';

export default function CustomVkButton({ onAuth }) {
  useEffect(() => {
    VKID.Config.init({
      app: import.meta.env.VITE_VK_APP_ID || 54471878,
      redirectUrl: import.meta.env.VITE_VK_REDIRECT_URI || 'https://smmdeck.ru/api/accounts/vk/callback',
      responseMode: VKID.ConfigResponseMode.Callback,
    });
  }, []);

  const handleVkLogin = () => {
    VKID.Auth.login()
      .then(async (data) => {
        // Достаем данные безопасно
        const payload = data.payload || data;
        
        // ВАРИАНТ 1: ВК вернул временный код (новый безопасный протокол)
        if (payload.code && payload.device_id) {
          try {
            // Запрашиваем настоящий токен в обмен на код
            const authTokens = await VKID.Auth.exchangeCode(payload.code, payload.device_id);
            
            // Собираем user_id из токена или запрашиваем его дополнительно, если ВК его спрятал
            let userId = authTokens.user_id || authTokens.id || payload.user_id || payload.uuid;
            if (!userId) {
              const userInfo = await VKID.Auth.userInfo(authTokens.access_token);
              userId = userInfo.user?.id || userInfo.id;
            }

            const vkData = {
              access_token: authTokens.access_token,
              user_id: userId,
              email: authTokens.email || payload.email || null,
            };

            if (onAuth) onAuth(vkData);

          } catch (exchangeError) {
            console.error('Ошибка при обмене кода ВК:', exchangeError);
          }
        } 
        // ВАРИАНТ 2: ВК сразу вернул готовый токен (старый протокол)
        else if (payload.token || payload.access_token) {
          const vkData = {
            access_token: payload.token || payload.access_token,
            user_id: payload.uuid || payload.user_id,
            email: payload.email || null,
          };
          
          if (onAuth) onAuth(vkData);
        } 
        // Если что-то пошло совсем не так
        else {
          console.error('Токен или код не найден в ответе ВК. Проверьте консоль.', data);
        }
      })
      .catch((error) => {
        console.error('Ошибка окна авторизации ВК:', error);
      });
  };

  return (
    <button
      type="button"
      onClick={handleVkLogin}
      title="Войти через ВКонтакте"
      className="w-14 h-14 min-w-[56px] min-h-[56px] shrink-0 flex items-center justify-center rounded-full bg-[#0077FF]/10 text-[#0077FF] hover:bg-[#0077FF] hover:text-white border border-[#0077FF]/20 transition-all duration-300 shadow-lg hover:scale-105"
    >
      <svg viewBox="0 0 24 24" className="w-7 h-7 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M12.443 18.067C5.035 18.067 1.017 12.986 0.854 4H4.722C4.83 10.519 7.498 13.264 9.593 13.813V4H13.295V9.584C15.361 9.359 17.545 6.892 18.267 4H21.97C21.402 7.481 18.794 9.948 16.883 10.933C18.794 11.73 21.728 13.9 22.639 18.067H18.567C17.846 15.269 15.744 13.167 13.295 12.894V18.067H12.443Z" fill="currentColor"/>
      </svg>
    </button>
  );
}