import { useEffect, useRef } from 'react';

export default function TelegramLoginButton({ botName, onAuth }) {
  const containerRef = useRef(null);

  useEffect(() => {
    // Эта функция сработает, когда пользователь нажмет кнопку и авторизуется в ТГ
    window.TelegramLoginWidget = {
      dataOnauth: (user) => onAuth(user)
    };

    // Динамически создаем скрипт виджета
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    // Имя твоего бота, которое ты создал в BotFather
    script.setAttribute('data-telegram-login', botName); 
    script.setAttribute('data-size', 'large'); // Размер кнопки
    script.setAttribute('data-radius', '10'); // Скругление краев кнопки
    script.setAttribute('data-request-access', 'write'); // Разрешаем боту писать юзеру
    script.setAttribute('data-onauth', 'TelegramLoginWidget.dataOnauth(user)');
    script.async = true;

    // Очищаем контейнер и вставляем кнопку
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);
    }
  }, [botName, onAuth]);

  return <div className="flex justify-center" ref={containerRef}></div>;
}