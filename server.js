const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Carrega variáveis de ambiente
dotenv.config();

// Cache de logs em memória para diagnóstico administrativo
const serverLogs = [];
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    const line = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    serverLogs.push(`[LOG] ${new Date().toLocaleTimeString('pt-BR')}: ${line}`);
    if (serverLogs.length > 300) serverLogs.shift();
    originalLog.apply(console, args);
};

console.error = function(...args) {
    const line = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    serverLogs.push(`[ERROR] ${new Date().toLocaleTimeString('pt-BR')}: ${line}`);
    if (serverLogs.length > 300) serverLogs.shift();
    originalError.apply(console, args);
};

// Tratamento de exceções globais para evitar crash do processo
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
});

const { initDb, helpers, db } = require('./database');
const paymentService = require('./services/payment');
const tvPanelService = require('./services/tvPanel');
const whatsappService = require('./services/whatsapp');

function capitalizeName(name) {
    if (!name) return '';
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de Autenticação Básica para o Painel Administrativo
const basicAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="AuraTV Admin"');
        return res.status(401).send('Acesso não autorizado.');
    }
    
    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];
    
    if (user === 'admin' && pass === '366724eA@@') {
        return next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="AuraTV Admin"');
        return res.status(401).send('Credenciais incorretas.');
    }
};

