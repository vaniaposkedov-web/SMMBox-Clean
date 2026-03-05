import { useEffect, useRef } from 'react';

export default function CustomVkButton({ onAuth }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const scriptId = 'vkid-sdk-script';
    
    // Проверяем, чтобы не загружать скрипт дважды
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      // Исправлена опечатка из документации ВК (убран символ < перед 3.0.0)
      script.src = 'https://unpkg.com/@vkid/sdk@3.0.0/dist-sdk/umd/index.js';
      script.async = true;
      
      script.onload = () => initVKID();
      document.body.appendChild(script);
    } else {
      initVKID();
    }

    function initVKID() {
      if ('VKIDSDK' in window && containerRef.current) {
        const VKID = window.VKIDSDK;

        // Инициализируем настройки из твоего сниппета
        VKID.Config.init({
          app: 54471878,
          redirectUrl: 'https://smmdeck.ru/auth',
          responseMode: VKID.ConfigResponseMode.Callback, // Работает без перезагрузки страницы
          source: VKID.ConfigSource.LOWCODE,
          scope: 'email', // Запрашиваем доступ к почте
        });

        const oAuth = new VKID.OAuthList();

        // Очищаем контейнер от старых рендеров (полезно при разработке)
        containerRef.current.innerHTML = '';

        oAuth.render({
          container: containerRef.current,
          oauthList: ['vkid']
        })
        .on(VKID.WidgetEvents.ERROR, (error) => {
          console.error('Ошибка виджета VK:', error);
        })
        .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, function (payload) {
          const code = payload.code;
          const deviceId = payload.device_id;

          // Обмениваем код на токен доступа
          VKID.Auth.exchangeCode(code, deviceId)
            .then((data) => {
              console.log('Успешная авторизация ВК:', data);
              // Передаем токен и данные юзера в главный файл Auth.jsx
              onAuth(data);
            })
            .catch((error) => {
              console.error('Ошибка обмена кода VK:', error);
            });
        });
      }
    }

    // Очистка при размонтировании компонента
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [onAuth]);

  return (
    <div 
      ref={containerRef} 
      className="w-14 h-14 min-w-[56px] min-h-[56px] shrink-0 flex items-center justify-center rounded-full bg-[#0077FF]/10 transition-all duration-300 hover:scale-105 overflow-hidden"
      title="Войти через ВКонтакте"
    >
      {/* Сюда ВКонтакте автоматически вставит свою иконку */}
    </div>
  );
}