const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const prisma = require('../utils/prisma');
const {
  signUserToken,
  sanitizeUser,
  sha256,
  verifyTelegramLogin,
  fetchVkIdUser,
  getBotToken,
} = require('../utils/security');
const { SOCIAL_LOGIN_FIELDS, unlinkSocialLogin } = require('../utils/socialLogin');

async function generateUniqueId() {
  for (;;) {
    const id = String(crypto.randomInt(10000000, 100000000));
    const duplicate = await prisma.user.findUnique({ where: { id } });
    if (!duplicate) return id;
  }
}

exports.telegramAuth = async (req, res) => {
  try {
    // createAccount добавляет сайт, в подписи Telegram этого поля нет.
    const { createAccount, ...telegramData } = req.body;
    if (!verifyTelegramLogin(telegramData, getBotToken())) {
      return res.status(401).json({ error: 'Не удалось подтвердить вход через Telegram' });
    }
    const { id, first_name, last_name, username, photo_url } = telegramData;

    let user = await prisma.user.findUnique({ where: { telegramId: String(id) } });
    let isNewUser = false;

    if (!user) {
      // Новый аккаунт создаётся только с согласия человека: возможно, у него уже есть аккаунт с другой соцсетью.
      if (!createAccount) return res.json({ requiresConfirmation: true });
      isNewUser = true;
      const fullName = [first_name, last_name].filter(Boolean).join(' ') || username || 'TG Юзер';
      user = await prisma.user.create({
        data: {
          id: await generateUniqueId(),
          telegramId: String(id),
          name: fullName,
          avatarUrl: photo_url || null,
          isOnboardingCompleted: true,
        },
      });
      await prisma.socialProfile.upsert({
        where: { provider_providerAccountId: { provider: 'TELEGRAM', providerAccountId: String(id) } },
        update: {},
        create: { userId: user.id, provider: 'TELEGRAM', providerAccountId: String(id), name: fullName, avatarUrl: photo_url || null, accessToken: '' },
      });
    } else if (photo_url && !user.avatarUrl) {
      user = await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: photo_url } });
    }

    res.json({ success: true, token: signUserToken(user), user: sanitizeUser(user), isNewUser });
  } catch (error) {
    console.error('Ошибка входа через Telegram:', error.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

exports.vkAuth = async (req, res) => {
  try {
    const vkUser = await fetchVkIdUser(req.body.access_token);
    if (!vkUser) return res.status(401).json({ error: 'Не удалось подтвердить вход через ВКонтакте' });

    const vkId = String(vkUser.user_id);
    const avatar = vkUser.avatar || null;
    let user = await prisma.user.findUnique({ where: { vkId } });
    let isNewUser = false;

    if (!user) {
      // Новый аккаунт создаётся только с согласия человека: возможно, у него уже есть аккаунт с другой соцсетью.
      if (!req.body.createAccount) return res.json({ requiresConfirmation: true });
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          id: await generateUniqueId(),
          vkId,
          name: [vkUser.first_name, vkUser.last_name].filter(Boolean).join(' ') || 'VK Юзер',
          avatarUrl: avatar,
          isOnboardingCompleted: true,
        },
      });
    } else if (avatar && !user.avatarUrl) {
      user = await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: avatar } });
    }

    res.json({ success: true, token: signUserToken(user), user: sanitizeUser(user), isNewUser });
  } catch (error) {
    console.error('Ошибка входа через VK:', error.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Привязка входа через соцсеть к аккаунту, в который человек уже вошёл.
// Неудача отвечает кодом 400, а не 401: 401 означает, что истёк сам вход на сайт.
exports.linkTelegramLogin = async (req, res) => {
  try {
    if (!verifyTelegramLogin(req.body, getBotToken())) {
      return res.status(400).json({ error: 'Не удалось подтвердить Telegram. Попробуйте ещё раз.' });
    }
    const telegramId = String(req.body.id);
    const owner = await prisma.user.findUnique({ where: { telegramId } });
    if (owner && owner.id !== req.userId) {
      return res.status(409).json({ error: 'Этот Telegram уже привязан к другому аккаунту на сайте.' });
    }
    const current = await prisma.user.findUnique({ where: { id: req.userId } });
    if (current.telegramId && current.telegramId !== telegramId) {
      return res.status(409).json({ error: 'К вашему аккаунту уже привязан другой Telegram.' });
    }
    const name = [req.body.first_name, req.body.last_name].filter(Boolean).join(' ') || req.body.username || 'Telegram';
    const photo = req.body.photo_url || null;
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { telegramId, ...(photo && !current.avatarUrl ? { avatarUrl: photo } : {}) },
    });
    await prisma.socialProfile.upsert({
      where: { provider_providerAccountId: { provider: 'TELEGRAM', providerAccountId: telegramId } },
      update: {},
      create: { userId: req.userId, provider: 'TELEGRAM', providerAccountId: telegramId, name, avatarUrl: photo, accessToken: '' },
    });
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Этот Telegram уже привязан к другому аккаунту на сайте.' });
    console.error('Ошибка привязки Telegram:', error.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

exports.linkVkLogin = async (req, res) => {
  try {
    const vkUser = await fetchVkIdUser(req.body.access_token);
    if (!vkUser) return res.status(400).json({ error: 'Не удалось подтвердить ВКонтакте. Попробуйте ещё раз.' });

    const vkId = String(vkUser.user_id);
    const owner = await prisma.user.findUnique({ where: { vkId } });
    if (owner && owner.id !== req.userId) {
      return res.status(409).json({ error: 'Этот профиль ВКонтакте уже привязан к другому аккаунту на сайте.' });
    }
    const current = await prisma.user.findUnique({ where: { id: req.userId } });
    if (current.vkId && current.vkId !== vkId) {
      return res.status(409).json({ error: 'К вашему аккаунту уже привязан другой профиль ВКонтакте.' });
    }
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { vkId, ...(vkUser.avatar && !current.avatarUrl ? { avatarUrl: vkUser.avatar } : {}) },
    });
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Этот профиль ВКонтакте уже привязан к другому аккаунту на сайте.' });
    console.error('Ошибка привязки ВКонтакте:', error.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Клиент сам отвязывает соцсеть. Последний способ входа отвязать нельзя, иначе аккаунт будет потерян.
exports.unlinkSocial = async (req, res) => {
  try {
    const { provider } = req.params;
    const field = SOCIAL_LOGIN_FIELDS[provider];
    if (!field) return res.status(404).json({ error: 'Неизвестная соцсеть' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user[field]) return res.status(400).json({ error: 'Эта соцсеть не привязана.' });
    if (!Object.values(SOCIAL_LOGIN_FIELDS).some((other) => other !== field && user[other])) {
      return res.status(400).json({ error: 'Это единственный способ входа. Сначала привяжите вторую соцсеть.' });
    }

    const updated = await unlinkSocialLogin(req.userId, provider);
    // Все прежние входы закрыты, поэтому этот браузер получает новый.
    res.json({ success: true, token: signUserToken(updated), user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Ошибка отвязки соцсети:', error.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Вход по одноразовой ссылке, которую выдаёт поддержка клиенту, потерявшему доступ к соцсетям.
// Код хранится в полях сброса пароля: паролей у клиентов больше нет, а удалять поля из базы небезопасно.
exports.recoverAccess = async (req, res) => {
  const refuse = () => res.status(400).json({ error: 'Ссылка устарела или уже использована. Попросите новую у поддержки.' });
  try {
    const hash = sha256(String(req.body.code || ''));
    const user = await prisma.user.findFirst({ where: { resetPasswordToken: hash, resetPasswordExpires: { gt: new Date() } }, select: { id: true } });
    if (!user) return refuse();

    const { count } = await prisma.user.updateMany({
      where: { id: user.id, resetPasswordToken: hash },
      data: { resetPasswordToken: null, resetPasswordExpires: null, tokenVersion: { increment: 1 } },
    });
    if (count === 0) return refuse();

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    res.json({ success: true, token: signUserToken(updated), user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Ошибка входа по ссылке поддержки:', error.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, pavilion, phone } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (pavilion !== undefined) data.pavilion = pavilion;
    if (phone !== undefined) data.phone = phone;

    if (req.file) {
      const uploadsDir = path.join(__dirname, '../../uploads/profiles');
      fs.mkdirSync(uploadsDir, { recursive: true });
      const fileName = `avatar_${userId}_${Date.now()}.jpg`;
      try {
        await sharp(req.file.path)
          .resize({ width: 400, height: 400, fit: 'cover' })
          .jpeg({ quality: 85 })
          .toFile(path.join(uploadsDir, fileName));
        data.avatarUrl = `/api/uploads/profiles/${fileName}`;
      } catch (imgErr) {
        console.error('Ошибка обработки аватарки:', imgErr.message);
        return res.status(400).json({ success: false, error: 'Не удалось обработать изображение' });
      } finally {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
    }

    const updated = await prisma.user.update({ where: { id: userId }, data });
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Ошибка обновления профиля:', error.message);
    if (error.code === 'P2002' && error.meta?.target?.includes('phone')) {
      return res.status(400).json({ success: false, error: 'Этот номер телефона уже используется другим пользователем!' });
    }
    res.status(500).json({ success: false, error: 'Ошибка сохранения данных' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};
