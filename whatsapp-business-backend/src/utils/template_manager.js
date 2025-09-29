const axios = require('axios');
const whatsappConfig = require('../config/whatsapp');

class TemplateCreator {
    constructor() {
        this.baseUrl = `https://graph.facebook.com/v23.0/${whatsappConfig.businessAccountId}`;
        this.headers = {
            'Authorization': `Bearer ${whatsappConfig.token}`,
            'Content-Type': 'application/json'
        }
    }

    validateTemplateStructure(templateData) {
        console.log('🔍 Validating template structure...');

        let hasErrors = false;
        const issues = [];

        if (!templateData.components || templateData.components.length === 0) {
            issues.push('❌ No components defined. At least a BODY component is required.');
            hasErrors = true;
        }

        templateData.components.forEach((component, index) => {
            if (component.text) {
                const variables = component.text.match(/\{\{\d+\}\}/g) || [];

                if (variables.length > 0) {
                    if (component.type === 'BODY' && !component.example?.body_text) {
                        issues.push(`❌ Component ${index + 1} (BODY) has variables but no example body_text provided.`);
                        hasErrors = true;
                    } else if (component.type === 'HEADER' && !component.example?.header_text) {
                        issues.push(`❌ Component ${index + 1} (HEADER) has variables but no example header_text provided.`);
                        hasErrors = true;
                    }

                    if (component.example?.body_text) {
                        const exampleCount = component.example.body_text[0]?.length || 0;
                        if (exampleCount < variables.length) {
                            issues.push(`❌ Component ${index + 1} (BODY) has ${variables.length} variables but only ${exampleCount} example values.`);
                            hasErrors = true;
                        }
                    }

                    const textLength = component.text.replace(/\{\{\d+\}\}/g, '').length;
                    const variableCount = variables.length;

                    if (textLength < variableCount * 10) {
                        issues.push(`⚠️ Component ${index + 1} (${component.type}) may have too many variables for its text length. Consider reducing variables or increasing text.`);
                    }
                }
            }
        })

        if (hasErrors) {
            console.log('❌ Validation failed with the following issues:');
            issues.forEach(issue => console.log(issue));
            return false;
        } else if (issues.length > 0) {
            console.log('⚠️ Validation completed with warnings:');
            issues.forEach(issue => console.log(issue));
            console.log('Template may still be rejected by WhatsApp.');
        } else {
            console.log('✅ Template structure looks good!');
        }

        return true;
    }

