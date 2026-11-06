import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import LegalConsentChecks from './LegalConsentChecks';

// Клиент, который ещё не принимал документы или должен принять их новую редакцию, не может продолжить без согласия.
export default function ConsentGate() {
  const consentRequired = useStore((state) => state.user?.consentRequired);
  const fetchCurrentUser = useStore((state) => state.fetchCurrentUser);
  const acceptLegalDocuments = useStore((state) => state.acceptLegalDocuments);
  const logout = useStore((state) => state.logout);
  const [checks, setChecks] = useState({ acceptTerms: false, personalDataConsent: false });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchCurrentUser(); }, [fetchCurrentUser]);

  if (!consentRequired) return null;

  const handleAccept = async () => {
    setIsSaving(true);
    setError('');
    const result = await acceptLegalDocuments(checks);
    setIsSaving(false);
    if (!result.success) setError(result.error || 'Не удалось сохранить. Попробуйте ещё раз.');
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="consent-title" className="w-full max-w-md max-h-full overflow-y-auto bg-[#0d0f13] border border-gray-800 rounded-3xl p-6 shadow-2xl">
        <h2 id="consent-title" className="text-white font-bold text-lg mb-2">Документы сайта</h2>
        <p className="text-gray-400 text-sm mb-5">Чтобы продолжить работу, примите соглашение и дайте согласие на обработку персональных данных.</p>
        <LegalConsentChecks value={checks} onChange={setChecks} />
        {error && <p role="status" className="text-red-500 text-xs mt-4">{error}</p>}
        <div className="space-y-3 mt-5">
          <button type="button" onClick={handleAccept} disabled={isSaving || !checks.acceptTerms || !checks.personalDataConsent} className="w-full py-3 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Принять и продолжить
          </button>
          <button type="button" onClick={() => logout()} className="w-full py-3 rounded-xl font-bold text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors">
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}
