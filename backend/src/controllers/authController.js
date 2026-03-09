const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const crypto = require('crypto');

exports.register = async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Пользователь с таким email уже существует' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.user.create({
      data: { email, password: hashedPassword, name: name || '', phone: phone || null, emailVerificationCode: verificationCode, isEmailVerified: false }
    });
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

    if (user.isEmailVerified === false) {
       const newCode = Math.floor(100000 + Math.random() * 900000).toString();
       await prisma.user.update({ where: { id: user.id }, data: { emailVerificationCode: newCode } });
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
      user = await prisma.user.create({
        data: { telegramId: String(id), name: [first_name, last_name].filter(Boolean).join(' ') || username || 'TG Юзер', avatarUrl: photo_url || null, isOnboardingCompleted: false }
      });
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ success: true, token, user, isNewUser });
  } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
};

exports.vkAuth = async (req, res) => {
  try {
    const { id, first_name, last_name, photo_100 } = req.body;
    if (!id) return res.status(400).json({ error: 'Нет данных VK' });

    let user = await prisma.user.findUnique({ where: { vkId: String(id) } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: { vkId: String(id), name: [first_name, last_name].filter(Boolean).join(' ') || 'VK Юзер', avatarUrl: photo_100 || null, isOnboardingCompleted: false }
      });
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ success: true, token, user, isNewUser });
  } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
};

exports.getTgChatInfo = async (req, res) => {
  try {
    const { channel } = req.body;
    if (!channel) return res.status(400).json({ error: 'Укажите ссылку' });

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

exports.verifyEmail = async (req, res) => { res.json({ success: true }); };
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