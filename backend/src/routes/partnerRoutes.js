const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');

router.get('/data', partnerController.getPartnerData);
router.get('/search', partnerController.searchPartners);
router.post('/request', partnerController.sendRequest);
router.post('/accept', partnerController.acceptRequest);
router.post('/remove', partnerController.removePartner);
router.post('/notifications/clear', partnerController.clearNotifications);

module.exports = router;