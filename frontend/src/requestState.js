// Учёт запросов к серверу. Отдельный файл, чтобы им могли пользоваться и хранилище, и защита сессии.

let writes = 0;
const inFlight = new Map();

// Человек что-то изменил на сервере: ответы на запросы, начатые раньше, могли устареть.
export const noteWrite = () => {
  writes += 1;
};

export const writesCount = () => writes;

// Одинаковые запросы, идущие одновременно, объединяются в один: страница и общий каркас часто просят одно и то же.
// Если запрос начался до изменения данных, его ответ уже устарел: новый запрос выполнится сразу после него.
export const once = (key, work) => {
  const current = inFlight.get(key);
  if (current && current.startedAtWrite === writes) return current.promise;

  const entry = { startedAtWrite: writes, promise: null };
  const previous = current ? current.promise.catch(() => {}) : Promise.resolve();
  entry.promise = previous.then(work).finally(() => {
    if (inFlight.get(key) === entry) inFlight.delete(key);
  });
  inFlight.set(key, entry);
  return entry.promise;
};
