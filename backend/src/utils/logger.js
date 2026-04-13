const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.logEvent = async (userId, level, module, message, details = null) => {
  try {
    await prisma.systemLog.create({
      data: {
        userId: userId ? String(userId) : null,
        level,
        module,
        message,
        details: typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)
      }
    });
  } catch (err) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА: Не удалось записать лог в БД', err);
  }
};