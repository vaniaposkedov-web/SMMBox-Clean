// backend/src/index.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const partnerRoutes = require('./routes/partnerRoutes');
const accountRoutes = require('./routes/accountRoutes');
const postRoutes = require('./routes/postRoutes');
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

app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/posts', postRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

module.exports = app;