    async createTemplate(templateData) {
        try {
            console.log(`🔨 Creating template "${templateData.name}"...`)

            if (!this.validateTemplateStructure(templateData)) {
                console.log('❌ Template creation aborted due to validation errors.');
                return { success: false, error: 'Template validation failed' };
            }

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
                console.log('❌ Template rejected by Meta.')
                if (template.rejected_reason) {
                    console.log(`Reason: ${template.rejected_reason}`);
                    this.analyzeRejectionReason(template.rejected_reason);
                }

                if (template.quality_score) {
                    console.log(`Quality Score: ${JSON.stringify(template.quality_score)}`);
                }

                console.log('\n📝 Template components for analysis:');
                if (template.components) {
                    template.components.forEach((comp, index) => {
                        console.log(`   ${index + 1}. Type: ${comp.type}`);
                        if (comp.text) console.log(`      Text: "${comp.text}"`);
                        if (comp.format) console.log(`      Format: ${comp.format}`);
                    });
                }
            } else if (template.status === 'APPROVED') {
                console.log('✅ Template approved and ready to use!');
            } else if (template.status === 'PENDING') {
                console.log('⏳ Template is still pending approval. Please check again later.');
            }

            return {
                success: true,
                template: template,
                status: template.status,
                rejectedReason: template.rejected_reason || null,
                qualityScore: template.quality_score || null
            }
        } catch (error) {
            console.error('❌ Error fetching template status:', error.response ? error.response.data : error.message);
            return { success: false, error: error.response ? error.response.data : error.message };
        }
    }

    analyzeRejectionReason(rejectedReason) {
        console.log('\n💡 Analysis and suggestions:');
        
        const reason = rejectedReason.toLowerCase();
        
        if (reason.includes('promotional') || reason.includes('marketing')) {
            console.log('🔍 Issue: Content detected as promotional/marketing');
            console.log('✅ Solutions:');
            console.log('   - Remove words like: "bem-vindo", "ofertas", "promoção"');
            console.log('   - Use neutral language: "confirmado", "processado", "código"');
            console.log('   - Focus on functional messages, not promotional ones');
            
        } else if (reason.includes('policy') || reason.includes('violation')) {
            console.log('🔍 Issue: Policy violation detected');
            console.log('✅ Solutions:');
            console.log('   - Review WhatsApp Business Policy');
            console.log('   - Avoid sensitive topics (finance, health without authorization)');
            console.log('   - Use appropriate category (UTILITY vs MARKETING)');
            
        } else if (reason.includes('spam') || reason.includes('unsolicited')) {
            console.log('🔍 Issue: Content looks like spam');
            console.log('✅ Solutions:');
            console.log('   - Make message more specific and functional');
            console.log('   - Add context like order numbers, user names');
            console.log('   - Avoid generic greetings');
            
        } else if (reason.includes('language') || reason.includes('grammar')) {
            console.log('🔍 Issue: Language or grammar problems');
            console.log('✅ Solutions:');
            console.log('   - Check spelling and grammar');
            console.log('   - Use proper Portuguese/English');
            console.log('   - Avoid informal language or slang');
            
        } else if (reason.includes('format') || reason.includes('structure')) {
            console.log('🔍 Issue: Template format/structure problems');
            console.log('✅ Solutions:');
            console.log('   - Check component types (HEADER, BODY, FOOTER)');
            console.log('   - Verify parameter placement {{1}}, {{2}}');
            console.log('   - Follow WhatsApp template guidelines');
            
        } else if (reason.includes('category')) {
            console.log('🔍 Issue: Wrong category selected');
            console.log('✅ Solutions:');
            console.log('   - UTILITY: confirmations, notifications, codes');
            console.log('   - MARKETING: promotions (requires opt-in)');
            console.log('   - AUTHENTICATION: verification codes only');
            
        } else {
            console.log('🔍 Issue: General rejection');
            console.log('✅ General solutions:');
            console.log('   - Simplify the message');
            console.log('   - Use more neutral, functional language');
            console.log('   - Check if similar approved templates exist');
            console.log('   - Consider changing category to UTILITY');
        }
        
        console.log('\n📋 Recommended next steps:');
        console.log('1. Delete this rejected template');
        console.log('2. Create a simpler version');
        console.log('3. Test with very basic content first');
        console.log('4. Gradually add complexity once approved\n');
    }

    async analyzeRejectedTemplates() {
        try {
            console.log('🔍 Analyzing all rejected templates...\n');
            
            const templates = await this.listAllTemplates();
            const rejectedTemplates = templates.filter(t => t.status === 'REJECTED');
            
            if (rejectedTemplates.length === 0) {
                console.log('✅ No rejected templates found!');
                return;
            }
            
            console.log(`\n📊 Found ${rejectedTemplates.length} rejected templates:\n`);
            console.log('='.repeat(90));
            
            rejectedTemplates.forEach((template, index) => {
                console.log(`${index + 1}. ❌ "${template.name}"`);
                console.log(`   Category: ${template.category}`);
                console.log(`   Language: ${template.language}`);
                
                if (template.rejected_reason) {
                    console.log(`   Reason: ${template.rejected_reason}`);
                    this.analyzeRejectionReason(template.rejected_reason);
                } else {
                    console.log('   Reason: Not specified');
                }
                
                console.log('─'.repeat(80));
            });
            
            // Estatísticas
            const categories = rejectedTemplates.reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + 1;
                return acc;
            }, {});
            
            console.log('\n📈 Rejection statistics by category:');
            Object.entries(categories).forEach(([category, count]) => {
                console.log(`   ${category}: ${count} rejected`);
            });
            
        } catch (error) {
            console.error('❌ Error analyzing rejected templates:', error);
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

                if (template.status === 'REJECTED' && template.rejected_reason) {
                    console.log(`   Reason for rejection: ${template.rejected_reason}`);
                }
    
                if (template.created_time) {
                    const createdDate = new Date(template.created_time * 1000).toLocaleString();
                    console.log(`   Created at: ${createdDate}`);
                }

                console.log('─'.repeat(80));
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

    // SUBSTITUA os presets problemáticos por estes:
getPresetTemplates() {
    return {
        // ✅ FUNCIONA: Template sem variáveis
        mensagemSimples: {
            name: "mensagem_simples",
            language: "pt_BR",
            category: "UTILITY",
            components: [
                {
                    type: "BODY",
                    text: "Operação realizada com sucesso."
                }
            ]
        },

        alertaSimples: {
            name: "alerta_simples",
            language: "pt_BR",
            category: "UTILITY",
            components: [
                {
                    type: "HEADER",
                    format: "TEXT",
                    text: "Sistema"
                },
                {
                    type: "BODY",
                    text: "Sua conta foi atualizada com sucesso."
                }
            ]
        },

        // ✅ CORRIGIDO: Códigos com contexto específico
        codigoVerificacao: {
            name: "codigo_verificacao_especifico",
            language: "pt_BR",
            category: "AUTHENTICATION",
            components: [
                {
                    type: "BODY",
                    text: "Seu código de verificação de acesso é {{1}}. Este código expira em 10 minutos.",
                    example: {
                        body_text: [["123456"]]
                    }
                },
                {
                    type: "FOOTER",
                    text: "Não compartilhe este código com ninguém"
                }
            ]
        },

        // ✅ CORRIGIDO: Status com contexto específico
        statusPedidoEspecifico: {
            name: "status_pedido_especifico",
            language: "pt_BR",
            category: "UTILITY",
            components: [
                {
                    type: "HEADER",
                    format: "TEXT",
                    text: "Atualização do Pedido"
                },
                {
                    type: "BODY",
                    text: "Seu pedido número {{1}} foi atualizado para o status: {{2}}. Acompanhe pelo nosso sistema.",
                    example: {
                        body_text: [["#12345", "Em trânsito"]]
                    }
                }
            ]
        },

        // ✅ CORRIGIDO: Confirmação com contexto específico
        confirmacaoPagamento: {
            name: "confirmacao_pagamento",
            language: "pt_BR",
            category: "UTILITY",
            components: [
                {
                    type: "HEADER",
                    format: "TEXT",
                    text: "Pagamento Confirmado"
                },
                {
                    type: "BODY",
                    text: "Seu pagamento de {{1}} foi processado com sucesso. Número da transação: {{2}}.",
                    example: {
                        body_text: [["R$ 99,90", "TXN789456"]]
                    }
                },
                {
                    type: "FOOTER",
                    text: "Obrigado pela preferência"
                }
            ]
        },

        // ✅ NOVO: Agendamento específico
        confirmacaoAgendamento: {
            name: "confirmacao_agendamento",
            language: "pt_BR",
            category: "UTILITY",
            components: [
                {
                    type: "HEADER",
                    format: "TEXT",
                    text: "Agendamento Confirmado"
                },
                {
                    type: "BODY",
                    text: "Seu agendamento para {{1}} foi confirmado para o dia {{2}} às {{3}}.",
                    example: {
                        body_text: [["consulta médica", "15/09/2024", "14:30"]]
                    }
                }
            ]
        },

        // ✅ NOVO: Notificação de entrega
        notificacaoEntrega: {
            name: "notificacao_entrega",
            language: "pt_BR",
            category: "UTILITY",
            components: [
                {
                    type: "BODY",
                    text: "Seu pedido {{1}} chegou ao centro de distribuição {{2}} e será entregue em até {{3}} dias úteis.",
                    example: {
                        body_text: [["#12345", "São Paulo", "2"]]
                    }
                }
            ]
        },

        // ✅ NOVO: Alerta de segurança específico
        alertaLoginSeguranca: {
            name: "alerta_login_seguranca",
            language: "pt_BR",
            category: "UTILITY",
            components: [
                {
                    type: "HEADER",
                    format: "TEXT",
                    text: "Alerta de Segurança"
                },
                {
                    type: "BODY",
                    text: "Detectamos um novo acesso à sua conta em {{1}} no dia {{2}}. Se não foi você, altere sua senha imediatamente.",
                    example: {
                        body_text: [["São Paulo, SP", "12/09/2024"]]
                    }
                }
            ]
        },

        // ✅ NOVO: Renovação de serviço
        lembreteRenovacao: {
            name: "lembrete_renovacao",
            language: "pt_BR",
            category: "UTILITY",
            components: [
                {
                    type: "HEADER",
                    format: "TEXT",
                    text: "Lembrete de Renovação"
                },
                {
                    type: "BODY",
                    text: "Seu plano {{1}} vence em {{2}} dias. Renove agora para não perder o acesso aos serviços.",
                    example: {
                        body_text: [["Premium", "7"]]
                    }
                }
            ]
        },

        // ✅ NOVO: Confirmação de cadastro específica
        confirmacaoCadastro: {
            name: "confirmacao_cadastro_completo",
            language: "pt_BR",
            category: "UTILITY",
            components: [
                {
                    type: "HEADER",
                    format: "TEXT",
                    text: "Cadastro Realizado"
                },
                {
                    type: "BODY",
                    text: "Olá {{1}}! Seu cadastro foi realizado com sucesso. Seu ID de usuário é {{2}}.",
                    example: {
                        body_text: [["João Silva", "USR789123"]]
                    }
                },
                {
                    type: "FOOTER",
                    text: "Bem-vindo à nossa plataforma"
                }
            ]
        },

        // ✅ NOVO: Template muito específico - quase sempre aprovado
        codigoRecuperacaoSenha: {
            name: "codigo_recuperacao_senha",
            language: "pt_BR",
            category: "AUTHENTICATION",
            components: [
                {
                    type: "BODY",
                    text: "Use o código {{1}} para redefinir sua senha. Este código é válido por 15 minutos e só pode ser usado uma vez.",
                    example: {
                        body_text: [["456789"]]
                    }
                }
            ]
        }
    };
}}

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
        case 'analyze_rejected':
            const creator = new TemplateCreator();
            creator.analyzeRejectedTemplates();
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