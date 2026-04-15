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
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    // 1. ЗАЩИТА ОТ ОШИБКИ 500: Проверяем, не занят ли телефон другим пользователем
    if (phone) {
      const phoneOwner = await prisma.user.findUnique({ where: { phone } });
      if (phoneOwner && phoneOwner.email !== email) {
        return res.status(400).json({ error: 'Этот номер телефона уже привязан к другому аккаунту' });
      }
    }

    // 2. Ищем существующего пользователя
    let existingUser = await prisma.user.findUnique({ where: { email } });
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(password, 10);

    if (existingUser) {
      // Если пользователь есть, но не подтвержден — обновляем данные и шлем новый код
      if (!existingUser.isEmailVerified) {
        await prisma.user.update({
          where: { email },
          data: { 
            password: hashedPassword, 
            name: name || '', 
            phone: phone || null, 
            emailVerificationCode: verificationCode 
          }
        });
      } else {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }
    } else {
      // 3. ГЕНЕРАЦИЯ УНИКАЛЬНОГО ЧИСЛОВОГО ID (например, 96720965)
      let newId;
      let isUnique = false;

      // Цикл будет работать, пока не найдет свободный ID в базе
      while (!isUnique) {
        // Генерируем случайное 8-значное число от 10000000 до 99999999
        newId = Math.floor(10000000 + Math.random() * 90000000);
        
        // Проверяем, нет ли уже пользователя с таким ID
        // ВАЖНО: Если в схеме Prisma id — это String, используйте String(newId)
        const duplicate = await prisma.user.findUnique({ where: { id: String(newId) } });
        if (!duplicate) isUnique = true;
      }

      // 4. СОЗДАНИЕ НОВОГО ПОЛЬЗОВАТЕЛЯ с числовым ID
      await prisma.user.create({
        data: { 
          id: String(newId), // Записываем наш сгенерированный ID
          email, 
          password: hashedPassword, 
          name: name || '', 
          phone: phone || null, 
          emailVerificationCode: verificationCode, 
          isEmailVerified: false,
          isOnboardingCompleted: true
        }
      });
    }
    
    // 5. ОТПРАВКА КОДА ПОДТВЕРЖДЕНИЯ
    try {
      await sendEmail(email, 'Подтверждение регистрации', `
        <div style="font-family: sans-serif; max-width: 400px;">
          <h2 style="color: #111;">Добро пожаловать в SMMBOX!</h2>
          <p style="color: #666;">Введите этот код в приложении для подтверждения почты:</p>
          <div style="background: #f4f7ff; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
            <b style="font-size: 32px; color: #0077FF; letter-spacing: 5px;">${verificationCode}</b>
          </div>
          <p style="font-size: 12px; color: #999;">Если вы не регистрировались у нас, просто проигнорируйте это письмо.</p>
        </div>
      `);
    } catch (e) {
      // Ошибку почты только логируем, чтобы не прерывать регистрацию
      console.error('Ошибка при отправке письма:', e);
    }

    res.json({ 
      success: true, 
      message: 'Код подтверждения отправлен на вашу почту' 
    });

  } catch (error) { 
    console.error('Критическая ошибка регистрации:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' }); 
  }
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

// Вспомогательная функция для генерации 8-значного ID
async function generateUniqueId() {
  let newId;
  let isUnique = false;
  while (!isUnique) {
    newId = String(Math.floor(10000000 + Math.random() * 90000000));
    const duplicate = await prisma.user.findUnique({ where: { id: newId } });
    if (!duplicate) isUnique = true;
  }
  return newId;
}

