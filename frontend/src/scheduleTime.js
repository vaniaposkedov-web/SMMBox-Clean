// Какое время можно выбрать для отложенного поста. Окончательно это проверяет сервер.
export const MIN_SCHEDULE_AHEAD_MINUTES = 5;

const pad2 = (value) => String(value).padStart(2, '0');

export const toDateKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
export const toTimeKey = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

export const fromKeys = (dateKey, timeKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = timeKey.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
};

export const getEarliestScheduleTime = () => {
  const earliest = new Date(Date.now() + MIN_SCHEDULE_AHEAD_MINUTES * 60 * 1000);
  if (earliest.getSeconds() > 0 || earliest.getMilliseconds() > 0) earliest.setMinutes(earliest.getMinutes() + 1);
  earliest.setSeconds(0, 0);
  return earliest;
};

// Часы и минуты, доступные на эту дату. keepTime: текущее время поста, который редактируют, оно остаётся доступным.
export const getAvailableTimes = (dateKey, busyTimes = [], keepTime = null) => {
  const earliest = getEarliestScheduleTime();
  const busy = new Set(busyTimes);
  const hours = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const minutes = [];
    for (let minute = 0; minute < 60; minute += 1) {
      const timeKey = `${pad2(hour)}:${pad2(minute)}`;
      if (timeKey === keepTime || (!busy.has(timeKey) && fromKeys(dateKey, timeKey) >= earliest)) minutes.push(pad2(minute));
    }
    if (minutes.length > 0) hours.push({ hour: pad2(hour), minutes });
  }
  return hours;
};
