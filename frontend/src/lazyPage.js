import { lazy } from 'react';

const RELOAD_FLAG = 'page-file-reload';

// Страница загружается отдельным файлом, только когда нужна. После обновления сайта старые файлы исчезают,
// и у человека с открытой вкладкой страница не найдётся: тогда сайт один раз перезагрузится сам.
export const lazyPage = (load) => lazy(async () => {
  try {
    const page = await load();
    sessionStorage.removeItem(RELOAD_FLAG);
    return page;
  } catch (error) {
    if (navigator.onLine !== false && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
      return new Promise(() => {});
    }
    throw error;
  }
});
