import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useStore } from '../../store';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT_CLASS = 'w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all shadow-inner min-h-[40px]';
const BUTTONS_CLASS = 'flex flex-col sm:flex-row gap-2 mt-2';
const SUBMIT_CLASS = 'sm:flex-1 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50 min-h-[40px]';
const SECONDARY_CLASS = 'shrink-0 bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors border border-gray-700 min-h-[40px]';
const LINK_CLASS = 'shrink-0 text-blue-500 hover:text-blue-400 text-xs font-bold transition-colors disabled:opacity-50';

// Почта меняется только после кода из письма, поэтому у неё своя кнопка, отдельно от «Сохранить».
export default function EmailLinkForm() {
  const user = useStore((state) => state.user);
  const requestEmailLink = useStore((state) => state.requestEmailLink);
  const verifyEmailLink = useStore((state) => state.verifyEmailLink);

  const currentEmail = user?.email && !user.email.includes('.local') ? user.email : null;

  const [isChanging, setIsChanging] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const sendCode = async (address) => {
    const isResend = address === codeSentTo;
    setIsBusy(true);
    setNotice(null);
    const result = await requestEmailLink(address);
    setIsBusy(false);
    if (!result.success) {
      setNotice({ ok: false, text: result.error || 'Не удалось отправить письмо с кодом. Попробуйте позже.' });
      return;
    }
    setCodeSentTo(address);
    setCode('');
    setNotice({
      ok: true,
      text: isResend
        ? `Новый код отправлен на ${address}. Прежний код больше не действует.`
        : `Код отправлен на ${address}. Он действует 15 минут.`,
    });
  };

  const handleEmailSubmit = (event) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setNotice({ ok: false, text: 'Укажите настоящий адрес почты, например name@mail.ru.' });
      return;
    }
    if (address === currentEmail) {
      setNotice({ ok: false, text: 'Эта почта уже указана в вашем профиле.' });
      return;
    }
    sendCode(address);
  };

  const handleCodeSubmit = async (event) => {
    event.preventDefault();
    if (!code) {
      setNotice({ ok: false, text: 'Введите код из письма.' });
      return;
    }
    setIsBusy(true);
    setNotice(null);
    const result = await verifyEmailLink(codeSentTo, code);
    setIsBusy(false);
    if (!result.success) {
      setNotice({ ok: false, text: result.error || 'Не удалось подтвердить почту. Попробуйте ещё раз.' });
      return;
    }
    setCodeSentTo(null);
    setIsChanging(false);
    setEmail('');
    setCode('');
    setNotice({
      ok: true,
      text: user.hasPassword === false
        ? 'Почта подтверждена. Чтобы входить по ней, задайте пароль в блоке «Безопасность».'
        : 'Почта подтверждена. Теперь входите на сайт по этому адресу.',
    });
  };

  const startChanging = () => {
    setIsChanging(true);
    setNotice(null);
  };

  const cancelChanging = () => {
    setIsChanging(false);
    setEmail('');
    setNotice(null);
  };

  const backToEmail = () => {
    setCodeSentTo(null);
    setCode('');
    setNotice(null);
  };

  const isViewing = currentEmail && !isChanging;

  return (
    <div className="pt-3 border-t border-gray-800 mt-4">
      <label htmlFor={codeSentTo ? 'profile-email-code' : 'profile-email'} className="text-[10px] sm:text-xs text-gray-500 mb-1.5 block font-bold uppercase tracking-wider">
        {codeSentTo ? 'Код из письма' : 'Почта'}
      </label>

      {isViewing && (
        <div className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 min-h-[40px]">
          <div className="flex items-center gap-2 min-w-0">
            {user.isEmailVerified && <CheckCircle2 size={16} className="text-green-500 shrink-0" />}
            <span className="text-sm text-white truncate">{currentEmail}</span>
          </div>
          <button type="button" onClick={startChanging} className={LINK_CLASS}>Изменить</button>
        </div>
      )}

      {!isViewing && !codeSentTo && (
        <form onSubmit={handleEmailSubmit} noValidate>
          <input
            id="profile-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@mail.ru"
            className={INPUT_CLASS}
          />
          <div className={BUTTONS_CLASS}>
            <button type="submit" disabled={isBusy} className={SUBMIT_CLASS}>
              {isBusy && <Loader2 size={16} className="animate-spin" />} Получить код
            </button>
            {isChanging && (
              <button type="button" onClick={cancelChanging} className={SECONDARY_CLASS}>Отмена</button>
            )}
          </div>
          <p className="text-gray-500 text-xs mt-2">
            {isChanging
              ? 'Код придёт на новый адрес. После подтверждения старая почта перестанет работать для входа.'
              : 'Почта нужна для входа и восстановления пароля. Мы пришлём на неё код для подтверждения.'}
          </p>
        </form>
      )}

      {codeSentTo && (
        <form onSubmit={handleCodeSubmit} noValidate>
          <input
            id="profile-email-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            placeholder="6 цифр"
            className={INPUT_CLASS}
          />
          <div className={BUTTONS_CLASS}>
            <button type="submit" disabled={isBusy} className={SUBMIT_CLASS}>
              {isBusy && <Loader2 size={16} className="animate-spin" />} Подтвердить
            </button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <button type="button" disabled={isBusy} onClick={() => sendCode(codeSentTo)} className={LINK_CLASS}>Отправить ещё раз</button>
            <button type="button" disabled={isBusy} onClick={backToEmail} className={LINK_CLASS}>Другой адрес</button>
          </div>
        </form>
      )}

      {notice && (
        <p role="status" className={`text-xs mt-3 px-3 py-2 rounded-xl border break-words ${notice.ok ? 'text-green-500 bg-green-500/10 border-green-500/20' : 'text-red-500 bg-red-500/10 border-red-500/20'}`}>
          {notice.text}
        </p>
      )}
    </div>
  );
}
