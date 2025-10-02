const express = require('express');
const whatsappController = require('../controllers/whatsappController');
const embeddedSignupController = require('../controllers/embeddedSignupController');
const router = express.Router();

    router.post('/send-message', whatsappController.sendMessage);
    router.post('/send-template', whatsappController.sendTemplate);
    router.get('/message-status/:messageId', whatsappController.getMessageStatus);

    router.post('/embedded-signup', embeddedSignupController.processEmbeddedSignup.bind(embeddedSignupController));

    router.get('/signup', (req, res) => {
        res.sendFile(path.join(__dirname, '../../public/embeddedSignup.html'));
    })


module.exports = router;