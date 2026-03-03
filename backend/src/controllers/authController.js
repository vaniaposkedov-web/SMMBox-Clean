const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Добавили
const sendEmail = require('../utils/sendEmail'); // Добавили импорт утилиты
const templates = require('../utils/emailTemplates');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

// РЕГИСТРАЦИЯ (с числовым ID)
exports.register = async (req, res) => {
  const { email, password, name, pavilion } = req.body;

  try {
    // 1. Проверка на существующего пользователя
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // 2. Шифрование пароля (защита данных)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Генерация красивого цифрового ID (например, 35521542)
    const numericId = Math.floor(10000000 + Math.random() * 90000000).toString();

    // 4. Создание записи в базе
    const user = await prisma.user.create({
      data: {
        id: numericId,
        email,
        password: hashedPassword,
        name,
        pavilion
      }
    });

    // 5. Создание токена доступа
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // 6. Отправка приветственного письма (Email Marketing)
    await sendEmail({
      email: user.email,
      subject: '🚀 Добро пожаловать в SMMBOXSS!',
      message: templates.welcomeTemplate(user.name || 'Пользователь', user.id)
    }).catch(err => console.error('Ошибка отправки Welcome-письма:', err));

    // 7. Ответ клиенту
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });

  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
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