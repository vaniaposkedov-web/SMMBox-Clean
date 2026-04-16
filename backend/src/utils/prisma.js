const { PrismaClient } = require('@prisma/client');

// Используем глобальный объект, чтобы в режиме разработки (nodemon) 
// не плодить тысячи подключений при каждом сохранении файла.
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
  // Опционально: можно раскомментировать для отладки медленных запросов
  // log: ['query', 'warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

module.exports = prisma;