const axios = require('axios');
const jwt = require('jsonwebtoken'); 
const whatsappConfig = require('../config/whatsapp');
const {HttpsProxyAgent} = require('https-proxy-agent')

class EmbeddedSignupController {

    constructor() {
        this.axiosConfig = {};
        if (process.env.HTTP_PROXY) {
            const proxyUrl = process.env.HTTP_PROXY;
            this.axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
            console.log('✅ Configured axios to use HTTP proxy:', proxyUrl);
        }
    }

    async initiateMetaAuth(req, res) {
        try {
            const redirectUri = process.env.WHATSAPP_REDIRECT_URI || 'http://localhost:3000/api/whatsapp/auth/facebook/callback';
            const appId = process.env.WHATSAPP_APP_ID || whatsappConfig.whatsappAppId;

            if(!appId) {
                return res.status(500).json({ success: false, error: 'App ID not configured' });
            }

            const authUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&`+`state=${this.generateState()}&scope=whatsapp_business_management,whatsapp_business_messaging,business_management`;

            console.log('Redirecting to Meta OAuth URL:', authUrl);
            res.redirect(authUrl);
        } catch (error) {
            console.error('Error initiating Meta auth:', error);
            res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
        }
    }

    async handleMetaCallback(req, res) {
        try {
            const {code, error, error_description} = req.query;

            if (error) {
                console.error('Meta OAuth error:', error, error_description);
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
                return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error_description || error)}`);
            }

            if (!code) {
                return res.status(400).json({ success: false, error: 'Missing authorization code' });
            }

            console.log('Received authorization code from Meta, switching to frontend for token exchange.');

            const tokenResponse = await this.exchangeCodeForToken(code);

            if (!tokenResponse.success) {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
                return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Failed to exchange code for token')}`);
            }

            console.log('Token exchange successful');

            const businessInfo = await this.getBusinessAccountInfo(tokenResponse.access_token);

            await this.saveBusinessAccount({
                access_token: tokenResponse.access_token,
                business_account_id: businessInfo.id,
                phone_number_id: businessInfo.phone_number_id,
                whatsapp_business_account_id: businessInfo.whatsapp_business_account_id,
                display_phone_number: businessInfo.display_phone_number,
                name: businessInfo.name
            })

