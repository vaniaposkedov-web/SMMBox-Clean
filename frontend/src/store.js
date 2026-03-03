import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      // === СТЕЙТЫ ПОЛЬЗОВАТЕЛЯ ===
      user: null,
      token: null,
      accounts: [],
      posts: [],

      // === СТЕЙТЫ ПАРТНЕРОВ И УВЕДОМЛЕНИЙ ===
      myPartners: [],
      incomingRequests: [],
      notifications: [],
      
      // === НАСТРОЙКИ ВОДЯНОГО ЗНАКА ===
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

      // === СТЕЙТЫ ЧЕРНОВИКА ПУБЛИКАЦИИ ===
      publishDraft: {
        step: 1, 
        photos: [], 
        text: '',
        accountIds: [],
        isScheduled: false,
        publishDate: ''
      },

      updatePublishDraft: (data) => set((state) => ({
        publishDraft: { ...state.publishDraft, ...data }
      })),

      clearPublishDraft: () => set({
        publishDraft: { step: 1, photos: [], text: '', accountIds: [], isScheduled: false, publishDate: '' }
      }),

      setWatermarkSettings: (newSettings) => set((state) => ({
        watermarkSettings: { ...state.watermarkSettings, ...newSettings }
      })),

      // === ЛОГИКА АВТОРИЗАЦИИ ===
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
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения с сервером' };
        }
      },

      register: async (email, password, name, pavilion) => {
        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, pavilion })
          });
          const data = await res.json();
          if (res.ok) {
            set({ user: data.user, token: data.token });
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения с сервером' };
        }
      },


      // Запрос письма на почту
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

      // Установка нового пароля
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

      
      // НОВЫЙ МЕТОД ДЛЯ ОБНОВЛЕНИЯ ПРОФИЛЯ С КАРТИНКАМИ И ЗАЩИТОЙ
      updateUser: async (formData) => {
        try {
          const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
              // Передаем токен безопасности на сервер!
              'Authorization': `Bearer ${get().token}`
            },
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

      logout: () => set({ 
        user: null, 
        token: null,
        myPartners: [],
        incomingRequests: [],
        notifications: [],
        publishDraft: { step: 1, photos: [], text: '', accountIds: [], isScheduled: false, publishDate: '' }
      }),

      // === ЛОГИКА ПАРТНЕРОВ ===
      fetchPartnerData: async (userId) => {
        try {
          const res = await fetch(`/api/partners/data?userId=${userId}`);
          if (res.ok) {
            const data = await res.json();
            set({ myPartners: data.partners, incomingRequests: data.incomingRequests, notifications: data.notifications });
          }
        } catch (error) {
          console.error('Ошибка загрузки данных партнеров');
        }
      },

      searchUsersFromApi: async (query, userId) => {
        try {
          const res = await fetch(`/api/partners/search?query=${encodeURIComponent(query)}&userId=${userId}`);
          if (res.ok) return await res.json();
          return [];
        } catch (error) {
          return [];
        }
      },

      sendPartnershipRequest: async (requesterId, receiverId) => {
        await fetch('/api/partners/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requesterId, receiverId })
        });
        get().fetchPartnerData(requesterId);
      },

      acceptPartnership: async (partnershipId) => {
        await fetch('/api/partners/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partnershipId })
        });
        get().fetchPartnerData(get().user.id);
      },

      removePartnerAction: async (currentUserId, partnerId) => {
        await fetch('/api/partners/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentUserId, partnerId })
        });
        get().fetchPartnerData(currentUserId);
      },

      clearNotifications: async (userId) => {
        await fetch('/api/partners/notifications/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        set({ notifications: [] });
      },

      // === ЛОГИКА АККАУНТОВ ===
      fetchAccounts: async (userId) => {
        try {
          const res = await fetch(`/api/accounts?userId=${userId}`);
          if (res.ok) {
            const data = await res.json();
            set({ accounts: data });
          }
        } catch (error) {
          console.error('Ошибка загрузки аккаунтов');
        }
      },

      addMockAccount: async (userId, name, provider) => {
        try {
          const res = await fetch('/api/accounts/mock-add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, name, provider })
          });
          if (res.ok) get().fetchAccounts(userId);
        } catch (error) {}
      },

      removeAccount: async (accountId) => {
        try {
          await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
          get().fetchAccounts(get().user.id);
        } catch (error) {}
      },

      saveAccountDesign: async (accountId, signature, watermarkData) => {
        try {
          const res = await fetch(`/api/accounts/${accountId}/design`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signature, watermark: watermarkData })
          });
          if (res.ok) {
            get().fetchAccounts(get().user.id);
            return { success: true };
          }
          return { success: false };
        } catch (error) {
          return { success: false };
        }
      },

      // === ЛОГИКА ПУБЛИКАЦИИ ПОСТОВ ===
      createPostAction: async (text, mediaUrls, accountIds, publishAt) => {
        try {
          const res = await fetch('/api/posts/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, mediaUrls, accountIds, publishAt })
          });
          if (res.ok) return { success: true };
          return { success: false, error: 'Ошибка при публикации' };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения с сервером' };
        }
      }

    }),
    {
      name: 'smmbox-storage',
    }
  )
);