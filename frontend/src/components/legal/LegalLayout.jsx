import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { LEGAL_DATE, LEGAL_DOCUMENTS, OPERATOR, SITE_ADDRESS } from '../../legal/details';
import { SUPPORT_TELEGRAM } from '../../telegramBot';

const tabClass = ({ isActive }) => `px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'}`;

// Незаполненное значение видно сразу, чтобы документ случайно не вышел с пропуском.
export function Fill({ value, label }) {
  if (value) return value;
  return <mark className="bg-amber-400/20 text-amber-300 px-1 rounded">[заполнить: {label}]</mark>;
}

export function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function OperatorDetails({ title }) {
  return (
    <Section title={title}>
      <p><Fill value={OPERATOR.name} label="ФИО предпринимателя или название компании" /></p>
      <p>ИНН: <Fill value={OPERATOR.inn} label="ИНН" /></p>
      <p>ОГРН или ОГРНИП: <Fill value={OPERATOR.ogrn} label="ОГРН или ОГРНИП" /></p>
      <p>Адрес: <Fill value={OPERATOR.address} label="адрес" /></p>
      <p>Электронная почта: <Fill value={OPERATOR.email} label="почта для обращений" /></p>
      <p>Телефон: <Fill value={OPERATOR.phone} label="телефон" /></p>
      <p>Сайт: {SITE_ADDRESS}. Поддержка в Telegram: @{SUPPORT_TELEGRAM}.</p>
    </Section>
  );
}

export default function LegalLayout({ title, children }) {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `SADOVODPS | ${title}`;
  }, [title]);

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
        <button onClick={handleBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 sm:mb-6 transition-colors p-2 -ml-2 rounded-lg active:bg-gray-800">
          <ChevronLeft size={24} className="sm:w-5 sm:h-5" />
          <span className="font-medium">Вернуться</span>
        </button>

        <nav aria-label="Документы" className="flex flex-wrap gap-2 mb-4 sm:mb-6">
          {LEGAL_DOCUMENTS.map(({ path, title: name }) => <NavLink key={path} to={path} className={tabClass}>{name}</NavLink>)}
        </nav>

        <article className="bg-admin-card border border-gray-800 rounded-2xl sm:rounded-3xl p-5 sm:p-12 shadow-2xl">
          <h1 className="text-xl sm:text-3xl font-bold mb-2 text-white leading-snug">{title}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mb-8 sm:mb-10">Редакция от {LEGAL_DATE}</p>
          <div className="space-y-6 sm:space-y-8 text-sm sm:text-base leading-relaxed text-gray-400">{children}</div>
        </article>
      </div>
    </div>
  );
}