exports.telegramAuth = async (req, res) => {
  try {
    const { id, first_name, last_name, username, photo_url } = req.body;
    if (!id) return res.status(400).json({ error: 'Нет данных Telegram' });

    let user = await prisma.user.findUnique({ where: { telegramId: String(id) } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const newId = await generateUniqueId(); // Генерируем красивый ID
      const fullName = [first_name, last_name].filter(Boolean).join(' ') || username || 'TG Юзер';
      
      user = await prisma.user.create({
        data: { 
          id: newId, // Сохраняем сгенерированный ID
          telegramId: String(id), 
          name: fullName, 
          avatarUrl: photo_url || null, 
          isOnboardingCompleted: true, 
          isEmailVerified: true 
        }
      });
      await prisma.socialProfile.create({
        data: { userId: user.id, provider: 'TELEGRAM', providerAccountId: String(id), name: fullName, avatarUrl: photo_url || null, accessToken: '' }
      });
    } else {
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
    const email = req.body.email;
    let first_name = req.body.first_name || '';
    let last_name = req.body.last_name || '';
    let photo_100 = req.body.photo_100 || null;

    if (!vkIdStr) return res.status(400).json({ error: 'Нет данных VK' });

    let user = await prisma.user.findUnique({ where: { vkId: String(vkIdStr) } });
    let isNewUser = false;

    if (!user) {
      if (email) {
        user = await prisma.user.findUnique({ where: { email: email } });
      }

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            vkId: String(vkIdStr),
            avatarUrl: user.avatarUrl || photo_100
          }
        });
      } else {
        isNewUser = true;
        const newId = await generateUniqueId(); // Генерируем красивый ID
        const fullName = [first_name, last_name].filter(Boolean).join(' ') || 'VK Юзер';
        
        user = await prisma.user.create({
          data: {
            id: newId, // Сохраняем сгенерированный ID
            vkId: String(vkIdStr),
            email: email || null,
            name: fullName,
            avatarUrl: photo_100,
            isOnboardingCompleted: true,
            isEmailVerified: !!email
          }
        });
      }

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
    
    // === ВОТ ЭТОГО БЛОКА ТАМ НЕ БЫЛО. ТЕПЕРЬ ПИСЬМО БУДЕТ ОТПРАВЛЯТЬСЯ ===
    try {
      await sendEmail(email, 'Подтверждение почты SMMBOX', `
        <div style="font-family: sans-serif; max-width: 400px;">
          <h2 style="color: #111;">Привязка почты</h2>
          <p style="color: #666;">Введите этот код в профиле для подтверждения:</p>
          <div style="background: #f4f7ff; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
            <b style="font-size: 32px; color: #0077FF; letter-spacing: 5px;">${code}</b>
          </div>
        </div>
      `);
    } catch (e) {
      console.error('Ошибка отправки email:', e);
    }

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
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({ 
      where: { email }, 
      data: { resetPasswordToken: token, resetPasswordExpires: new Date(Date.now() + 3600000) } 
    });

    // ФАКТИЧЕСКАЯ ОТПРАВКА ПИСЬМА (раньше этого блока не было)
    const resetLink = `https://smmdeck.ru/reset-password/${token}`;
    try {
      await sendEmail(email, 'Восстановление пароля', `Для сброса пароля перейдите по ссылке:\n\n${resetLink}\n\nЕсли вы не запрашивали сброс, просто проигнорируйте это письмо.`);
    } catch (e) {
      console.error('Ошибка отправки email:', e);
    }

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
    
    if (!userId) {
        return res.status(400).json({ success: false, error: 'ID пользователя не найден' });
    }

    // Формируем объект только с теми данными, которые реально пришли
    const data = {};
    if (name !== undefined) data.name = name;
    if (pavilion !== undefined) data.pavilion = pavilion;
    if (phone !== undefined) data.phone = phone;
    
    // ⚡ ПРАВИЛЬНАЯ ОБРАБОТКА АВАТАРКИ (с защитой от краша)
    if (req.file) {
        const fs = require('fs');
        const path = require('path');
        
        try {
            const sharp = require('sharp');
            const uploadsDir = path.join(__dirname, '../../uploads/profiles');
            
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            
            const fileName = `avatar_${userId}_${Date.now()}.jpg`;
            const filePath = path.join(uploadsDir, fileName);
            
            // Сжимаем аватарку и делаем её идеальным квадратом 400x400
            await sharp(req.file.path)
                .resize({ width: 400, height: 400, fit: 'cover' })
                .jpeg({ quality: 85 })
                .toFile(filePath);
                
            // Удаляем временный мусор
            await fs.promises.unlink(req.file.path).catch(() => {});
            
            // Прописываем правильный путь (через /api/, чтобы обходить Nginx)
            data.avatarUrl = `/api/uploads/profiles/${fileName}`;
        } catch (imgErr) {
            console.error("Ошибка при обработке картинки:", imgErr);
            // Фолбек: если sharp по какой-то причине не сработал, просто копируем файл как есть
            const ext = path.extname(req.file.originalname) || '.jpg';
            const fileName = `avatar_${userId}_${Date.now()}${ext}`;
            const destPath = path.join(__dirname, '../../uploads/profiles', fileName);
            
            if (!fs.existsSync(path.dirname(destPath))) fs.mkdirSync(path.dirname(destPath), { recursive: true });
            
            await fs.promises.copyFile(req.file.path, destPath);
            await fs.promises.unlink(req.file.path).catch(() => {});
            
            data.avatarUrl = `/api/uploads/profiles/${fileName}`;
        }
    }
    
    // Сохраняем в базу данных
    const updated = await prisma.user.update({ 
        where: { id: String(userId) }, 
        data 
    });
    
    res.json({ success: true, user: updated });
  } catch (error) { 
    console.error('Ошибка обновления профиля:', error);
    
    // 🛡️ Перехватываем ошибку уникального номера телефона или почты
    if (error.code === 'P2002') {
        if (error.meta?.target?.includes('phone')) {
            return res.status(400).json({ success: false, error: 'Этот номер телефона уже используется другим пользователем!' });
        }
    }
    
    res.status(500).json({ success: false, error: 'Ошибка сохранения данных: ' + error.message }); 
  }
};

exports.completeOnboarding = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    
    // Обновляем статус пользователя в базе данных
    await prisma.user.update({
      where: { id: String(userId) },
      data: { isOnboardingCompleted: true }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка завершения Onboarding:', error);
    res.status(500).json({ error: 'Ошибка сервера при завершении Onboarding' });
  }
};