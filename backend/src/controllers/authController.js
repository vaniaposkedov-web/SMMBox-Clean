const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); 
const sendEmail = require('../utils/sendEmail'); 
const templates = require('../utils/emailTemplates');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

// Универсальный генератор красивых 10-значных ID
const generate10DigitId = () => Math.floor(1000000000 + Math.random() * 9000000000).toString();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', 
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER, 
    pass: process.env.SMTP_PASS, 
  },
});

exports.register = async (req, res) => {
  const { email, phone, password, name, pavilion } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Пользователь с таким email уже существует' });

    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) return res.status(400).json({ error: 'Этот номер телефона уже зарегистрирован' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        id: generate10DigitId(),
        email,
        phone: phone || null, 
        password: hashedPassword,
        name,
        pavilion,
        emailVerificationCode: verificationCode,
        emailVerificationExpires: verificationExpires
      }
    });

    await sendEmail({
      email: user.email,
      subject: '🔐 Код подтверждения SMMBOXSS',
      message: `Ваш код для завершения регистрации: ${verificationCode}. Код действителен 15 минут.`
    });

    res.json({ success: true, message: 'Код подтверждения отправлен на почту', email: user.email });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
};

exports.verifyEmail = async (req, res) => {
  const { email, code } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.isEmailVerified) return res.status(400).json({ error: 'Email уже подтвержден' });

    if (user.emailVerificationCode !== code || user.emailVerificationExpires < new Date()) {
      return res.status(400).json({ error: 'Неверный или просроченный код подтверждения' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null
      }
    });

    await sendEmail({
      email: updatedUser.email,
      subject: '🚀 Добро пожаловать в SMMBOXSS!',
      message: templates.welcomeTemplate(updatedUser.name || 'Пользователь', updatedUser.id)
    }).catch(err => console.error('Ошибка отправки Welcome-письма:', err));

    const token = jwt.sign({ userId: updatedUser.id }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userWithoutPassword } = updatedUser;
    
    res.json({ success: true, user: userWithoutPassword, token });
  } catch (error) {
    console.error('Ошибка проверки email:', error);
    res.status(500).json({ error: 'Ошибка сервера при проверке кода' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(401).json({ error: 'Неверный email или пароль' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(200).json({ message: 'Если email существует, инструкции отправлены на почту.' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const passwordResetExpires = new Date(Date.now() + 3600000);

    await prisma.user.update({
      where: { email },
      data: { resetPasswordToken: passwordResetToken, resetPasswordExpires: passwordResetExpires }
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendEmail({
      email: user.email,
      subject: '🔐 Восстановление пароля в SMMBOXSS',
      message: templates.passwordResetTemplate(resetUrl)
    });

    res.json({ message: 'Инструкции по сбросу пароля отправлены на почту' });
  } catch (error) {
    console.error('Ошибка ForgotPassword:', error);
    res.status(500).json({ error: 'Ошибка при обработке запроса на восстановление' });
  }
};

exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
      where: { resetPasswordToken: hashedToken, resetPasswordExpires: { gt: new Date() } }
    });

    if (!user) return res.status(400).json({ error: 'Токен недействителен' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetPasswordToken: null, resetPasswordExpires: null }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сброса пароля' });
  }
};

exports.updateProfile = async (req, res) => {
  const userId = req.user.userId;
  const { name, pavilion, phone } = req.body;
  let avatarUrl = undefined;
  if (req.file) avatarUrl = `http://localhost:5000/uploads/${req.file.filename}`;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name, pavilion, phone, ...(avatarUrl && { avatarUrl }) }
    });
    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
};

// ==========================================
// УМНОЕ СЛИЯНИЕ АККАУНТОВ СОЦСЕТЕЙ
// ==========================================
const handleSocialLogin = async (socialId, provider, name, emailFromProvider = null, avatarUrl = null) => {
  let user = await prisma.user.findFirst({
    where: provider === 'vk' ? { vkId: socialId } : { telegramId: socialId }
  });

  if (!user && emailFromProvider) {
    user = await prisma.user.findUnique({ where: { email: emailFromProvider } });
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(provider === 'vk' ? { vkId: socialId } : { telegramId: socialId }),
          avatarUrl: user.avatarUrl || avatarUrl
        }
      });
    }
  }

  if (!user) {
    const fakeEmail = `${socialId}@${provider}.local`;
    const finalEmail = emailFromProvider || fakeEmail;

    user = await prisma.user.create({
      data: {
        id: generate10DigitId(),
        vkId: provider === 'vk' ? socialId : null,
        telegramId: provider === 'telegram' ? socialId : null,
        name: name,
        email: finalEmail,
        isEmailVerified: !!emailFromProvider,
        avatarUrl: avatarUrl || null,
        password: await bcrypt.hash(crypto.randomBytes(10).toString('hex'), 10), 
      }
    });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...userWithoutPassword } = user;
  
  return { success: true, user: userWithoutPassword, token };
};

