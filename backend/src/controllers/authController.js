const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Добавили
const sendEmail = require('../utils/sendEmail'); // Добавили импорт утилиты
const templates = require('../utils/emailTemplates');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';
// Функция генерирует случайный 10-значный ID
const generate10DigitId = () => Math.floor(1000000000 + Math.random() * 9000000000).toString();

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
        id: generate10DigitId(),
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
  try {
    const telegramData = req.body;
    const { hash, ...userData } = telegramData;
    
    // 1. Криптографическая проверка подлинности данных от Telegram
    const secretKey = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    
    // Сортируем ключи по алфавиту и собираем строку (требование Telegram)
    const dataCheckString = Object.keys(userData)
      .sort()
      .map(key => `${key}=${userData[key]}`)
      .join('\n');
      
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    if (hmac !== hash) {
      return res.status(401).json({ error: 'Неверная подпись Telegram' });
    }

    // 2. Проверка даты (защита от устаревших запросов - опционально, но рекомендуется)
    const authDate = parseInt(userData.auth_date, 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) { // Запрос старше 24 часов
      return res.status(401).json({ error: 'Данные авторизации устарели' });
    }

    // 3. Поиск или создание пользователя в БД
    // Предполагается, что в schema.prisma у тебя есть поле telegramId (String, опциональное)
    let user = await prisma.user.findFirst({
      where: { telegramId: userData.id.toString() }
    });

    if (!user) {
      // Регистрируем нового юзера
      user = await prisma.user.create({
        data: {
          telegramId: userData.id.toString(),
          name: userData.first_name + (userData.last_name ? ` ${userData.last_name}` : ''),
          // Telegram не отдает email, поэтому генерируем заглушку или оставляем пустым, 
          // в зависимости от того, требует ли Prisma email как обязательное поле
          email: `${userData.id}@telegram.local`, 
          password: await bcrypt.hash(crypto.randomBytes(10).toString('hex'), 10), // Рандомный пароль
        }
      });
    }

    // 4. Генерация JWT токена
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email } });

  } catch (error) {
    console.error('Ошибка Telegram авторизации:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

// 2. АВТОРИЗАЦИЯ ЧЕРЕЗ ВКОНТАКТЕ
// В начале файла убедись, что axios подключен
// const axios = require('axios');

exports.vkAuth = async (req, res) => {
  try {
    // Получаем данные от фронтенда (VKID.Auth.exchangeCode)
    const { access_token, user_id } = req.body;

    if (!access_token || !user_id) {
      return res.status(400).json({ error: 'Некорректные данные от ВКонтакте' });
    }

    // 1. Обращаемся к API ВК, чтобы подтвердить валидность токена 
    // и получить Имя, Фамилию и Email (если пользователь его разрешил)
    const userRes = await axios.get('https://api.vk.com/method/users.get', {
      params: { 
        user_ids: user_id, 
        access_token: access_token, 
        fields: 'email', // Запрашиваем email
        v: '5.131' 
      }
    });

    if (userRes.data.error) {
      return res.status(401).json({ error: 'Недействительный токен ВКонтакте' });
    }

    const vkUser = userRes.data.response[0];
    const name = `${vkUser.first_name} ${vkUser.last_name}`;
    // Если ВК не отдал email, генерируем временный
    const email = req.body.email || vkUser.email || `temp_vk_${user_id}@smmdeck.local`;

    // 2. Ищем пользователя в базе или создаем нового
    // Функция handleSocialLogin уже написана у тебя в контроллере!
    const result = await handleSocialLogin(user_id.toString(), 'vk', name, email);
    
    // 3. Возвращаем результат (JWT токен и данные юзера) на фронтенд
    res.json(result);

  } catch (error) {
    console.error('Ошибка VK Auth Backend:', error);
    res.status(500).json({ error: 'Ошибка сервера при авторизации ВК' });
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

// Подключаем почтовый модуль (если он у тебя не подключен в начале файла)
const nodemailer = require('nodemailer');

// Настройка почтальона (использует твои ключи из .env)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // или другой SMTP, который ты используешь
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER, // Твоя почта (например, smmbox@gmail.com)
    pass: process.env.SMTP_PASS, // Пароль приложения
  },
});

// ==========================================
// 1. ФУНКЦИЯ: ЗАПРОС КОДА НА ПОЧТУ
// ==========================================
exports.requestLinkEmail = async (req, res) => {
  try {
    const { userId, email } = req.body;

    // Генерируем случайный 6-значный код (например: 482910)
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Записываем этот код в базу данных конкретному пользователю
    await prisma.user.update({
      where: { id: userId },
      data: { verificationCode: code },
    });

    // Формируем красивое письмо
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

    // Отправляем письмо
    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: 'Код успешно отправлен' });
  } catch (error) {
    console.error('Ошибка при отправке кода привязки:', error);
    res.status(500).json({ error: 'Не удалось отправить письмо. Проверьте адрес почты.' });
  }
};

// ==========================================
// 2. ФУНКЦИЯ: ПРОВЕРКА ВВЕДЕННОГО КОДА
// ==========================================
exports.verifyLinkEmail = async (req, res) => {
  try {
    const { userId, email, code } = req.body;

    // Находим пользователя в базе
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Сверяем код, который ввел пользователь, с тем, что в базе
    if (user.verificationCode !== code) {
      return res.status(400).json({ error: 'Неверный код подтверждения' });
    }

    // ЕСЛИ КОД ВЕРНЫЙ: Обновляем почту и удаляем использованный код
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: email,             // Записываем настоящую почту вместо @telegram.local
        verificationCode: null,   // Очищаем код (он одноразовый)
      },
    });

    res.status(200).json({ success: true, message: 'Почта успешно привязана!' });
  } catch (error) {
    console.error('Ошибка проверки кода привязки:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};