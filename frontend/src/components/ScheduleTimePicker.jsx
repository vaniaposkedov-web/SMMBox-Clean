import { useEffect } from 'react';
import { getAvailableTimes } from '../scheduleTime';

const SELECT_CLASS = 'flex-1 min-w-[84px] appearance-none bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-lg font-medium text-white text-center outline-none focus:border-purple-500 transition-colors h-[50px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

// В списках есть только будущее и свободное время, поэтому прошедшее или занятое выбрать нельзя.
export default function ScheduleTimePicker({ dateKey, value, onChange, busyTimes = [], keepTime = null }) {
  const hours = getAvailableTimes(dateKey, busyTimes, keepTime);
  const [valueHour, valueMinute] = value ? value.split(':') : ['', ''];
  const hourEntry = hours.find((entry) => entry.hour === valueHour);
  const isValueAvailable = Boolean(hourEntry?.minutes.includes(valueMinute));

  // Выбранное время могло пройти, пока человек заполнял пост, или его заняли на другой вкладке.
  useEffect(() => {
    if (value && !isValueAvailable) onChange('');
  }, [value, isValueAvailable, onChange]);

  if (hours.length === 0) {
    return <p className="text-sm text-red-400">На эту дату свободного времени больше нет. Выберите другую дату.</p>;
  }

  const pickHour = (hour) => {
    const { minutes } = hours.find((entry) => entry.hour === hour);
    onChange(`${hour}:${minutes.includes(valueMinute) ? valueMinute : minutes[0]}`);
  };

  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <select aria-label="Часы" value={isValueAvailable ? valueHour : ''} onChange={(e) => pickHour(e.target.value)} className={SELECT_CLASS}>
        <option value="" disabled>Часы</option>
        {hours.map((entry) => <option key={entry.hour} value={entry.hour}>{entry.hour}</option>)}
      </select>
      <span className="text-gray-500 font-bold">:</span>
      <select aria-label="Минуты" value={isValueAvailable ? valueMinute : ''} onChange={(e) => onChange(`${valueHour}:${e.target.value}`)} disabled={!isValueAvailable} className={SELECT_CLASS}>
        {!isValueAvailable && <option value="">Мин</option>}
        {isValueAvailable && hourEntry.minutes.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
      </select>
    </div>
  );
}
