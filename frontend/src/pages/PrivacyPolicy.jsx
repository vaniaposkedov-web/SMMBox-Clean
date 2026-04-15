import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldCheck } from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1); 
    } else {
      window.close(); 
      navigate('/auth'); 
    }
  };

  return (
    <div className="min-h-[100dvh] bg-admin-bg text-gray-300 p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        <button 
          onClick={handleBack} 
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 sm:mb-8 transition-colors p-2 -ml-2 rounded-lg active:bg-gray-800"
        >
          <ChevronLeft size={24} className="sm:w-5 sm:h-5" /> 
          <span className="font-medium">Вернуться</span>
        </button>
        
        <div className="bg-admin-card border border-gray-800 rounded-2xl sm:rounded-3xl p-5 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-5 pointer-events-none">
            <ShieldCheck size={150} className="sm:w-[250px] sm:h-[250px]" />
          </div>

          <div className="relative z-10">
            <h1 className="text-xl sm:text-3xl font-bold mb-8 sm:mb-10 text-white tracking-wide leading-snug">
              Пользовательское соглашение и <br className="hidden sm:block"/>
              <span className="text-blue-500 text-lg sm:text-2xl mt-1 sm:mt-2 block">Политика конфиденциальности</span>
            </h1>

            <div className="space-y-6 sm:space-y-8 text-sm sm:text-base leading-relaxed text-gray-400">
              
              <section>
                <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">1. Предмет пользовательского соглашения</h2>
                <div className="space-y-3">
                  <p>1.1. Настоящее Соглашение регулирует отношения между Пользователем и сервисом SADOVODPS (далее — «Сервис») по использованию функционала платформы автопостинга.</p>
                  <p>1.2. Регистрация в Сервисе или авторизация через социальные сети означает полное и безоговорочное принятие Пользователем условий настоящего Соглашения.</p>
                  <p>1.3. Пользователь обязуется не использовать Сервис для рассылки спама, публикации запрещенного законодательством РФ контента или нарушения прав третьих лиц. Ответственность за содержание публикуемых материалов полностью лежит на Пользователе.</p>
                  <p>1.4. Сервис предоставляет Пользователю техническую возможность создания отложенных и прямых публикаций (метод wall.post) в социальные сети исключительно по прямой инициативе и команде Пользователя.</p>
                </div>
              </section>

              <section>
                <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">2. Общие положения Политики конфиденциальности</h2>
                <div className="space-y-3">
                  <p>2.1. Настоящая Политика конфиденциальности действует в отношении всей информации, включая персональные данные в понимании применимого законодательства, которую Сервис SADOVODPS может получить о Пользователе в процессе использования им веб-сайта.</p>
                  <p>2.2. Использование Сервиса SADOVODPS означает безоговорочное согласие Пользователя с настоящей Политикой и указанными в ней условиями обработки его персональных данных.</p>
                  <p>2.3. Настоящая Политика применяется только к Сервису SADOVODPS. Оператор не контролирует и не несет ответственности за сайты и сервисы третьих лиц, на которые Пользователь может перейти по ссылке.</p>
                </div>
              </section>

              <section className="bg-gray-900/60 p-5 sm:p-8 rounded-xl sm:rounded-2xl border border-gray-800">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">3. Цели сбора и обработки данных</h2>
                <p className="mb-3 sm:mb-4">Сервис обрабатывает персональную информацию Пользователя в следующих целях:</p>
                <ul className="list-none space-y-3">
                  <li className="flex gap-2 sm:gap-3"><span className="text-blue-500 font-bold">•</span> <span><strong>Идентификация:</strong> создание учетной записи и сохранение настроек.</span></li>
                  <li className="flex gap-2 sm:gap-3"><span className="text-blue-500 font-bold">•</span> <span><strong>Предоставление функционала:</strong> публикация контента от лица Пользователя по его прямому запросу через API социальных сетей.</span></li>
                  <li className="flex gap-2 sm:gap-3"><span className="text-blue-500 font-bold">•</span> <span><strong>Связь:</strong> направление уведомлений (в том числе восстановление пароля).</span></li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">4. Состав обрабатываемых данных</h2>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2">4.1. <strong>Данные, предоставляемые самостоятельно:</strong> Имя, e-mail, номер телефона, пароль.</p>
                  </div>
                  <p>4.2. <strong>Данные интеграций:</strong> Токены доступа (Access Tokens) и идентификаторы (User ID), получаемые через официальные API (например, ВКонтакте) исключительно после авторизации Пользователем. Используются строго для постинга.</p>
                </div>
              </section>

              <section>
                <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">5. Условия передачи третьим лицам</h2>
                <div className="space-y-4">
                  <p>5.1. В отношении персональной информации Пользователя сохраняется полная конфиденциальность.</p>
                  <p>5.2. Сервис вправе передать информацию третьим лицам, если Пользователь выразил согласие на такие действия (например, при инициации публикации поста в социальную сеть через их API).</p>
                </div>
              </section>

              <section>
                <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">6. Меры защиты и удаление данных</h2>
                <div className="space-y-3">
                  <p>6.1. Сервис принимает технические меры для защиты данных от неправомерного доступа.</p>
                  <p>6.2. Пользователь может в любой момент изменить данные в разделе «Настройки».</p>
                  <p>6.3. Пользователь имеет право потребовать полного удаления аккаунта и отозвать токены доступа к социальным сетям в любой момент.</p>
                </div>
              </section>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}