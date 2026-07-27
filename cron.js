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
 * Checagem automática em tempo real de pagamentos Pix pendentes no Mercado Pago
 */
async function verificarPagamentosPendentes(processarConfirmacaoFn) {
    try {
        const { db } = require('./database');
        db.all("SELECT * FROM pagamentos WHERE status = 'pendente'", [], async (err, rows) => {
            if (err || !rows || rows.length === 0) return;
            
            for (const pag of rows) {
                if (process.env.MOCK_PAYMENT === 'true') continue;
                
                try {
                    const status = await paymentService.verificarStatusPagamento(pag.txid_pix);
                    if (status === 'approved') {
                        console.log(`[PIX POLLING OK] Pagamento Pix aprovado detectado pelo Mercado Pago para TXID: ${pag.txid_pix}! Reativando cliente...`);
                        if (processarConfirmacaoFn) {
                            await processarConfirmacaoFn(pag.txid_pix);
                        }
                    }
                } catch (errPag) {
                    // Silencioso em falhas pontuais da API do Mercado Pago
                }
            }
        });
    } catch (e) {
        // Ignora erros genéricos de banco de dados no polling
    }
}

/**
 * Checagem automática em tempo real de testes grátis de 3 horas expirados
 */
async function verificarTestesExpirados() {
    try {
        const testesExpirados = await helpers.buscarTestesExpirados();
        if (!testesExpirados || testesExpirados.length === 0) return;

        console.log(`[CRON TESTES] Encontrados ${testesExpirados.length} testes de 3 horas expirados. Processando exclusão no ERP...`);

        for (const teste of testesExpirados) {
            console.log(`[CRON TESTES] Expirando teste ID ${teste.id} (${teste.login_tv}) para o número +${teste.telefone}...`);

            // 1. Marcar como expirado/excluído no banco local para limpar a visão do admin
            await helpers.marcarTesteExpirado(teste.id);

            // 2. Chama a fila do ReceitaNet ERP em segundo plano para EXCLUIR E RESCINDIR TOTALMENTE o teste no ERP
            const receitanetQueue = require('./services/receitanetQueue');
            receitanetQueue.adicionarTarefa('EXCLUIR_COMPLETO', {
                loginTv: teste.login_tv
            });

            // 3. Envia mensagem via WhatsApp informando a expiração e o link para cadastro e compra de R$ 10
            const msgExpiracao = `Seu teste grátis de 3 horas do aplicativo *SIGNALPLAY* expirou! ⏰\n\n` +
                                 `Esperamos que você tenha gostado da qualidade do sinal e da variedade dos nossos canais!\n\n` +
                                 `Para continuar assistindo sem interrupções por 30 dias em *ATÉ 3 APARELHOS*, assine agora mesmo seu plano por apenas *R$ 10,00/mês* no nosso site:\n\n` +
                                 `👉 https://tv-pix-platform.onrender.com\n\n` +
                                 `Faça seu cadastro no link acima e seu acesso será liberado na hora após o pagamento Pix! 🚀`;

            console.log(`[CRON TESTES WA] Enviando mensagem de expiração e link do site para +${teste.telefone}...`);
            await whatsappService.enviarMensagem(teste.telefone, msgExpiracao);
        }
    } catch (e) {
        console.error('[CRON TESTES ERROR] Erro na varredura de testes expirados:', e.message);
    }
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

                // 4. Envia mensagem via WhatsApp informando sobre o bloqueio e fornecendo o Pix em mensagem separada
                const nomeCapitalizado = capitalizeName(assinatura.nome);
                const mensagemBloqueio = `Olá, *${nomeCapitalizado}*!\n\n` +
                                         `Notamos que o seu período de acesso ao aplicativo *SIGNALPLAY* expirou e o pagamento de renovação não foi identificado.\n` +
                                         `Como resultado, o seu login *${assinatura.login_tv}* foi suspenso temporariamente.\n\n` +
                                         `Para reativar seu sinal por mais *30 dias* agora mesmo (com até 3 telas simultâneas), copie a chave Pix enviada na mensagem abaixo e pague no app do seu banco!\n\n` +
                                         `Assim que o Pix for pago, o sistema ativará seu sinal automaticamente em instantes!`;
                
                await whatsappService.enviarMensagem(assinatura.telefone, mensagemBloqueio);
                
                // Mensagem dedicada exclusiva com o código Pix Copia e Cola para facilidade do cliente
                if (cobranca && cobranca.copiaCola) {
                    await whatsappService.enviarMensagem(assinatura.telefone, cobranca.copiaCola);
                }
            }
        }

        // --- 2. ALERTA PREVENTIVO DE VENCIMENTO ---
        const expirando = await helpers.buscarAssinaturasExpirando(3);
        
        const expirandoFiltradas = expirando.filter(a => {
            const inicio = new Date(a.data_inicio);
            const venc = new Date(a.data_vencimento);
            const diffHours = (venc - inicio) / (1000 * 60 * 60);
            return diffHours > 24;
        });

        console.log(`[CRON WORKER] Assinaturas regulares expirando em breve para aviso: ${expirandoFiltradas.length}`);

        for (const assinatura of expirandoFiltradas) {
            console.log(`[CRON WORKER] Enviando alerta preventivo de renovação para ${assinatura.nome}...`);
            
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
                                     `Para continuar assistindo sem nenhuma interrupção, copie o Pix enviado na próxima mensagem e pague no app do seu banco!`;

            const enviado = await whatsappService.enviarMensagem(assinatura.telefone, mensagemCobranca);
            if (enviado && cobranca && cobranca.copiaCola) {
                await whatsappService.enviarMensagem(assinatura.telefone, cobranca.copiaCola);
                await helpers.marcarAvisoEnviado(assinatura.id);
            }
        }

        console.log('[CRON WORKER] Rotina de checagem concluída.');
    } catch (error) {
        console.error('[CRON WORKER ERROR] Ocorreu um erro ao rodar o cron de assinaturas:', error);
    }
}

// Executa a checagem a cada 5 minutos para assinaturas regulares
cron.schedule('*/5 * * * *', () => {
    verificarAssinaturas();
});

// Executa a checagem a cada 1 minuto para expirar os testes de 3 horas com precisão pontual
cron.schedule('*/1 * * * *', () => {
    verificarTestesExpirados();
});

console.log('Cron Job de checagem agendado (Assinaturas: a cada 5m | Testes de 3h: a cada 1m).');

module.exports = {
    verificarAssinaturas,
    verificarTestesExpirados,
    verificarPagamentosPendentes
};
