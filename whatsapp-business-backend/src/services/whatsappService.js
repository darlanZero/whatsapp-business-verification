const axios = require('axios');
const whatsappConfig = require('../config/whatsapp');

class WhatsAppService {
    async sendTemplate(to, templateName, language = 'pt_BR', parameters = []) {
        try {
            const payload = {
                messaging_product: "whatsapp",
                to: to,
                type: "template",
                template: {
                    name: templateName,
                    language: {
                        code: language
                    },
                    components: parameters.length > 0 ? [{
                        type: "body",
                        parameters: parameters.map(param => ({
                            type: "text",
                            text: param
                        }))
                    }] : []
                }
            };

            const response = await axios.post(whatsappConfig.apiUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${whatsappConfig.token}`,
                    'Content-Type': 'application/json'
                }
            });

            return {
                success: true,
                messageId: response.data.messages[0].id,
                data: response.data
            };

        } catch (error) {
            console.error('Erro ao enviar template:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    async getMessageStatus(messageId) {
        try {
            const response = await axios.get(
                `https://graph.facebook.com/v13.0/${messageId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${whatsappConfig.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Erro ao buscar status:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    async sendMessage(to, message) {
        try {
            const payload = {
                messaging_product: "whatsapp",
                to: to,
                type: "text",
                text: { body: message }
            };

            const response = await axios.post(whatsappConfig.apiUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${whatsappConfig.token}`,
                    'Content-Type': 'application/json'
                }
            });

            return {
                success: true,
                messageId: response.data.messages[0].id,
                data: response.data
            };

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }
}

module.exports = new WhatsAppService();