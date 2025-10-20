const express = require('express');
const whatsappController = require('../controllers/whatsappController');
const embeddedSignupController = require('../controllers/embeddedSignupController');
const router = express.Router();

    router.post('/send-message', whatsappController.sendMessage);
    router.post('/send-template', whatsappController.sendTemplate);
    router.get('/message-status/:messageId', whatsappController.getMessageStatus);

    router.get('/auth/facebook', embeddedSignupController.initiateMetaAuth.bind(embeddedSignupController));
    router.get('/auth/facebook/callback', embeddedSignupController.handleMetaCallback.bind(embeddedSignupController));
    router.post('/embedded-signup', embeddedSignupController.processEmbeddedSignup.bind(embeddedSignupController));

module.exports = router;