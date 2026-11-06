// Создаёт администратора или выдаёт права существующему пользователю. Без этого на пустой базе в админку не войти.
//
// На сервере:
//   docker compose exec backend node scripts/make-admin.js почта@example.com
// Если пароль администратора забыт:
//   docker compose exec backend node scripts/make-admin.js почта@example.com --new-password
require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../src/utils/prisma');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const newPassword = () => crypto.randomBytes(18).toString('base64url');

async function uniqueId() {
  for (;;) {
    const id = String(crypto.randomInt(10000000, 100000000));
    if (!(await prisma.user.findUnique({ where: { id } }))) return id;
  }
}

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  const wantsNewPassword = process.argv.includes('--new-password');

  if (!EMAIL_PATTERN.test(email)) {
    console.error('Укажите почту администратора: node scripts/make-admin.js почта@example.com');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const password = !user || !user.password || wantsNewPassword ? newPassword() : null;
  const passwordData = password ? { password: await bcrypt.hash(password, 10) } : {};

  if (user) {
    // При смене пароля закрываются все прежние входы администратора.
    const closeSessions = wantsNewPassword ? { tokenVersion: { increment: 1 } } : {};
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN', isEmailVerified: true, ...passwordData, ...closeSessions } });
    console.log(user.role === 'ADMIN' ? `${email} уже администратор.` : `${email} теперь администратор.`);
  } else {
    await prisma.user.create({
      data: {
        id: await uniqueId(),
        email,
        name: 'Администратор',
        role: 'ADMIN',
        isEmailVerified: true,
        isOnboardingCompleted: true,
        ...passwordData,
      },
    });
    console.log(`Администратор ${email} создан.`);
  }

  if (password) {
    console.log(`Пароль: ${password}`);
    console.log('Сохраните его сейчас: он показывается один раз.');
  } else {
    console.log('Пароль не менялся.');
  }
  console.log(`Вход в админку: ${process.env.FRONTEND_URL || 'адрес сайта'}/boss-login`);
}

main()
  .catch((error) => {
    console.error('Не удалось выполнить:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
