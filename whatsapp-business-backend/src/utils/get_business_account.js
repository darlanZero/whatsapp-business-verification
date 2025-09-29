const axios = require('axios');
const whatsappConfig = require('../config/whatsapp');

async function getBusinessAccountId() {
    try {
        console.log('🔍 Buscando WhatsApp Business Account ID...\n');

        // Método 1: Informações básicas do phone number (sem o campo problemático)
        try {
            const phoneResponse = await axios.get(
                `https://graph.facebook.com/v23.0/${whatsappConfig.phoneNumberId}?fields=id,verified_name,display_phone_number`,
                {
                    headers: {
                        'Authorization': `Bearer ${whatsappConfig.token}`
                    }
                }
            );

            console.log('📱 Informações do Phone Number:');
            console.log(`   Phone Number ID: ${phoneResponse.data.id}`);
            console.log(`   Nome verificado: ${phoneResponse.data.verified_name}`);
            console.log(`   Número exibido: ${phoneResponse.data.display_phone_number}`);
        } catch (phoneError) {
            console.log('⚠️  Erro ao buscar info do phone number:', phoneError.response?.data?.error?.message);
        }

        // Método 2: Buscar WhatsApp Business Accounts diretamente
        console.log('\n🔍 Buscando WhatsApp Business Accounts...');
        
        try {
            const wbaResponse = await axios.get(
                'https://graph.facebook.com/v23.0/me/whatsapp_business_accounts',
                {
                    headers: {
                        'Authorization': `Bearer ${whatsappConfig.token}`
                    }
                }
            );

            if (wbaResponse.data.data && wbaResponse.data.data.length > 0) {
                console.log('✅ WhatsApp Business Accounts encontrados:');
                wbaResponse.data.data.forEach((account, index) => {
                    console.log(`   ${index + 1}. Nome: ${account.name || 'Sem nome'}`);
                    console.log(`       ID: ${account.id}`);
                    console.log(`       Status: ${account.account_review_status || 'N/A'}`);
                });
                
                const whatsappBusinessAccountId = wbaResponse.data.data[0].id;
                console.log(`\n✅ WhatsApp Business Account ID encontrado: ${whatsappBusinessAccountId}`);
                return whatsappBusinessAccountId;
            } else {
                console.log('❌ Nenhum WhatsApp Business Account encontrado');
            }
        } catch (wbaError) {
            console.log('⚠️  Erro ao buscar WhatsApp Business Accounts:', wbaError.response?.data?.error?.message || wbaError.message);
        }

        // Método 3: Buscar Business Accounts gerais
        console.log('\n🔍 Buscando Business Accounts gerais...');
        
        try {
            const accountsResponse = await axios.get(
                'https://graph.facebook.com/v23.0/me/businesses',
                {
                    headers: {
                        'Authorization': `Bearer ${whatsappConfig.token}`
                    }
                }
            );

            if (accountsResponse.data.data && accountsResponse.data.data.length > 0) {
                console.log('✅ Business Accounts encontrados:');
                accountsResponse.data.data.forEach((account, index) => {
                    console.log(`   ${index + 1}. Nome: ${account.name}`);
                    console.log(`       ID: ${account.id}`);
                });
                
                const businessAccountId = accountsResponse.data.data[0].id;
                console.log(`\n✅ Business Account ID encontrado: ${businessAccountId}`);
                return businessAccountId;
            } else {
                console.log('❌ Nenhum Business Account encontrado');
            }
        } catch (businessError) {
            console.log('⚠️  Erro ao buscar Business Accounts:', businessError.response?.data?.error?.message || businessError.message);
        }

        // Método 4: Tentar descobrir via permissões do token
        console.log('\n🔍 Analisando permissões do token...');
        
        try {
            const debugResponse = await axios.get(
                `https://graph.facebook.com/v23.0/debug_token?input_token=${whatsappConfig.token}`,
                {
                    headers: {
                        'Authorization': `Bearer ${whatsappConfig.token}`
                    }
                }
            );

            console.log('🔑 Informações do token:');
            if (debugResponse.data.data) {
                console.log(`   App ID: ${debugResponse.data.data.app_id}`);
                console.log(`   Válido: ${debugResponse.data.data.is_valid}`);
                console.log(`   Expira em: ${new Date(debugResponse.data.data.expires_at * 1000).toLocaleString()}`);
                
                if (debugResponse.data.data.scopes) {
                    console.log(`   Permissões: ${debugResponse.data.data.scopes.join(', ')}`);
                }
            }
        } catch (debugError) {
            console.log('⚠️  Erro ao analisar token:', debugError.response?.data?.error?.message || debugError.message);
        }

        // Se chegou até aqui, nenhum método funcionou
        throw new Error('Nenhum Business Account ID foi encontrado com os métodos automáticos');

    } catch (error) {
        console.error('\n❌ Erro geral:', error.message);

        console.log('\n🔧 SOLUÇÃO MANUAL:');
        console.log('1. Vá para: https://developers.facebook.com');
        console.log('2. Acesse: Seu App → WhatsApp → API Setup');
        console.log('3. Na página, procure por uma seção chamada:');
        console.log('   - "WhatsApp Business Account ID" ou');
        console.log('   - "Business Account" ou');
        console.log('   - Uma tabela com informações da conta');
        console.log('4. Copie o ID (geralmente é um número longo)');
        console.log('5. Cole no whatsapp.js:\n');
        console.log('   businessAccountId: "SEU_ID_COPIADO_AQUI",');

        return null;
    }
}

