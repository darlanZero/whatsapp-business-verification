const axios = require('axios');

class EmbeddedSignupController {
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
}

module.exports = new EmbeddedSignupController();