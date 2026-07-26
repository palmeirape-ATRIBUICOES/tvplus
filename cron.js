const cron = require('node-cron');
const { helpers } = require('./database');
const paymentService = require('./services/payment');
const tvPanelService = require('./services/tvPanel');
const whatsappService = require('./services/whatsapp');

function capitalizeName(name) {
    if (!name) return '';
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Função principal para checagem de vencimento, envio de cobranças e suspensões automáticas
 */
async function verificarAssinaturas() {
    const agora = new Date();
    console.log(`[CRON WORKER] Iniciando checagem de vencimento e suspensão (${agora.toLocaleString('pt-BR')})...`);
    
    try {
        // --- 1. BLOQUEIO DE CLIENTES EXPIRADOS / TESTES CONCLUÍDOS ---
        // Busca assinaturas ativas cujo período de validade (trial de 4h ou mensalidade) já passou
        const vencidas = await helpers.buscarAssinaturasVencidasNaoBloqueadas();
        console.log(`[CRON WORKER] Assinaturas vencidas/expiradas detectadas para suspensão: ${vencidas.length}`);

        for (const assinatura of vencidas) {
            const dataVenc = new Date(assinatura.data_vencimento);
            console.log(`[CRON WORKER] Bloqueando acesso de: ${assinatura.login_tv} (Venceu em: ${dataVenc.toLocaleString('pt-BR')})`);
            
            // 1. Executa suspensão (controle local)
            const bloqueado = await tvPanelService.bloquearCliente(assinatura.login_tv);
            
            if (bloqueado) {
                // 2. Atualiza o status local para suspensa
                await helpers.atualizarStatusAssinatura(assinatura.id, 'suspensa');
                
                // 3. Gera cobrança Pix automática de renovação (R$ 10,00 por padrão)
                const valorRenovacao = 10.00;
                const cobranca = await paymentService.gerarCobrancaPix(valorRenovacao, {
                    nome: assinatura.nome,
                    email: assinatura.email,
                    telefone: assinatura.telefone
                });

                // Salva a cobrança Pix gerada
                await helpers.criarPagamento(assinatura.cliente_id, cobranca.txid, valorRenovacao);

                // 4. Envia mensagem via WhatsApp informando sobre o bloqueio e fornecendo o Pix
                const nomeCapitalizado = capitalizeName(assinatura.nome);
                const mensagemBloqueio = `Olá, *${nomeCapitalizado}*!\n\n` +
                                         `Notamos que o seu período de acesso ao aplicativo *SIGNALPLAY* expirou e o pagamento de renovação não foi identificado.\n` +
                                         `Como resultado, o seu login *${assinatura.login_tv}* foi suspenso temporariamente.\n\n` +
                                         `Para reativar seu sinal por mais *30 dias* agora mesmo, realize o pagamento do Pix de R$ 10,00 abaixo:\n\n` +
                                         `🔑 *Chave Pix (Copia e Cola) para renovação:*\n\`${cobranca.copiaCola}\`\n\n` +
                                         `⚠️ *Aviso de Uso simultâneo:*\n` +
                                         `• Seu login permite assistir em *ATÉ 3 aparelhos ao mesmo tempo*.\n` +
                                         `• *Evite usar em mais de 3 aparelhos* para não causar bloqueios automáticos ou travamentos na sua assinatura.\n\n` +
                                         `Assim que o Pix for pago, o sistema ativará seu sinal automaticamente em instantes!`;
                
                await whatsappService.enviarMensagem(assinatura.telefone, mensagemBloqueio);
            }
        }

        // --- 2. ALERTA PREVENTIVO DE VENCIMENTO (Apenas para assinaturas pagas vencendo em breve) ---
        // Busca assinaturas ativas com vencimento próximo (daqui a 3 dias) que ainda não receberam alerta.
        // Ignoramos testes de 4 horas aqui para não perturbar no meio do teste curto.
        const expirando = await helpers.buscarAssinaturasExpirando(3);
        
        // Filtra para mandar alerta apenas para assinaturas que duraram mais de 24 horas (ou seja, não são trials de 4h)
        const expirandoFiltradas = expirando.filter(a => {
            const inicio = new Date(a.data_inicio);
            const venc = new Date(a.data_vencimento);
            const diffHours = (venc - inicio) / (1000 * 60 * 60);
            return diffHours > 24; // Apenas se a duração for maior que 1 dia
        });

        console.log(`[CRON WORKER] Assinaturas regulares expirando em breve para aviso: ${expirandoFiltradas.length}`);

        for (const assinatura of expirandoFiltradas) {
            console.log(`[CRON WORKER] Enviando alerta preventivo de renovação para ${assinatura.nome}...`);
            
            // Gera cobrança Pix preventiva
            const valorCobranca = 10.00;
            const cobranca = await paymentService.gerarCobrancaPix(valorCobranca, {
                nome: assinatura.nome,
                email: assinatura.email,
                telefone: assinatura.telefone
            });

            await helpers.criarPagamento(assinatura.cliente_id, cobranca.txid, valorCobranca);

            const nomeCapitalizado = capitalizeName(assinatura.nome);
            const dataVencStr = new Date(assinatura.data_vencimento).toLocaleDateString('pt-BR');
            const mensagemCobranca = `Olá, *${nomeCapitalizado}*!\n\n` +
                                     `Lembramos que sua assinatura do aplicativo *SIGNALPLAY* expira no dia *${dataVencStr}*.\n` +
                                     `Para continuar assistindo sem nenhuma interrupção (com acesso em até 3 aparelhos simultâneos), realize o pagamento do Pix de R$ 10,00 abaixo:\n\n` +
                                     `🔑 *Chave Pix (Copia e Cola) para renovação:*\n\`${cobranca.copiaCola}\`\n\n` +
                                     `Após a confirmação do pagamento, sua assinatura será renovada de forma automática!`;

            const enviado = await whatsappService.enviarMensagem(assinatura.telefone, mensagemCobranca);
            if (enviado) {
                await helpers.marcarAvisoEnviado(assinatura.id);
            }
        }

        console.log('[CRON WORKER] Rotina de checagem concluída.');
    } catch (error) {
        console.error('[CRON WORKER ERROR] Ocorreu um erro ao rodar o cron de assinaturas:', error);
    }
}

// Executa a checagem a cada 5 minutos
// (Isso garante que o trial de 4 horas seja cortado no momento correto e com precisão)
cron.schedule('*/5 * * * *', () => {
    verificarAssinaturas();
});

console.log('Cron Job de checagem agendado para rodar a cada 5 minutos.');

// Exporta para controle administrativo
module.exports = {
    verificarAssinaturas
};