// Função para validar um Business Account ID manualmente inserido
async function validateBusinessAccountId(businessAccountId) {
    try {
        console.log(`🔍 Validando Business Account ID: ${businessAccountId}...`);
        
        const response = await axios.get(
            `https://graph.facebook.com/v23.0/${businessAccountId}?fields=id,name`,
            {
                headers: {
                    'Authorization': `Bearer ${whatsappConfig.token}`
                }
            }
        );

        if (response.data.id) {
            console.log(`✅ Business Account ID válido!`);
            console.log(`   ID: ${response.data.id}`);
            console.log(`   Nome: ${response.data.name || 'N/A'}`);
            return true;
        }

        return false;

    } catch (error) {
        console.error(`❌ Business Account ID inválido:`, error.response?.data?.error?.message || error.message);
        return false;
    }
}

// Função para testar templates com Business Account ID específico
async function testTemplatesWithBusinessAccountId(businessAccountId) {
    try {
        console.log(`🧪 Testando listagem de templates com Business Account ID: ${businessAccountId}...`);
        
        const response = await axios.get(
            `https://graph.facebook.com/v23.0/${businessAccountId}/message_templates`,
            {
                headers: {
                    'Authorization': `Bearer ${whatsappConfig.token}`
                }
            }
        );

        console.log(`✅ Sucesso! Encontrados ${response.data.data.length} templates:`);
        
        if (response.data.data.length > 0) {
            response.data.data.forEach((template, index) => {
                console.log(`   ${index + 1}. ${template.name} (${template.status})`);
            });
        } else {
            console.log('   Nenhum template criado ainda.');
        }

        return response.data.data;

    } catch (error) {
        console.error(`❌ Erro ao testar templates:`, error.response?.data?.error?.message || error.message);
        return [];
    }
}

// Função principal melhorada
async function getAndSaveBusinessAccountId() {
    try {
        console.log('🚀 Iniciando busca completa do WhatsApp Business Account ID...\n');

        const businessAccountId = await getBusinessAccountId();
        
        if (businessAccountId) {
            console.log('\n📝 Para salvar permanentemente, adicione ao whatsapp.js:');
            console.log(`businessAccountId: "${businessAccountId}",`);
            
            // Validar se o ID funciona para templates
            console.log('\n🧪 Testando se o ID funciona para listar templates...');
            await testTemplatesWithBusinessAccountId(businessAccountId);
            
            // Salvar temporariamente na configuração atual
            whatsappConfig.businessAccountId = businessAccountId;
            console.log('\n✅ Business Account ID salvo temporariamente na configuração atual.');
            
            return businessAccountId;
        } else {
            console.log('\n❌ Busca automática falhou.');
            console.log('\n💡 PRÓXIMOS PASSOS:');
            console.log('1. Encontre o ID manualmente (instruções acima)');
            console.log('2. Teste com: npm run validate-business-id SEU_ID_AQUI');
            console.log('3. Se válido, adicione ao whatsapp.js');
            
            return null;
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        return null;
    }
}

// Função para validar um ID passado como parâmetro
async function validateProvidedBusinessAccountId() {
    const providedId = process.argv[3]; // npm run validate-business-id SEU_ID
    
    if (!providedId) {
        console.log('❌ Uso: npm run validate-business-id SEU_BUSINESS_ACCOUNT_ID');
        return;
    }
    
    console.log(`🔍 Validando Business Account ID fornecido: ${providedId}`);
    
    const isValid = await validateBusinessAccountId(providedId);
    
    if (isValid) {
        console.log('\n🧪 Testando templates...');
        await testTemplatesWithBusinessAccountId(providedId);
        
        console.log('\n✅ ID válido! Adicione ao whatsapp.js:');
        console.log(`businessAccountId: "${providedId}",`);
    } else {
        console.log('\n❌ ID inválido. Verifique o valor copiado.');
    }
}

if (require.main === module) {
    const command = process.argv[2];
    
    if (command === 'validate') {
        validateProvidedBusinessAccountId();
    } else {
        getAndSaveBusinessAccountId();
    }
}

module.exports = { getBusinessAccountId, validateBusinessAccountId, testTemplatesWithBusinessAccountId };