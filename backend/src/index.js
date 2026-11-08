// backend/src/index.js
const express = require('express');
const http = require('http'); // ДОБАВЛЕНО ДЛЯ WEB SOCKETS
const { Server } = require('socket.io'); // ДОБАВЛЕНО ДЛЯ WEB SOCKETS
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Любой внешний запрос без своего срока прервётся через 30 секунд, а не будет висеть бесконечно.
require('axios').defaults.timeout = 30 * 1000;

const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('./utils/security');
getJwtSecret(); // Без секрета входа сервер не запускается
const prisma = require('./utils/prisma');
const { postQueue } = require('./queue');

// Запускаем планировщик постов
require('./controllers/postController').initCron();
require('./controllers/partnerController').initPartnerCron();
require('./utils/logger').initLogCleanup();
const worker = require('./worker'); // Запускаем фонового воркера
require('./utils/avatarFiles').migrateInlineAvatars().catch((error) => console.error('Аватары не перенесены:', error.message));

const authRoutes = require('./routes/authRoutes');
const partnerRoutes = require('./routes/partnerRoutes');
const accountRoutes = require('./routes/accountRoutes');
const postRoutes = require('./routes/postRoutes');
const aiRoutes = require('./routes/aiRoutes');
const adminRoutes = require('./routes/adminRoutes');

const path = require('path');

const allowedOrigins = [
  process.env.FRONTEND_URL, 
  'http://localhost:5173', 
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
];

const app = express();
// СОЗДАЕМ HTTP СЕРВЕР ДЛЯ РАБОТЫ И EXPRESS, И SOCKET.IO
const server = http.createServer(app); 
const PORT = process.env.PORT || 5000;

// НАСТРАИВАЕМ SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

// Глобальная переменная для хранения подключенных сокетов
global.userSockets = new Map();

io.on('connection', (socket) => {
  // Личные события получает только тот, кто подтвердил себя токеном.
  let userId = null;
  try {
    const decoded = jwt.verify(socket.handshake.auth?.token, getJwtSecret());
    userId = String(decoded.id || decoded.userId);
  } catch (e) {
    userId = null;
  }

  if (userId) {
    if (!global.userSockets.has(userId)) {
      global.userSockets.set(userId, new Set());
    }
    global.userSockets.get(userId).add(socket.id);
  }

  socket.on('disconnect', () => {
    if (userId && global.userSockets.has(userId)) {
      global.userSockets.get(userId).delete(socket.id);
      if (global.userSockets.get(userId).size === 0) {
        global.userSockets.delete(userId);
      }
    }
  });
});

// Передаем io внутрь Express, чтобы контроллеры могли отправлять сигналы
app.set('io', io);
require('./utils/telegramPolling').startTelegramPolling(io);

// Перед приложением стоят два nginx: на хосте и в контейнере фронтенда.
app.set('trust proxy', Number(process.env.TRUST_PROXY || 2));

app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true 
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
// Правильный путь к папке uploads
// Правильный путь к папке uploads (раздаем по обоим путям для 100% совместимости)
// Имя файла уникально и никогда не перезаписывается, поэтому браузер может хранить фото долго и не спрашивать снова.
const UPLOADS_CACHE = { maxAge: '30d', immutable: true };
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), UPLOADS_CACHE));
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads'), UPLOADS_CACHE));


// Базовые роуты
app.use('/api/auth', authRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/admin', adminRoutes);

// === ЗАЩИТА НЕЙРОСЕТИ (RATE LIMITER) ===
const rateLimit = require('express-rate-limit');

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 20, // Максимум 20 генераций в минуту с одного IP
  message: { success: false, error: 'Слишком много запросов. Подождите одну минуту и попробуйте снова.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/ai', aiLimiter, aiRoutes);

// Публичная проверка на тех. работы
app.get('/api/system/status', async (req, res) => {
    try {
        const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
        res.json({
            isMaintenance: settings?.isMaintenance || false,
            message: settings?.maintenanceMessage || 'Сайт находится на техническом обслуживании. Мы скоро вернемся!'
        });
    } catch (e) {
        res.json({ isMaintenance: false });
    }
});

// Ошибки загрузки файлов и прочие сбои: понятный ответ без подробностей сервера
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error('Ошибка запроса:', err.message);
    const isUploadError = err.name === 'MulterError' || err.message === 'Разрешены только изображения!';
    res.status(isUploadError ? 400 : 500).json({ success: false, error: isUploadError ? err.message : 'Внутренняя ошибка сервера' });
});

// Сбой в фоновой задаче не должен останавливать весь сайт.
process.on('unhandledRejection', (reason) => {
    console.error('[НЕОБРАБОТАННАЯ ОШИБКА]', reason?.message || reason);
});

// При перезапуске даём очереди закончить текущие посты: иначе пост, прерванный на отправке, мог бы выйти дважды.
let isShuttingDown = false;
const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`Получен ${signal}: завершаем текущие публикации`);
    const shutdownTimeout = setTimeout(() => {
        console.error('Не удалось завершить текущие публикации за 210 секунд');
        process.exit(1);
    }, 210 * 1000);
    shutdownTimeout.unref();
    try {
        await Promise.all([
            new Promise((resolve) => io.close(resolve)),
            worker.close(),
        ]);
        await postQueue.close();
        await prisma.$disconnect();
        clearTimeout(shutdownTimeout);
        process.exit(0);
    } catch (error) {
        console.error('Ошибка штатного завершения сервера:', error.message);
        process.exit(1);
    }
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Запуск сервера (ВАЖНО: теперь server.listen, а не app.listen)
if (process.env.VERCEL) {
  module.exports = app;
} else {
  server.listen(PORT, () => {
      console.log(`Сервер SADOVODPS запущен локально на порту ${PORT}`);
  });
}

