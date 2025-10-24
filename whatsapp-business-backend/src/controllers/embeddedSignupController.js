const axios = require('axios');
const jwt = require('jsonwebtoken'); 
const whatsappConfig = require('../config/whatsapp');

class EmbeddedSignupController {

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
                params: {
                    client_id: process.env.WHATSAPP_APP_ID,
                    client_secret: process.env.WHATSAPP_APP_SECRET,
                    redirect_uri: process.env.WHATSAPP_REDIRECT_URI,
                    code: code
                }
            });

            console.log('✅ Token obtido com sucesso');
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
            
            // 1. Buscar a conta comercial (Business)
            const response = await axios.get(`${base_url}me/businesses`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            if (!response.data.data || response.data.data.length === 0) {
                throw new Error('Nenhuma conta comercial encontrada');
            }

            const businessAccount = response.data.data[0];
            console.log('✅ Conta comercial encontrada:', businessAccount.name);

            // 2. Buscar as WhatsApp Business Accounts (WABA) vinculadas ao Business
            console.log('🔵 Buscando WhatsApp Business Accounts...');
            const wabaResponse = await axios.get(`${base_url}${businessAccount.id}/client_whatsapp_business_accounts`, {
                params: {
                    access_token: accessToken
                }
            });

            if (!wabaResponse.data.data || wabaResponse.data.data.length === 0) {
                throw new Error('Nenhuma WhatsApp Business Account encontrada');
            }

            const waba = wabaResponse.data.data[0];
            console.log('✅ WABA encontrada:', waba.id);

            // 3. Buscar os números de telefone da WABA
            console.log('🔵 Buscando números de telefone...');
            const phoneResponse = await axios.get(`${base_url}${waba.id}/phone_numbers`, {
                params: {
                    access_token: accessToken
                }
            });

            if (!phoneResponse.data.data || phoneResponse.data.data.length === 0) {
                throw new Error('Nenhum número de telefone encontrado');
            }

            const phoneNumber = phoneResponse.data.data[0];
            console.log('✅ Número de telefone encontrado:', phoneNumber.display_phone_number);

            return {
                id: businessAccount.id,
                name: businessAccount.name,
                phone_number_id: phoneNumber.id,
                display_phone_number: phoneNumber.display_phone_number,
                whatsapp_business_account_id: waba.id
            }
        } catch (error) {
            console.error('❌ Error fetching business account info:', error.response ? error.response.data : error.message);
            throw new Error(error.response ? error.response.data : error.message);
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