const axios = require('axios');
const whatsappConfig = require('../config/whatsapp');
const getBusinessAccountId = require('./get_business_account');

async function listTemplates() {
    try {
        console.log('🔍 Listing available templates...');

        let businessAccountId = whatsappConfig.businessAccountId;

        if (!businessAccountId) {
            console.log('⚠️ Business Account ID not set in config. Fetching it...');
            businessAccountId = await getBusinessAccountId();

            if (!businessAccountId) {
                console.log('❌ Cannot list templates without Business Account ID.');
                return [];
            }

            console.log(`✅ Business Account ID obtained: ${businessAccountId}`);
            whatsappConfig.businessAccountId = businessAccountId; // Save for future use
        }
        const response = await axios.get(
            `https://graph.facebook.com/v23.0/${businessAccountId}/message_templates`, {
                headers: {
                    Authorization: `Bearer ${whatsappConfig.token}`
                }
            }
        )

        if (response.data.data.length === 0) {
            console.log('⚠️ No templates available. Please create one in the Facebook Business Manager.');
            return [];
        }

        console.log('✅ Available templates:');
        console.log('='.repeat(80));

        response.data.data.forEach((template, index) => {
            console.log(`${index + 1}. Name: ${template.name}`);
            console.log(`   Language: ${template.language}`);
            console.log(`   Status: ${template.status}`);
            console.log(`   Category: ${template.category}`);

            if (template.components && template.components.length > 0) {
                console.log('   Components:');
                template.components.forEach((comp, compIndex) => {
                    console.log(`     ${compIndex + 1}. Type: ${comp.type}`);
                    if (comp.text) {
                        console.log(`        Text: ${comp.text}`);
                    }
                    if (comp.example && comp.example.body_text) {
                        console.log(`        Example: ${comp.example.body_text.join(', ')}`);
                    }
                })
            }
            console.log('-'.repeat(60));
        })
        return response.data.data;
    } catch (error) {
        console.error('❌ Error trying to list templates:', error.response?.data || error.message);
        return [];
    }
}

async function findTemplate(templateName) {
    try {
        const templates = await listTemplates();
        const found = templates.find(t => t.name === templateName);

        if (found) {
            console.log(`🔎 Template "${templateName}" found.`);
            console.log(`   Language: ${found.language}`);
            console.log(`   Status: ${found.status}`);
            console.log(`   Category: ${found.category}`);
            return found;
        } else {
            console.log(`❌ Template "${templateName}" not found.`);
            return null;
        }
    } catch (error) {
        console.error('❌ Error trying to find template:', error.message);
        return null;
    }
}

if (require.main === module) {
    listTemplates();
}

module.exports = {
    listTemplates,
    findTemplate
};