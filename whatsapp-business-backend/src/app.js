const express = require('express');
const cors = require('cors');
const whatsappRoutes = require('./routes/whatsappRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes - usar o router diretamente
app.use('/api/whatsapp', whatsappRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'WhatsApp Business API Backend',
        timestamp: new Date().toISOString()
    });
});

// Rota de teste
app.get('/', (req, res) => {
    res.json({
        message: 'WhatsApp Business API Backend',
        endpoints: {
            health: '/health',
            sendTemplate: 'POST /api/whatsapp/send-template',
            sendMessage: 'POST /api/whatsapp/send-message',
            messageStatus: 'GET /api/whatsapp/message-status/:messageId'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: err.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint não encontrado',
        path: req.originalUrl
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 WhatsApp Business API Backend iniciado`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
});

module.exports = app;