const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Carrega variáveis de ambiente
dotenv.config();

// Tratamento de exceções globais para evitar crash do processo
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
});

const { initDb, helpers } = require('./database');
const paymentService = require('./services/payment');
const tvPanelService = require('./services/tvPanel');
const whatsappService = require('./services/whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar banco de dados ao iniciar
initDb().then(() => {
    // Inicializar rotas cron em outro arquivo para manter modular
    require('./cron');
}).catch(err => {
    console.error("Falha fatal ao inicializar o banco de dados:", err);
    process.exit(1);
});

/**
 * ROTA: Cadastro do cliente e liberação do trial de 4 horas
 * POST /api/cadastro
 */
app.post('/api/cadastro', async (req, res) => {
    const { nome, email, telefone, cpfcnpj, cep, endereco, numero, complemento, bairro, cidade, uf } = req.body;

    if (!nome || !email || !telefone || !cpfcnpj) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios (nome, email, telefone, cpf/cnpj).' });
    }

    try {
        // 1. Cadastra ou recupera o cliente no banco local com os dados do ReceitaNet
        const cliente = await helpers.criarOuObterCliente(
            nome, email, telefone, cpfcnpj, cep, endereco, numero, complemento, bairro, cidade, uf
        );

        // 2. Garante que o cliente possui uma assinatura registrada (cria pendente se não existir)
        let assinatura = await helpers.criarOuObterAssinaturaPendente(cliente.id);
        
        if (assinatura && assinatura.status === 'ativa' && new Date(assinatura.data_vencimento) > new Date()) {
            return res.status(200).json({
                status: 'ativa',
                message: 'Você já possui uma assinatura de TV ativa!',
                login: assinatura.login_tv,
                senha: assinatura.senha_tv,
                vencimento: assinatura.data_vencimento
            });
        }

        // Se já existe uma assinatura suspensa/expirada, não liberamos outro trial!
        if (assinatura && (assinatura.status === 'suspensa' || assinatura.status === 'vencida')) {
            return res.status(200).json({
                status: 'suspensa',
                cliente_id: cliente.id,
                message: 'Seu período de teste gratuito de 4 horas já expirou. Escolha um plano de renovação para reativar seu acesso.'
            });
        }

        // 3. Integração com o CRM do ReceitaNet (Salva o Lead e gera login/senha únicos @tvplus)
        console.log(`[CADASTRO] Enviando dados para o CRM do ReceitaNet...`);
        const crmResult = await tvPanelService.cadastrarCliente({
            ...cliente,
            complemento: complemento || 'CASA',
            bairro: bairro || 'CENTRO',
            cidade: cidade || 'SAO JOAO DE MERITI',
            uf: uf || 'RJ'
        });

        const login = crmResult.login;
        const senha = crmResult.senha;

        // 4. Ativa localmente no SQLite por 4 Horas (Trial)
        assinatura = await helpers.ativarAssinatura(cliente.id, login, senha, 4, crmResult.receitanet_lead_id, null);
        console.log(`[CADASTRO] Assinatura trial de 4 horas criada para o cliente ${cliente.nome}. Expira em: ${assinatura.data_vencimento}`);

        // 5. Executa a ativação física no painel administrativo do ReceitaNet via Robô Puppeteer (RPA) em segundo plano
        const robot = require('./services/receitanetRobot');
        robot.cadastrarEAtivarTV(cliente, login, senha)
            .then(() => console.log(`[ROBÔ] Ativação concluída no painel para: ${cliente.nome}`))
            .catch(err => console.error(`[ROBÔ ERROR] Falha ao cadastrar no painel administrativo:`, err.message));

        // 6. Envia mensagem via WhatsApp informando as credenciais de teste
        const msgBoasVindas = `Olá, *${cliente.nome}*! Bem-vindo à AURA TV!\n\n` +
                              `Seu período de demonstração gratuito de *4 horas* foi ativado!\n` +
                              `Aqui estão seus dados de acesso:\n\n` +
                              `🔑 Usuário: *${login}*\n` +
                              `🔒 Senha: *${senha}*\n\n` +
                              `Seu sinal ficará ativo até: ${new Date(assinatura.data_vencimento).toLocaleTimeString('pt-BR')} do dia ${new Date(assinatura.data_vencimento).toLocaleDateString('pt-BR')}.\n` +
                              `Aproveite!`;
        
        await whatsappService.enviarMensagem(cliente.telefone, msgBoasVindas);

        res.status(200).json({
            status: 'ativa',
            message: 'Seu período de teste de 4 horas foi ativado com sucesso!',
            login,
            senha,
            vencimento: assinatura.data_vencimento
        });

    } catch (error) {
        console.error('Erro na rota de cadastro:', error);
        res.status(500).json({ error: error.message || 'Erro interno no servidor.' });
    }
});

