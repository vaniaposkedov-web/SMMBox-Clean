# Базовый образ Node.js (alpine - это супер-легкая версия Linux)
FROM node:18-alpine

# Папка внутри контейнера, где будет лежать бэкенд
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем все библиотеки (включая Prisma)
RUN npm install

# Копируем весь остальной код бэкенда
COPY . .

# Генерируем клиент Prisma (чтобы он знал про нашу новую PostgreSQL)
RUN npx prisma generate

# Открываем порт 5000
EXPOSE 5000

# Команда запуска: сначала накатываем структуру БД, затем запускаем чистый сервер
CMD npx prisma db push && npm run start