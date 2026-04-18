const { Queue } = require('bullmq');

// Подключаемся к нашему Redis
const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).port : 6379,
};

// Создаем саму очередь с названием 'posts'
const postQueue = new Queue('posts', { connection });

module.exports = { postQueue, connection };