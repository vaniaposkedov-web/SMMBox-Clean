import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatWait } from '../sendingTime';

// Быстрая отправка обходится без плашки
const SHOW_AFTER_MS = 1000;

function WaitMessage({ subject, seconds }) {
  const [secondsLeft, setSecondsLeft] = useState(seconds);

  useEffect(() => {
    if (!seconds) return undefined;
    const timer = setInterval(() => setSecondsLeft((left) => Math.max(0, left - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  let message = `${subject} в ближайшее время.`;
  if (seconds && secondsLeft > 0) message = `${subject} в течение примерно ${formatWait(secondsLeft)}.`;
  if (seconds && secondsLeft === 0) message = 'Отправка занимает чуть дольше обычного. Пожалуйста, подождите.';

  return <p className="text-sm font-bold text-blue-100">{message}</p>;
}

// Пост в ВК подтверждается до 15 минут: столько же сервер ждёт итога, прежде чем написать «ошибка» (KOMOD_CONFIRM_MS).
export const VK_CONFIRM_MS = 15 * 60_000;

const formatClock = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// Плашка отправки в ВК с отсчётом. deadline: когда истекут 15 минут у последнего начатого поста (null, пока посты в очереди).
export function VkSendingNotice({ deadline, hint }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!deadline) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const left = deadline ? deadline - now : null;
  const title = left === null ? 'Публикуем в ВК' : left > 0 ? `Публикуем в ВК · осталось ${formatClock(left)}` : 'Публикуем в ВК · почти готово';

  return (
    <div role="status" className="flex items-start gap-3 text-left bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 animate-in fade-in duration-300">
      <Clock size={18} className="text-blue-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-blue-100 tabular-nums">{title}</p>
        <p className="text-xs text-blue-200/70 mt-1">На отправку может уйти до 15 минут.</p>
        {hint && <p className="text-xs text-blue-200/70 mt-1">{hint}</p>}
      </div>
    </div>
  );
}

// Плашка «пост будет отправлен в течение...» с обратным отсчётом. Новая оценка времени запускает отсчёт заново.
export default function SendingNotice({ subject, seconds, hint, keepPageOpen = false }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!keepPageOpen) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [keepPageOpen]);

  if (!isVisible) return null;

  return (
    <div role="status" className="flex items-start gap-3 text-left bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 animate-in fade-in duration-300">
      <Clock size={18} className="text-blue-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <WaitMessage key={seconds} subject={subject} seconds={seconds} />
        {hint && <p className="text-xs text-blue-200/70 mt-1">{hint}</p>}
      </div>
    </div>
  );
}