// Protege a rota do admin.html especificamente antes de servir estáticos
app.get('/admin.html', basicAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Protege todos os endpoints administrativos /api/admin/*
app.use('/api/admin/*', basicAuth);

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
 * ROTA: Cadastro do cliente e liberação de teste ou compra direta Pix
 * POST /api/cadastro
 */
app.post('/api/cadastro', async (req, res) => {
    const { nome, email, telefone, cpfcnpj, tipoCadastro } = req.body;

    if (!nome || !email || !telefone || !cpfcnpj) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios (nome, email, telefone, cpf/cnpj).' });
    }

    const isTrial = tipoCadastro !== 'buy';

    // Valores padrão de endereço de Palmeirina-PE para dispensar preenchimento do usuário
    const cep = '55320000';
    const endereco = 'Avenida Principal';
    const numero = 'S/N';
    const complemento = 'CASA';
    const bairro = 'CENTRO';
    const cidade = 'PALMEIRINA';
    const uf = 'PE';

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

        // Se já existe uma assinatura suspensa/expirada, não liberamos outro teste
        if (assinatura && (assinatura.status === 'suspensa' || assinatura.status === 'vencida')) {
            return res.status(200).json({
                status: 'suspensa',
                cliente_id: cliente.id,
                message: 'Seu período de teste gratuito já expirou. Escolha um plano de renovação para reativar seu acesso.'
            });
        }

        // 3. Integração com o CRM do ReceitaNet (Salva o Lead e gera login/senha únicos @tvplus)
        console.log(`[CADASTRO] Enviando dados para o CRM do ReceitaNet...`);
        const crmResult = await tvPanelService.cadastrarCliente({
            ...cliente,
            complemento: complemento || 'CASA',
            bairro: bairro || 'CENTRO',
            cidade: cidade || 'PALMEIRINA',
            uf: uf || 'PE'
        });

        const login = crmResult.login;
        const senha = crmResult.senha;

        if (isTrial) {
            // FLUXO A: Teste Gratuito (Duração configurada em minutos)
            const durationMinutes = parseInt(process.env.TRIAL_DURATION_MINUTES) || 5;
            const durationHours = durationMinutes / 60;

            // Ativa localmente no SQLite por X minutos (Trial)
            assinatura = await helpers.ativarAssinatura(cliente.id, login, senha, durationHours, crmResult.receitanet_lead_id, null);
            console.log(`[CADASTRO] Assinatura trial de ${durationMinutes} minutos criada para ${cliente.nome}. Expira em: ${assinatura.data_vencimento}`);

            // Executa a ativação física no painel do ReceitaNet via Robô Puppeteer em segundo plano
            const robot = require('./services/receitanetRobot');
            robot.cadastrarEAtivarTV(cliente, login, senha)
                .then(() => console.log(`[ROBÔ] Ativação concluída no painel para: ${cliente.nome}`))
                .catch(err => console.error(`[ROBÔ ERROR] Falha ao cadastrar no painel administrativo:`, err.message));

            // Envia mensagem via WhatsApp com as credenciais
            const nomeCapitalizado = capitalizeName(cliente.nome);
            const msgBoasVindas = `Olá, *${nomeCapitalizado}*! Bem-vindo à AURA TV!\n\n` +
                                  `Seu período de demonstração gratuito de *${durationMinutes} minutos* foi ativado!\n\n` +
                                  `🔑 *Seus dados de acesso:*\n` +
                                  `• Usuário: *${login}*\n` +
                                  `• Senha: *${senha}*\n\n` +
                                  `📱 *Como assistir:*\n` +
                                  `1. Baixe o aplicativo *SIGNALPLAY* na sua TV ou celular.\n` +
                                  `2. Entre com o Usuário e Senha acima.\n\n` +
                                  `⚠️ *Regras de Uso Importantes:*\n` +
                                  `• Você pode usar este login em *ATÉ 3 aparelhos simultaneamente*.\n` +
                                  `• *Evite conectar em mais do que 3 aparelhos ao mesmo tempo* para não travar o seu cadastro, gerando lentidões ou travamentos na sua assinatura.\n\n` +
                                  `Seu sinal de teste ficará ativo até: ${new Date(assinatura.data_vencimento).toLocaleTimeString('pt-BR')} do dia ${new Date(assinatura.data_vencimento).toLocaleDateString('pt-BR')}.`;
            
            await whatsappService.enviarMensagem(cliente.telefone, msgBoasVindas);

            res.status(200).json({
                status: 'ativa',
                message: `Seu período de teste de ${durationMinutes} minutos foi ativado com sucesso!`,
                login,
                senha,
                vencimento: assinatura.data_vencimento
            });
        } else {
            // FLUXO B: Compra Direta Pix
            console.log(`[CADASTRO] Gravando credenciais pendentes para o cliente ${cliente.nome}...`);
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE assinaturas SET login_tv = ?, senha_tv = ?, status = ?, receitanet_lead_id = ? WHERE cliente_id = ?',
                    [login, senha, 'pendente', crmResult.receitanet_lead_id, cliente.id],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            // Gera a cobrança Pix Mercado Pago de R$ 10,00 (1 Mês)
            console.log(`[CADASTRO] Gerando Pix de R$ 10,00 para compra direta...`);
            const charge = await paymentService.gerarCobrancaPix(10.00, cliente);
            await helpers.criarPagamento(cliente.id, charge.txid, 10.00);

            res.status(200).json({
                status: 'pendente',
                cliente_id: cliente.id,
                message: 'Cadastro realizado! Efetue o pagamento Pix de R$ 10,00 para liberar o seu acesso.',
                pixQrCode: charge.qrCodeBase64,
                pixCopiaCola: charge.copiaCola,
                txid: charge.txid
            });
        }

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
        
        // Se a assinatura estava pendente (compra direta), ela ainda não existe no painel. Cadastramos pela primeira vez.
        // Se já estava ativa/suspensa, apenas reativamos.
        if (assinatura.status === 'pendente') {
            console.log(`[CONFIRMAÇÃO] Novo cliente detectado. Cadastrando e ativando sinal no ReceitaNet pela primeira vez...`);
            const robot = require('./services/receitanetRobot');
            await robot.cadastrarEAtivarTV(cliente, assinatura.login_tv, assinatura.senha_tv);
        } else {
            console.log(`[CONFIRMAÇÃO] Cliente existente (${assinatura.status}). Reativando sinal no ReceitaNet...`);
            await tvPanelService.reativarCliente(assinatura.login_tv);
        }
        
        // Estende o vencimento
        const novaAssinatura = await helpers.ativarAssinatura(
            cliente.id, 
            assinatura.login_tv, 
            assinatura.senha_tv, 
            horasExtensao, 
            assinatura.receitanet_lead_id, 
            assinatura.receitanet_cliente_id
        );

        // Notifica cliente via WhatsApp com instrução do SIGNALPLAY e limites de dispositivos
        const nomeCapitalizado = capitalizeName(cliente.nome);
        const vencimentoFormatado = new Date(novaAssinatura.data_vencimento).toLocaleDateString('pt-BR');
        const msgReativacao = `Olá, *${nomeCapitalizado}*!\n\n` +
                              `Confirmamos o recebimento do seu Pix de R$ ${pagamento.valor.toFixed(2)}!\n` +
                              `Seu acesso à TV foi ativado e renovado por *${meses * 30} dias* com sucesso.\n\n` +
                              `🔑 *Seus dados de acesso de TV:*\n` +
                              `• Usuário: *${assinatura.login_tv}*\n` +
                              `• Senha: *${assinatura.senha_tv}*\n` +
                              `📅 Vencimento: *${vencimentoFormatado}*\n\n` +
                              `📱 *Instruções de Instalação:*\n` +
                              `1. Baixe o aplicativo *SIGNALPLAY* na sua TV ou dispositivo móvel.\n` +
                              `2. Conecte usando o Usuário e Senha fornecidos acima.\n\n` +
                              `⚠️ *Regra de Uso Importante:*\n` +
                              `• Você pode usar este login em *ATÉ 3 aparelhos ao mesmo tempo*.\n` +
                              `• *Evite conectar em mais do que 3 aparelhos simultaneamente* para não travar o seu cadastro, gerando lentidões e travamentos.\n\n` +
                              `Obrigado e aproveite sua programação!`;
        
        await whatsappService.enviarMensagem(cliente.telefone, msgReativacao);

        return { login_tv: assinatura.login_tv, senha_tv: assinatura.senha_tv };
    }

    return null;
}

