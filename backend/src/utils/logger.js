const cron = require('node-cron');
const prisma = require('./prisma');

// Срок указан в политике обработки персональных данных. Если он меняется, поменяйте его и там.
const LOG_RETENTION_DAYS = 90;
const CONSENT_RETENTION_DAYS = 3 * 365;

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

exports.cleanupOldLogs = async () => {
  const where = { createdAt: { lt: new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000) } };
  await prisma.systemLog.deleteMany({ where });
  await prisma.aiLog.deleteMany({ where });

  // После удаления аккаунта записи о согласии хранятся три года. Пока аккаунт существует, они не удаляются.
  const withdrawn = await prisma.legalConsent.findMany({
    where: { action: 'WITHDRAWN', createdAt: { lt: new Date(Date.now() - CONSENT_RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
    select: { userId: true },
  });
  await prisma.legalConsent.deleteMany({ where: { userId: { in: withdrawn.map((record) => record.userId) } } });
};

exports.initLogCleanup = () => {
  cron.schedule('30 3 * * *', () => {
    exports.cleanupOldLogs().catch((error) => console.error('[CRON] Ошибка очистки журналов', error.message));
  });
};
