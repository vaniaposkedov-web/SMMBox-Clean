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
  const { name, pavilion } = req.body;
  let avatarUrl = undefined;
  if (req.file) avatarUrl = `http://localhost:5000/uploads/${req.file.filename}`;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name, pavilion, ...(avatarUrl && { avatarUrl }) }
    });
    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
};

const handleSocialLogin = async (socialId, provider, name, emailFromProvider = null) => {
  let user = await prisma.user.findFirst({
    where: provider === 'vk' ? { vkId: socialId } : { telegramId: socialId }
  });

  if (!user) {
    const numericId = Math.floor(10000000 + Math.random() * 90000000).toString();
    user = await prisma.user.create({
      data: {
        id: numericId,
        vkId: provider === 'vk' ? socialId : null,
        telegramId: provider === 'telegram' ? socialId : null,
        name: name,
        email: emailFromProvider || `temp_${socialId}@smmbox.local`, 
        isEmailVerified: false
      }
    });
  }

  if (!user.isEmailVerified || user.email.includes('@smmbox.local')) {
    return { success: true, requiresEmailVerification: true, userId: user.id };
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...userWithoutPassword } = user;
  return { success: true, user: userWithoutPassword, token };
};

exports.telegramAuth = async (req, res) => {
  try {
    const telegramData = req.body;
    const { hash, ...userData } = telegramData;
    const secretKey = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    
    const dataCheckString = Object.keys(userData).sort().map(key => `${key}=${userData[key]}`).join('\n');
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    if (hmac !== hash) return res.status(401).json({ error: 'Неверная подпись Telegram' });

    const authDate = parseInt(userData.auth_date, 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return res.status(401).json({ error: 'Данные авторизации устарели' });

    let user = await prisma.user.findFirst({
      where: { telegramId: userData.id.toString() }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: userData.id.toString(),
          name: userData.first_name + (userData.last_name ? ` ${userData.last_name}` : ''),
          email: `${userData.id}@telegram.local`, 
          password: await bcrypt.hash(crypto.randomBytes(10).toString('hex'), 10), 
        }
      });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Ошибка Telegram авторизации:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

exports.vkAuth = async (req, res) => {
  const { code, redirectUri, codeVerifier } = req.body;
  
  try {
    if (!code || !codeVerifier) {
      return res.status(400).json({ error: 'Не хватает данных для авторизации (нет code или codeVerifier)' });
    }

    // 1. Обмениваем код на токен (ВК требует code_verifier)
    const tokenResponse = await axios.get('https://oauth.vk.com/access_token', {
      params: {
        client_id: process.env.VK_APP_ID,
        client_secret: process.env.VK_APP_SECRET,
        redirect_uri: redirectUri,
        code: code,
        code_verifier: codeVerifier 
      }
    });

    const { user_id, email, access_token } = tokenResponse.data;

    if (!access_token) {
       return res.status(400).json({ error: 'Не удалось получить токен ВК' });
    }

    // 2. Получаем имя пользователя
    const userResponse = await axios.get('https://api.vk.com/method/users.get', {
      params: { user_ids: user_id, access_token, v: '5.131' }
    });

    const vkUser = userResponse.data.response[0];
    const name = `${vkUser.first_name} ${vkUser.last_name}`;

    // 3. Авторизуем в нашей системе
    const result = await handleSocialLogin(user_id.toString(), 'vk', name, email);
    res.json(result);

  } catch (error) {
    console.error('Ошибка VK Auth Backend:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Ошибка авторизации через ВКонтакте' });
  }
};

exports.linkEmailAndSendCode = async (req, res) => {
  const { userId, email } = req.body;
  try {
    const existingEmail = await prisma.user.findFirst({ where: { email } });
    if (existingEmail && existingEmail.id !== userId) return res.status(400).json({ error: 'Этот Email уже привязан к другому аккаунту' });

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { email: email, emailVerificationCode: verificationCode, emailVerificationExpires: verificationExpires }
    });

    await sendEmail({
      email: user.email,
      subject: '🔐 Привязка Email к SMMBOXSS',
      message: `Ваш код для подтверждения почты: ${verificationCode}. Код действителен 15 минут.`
    });

    res.json({ success: true, message: 'Код подтверждения отправлен на почту' });
  } catch (error) {
    console.error('Ошибка привязки email:', error);
    res.status(500).json({ error: 'Ошибка сервера при привязке Email' });
  }
};

exports.requestLinkEmail = async (req, res) => {
  try {
    const { userId, email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.user.update({
      where: { id: userId },
      data: { verificationCode: code },
    });

    const mailOptions = {
      from: `"SMMBOX" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Привязка почты к аккаунту SMMBOX',
      html: `
        <div style="font-family: sans-serif; padding: 20px; text-align: center;">
          <h2>Здравствуйте!</h2>
          <p>Для привязки этого адреса электронной почты к вашему аккаунту введите следующий код:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 10px; display: inline-block; margin: 20px 0;">
            <h1 style="color: #2563eb; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p style="color: #6b7280; font-size: 12px;">Если вы не запрашивали этот код, просто проигнорируйте письмо.</p>
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
    const { userId, email, code } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.verificationCode !== code) return res.status(400).json({ error: 'Неверный код подтверждения' });

    await prisma.user.update({
      where: { id: userId },
      data: { email: email, verificationCode: null },
    });

    res.status(200).json({ success: true, message: 'Почта успешно привязана!' });
  } catch (error) {
    console.error('Ошибка проверки кода привязки:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};