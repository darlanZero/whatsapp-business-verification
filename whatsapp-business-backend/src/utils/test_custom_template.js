const axios = require('axios');
const { findTemplate, listTemplates } = require('./list_templates');

const BASE_URL = 'http://localhost:3000'; 

async function testHealth() {
    try {
        console.log('🔍 Testing Connection with server...');
        const response = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Server is healthy:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Error testing server health:', error.message);
        return false;
    }
}

async function testCustomTemplate() {
    try {
        console.log('🧪 Starting custom template test...');

        const serverOk = await testHealth();
        if (!serverOk) {
            console.log('💡 Run: npm start (in another terminal)');
            return;
        }

        console.log('🔍 Listing available templates...');
        const templates = await listTemplates();
        if (templates.length === 0) {
            console.log('⚠️ No templates available. Please create one in the Facebook Business Manager.');
            return;
        }

        const customTemplateConfig = {
            recipientNumber: "5531972071758", // Replace with test number
            templateName: "teste", // Name of the template created in Business Manager
            language: "en", // Language code
            parameters: [] // Add parameters if necessary
        }

        console.log(`🔍 verifying if custom template "${customTemplateConfig.templateName}" exists...`);
        const templateInfo = await findTemplate(customTemplateConfig.templateName);

        if (!templateInfo) {
            console.log('\n available templates to use:')
            templates.forEach((t,i) => {
                console.log(`   ${i+1}. ${t.name} (${t.language}) - Status: ${t.status}`);
            })
            return;
        }

        if (templateInfo.status !== 'APPROVED') {
            console.log(`❌ Template "${customTemplateConfig.templateName}" is not approved. Current status: ${templateInfo.status}`);
            console.log('💡 Please approve the template in the Facebook Business Manager before testing.');
            return;
        }

        console.log('📤 Sending custom template:');
        console.log(`   FROM: +1 555 194 6565 (ID: 779807591876914)`);
        console.log(`   TO: +55 31 97207-1758`);
        console.log(`   Template: ${customTemplateConfig.templateName}`);
        console.log(`   Language: ${customTemplateConfig.language}`);
        console.log(`   Parameters: ${JSON.stringify(customTemplateConfig.parameters)}`);

        const response = await axios.post(`${BASE_URL}/api/whatsapp/send-template`, customTemplateConfig);
        console.log('✅ Custom template sent successfully:', response.data);
        console.log('Verify your WhatsApp to see the received message.');

        return response.data;
    } catch (error) {
        console.error('❌ Error in custom template test:', error.response?.data || error.message);

        if (error.response?.data?.error?.code === 131030) {
            console.log('\n🔧 Your number is not in the recipient list');
        } else if (error.response?.data?.error?.code === 132000) {
            console.log('\n🔧 Template not found or not approved');
        } else if (error.response?.data?.error?.code === 132015) {
            console.log('\n🔧 Template parameters are incorrect');
        }

        return null;
    }
}

async function testWithDifferentTemplates() {
    try{
        console.log('Testing multiple templates...\n');
        const templatesToTest = [
            { name: 'hello_world', language: 'en_US', parameters: [] },
            { name: 'teste', language: 'en', parameters: [] },
            { name: 'app_review_message', language: 'pt_BR', parameters: [] }
        ];

        for (const template of templatesToTest) {
            console.log(`\n🧪 Testing template: ${template.name}`);

            const testData = {
                recipientNumber: "5531972071758", // Replace with test number
                templateName: template.name,
                language: template.language,
                parameters: template.parameters
            }

            try {
                const response = await axios.post(`${BASE_URL}/api/whatsapp/send-template`, testData);
                console.log('✅ Template sent successfully:', response.data);
                console.log('Check your WhatsApp to see the received message.');
            } catch (error) {
                console.error('❌ Error sending template:', error.response?.data || error.message);
            }

            await new Promise(res => setTimeout(res, 2000)); // Wait 2 seconds between tests
        }
    } catch (error) {
        console.error('❌ Error testing templates:', error.message);
    }
}

async function runInteractiveTest() {
    console.log('Starting interactive custom template test...\n');

    const choice = process.argv[2];

    switch (choice) {
        case 'list':
            await listTemplates();
            break;
        case 'custom':
            await testCustomTemplate();
            break;
        case 'multiple':
            await testWithDifferentTemplates();
            break;
        default:
            console.log('Usage:')
            console.log('  npm run test-custom list       # List available templates');
            console.log('  npm run test-custom custom     # Test a custom template');
            console.log('  npm run test-custom multiple   # Test multiple templates');
            console.log('\n Edit the archive test_custom_template.js to change test parameters as needed');
    }
}

if (require.main === module) {
    runInteractiveTest();
}

module.exports = {
    testCustomTemplate,
    testWithDifferentTemplates,
};