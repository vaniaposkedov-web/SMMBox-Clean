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
      }, // <--- ВОТ ЗДЕСЬ НЕ ХВАТАЛО ЗАКРЫВАЮЩЕЙ СКОБКИ!

      // === СТЕЙТЫ ЧЕРНОВИКА ПУБЛИКАЦИИ ===
      publishDraft: {
        step: 1, // Текущий шаг (1, 2, 3 или 4-Успех)
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

      // === ЛОГИКА АВТОРИЗАЦИИ (БЭКЕНД) ===
      
      login: async (email, password) => {
        try {
          const res = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          
          if (res.ok) {
            set({ user: data.user, token: data.token });
            return { success: true };
          } else {
            return { success: false, error: data.error };
          }
        } catch (error) {
          return { success: false, error: 'Ошибка соединения с сервером' };
        }
      },

      register: async (email, password, name, pavilion) => {
        try {
          const res = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, pavilion })
          });
          const data = await res.json();
          
          if (res.ok) {
            set({ user: data.user, token: data.token });
            return { success: true };
          } else {
            return { success: false, error: data.error };
          }
        } catch (error) {
          return { success: false, error: 'Ошибка соединения с сервером' };
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

      // === ЛОГИКА ПАРТНЕРОВ (БЭКЕНД) ===
      
      // 1. Загрузка всех данных при входе
      fetchPartnerData: async (userId) => {
        try {
          const res = await fetch(`http://localhost:5000/api/partners/data?userId=${userId}`);
          if (res.ok) {
            const data = await res.json();
            set({ 
              myPartners: data.partners, 
              incomingRequests: data.incomingRequests, 
              notifications: data.notifications 
            });
          }
        } catch (error) {
          console.error('Ошибка загрузки данных партнеров');
        }
      },

      // 2. Поиск на сервере
      searchUsersFromApi: async (query, userId) => {
        try {
          const safeQuery = encodeURIComponent(query);
          const res = await fetch(`http://localhost:5000/api/partners/search?query=${safeQuery}&userId=${userId}`);
          
          if (res.ok) {
            return await res.json();
          }
          return [];
        } catch (error) {
          console.error('Ошибка при поиске:', error);
          return [];
        }
      },

      // 3. Отправка заявки
      sendPartnershipRequest: async (requesterId, receiverId) => {
        await fetch('http://localhost:5000/api/partners/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requesterId, receiverId })
        });
        get().fetchPartnerData(requesterId);
      },

      // 4. Принятие заявки
      acceptPartnership: async (partnershipId) => {
        await fetch('http://localhost:5000/api/partners/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partnershipId })
        });
        get().fetchPartnerData(get().user.id);
      },

      // 5. Удаление партнера
      removePartnerAction: async (currentUserId, partnerId) => {
        await fetch('http://localhost:5000/api/partners/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentUserId, partnerId })
        });
        get().fetchPartnerData(currentUserId);
      },

      // 6. Очистка уведомлений
      clearNotifications: async (userId) => {
        await fetch('http://localhost:5000/api/partners/notifications/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        set({ notifications: [] });
      },

      // === ЛОГИКА АККАУНТОВ ===
      fetchAccounts: async (userId) => {
        try {
          const res = await fetch(`http://localhost:5000/api/accounts?userId=${userId}`);
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
          const res = await fetch('http://localhost:5000/api/accounts/mock-add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, name, provider })
          });
          if (res.ok) {
            get().fetchAccounts(userId); // Перезапрашиваем список
          }
        } catch (error) {
          console.error('Ошибка добавления аккаунта');
        }
      },

      removeAccount: async (accountId) => {
        try {
          await fetch(`http://localhost:5000/api/accounts/${accountId}`, { method: 'DELETE' });
          get().fetchAccounts(get().user.id);
        } catch (error) {
          console.error('Ошибка удаления');
        }
      },

      // === НОВАЯ ФУНКЦИЯ: Отправка дизайна на сервер ===
      saveAccountDesign: async (accountId, signature, watermarkData) => {
        try {
          const res = await fetch(`http://localhost:5000/api/accounts/${accountId}/design`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signature, watermark: watermarkData })
          });
          
          if (res.ok) {
            get().fetchAccounts(get().user.id); // Перезагружаем аккаунты, чтобы красная плашка пропала
            return { success: true };
          }
          return { success: false };
        } catch (error) {
          console.error('Ошибка сохранения дизайна');
          return { success: false };
        }
      },

      // === ЛОГИКА ПУБЛИКАЦИИ ПОСТОВ ===
      createPostAction: async (text, mediaUrls, accountIds, publishAt) => {
        try {
          const res = await fetch('http://localhost:5000/api/posts/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, mediaUrls, accountIds, publishAt })
          });
          
          if (res.ok) {
            return { success: true };
          }
          return { success: false, error: 'Ошибка при публикации' };
        } catch (error) {
          console.error('Ошибка сети при публикации');
          return { success: false, error: 'Ошибка соединения с сервером' };
        }
      }

    }),
    {
      name: 'smmbox-storage',
    }
  )
);