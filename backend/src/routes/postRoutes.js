const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authMiddleware = require('../middleware/auth');

router.post('/create', authMiddleware, postController.createPost);
router.post('/share', authMiddleware, postController.shareWithPartners);
router.get('/shared', authMiddleware, postController.getSharedPosts);
router.delete('/shared/:id', authMiddleware, postController.deleteSharedPost);
router.post('/shared/read', authMiddleware, postController.markSharedPostRead);

// НОВЫЕ РОУТЫ ДЛЯ КАЛЕНДАРЯ И РЕДАКТИРОВАНИЯ
router.get('/scheduled', authMiddleware, postController.getScheduledPosts);
router.put('/scheduled/:id', authMiddleware, postController.updateScheduledPost);
router.delete('/scheduled/:id', authMiddleware, postController.deleteScheduledPost);

router.get('/history', authMiddleware, postController.getPostsHistory);
router.post('/retry/:id', authMiddleware, postController.retryPost);

module.exports = router;