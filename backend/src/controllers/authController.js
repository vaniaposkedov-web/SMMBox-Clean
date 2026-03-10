const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

exports.register = async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Пользователь с таким email уже существует' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // Генерируем код

    await prisma.user.create({
      data: { email, password: hashedPassword, name: name || '', phone: phone || null, emailVerificationCode: verificationCode, isEmailVerified: false }
    });
    
    // ОТПРАВКА КОДА НА ПОЧТУ
    try {
      await sendEmail(email, 'Подтверждение регистрации', `Ваш код подтверждения: ${verificationCode}`);
    } catch (e) {
      console.error('Ошибка отправки email:', e);
    }

    res.json({ success: true, message: 'Код подтверждения отправлен на почту' });
  } catch (error) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Введите email и пароль' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return res.status(400).json({ error: 'Неверный email или пароль' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Неверный email или пароль' });

    // ЕСЛИ ПОЧТА НЕ ПОДТВЕРЖДЕНА - отправляем новый код и просим ввести
    if (user.isEmailVerified === false) {
       const newCode = Math.floor(100000 + Math.random() * 900000).toString();
       await prisma.user.update({ where: { id: user.id }, data: { emailVerificationCode: newCode } });
       
       try {
         await sendEmail(email, 'Подтверждение входа', `Ваш новый код подтверждения: ${newCode}`);
       } catch (e) { console.error('Ошибка отправки email:', e); }

       return res.status(400).json({ error: 'EMAIL_NOT_VERIFIED' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ success: true, token, user });
  } catch (error) { res.status(500).json({ error: 'Ошибка сервера при входе' }); }
};

exports.telegramAuth = async (req, res) => {
  try {
    const { id, first_name, last_name, username, photo_url } = req.body;
    if (!id) return res.status(400).json({ error: 'Нет данных Telegram' });

    let user = await prisma.user.findUnique({ where: { telegramId: String(id) } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const fullName = [first_name, last_name].filter(Boolean).join(' ') || username || 'TG Юзер';
      user = await prisma.user.create({
        data: { telegramId: String(id), name: fullName, avatarUrl: photo_url || null, isOnboardingCompleted: false, isEmailVerified: true }
      });
      await prisma.socialProfile.create({
        data: { userId: user.id, provider: 'TELEGRAM', providerAccountId: String(id), name: fullName, avatarUrl: photo_url || null, accessToken: '' }
      });
    } else {
       // Обновляем аватарку, если юзер поменял её в телеграме
       if (photo_url && !user.avatarUrl) {
          await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: photo_url } });
       }
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ success: true, token, user, isNewUser });
  } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
};

