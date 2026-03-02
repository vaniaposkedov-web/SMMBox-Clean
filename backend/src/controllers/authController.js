const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

// РЕГИСТРАЦИЯ
exports.register = async (req, res) => {
  const { email, password, name, pavilion } = req.body;

  try {
    // 1. Проверяем, есть ли уже такой пользователь
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // 2. Шифруем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Создаем юзера в реальной базе данных
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        pavilion
      }
    });

    // 4. Генерируем токен
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // 5. Отдаем данные на фронтенд (без пароля!)
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
};

// АВТОРИЗАЦИЯ (ВХОД)
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
};

// ВК-АВТОРИЗАЦИЯ (Твой старый код)
exports.vkUrl = (req, res) => {
  const vkAuthUrl = `https://oauth.vk.com/authorize?...`; 
  res.json({ url: vkAuthUrl });
};

exports.vkCallback = async (req, res) => {
  res.send('VK Auth Callback placeholder');
};