// ==========================================
// АВТОРИЗАЦИЯ ВКОНТАКТЕ
// ==========================================
exports.vkAuth = async (req, res) => {
  const { access_token, user_id, email } = req.body;
  try {
    if (!access_token || !user_id) return res.status(400).json({ error: 'Нет токена ВК' });

    const serviceToken = process.env.VK_SERVICE_TOKEN;
    if (!serviceToken) return res.status(500).json({ error: 'Ошибка настройки сервера ВК (VK_SERVICE_TOKEN)' });

    const checkResponse = await axios.get('https://api.vk.com/method/secure.checkToken', {
      params: { token: access_token, access_token: serviceToken, v: '5.199' }
    });

    if (checkResponse.data.error || checkResponse.data.response.success !== 1 || checkResponse.data.response.user_id.toString() !== user_id.toString()) {
      return res.status(401).json({ error: 'Токен ВКонтакте недействителен' });
    }

    const userResponse = await axios.get('https://api.vk.com/method/users.get', {
      params: { user_ids: user_id, access_token: serviceToken, fields: 'photo_200', v: '5.199' }
    });

    const vkUser = userResponse.data.response[0];
    const name = `${vkUser.first_name} ${vkUser.last_name}`;
    const avatarUrl = vkUser.photo_200 || null;

    const result = await handleSocialLogin(user_id.toString(), 'vk', name, email, avatarUrl);
    res.json(result);
  } catch (error) {
    console.error('Ошибка ВК:', error);
    res.status(500).json({ error: 'Ошибка сервера при авторизации ВК' });
  }
};

