const axios = require('axios');

class EmbeddedSignupController {

    async initiateMetaAuth(req, res) {
        try {
            const redirectUri = process.env.WHATSAPP_REDIRECT_URI || 'http://localhost:3000/auth/facebook/callback';
            const appId = process.env.WHATSAPP_APP_ID;

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
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
                return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error_description || error)}`);
            }

            if (!code) {
                return res.status(400).json({ success: false, error: 'Missing authorization code' });
            }

            console.log('Received authorization code from Meta, switching to frontend for token exchange.');

            const tokenResponse = await this.exchangeCodeForToken(code);

            if (!tokenResponse.success) {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
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

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${frontendUrl}/auth/meta/callback?token=${userToken}`);
        } catch (error) {
            console.error('Error handling Meta callback:', error);
            res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
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
            const response = await axios.get(`${base_url}oauth/access_token`, {
                client_id: process.env.WHATSAPP_APP_ID,
                client_secret: process.env.WHATSAPP_APP_SECRET,
                redirect_uri: process.env.WHATSAPP_REDIRECT_URI,
                code: code


            })

            return {
                success: true,
                access_token: response.data.access_token,
            }
        } catch (error) {
            console.error('Error exchanging code for token:', error.response ? error.response.data : error.message);
            return {
                success: false,
                error: error.response ? error.response.data : error.message
            }
        }
    }

    async getBusinessAccountInfo(accessToken) {
        const base_url = 'https://graph.facebook.com/v23.0/';

        try {
            const response = await axios.get(`${base_url}me/businesses'`, {
            headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            const businessAccount = response.data.data[0];

            const phoneResponse = await axios.get(`${base_url}${businessAccount.id}/phone_numbers`, {
                params: {
                    access_token: accessToken
                }
            }
            );

            const phoneNumber = phoneResponse.data.data[0];

            return {
                id: businessAccount.id,
                name: businessAccount.name,
                phone_number_id: phoneNumber.id,
                display_phone_number: phoneNumber.display_phone_number,
                whatsapp_business_account_id: phoneNumber.whatsapp_business_account_id
            }
        } catch (error) {
            console.error('Error fetching business account info:', error.response ? error.response.data : error.message);
            throw new Error(error.response ? error.response.data : error.message);
        }
    }

    async saveBusinessAccount(accountData) {
        console.log('Saving business account data:', accountData);

        const fs = require('fs');
        const path = require('path');

        const configPath = path.join(__dirname, '../config/businessAccount.json');

        let accounts = [];
        if (fs.existsSync(configPath)) {
            accounts = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }

        const existingIndex = accounts.findIndex(acc => acc.business_account_id === accountData.business_account_id);
        if (existingIndex >= 0) {
            accounts[existingIndex] = {...accounts[existingIndex], ...accountData};
        } else {
            accounts.push(accountData);
        }

        fs.writeFileSync(configPath, JSON.stringify(accounts, null, 2));
    }

    async generateUserToken(userData) {
        const secret = process.env.JWT_SECRET || 'default'

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