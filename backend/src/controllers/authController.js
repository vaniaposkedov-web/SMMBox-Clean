const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const prisma = require('../utils/prisma');
const sendEmail = require('../utils/sendEmail');
const { passwordResetTemplate } = require('../utils/emailTemplates');
const {
  signUserToken,
  sanitizeUser,
  generateVerificationCode,
  sha256,
  safeEqual,
  verifyTelegramLogin,
  fetchVkIdUser,
  getBotToken,
  telegramFileToDataUri,
} = require('../utils/security');

const CODE_LIFETIME_MS = 15 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const codeExpiry = () => new Date(Date.now() + CODE_LIFETIME_MS);
const isCodeFresh = (user) => !user.emailVerificationExpires || new Date(user.emailVerificationExpires) > new Date();

const verificationLetter = (code) => `
  <div style="font-family: sans-serif; max-width: 400px;">
    <h2 style="color: #111;">Добро пожаловать в SADOVODPS!</h2>
    <p style="color: #666;">Введите этот код на сайте для подтверждения почты:</p>
    <div style="background: #f4f7ff; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
      <b style="font-size: 32px; color: #0077FF; letter-spacing: 5px;">${code}</b>
    </div>
    <p style="font-size: 12px; color: #999;">Код действует 15 минут. Если это были не вы, просто проигнорируйте письмо.</p>
  </div>
`;

async function generateUniqueId() {
  for (;;) {
    const id = String(crypto.randomInt(10000000, 100000000));
    const duplicate = await prisma.user.findUnique({ where: { id } });
    if (!duplicate) return id;
  }
}

exports.register = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password, name, phone } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов` });
    }

    if (phone) {
      const phoneOwner = await prisma.user.findUnique({ where: { phone } });
      if (phoneOwner && phoneOwner.email !== email) {
        return res.status(400).json({ error: 'Этот номер телефона уже привязан к другому аккаунту' });
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    const code = generateVerificationCode();

    if (existingUser) {
      if (existingUser.isEmailVerified) {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }
      // The password stays as it was: otherwise someone else could replace it before the owner confirms the email.
      await prisma.user.update({
        where: { email },
        data: { emailVerificationCode: code, emailVerificationExpires: codeExpiry() },
      });
    } else {
      await prisma.user.create({
        data: {
          id: await generateUniqueId(),
          email,
          password: await bcrypt.hash(password, 10),
          name: name || '',
          phone: phone || null,
          emailVerificationCode: code,
          emailVerificationExpires: codeExpiry(),
          isEmailVerified: false,
          isOnboardingCompleted: true,
        },
      });
    }

    const sent = await sendEmail(email, 'Подтверждение регистрации', verificationLetter(code));
    if (!sent) {
      return res.status(502).json({ error: 'Не удалось отправить письмо с кодом. Попробуйте позже.' });
    }

    res.json({ success: true, message: 'Код подтверждения отправлен на вашу почту' });
  } catch (error) {
    console.error('Ошибка регистрации:', error.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

exports.login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Введите email и пароль' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return res.status(400).json({ error: 'Неверный email или пароль' });

    const isMatch = await bcrypt.compare(String(password), user.password);
    if (!isMatch) return res.status(400).json({ error: 'Неверный email или пароль' });

    if (user.isEmailVerified === false) {
      const code = generateVerificationCode();
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationCode: code, emailVerificationExpires: codeExpiry() },
      });
      await sendEmail(email, 'Подтверждение входа', verificationLetter(code));
      return res.status(400).json({ error: 'EMAIL_NOT_VERIFIED' });
    }

    res.json({ success: true, token: signUserToken(user), user: sanitizeUser(user) });
  } catch (error) {
    console.error('Ошибка входа:', error.message);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
};

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
      // Новый аккаунт создаётся только с согласия человека: возможно, он уже регистрировался по почте.
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
          isEmailVerified: true,
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
      // Новый аккаунт создаётся только с согласия человека: возможно, он уже регистрировался по почте.
      if (!req.body.createAccount) return res.json({ requiresConfirmation: true });
      isNewUser = true;
      const email = normalizeEmail(vkUser.email) || null;
      // An account with this email is never joined automatically: its owner links VK from the profile.
      const emailTaken = email ? await prisma.user.findUnique({ where: { email } }) : null;
      user = await prisma.user.create({
        data: {
          id: await generateUniqueId(),
          vkId,
          email: emailTaken ? null : email,
          name: [vkUser.first_name, vkUser.last_name].filter(Boolean).join(' ') || 'VK Юзер',
          avatarUrl: avatar,
          isOnboardingCompleted: true,
          isEmailVerified: Boolean(email && !emailTaken),
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

exports.getTgChatInfo = async (req, res) => {
  try {
    const { channel } = req.body;
    if (!channel) return res.status(400).json({ error: 'Укажите ссылку на канал' });

    let channelName = String(channel).replace('https://t.me/', '').replace('t.me/', '').replace('@', '').split('/')[0].split('?')[0].trim();
    if (!channelName.startsWith('-100')) channelName = '@' + channelName;

    const botToken = getBotToken();
    const tgRes = await axios.get(`https://api.telegram.org/bot${botToken}/getChat`, { params: { chat_id: channelName } });
    const chat = tgRes.data.result;

    let avatar = null;
    if (chat.photo?.small_file_id) {
      avatar = await telegramFileToDataUri(botToken, chat.photo.small_file_id).catch(() => null);
    }
    res.json({ success: true, chatId: String(chat.id), title: chat.title, username: chat.username ? `@${chat.username}` : '', avatar });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Бот не админ или канал неверен' });
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

