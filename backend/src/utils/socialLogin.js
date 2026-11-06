const prisma = require('./prisma');

const SOCIAL_LOGIN_FIELDS = { telegram: 'telegramId', vk: 'vkId' };

// Отвязывает вход через соцсеть и закрывает все прежние входы в аккаунт: взломщик не останется внутри.
// Каналы остаются в аккаунте: публикация в них зависит от бота, а не от личного профиля.
// Удалить профиль Telegram сразу нельзя: каналы удалились бы вместе с ним, а с ними знаки и посты.
const unlinkSocialLogin = (userId, provider) => prisma.$transaction(async (tx) => {
  const data = { [SOCIAL_LOGIN_FIELDS[provider]]: null, tokenVersion: { increment: 1 } };

  if (provider === 'telegram') {
    const profiles = await tx.socialProfile.findMany({ where: { userId, provider: 'TELEGRAM' }, select: { id: true } });
    const profileIds = profiles.map((profile) => profile.id);
    await tx.account.updateMany({ where: { profileId: { in: profileIds } }, data: { profileId: null } });
    await tx.socialProfile.deleteMany({ where: { id: { in: profileIds } } });
    data.telegramBindCode = null;
    data.telegramBindExpires = null;
  }

  return tx.user.update({ where: { id: userId }, data });
});

module.exports = { SOCIAL_LOGIN_FIELDS, unlinkSocialLogin };
