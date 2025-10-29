require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function checkWABA() {
    const accessToken = process.argv[2];
    
    if (!accessToken) {
        console.error('❌ Uso: node check_waba.js <ACCESS_TOKEN>');
        console.log('💡 Execute o fluxo OAuth primeiro para obter o token');
        process.exit(1);
    }

    const axiosConfig = {};
    if (process.env.HTTP_PROXY) {
        axiosConfig.httpsAgent = new HttpsProxyAgent(process.env.HTTP_PROXY);
        console.log('✅ Usando proxy:', process.env.HTTP_PROXY);
    }

    const base_url = 'https://graph.facebook.com/v23.0/';

    try {
        console.log('\n🔍 1. Buscando contas comerciais (Businesses)...');
        const businessResponse = await axios.get(`${base_url}me/businesses`, {
            ...axiosConfig,
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 30000
        });

        console.log('\n✅ Contas comerciais encontradas:');
        businessResponse.data.data.forEach((business, index) => {
            console.log(`   ${index + 1}. ${business.name} (ID: ${business.id})`);
        });

        if (businessResponse.data.data.length === 0) {
            console.error('\n❌ Nenhuma conta comercial encontrada!');
            return;
        }

        const businessId = businessResponse.data.data[0].id;
        console.log(`\n🔍 2. Buscando WABAs vinculadas ao Business ID: ${businessId}...`);

        // Tentar diferentes endpoints
        console.log('\n📍 Tentativa 1: client_whatsapp_business_accounts');
        try {
            const wabaResponse1 = await axios.get(`${base_url}${businessId}/client_whatsapp_business_accounts`, {
                ...axiosConfig,
                params: { access_token: accessToken },
                timeout: 30000
            });
            console.log('✅ Resposta:', JSON.stringify(wabaResponse1.data, null, 2));
        } catch (error) {
            console.log('❌ Erro:', error.response?.data || error.message);
        }

        console.log('\n📍 Tentativa 2: owned_whatsapp_business_accounts');
        try {
            const wabaResponse2 = await axios.get(`${base_url}${businessId}/owned_whatsapp_business_accounts`, {
                ...axiosConfig,
                params: { access_token: accessToken },
                timeout: 30000
            });
            console.log('✅ Resposta:', JSON.stringify(wabaResponse2.data, null, 2));
        } catch (error) {
            console.log('❌ Erro:', error.response?.data || error.message);
        }

        console.log('\n📍 Tentativa 3: Buscar WABAs direto do token (me)');
        try {
            const meResponse = await axios.get(`${base_url}me`, {
                ...axiosConfig,
                params: { 
                    fields: 'id,name,whatsapp_business_accounts',
                    access_token: accessToken 
                },
                timeout: 30000
            });
            console.log('✅ Resposta:', JSON.stringify(meResponse.data, null, 2));
        } catch (error) {
            console.log('❌ Erro:', error.response?.data || error.message);
        }

        console.log('\n📍 Tentativa 4: Debug Token');
        try {
            const debugResponse = await axios.get(`${base_url}debug_token`, {
                ...axiosConfig,
                params: { 
                    input_token: accessToken,
                    access_token: `${process.env.WHATSAPP_APP_ID}|${process.env.WHATSAPP_APP_SECRET}`
                },
                timeout: 30000
            });
            console.log('✅ Informações do token:');
            console.log(JSON.stringify(debugResponse.data, null, 2));
        } catch (error) {
            console.log('❌ Erro:', error.response?.data || error.message);
        }

    } catch (error) {
        console.error('\n❌ Erro geral:', error.response?.data || error.message);
    }
}

checkWABA();