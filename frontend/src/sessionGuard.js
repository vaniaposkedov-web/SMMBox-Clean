import { useStore } from './store';
import { noteWrite } from './requestState';

// When the server rejects the user's token, the login has expired: leave the empty pages and ask to sign in again.
// Admin requests use their own token and handle this themselves.
// Сколько ждать ответа сервера. Загрузка фото на медленном интернете занимает минуты, обычный запрос нет.
const timeoutFor = (init) => {
  if (init?.body instanceof FormData) return 5 * 60 * 1000;
  return (init?.method || 'GET').toUpperCase() === 'GET' ? 30 * 1000 : 2 * 60 * 1000;
};

export function installSessionGuard() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';

    // При обрыве связи запрос завершается ошибкой, и экран показывает понятное сообщение вместо вечной загрузки.
    let timer = null;
    let request = init;
    if (url.includes('/api/') && !init?.signal) {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutFor(init));
      request = { ...init, signal: controller.signal };
    }

    let response;
    try {
      response = await originalFetch(input, request);
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (url.includes('/api/') && (init?.method || 'GET').toUpperCase() !== 'GET') noteWrite();
    if (response.status !== 401) return response;

    const header = init?.headers?.Authorization || init?.headers?.authorization;
    const state = useStore.getState();
    const userToken = localStorage.getItem('token') || state.token;

    if (url.includes('/api/') && header && userToken && header === `Bearer ${userToken}` && state.user) {
      state.logout();
      useStore.setState({ sessionExpired: true });
    }
    return response;
  };
}