/**
 * ENDPOINTS ADMINISTRATIVOS DO PAINEL DE CONTROLE (Dashboard Admin)
 */
app.get('/api/admin/clientes', async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id as cliente_id, c.nome, c.email, c.telefone, c.cpfcnpj, c.cep,
                a.id as assinatura_id, a.login_tv, a.senha_tv, a.status as assinatura_status, a.data_vencimento, a.receitanet_lead_id
            FROM clientes c
            LEFT JOIN assinaturas a ON c.id = a.cliente_id
            ORDER BY c.id DESC
        `;
        db.all(query, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(200).json(rows);
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/suspender', async (req, res) => {
    const { cliente_id } = req.body;
    try {
        db.get('SELECT a.*, c.nome, c.email, c.telefone, c.cpfcnpj FROM assinaturas a JOIN clientes c ON a.cliente_id = c.id WHERE a.cliente_id = ?', [cliente_id], async (err, row) => {
            if (err || !row) return res.status(404).json({ error: 'Assinatura não localizada.' });
            
            // 1. Atualiza status local para suspensa
            db.run("UPDATE assinaturas SET status = 'suspensa' WHERE id = ?", [row.id]);

            // 2. Gera cobrança Pix de renovação instantânea
            const valorRenovacao = 10.00;
            let cobranca = { copiaCola: 'PIX-NAO-CONFIGURADO', txid: 'TX' + Date.now() };
            try {
                cobranca = await paymentService.gerarCobrancaPix(valorRenovacao, {
                    nome: row.nome,
                    email: row.email,
                    telefone: row.telefone
                });
                await helpers.criarPagamento(row.cliente_id, cobranca.txid, valorRenovacao);
            } catch (pixErr) {
                console.error("[SUSPENDER] Aviso: Erro ao gerar Pix:", pixErr.message);
            }

            // 3. DISPARO IMEDIATO DO WHATSAPP (Executa em < 1 segundo, sem aguardar o robô Puppeteer)
            const nomeCapitalizado = capitalizeName(row.nome);
            const mensagemBloqueio = `Olá, *${nomeCapitalizado}*!\n\n` +
                                     `Notamos que o seu acesso ao aplicativo *SIGNALPLAY* foi suspenso por pendência de pagamento.\n` +
                                     `Como resultado, o seu login *${row.login_tv}* foi temporariamente bloqueado.\n\n` +
                                     `Para reativar seu sinal por mais *30 dias* agora mesmo (com até 3 telas simultâneas), copie a chave Pix enviada na mensagem abaixo e pague no app do seu banco!\n\n` +
                                     `Assim que o Pix for pago, o sistema reativará seu sinal automaticamente em instantes!`;
            
            console.log(`[SUSPENDER WA IMEDIATO] Disparando notificação de bloqueio via WhatsApp para ${row.telefone}...`);
            whatsappService.enviarMensagem(row.telefone, mensagemBloqueio).then(() => {
                // Envia o Pix Copia e Cola em mensagem separada para facilidade de cópia do cliente
                if (cobranca && cobranca.copiaCola) {
                    whatsappService.enviarMensagem(row.telefone, cobranca.copiaCola);
                }
            }).catch(waErr => {
                console.error("[SUSPENDER WA ERROR] Falha no disparo do WhatsApp:", waErr.message);
            });

            // 4. Inicia o bloqueio físico no ReceitaNet em background (não trava o envio da notificação)
            const robot = require('./services/receitanetRobot');
            robot.bloquearCliente(row.login_tv, row.cpfcnpj, row.nome).then(() => {
                console.log(`[SUSPENDER ROBOT] Bloqueio físico no ERP concluído para ${row.login_tv}`);
            }).catch(robErr => {
                console.error(`[SUSPENDER ROBOT ERROR] Erro ao bloquear no ERP:`, robErr.message);
            });

            res.status(200).json({ message: 'Cliente suspenso e notificado via WhatsApp com o Pix instantaneamente!' });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/reativar', async (req, res) => {
    const { cliente_id } = req.body;
    try {
        db.get('SELECT a.*, c.nome, c.cpfcnpj FROM assinaturas a JOIN clientes c ON a.cliente_id = c.id WHERE a.cliente_id = ?', [cliente_id], async (err, row) => {
            if (err || !row) return res.status(404).json({ error: 'Assinatura não localizada.' });
            
            const robot = require('./services/receitanetRobot');
            
            if (row.status === 'pendente') {
                db.get('SELECT * FROM clientes WHERE id = ?', [cliente_id], async (err3, cliente) => {
                    if (err3 || !cliente) return res.status(404).json({ error: 'Cliente não localizado no banco local.' });
                    
                    await robot.cadastrarEAtivarTV(cliente, row.login_tv, row.senha_tv);
                    
                    const novaDataVenc = new Date();
                    novaDataVenc.setDate(novaDataVenc.getDate() + 30);
                    db.run("UPDATE assinaturas SET status = 'ativa', data_vencimento = ? WHERE id = ?", [novaDataVenc.toISOString(), row.id], (err2) => {
                        if (err2) return res.status(500).json({ error: err2.message });
                        res.status(200).json({ message: 'Cliente cadastrado e sinal de TV ativado com sucesso!' });
                    });
                });
            } else {
                await robot.reativarCliente(row.login_tv, row.cpfcnpj, row.nome);
                
                const novaDataVenc = new Date();
                novaDataVenc.setDate(novaDataVenc.getDate() + 30);
                db.run("UPDATE assinaturas SET status = 'ativa', data_vencimento = ? WHERE id = ?", [novaDataVenc.toISOString(), row.id], (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.status(200).json({ message: 'Cliente reativado por 30 dias no ReceitaNet e no banco local!' });
                });
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/excluir', async (req, res) => {
    const { cliente_id } = req.body;
    try {
        db.get('SELECT a.*, c.nome, c.cpfcnpj FROM assinaturas a JOIN clientes c ON a.cliente_id = c.id WHERE a.cliente_id = ?', [cliente_id], async (err, row) => {
            if (err || !row) return res.status(404).json({ error: 'Assinatura não localizada.' });
            
            const robot = require('./services/receitanetRobot');
            await robot.excluirCliente(row.login_tv, row.cpfcnpj, row.nome);
            
            // Exclui localmente do SQLite
            db.run('DELETE FROM pagamentos WHERE cliente_id = ?', [cliente_id], (err1) => {
                db.run('DELETE FROM assinaturas WHERE cliente_id = ?', [cliente_id], (err2) => {
                    db.run('DELETE FROM clientes WHERE id = ?', [cliente_id], (err3) => {
                        res.status(200).json({ message: 'Cliente cancelado e excluído com sucesso no ReceitaNet e no banco local!' });
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/clear-db', (req, res) => {
    db.serialize(() => {
        db.run('DELETE FROM pagamentos', (err1) => {
            if (err1) return res.status(500).json({ error: err1.message });
            db.run('DELETE FROM assinaturas', (err2) => {
                if (err2) return res.status(500).json({ error: err2.message });
                db.run('DELETE FROM clientes', (err3) => {
                    if (err3) return res.status(500).json({ error: err3.message });
                    res.status(200).json({ message: 'Banco de dados local limpo com sucesso! Todos os registros locais foram apagados.' });
                });
            });
        });
    });
});

app.post('/api/admin/enviar-instrucoes', async (req, res) => {
    const { cliente_id } = req.body;
    try {
        db.get('SELECT c.*, a.login_tv, a.senha_tv FROM clientes c JOIN assinaturas a ON c.id = a.cliente_id WHERE c.id = ?', [cliente_id], async (err, row) => {
            if (err || !row) return res.status(404).json({ error: 'Cliente não localizado.' });
            
            const nomeCapitalizado = capitalizeName(row.nome);
            const msgApp = `Olá, *${nomeCapitalizado}*!\n\n` +
                           `Aqui estão as instruções para assistir à sua AURA TV:\n\n` +
                           `📱 *Como baixar o aplicativo:*\n` +
                           `1. Procure e baixe o aplicativo *SIGNALPLAY* na Play Store (Android), App Store (iOS) ou na loja da sua Smart TV.\n` +
                           `2. Conecte utilizando as suas credenciais abaixo:\n\n` +
                           `🔑 *Dados de Acesso:*\n` +
                           `• Usuário: *${row.login_tv}*\n` +
                           `• Senha: *${row.senha_tv}*\n\n` +
                           `⚠️ *Regra de Uso Importante:*\n` +
                           `• Você pode usar este login em *ATÉ 3 aparelhos ao mesmo tempo*.\n` +
                           `• *Evite conectar em mais do que 3 aparelhos simultaneamente* para não travar o seu cadastro, gerando lentidões ou travamentos.\n\n` +
                           `Qualquer dúvida, estamos à disposição!`;
            
            await whatsappService.enviarMensagem(row.telefone, msgApp);
            res.status(200).json({ message: 'Instruções enviadas com sucesso no WhatsApp!' });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/diagnose-erp', async (req, res) => {
    const puppeteer = require('puppeteer');
    const adminUser = process.env.RECEITANET_ADMIN_USER;
    const adminPass = process.env.RECEITANET_ADMIN_PASS;
    
    console.log("[DIAGNOSE-ERP] Iniciando diagnóstico do ERP...");
    
    const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    try {
        await page.goto('https://sistema.receitanet.net/novo/auth/login', { waitUntil: 'networkidle2' });
        await page.waitForSelector('#username', { timeout: 10000 });
        await page.type('#username', adminUser);
        await page.type('#password', adminPass);
        await Promise.all([
            page.click('#kc-login'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);
        
        // Vai para a listagem
        await page.goto('https://sistema.receitanet.net/novo/clientes', { waitUntil: 'networkidle2' });
        await page.waitForSelector('input', { timeout: 10000 }).catch(() => {});
        
        // Tira screenshot e salva na pasta public
        const path = require('path');
        const screenshotPath = path.join(__dirname, 'public', 'erp_diagnose.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        // Coleta dados estruturais
        const data = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input, select, textarea, button')).map(el => ({
                tag: el.tagName,
                type: el.type,
                id: el.id,
                name: el.name,
                placeholder: el.placeholder,
                className: el.className,
                outerHTML: el.outerHTML.substring(0, 300)
            }));
            
            const headers = Array.from(document.querySelectorAll('th, td')).map(el => el.textContent.trim()).filter(t => t.length > 0 && t.length < 50);
            
            return {
                title: document.title,
                url: window.location.href,
                inputs,
                headersSlice: headers.slice(0, 100)
            };
        });
        
        await browser.close();
        res.status(200).json({
            message: "Diagnóstico concluído! Screenshot salva em /erp_diagnose.png",
            screenshotUrl: `${req.protocol}://${req.get('host')}/erp_diagnose.png`,
            data
        });
    } catch (error) {
        if (browser) await browser.close();
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/server-logs', (req, res) => {
    res.status(200).json(serverLogs);
});

