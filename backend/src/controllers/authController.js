const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Добавили
const sendEmail = require('../utils/sendEmail'); // Добавили импорт утилиты
const templates = require('../utils/emailTemplates');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

// РЕГИСТРАЦИЯ (Отправка кода)
exports.register = async (req, res) => {
  const { email, phone, password, name, pavilion } = req.body;

  try {
    // 1. Проверка на существующего пользователя по email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Проверка по телефону (если передан)
    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        return res.status(400).json({ error: 'Этот номер телефона уже зарегистрирован' });
      }
    }

    // 2. Шифрование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Генерация цифрового ID
    const numericId = Math.floor(10000000 + Math.random() * 90000000).toString();

    // 4. ГЕНЕРАЦИЯ КОДА (Вот эти строки потерялись!)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000);

    // 5. Создание записи в базе
    const user = await prisma.user.create({
      data: {
        id: numericId,
        email,
        phone: phone || null, // <-- Наш фикс для пустого телефона
        password: hashedPassword,
        name,
        pavilion,
        emailVerificationCode: verificationCode,
        emailVerificationExpires: verificationExpires
      }
    });

    // 6. Отправка письма с кодом подтверждения
    await sendEmail({
      email: user.email,
      subject: '🔐 Код подтверждения SMMBOXSS',
      message: `Ваш код для завершения регистрации: ${verificationCode}. Код действителен 15 минут.`
    });

    // 7. Ответ клиенту
    res.json({ 
      success: true, 
      message: 'Код подтверждения отправлен на почту',
      email: user.email 
    });

  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
};

  // ПОДТВЕРЖДЕНИЕ EMAIL И ВЫДАЧА ТОКЕНА
  exports.verifyEmail = async (req, res) => {
    const { email, code } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ error: 'Email уже подтвержден' });
      }

      // Проверка валидности кода
      if (user.emailVerificationCode !== code || user.emailVerificationExpires < new Date()) {
        return res.status(400).json({ error: 'Неверный или просроченный код подтверждения' });
      }

      // Успешное подтверждение: обновляем статус и стираем код
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          emailVerificationCode: null,
          emailVerificationExpires: null
        }
      });

      // Отправляем приветственное письмо (Welcome Template)
      await sendEmail({
        email: updatedUser.email,
        subject: '🚀 Добро пожаловать в SMMBOXSS!',
        message: templates.welcomeTemplate(updatedUser.name || 'Пользователь', updatedUser.id)
      }).catch(err => console.error('Ошибка отправки Welcome-письма:', err));

      // Выдача токена авторизации
      const token = jwt.sign({ userId: updatedUser.id }, JWT_SECRET, { expiresIn: '7d' });
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      res.json({ success: true, user: userWithoutPassword, token });

    } catch (error) {
      console.error('Ошибка проверки email:', error);
      res.status(500).json({ error: 'Ошибка сервера при проверке кода' });
    }
  };

// ВХОД
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

// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    // В целях безопасности не говорим, что email не найден
    if (!user) {
      return res.status(200).json({ message: 'Если email существует, инструкции отправлены на почту.' });
    }

    // 1. Создание безопасного одноразового токена
    const resetToken = crypto.randomBytes(32).toString('hex');

    // 2. Хеширование токена для хранения в БД
    const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // 3. Установка срока жизни (1 час)
    const passwordResetExpires = new Date(Date.now() + 3600000);

    await prisma.user.update({
      where: { email },
      data: {
        resetPasswordToken: passwordResetToken,
        resetPasswordExpires: passwordResetExpires
      }
    });

    // 4. Формирование ссылки для фронтенда
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // 5. Отправка письма с использованием профессионального шаблона
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

// УСТАНОВКА НОВОГО ПАРОЛЯ
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

// ОБНОВЛЕНИЕ ПРОФИЛЯ
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

// ==========================================
// ЛОГИКА АВТОРИЗАЦИИ ЧЕРЕЗ СОЦСЕТИ
// ==========================================

