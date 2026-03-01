import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      // Таблица всех зарегистрированных пользователей в нашей локальной БД
      registeredUsers: [],

      // Текущий авторизованный пользователь (сессия)
      user: null, 

      // 1. ФУНКЦИЯ РЕГИСТРАЦИИ
      register: (email, password, name) => {
        const { registeredUsers } = get();
        
        // Проверяем, нет ли уже такого email в базе
        const userExists = registeredUsers.find(u => u.email === email);
        if (userExists) {
          throw new Error('Пользователь с таким email уже существует. Пожалуйста, войдите.');
        }

        // Создаем нового пользователя
        const newUser = { id: Date.now(), email, password, name };
        
        // Сохраняем его в базу и сразу авторизуем
        set({ 
          registeredUsers: [...registeredUsers, newUser],
          user: { id: newUser.id, email: newUser.email, name: newUser.name } 
        });
      },

      // 2. ФУНКЦИЯ ВХОДА (ЛОГИН)
      login: (email, password) => {
        const { registeredUsers } = get();
        
        // Ищем пользователя по email
        const foundUser = registeredUsers.find(u => u.email === email);
        
        if (!foundUser) {
          throw new Error('Пользователь не найден. Пожалуйста, перейдите к регистрации.');
        }
        
        // Сверяем пароль
        if (foundUser.password !== password) {
          throw new Error('Неверный пароль. Попробуйте снова.');
        }

        // Если всё ок - пускаем в систему
        set({ user: { id: foundUser.id, email: foundUser.email, name: foundUser.name } });
      },

      // Выход из аккаунта
      logout: () => set({ user: null }),

      // 3. Аккаунты ВК (теперь привязываются к конкретному юзеру)
      accounts: [],
      addAccount: (account) => set((state) => ({ 
        accounts: [...state.accounts, { ...account, userId: state.user.id }] 
      })),
      removeAccount: (id) => set((state) => ({ 
        accounts: state.accounts.filter(acc => acc.id !== id) 
      })),

      // 4. Посты
      posts: [],
      addPost: (post) => set((state) => ({ 
        posts: [...state.posts, { ...post, userId: state.user.id }] 
      })),
    }),
    {
      name: 'smmbox-local-db',
      storage: createJSONStorage(() => localStorage),
    }
  )
);