exports.vkAuth = async (req, res) => {
  try {
    const vkIdStr = req.body.id || req.body.user_id;
    const access_token = req.body.access_token;
    const email = req.body.email; // ВК иногда отдает email
    let first_name = req.body.first_name || '';
    let last_name = req.body.last_name || '';
    let photo_100 = req.body.photo_100 || null;

    if (!vkIdStr) return res.status(400).json({ error: 'Нет данных VK' });

    let user = await prisma.user.findUnique({ where: { vkId: String(vkIdStr) } });
    let isNewUser = false;

    if (!user) {
      // --- УМНАЯ СКЛЕЙКА (MERGE) ПО EMAIL ---
      // Если ВК вернул email, ищем, нет ли уже такого пользователя в базе
      if (email) {
        user = await prisma.user.findUnique({ where: { email: email } });
      }

      if (user) {
        // СКЛЕЙКА: Аккаунт с такой почтой уже есть. Привязываем к нему ВК!
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            vkId: String(vkIdStr),
            avatarUrl: user.avatarUrl || photo_100 // Ставим аватарку, если её не было
          }
        });
      } else {
        // СОЗДАНИЕ: Создаем полностью нового пользователя
        isNewUser = true;
        const fullName = [first_name, last_name].filter(Boolean).join(' ') || 'VK Юзер';
        user = await prisma.user.create({
          data: {
            vkId: String(vkIdStr),
            email: email || null,
            name: fullName,
            avatarUrl: photo_100,
            isOnboardingCompleted: false,
            isEmailVerified: !!email // Если ВК дал почту, она 100% подтверждена
          }
        });
      }

      // Создаем SocialProfile для ВК в любом случае (склейка или новый)
      await prisma.socialProfile.create({
        data: {
          userId: user.id,
          provider: 'VK',
          providerAccountId: String(vkIdStr),
          name: [first_name, last_name].filter(Boolean).join(' ') || 'VK Юзер',
          avatarUrl: photo_100,
          accessToken: access_token || ''
        }
      });

    } else {
      // Пользователь уже привязан к ВК. Просто обновляем его токен и аватарку
      await prisma.socialProfile.updateMany({
        where: { userId: user.id, provider: 'VK' },
        data: { accessToken: access_token, avatarUrl: photo_100 }
      });
      if (!user.avatarUrl && photo_100) {
        await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: photo_100 } });
      }
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ success: true, token, user, isNewUser });
  } catch (error) {
    console.error('Ошибка в vkAuth:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

exports.getTgChatInfo = async (req, res) => {
  try {
    const { channel } = req.body;
    if (!channel) return res.status(400).json({ error: 'Укажите ссылку на канал' });

    let channelName = channel.replace('https://t.me/', '').replace('t.me/', '').replace('@', '').split('/')[0].split('?')[0].trim();
    if (!channelName.startsWith('@') && !channelName.startsWith('-100')) channelName = '@' + channelName;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgRes = await axios.get(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${channelName}`);
    const chat = tgRes.data.result;

    let avatarUrl = null;
    if (chat.photo?.small_file_id) {
        const fileRes = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${chat.photo.small_file_id}`);
        avatarUrl = `https://api.telegram.org/file/bot${botToken}/${fileRes.data.result.file_path}`;
    }
    res.json({ success: true, chatId: String(chat.id), title: chat.title, username: chat.username ? `@${chat.username}` : '', avatar: avatarUrl });
  } catch (error) { res.status(400).json({ success: false, error: 'Бот не админ или канал неверен' }); }
};

exports.completeOnboarding = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await prisma.user.update({ where: { id: String(userId) }, data: { isOnboardingCompleted: true } });
    res.json({ success: true, user });
  } catch (error) { res.status(500).json({ error: 'Ошибка завершения' }); }
};

exports.requestLinkEmail = async (req, res) => {
  try {
    const { userId, email } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== String(userId)) return res.status(400).json({ error: 'Email занят' });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.user.update({ where: { id: String(userId) }, data: { emailVerificationCode: code } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
};

exports.verifyLinkEmail = async (req, res) => {
  try {
    const { userId, email, code, phone } = req.body;
    const user = await prisma.user.findUnique({ where: { id: String(userId) } });
    if (user.emailVerificationCode !== code) return res.status(400).json({ error: 'Неверный код' });
    const updated = await prisma.user.update({
      where: { id: String(userId) }, data: { email, phone, isEmailVerified: true, emailVerificationCode: null }
    });
    res.json({ success: true, user: updated });
  } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email и код обязательны' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

    if (user.emailVerificationCode !== code) return res.status(400).json({ error: 'Неверный код подтверждения' });

    // Код верный! Подтверждаем почту
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, emailVerificationCode: null }
    });

    // Сразу авторизуем пользователя после успешного ввода кода
    const token = jwt.sign({ userId: updatedUser.id, role: updatedUser.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ success: true, token, user: updatedUser });
  } catch (error) { 
    res.status(500).json({ error: 'Ошибка сервера при проверке кода' }); 
  }
};
exports.linkEmailAndSendCode = async (req, res) => { exports.requestLinkEmail(req, res); };

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Не найден' });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({ where: { email }, data: { resetPasswordToken: token, resetPasswordExpires: new Date(Date.now() + 3600000) } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Ошибка' }); }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    const user = await prisma.user.findFirst({ where: { resetPasswordToken: token, resetPasswordExpires: { gt: new Date() } } });
    if (!user) return res.status(400).json({ error: 'Ссылка недействительна' });

    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hash, resetPasswordToken: null, resetPasswordExpires: null } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Ошибка' }); }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.body.userId;
    const { name, pavilion, phone } = req.body;
    let avatarUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const data = { name, pavilion, phone };
    if (avatarUrl) data.avatarUrl = avatarUrl;
    
    const updated = await prisma.user.update({ where: { id: String(userId) }, data });
    res.json({ success: true, user: updated });
  } catch (error) { res.status(500).json({ error: 'Ошибка обновления' }); }
};