const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authMiddleware = require('../middleware/auth'); // ВАЖНАЯ СТРОКА! Защита роутов

// Старый роут для обычной публикации (теперь с защитой)
router.post('/create', authMiddleware, postController.createPost);

// Новые роуты для обмена постами с партнерами
router.post('/share', authMiddleware, postController.shareWithPartners);
router.get('/shared', authMiddleware, postController.getSharedPosts);
router.delete('/shared/:id', authMiddleware, postController.deleteSharedPost);

module.exports = router;