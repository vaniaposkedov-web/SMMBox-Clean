const prisma = require('./prisma');

// Вход на сайт возможен только через VK ID: Telegram нельзя использовать для входа (часть 10 статьи 8 закона № 149-ФЗ).
// Смена профиля ВКонтакте закрывает все прежние входы в аккаунт, чтобы взломщик не остался внутри.
const unlinkVkLogin = (userId) => prisma.user.update({ where: { id: userId }, data: { vkId: null, tokenVersion: { increment: 1 } } });

// Telegram нужен только для подключения каналов через бота, поэтому вход на сайт не закрывается.
// Каналы остаются в аккаунте: публикация в них зависит от бота, а не от личного профиля.
// Удалить профиль сразу нельзя: каналы удалились бы вместе с ним, а с ними знаки и посты.
const unlinkTelegram = (userId) => prisma.$transaction(async (tx) => {
  const profiles = await tx.socialProfile.findMany({ where: { userId, provider: 'TELEGRAM' }, select: { id: true } });
  const profileIds = profiles.map((profile) => profile.id);
  await tx.account.updateMany({ where: { profileId: { in: profileIds } }, data: { profileId: null } });
  await tx.socialProfile.deleteMany({ where: { id: { in: profileIds } } });
  return tx.user.update({ where: { id: userId }, data: { telegramId: null, telegramBindCode: null, telegramBindExpires: null } });
});

module.exports = { unlinkVkLogin, unlinkTelegram };
