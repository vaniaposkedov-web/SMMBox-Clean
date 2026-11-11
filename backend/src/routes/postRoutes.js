const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload'); // ⚡ Подключили загрузчик

// ⚡ ИСПРАВЛЕНИЕ: Добавили upload.array('media', 10) чтобы сервер начал принимать файлы
router.post('/create', authMiddleware, upload.array('media', 10), postController.createPost);
router.post('/upload-media', authMiddleware, upload.single('media'), postController.uploadPostMedia);
router.post('/share', authMiddleware, upload.array('media', 10), postController.shareWithPartners);

router.get('/shared', authMiddleware, postController.getSharedPosts);
router.post('/shared/:id/stage', authMiddleware, postController.stageSharedPost);
router.delete('/shared/:id', authMiddleware, postController.deleteSharedPost);

// РОУТЫ ДЛЯ КАЛЕНДАРЯ И РЕДАКТИРОВАНИЯ
router.get('/status', authMiddleware, postController.getPostStatuses);
router.get('/scheduled', authMiddleware, postController.getScheduledPosts);
router.put('/scheduled/:id', authMiddleware, postController.updateScheduledPost);
router.delete('/scheduled/:id', authMiddleware, postController.deleteScheduledPost);

router.get('/history', authMiddleware, postController.getPostsHistory);
router.post('/retry/:id', authMiddleware, postController.retryPost);

module.exports = router;
