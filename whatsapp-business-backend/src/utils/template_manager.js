const axios = require('axios');
const whatsappConfig = require('../config/whatsapp_config');

class TemplateCreator {
    constructor() {
        this.baseUrl = `https://graph.facebook.com/v13.0/${whatsappConfig.businessAccountId}`;
        this.headers = {
            'Authorization': `Bearer ${whatsappConfig.token}`,
            'Content-Type': 'application/json'
        }
    }

    async createTemplate(templateData) {
        try {
            console.log(`🔨 Creating template "${templateData.name}"...`)

            const response = await axios.post(`${this.baseUrl}/message_templates`, templateData, { headers: this.headers });
            console.log('✅ Template created successfully!');
            console.log(`Template ID: ${response.data.id}`);
            console.log('Note: It may take some time for the template to be approved by WhatsApp.');

            return {
                success: true,
                templateId: response.data.id,
                templateName: templateData.name,
                status: 'PENDING',
                data: response.data
            }


        } catch (error) {
            console.error('❌ Error creating template:', error.response ? error.response.data : error.message);

            this.handleCreationError(error);

            return { success: false, error: error.response ? error.response.data : error.message };
        }
    }

    async getTemplateStatus(templateName) {
        try {
            console.log(`🔍 Checking status of template "${templateName}"...`)

            const response = await axios.get(`${this.baseUrl}/message_templates?name=${templateName}`, { headers: this.headers });

            if (response.data.data.length === 0) {
                console.log(`❌ Template "${templateName}" not found.`);
                return {
                    success: false,
                    error: 'Template not found'
                }
            }

            const template = response.data.data[0];

            console.log(`✅ Template found. ${templateName}: ${template.status}`);
            console.log(`Template ID: ${template.id}`);
            console.log(`Language: ${template.language}`);
            console.log(`Category: ${template.category}`);

            if (template.status === 'REJECTED') {
                console.log('❌ Templaate rejected by Meta.')
                if (template.rejected_reason) {
                    console.log(`Reason: ${template.rejected_reason}`);
                }
            } else if (template.status === 'APPROVED') {
                console.log('✅ Template approved and ready to use!');
            } else if (template.status === 'PENDING') {
                console.log('⏳ Template is still pending approval. Please check again later.');
            }

            return {
                success: true,
                template: template,
                status: template.status
            }
        } catch (error) {
            console.error('❌ Error fetching template status:', error.response ? error.response.data : error.message);
            return { success: false, error: error.response ? error.response.data : error.message };
        }
    }

    async listAllTemplates() {
        try {
            console.log(`🔍 Listing all templates...\n`)

            const response = await axios.get(`${this.baseUrl}/message_templates`, { headers: this.headers });

            if (response.data.data.length === 0) {
                console.log(`❌ No templates found.`);
                return [];
            }

            console.log(`✅ Found ${response.data.data.length} templates:\n`);
            console.log('='.repeat(80));

            response.data.data.forEach((template, index) => {
                const statusIcon = this.getStatusIcon(template.status);
                console.log(`${index + 1}. ${statusIcon} "${template.name}"`);
                console.log(`   Status: ${template.status}`);
                console.log(`   Idioma: ${template.language}`);
                console.log(`   Categoria: ${template.category}`);
                console.log(`   ID: ${template.id}`);
                console.log('─'.repeat(60));
            })

            return response.data.data;
        } catch (error) {
            console.error('❌ Error listing templates:', error.response ? error.response.data : error.message);
            return [];
        }
    }

    async deleteTemplate(templateName) {
        try {
            const statusResponse = await this.getTemplateStatus(templateName);

            if (!statusResponse.success) {
                return statusResponse;
            }

            const templateId = statusResponse.template.id;

            console.log(`🗑️ Deleting template "${templateName}" (ID: ${templateId})...`)

            const response = await axios.delete(`${this.baseUrl}/message_templates?name=${templateName}`, { headers: this.headers });
            console.log('✅ Template deleted successfully!');

            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error deleting template:', error.response ? error.response.data : error.message);
            return { success: false, error: error.response ? error.response.data : error.message };
        }
    }

    getStatusIcon(status) {
        switch (status) {
            case 'APPROVED':
                return '✅';
            case 'REJECTED':
                return '❌';
            case 'PENDING':
                return '⏳';
            case 'DISABLED':
                return '🚫';
            default:
                return '❓';
        }
    }

    handleCreationError(error) {
        const errorCode = error.response?.data?.error?.code;
        const errorMessage = error.response?.data?.error?.message;

        console.log('💡 Troubleshooting tips:');

        if (errorCode === 100) {
            console.log('- Verify if your Business Account ID is correct.');
            console.log('- Ensure that your access token is valid and has not expired.');
        } else if (errorMessage?.includes('name')) {
            console.log('- The template name may already be in use. Try a different name.');
            console.log('- Ensure the template name follows WhatsApp naming conventions (lowercase, no spaces, underscores allowed).');
        } else if (errorMessage?.includes('language')) {
            console.log('- Check if the language code is valid and supported by WhatsApp (e.g., "en_US", "es", "pt_BR").');
        } else if (errorMessage?.includes('category')) {
            console.log('- Ensure the category is one of the allowed values: "AUTHENTICATION", "MARKETING", "UTILITY".');
        }
    }

