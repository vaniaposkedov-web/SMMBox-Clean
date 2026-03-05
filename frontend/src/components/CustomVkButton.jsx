import { useEffect, useRef } from 'react';

export default function CustomVkButton({ onAuth }) {
  const containerRef = useRef(null);
  const isInitialized = useRef(false);
  const onAuthRef = useRef(onAuth);

  // Сохраняем ссылку на функцию авторизации, чтобы избежать лишних ре-рендеров
  useEffect(() => {
    onAuthRef.current = onAuth;
  }, [onAuth]);

  useEffect(() => {
    // Блокируем двойной запуск виджета
    if (isInitialized.current) return;

    const loadAndInitVK = () => {
      if (!window.VKIDSDK || !containerRef.current) return;
      
      isInitialized.current = true;
      const VKID = window.VKIDSDK;

      // Инициализация строго по официальной документации Low-code
      VKID.Config.init({
        app: 54471878,
        redirectUrl: 'https://smmdeck.ru/auth',
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: 'email',
      });

      const oAuth = new VKID.OAuthList();
      
      // Очищаем контейнер перед рендером
      containerRef.current.innerHTML = '';

      oAuth.render({
        container: containerRef.current,
        oauthList: ['vkid']
      })
      .on(VKID.WidgetEvents.ERROR, (error) => {
        console.error('Ошибка виджета VK:', error);
      })
      .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, (payload) => {
        VKID.Auth.exchangeCode(payload.code, payload.device_id)
          .then((data) => {
            if (onAuthRef.current) onAuthRef.current(data);
          })
          .catch((err) => console.error('Ошибка обмена кода VK:', err));
      });
    };

    if (window.VKIDSDK) {
      loadAndInitVK();
    } else {
      const scriptId = 'vkid-sdk-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        // Используем latest, чтобы избежать ошибки загрузки несуществующей версии
        script.src = 'https://unpkg.com/@vkid/sdk@latest/dist-sdk/umd/index.js';
        script.async = true;
        document.head.appendChild(script);
        script.onload = loadAndInitVK;
      }
    }
  }, []);

  return (
    <div className="hover:scale-105 transition-transform duration-300">
      {/* Контейнер имеет минимальные размеры. 
        Даже до полной загрузки скрипта он будет держать место на экране, 
        а затем ВК сам вставит сюда свою круглую кнопку.
      */}
      <div 
        ref={containerRef} 
        className="flex items-center justify-center min-w-[44px] min-h-[44px]"
      ></div>
    </div>
  );
}