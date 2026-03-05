import { useEffect, useRef } from 'react';

export default function CustomVkButton({ onAuth }) {
  const containerRef = useRef(null);
  const onAuthRef = useRef(onAuth);

  // Сохраняем свежую функцию onAuth, но НЕ провоцируем перезапуск виджета
  useEffect(() => {
    onAuthRef.current = onAuth;
  }, [onAuth]);

  useEffect(() => {
    let isInitialized = false;
    const scriptId = 'vkid-sdk-script';
    
    // 1. Загружаем официальный скрипт
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/@vkid/sdk@3.0.0/dist-sdk/umd/index.js';
      script.async = true;
      script.onload = initVKID;
      document.body.appendChild(script);
    } else {
      initVKID();
    }

    function initVKID() {
      if (isInitialized) return;
      if (!('VKIDSDK' in window) || !containerRef.current) return;
      
      isInitialized = true;
      const VKID = window.VKIDSDK;

      // 2. Инициализируем конфиг
      VKID.Config.init({
        app: 54471878,
        redirectUrl: 'https://smmdeck.ru/auth',
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: 'email', 
      });

      const oAuth = new VKID.OAuthList();
      
      // Очищаем контейнер строго ОДИН раз перед отрисовкой
      containerRef.current.innerHTML = '';

      // 3. Рендерим родной виджет ВК, задаем размеры как у Телеграма
      oAuth.render({
        container: containerRef.current,
        oauthList: ['vkid'],
        styles: { 
          height: 56, 
          borderRadius: 28 
        }
      })
      .on(VKID.WidgetEvents.ERROR, (error) => {
        console.error('Ошибка виджета VK:', error);
      })
      .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, function (payload) {
        // Получаем код и меняем на токен доступа
        VKID.Auth.exchangeCode(payload.code, payload.device_id)
          .then((data) => {
            // Передаем данные в Auth.jsx через замороженный реф
            if (onAuthRef.current) onAuthRef.current(data);
          })
          .catch((err) => console.error('Ошибка обмена кода VK:', err));
      });
    }
  }, []); // ПУСТОЙ МАССИВ! Виджет отрисуется 1 раз и больше никогда не сломается.

  return (
    // Чистейший контейнер без костылей. ВК сам вставит сюда свою иконку.
    <div 
      ref={containerRef} 
      className="w-[56px] h-[56px] shrink-0 hover:scale-105 transition-transform duration-300 shadow-lg rounded-full"
    ></div>
  );
}