require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const whatsappRoutes = require('./routes/whatsappRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Log para verificar se as variáveis foram carregadas
console.log('📝 Verificando variáveis de ambiente:');
console.log('- WHATSAPP_APP_ID:', process.env.WHATSAPP_APP_ID ? '✅ Configurado' : '❌ Não configurado');
console.log('- WHATSAPP_APP_SECRET:', process.env.WHATSAPP_APP_SECRET ? '✅ Configurado' : '❌ Não configurado');
console.log('- WHATSAPP_REDIRECT_URI:', process.env.WHATSAPP_REDIRECT_URI || '❌ Não configurado');
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL || '❌ Não configurado');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '✅ Configurado' : '❌ Não configurado');

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
            messageStatus: 'GET /api/whatsapp/message-status/:messageId',
            metaAuth: 'GET /api/whatsapp/auth/facebook',
            metaCallback: 'GET /api/whatsapp/auth/facebook/callback'
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