const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const upload = require('../middleware/upload'); // Подключаем мидлвар
const authMiddleware = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);

router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// Используем upload.single('avatar') чтобы multer ловил файл с именем avatar
router.put('/profile', upload.single('avatar'), authController.updateProfile);

module.exports = router;