# Этап 1: Сборка React (Vite)
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Собираем продакшен-версию сайта (появится папка dist)
RUN npm run build

# Этап 2: Раздача собранного сайта через Nginx
FROM nginx:alpine
# Копируем собранный сайт из Этапа 1
COPY --from=build /app/dist /usr/share/nginx/html
# Копируем наши настройки Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]