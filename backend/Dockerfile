# Используем полноценную (но облегченную) версию Debian, а не Alpine
FROM node:18-slim

# Устанавливаем системные пакеты и нормальные шрифты с поддержкой русского языка
RUN apt-get update && apt-get install -y \
    fontconfig \
    fonts-dejavu \
    fonts-liberation \
    fonts-noto \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Принудительно обновляем системный кэш шрифтов
RUN fc-cache -f -v

# Папка внутри контейнера
WORKDIR /app

# Копируем зависимости
COPY package*.json ./

# Устанавливаем библиотеки
RUN npm install

# Копируем весь остальной код
COPY . .

# Генерируем клиент Prisma
RUN npx prisma generate

EXPOSE 5000

# Запуск сервера
CMD npx prisma db push && npm run start