const axios = require('axios');
require('dotenv').config();

const MOCK_MODE = process.env.MOCK_PAYMENT === 'true';
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

/**
 * Serviço de Integração de Pagamento Pix
 */
class PaymentService {
    /**
     * Gera uma cobrança Pix (real ou simulada)
     * @param {number} valor - Valor da cobrança (R$)
     * @param {object} cliente - Objeto contendo { nome, email, telefone }
     * @returns {Promise<{txid: string, qrCodeBase64: string, copiaCola: string}>}
     */
    async gerarCobrancaPix(valor, cliente) {
        if (MOCK_MODE) {
            console.log(`[PAYMENT MOCK] Gerando cobrança Pix simulada no valor de R$ ${valor.toFixed(2)} para ${cliente.nome}`);
            const txid = `mock_pix_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            
            // Retorna dados estáticos de teste
            return {
                txid,
                // Um QR code genérico/falso para demonstração
                qrCodeBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", 
                copiaCola: `00020101021226830014br.gov.bcb.pix2561api.pix.example.com/v2/${txid}520400005303986540510.005802BR5915TV_PIX_PLATFORM6009Sao_Paulo62070503***6304`
            };
        }

        try {
            console.log(`[PAYMENT REAL] Gerando cobrança Pix no Mercado Pago de R$ ${valor.toFixed(2)}`);
            
            const cleanDoc = (cliente.cpfcnpj || '').replace(/\D/g, '');
            const docType = cleanDoc.length === 14 ? 'CNPJ' : 'CPF';
            
            const response = await axios.post('https://api.mercadopago.com/v1/payments', {
                transaction_amount: valor,
                description: `Mensalidade TV - ${cliente.nome}`,
                payment_method_id: 'pix',
                payer: {
                    email: cliente.email,
                    first_name: cliente.nome.split(' ')[0] || 'Cliente',
                    last_name: cliente.nome.split(' ').slice(1).join(' ') || 'Silva',
                    identification: {
                        type: docType,
                        number: cleanDoc
                    }
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${MP_TOKEN}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': `idemp_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
                }
            });

            const paymentData = response.data;
            
            return {
                txid: paymentData.id.toString(),
                qrCodeBase64: paymentData.point_of_interaction.transaction_data.qr_code_base64,
                copiaCola: paymentData.point_of_interaction.transaction_data.qr_code
            };
        } catch (error) {
            const errorMsg = error.response && error.response.data 
                ? JSON.stringify(error.response.data) 
                : error.message;
            console.error('[PAYMENT ERROR] Falha ao criar cobrança no Mercado Pago:', errorMsg);
            throw new Error(`Falha ao gerar cobrança Pix: ${errorMsg}`);
        }
    }

    /**
     * Verifica o status de um pagamento no Mercado Pago
     * @param {string} txid - ID do pagamento
     * @returns {Promise<string>} - 'approved', 'pending', etc.
     */
    async verificarStatusPagamento(txid) {
        if (MOCK_MODE) {
            // Em modo simulado, esta função retorna 'pending'. 
            // O desenvolvedor pode simular o pagamento chamando o endpoint de webhook.
            return 'pending';
        }

        try {
            const response = await axios.get(`https://api.mercadopago.com/v1/payments/${txid}`, {
                headers: {
                    'Authorization': `Bearer ${MP_TOKEN}`
                }
            });
            return response.data.status; // ex: 'approved', 'pending', 'rejected'
        } catch (error) {
            console.error(`[PAYMENT ERROR] Falha ao verificar status do pagamento ${txid}:`, error.message);
            return 'error';
        }
    }
}

module.exports = new PaymentService();
