const express = require('express');
const whatsappController = require('../controllers/whatsappController');
const router = express.Router();

    router.post('/send-message', whatsappController.sendMessage);
    router.post('/send-template', whatsappController.sendTemplate);
    router.get('/message-status/:messageId', whatsappController.getMessageStatus);


module.exports = router;