const { Queue } = require('bullmq');

// Подключаемся к нашему Redis
const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).port : 6379,
};

// Создаем саму очередь с названием 'posts'
const postQueue = new Queue('posts_v2', { connection });

// Сколько постов воркер отправляет одновременно
// Пост в ВК почти всё время просто ждёт ответа Kom-OD (до 15 минут) и почти не грузит сервер,
// поэтому мест много: иначе пара постов на повторе у Kom-OD держит всю очередь. Задаётся в docker-compose.yml.
const WORKER_CONCURRENCY = Math.max(1, Number(process.env.WORKER_CONCURRENCY) || 2);

module.exports = { postQueue, connection, WORKER_CONCURRENCY };