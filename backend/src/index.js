// backend/src/index.js
const express = require('express');
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
  'http://localhost:5174',   // Добавили этот порт
  'http://127.0.0.1:5174'
];

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true 
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

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
  max: 20, // Максимум 5 генераций в минуту с одного IP
  message: { success: false, error: 'Слишком много запросов. Подождите одну минуту и попробуйте снова.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Ставим охранника ЖЕСТКО на весь модуль ИИ
app.use('/api/ai', aiLimiter, aiRoutes);

// Статика
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Запуск сервера
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
      console.log(`Сервер SMMBOX запущен локально на порту ${PORT}`);
  });
}

