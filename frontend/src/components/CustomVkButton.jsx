import { useEffect, useRef } from 'react';

export default function CustomVkButton({ onAuth }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const initVKID = () => {
      // Проверяем, что компонент всё еще на экране и скрипт загружен
      if (!isMounted || !containerRef.current || !window.VKIDSDK) return;

      try {
        // Очищаем контейнер, чтобы кнопка не дублировалась при обновлениях React
        containerRef.current.innerHTML = '';

        const VKID = window.VKIDSDK;

        // Строго по документации
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
          oauthList: ['vkid']
          // Я УБРАЛ СВОЙСТВО STYLES, КОТОРОЕ КРАШИЛО ИХ СКРИПТ
        })
        .on(VKID.WidgetEvents.ERROR, (error) => {
          console.error('Ошибка виджета VK:', error);
        })
        .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, function (payload) {
          VKID.Auth.exchangeCode(payload.code, payload.device_id)
            .then((data) => {
              if (isMounted) onAuth(data);
            })
            .catch(console.error);
        });
      } catch (e) {
        console.error('Критическая ошибка инициализации ВК:', e);
      }
    };

    // Загружаем скрипт, если его еще нет на странице
    if (!window.VKIDSDK) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@vkid/sdk@3.0.0/dist-sdk/umd/index.js';
      script.async = true;
      script.onload = initVKID;
      document.head.appendChild(script);
    } else {
      // Если скрипт уже есть (например, при перезагрузке компонента)
      initVKID();
    }

    return () => {
      isMounted = false;
    };
  }, [onAuth]);

  return (
    <div 
      ref={containerRef} 
      className="flex items-center justify-center hover:scale-105 transition-transform duration-300"
    ></div>
  );
}