import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set) => ({
      user: null,
      registeredUsers: [],
      accounts: [],
      posts: [],
      
      // === НОВОЕ: Настройки водяного знака по умолчанию ===
      watermarkSettings: {
        type: 'text',
        text: 'SMMBOX © 2024',
        image: null, // Здесь будет храниться URL картинки (base64 для локального теста)
        position: 'br',
        hasBackground: true,
        visualStyle: 'glass',
        fontFamily: 'font-sans',
        textColor: '#FFFFFF',
        bgColor: '#000000',
        size: 100,
        angle: 0,
        opacity: 90,
      },

      login: (email, password) => set((state) => {
        const found = state.registeredUsers.find(u => u.email === email && u.password === password);
        if (found) {
          return { user: found };
        }
        return { user: null };
      }),

      register: (email, password, name) => set((state) => {
        const exists = state.registeredUsers.find(u => u.email === email);
        if (exists) return state;
        const newUser = { id: Date.now().toString(), email, password, name };
        return {
          registeredUsers: [...state.registeredUsers, newUser],
          user: newUser
        };
      }),

      logout: () => set({ user: null }),

      // === НОВОЕ: Функция сохранения настроек ===
      setWatermarkSettings: (newSettings) => set((state) => ({
        watermarkSettings: { ...state.watermarkSettings, ...newSettings }
      })),

    }),
    {
      name: 'smmbox-storage',
    }
  )
);