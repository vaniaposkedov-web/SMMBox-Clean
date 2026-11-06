const { Queue } = require('bullmq');

// Подключаемся к нашему Redis
const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).port : 6379,
};

// Создаем саму очередь с названием 'posts'
const postQueue = new Queue('posts_v2', { connection });

// Сколько постов воркер отправляет одновременно
const WORKER_CONCURRENCY = 2;

module.exports = { postQueue, connection, WORKER_CONCURRENCY };