exports.requestLinkEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Укажите настоящий адрес почты' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== req.userId) return res.status(400).json({ error: 'Эта почта уже используется другим аккаунтом' });

    const code = generateVerificationCode();
    // The code is tied to this address, so it cannot confirm a different one.
    await prisma.user.update({
      where: { id: req.userId },
      data: { emailVerificationCode: `link:${email}:${code}`, emailVerificationExpires: codeExpiry() },
    });

    const sent = await sendEmail(email, 'Подтверждение почты SADOVODPS', verificationLetter(code));
    if (!sent) return res.status(502).json({ error: 'Не удалось отправить письмо с кодом. Попробуйте позже.' });

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка привязки почты:', error.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

exports.verifyLinkEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { code, phone } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !isCodeFresh(user) || !user.emailVerificationCode || !safeEqual(user.emailVerificationCode, `link:${email}:${code}`)) {
      return res.status(400).json({ error: 'Неверный или просроченный код' });
    }
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        email,
        ...(phone ? { phone } : {}),
        isEmailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null,
      },
    });
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Этот email или телефон уже используется' });
    console.error('Ошибка подтверждения почты:', error.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email и код обязательны' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.emailVerificationCode || !isCodeFresh(user) || !safeEqual(user.emailVerificationCode, code)) {
      return res.status(400).json({ error: 'Неверный или просроченный код подтверждения' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, emailVerificationCode: null, emailVerificationExpires: null },
    });

    res.json({ success: true, token: signUserToken(updatedUser), user: sanitizeUser(updatedUser) });
  } catch (error) {
    console.error('Ошибка проверки кода:', error.message);
    res.status(500).json({ error: 'Ошибка сервера при проверке кода' });
  }
};

// The answer is the same whether the email exists or not, so the form cannot be used to look up users.
exports.forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { email },
        data: { resetPasswordToken: sha256(token), resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const base = process.env.FRONTEND_URL || 'https://sadovodps24.ru';
      await sendEmail(email, 'Восстановление пароля', passwordResetTemplate(`${base}/reset-password/${token}`));
    }
    res.json({ success: true, message: 'Если такой адрес зарегистрирован, письмо уже отправлено' });
  } catch (error) {
    console.error('Ошибка восстановления пароля:', error.message);
    res.status(500).json({ error: 'Ошибка' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов` });
    }
    const user = await prisma.user.findFirst({ where: { resetPasswordToken: sha256(token), resetPasswordExpires: { gt: new Date() } } });
    if (!user) return res.status(400).json({ error: 'Ссылка недействительна' });

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(String(password), 10), resetPasswordToken: null, resetPasswordExpires: null },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка сброса пароля:', error.message);
    res.status(500).json({ error: 'Ошибка' });
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

exports.completeOnboarding = async (req, res) => {
  try {
    await prisma.user.update({ where: { id: req.userId }, data: { isOnboardingCompleted: true } });
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка завершения Onboarding:', error.message);
    res.status(500).json({ error: 'Ошибка сервера при завершении Onboarding' });
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