/**
 * WEBHOOK: Recebe todas as mensagens que chegam no WhatsApp via Z-API
 * POST /api/webhook/whatsapp
 */
app.post('/api/webhook/whatsapp', async (req, res) => {
    try {
        const body = req.body || {};
        console.log(`[WEBHOOK WHATSAPP] Notificação recebida:`, JSON.stringify(body).substring(0, 400));

        // Extração flexível de telefone do payload Z-API
        const phone = body.phone || body.from || (body.data && body.data.phone) || body.participant;
        const isGroup = body.isGroup === true || (body.data && body.data.isGroup === true);
        
        // Extração flexível do texto da mensagem do Z-API
        let text = '';
        if (typeof body.text === 'string') {
            text = body.text;
        } else if (body.text && typeof body.text === 'object' && body.text.message) {
            text = body.text.message;
        } else if (typeof body.message === 'string') {
            text = body.message;
        } else if (typeof body.body === 'string') {
            text = body.body;
        } else if (body.data && typeof body.data.message === 'string') {
            text = body.data.message;
        }

        console.log(`[WEBHOOK WHATSAPP ANALISE] Telefone: ${phone}, Grupo: ${isGroup}, Texto: "${text}"`);

        // Processa apenas se houver número e texto válido e não for grupo
        if (!isGroup && phone && text) {
            const aiChatbotService = require('./services/aiChatbot');
            aiChatbotService.processarMensagemEntrada(phone, text).catch(err => {
                console.error("[WEBHOOK WHATSAPP ERROR] Erro no processamento da mensagem:", err.message);
            });
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('[WEBHOOK WHATSAPP ERROR]:', error.message);
        res.status(200).send('OK');
    }
});

/**
 * ROTA ADMIN: Listar estado de todas as conversas do Bot (IA vs Humano)
 * GET /api/admin/conversas-bot
 */
app.get('/api/admin/conversas-bot', async (req, res) => {
    try {
        const conversas = await helpers.listarConversasBot();
        res.status(200).json(conversas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * ROTA ADMIN: Alternar estado de atendimento entre 'IA' e 'HUMANO'
 * POST /api/admin/bot-toggle
 */
app.post('/api/admin/bot-toggle', async (req, res) => {
    const { telefone, modo } = req.body; // modo: 'IA' ou 'HUMANO'
    if (!telefone || !modo) {
        return res.status(400).json({ error: 'Telefone e modo são obrigatórios.' });
    }

    try {
        await helpers.definirModoBot(telefone, modo);
        res.status(200).json({ message: `Modo do robô alterado para ${modo} com sucesso para +${telefone}.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Inicia o servidor Express
app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
    console.log(`Acesse http://localhost:${PORT} para visualizar a Landing Page.`);
});
