const axios = require('axios');
require('dotenv').config();

const MOCK_MODE = process.env.MOCK_WHATSAPP === 'true';
const API_URL = process.env.WHATSAPP_API_URL;
const API_TOKEN = process.env.WHATSAPP_API_TOKEN;

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
        // Assegura que o telefone está no formato correto (ex: DDI 55 + DDD + Número)
        let foneDestinatario = telefone.replace(/\D/g, '');
        if (!foneDestinatario.startsWith('55') && foneDestinatario.length <= 11) {
            foneDestinatario = '55' + foneDestinatario;
        }

        if (MOCK_MODE) {
            console.log(`\n=================== [WHATSAPP MOCK SEND] ===================`);
            console.log(`Para: +${foneDestinatario}`);
            console.log(`Mensagem:\n${mensagem}`);
            console.log(`============================================================\n`);
            return true;
        }

        try {
            console.log(`[WHATSAPP REAL] Enviando mensagem de WhatsApp para +${foneDestinatario}...`);
            
            let response;
            if (API_URL && API_URL.includes('z-api.io')) {
                // Suporte nativo Z-API (https://api.z-api.io/instances/ID/token/TOKEN/send-text)
                console.log(`[WHATSAPP REAL] Utilizando formato e cabeçalhos do Z-API...`);
                response = await axios.post(API_URL, {
                    phone: foneDestinatario,
                    message: mensagem
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Client-Token': API_TOKEN
                    }
                });
            } else {
                // Suporte genérico (Evolution API, etc.)
                response = await axios.post(`${API_URL}/message/sendText`, {
                    number: foneDestinatario,
                    text: mensagem
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': API_TOKEN,
                        'Authorization': `Bearer ${API_TOKEN}`
                    }
                });
            }

            if (response.status === 200 || response.status === 201) {
                console.log(`[WHATSAPP REAL] Mensagem enviada com sucesso para +${foneDestinatario}.`);
                return true;
            } else {
                console.warn(`[WHATSAPP REAL WARNING] Resposta inesperada da API:`, response.status, response.data);
                return false;
            }

        } catch (error) {
            console.error(`[WHATSAPP REAL ERROR] Erro ao enviar mensagem no WhatsApp para +${foneDestinatario}:`, error.message);
            if (error.response && error.response.data) {
                console.error(`[WHATSAPP REAL ERROR] Resposta do provedor:`, JSON.stringify(error.response.data));
            }
            return false;
        }
    }
}

module.exports = new WhatsappService();
