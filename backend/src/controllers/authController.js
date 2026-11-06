const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const prisma = require('../utils/prisma');
const {
  signUserToken,
  sanitizeUser,
  sha256,
  fetchVkIdUser,
} = require('../utils/security');
const { unlinkTelegram } = require('../utils/socialLogin');
const { LEGAL_VERSION, CONSENT_REQUIRED_ERROR, hasLegalConsent, consentRecords } = require('../utils/legal');
const { eraseUser } = require('../utils/accountErasure');

async function generateUniqueId() {
  for (;;) {
    const id = String(crypto.randomInt(10000000, 100000000));
    const duplicate = await prisma.user.findUnique({ where: { id } });
    if (!duplicate) return id;
  }
}

const createUserWithConsent = async (data) => {
  const id = await generateUniqueId();
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { ...data, id, legalVersion: LEGAL_VERSION, isOnboardingCompleted: true } });
    await tx.legalConsent.createMany({ data: consentRecords(id) });
    return user;
  });
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
      // Новый аккаунт создаётся только с согласия человека: возможно, у него уже есть аккаунт с другим профилем.
      if (!req.body.createAccount) return res.json({ requiresConfirmation: true });
      if (!hasLegalConsent(req.body)) return res.status(400).json({ error: CONSENT_REQUIRED_ERROR });
      isNewUser = true;
      user = await createUserWithConsent({
        vkId,
        name: [vkUser.first_name, vkUser.last_name].filter(Boolean).join(' ') || 'VK Юзер',
        avatarUrl: avatar,
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

// Привязка профиля ВКонтакте к аккаунту, в который человек уже вошёл, например по ссылке поддержки.
// Неудача отвечает кодом 400, а не 401: 401 означает, что истёк сам вход на сайт.
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

// Клиент отвязывает Telegram, через который подключает каналы. На вход на сайт это не влияет.
// ВКонтакте отвязать нельзя: это единственный способ входа, и аккаунт будет потерян.
exports.unlinkSocial = async (req, res) => {
  try {
    const { provider } = req.params;
    if (provider === 'vk') return res.status(400).json({ error: 'ВКонтакте — единственный способ входа. Чтобы сменить профиль, напишите в поддержку.' });
    if (provider !== 'telegram') return res.status(404).json({ error: 'Неизвестная соцсеть' });

    const profiles = await prisma.socialProfile.count({ where: { userId: req.userId, provider: 'TELEGRAM' } });
    if (profiles === 0) return res.status(400).json({ error: 'Telegram не привязан.' });

    const updated = await unlinkTelegram(req.userId);
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Ошибка отвязки Telegram:', error.message);
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

// Клиент, который ещё не принимал документы или должен принять их новую редакцию.
exports.acceptLegalDocuments = async (req, res) => {
  try {
    if (!hasLegalConsent(req.body)) return res.status(400).json({ error: CONSENT_REQUIRED_ERROR });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (user.legalVersion === LEGAL_VERSION) return res.json({ success: true, user: sanitizeUser(user) });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.legalConsent.createMany({ data: consentRecords(req.userId) });
      return tx.user.update({ where: { id: req.userId }, data: { legalVersion: LEGAL_VERSION } });
    });
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Ошибка принятия документов:', error.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Клиент удаляет аккаунт сам. Это же отзыв согласия на обработку персональных данных.
exports.deleteAccount = async (req, res) => {
  try {
    if (req.body.confirm !== true) return res.status(400).json({ error: 'Подтвердите удаление аккаунта.' });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
    if (user.role === 'ADMIN') return res.status(400).json({ error: 'Аккаунт администратора так удалить нельзя.' });

    await eraseUser(req.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления аккаунта:', error.message);
    res.status(500).json({ error: 'Не удалось удалить аккаунт. Попробуйте ещё раз или напишите в поддержку.' });
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