    getPresetTemplates() {
        return {
            boasVindas: {
                name: "boas_vindas",
                language: "pt_BR",
                category: "UTILITY",
                components: [
                    {
                        type: "HEADER",
                        format: "TEXT",
                        text: "Bem-vindo(a)!"
                    },
                    {
                        type: "BODY",
                        text: "Olá {{1}}! Seja bem-vindo(a) ao nosso serviço. Estamos aqui para ajudá-lo(a)."
                    },
                    {
                        type: "FOOTER",
                        text: "Equipe de Suporte"
                    }
                ]
            },
            confirmacaoPedido: {
                name: "confirmacao_pedido",
                language: "pt_BR",
                category: "UTILITY",
                components: [
                    {
                        type: "HEADER",
                        format: "TEXT",
                        text: "Pedido Confirmado"
                    },
                    {
                        type: "BODY",
                        text: "Olá {{1}}! Seu pedido #{{2}} no valor de {{3}} foi confirmado e será processado em breve."
                    },
                    {
                        type: "FOOTER",
                        text: "Obrigado pela preferência!"
                    }
                ]
            },
            lembreteSimples: {
                name: "lembrete_simples",
                language: "pt_BR",
                category: "UTILITY",
                components: [
                    {
                        type: "BODY",
                        text: "🔔 Lembrete: {{1}}. Não esqueça!"
                    }
                ]
            }
        };
    }
}

async function createCustomTemplate() {
    const templateName = process.argv[3];
    const presetName = process.argv[4];

    if (!templateName) {
        console.log('Usage: npm run create_template <template_name> <preset_name>');
        return;
    }

    const creator = new TemplateCreator();
    if (presetName) {
        const presets = creator.getPresetTemplates();
        const preset = presets[presetName];
        if (!preset) {
            console.log(`❌ Preset "${presetName}" not found. Available presets: ${Object.keys(presets).join(', ')}`);
            return;
        }

        const templateData = {...preset, name: templateName};
        await creator.createTemplate(templateData);
    } else {
        console.log('💡 To create a custom preset, edit the script and add your structure');
        console.log('Or use one preset: npm run create_template <preset_name>');
    }
}

async function checkTemplateStatus() {
    const templateName = process.argv[3];

    if (!templateName) {
        console.log('Usage: npm run check_template_status <template_name>');
        return;
    }

    const creator = new TemplateCreator();
    await creator.getTemplateStatus(templateName);
}

async function listTemplates() {
    const creator = new TemplateCreator();
    await creator.listAllTemplates();
}

async function deleteTemplate() {
    const templateName = process.argv[3];

    if (!templateName) {
        console.log('Usage: npm run delete_template <template_name>');
        return;
    }

    console.log(`⚠️ Warning: Deleting a template is irreversible. Make sure you want to delete "${templateName}".\n`);

    const creator = new TemplateCreator();
    await creator.deleteTemplate(templateName);
}

async function monitorTemplateStatus() {
    const templateName = process.argv[3];

    const intervalMinutes = parseInt(process.argv[4]) || 5;

    if (!templateName) {
        console.log('Usage: npm run monitor_template_status <template_name> [interval_minutes]');
        return;
    }

    console.log(`⏳ Monitoring status of template "${templateName}" every ${intervalMinutes} minutes...`);
    console.log('Press Ctrl+C to stop.\n');

    const creator = new TemplateCreator();

    const checkStatus = async () => {
        const result = await creator.getTemplateStatus(templateName);

        if (result.success) {
            const status = result.status;
            if (status === 'APPROVED') {
                console.log(`✅ Template "${templateName}" approved! Stopping monitoring.`);
                process.exit(0);
            } else if (status === 'REJECTED') {
                console.log(`❌ Template "${templateName}" rejected. Stopping monitoring.`);
                process.exit(0);
            }
        } else {
            console.log(`[${new Date().toLocaleTimeString()}] ❌ Error checking status`);
        }

        console.log('_'.repeat(60));
    }

    await checkStatus();
    setInterval(checkStatus, intervalMinutes * 60 * 1000);
}

if (require.main === module) {
    const action = process.argv[2];

    switch (action) {
        case 'create':
            createCustomTemplate();
            break;
        case 'status':
            checkTemplateStatus();
            break;
        case 'list':
            listTemplates();
            break;
        case 'delete':
            deleteTemplate();
            break;
        case 'monitor':
            monitorTemplateStatus();
            break;
        default:
            console.log('🚀 Template Manager - WhatsApp Business API\n');
            console.log('📋 Available commands:');
            console.log('  npm run template_manager create NAME [PRESET]  - Create template');
            console.log('  npm run template_manager status NAME           - Check status');
            console.log('  npm run template_manager list                  - List All templates');
            console.log('  npm run template_manager delete NAME          - Delete template');
            console.log('  npm run template_manager monitor NAME [MIN]   - Check status');
    }
}