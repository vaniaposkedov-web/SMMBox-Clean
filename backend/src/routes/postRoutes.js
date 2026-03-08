const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authMiddleware = require('../middleware/auth');

router.post('/create', authMiddleware, postController.createPost);
router.post('/share', authMiddleware, postController.shareWithPartners);
router.get('/shared', authMiddleware, postController.getSharedPosts);
router.delete('/shared/:id', authMiddleware, postController.deleteSharedPost);

// НОВЫЕ РОУТЫ ДЛЯ КАЛЕНДАРЯ И РЕДАКТИРОВАНИЯ
router.get('/scheduled', authMiddleware, postController.getScheduledPosts);
router.put('/scheduled/:id', authMiddleware, postController.updateScheduledPost);
router.delete('/scheduled/:id', authMiddleware, postController.deleteScheduledPost);

module.exports = router;