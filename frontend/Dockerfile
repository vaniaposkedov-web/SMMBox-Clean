# Базовый образ Node.js (alpine - это супер-легкая версия Linux)
FROM node:18-alpine

# === ИСПРАВЛЕНИЕ: Устанавливаем шрифты с поддержкой кириллицы (от квадратиков) ===
RUN apk add --no-cache fontconfig ttf-dejavu ttf-freefont ttf-liberation

# Папка внутри контейнера, где будет лежать бэкенд
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем все библиотеки (включая Prisma)
RUN npm install

# Копируем весь остальной код бэкенда
COPY . .

# Генерируем клиент Prisma
RUN npx prisma generate

# Открываем порт 5000
EXPOSE 5000

# Команда запуска
CMD npx prisma db push && npm run start