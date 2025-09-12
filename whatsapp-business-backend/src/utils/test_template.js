const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testHealth() {
    try {
        console.log('🔍 Testando conexão com servidor...');
        const response = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Servidor OK:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Servidor não está rodando:', error.message);
        return false;
    }
}

async function testTemplate() {
    try {
        console.log('🧪 Iniciando teste de template...');

        // Verificar se servidor está rodando
        const serverOk = await testHealth();
        if (!serverOk) {
            console.log('💡 Execute: npm start (em outro terminal)');
            return;
        }

        const testData = {
            recipientNumber: "5531972071758", // Substitua pelo número de teste
            templateName: "hello_world", // Nome do template criado no Business Manager
            language: "en_US",
            parameters: [] // Adicione parâmetros se necessário
        };

        console.log('📤 Enviando template:');
        console.log(`   DE: +1 555 194 6565 (ID: 779807591876914)`);
        console.log(`   PARA: +55 31 97207-1758`);
        console.log(`   Template: ${testData.templateName}`);

        const response = await axios.post(`${BASE_URL}/api/whatsapp/send-template`, testData);
        
        console.log('✅ Template enviado com sucesso:', response.data);
        
        // Verificar status após 3 segundos
        if (response.data.messageId) {
            console.log('⏳ Aguardando 3 segundos para verificar status...');
            
            setTimeout(async () => {
                try {
                    const statusResponse = await axios.get(`${BASE_URL}/api/whatsapp/message-status/${response.data.messageId}`);
                    console.log('📊 Status da mensagem:', statusResponse.data);
                } catch (statusError) {
                    console.error('❌ Erro ao verificar status:', statusError.response?.data || statusError.message);
                }
            }, 3000);
        }

    } catch (error) {
        console.error('❌ Erro no teste:', error.response?.data || error.message);
        
       if (error.response?.data?.error?.code === 131030) {
            console.log('\n🔧 SOLUÇÃO:');
            console.log('1. Vá para developers.facebook.com');
            console.log('2. Seu App → WhatsApp → API Setup');
            console.log('3. Na seção "To", adicione seu número');
            console.log('4. Verifique o número via SMS/WhatsApp');
            console.log('5. Teste novamente\n');
        }
    }
}

async function testMessage() {
    try {
        console.log('📝 Testando envio de mensagem simples...');

        const testData = {
            recipientNumber: "5531972071758", // Substitua pelo número de teste
            message: "Olá! Esta é uma mensagem de teste do backend."
        };

        const response = await axios.post(`${BASE_URL}/api/whatsapp/send-message`, testData);
        console.log('✅ Mensagem enviada:', response.data);

    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error.response?.data || error.message);
    }
}

// Executar testes
async function runTests() {
    console.log('🚀 Iniciando testes do WhatsApp Business API Backend\n');
    
    await testTemplate();
    
    setTimeout(async () => {
        console.log('\n' + '='.repeat(50));
        await testMessage();
    }, 5000);
}

// Executar apenas se chamado diretamente
if (require.main === module) {
    runTests();
}

module.exports = { testTemplate, testMessage, testHealth };