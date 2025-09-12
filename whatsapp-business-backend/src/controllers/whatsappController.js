const whatsappService = require('../services/whatsappService');

class WhatsAppController {
    async sendTemplate(req, res) {
        try {
            const { 
                recipientNumber, 
                templateName, 
                language = 'pt_BR',
                parameters = [] 
            } = req.body;

            // Validações
            if (!recipientNumber || !templateName) {
                return res.status(400).json({
                    success: false,
                    error: 'recipientNumber e templateName são obrigatórios'
                });
            }

            const result = await whatsappService.sendTemplate(
                recipientNumber, 
                templateName, 
                language,
                parameters
            );

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Template enviado com sucesso',
                    messageId: result.messageId,
                    recipientNumber,
                    templateName
                });
            } else {
                res.status(400).json(result);
            }

        } catch (error) {
            console.error('Erro no controller:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }

    async sendMessage(req, res) {
        try {
            const { recipientNumber, message } = req.body;

            if (!recipientNumber || !message) {
                return res.status(400).json({
                    success: false,
                    error: 'recipientNumber e message são obrigatórios'
                });
            }

            const result = await whatsappService.sendMessage(recipientNumber, message);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Mensagem enviada com sucesso',
                    messageId: result.messageId
                });
            } else {
                res.status(400).json(result);
            }

        } catch (error) {
            console.error('Erro no controller:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }

    async getMessageStatus(req, res) {
        try {
            const { messageId } = req.params;
            
            const result = await whatsappService.getMessageStatus(messageId);
            
            if (result.success) {
                res.json(result);
            } else {
                res.status(404).json(result);
            }

        } catch (error) {
            console.error('Erro ao verificar status:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao verificar status'
            });
        }
    }
}

module.exports = new WhatsAppController();