// Вспомогательная функция: обрабатываем вход после получения ID соцсети
const handleSocialLogin = async (socialId, provider, name, emailFromProvider = null) => {
  let user = await prisma.user.findFirst({
    where: provider === 'vk' ? { vkId: socialId } : { telegramId: socialId }
  });

  // Если пользователя нет, создаем "пустого" с привязкой соцсети
  if (!user) {
    const numericId = Math.floor(10000000 + Math.random() * 90000000).toString();
    user = await prisma.user.create({
      data: {
        id: numericId,
        vkId: provider === 'vk' ? socialId : null,
        telegramId: provider === 'telegram' ? socialId : null,
        name: name,
        email: emailFromProvider || `temp_${socialId}@smmbox.local`, // Временный email, если нет
        isEmailVerified: false
      }
    });
  }

  // Если почта не подтверждена (или стоит временная) - требуем подтверждение
  if (!user.isEmailVerified || user.email.includes('@smmbox.local')) {
    return { success: true, requiresEmailVerification: true, userId: user.id };
  }

  // Если всё ок и почта есть - пускаем в систему
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...userWithoutPassword } = user;
  return { success: true, user: userWithoutPassword, token };
};

// 1. АВТОРИЗАЦИЯ ЧЕРЕЗ TELEGRAM
exports.telegramAuth = async (req, res) => {
  const data = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN; // Добавим позже в .env
  
  // Проверка подлинности данных от Telegram (Хэширование)
  const { hash, ...userData } = data;
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  
  const dataCheckString = Object.keys(userData)
    .sort()
    .map(key => `${key}=${userData[key]}`)
    .join('\n');
    
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (hmac !== hash && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'Неверная подпись Telegram' });
  } // В режиме разработки пока пропускаем строгую проверку хэша, если токена нет

  try {
    const socialId = userData.id.toString();
    const name = userData.first_name + (userData.last_name ? ` ${userData.last_name}` : '');
    
    const result = await handleSocialLogin(socialId, 'telegram', name);
    res.json(result);
  } catch (error) {
    console.error('Ошибка Telegram Auth:', error);
    res.status(500).json({ error: 'Ошибка авторизации через Telegram' });
  }
};

// 2. АВТОРИЗАЦИЯ ЧЕРЕЗ ВКОНТАКТЕ
exports.vkAuth = async (req, res) => {
  const { code, redirectUri } = req.body;
  
  try {
    // Получаем токен и данные от ВК по коду
    const tokenResponse = await axios.get('https://oauth.vk.com/access_token', {
      params: {
        client_id: process.env.VK_APP_ID,
        client_secret: process.env.VK_APP_SECRET,
        redirect_uri: redirectUri,
        code: code
      }
    });

    const { user_id, email, access_token } = tokenResponse.data;

    // Получаем имя пользователя
    const userResponse = await axios.get('https://api.vk.com/method/users.get', {
      params: { user_ids: user_id, access_token, v: '5.131' }
    });

    const vkUser = userResponse.data.response[0];
    const name = `${vkUser.first_name} ${vkUser.last_name}`;

    const result = await handleSocialLogin(user_id.toString(), 'vk', name, email);
    res.json(result);

  } catch (error) {
    console.error('Ошибка VK Auth:', error);
    res.status(500).json({ error: 'Ошибка авторизации через ВКонтакте' });
  }
};

// 3. ПРИВЯЗКА EMAIL (Для соцсетей) - Отправка кода
exports.linkEmailAndSendCode = async (req, res) => {
  const { userId, email } = req.body;

  try {
    // Проверяем, не занят ли этот email другим пользователем (у которого уже есть пароль)
    const existingEmail = await prisma.user.findFirst({ where: { email } });
    if (existingEmail && existingEmail.id !== userId) {
      return res.status(400).json({ error: 'Этот Email уже привязан к другому аккаунту' });
    }

    // Генерируем 6-значный код
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000);

    // Обновляем пользователя: записываем настоящий email и код
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        email: email,
        emailVerificationCode: verificationCode,
        emailVerificationExpires: verificationExpires
      }
    });

    // Отправляем письмо
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