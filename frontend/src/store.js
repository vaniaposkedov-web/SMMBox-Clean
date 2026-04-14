import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

      watermarkSettings: {
        type: 'text',
        text: 'SMMBOX © 2024',
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

      publishDraft: {
        step: 1, 
        photos: [], 
        text: '',
        accountIds: [],
        isScheduled: false,
        publishDate: ''
      },

      tempDraft: null,
      saveTempDraft: (data) => set({ tempDraft: data }),

      presets: [
        { id: 'default', name: 'Стандартный', watermark: true, signature: true },
        { id: 'minimal', name: 'Минимализм', watermark: false, signature: false }
      ],

      updatePublishDraft: (data) => set((state) => ({
        publishDraft: { ...state.publishDraft, ...data }
      })),

      clearPublishDraft: () => set({
        publishDraft: { step: 1, photos: [], text: '', accountIds: [], isScheduled: false, publishDate: '' }
      }),

      setWatermarkSettings: (newSettings) => set((state) => ({
        watermarkSettings: { ...state.watermarkSettings, ...newSettings }
      })),

      
      fetchProfiles: async (userId) => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return;
          
          const res = await fetch(`/api/accounts/profiles?userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) set({ profiles: data.profiles });
          }
        } catch (error) {
          console.error("Ошибка загрузки профилей:", error);
        }
      },


      // === ФУНКЦИЯ УДАЛЕНИЯ ПРОФИЛЯ ===
      removeSocialProfile: async (profileId) => {
        try {
          const { token, fetchProfiles, fetchAccounts, user } = get();
          
          const response = await fetch(`/api/accounts/profiles/${profileId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          const data = await response.json();

          if (data.success) {
            // Мгновенно убираем профиль и его аккаунты с экрана
            set((state) => ({
              profiles: state.profiles.filter(p => p.id !== profileId),
              accounts: state.accounts.filter(a => a.socialProfileId !== profileId)
            }));
            
            // Обновляем данные с сервера для надежности
            await fetchProfiles(user.id);
            await fetchAccounts(user.id);
            
            return { success: true };
          } else {
            throw new Error(data.error || 'Ошибка при удалении профиля');
          }
        } catch (error) {
          console.error('Ошибка removeSocialProfile:', error);
          alert('Не удалось отключить профиль: ' + error.message);
          return { success: false, error: error.message };
        }
      },

      

      linkSocialProfile: async (userId, provider, providerAccountId, name, avatarUrl, accessToken) => {
        try {
          const res = await fetch('/api/accounts/profiles/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` },
            body: JSON.stringify({ userId, provider, providerAccountId, name, avatarUrl, accessToken })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            get().fetchProfiles(userId);
            return { success: true, profile: data.profile };
          }
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения с сервером' };
        }
      },

      fetchPostsHistory: async () => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token) return;

          const res = await fetch('/api/posts/history', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.ok) {
            const data = await res.json();
            set({ postsHistory: data.posts || [] });
          }
        } catch (error) {
          console.error("Ошибка загрузки истории:", error);
        }
      },

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

      
      fetchScheduledPosts: async () => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return;
          const res = await fetch('/api/posts/scheduled', { headers: { 'Authorization': `Bearer ${token}` } });
          if (!res.ok) return;
          const data = await res.json(); 
          set({ scheduledPosts: data.posts || data.scheduledPosts || [] }); 
        } catch (error) {}
      },

      deleteScheduledPostAction: async (id) => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return;
          const res = await fetch(`/api/posts/scheduled/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) get().fetchScheduledPosts();
        } catch (error) {}
      },

      scanTelegramChannels: async (botToken) => {
        try {
          const res = await fetch('/api/accounts/tg/scan', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, body: JSON.stringify({ botToken })
          });
          const data = await res.json();
          if (res.ok && data.success) return { success: true, channels: data.channels };
          return { success: false, error: data.error || 'Ошибка сканирования' };
        } catch (error) { return { success: false, error: 'Ошибка соединения' }; }
      },

      login: async (email, password) => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (res.ok) {
            set({ user: data.user, token: data.token });
            localStorage.setItem('token', data.token);
            get().fetchProfiles(data.user.id);
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) { return { success: false, error: 'Ошибка сервера' }; }
      },

      register: async (email, password, name, phone) => {
        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name, phone })
          });
          const data = await res.json();
          if (res.ok) return { success: true };
          return { success: false, error: data.error };
        } catch (error) { return { success: false, error: 'Ошибка сервера' }; }
      },

      vkLogin: async (vkData) => {
        try {
          const res = await fetch('/api/auth/vk', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vkData),
          });
          const data = await res.json();
          if (!res.ok) return { success: false, error: data.error };
          if (data.requiresEmailVerification) return { success: true, requiresEmailVerification: true, userId: data.userId };
          set({ user: data.user, token: data.token });
          localStorage.setItem('token', data.token);
          get().fetchProfiles(data.user.id);
          return { success: true };
        } catch (error) { return { success: false, error: 'Ошибка сети' }; }
      },

      telegramLogin: async (telegramData) => {
        try {
          const res = await fetch('/api/auth/telegram', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(telegramData)
          });
          const data = await res.json();
          if (res.ok) {
            set({ user: data.user, token: data.token });
            localStorage.setItem('token', data.token);
            
            // ВАЖНО: Добавь эту строку, чтобы профиль сразу появился на странице!
            get().fetchProfiles(data.user.id);
            
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) { return { success: false, error: 'Ошибка сервера' }; }
      },

      requestEmailLink: async (userId, email) => {
        try {
          const res = await fetch('/api/auth/request-link-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, email }),
          });
          const data = await res.json();
          if (!res.ok) return { success: false, error: data.error };
          return { success: true };
        } catch (error) { return { success: false, error: 'Ошибка сети' }; }
      },

      saveTgAccounts: async (userId, channels) => {
        try {
          const res = await fetch('/api/accounts/tg/save', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, body: JSON.stringify({ userId, channels })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            get().fetchAccounts(userId);
            get().fetchProfiles(userId);
            return { success: true };
          }
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

      verifyEmailLink: async (userId, email, code, phone) => { 
        try {
          const res = await fetch('/api/auth/verify-link-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, email, code, phone }), 
          });
          const data = await res.json();
          if (!res.ok) return { success: false, error: data.error };
          return { success: true };
        } catch (error) { return { success: false, error: 'Ошибка сети' }; }
      },

      forgotPasswordAction: async (email) => {
        try {
          const res = await fetch('/api/auth/forgot-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
          });
          const data = await res.json();
          if (res.ok) return { success: true };
          return { success: false, error: data.error };
        } catch (error) { return { success: false, error: 'Ошибка соединения' }; }
      },

      resetPasswordAction: async (token, newPassword) => {
        try {
          const res = await fetch(`/api/auth/reset-password/${token}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: newPassword })
          });
          const data = await res.json();
          if (res.ok) return { success: true };
          return { success: false, error: data.error };
        } catch (error) { return { success: false, error: 'Ошибка соединения' }; }
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
        set({ 
          user: null, token: null, accounts: [], profiles: [], myPartners: [], incomingRequests: [], notifications: [], sharedIncoming: [], sharedOutgoing: [],
          publishDraft: { step: 1, photos: [], text: '', accountIds: [], isScheduled: false, publishDate: '' }
        });
      },

      completeOnboarding: async () => {
        try {
          const res = await fetch('/api/auth/complete-onboarding', {
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${get().token}` }
          });
          if (res.ok) {
            // Обновляем статус пользователя в стейте, чтобы пропустить Onboarding
            set({ user: { ...get().user, isOnboardingCompleted: true } });
            return { success: true };
          }
          return { success: false };
        } catch (error) {
          console.error("Ошибка завершения Onboarding:", error);
          return { success: false };
        }
      },

      fetchPartnerData: async (userId) => {
        try {
          const res = await fetch(`/api/partners/data?userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${get().token}` }
          });
          if (res.ok) {
            const data = await res.json();
            set({ myPartners: data.partners, incomingRequests: data.incomingRequests, outgoingRequests: data.outgoingRequests, notifications: data.notifications });
          }
        } catch (error) {}
      },

      searchUsersFromApi: async (query, userId) => {
        try {
          const res = await fetch(`/api/partners/search?query=${encodeURIComponent(query)}&userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${get().token}` }
          });
          if (res.ok) return await res.json();
          return [];
        } catch (error) { return []; }
      },

      saveVkAccounts: async (userId, accessToken, selectedGroups) => {
        try {
          const res = await fetch('/api/accounts/vk/save', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, body: JSON.stringify({ userId, accessToken, groups: selectedGroups })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            get().fetchAccounts(userId);
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) { return { success: false, error: 'Ошибка сервера' }; }
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

      clearNotifications: async (userId) => {
        try {
          const res = await fetch('/api/partners/notifications/clear', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, 
            body: JSON.stringify({ userId }) 
          });
          if (res.ok) {
            get().fetchPartnerData(userId);
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

      markSharedPostAsRead: async (id) => {
        // Мгновенно убираем индикатор в интерфейсе
        set((state) => ({ sharedIncoming: state.sharedIncoming.map(p => p.id === id ? { ...p, isRead: true } : p) }));
        // Тихо отправляем запрос на сервер
        try {
          await fetch('/api/posts/shared/read', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, body: JSON.stringify({ id })
          });
        } catch (e) {}
      },

      fetchAccounts: async (userId) => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return;

          const res = await fetch(`/api/accounts?userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            set({ accounts: data });
          }
        } catch (error) {
          console.error("Ошибка загрузки аккаунтов:", error);
        }
      },

      globalSettings: { signature: '', watermark: null },
      
      fetchGlobalSettings: async () => {
        try {
          const res = await fetch('/api/accounts/global/settings', { headers: { 'Authorization': `Bearer ${get().token}` } });
          if (res.ok) {
            const data = await res.json();
            set({ globalSettings: { signature: data.signature, watermark: data.watermark } });
          }
        } catch (error) {}
      },

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
            body: JSON.stringify({ url, title, profileId, avatarUrl })
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
          return data.success ? { success: true } : { success: false, error: data.error };
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
        try {
          const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${get().token}` } });
          if (res.ok) get().fetchAccounts(get().user.id);
        } catch (error) {}
      },

      saveAccountDesign: async (accountId, signature, watermarkData) => {
        try {
          const res = await fetch(`/api/accounts/${accountId}/design`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, body: JSON.stringify({ signature, watermark: watermarkData })
          });
          if (res.ok) { get().fetchAccounts(get().user.id); return { success: true }; }
          return { success: false };
        } catch (error) { return { success: false }; }
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

      createPostAction: async (text, mediaBlobs, accountsData, publishAt) => {
        try {
          const state = get();
          
          // Создаем объект FormData для передачи файлов как бинарников
          const formData = new FormData();
          
          if (text) formData.append('text', text);
          if (publishAt) formData.append('publishAt', publishAt);
          
          // Аккаунты передаем как строку
          formData.append('accountsData', JSON.stringify(accountsData));

          // Добавляем бинарные файлы
          if (mediaBlobs && mediaBlobs.length > 0) {
            mediaBlobs.forEach((blob, index) => {
              formData.append('media', blob, `image_${index}.webp`);
            });
          }

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
            return { success: true };
          }
          return { success: false, error: data.error || 'Ошибка при обработке сервером' };
        } catch (error) { 
          return { success: false, error: 'Ошибка соединения.' }; 
        }
      },
      // ... следующий код стора

      fetchSharedPosts: async () => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return;
          const res = await fetch('/api/posts/shared', { headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            set({ sharedIncoming: data.incoming, sharedOutgoing: data.outgoing });
          }
        } catch (error) {}
      },

      

      sharePostAction: async (text, mediaUrls, partnerIds) => {
        try {
          const token = localStorage.getItem('token') || get().token;
          if (!token || token === 'null') return;
          const res = await fetch('/api/posts/share', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ text, mediaUrls, partnerIds })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            get().fetchSharedPosts();
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) { return { success: false, error: 'Ошибка соединения' }; }
      },

      saveVkGroupWithToken: async (userId, groupLink, accessToken) => {
        try {
          const res = await fetch('/api/accounts/vk/save-by-token', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, body: JSON.stringify({ userId, groupLink, accessToken })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            get().fetchAccounts(userId); 
            return { success: true, group: data.group };
          }
          return { success: false, error: data.error };
        } catch (error) { return { success: false, error: 'Ошибка соединения' }; }
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


      fetchVkManagedGroupsClient: async (profileId) => {
        return new Promise((resolve) => {
          try {
            const state = get();
            const profile = state.profiles.find(p => p.id === profileId);

            if (!profile || !profile.accessToken) {
              return resolve({ success: false, error: 'Профиль ВК не найден или нет токена' });
            }

            // Генерируем уникальное имя callback-функции
            const callbackName = 'vkCallback_' + Math.round(100000 * Math.random());

            // Создаем глобальную функцию
            window[callbackName] = function(data) {
              delete window[callbackName];
              document.body.removeChild(script);

              if (data.error) {
                return resolve({ success: false, error: `Ошибка VK: ${data.error.error_msg}` });
              }
              const groups = data.response ? data.response.items : [];
              resolve({ success: true, groups });
            };

            // Создаем скрипт для JSONP запроса
            const script = document.createElement('script');
            script.src = `https://api.vk.com/method/groups.get?extended=1&filter=admin,editor&access_token=${profile.accessToken}&v=5.199&callback=${callbackName}`;
            
            script.onerror = () => {
              delete window[callbackName];
              document.body.removeChild(script);
              resolve({ success: false, error: 'Ошибка сети при обращении к ВКонтакте' });
            };

            document.body.appendChild(script);
          } catch (error) {
            resolve({ success: false, error: 'Внутренняя ошибка при загрузке групп' });
          }
        });
      },


      markSharedPostPublishedAction: async (id) => {
        try {
          const baseUrl = import.meta.env.VITE_API_URL || '';
          const res = await fetch(`${baseUrl}/api/posts/shared/${id}/publish`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${get().token}` }
          });
          if (res.ok) {
            get().fetchSharedPosts(); 
            return { success: true };
          }
          return { success: false };
        } catch (error) { 
          return { success: false }; 
        }
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