            const userToken = this.generateUserToken({
                businessAccountId: businessInfo.id,
                phoneNumberId: businessInfo.phone_number_id,
                displayPhoneNumber: businessInfo.display_phone_number,
                name: businessInfo.name,
                apiType: 'meta'
            })

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
            return res.redirect(`${frontendUrl}/auth/meta/callback?token=${userToken}`);
        } catch (error) {
            console.error('Error handling Meta callback:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
            return res.redirect(`${frontendUrl}/login?error=callback_processing_failed`);
        }
    }

    async processEmbeddedSignup(req, res) {
        try {
            const {code, state} = req.body;

            if (!code) {
                return res.status(400).json({ success: false, error: 'Missing authorization code' });
            }

            const tokenResponse = await this.exchangeCodeForToken(code);
            if (!tokenResponse.success) {
                return res.status(500).json({ success: false, error: 'Failed to exchange code for token', details: tokenResponse });
            }

            const businessInfo = await this.getBusinessAccountInfo(tokenResponse.access_token);

            await this.saveBusinessAccount({
                access_token: tokenResponse.access_token,
                business_account_id: businessInfo.id,
                phone_number_id: businessInfo.phone_number_id,
                whatsapp_business_account_id: businessInfo.whatsapp_business_account_id
            })

            res.json({ success: true, message: 'Business account linked successfully', data: {
                business_account_id: businessInfo.id,
                phone_number_id: businessInfo.phone_number_id,
            } });

        } catch (error) {
            console.error('Error processing embedded signup:', error);
            res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
        }
    }

    async exchangeCodeForToken(code) {
        const base_url = 'https://graph.facebook.com/v23.0/';
        
        try {
            console.log('🔵 Trocando código por token com os seguintes parâmetros:');
            console.log('- App ID:', process.env.WHATSAPP_APP_ID);
            console.log('- Redirect URI:', process.env.WHATSAPP_REDIRECT_URI);
            console.log('- Code:', code.substring(0, 20) + '...');
            
            const response = await axios.get(`${base_url}oauth/access_token`, {
                ...this.axiosConfig,
                params: {
                    client_id: process.env.WHATSAPP_APP_ID || whatsappConfig.whatsappAppId,
                    client_secret: process.env.WHATSAPP_APP_SECRET || whatsappConfig.whatsappAppSecret,
                    redirect_uri: process.env.WHATSAPP_REDIRECT_URI || whatsappConfig.whatsappRedirectUri,
                    code: code
                },
                timeout: 30000,
                headers: {
                    'User-Agent': 'WhatsApp_business-Backend/1.0'
                }
            });

            console.log('✅ Token obtido com sucesso');

            console.log('\n' + '='.repeat(80));
            console.log('🔑 TOKEN PARA DEBUG - Copie o comando abaixo e execute:');
            console.log('='.repeat(80));
            console.log(`npm run checkWABA ${response.data.access_token}`);
            console.log('='.repeat(80) + '\n');

            return {
                success: true,
                access_token: response.data.access_token,
            }
        } catch (error) {
            console.error('❌ Error exchanging code for token:', error.response ? error.response.data : error.message);
            return {
                success: false,
                error: error.response ? error.response.data : error.message
            }
        }
    }

    async getBusinessAccountInfo(accessToken) {
        const base_url = 'https://graph.facebook.com/v23.0/';

        try {
            console.log('🔵 Buscando informações da conta comercial...');
            
            // 1. Buscar as contas comerciais do cliente (não do app)
            console.log('🔍 Buscando contas comerciais do cliente...');
            const businessResponse = await axios.get(`${base_url}me/businesses`, {
                ...this.axiosConfig,
                headers: {
                    Authorization: `Bearer ${accessToken}`
                },
                timeout: 30000
            });

            if (!businessResponse.data.data || businessResponse.data.data.length === 0) {
                throw new Error('Nenhuma conta comercial encontrada para este cliente');
            }

            const business = businessResponse.data.data[0];
            console.log('✅ Conta comercial do cliente encontrada:', business.name, '(ID:', business.id + ')');

            // 2. Buscar WABAs vinculadas à conta comercial do cliente
            console.log('🔍 Buscando WABAs vinculadas à conta comercial do cliente...');
            
            // Tentar os dois endpoints possíveis
            let wabaIds = [];
            
            try {
                const wabaResponse1 = await axios.get(`${base_url}${business.id}/client_whatsapp_business_accounts`, {
                    ...this.axiosConfig,
                    params: { access_token: accessToken },
                    timeout: 30000
                });
                
                if (wabaResponse1.data.data && wabaResponse1.data.data.length > 0) {
                    wabaIds = wabaResponse1.data.data.map(waba => waba.id);
                    console.log('✅ WABAs encontradas via client_whatsapp_business_accounts:', wabaIds);
                }
            } catch (error) {
                console.log('⚠️ Endpoint client_whatsapp_business_accounts não retornou dados');
            }

            // Se não encontrou, tentar endpoint alternativo
            if (wabaIds.length === 0) {
                try {
                    const wabaResponse2 = await axios.get(`${base_url}${business.id}/owned_whatsapp_business_accounts`, {
                        ...this.axiosConfig,
                        params: { access_token: accessToken },
                        timeout: 30000
                    });
                    
                    if (wabaResponse2.data.data && wabaResponse2.data.data.length > 0) {
                        wabaIds = wabaResponse2.data.data.map(waba => waba.id);
                        console.log('✅ WABAs encontradas via owned_whatsapp_business_accounts:', wabaIds);
                    }
                } catch (error) {
                    console.log('⚠️ Endpoint owned_whatsapp_business_accounts não retornou dados');
                }
            }

            // Se ainda não encontrou, buscar via debug_token (fallback)
            if (wabaIds.length === 0) {
                console.log('⚠️ Tentando buscar WABAs via permissões do token (fallback)...');
                const debugResponse = await axios.get(`${base_url}debug_token`, {
                    ...this.axiosConfig,
                    params: { 
                        input_token: accessToken,
                        access_token: `${process.env.WHATSAPP_APP_ID}|${process.env.WHATSAPP_APP_SECRET}`
                    },
                    timeout: 30000
                });

                const granularScopes = debugResponse.data.data.granular_scopes || [];
                const wabaScopes = granularScopes.find(s => s.scope === 'whatsapp_business_management');
                
                if (wabaScopes && wabaScopes.target_ids && wabaScopes.target_ids.length > 0) {
                    wabaIds = wabaScopes.target_ids;
                    console.log('✅ WABAs encontradas via debug_token:', wabaIds);
                }
            }

            if (wabaIds.length === 0) {
                throw new Error('Nenhuma WhatsApp Business Account encontrada para este cliente');
            }

            // 3. Buscar a primeira WABA que tenha número de telefone
            console.log('🔍 Buscando WABA com número de telefone ativo...');
            
            let wabaWithPhone = null;
            
            for (const wabaId of wabaIds) {
                try {
                    console.log(`   📱 Verificando WABA ${wabaId}...`);
                    
                    // Buscar detalhes da WABA
                    const wabaDetailsResponse = await axios.get(`${base_url}${wabaId}`, {
                        ...this.axiosConfig,
                        params: {
                            fields: 'id,name,timezone_id,message_template_namespace',
                            access_token: accessToken
                        },
                        timeout: 30000
                    });

                    const wabaDetails = wabaDetailsResponse.data;
                    
                    // Buscar números de telefone desta WABA
                    const phoneResponse = await axios.get(`${base_url}${wabaId}/phone_numbers`, {
                        ...this.axiosConfig,
                        params: {
                            access_token: accessToken
                        },
                        timeout: 30000
                    });

                    if (phoneResponse.data.data && phoneResponse.data.data.length > 0) {
                        const phoneNumber = phoneResponse.data.data[0];
                        console.log(`   ✅ WABA ${wabaId} tem número de telefone:`, phoneNumber.display_phone_number);
                        
                        wabaWithPhone = {
                            wabaId: wabaId,
                            wabaDetails: wabaDetails,
                            phoneNumber: phoneNumber
                        };
                        break; // Encontrou uma WABA com telefone, pode parar
                    } else {
                        console.log(`   ⚠️ WABA ${wabaId} não possui números de telefone, ignorando...`);
                    }
                } catch (error) {
                    console.log(`   ❌ Erro ao verificar WABA ${wabaId}:`, error.message);
                    // Continua para a próxima WABA
                }
            }

            if (!wabaWithPhone) {
                throw new Error('Nenhuma WhatsApp Business Account com número de telefone ativo foi encontrada');
            }

            console.log('✅ WABA selecionada:', wabaWithPhone.wabaDetails.name || wabaWithPhone.wabaId);
            console.log('✅ Número de telefone:', wabaWithPhone.phoneNumber.display_phone_number);

            return {
                id: business.id,
                name: business.name,
                phone_number_id: wabaWithPhone.phoneNumber.id,
                display_phone_number: wabaWithPhone.phoneNumber.display_phone_number,
                whatsapp_business_account_id: wabaWithPhone.wabaId
            }
        } catch (error) {
            console.error('❌ Error fetching business account info:', error.response ? error.response.data : error.message);
            throw new Error(error.response ? error.response.data.error?.message || error.response.data : error.message);
        }
    }

    async saveBusinessAccount(accountData) {
        console.log('💾 Salvando dados da conta comercial:', accountData);

        const fs = require('fs');
        const path = require('path');

        const configDir = path.join(__dirname, '../config');
        const configPath = path.join(configDir, 'businessAccount.json');

        // Cria o diretório se não existir
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
            console.log('📁 Diretório de config criado');
        }

        let accounts = [];
        if (fs.existsSync(configPath)) {
            try {
                const fileContent = fs.readFileSync(configPath, 'utf-8');
                accounts = JSON.parse(fileContent);
            } catch (error) {
                console.error('⚠️ Erro ao ler arquivo existente, criando novo:', error.message);
                accounts = [];
            }
        }

        const existingIndex = accounts.findIndex(acc => acc.business_account_id === accountData.business_account_id);
        if (existingIndex >= 0) {
            accounts[existingIndex] = {...accounts[existingIndex], ...accountData, updated_at: new Date().toISOString()};
            console.log('✅ Conta atualizada');
        } else {
            accounts.push({...accountData, created_at: new Date().toISOString()});
            console.log('✅ Nova conta adicionada');
        }

        fs.writeFileSync(configPath, JSON.stringify(accounts, null, 2));
        console.log('💾 Arquivo salvo em:', configPath);
    }

    generateUserToken(userData) {
        const secret = process.env.JWT_SECRET || 'default-secret-key-change-this';

        console.log('🔑 Gerando token JWT para o usuário');
        
        return jwt.sign(
            {
                id: userData.businessAccountId,
                name: userData.name,
                phoneNumberId: userData.phoneNumberId,
                displayPhoneNumber: userData.displayPhoneNumber,
                apiType: 'meta'
            },
            secret,
            { expiresIn: '7d' }
        )
    }

    generateState() {
        return require('crypto').randomBytes(16).toString('hex');
    }
}

module.exports = new EmbeddedSignupController();