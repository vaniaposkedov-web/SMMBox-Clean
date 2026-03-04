const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/auth');

// Защищаем роут, чтобы ИИ могли использовать только авторизованные пользователи
router.post('/generate', authMiddleware, aiController.generateText);

module.exports = router;