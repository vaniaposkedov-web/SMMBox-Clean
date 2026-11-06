import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../store';
import { User } from 'lucide-react';

import CustomVkButton from '../components/CustomVkButton';
import { SUPPORT_TELEGRAM } from '../telegramBot';
import LegalConsentChecks from '../components/legal/LegalConsentChecks';

const NO_CHECKS = { acceptTerms: false, personalDataConsent: false };
const LEGAL_LINK = 'text-blue-500 hover:underline';
const SUPPORT_LINK = `https://t.me/${SUPPORT_TELEGRAM}`;

export default function Auth() {
  const vkLogin = useStore((state) => state.vkLogin);
  const [sessionExpired, setSessionExpired] = useState(() => useStore.getState().sessionExpired);
  const [accountDeleted] = useState(() => useStore.getState().accountDeleted);
  useEffect(() => { useStore.setState({ sessionExpired: false, accountDeleted: false }); }, []);

  const [error, setError] = useState('');
  const [pendingLogin, setPendingLogin] = useState(null);
  const [checks, setChecks] = useState(NO_CHECKS);

  // При отказе во входе человек должен увидеть причину на странице, а новый аккаунт создаётся только после его согласия.
  const finishVkLogin = useCallback(async (data) => {
    setError('');
    setSessionExpired(false);
    const result = await vkLogin(data);
    if (result.requiresConfirmation) {
      setChecks(NO_CHECKS);
      setPendingLogin(data);
      return;
    }
    if (!result.success) setError(result.error || 'Не удалось войти через ВКонтакте. Попробуйте ещё раз.');
  }, [vkLogin]);

  const createAccount = async () => {
    const data = pendingLogin;
    setPendingLogin(null);
    await finishVkLogin({ ...data, ...checks, createAccount: true });
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      {pendingLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm max-h-full overflow-y-auto bg-[#0d0f13] border border-gray-800 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-white font-bold text-lg mb-3">Аккаунт с этим профилем ВКонтакте не найден</h3>
            <p className="text-gray-400 text-sm mb-5">
              Если у вас уже есть аккаунт на сайте, например вы входили через Telegram или другой профиль ВКонтакте, не создавайте новый: <a href={SUPPORT_LINK} target="_blank" rel="noopener noreferrer" className={LEGAL_LINK}>напишите в поддержку</a>, и менеджер поможет сохранить тариф, каналы и посты. Новый аккаунт будет пустым.
            </p>
            <LegalConsentChecks value={checks} onChange={setChecks} />
            <div className="space-y-3 mt-5">
              <button type="button" onClick={createAccount} disabled={!checks.acceptTerms || !checks.personalDataConsent} className="w-full py-3 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Создать новый аккаунт
              </button>
              <button type="button" onClick={() => setPendingLogin(null)} className="w-full py-3 rounded-xl font-bold text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Декоративный фон */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md bg-[#0d0f13] border border-gray-800 rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-2xl relative z-10 animate-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-500/10 text-blue-500 mb-4 border border-blue-500/20">
            <User size={24} className="sm:w-7 sm:h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Вход в SADOVODPS</h1>
          <p className="text-gray-400 text-xs sm:text-sm">Войдите или зарегистрируйтесь через ВКонтакте</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <CustomVkButton onAuth={finishVkLogin} onError={setError} />
          <span className="text-xs text-gray-400">Войти через ВКонтакте</span>
        </div>

        {(sessionExpired || error || accountDeleted) && (
          <div className="mt-6">
            {accountDeleted && !error && <div role="status" className="text-green-500 text-xs text-center bg-green-500/10 py-2 sm:py-3 px-3 rounded-xl border border-green-500/20">Аккаунт и данные удалены.</div>}
            {sessionExpired && !error && !accountDeleted && <div className="text-amber-400 text-xs text-center bg-amber-500/10 py-2 sm:py-3 px-3 rounded-xl border border-amber-500/20">Время входа истекло. Войдите снова.</div>}
            {error && <div className="text-red-500 text-xs text-center bg-red-500/10 py-2 sm:py-3 px-3 rounded-xl border border-red-500/20">{error}</div>}
          </div>
        )}

        <p className="text-center text-[11px] sm:text-xs text-gray-500 mt-6 leading-relaxed">
          Перед созданием аккаунта мы попросим принять <a href="/terms" target="_blank" rel="noopener noreferrer" className={LEGAL_LINK}>Пользовательское соглашение</a> и дать <a href="/personal-data-consent" target="_blank" rel="noopener noreferrer" className={LEGAL_LINK}>Согласие на обработку персональных данных</a>. Как мы защищаем данные, описано в <a href="/privacy" target="_blank" rel="noopener noreferrer" className={LEGAL_LINK}>Политике конфиденциальности</a>.
        </p>

        <div className="mt-6 pt-6 border-t border-gray-800 text-center text-sm text-gray-400">
          Потеряли доступ к ВКонтакте?{' '}
          <a href={SUPPORT_LINK} target="_blank" rel="noopener noreferrer" className="text-blue-500 font-bold hover:text-blue-400 transition-colors">
            Напишите в поддержку
          </a>
        </div>
      </div>
    </div>
  );
}
