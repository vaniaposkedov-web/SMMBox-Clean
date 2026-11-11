import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { blobFileName } from './imageTools';
import { once, writesCount } from './requestState';

// Если данные не изменились, экран не перерисовывается. Важно для опроса каждые 15 секунд.
const isSame = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Данные пользователя просят сразу несколько страниц при открытии: свежий ответ используется повторно несколько секунд.
const ME_FRESH_MS = 5000;
let meFetchedAt = 0;
let meFetchedAtWrite = -1;

const EMPTY_GLOBAL_SETTINGS = { signature: '', watermark: null };

export const useStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      accounts: [],
      profiles: [], 
      posts: [],
      myPartners: [],
      incomingRequests: [],
      outgoingRequests: [],
      notifications: [],
      sharedIncoming: [],
      sharedOutgoing: [],
      scheduledPosts: [],
      postsHistory: [],
      // Какие данные уже приходили с сервера: до этого показывается скелетон, а не надпись «пока пусто».
      loaded: {},
      markLoaded: (key) => { if (!get().loaded[key]) set({ loaded: { ...get().loaded, [key]: true } }); },

      watermarkSettings: {
        type: 'text',
        text: 'SADOVODPS',
        image: null, 
        position: 'br',
        hasBackground: true,
        visualStyle: 'glass',
        fontFamily: 'font-sans',
        textColor: '#FFFFFF',
        bgColor: '#000000',
        size: 100,
        angle: 0,
        opacity: 90
      },

      tempDraft: null,
      sessionExpired: false,
      accountDeleted: false,
      saveTempDraft: (data) => set({ tempDraft: data }),

      presets: [
        { id: 'default', name: 'Стандартный', watermark: true, signature: true },
        { id: 'minimal', name: 'Минимализм', watermark: false, signature: false }
      ],

      fetchProfiles: (userId) => once('profiles', async () => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return;
          
          const res = await fetch(`/api/accounts/profiles?userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && !isSame(data.profiles, get().profiles)) set({ profiles: data.profiles });
          }
        } catch (error) {
          console.error("Ошибка загрузки профилей:", error);
        } finally {
          get().markLoaded('profiles');
        }
      }),


      // === ФУНКЦИЯ УДАЛЕНИЯ ПРОФИЛЯ ===
      fetchPostsHistory: () => once('history', async () => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token) return;

          const res = await fetch('/api/posts/history', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.ok) {
            const data = await res.json();
            if (!isSame(data.posts || [], get().postsHistory)) set({ postsHistory: data.posts || [] });
          }
        } catch (error) {
          console.error("Ошибка загрузки истории:", error);
        }
      }),

      // Метод для переотправки поста с ошибкой
      retryFailedPost: async (postId) => {
        try {
          const token = localStorage.getItem('token') || get().token;
          const res = await fetch(`/api/posts/retry/${postId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (res.ok) {
            // После успешного запроса обновляем и историю, и календарь
            await get().fetchPostsHistory();
            await get().fetchScheduledPosts();
            return { success: true };
          }
          return { success: false };
        } catch (error) {
          return { success: false };
        }
      },

      
      fetchScheduledPosts: () => once('scheduled', async () => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return;
          const res = await fetch('/api/posts/scheduled', { headers: { 'Authorization': `Bearer ${token}` } });
          if (!res.ok) return;
          const data = await res.json(); 
          const posts = data.posts || data.scheduledPosts || [];
          if (!isSame(posts, get().scheduledPosts)) set({ scheduledPosts: posts });
        } catch (error) {
        } finally {
          get().markLoaded('scheduled');
        }
      }),

      deleteScheduledPostAction: async (id) => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return;
          const res = await fetch(`/api/posts/scheduled/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) get().fetchScheduledPosts();
        } catch (error) {}
      },

      fetchCurrentUser: () => once('me', async () => {
        if (Date.now() - meFetchedAt < ME_FRESH_MS && meFetchedAtWrite === writesCount()) return;
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return;

          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              // Тихо обновляем пользователя в стейте (Zustand сам перезапишет localStorage).
              // Без изменений объект не заменяется: иначе зависящие от него страницы повторяют свои запросы.
              const nextUser = { ...get().user, ...data.user };
              meFetchedAt = Date.now();
              meFetchedAtWrite = writesCount();
              if (!isSame(nextUser, get().user)) set({ user: nextUser });
            }
          }
        } catch (error) {
          console.error("Ошибка обновления данных юзера:", error);
        }
      }),

      vkLogin: async (vkData) => {
        try {
          const res = await fetch('/api/auth/vk', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vkData),
          });
          const data = await res.json();
          if (!res.ok) return { success: false, error: data.error };
          if (data.requiresConfirmation) return { success: false, requiresConfirmation: true };
          set({ user: data.user, token: data.token });
          localStorage.setItem('token', data.token);
          get().fetchProfiles(data.user.id);
          return { success: true };
        } catch (error) { return { success: false, error: 'Ошибка сети' }; }
      },

      linkSocialLogin: async (url, data) => {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || get().token}` },
            body: JSON.stringify(data),
          });
          const result = await res.json();
          if (!res.ok) return { success: false, error: result.error };
          set({ user: result.user });
          get().fetchProfiles(result.user.id);
          return { success: true };
        } catch (error) { return { success: false, error: 'Ошибка сети' }; }
      },
      linkVkLogin: (data) => get().linkSocialLogin('/api/auth/link/vk', data),

      unlinkTelegram: async () => {
        try {
          const res = await fetch('/api/auth/unlink/telegram', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || get().token}` },
          });
          const data = await res.json();
          if (!res.ok) return { success: false, error: data.error };
          set({ user: data.user });
          get().fetchProfiles(data.user.id);
          return { success: true };
        } catch (error) { return { success: false, error: 'Ошибка сети' }; }
      },

      acceptLegalDocuments: async (checks) => {
        try {
          const res = await fetch('/api/auth/consent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || get().token}` },
            body: JSON.stringify(checks),
          });
          const data = await res.json();
          if (!res.ok) return { success: false, error: data.error };
          set({ user: { ...get().user, ...data.user } });
          return { success: true };
        } catch (error) { return { success: false, error: 'Ошибка сети' }; }
      },

      deleteAccount: async () => {
        try {
          const res = await fetch('/api/auth/delete-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || get().token}` },
            body: JSON.stringify({ confirm: true }),
          });
          const data = await res.json();
          if (!res.ok) return { success: false, error: data.error };
          get().logout();
          set({ accountDeleted: true });
          return { success: true };
        } catch (error) { return { success: false, error: 'Ошибка сети' }; }
      },

      recoverAccess: async (code) => {
        try {
          const res = await fetch('/api/auth/recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          const data = await res.json();
          if (!res.ok) return { success: false, error: data.error };
          localStorage.setItem('token', data.token);
          set({ user: data.user, token: data.token });
          return { success: true };
        } catch (error) { return { success: false, error: 'Ошибка сети' }; }
      },

      createTelegramBindCode: async () => {
        try {
          const res = await fetch('/api/accounts/tg/bind-code', {
            method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || get().token}` }
          });
          const data = await res.json();
          if (res.ok && data.code) return { success: true, code: data.code };
          return { success: false, error: data.error };
        } catch (error) { return { success: false, error: 'Ошибка сети' }; }
      },

      verifyAccountsStatus: async () => {
        try {
          const user = get().user;
          if (!user?.id) return;
          const res = await fetch('/api/accounts/tg/verify-status', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, body: JSON.stringify({ userId: user.id })
          });
          // ДОБАВЛЕН await для синхронизации анимации
          if (res.ok) await get().fetchAccounts(user.id); 
        } catch (error) {}
      },

      updateUser: async (formData) => {
        try {
          const res = await fetch('/api/auth/profile', {
            method: 'PUT', headers: { 'Authorization': `Bearer ${get().token}` }, body: formData
          });
          const data = await res.json();
          if (data.success) {
            set({ user: { ...get().user, ...data.user } });
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) { return { success: false, error: 'Ошибка сети' }; }
      },

      logout: () => {
        localStorage.removeItem('token');
        meFetchedAt = 0;
        set({ 
          user: null, token: null, accounts: [], profiles: [], myPartners: [], incomingRequests: [], outgoingRequests: [], notifications: [], sharedIncoming: [], sharedOutgoing: [],
          // Иначе следующий человек на этом устройстве увидел бы черновик и посты предыдущего.
          scheduledPosts: [], postsHistory: [], tempDraft: null, globalSettings: EMPTY_GLOBAL_SETTINGS, loaded: {}
        });
      },

      fetchPartnerData: (userId) => once('partners', async () => {
        try {
          const res = await fetch(`/api/partners/data?userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${get().token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const current = get();
            const next = {};
            if (!isSame(data.partners, current.myPartners)) next.myPartners = data.partners;
            if (!isSame(data.incomingRequests, current.incomingRequests)) next.incomingRequests = data.incomingRequests;
            if (!isSame(data.outgoingRequests, current.outgoingRequests)) next.outgoingRequests = data.outgoingRequests;
            if (!isSame(data.notifications, current.notifications)) next.notifications = data.notifications;
            if (Object.keys(next).length > 0) set(next);
          }
        } catch (error) {
        } finally {
          get().markLoaded('partners');
        }
      }),

      searchUsersFromApi: async (query, userId) => {
        try {
          const res = await fetch(`/api/partners/search?query=${encodeURIComponent(query)}&userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${get().token}` }
          });
          if (res.ok) return await res.json();
          return [];
        } catch (error) { return []; }
      },

      sendPartnershipRequest: async (requesterId, receiverId) => {
        try {
          const res = await fetch('/api/partners/request', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, 
            body: JSON.stringify({ requesterId, receiverId }) 
          });
          const data = await res.json();
          if (res.ok) {
            get().fetchPartnerData(requesterId);
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) { 
          return { success: false, error: 'Ошибка соединения с сервером' }; 
        }
      },

      acceptPartnership: async (partnershipId) => {
        try {
          const res = await fetch('/api/partners/accept', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, 
            body: JSON.stringify({ partnershipId }) 
          });
          if (res.ok) {
            get().fetchPartnerData(get().user.id);
            return { success: true };
          }
          return { success: false };
        } catch (error) { return { success: false }; }
      },

      declinePartnership: async (partnershipId) => {
        try {
          const res = await fetch('/api/partners/decline', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, 
            body: JSON.stringify({ partnershipId }) 
          });
          if (res.ok) {
            get().fetchPartnerData(get().user.id);
            return { success: true };
          }
          return { success: false };
        } catch (error) { return { success: false }; }
      },

      removePartnerAction: async (currentUserId, partnerId) => {
        try {
          const res = await fetch('/api/partners/remove', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, 
            body: JSON.stringify({ currentUserId, partnerId }) 
          });
          if (res.ok) {
            get().fetchPartnerData(currentUserId);
            return { success: true };
          }
          return { success: false };
        } catch (error) { return { success: false }; }
      },

      markNotificationAsRead: async (id) => {
        // Мгновенно убираем индикатор в интерфейсе
        set((state) => ({ notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n) }));
        // Тихо отправляем запрос на сервер
        try {
          await fetch('/api/partners/notifications/read', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, body: JSON.stringify({ id })
          });
        } catch (e) {}
      },

      fetchAccounts: (userId) => once('accounts', async () => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return;

          const res = await fetch(`/api/accounts?userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (!isSame(data, get().accounts)) set({ accounts: data });
          }
        } catch (error) {
          console.error("Ошибка загрузки аккаунтов:", error);
        } finally {
          get().markLoaded('accounts');
        }
      }),

      globalSettings: EMPTY_GLOBAL_SETTINGS,
      
      fetchGlobalSettings: () => once('settings', async () => {
        try {
          const res = await fetch('/api/accounts/global/settings', { headers: { 'Authorization': `Bearer ${get().token}` } });
          if (res.ok) {
            const data = await res.json();
            const next = { signature: data.signature, watermark: data.watermark };
            if (!isSame(next, get().globalSettings)) set({ globalSettings: next });
          }
        } catch (error) {}
      }),

      addVkKomodGroup: async (url, title, profileId, avatarUrl) => {
        try {
          // 🟢 ИСПРАВЛЕНИЕ ДЛЯ МОБИЛОК: Жестко берем токен из памяти
          const authToken = localStorage.getItem('token') || get().token; 
          const res = await fetch('/api/accounts/vk/komod-add', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            // ДОБАВЛЕН ПАРАМЕТР post_images_as_grid: 1
            body: JSON.stringify({ url, title, profileId, avatarUrl, post_images_as_grid: 1 }) 
          });
          return await res.json();
        } catch (error) {
          return { success: false, error: 'Network error' };
        }
      },

      confirmVkKomod: async (hash) => {
        try {
          // 🟢 ИСПРАВЛЕНИЕ ДЛЯ МОБИЛОК
          const authToken = localStorage.getItem('token') || get().token;
          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/accounts/vk/komod-confirm`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hash })
          });
          const data = await res.json();
          return data.success ? { success: true, data } : { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка сети' };
        }
      },

      saveGlobalSettings: async (signature, watermarkData) => {
        try {
          const res = await fetch('/api/accounts/global/settings', {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, body: JSON.stringify({ signature, watermark: watermarkData })
          });
          if (res.ok) { get().fetchGlobalSettings(); return { success: true }; }
          return { success: false };
        } catch (error) { return { success: false }; }
      },

      removeAccount: async (accountId) => {
        // 1. ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ: Мгновенно убираем аккаунт с экрана
        set((state) => ({ accounts: state.accounts.filter(a => a.id !== accountId) }));

        try {
          const baseUrl = import.meta.env.VITE_API_URL || '';
          const res = await fetch(`${baseUrl}/api/accounts/${accountId}`, { 
            method: 'DELETE', 
            headers: { 'Authorization': `Bearer ${get().token}` } 
          });
          
          const data = await res.json();
          
          if (res.ok && data.success) {
            // 2. Фоново обновляем данные для синхронизации
            get().fetchAccounts(get().user.id);
            return { success: true };
          } else {
            // Если ошибка, возвращаем данные обратно
            get().fetchAccounts(get().user.id);
            return { success: false, error: data.error || 'Ошибка при удалении аккаунта' };
          }
        } catch (error) { 
          console.error('Сетевая ошибка при удалении:', error);
          get().fetchAccounts(get().user.id);
          return { success: false, error: 'Ошибка сети при удалении' }; 
        }
      },

      saveAccountDesign: async (accountId, signature, watermarkData) => {
        try {
          const res = await fetch(`/api/accounts/${accountId}/design`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, body: JSON.stringify({ signature, watermark: watermarkData })
          });
          if (res.ok) { get().fetchAccounts(get().user.id); return { success: true }; }
          const data = await res.json().catch(() => ({}));
          return { success: false, error: data.error || 'Ошибка при сохранении (возможно, файл слишком большой)' };
        } catch (error) { return { success: false, error: 'Сетевая ошибка при сохранении' }; }
      },

      syncVkKomod: async () => {
        try {
          // 🟢 ИСПРАВЛЕНИЕ ДЛЯ МОБИЛОК
          const authToken = localStorage.getItem('token') || get().token;
          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/accounts/vk/komod-sync`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          });
          const data = await res.json();
          if (data.success) {
            await get().fetchAccounts(get().user?.id);
            return { success: true, count: data.count }; 
          }
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка сети' };
        }
      },

      
      fetchKomodGroups: async (profileId) => {
        // 🟢 ИСПРАВЛЕНИЕ ДЛЯ МОБИЛОК
        const authToken = localStorage.getItem('token') || get().token;
        const res = await fetch(`/api/accounts/vk/komod-groups?profileId=${profileId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        return await res.json();
      },

     // ... предыдущий код стора

      uploadPostMedia: async (blob, filename) => {
        try {
          const state = get();
          const formData = new FormData();
          formData.append('media', blob, filename);
          const res = await fetch('/api/posts/upload-media', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.token}` },
            body: formData
          });
          const data = await res.json();
          if (!res.ok || !data.success || !data.mediaId) return { success: false, error: data.error || 'Не удалось загрузить фото' };
          return { success: true, mediaId: data.mediaId };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения при загрузке фото' };
        }
      },

      createPostAction: async (text, mediaIds, accountsData, publishAt, sharedPostId, requestKey) => {
        try {
          const state = get();
          
          // Создаем объект FormData для передачи файлов как бинарников
          const formData = new FormData();
          
          if (text) formData.append('text', text);
          if (publishAt) formData.append('publishAt', publishAt);
          if (sharedPostId) formData.append('sharedPostId', sharedPostId);
          // Поля идут до файлов: сервер должен увидеть метку запроса сразу.
          if (requestKey) formData.append('requestKey', requestKey);
          formData.append('mediaIds', JSON.stringify(mediaIds || []));
          
          // Аккаунты передаем как строку
          formData.append('accountsData', JSON.stringify(accountsData));

          const res = await fetch('/api/posts/create', {
              method: 'POST', 
              headers: { 
                  // ВАЖНО: Мы НЕ указываем 'Content-Type: application/json',
                  // браузер сам установит нужный boundary для FormData
                  'Authorization': `Bearer ${state.token}` 
              }, 
              body: formData
          });
        
          const data = await res.json();
          if (res.ok && data.success) {
            // Обновляем отложку, если это был запланированный пост
            if (publishAt) get().fetchScheduledPosts();
            return { success: true, posts: data.posts || [], estimatedSeconds: data.estimatedSeconds ?? null };
          }
          return { success: false, error: data.error || 'Ошибка при обработке сервером' };
        } catch (error) { 
          return { success: false, error: 'Ошибка соединения.' }; 
        }
      },
      // ... следующий код стора

      fetchSharedPosts: () => once('shared', async () => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return;
          const res = await fetch('/api/posts/shared', { headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            const current = get();
            const next = {};
            if (!isSame(data.incoming, current.sharedIncoming)) next.sharedIncoming = data.incoming;
            if (!isSame(data.outgoing, current.sharedOutgoing)) next.sharedOutgoing = data.outgoing;
            if (Object.keys(next).length > 0) set(next);
          }
        } catch (error) {
        } finally {
          get().markLoaded('shared');
        }
      }),

      

      // Отправка партнёрам без загрузки фото: сервер берёт фото, которые у него уже лежат.
      // source: { mediaIds } — фото, загруженные при создании поста, или { postId } — свой пост из истории.
      // Ответ с fallback: true значит «этот пост так отправить нельзя, используйте sharePostAction».
      sharePostByRef: async (text, source, partnerIds, requestKey) => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return { success: false, error: 'Войдите в аккаунт заново' };
          const res = await fetch('/api/posts/share', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text || '', partnerIds, requestKey, ...source })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            get().fetchSharedPosts();
            return { success: true, delivered: data.delivered || [], failed: data.failed || [], usedThumbnails: Boolean(data.usedThumbnails) };
          }
          return { success: false, error: data.error, fallback: Boolean(data.fallback) };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения' };
        }
      },

      // Партнёр берёт присланный пост в работу: сервер сам кладёт ему фото как уже загруженные.
      stageSharedPost: async (sharedPostId) => {
        try {
          const token = localStorage.getItem('token') || get().token;
          const res = await fetch(`/api/posts/shared/${encodeURIComponent(sharedPostId)}/stage`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.ok && data.success) return { success: true, photos: data.photos || [] };
          return { success: false, error: data.error, fallback: Boolean(data.fallback) };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения' };
        }
      },

      sharePostAction: async (text, mediaBlobs, partnerIds, requestKey) => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return;
          
          // ⚡ ИСПРАВЛЕНИЕ: Используем FormData для передачи файлов, а не JSON
          const formData = new FormData();
          
          if (text) formData.append('text', text);
          formData.append('partnerIds', JSON.stringify(partnerIds));
          if (requestKey) formData.append('requestKey', requestKey);
          
          if (mediaBlobs && mediaBlobs.length > 0) {
            mediaBlobs.forEach((blob, index) => {
              formData.append('media', blob, blobFileName(blob, index));
            });
          }

          const res = await fetch('/api/posts/share', {
            method: 'POST', 
            // ВАЖНО: Убираем 'Content-Type': 'application/json', браузер поставит его сам для FormData
            headers: { 'Authorization': `Bearer ${token}` }, 
            body: formData
          });
          
          const data = await res.json();
          if (res.ok && data.success) {
            get().fetchSharedPosts();
            return { success: true, delivered: data.delivered || [], failed: data.failed || [] };
          }
          return { success: false, error: data.error };
        } catch (error) { 
          return { success: false, error: 'Ошибка соединения' }; 
        }
      },

      verifyVkAccountsStatus: async () => {
        try {
          const user = get().user;
          if (!user?.id) return;
          const res = await fetch('/api/accounts/vk/verify-status', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, body: JSON.stringify({ userId: user.id })
          });
          // ДОБАВЛЕН await
          if (res.ok) await get().fetchAccounts(user.id); 
        } catch (error) {}
      },


      deleteSharedPostAction: async (id) => {
        try {
          const baseUrl = import.meta.env.VITE_API_URL || '';
          const res = await fetch(`${baseUrl}/api/posts/shared/${id}`, { 
            method: 'DELETE', 
            headers: { 'Authorization': `Bearer ${get().token}` } 
          });
          if (res.ok) get().fetchSharedPosts();
        } catch (error) {
          console.error("Ошибка при удалении поста:", error);
        }
      },
    
    }),


    

    {
      name: 'smmbox-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        watermarkSettings: state.watermarkSettings,
        globalSettings: state.globalSettings,
        presets: state.presets,
      }),
    }
  )
);
