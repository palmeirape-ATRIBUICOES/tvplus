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
            
            // Exemplo genérico de chamada compatível com Evolution API / Z-API.
            // Ajuste a URL do endpoint e o formato do payload conforme seu provedor.
            const response = await axios.post(`${API_URL}/message/sendText`, {
                number: foneDestinatario,
                text: mensagem
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': API_TOKEN, // Usado na Evolution API. Altere para 'Authorization: Bearer' se Z-API/outros
                    'Authorization': `Bearer ${API_TOKEN}` // Alternativa de autenticação padrão
                }
            });

            if (response.status === 200 || response.status === 201) {
                console.log(`[WHATSAPP REAL] Mensagem enviada com sucesso para +${foneDestinatario}.`);
                return true;
            } else {
                console.warn(`[WHATSAPP REAL WARNING] Resposta inesperada da API:`, response.status, response.data);
                return false;
            }

        } catch (error) {
            console.error(`[WHATSAPP REAL ERROR] Erro ao enviar mensagem no WhatsApp para +${foneDestinatario}:`, error.message);
            return false;
        }
    }
}

module.exports = new WhatsappService();
