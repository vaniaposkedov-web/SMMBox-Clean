const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/data', partnerController.getPartnerData);
router.get('/search', partnerController.searchPartners);
router.post('/request', partnerController.sendRequest);
router.post('/accept', partnerController.acceptRequest);
router.post('/decline', partnerController.declineRequest);
router.post('/remove', partnerController.removePartner);
router.post('/notifications/clear', partnerController.clearNotifications);
router.post('/notifications/read', partnerController.markNotificationRead);

module.exports = router;
