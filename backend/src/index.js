// backend/src/index.js
const express = require('express');
const http = require('http'); // ДОБАВЛЕНО ДЛЯ WEB SOCKETS
const { Server } = require('socket.io'); // ДОБАВЛЕНО ДЛЯ WEB SOCKETS
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Запускаем планировщик постов
require('./controllers/postController').initCron();

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
  const userId = socket.handshake.query.userId;
  
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

app.set('trust proxy', 1);

app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true 
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
// Правильный путь к папке uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


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

// Статика
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Запуск сервера (ВАЖНО: теперь server.listen, а не app.listen)
if (process.env.VERCEL) {
  module.exports = app;
} else {
  server.listen(PORT, () => {
      console.log(`Сервер SMMBOX запущен локально на порту ${PORT}`);
  });
}