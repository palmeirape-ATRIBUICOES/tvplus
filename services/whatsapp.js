const axios = require('axios');
require('dotenv').config();

/**
 * Serviço para envio de mensagens automáticas no WhatsApp
 */
class WhatsappService {
    /**
     * Envia uma mensagem de WhatsApp para um número específico
     * @param {string} telefone - Número de telefone do destinatário (com DDI e DDD, apenas números)
     * @param {string} mensagem - Texto da mensagem
     * @returns {Promise<boolean>}
     */
    async enviarMensagem(telefone, mensagem) {
        if (!telefone) {
            console.warn('[WHATSAPP WARNING] Telefone não informado para envio.');
            return false;
        }

        // Assegura que o telefone está no formato correto (ex: DDI 55 + DDD + Número)
        let foneDestinatario = telefone.replace(/\D/g, '');
        if (!foneDestinatario.startsWith('55') && foneDestinatario.length <= 11) {
            foneDestinatario = '55' + foneDestinatario;
        }

        const MOCK_MODE = process.env.MOCK_WHATSAPP === 'true';
        const API_URL = process.env.WHATSAPP_API_URL;
        const API_TOKEN = process.env.WHATSAPP_API_TOKEN;

        console.log(`[WHATSAPP DISPARO] Enviando mensagem instantânea para +${foneDestinatario}... (API_URL: ${API_URL ? 'CONFIGURADA' : 'MODO_MOCK'}, MOCK: ${MOCK_MODE})`);

        if (MOCK_MODE || !API_URL) {
            console.log(`\n=================== [WHATSAPP NOTIFICAÇÃO DISPARADA] ===================`);
            console.log(`Para: +${foneDestinatario}`);
            console.log(`Mensagem:\n${mensagem}`);
            console.log(`========================================================================\n`);
            return true;
        }

        try {
            let response;
            if (API_URL.includes('z-api.io')) {
                // Assegura que a URL da Z-API termina com /send-text
                let targetUrl = API_URL.trim();
                if (!targetUrl.endsWith('/send-text') && !targetUrl.endsWith('/sendText')) {
                    targetUrl = `${targetUrl}/send-text`;
                }

                // Obtém o Client Token da variável WHATSAPP_CLIENT_TOKEN ou usa o WHATSAPP_API_TOKEN
                const clientToken = (process.env.WHATSAPP_CLIENT_TOKEN || process.env.WHATSAPP_API_TOKEN || '').trim();

                const zapiHeaders = { 
                    'Content-Type': 'application/json' 
                };

                if (clientToken) {
                    zapiHeaders['Client-Token'] = clientToken;
                    zapiHeaders['client-token'] = clientToken;
                }

                console.log(`[WHATSAPP Z-API] Disparando para Z-API na URL: ${targetUrl} (Client-Token enviado: ${clientToken ? 'SIM' : 'NÃO'})`);
                
                response = await axios.post(targetUrl, {
                    phone: foneDestinatario,
                    message: mensagem
                }, {
                    headers: zapiHeaders,
                    timeout: 10000
                });
            } else if (API_URL.includes('ultramsg.com')) {
                // Suporte UltraMsg
                response = await axios.post(API_URL, {
                    token: API_TOKEN,
                    to: `+${foneDestinatario}`,
                    body: mensagem
                }, { timeout: 8000 });
            } else {
                // Evolution API / Webhook Genérico
                const targetUrl = API_URL.endsWith('/sendText') ? API_URL : `${API_URL}/message/sendText`;
                response = await axios.post(targetUrl, {
                    number: foneDestinatario,
                    phone: foneDestinatario,
                    text: mensagem,
                    message: mensagem
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': API_TOKEN,
                        'Authorization': `Bearer ${API_TOKEN}`
                    },
                    timeout: 8000
                });
            }

            console.log(`[WHATSAPP SUCCESS] Mensagem entregue com sucesso para +${foneDestinatario} (Status: ${response.status})`);
            return true;
        } catch (error) {
            console.error(`[WHATSAPP ERROR] Erro no envio no WhatsApp para +${foneDestinatario}:`, error.message);
            if (error.response && error.response.data) {
                console.error(`[WHATSAPP ERROR DETALHE]:`, JSON.stringify(error.response.data));
            }
            return false;
        }
    }
}

module.exports = new WhatsappService();
