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

            const accountInfo = await this.getBusinessAccountInfo(tokenResponse.access_token);

            // Salvar todas as contas comerciais
            for (const businessAccount of accountInfo.businessAccounts) {
                await this.saveBusinessAccount({
                    access_token: tokenResponse.access_token,
                    user_id: accountInfo.user.id,
                    user_name: accountInfo.user.name,
                    user_email: accountInfo.user.email,
                    business_account_id: businessAccount.id,
                    phone_number_id: businessAccount.phone_number_id,
                    whatsapp_business_account_id: businessAccount.whatsapp_business_account_id,
                    display_phone_number: businessAccount.display_phone_number,
                    business_name: businessAccount.name,
                    whatsapp_business_account_name: businessAccount.whatsapp_business_account_name
                })
            }

            const userToken = this.generateUserToken({
                userId: accountInfo.user.id,
                userName: accountInfo.user.name,
                userEmail: accountInfo.user.email,
                businessAccounts: accountInfo.businessAccounts,
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

            const accountInfo = await this.getBusinessAccountInfo(tokenResponse.access_token);

            // Salvar todas as contas comerciais
            for (const businessAccount of accountInfo.businessAccounts) {
                await this.saveBusinessAccount({
                    access_token: tokenResponse.access_token,
                    user_id: accountInfo.user.id,
                    user_name: accountInfo.user.name,
                    user_email: accountInfo.user.email,
                    business_account_id: businessAccount.id,
                    phone_number_id: businessAccount.phone_number_id,
                    whatsapp_business_account_id: businessAccount.whatsapp_business_account_id,
                    display_phone_number: businessAccount.display_phone_number,
                    business_name: businessAccount.name,
                    whatsapp_business_account_name: businessAccount.whatsapp_business_account_name
                })
            }

            res.json({ 
                success: true, 
                message: 'Business accounts linked successfully', 
                data: {
                    user: accountInfo.user,
                    businessAccounts: accountInfo.businessAccounts.map(ba => ({
                        business_account_id: ba.id,
                        business_name: ba.name,
                        phone_number_id: ba.phone_number_id,
                        display_phone_number: ba.display_phone_number,
                        whatsapp_business_account_id: ba.whatsapp_business_account_id,
                        whatsapp_business_account_name: ba.whatsapp_business_account_name
                    }))
                } 
            });

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
            console.log('🔵 Buscando informações do usuário e contas comerciais...');
            
            // 1. Buscar informações do usuário
            console.log('🔍 Buscando informações do usuário...');
            const userResponse = await axios.get(`${base_url}me`, {
                ...this.axiosConfig,
                params: {
                    fields: 'id,name,email',
                    access_token: accessToken
                },
                timeout: 30000
            });

            const user = userResponse.data;
            console.log('✅ Usuário encontrado:', user.name, '(ID:', user.id + ')');

            // 2. Buscar as contas comerciais do usuário
            console.log('🔍 Buscando contas comerciais do usuário...');
            const businessResponse = await axios.get(`${base_url}me/businesses`, {
                ...this.axiosConfig,
                headers: {
                    Authorization: `Bearer ${accessToken}`
                },
                timeout: 30000
            });

            if (!businessResponse.data.data || businessResponse.data.data.length === 0) {
                throw new Error('Nenhuma conta comercial encontrada para este usuário');
            }

            const businesses = businessResponse.data.data;
            console.log('✅ Contas comerciais encontradas:', businesses.length);

            // 3. Método 1: Tentar buscar WABAs via /me/whatsapp_business_accounts
            console.log('🔍 Tentando buscar WABAs via /me...');
            let wabas = [];
            try {
                const response = await axios.get(`${base_url}me/`, {
                    ...this.axiosConfig,
                    params: {
                        fields: 'whatsapp_business_accounts{id,name,timezone_id,message_template_namespace}',
                        access_token: accessToken
                    },
                    timeout: 30000
                });

                wabas = response.data.whatsapp_business_accounts?.data || [];

                if (wabas.length > 0) {
                    console.log('✅ WABAs encontradas via /me:', wabas.length);
                } else {
                    console.log('⚠️ Nenhuma WABA encontrada via /me, tentando fallback...');
                }
            } catch (error) {
                console.log('⚠️ Erro ao buscar WABAs via /me:', error.response?.data || error.message);
            }

            // 4. Método 2: Fallback via debug_token se necessário
            if (wabas.length === 0) {
                console.log('🔄 Usando debug_token como fallback...');
                const debugResponse = await axios.get(`${base_url}debug_token`, {
                    ...this.axiosConfig,
                    params: {
                        input_token: accessToken,
                        access_token: `${process.env.WHATSAPP_APP_ID || whatsappConfig.whatsappAppId}|${process.env.WHATSAPP_APP_SECRET || whatsappConfig.whatsappAppSecret}`
                    },
                    timeout: 30000
                });

                const wabaScopes = debugResponse.data.data.granular_scopes?.find(
                    s => s.scope === 'whatsapp_business_management'
                );

                if (!wabaScopes || !wabaScopes.target_ids || wabaScopes.target_ids.length === 0) {
                    throw new Error('Nenhuma WABA encontrada no token');
                }

                console.log('✅ WABAs encontradas via debug_token:', wabaScopes.target_ids.length);

                wabas = await Promise.all(
                    wabaScopes.target_ids.map(id => 
                        axios.get(`${base_url}${id}`, {
                            ...this.axiosConfig,
                            params: {
                                access_token: accessToken,
                                fields: 'id,name,timezone_id,message_template_namespace',
                            }
                        }).then(response => response.data)
                    )
                );
            }

            // 5. Buscar todas as WABAs com números de telefone e associá-las às empresas corretas
            const businessAccounts = await this.findAllWabasWithPhoneAndBusiness(wabas, businesses, accessToken, base_url);

            if (businessAccounts.length === 0) {
                throw new Error('Nenhuma WABA com número de telefone ativo encontrada');
            }

            // 6. NOVO: Agrupar por empresa única (sem duplicar empresas)
            const groupedByBusiness = this.groupByUniqueBusiness(businessAccounts);

            console.log('✅ Total de empresas únicas encontradas:', groupedByBusiness.length);

            return {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                },
                businessAccounts: groupedByBusiness
            };
            
        } catch (error) {
            console.error('❌ Erro ao buscar informações da conta:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || error.message);
        }
    }

    /**
     * NOVO: Busca empresa real de cada WABA via API reversa
     */
    async findBusinessForWaba(wabaId, accessToken, base_url) {
        try {
            // Buscar informações detalhadas da WABA incluindo owned_by
            const wabaResponse = await axios.get(`${base_url}${wabaId}`, {
                ...this.axiosConfig,
                params: {
                    fields: 'id,name,owner_business_info',
                    access_token: accessToken
                },
                timeout: 30000
            });

            const ownerBusinessInfo = wabaResponse.data.owner_business_info;
            
            if (ownerBusinessInfo && ownerBusinessInfo.id) {
                console.log(`✅ WABA ${wabaId} pertence à empresa ID: ${ownerBusinessInfo.id}`);
                
                // Buscar detalhes da empresa
                try {
                    const businessResponse = await axios.get(`${base_url}${ownerBusinessInfo.id}`, {
                        ...this.axiosConfig,
                        params: {
                            fields: 'id,name',
                            access_token: accessToken
                        },
                        timeout: 30000
                    });
                    
                    return businessResponse.data;
                } catch (error) {
                    console.log(`⚠️ Não foi possível buscar detalhes da empresa ${ownerBusinessInfo.id}`);
                    return { id: ownerBusinessInfo.id, name: ownerBusinessInfo.name || 'Empresa sem nome' };
                }
            }
            
            return null;
        } catch (error) {
            console.log(`⚠️ Erro ao buscar empresa dona da WABA ${wabaId}:`, error.response?.data || error.message);
            return null;
        }
    }

    async findAllWabasWithPhoneAndBusiness(wabas, businesses, accessToken, base_url) {
        const businessAccountsMap = new Map(); // Usar Map para agrupar por empresa

        for (const waba of wabas) {
            try {
                console.log(`🔍 Verificando WABA: ${waba.name} (ID: ${waba.id})...`);
                
                const phoneResponse = await axios.get(`${base_url}${waba.id}/phone_numbers`, {
                    ...this.axiosConfig,
                    params: {
                        access_token: accessToken
                    },
                    timeout: 30000
                });

                const phoneNumbers = phoneResponse.data.data || [];

                if (phoneNumbers.length === 0) {
                    console.log(`⚠️ WABA ${waba.name} não possui números de telefone`);
                    continue;
                }

                // NOVO: Buscar empresa real desta WABA via API
                let associatedBusiness = await this.findBusinessForWaba(waba.id, accessToken, base_url);
                
                // Se não encontrou via API, tentar nas empresas do usuário
                if (!associatedBusiness) {
                    console.log(`🔄 Buscando WABA ${waba.name} nas empresas do usuário...`);
                    associatedBusiness = businesses.find(b => b.id === waba.business_id);
                }
                
                // Se ainda não encontrou, usar primeira empresa como último recurso
                if (!associatedBusiness && businesses.length > 0) {
                    console.log(`⚠️ WABA ${waba.name} não tem empresa associada, usando primeira empresa como fallback`);
                    associatedBusiness = businesses[0];
                }

                if (!associatedBusiness) {
                    console.log(`❌ Não foi possível associar WABA ${waba.name} a nenhuma empresa`);
                    continue;
                }

                console.log(`✅ WABA ${waba.name} associada à empresa: ${associatedBusiness.name}`);

                // Agrupar números por empresa
                for (const phone of phoneNumbers) {
                    const businessKey = associatedBusiness.id;
                    
                    if (!businessAccountsMap.has(businessKey)) {
                        businessAccountsMap.set(businessKey, {
                            id: associatedBusiness.id,
                            name: associatedBusiness.name,
                            wabas: []
                        });
                    }
                    
                    businessAccountsMap.get(businessKey).wabas.push({
                        whatsapp_business_account_id: waba.id,
                        whatsapp_business_account_name: waba.name,
                        phone_number_id: phone.id,
                        display_phone_number: phone.display_phone_number
                    });
                }
            } catch (error) {
                console.error(`❌ Erro ao verificar WABA ${waba.id}:`, error.response?.data || error.message);
            }
        }
        
        // Converter Map para array
        return Array.from(businessAccountsMap.values());
    }

    /**
     * NOVO: Agrupa WABAs por empresa única
     * Cada empresa aparece apenas uma vez com todos seus números
     */
    groupByUniqueBusiness(businessAccounts) {
        const uniqueBusinesses = [];
        const businessMap = new Map();

        for (const account of businessAccounts) {
            if (!businessMap.has(account.id)) {
                businessMap.set(account.id, {
                    id: account.id,
                    name: account.name,
                    wabas: [...account.wabas] // Copiar array de WABAs
                });
                uniqueBusinesses.push(businessMap.get(account.id));
            } else {
                // Se a empresa já existe, adicionar as WABAs dela
                const existing = businessMap.get(account.id);
                existing.wabas.push(...account.wabas);
            }
        }

        return uniqueBusinesses;
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

        const existingIndex = accounts.findIndex(acc => 
            acc.business_account_id === accountData.business_account_id && 
            acc.whatsapp_business_account_id === accountData.whatsapp_business_account_id
        );
        
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
        
        // Transformar estrutura de wabas para formato mais simples
        const businessAccountsForToken = userData.businessAccounts.map(business => {
            // Se a empresa tem apenas um número, usar estrutura simples
            if (business.wabas && business.wabas.length === 1) {
                const waba = business.wabas[0];
                return {
                    businessAccountId: business.id,
                    businessName: business.name,
                    phoneNumberId: waba.phone_number_id,
                    displayPhoneNumber: waba.display_phone_number,
                    wabaId: waba.whatsapp_business_account_id,
                    wabaName: waba.whatsapp_business_account_name
                };
            }
            
            // Se tem múltiplos números, usar o primeiro mas indicar que tem mais
            const firstWaba = business.wabas[0];
            return {
                businessAccountId: business.id,
                businessName: business.name,
                phoneNumberId: firstWaba.phone_number_id,
                displayPhoneNumber: firstWaba.display_phone_number,
                wabaId: firstWaba.whatsapp_business_account_id,
                wabaName: firstWaba.whatsapp_business_account_name,
                hasMultipleNumbers: business.wabas.length > 1,
                totalNumbers: business.wabas.length
            };
        });

        return jwt.sign(
            {
                id: userData.userId,
                name: userData.userName,
                email: userData.userEmail,
                businessAccounts: businessAccountsForToken,
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