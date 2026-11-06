import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../store';
import { User } from 'lucide-react';
import { Link } from 'react-router-dom';

import CustomTelegramButton from '../components/CustomTelegramButton';
import CustomVkButton from '../components/CustomVkButton';
import { SUPPORT_TELEGRAM } from '../telegramBot';
import LegalConsentChecks from '../components/legal/LegalConsentChecks';

const NO_CHECKS = { acceptTerms: false, personalDataConsent: false };

export default function Auth() {
  const telegramLogin = useStore((state) => state.telegramLogin);
  const vkLogin = useStore((state) => state.vkLogin);
  const [sessionExpired, setSessionExpired] = useState(() => useStore.getState().sessionExpired);
  const [accountDeleted] = useState(() => useStore.getState().accountDeleted);
  useEffect(() => { useStore.setState({ sessionExpired: false, accountDeleted: false }); }, []);

  const [error, setError] = useState('');
  const [pendingSocial, setPendingSocial] = useState(null);
  const [checks, setChecks] = useState(NO_CHECKS);

  // При отказе во входе через соцсеть человек должен увидеть причину на странице,
  // а новый аккаунт создаётся только после его согласия.
  const finishSocialLogin = useCallback(async (name, login, data) => {
    setError('');
    setSessionExpired(false);
    const result = await login(data);
    if (result.requiresConfirmation) {
      setChecks(NO_CHECKS);
      setPendingSocial({ name, login, data });
      return;
    }
    if (!result.success) setError(result.error || `Не удалось войти через ${name}. Попробуйте ещё раз.`);
  }, []);
  const handleTelegramAuth = useCallback((data) => finishSocialLogin('Telegram', telegramLogin, data), [finishSocialLogin, telegramLogin]);
  const handleVkAuth = useCallback((data) => finishSocialLogin('ВКонтакте', vkLogin, data), [finishSocialLogin, vkLogin]);

  const createSocialAccount = async () => {
    const { name, login, data } = pendingSocial;
    setPendingSocial(null);
    await finishSocialLogin(name, login, { ...data, ...checks, createAccount: true });
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      {pendingSocial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm max-h-full overflow-y-auto bg-[#0d0f13] border border-gray-800 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-white font-bold text-lg mb-3">Аккаунт с этим профилем {pendingSocial.name} не найден</h3>
            <p className="text-gray-400 text-sm mb-5">
              Если вы уже заходили на сайт через другую соцсеть, войдите через неё и привяжите {pendingSocial.name} в профиле, в разделе «Настройки». Так у вас останутся тариф, аккаунты и посты. Новый аккаунт будет пустым.
            </p>
            <LegalConsentChecks value={checks} onChange={setChecks} />
            <div className="space-y-3 mt-5">
              <button type="button" onClick={createSocialAccount} disabled={!checks.acceptTerms || !checks.personalDataConsent} className="w-full py-3 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Создать новый аккаунт
              </button>
              <button type="button" onClick={() => setPendingSocial(null)} className="w-full py-3 rounded-xl font-bold text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors">
                Войти через другую соцсеть
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
          <p className="text-gray-400 text-xs sm:text-sm">Войдите или зарегистрируйтесь через Telegram или ВКонтакте</p>
        </div>

        <div className="flex justify-center gap-4">
          <CustomTelegramButton onAuthCallback={handleTelegramAuth} />
          <CustomVkButton onAuth={handleVkAuth} onError={setError} />
        </div>

        {(sessionExpired || error || accountDeleted) && (
          <div className="mt-6">
            {accountDeleted && !error && <div role="status" className="text-green-500 text-xs text-center bg-green-500/10 py-2 sm:py-3 px-3 rounded-xl border border-green-500/20">Аккаунт и данные удалены.</div>}
            {sessionExpired && !error && !accountDeleted && <div className="text-amber-400 text-xs text-center bg-amber-500/10 py-2 sm:py-3 px-3 rounded-xl border border-amber-500/20">Время входа истекло. Войдите снова.</div>}
            {error && <div className="text-red-500 text-xs text-center bg-red-500/10 py-2 sm:py-3 px-3 rounded-xl border border-red-500/20">{error}</div>}
          </div>
        )}

        <div className="text-center text-[10px] sm:text-xs text-gray-500 mt-6 leading-relaxed space-y-2">
          <p>Перед созданием аккаунта мы попросим принять соглашение и дать согласие на обработку персональных данных.</p>
          <p className="flex flex-wrap justify-center gap-x-3 gap-y-1">
            <Link to="/terms" className="text-blue-500 hover:underline">Соглашение</Link>
            <Link to="/privacy" className="text-blue-500 hover:underline">Политика</Link>
            <Link to="/personal-data-consent" className="text-blue-500 hover:underline">Согласие</Link>
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-800 text-center text-sm text-gray-400">
          Потеряли доступ к соцсетям?{' '}
          <a href={`https://t.me/${SUPPORT_TELEGRAM}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 font-bold hover:text-blue-400 transition-colors">
            Напишите в поддержку
          </a>
        </div>
      </div>
    </div>
  );
}
