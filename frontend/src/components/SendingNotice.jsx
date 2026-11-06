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