// ==========================================
// АВТОРИЗАЦИЯ TELEGRAM
// ==========================================
exports.telegramAuth = async (req, res) => {
  try {
    const { hash, ...userData } = req.body;
    const secretKey = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    
    const dataCheckString = Object.keys(userData).sort().map(key => `${key}=${userData[key]}`).join('\n');
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    if (hmac !== hash) return res.status(401).json({ error: 'Неверная подпись Telegram' });

    const authDate = parseInt(userData.auth_date, 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return res.status(401).json({ error: 'Данные авторизации устарели' });

    const name = userData.first_name + (userData.last_name ? ` ${userData.last_name}` : '');
    const avatarUrl = userData.photo_url || null;

    const result = await handleSocialLogin(userData.id.toString(), 'telegram', name, null, avatarUrl);
    res.status(200).json({ token: result.token, user: result.user });
  } catch (error) {
    console.error('Ошибка Telegram:', error);
    res.status(500).json({ error: 'Ошибка сервера Telegram' });
  }
};

// ==========================================
// ПРИВЯЗКА ПОЧТЫ И ТЕЛЕФОНА
// ==========================================
exports.requestLinkEmail = async (req, res) => {
  try {
    const { userId, email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail && existingEmail.id !== userId) {
      return res.status(400).json({ error: 'Этот Email уже привязан к другому аккаунту' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { 
        emailVerificationCode: code,
        emailVerificationExpires: new Date(Date.now() + 15 * 60 * 1000) // Добавляем срок жизни кода 15 мин
      },
    });

    const mailOptions = {
      from: `"SMMBOX" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Привязка данных к профилю',
      html: `
        <div style="font-family: sans-serif; padding: 20px; text-align: center;">
          <h2>Здравствуйте!</h2>
          <p>Для подтверждения данных введите следующий код:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 10px; display: inline-block; margin: 20px 0;">
            <h1 style="color: #2563eb; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: 'Код успешно отправлен' });
  } catch (error) {
    console.error('Ошибка при отправке кода привязки:', error);
    res.status(500).json({ error: 'Не удалось отправить письмо. Проверьте адрес почты.' });
  }
};

exports.verifyLinkEmail = async (req, res) => {
  try {
    const { userId, email, code, phone } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.emailVerificationCode !== code || (user.emailVerificationExpires && user.emailVerificationExpires < new Date())) {
      return res.status(400).json({ error: 'Неверный или просроченный код подтверждения' });
    }

    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone && existingPhone.id !== userId) {
        return res.status(400).json({ error: 'Этот номер телефона уже зарегистрирован' });
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { 
        email: email, 
        phone: phone || user.phone,
        emailVerificationCode: null, // Правильное поле
        emailVerificationExpires: null, // Правильное поле
        isEmailVerified: true
      },
    });

    res.status(200).json({ success: true, message: 'Данные успешно сохранены!' });
  } catch (error) {
    console.error('Ошибка сохранения данных:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

// Старая функция (на всякий случай оставим, чтобы не сломать роуты, если они где-то используются)
exports.linkEmailAndSendCode = async (req, res) => {
  const { userId, email } = req.body;
  try {
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.user.update({
      where: { id: userId },
      data: { email: email, emailVerificationCode: verificationCode, emailVerificationExpires: new Date(Date.now() + 15 * 60 * 1000) }
    });
    res.json({ success: true, message: 'Код отправлен' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

exports.completeOnboarding = async (req, res) => {
  try {
    // Теперь мидлвар гарантированно передает нам ID пользователя из токена
    const userId = req.user.userId;

    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      return res.status(404).json({ error: 'Пользователь не найден в базе данных.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isOnboardingCompleted: true }
    });
    
    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА completeOnboarding:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

// ==========================================
// ПОЛУЧЕНИЕ ИНФОРМАЦИИ О КАНАЛЕ TELEGRAM
// ==========================================
exports.getTgChatInfo = async (req, res) => {
  const { channel } = req.body;
  try {
    // Очищаем ссылку, чтобы получить @username
    let chatId = channel.trim();
    if (chatId.includes('t.me/')) {
      chatId = '@' + chatId.split('t.me/')[1];
    } else if (!chatId.startsWith('@')) {
      chatId = '@' + chatId;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return res.status(500).json({ error: 'Токен бота не настроен' });

    // 1. Получаем базовую инфу о чате
    const tgRes = await axios.get(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`);
    const chat = tgRes.data.result;
    
    let avatarUrl = null;

    // 2. Если есть аватарка, получаем прямую ссылку на файл
    if (chat.photo) {
       const fileRes = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${chat.photo.small_file_id}`);
       const filePath = fileRes.data.result.file_path;
       avatarUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    }

    res.json({
      success: true,
      title: chat.title || chat.username,
      username: chat.username ? `@${chat.username}` : chatId,
      avatar: avatarUrl
    });
  } catch (error) {
    console.error('Ошибка получения чата ТГ:', error?.response?.data || error.message);
    res.status(400).json({ error: 'Канал не найден. Убедитесь, что бот добавлен в администраторы.' });
  }
};