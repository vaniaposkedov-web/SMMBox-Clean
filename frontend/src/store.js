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

      // ==========================================
      // === ЛОГИКА АВТОРИЗАЦИИ (ОБНОВЛЕННАЯ) ===
      // ==========================================
      
      login: async (email, password) => {
        try {
          // Обратите внимание: я поменял URL на ваш полный http://localhost:5000/api... 
          // чтобы не было проблем с CORS, как в старом коде
          const res = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (res.ok) {
            set({ user: data.user, token: data.token });
            localStorage.setItem('token', data.token); // Добавили сохранение токена
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения с сервером' };
        }
      },

      // ОБНОВЛЕННАЯ РЕГИСТРАЦИЯ (заменили pavilion на phone, убрали токен)
      register: async (email, password, name, phone) => {
        try {
          const res = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, phone })
          });
          const data = await res.json();
          
          if (res.ok) {
            // Теперь мы не устанавливаем токен сразу, так как ждем ввод 6-значного кода!
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (error) {
          return { success: false, error: 'Ошибка соединения с сервером' };
        }
      },

      // === НОВЫЕ МЕТОДЫ ДЛЯ СОЦСЕТЕЙ ===

      vkLogin: async (code, redirectUri) => {
        try {
          const res = await fetch('http://localhost:5000/api/auth/vk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirectUri }),
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

      telegramLogin: async (userData) => {
        try {
          const res = await fetch('http://localhost:5000/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
          });
          const data = await res.json();
          
          if (!res.ok) return { success: false, error: data.error };
          if (data.requiresEmailVerification) return { success: true, requiresEmailVerification: true, userId: data.userId };
          
          set({ user: data.user, token: data.token });
          localStorage.setItem('token', data.token);
          return { success: true };
        } catch (error) {
          return { success: false, error: 'Ошибка сети при входе через Telegram' };
        }
      },

      linkEmail: async (userId, email) => {
        try {
          const res = await fetch('http://localhost:5000/api/auth/link-email', {
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
      // ==========================================

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

      updateUser: async (formData) => {
        try {
          const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
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

      logout: () => {
        localStorage.removeItem('token'); // Очищаем локальное хранилище
        set({ 
          user: null, 
          token: null,
          myPartners: [],
          incomingRequests: [],
          notifications: [],
          publishDraft: { step: 1, photos: [], text: '', accountIds: [], isScheduled: false, publishDate: '' }
        });
      },

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