const linkClass = 'text-blue-500 hover:underline';

// Две отдельные отметки: согласие на обработку данных по закону нельзя объединять с другими документами.
// Изначально они пустые. Документы открываются в новой вкладке, чтобы не потерять ответ соцсети.
export default function LegalConsentChecks({ value, onChange }) {
  const toggle = (field) => (event) => onChange({ ...value, [field]: event.target.checked });

  return (
    <div className="space-y-3 text-left text-xs sm:text-sm text-gray-300">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={value.acceptTerms} onChange={toggle('acceptTerms')} className="mt-0.5 w-4 h-4 shrink-0 accent-blue-500" />
        <span>Принимаю <a href="/terms" target="_blank" rel="noopener noreferrer" className={linkClass}>Пользовательское соглашение и публичную оферту</a>. Мне исполнилось 18 лет.</span>
      </label>
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={value.personalDataConsent} onChange={toggle('personalDataConsent')} className="mt-0.5 w-4 h-4 shrink-0 accent-blue-500" />
        <span>Даю <a href="/personal-data-consent" target="_blank" rel="noopener noreferrer" className={linkClass}>согласие на обработку персональных данных</a>.</span>
      </label>
      <p className="text-gray-500">Как мы обращаемся с данными, описано в <a href="/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>Политике конфиденциальности</a>.</p>
    </div>
  );
}
