import { useStore } from './store';

// When the server rejects the user's token, the login has expired: leave the empty pages and ask to sign in again.
// Admin requests use their own token and handle this themselves.
export function installSessionGuard() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    if (response.status !== 401) return response;

    const url = typeof input === 'string' ? input : input?.url || '';
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
