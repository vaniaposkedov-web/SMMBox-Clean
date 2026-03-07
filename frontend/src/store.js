import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      accounts: [],
      posts: [],
      myPartners: [],
      incomingRequests: [],
      outgoingRequests: [],
      notifications: [],
      
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

      login: async (email, password) => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (res.ok) {
            set({ user: data.user, token: data.token });
            localStorage.setItem('token', data.token);
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения с сервером' };
        }
      },

      register: async (email, password, name, phone) => {
        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, phone })
          });
          const data = await res.json();
          if (res.ok) return { success: true };
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения с сервером' };
        }
      },

      // === МЕТОД ВК ПРИНИМАЕТ ГОТОВЫЙ ТОКЕН ===
      vkLogin: async (vkData) => {
        try {
          const res = await fetch('/api/auth/vk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vkData),
          });
          const data = await res.json();
          
          if (!res.ok) return { success: false, error: data.error };
          if (data.requiresEmailVerification) return { success: true, requiresEmailVerification: true, userId: data.userId };
          
          set({ user: data.user, token: data.token });
          localStorage.setItem('token', data.token);
          return { success: true };
        } catch (error) {
          return { success: false, error: 'Ошибка сети при входе через ВК' };
        }
      },

      telegramLogin: async (telegramData) => {
        try {
          const res = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(telegramData)
          });
          const data = await res.json();
          if (res.ok) {
            set({ user: data.user, token: data.token });
            localStorage.setItem('token', data.token); // <--- ДОБАВИЛИ ЭТУ СТРОКУ
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка сервера' };
        }
      },

      requestEmailLink: async (userId, email) => {
        try {
          const res = await fetch('/api/auth/request-link-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, email }),
          });
          const data = await res.json();
          if (!res.ok) return { success: false, error: data.error };
          return { success: true };
        } catch (error) {
          return { success: false, error: 'Ошибка сети' };
        }
      },

      saveTgAccounts: async (userId, channels) => {
        try {
          const res = await fetch('/api/accounts/tg/save', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify({ userId, channels })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            get().fetchAccounts(userId);
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка сети' };
        }
      },

      verifyAccountsStatus: async () => {
        try {
          const user = get().user;
          if (!user?.id) return; // Защита от пустого стейта

          const res = await fetch('/api/accounts/tg/verify-status', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify({ userId: user.id }) // Явно передаем ID!
          });
          
          if (res.ok) {
            get().fetchAccounts(user.id); 
          }
        } catch (error) {
          console.error('Ошибка верификации аккаунтов:', error);
        }
      },

      verifyEmailLink: async (userId, email, code, phone) => { // <-- Добавили phone сюда
        try {
          const res = await fetch('/api/auth/verify-link-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, email, code, phone }), // <-- Отправляем phone на сервер
          });
          const data = await res.json();
          if (!res.ok) return { success: false, error: data.error };
          return { success: true };
        } catch (error) {
          return { success: false, error: 'Ошибка сети' };
        }
      },

      forgotPasswordAction: async (email) => {
        try {
          const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
          const data = await res.json();
          if (res.ok) return { success: true };
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения' };
        }
      },

      resetPasswordAction: async (token, newPassword) => {
        try {
          const res = await fetch(`/api/auth/reset-password/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: newPassword })
          });
          const data = await res.json();
          if (res.ok) return { success: true };
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения' };
        }
      },

      updateUser: async (formData) => {
        try {
          const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${get().token}` },
            body: formData
          });
          const data = await res.json();
          if (data.success) {
            set({ user: { ...get().user, ...data.user } });
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка сети' };
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ 
          user: null, token: null, myPartners: [], incomingRequests: [], notifications: [],
          publishDraft: { step: 1, photos: [], text: '', accountIds: [], isScheduled: false, publishDate: '' }
        });
      },

      fetchPartnerData: async (userId) => {
        try {
          const res = await fetch(`/api/partners/data?userId=${userId}`);
          if (res.ok) {
            const data = await res.json();
            set({ 
              myPartners: data.partners, 
              incomingRequests: data.incomingRequests, 
              outgoingRequests: data.outgoingRequests, // <--- Сохраняем
              notifications: data.notifications 
            });
          }
        } catch (error) {}
      },

      searchUsersFromApi: async (query, userId) => {
        try {
          const res = await fetch(`/api/partners/search?query=${encodeURIComponent(query)}&userId=${userId}`);
          if (res.ok) return await res.json();
          return [];
        } catch (error) { return []; }
      },

      // ДОБАВИТЬ В store.js
      saveVkAccounts: async (userId, accessToken, selectedGroups) => {
        try {
          const res = await fetch('/api/accounts/vk/save', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify({ userId, accessToken, groups: selectedGroups })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            get().fetchAccounts(userId);
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения с сервером' };
        }
      },

      sendPartnershipRequest: async (requesterId, receiverId) => {
        await fetch('/api/partners/request', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requesterId, receiverId })
        });
        get().fetchPartnerData(requesterId); // Обновляем данные
      },

      acceptPartnership: async (partnershipId) => {
        await fetch('/api/partners/accept', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partnershipId })
        });
        get().fetchPartnerData(get().user.id);
      },

      // НОВЫЙ МЕТОД: Отклонить заявку
      declinePartnership: async (partnershipId) => {
        await fetch('/api/partners/decline', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partnershipId })
        });
        get().fetchPartnerData(get().user.id);
      },

      removePartnerAction: async (currentUserId, partnerId) => {
        await fetch('/api/partners/remove', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentUserId, partnerId })
        });
        get().fetchPartnerData(currentUserId);
      },

      clearNotifications: async (userId) => {
        await fetch('/api/partners/notifications/clear', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId })
        });
        get().fetchPartnerData(userId); // Перезапрашиваем данные
      },

      fetchAccounts: async (userId) => {
        try {
          const res = await fetch(`/api/accounts?userId=${userId}`);
          if (res.ok) {
            const data = await res.json();
            set({ accounts: data });
          }
        } catch (error) {}
      },

      // Глобальные настройки
      globalSettings: { signature: '', watermark: null },
      
      fetchGlobalSettings: async () => {
        try {
          const res = await fetch('/api/accounts/global/settings', {
            headers: { 'Authorization': `Bearer ${get().token}` }
          });
          if (res.ok) {
            const data = await res.json();
            set({ globalSettings: { signature: data.signature, watermark: data.watermark } });
          }
        } catch (error) { console.error('Ошибка загрузки настроек', error); }
      },

      saveGlobalSettings: async (signature, watermarkData) => {
        try {
          const res = await fetch('/api/accounts/global/settings', {
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` }, 
            body: JSON.stringify({ signature, watermark: watermarkData })
          });
          if (res.ok) {
            get().fetchGlobalSettings();
            return { success: true };
          }
          return { success: false };
        } catch (error) { return { success: false }; }
      },

      addMockAccount: async (userId, name, provider) => {
        try {
          const res = await fetch('/api/accounts/mock-add', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, name, provider })
          });
          if (res.ok) get().fetchAccounts(userId);
        } catch (error) {}
      },

      removeAccount: async (accountId) => {
        try {
          const res = await fetch(`/api/accounts/${accountId}`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${get().token}` } // Обязательно передаем токен!
          });
          
          if (res.ok) {
            get().fetchAccounts(get().user.id); // Обновляем список после удаления
          }
        } catch (error) {
          console.error('Ошибка при удалении аккаунта', error);
        }
      },

      saveAccountDesign: async (accountId, signature, watermarkData) => {
        try {
          const res = await fetch(`/api/accounts/${accountId}/design`, {
            method: 'PUT', 
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}` // <--- Вот этот токен починил сохранение
            }, 
            body: JSON.stringify({ signature, watermark: watermarkData })
          });
          if (res.ok) {
            get().fetchAccounts(get().user.id);
            return { success: true };
          }
          return { success: false };
        } catch (error) { return { success: false }; }
      },

      createPostAction: async (text, mediaUrls, accountIds, publishAt) => {
        try {
          const res = await fetch('/api/posts/create', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, mediaUrls, accountIds, publishAt })
          });
          if (res.ok) return { success: true };
          return { success: false, error: 'Ошибка при публикации' };
        } catch (error) { return { success: false, error: 'Ошибка соединения с сервером' }; }
      }

    }),
    {
      name: 'smmbox-storage',
    }
  )
);