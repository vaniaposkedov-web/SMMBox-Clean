import { useEffect, useRef } from 'react';

export default function CustomVkButton({ onAuth }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const scriptId = 'vkid-sdk-script';
    let isInitialized = false;

    // 1. Загружаем скрипт ВК
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/@vkid/sdk@3.0.0/dist-sdk/umd/index.js';
      script.async = true;
      script.onload = () => initVKID();
      document.body.appendChild(script);
    } else {
      // Небольшая задержка, если скрипт уже есть, чтобы React успел отрендерить div
      setTimeout(initVKID, 100);
    }

    // 2. Инициализация виджета
    function initVKID() {
      if (isInitialized) return;
      if (!('VKIDSDK' in window) || !containerRef.current) return;
      
      // Защита от дублирования кнопки в React Strict Mode
      if (containerRef.current.innerHTML !== '') return;
      
      isInitialized = true;
      const VKID = window.VKIDSDK;

      VKID.Config.init({
        app: 54471878,
        redirectUrl: 'https://smmdeck.ru/auth',
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: 'email', 
      });

      const oAuth = new VKID.OAuthList();

      oAuth.render({
        container: containerRef.current,
        oauthList: ['vkid'],
        styles: {
          height: 56,        // Жестко задаем высоту как у Telegram
          borderRadius: 28,  // Делаем круглым
        }
      })
      .on(VKID.WidgetEvents.ERROR, (error) => {
        console.error('Ошибка виджета VK:', error);
      })
      .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, function (payload) {
        // Ловим успешный вход и обмениваем код на данные
        VKID.Auth.exchangeCode(payload.code, payload.device_id)
          .then((data) => onAuth(data))
          .catch((error) => console.error('Ошибка обмена кода VK:', error));
      });
    }
  }, [onAuth]);

  return (
    <div className="hover:scale-105 transition-transform duration-300">
      {/* Идеально чистый контейнер без absolute и z-index. 
        ВК сам отрисует внутри свою красивую кнопку. 
      */}
      <div 
        ref={containerRef} 
        className="h-[56px] min-w-[56px] flex items-center justify-center rounded-full overflow-hidden shadow-lg border border-gray-800 bg-[#0077FF]/10 shrink-0"
      ></div>
    </div>
  );
}