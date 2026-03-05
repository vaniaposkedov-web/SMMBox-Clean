import { useEffect, useRef } from 'react';

export default function CustomVkButton({ onAuth }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const scriptId = 'vkid-sdk-script';
    
    // 1. Проверяем, загружен ли уже скрипт ВК, чтобы не дублировать
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      // Используем правильную ссылку из официальной документации
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

        // 2. Инициализируем настройки твоего приложения
        VKID.Config.init({
          app: 54471878,
          redirectUrl: 'https://smmdeck.ru/auth',
          responseMode: VKID.ConfigResponseMode.Callback, // Открывает шторку без перезагрузки
          source: VKID.ConfigSource.LOWCODE,
          scope: 'email', // Запрашиваем почту
        });

        const oAuth = new VKID.OAuthList();

        // Очищаем контейнер перед рендером
        containerRef.current.innerHTML = ''; 

        // 3. Рендерим виджет ВК
        oAuth.render({
          container: containerRef.current,
          oauthList: ['vkid'],
          styles: {
            height: 56,        // Высота точно как у кнопки Телеграма
            borderRadius: 28,  // Идеальный круг
          }
        })
        .on(VKID.WidgetEvents.ERROR, (error) => {
          console.error('Ошибка виджета VK:', error);
        })
        .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, function (payload) {
          // 4. Получили промежуточный код, обмениваем его на рабочий токен
          VKID.Auth.exchangeCode(payload.code, payload.device_id)
            .then((data) => {
              // 5. Передаем готовые данные {access_token, user_id} в Auth.jsx
              onAuth(data);
            })
            .catch((error) => console.error('Ошибка обмена кода VK:', error));
        });
      }
    }
  }, [onAuth]);

  return (
    <div className="relative w-14 h-14 min-w-[56px] min-h-[56px] shrink-0 hover:scale-105 transition-all duration-300 shadow-lg rounded-full overflow-hidden bg-[#0077FF]/10">
      
      {/* НИЖНИЙ СЛОЙ: Красивая SVG-иконка (страховка, если виджет ВК прозрачный) */}
      <div className="absolute inset-0 flex items-center justify-center text-[#0077FF] pointer-events-none">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.688 8.441c.148-.485.006-.841-.69-.841h-2.38c-.595 0-.882.316-1.03.664 0 0-1.211 2.945-2.922 4.85-.55.549-.8.723-1.096.723-.15 0-.369-.174-.369-.664v-4.733c0-.594-.173-.861-.669-.861h-3.66c-.367 0-.589.273-.589.527 0 .548.824.675.908 2.222v3.354c0 .753-.135.889-.431.889-.792 0-2.716-2.96-3.858-6.353-.227-.655-.453-.861-1.053-.861h-2.38c-.669 0-.805.316-.805.664 0 .626.804 3.743 3.75 7.876 1.965 2.816 4.731 4.336 7.24 4.336 1.506 0 1.693-.339 1.693-.918v-2.12c0-.687.145-.824.636-.824.368 0 1.004.184 2.482 1.62 1.69 1.693 1.969 2.463 2.862 2.463h2.38c.669 0 .972-.335.782-.993-.217-.714-1.006-1.637-2.049-2.82-.55-.636-1.373-1.309-1.625-1.66-.349-.484-.247-.698 0-1.097 0 0 2.866-4.045 3.12-5.421z"/>
        </svg>
      </div>

      {/* ВЕРХНИЙ СЛОЙ: Контейнер для кликабельного виджета ВК */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-10 flex items-center justify-center cursor-pointer"></div>
      
    </div>
  );
}