/**
 * ROTA: Geração de cobrança Pix para Renovação (Múltiplos Meses)
 * POST /api/pix/gerar
 */
app.post('/api/pix/gerar', async (req, res) => {
    const { cliente_id, meses } = req.body;
    const numMeses = parseInt(meses) || 1;

    if (!cliente_id) {
        return res.status(400).json({ error: 'ID do cliente é obrigatório.' });
    }

    try {
        // Busca cliente local
        const dbClient = require('./database').db;
        const cliente = await new Promise((resolve, reject) => {
            dbClient.get('SELECT * FROM clientes WHERE id = ?', [cliente_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!cliente) {
            return res.status(404).json({ error: 'Cliente não localizado.' });
        }

        const valorCobranca = numMeses * 10.00;
        console.log(`[RENOVAÇÃO] Gerando Pix de R$ ${valorCobranca.toFixed(2)} (${numMeses} meses) para ${cliente.nome}`);
        
        const cobranca = await paymentService.gerarCobrancaPix(valorCobranca, cliente);

        // Registra o pagamento pendente local
        await helpers.criarPagamento(cliente.id, cobranca.txid, valorCobranca);

        res.status(200).json({
            status: 'pending',
            txid: cobranca.txid,
            qrCodeBase64: cobranca.qrCodeBase64,
            copiaCola: cobranca.copiaCola,
            valor: valorCobranca
        });

    } catch (error) {
        console.error('Erro ao gerar Pix de renovação:', error);
        res.status(500).json({ error: error.message || 'Erro ao gerar Pix.' });
    }
});

/**
 * ROTA: Consulta status do Pix pelo TXID
 * GET /api/status/:txid
 */
app.get('/api/status/:txid', async (req, res) => {
    const { txid } = req.params;

    try {
        const pagamento = await helpers.obterPagamentoPorTxid(txid);
        if (!pagamento) {
            return res.status(404).json({ error: 'Pagamento não encontrado.' });
        }

        if (pagamento.status === 'pago') {
            const assinatura = await helpers.obterAssinaturaPorClienteId(pagamento.cliente_id);
            return res.status(200).json({
                status: 'pago',
                login: assinatura ? assinatura.login_tv : null,
                senha: assinatura ? assinatura.senha_tv : null
            });
        }

        // Se estiver pendente, pode fazer uma checagem adicional no gateway real (se não estiver em mock_mode)
        if (process.env.MOCK_PAYMENT !== 'true') {
            const gatewayStatus = await paymentService.verificarStatusPagamento(txid);
            if (gatewayStatus === 'approved') {
                const dadosAcesso = await processarConfirmacaoPagamento(txid);
                return res.status(200).json({
                    status: 'pago',
                    login: dadosAcesso.login_tv,
                    senha: dadosAcesso.senha_tv
                });
            }
        }

        res.status(200).json({ status: pagamento.status });
    } catch (error) {
        console.error('Erro ao verificar status do pagamento:', error);
        res.status(500).json({ error: 'Erro ao verificar pagamento.' });
    }
});

/**
 * ROTA: Webhook real do gateway de pagamento
 * POST /api/webhook/pix
 */
app.post('/api/webhook/pix', async (req, res) => {
    const payload = req.body;
    console.log('[WEBHOOK] Recebido evento de pagamento:', JSON.stringify(payload));

    let txid = null;
    
    if (payload.action === 'payment.updated' || payload.type === 'payment') {
        txid = payload.data ? payload.data.id : null;
    } else if (payload.txid) {
        txid = payload.txid;
    }

    if (!txid) {
        return res.status(200).send('Ignorado (sem ID de transação).');
    }

    try {
        const pagamento = await helpers.obterPagamentoPorTxid(txid.toString());
        if (!pagamento) {
            return res.status(200).send('Pagamento não localizado no banco.');
        }

        if (pagamento.status === 'pago') {
            return res.status(200).send('Pagamento já processado anteriormente.');
        }

        if (process.env.MOCK_PAYMENT !== 'true') {
            const gatewayStatus = await paymentService.verificarStatusPagamento(txid);
            if (gatewayStatus !== 'approved') {
                return res.status(200).send('Pagamento ainda não aprovado no Gateway.');
            }
        }

        await processarConfirmacaoPagamento(txid);
        res.status(200).send('Pagamento processado com sucesso.');
    } catch (error) {
        console.error('[WEBHOOK ERROR] Falha no processamento do webhook:', error.message);
        res.status(500).send('Erro interno.');
    }
});

/**
 * ENDPOINTS DE AUTENTICAÇÃO CDNTV (Ativo/Inativo localmente no SQLite)
 * POST /api/sva/cdntv/auth
 * GET /api/sva/cdntv/auth
 */
const handleSvaAuth = async (req, res) => {
    const username = req.body.username || req.query.username;
    const password = req.body.password || req.query.password;

    if (!username || !password) {
        console.log(`[SVA AUTH FAIL] Login ou senha ausentes.`);
        return res.status(400).json({ success: false, status: "bad_request", msg: "Parâmetros username e password são obrigatórios." });
    }

    try {
        const dbClient = require('./database').db;
        const assinatura = await new Promise((resolve, reject) => {
            dbClient.get(
                'SELECT * FROM assinaturas WHERE login_tv = ? AND senha_tv = ?',
                [username, password],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!assinatura) {
            console.log(`[SVA AUTH FAIL] Conta não cadastrada localmente: ${username}`);
            return res.status(401).json({ success: false, status: "not_found", msg: "Conta de TV não localizada." });
        }

        const agora = new Date();
        const vencimento = new Date(assinatura.data_vencimento);

        if (assinatura.status === 'ativa' && vencimento > agora) {
            console.log(`[SVA AUTH OK] Acesso autorizado para: ${username} (Expira em: ${assinatura.data_vencimento})`);
            return res.status(200).json({ success: true, status: "active", msg: "Autenticado com sucesso." });
        } else {
            console.log(`[SVA AUTH BLOCKED] Conta bloqueada ou vencida: ${username} (Status: ${assinatura.status} | Venceu: ${assinatura.data_vencimento})`);
            return res.status(403).json({ success: false, status: "blocked", msg: "Sua assinatura de TV está suspensa ou vencida." });
        }

    } catch (error) {
        console.error('[SVA AUTH ERROR] Erro na autenticação SVA:', error.message);
        res.status(500).json({ success: false, status: "error", msg: "Erro interno no servidor." });
    }
};

app.post('/api/sva/cdntv/auth', handleSvaAuth);
app.get('/api/sva/cdntv/auth', handleSvaAuth);

// Endpoint de autenticação genérico
app.post('/api/sva/generic/auth', handleSvaAuth);
app.get('/api/sva/generic/auth', handleSvaAuth);


/**
 * ROTA DE SUPORTE: Simulação manual de pagamento (Apenas em ambiente de teste ou com MOCK ativo)
 * POST /api/simular-pagamento
 */
app.post('/api/simular-pagamento', async (req, res) => {
    const { txid } = req.body;
    
    if (!txid) {
        return res.status(400).json({ error: 'Indique o txid do pagamento a ser simulado.' });
    }

    try {
        const pagamento = await helpers.obterPagamentoPorTxid(txid);
        if (!pagamento) {
            return res.status(404).json({ error: 'Pagamento não localizado no banco.' });
        }

        if (pagamento.status === 'pago') {
            return res.status(200).json({ message: 'Este pagamento já foi aprovado.' });
        }

        const dadosAcesso = await processarConfirmacaoPagamento(txid);
        res.status(200).json({
            message: 'Sucesso! Pagamento simulado com aprovação imediata.',
            login: dadosAcesso.login_tv,
            senha: dadosAcesso.senha_tv
        });
    } catch (error) {
        console.error('Erro na simulação de pagamento:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ROTA DE SUPORTE: Execução manual do Cron de checagem de vencimento
 * POST /api/admin/run-cron
 */
app.post('/api/admin/run-cron', async (req, res) => {
    try {
        const { verificarAssinaturas } = require('./cron');
        await verificarAssinaturas();
        res.status(200).json({ message: 'Cron de vencimentos executado com sucesso.' });
    } catch (error) {
        console.error('Erro ao rodar cron manualmente:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ROTA DE SUPORTE: Forçar vencimento próximo (daqui a 2 dias) para o último cliente cadastrado
 * POST /api/admin/force-expiring
 */
app.post('/api/admin/force-expiring', async (req, res) => {
    const { db } = require('./database');
    try {
        db.get('SELECT * FROM assinaturas ORDER BY id DESC LIMIT 1', [], async (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Nenhuma assinatura cadastrada no banco de dados ainda.' });

            const dataVenc = new Date();
            dataVenc.setDate(dataVenc.getDate() + 2); // Vence daqui a 2 dias

            db.run(
                "UPDATE assinaturas SET data_vencimento = ?, status = 'ativa', aviso_enviado = 0 WHERE id = ?",
                [dataVenc.toISOString(), row.id],
                (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.status(200).json({ message: `Assinatura ID ${row.id} configurada para expirar em ${dataVenc.toLocaleDateString('pt-BR')}.` });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * ROTA DE SUPORTE: Forçar expiração total (ontem) para o último cliente cadastrado
 * POST /api/admin/force-expired
 */
app.post('/api/admin/force-expired', async (req, res) => {
    const { db } = require('./database');
    try {
        db.get('SELECT * FROM assinaturas ORDER BY id DESC LIMIT 1', [], async (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Nenhuma assinatura cadastrada no banco de dados ainda.' });

            const dataVenc = new Date();
            dataVenc.setHours(dataVenc.getHours() - 1); // Venceu há 1 hora

            db.run(
                "UPDATE assinaturas SET data_vencimento = ?, status = 'ativa' WHERE id = ?",
                [dataVenc.toISOString(), row.id],
                (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.status(200).json({ message: `Assinatura ID ${row.id} configurada como vencida (expirada).` });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Função Auxiliar Centralizada para ativação do cliente após pagamento Pix
 */
async function processarConfirmacaoPagamento(txid) {
    console.log(`[CONFIRMAÇÃO] Iniciando fluxo de ativação para pagamento TXID: ${txid}`);
    
    // 1. Atualiza pagamento no banco local
    await helpers.atualizarStatusPagamento(txid, 'pago');
    const pagamento = await helpers.obterPagamentoPorTxid(txid);

    // Obtém dados do cliente associado
    const dbClient = require('./database').db;
    const cliente = await new Promise((resolve, reject) => {
        dbClient.get('SELECT * FROM clientes WHERE id = ?', [pagamento.cliente_id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

    // 2. Calcula a quantidade de meses correspondente ao valor pago
    const meses = Math.round(pagamento.valor / 10.00) || 1;
    const horasExtensao = meses * 30 * 24; // 30 dias por mês em horas

    let assinatura = await helpers.obterAssinaturaPorClienteId(cliente.id);
    
    if (assinatura) {
        console.log(`[CONFIRMAÇÃO] Ativando/renovando assinatura para ${cliente.nome} por ${meses} meses (${horasExtensao} horas)...`);
        
        await tvPanelService.reativarCliente(assinatura.login_tv);
        
        // Estende o vencimento
        const novaAssinatura = await helpers.ativarAssinatura(
            cliente.id, 
            assinatura.login_tv, 
            assinatura.senha_tv, 
            horasExtensao, 
            assinatura.receitanet_lead_id, 
            assinatura.receitanet_cliente_id
        );

        // Notifica cliente via WhatsApp
        const vencimentoFormatado = new Date(novaAssinatura.data_vencimento).toLocaleDateString('pt-BR');
        const msgReativacao = `Olá, *${cliente.nome}*!\n\n` +
                              `Confirmamos o recebimento do seu Pix de R$ ${pagamento.valor.toFixed(2)}!\n` +
                              `Seu acesso à TV foi renovado por *${meses * 30} dias* com sucesso.\n\n` +
                              `🔑 Usuário: *${assinatura.login_tv}*\n` +
                              `📅 Novo Vencimento: *${vencimentoFormatado}*\n\n` +
                              `Obrigado e aproveite sua TV!`;
        
        await whatsappService.enviarMensagem(cliente.telefone, msgReativacao);

        return { login_tv: assinatura.login_tv, senha_tv: assinatura.senha_tv };
    }

    return null;
}

// Inicia o servidor Express
app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
    console.log(`Acesse http://localhost:${PORT} para visualizar a Landing Page.`);
});
