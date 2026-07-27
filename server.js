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
    // Se a requisição NÃO for para rotas administrativas, libera o fluxo imediatamente
    if (!req.path.startsWith('/api/admin/')) {
        return next();
    }

    const authHeader = req.headers.authorization || req.headers.Authorization || req.headers['authorization'];
    if (authHeader) {
        try {
            const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
            if (auth[0] === 'admin' && auth[1] === '366724eA@@') {
                return next();
            }
        } catch (e) {}
    }
    
    // Permite que chamadas AJAX (fetch) originadas da própria página admin.html funcionem sem 401
    const referer = req.headers.referer || req.headers.referrer || '';
    if (referer.includes('/admin.html')) {
        return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="AuraTV Admin"');
    return res.status(401).send('Acesso não autorizado.');
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
    let rawUser = req.body.username || req.body.user || req.body.login || req.query.username || req.query.user || req.query.login || '';
    let rawPass = req.body.password || req.body.pass || req.body.senha || req.query.password || req.query.pass || req.query.senha || '';

    // Suporte nativo para o aplicativo SignalPlay iOS (iPhone / iPad) que envia credenciais no cabeçalho HTTP Authorization
    const headerAuth = req.headers.authorization || req.headers.Authorization || req.headers['authorization'] || '';
    if ((!rawUser || !rawPass) && headerAuth) {
        try {
            if (headerAuth.toLowerCase().startsWith('basic ')) {
                const credentials = Buffer.from(headerAuth.split(' ')[1], 'base64').toString('utf8').split(':');
                if (credentials.length >= 2) {
                    rawUser = credentials[0];
                    rawPass = credentials.slice(1).join(':');
                    console.log(`[SVA AUTH iOS BASIC AUTH] Extraído do cabeçalho HTTP do iOS: User='${rawUser}', Pass='${rawPass}'`);
                }
            }
        } catch (e) {
            console.error('[SVA AUTH iOS HEADER ERROR]:', e.message);
        }
    }

    if (!rawUser || !rawPass) {
        console.log(`[SVA AUTH FAIL] Login ou senha ausentes na requisição: Body=${JSON.stringify(req.body)}, Query=${JSON.stringify(req.query)}, Headers=${JSON.stringify(req.headers)}`);
        return res.status(200).json({ success: false, status: "bad_request", msg: "Parâmetros username e password são obrigatórios." });
    }

    let userClean = rawUser.toString().trim().toLowerCase();
    try {
        userClean = decodeURIComponent(userClean);
    } catch (e) {}

    // Tratamento universal para garantir que o símbolo @ seja reconhecido em qualquer aplicativo/navegador
    userClean = userClean.replace(/[\s\+%20]+tvplus/gi, '@tvplus');
    userClean = userClean.replace(/%40/gi, '@');
    userClean = userClean.replace(/@tvplus@tvplus/gi, '@tvplus').trim();

    let passClean = rawPass.toString().trim();
    try {
        passClean = decodeURIComponent(passClean);
    } catch (e) {}
    passClean = passClean.trim();

    const passOnlyDigits = passClean.replace(/\D/g, '');
    const passPadded = passOnlyDigits.length > 0 && passOnlyDigits.length < 11 ? passOnlyDigits.padStart(11, '0') : passOnlyDigits;
    const passNoLeadingZero = passClean.replace(/^0+/, '');

    const userWithDomain = userClean.includes('@') ? userClean : `${userClean}@tvplus`;
    const userWithoutDomain = userClean.replace(/@.*$/, '').replace(/[\s\+].*$/, '').trim();
    const userLikePattern = `%${userWithoutDomain}%`;

    console.log(`[SVA AUTH] Login normalizado: User='${userClean}' (Com Domínio: '${userWithDomain}', Sem Domínio: '${userWithoutDomain}'), Pass='${passClean}' (Variações dígitos: '${passOnlyDigits}', '${passPadded}', '${passNoLeadingZero}')`);

    try {
        const dbClient = require('./database').db;
        const agora = new Date();

        // 0. Checa se o Administrador clicou para DERRUBAR ESTA CONEXÃO
        const sessaoDerrubada = await helpers.verificarSessaoDerrubada(userWithDomain) || await helpers.verificarSessaoDerrubada(userWithoutDomain);
        if (sessaoDerrubada) {
            console.log(`[SVA AUTH DERRUBADO] ⚡ Conexão interrompida pelo Administrador para o login: ${userClean}`);
            registrarLogDebugSva(userClean, passClean, 'DERRUBADO_ADMIN', 'Sessão derrubada pelo Administrador.');
            return res.status(200).json({ success: false, status: "kicked", msg: "Sua conexão foi encerrada pelo Administrador do sistema." });
        }

        // 0.1 Checa se o Administrador DISPAROU O PIX QR CODE PARA A TELA DA TV DESTE CLIENTE
        const pixForcado = await helpers.obterPixForcado(userWithDomain) || await helpers.obterPixForcado(userWithoutDomain);
        if (pixForcado) {
            console.log(`[SVA AUTH PIX FORÇADO] 📺 Exibindo Pix QR Code disparado pelo Administrador na tela da TV do usuário: ${userClean}`);
            registrarLogDebugSva(userClean, passClean, 'PIX_TV_FORCADO', 'Pix QR Code forçado na tela da TV.');
            return res.status(200).json({
                success: false,
                status: "blocked",
                msg: "SOLICITAÇÃO DE PAGAMENTO NA TV: Pague o Pix de R$ 10,00 para renovar por +30 dias instantaneamente!",
                valor: "10.00",
                pix_copia_e_cola: pixForcado.copiaCola,
                pix_qr_code_url: pixForcado.qrCodeUrl
            });
        }

        // Captura telemetria da conexão (Dispositivo, IP, Horário)
        const dispositivo = req.headers['user-agent'] || 'SignalPlay App';
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

        // 1. Busca em assinaturas pagas (Suporta variações de login e variações de senha)
        const assinatura = await new Promise((resolve, reject) => {
            dbClient.get(
                `SELECT * FROM assinaturas 
                 WHERE (LOWER(TRIM(login_tv)) = ? OR LOWER(TRIM(login_tv)) = ? OR LOWER(TRIM(login_tv)) = ? OR REPLACE(LOWER(TRIM(login_tv)), '@tvplus', '') = ? OR LOWER(TRIM(login_tv)) LIKE ?) 
                   AND (
                       TRIM(senha_tv) = ? OR CAST(senha_tv AS TEXT) = ? 
                    OR TRIM(senha_tv) = ? OR CAST(senha_tv AS TEXT) = ? 
                    OR TRIM(senha_tv) = ? OR CAST(senha_tv AS TEXT) = ?
                    OR TRIM(senha_tv) = ? OR CAST(senha_tv AS TEXT) = ?
                   )`,
                [
                    userClean, userWithDomain, userWithoutDomain, userWithoutDomain, userLikePattern, 
                    passClean, passClean, 
                    passOnlyDigits, passOnlyDigits, 
                    passPadded, passPadded, 
                    passNoLeadingZero, passNoLeadingZero
                ],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

// Armazena em memória as últimas 50 tentativas de login do aplicativo com diagnóstico completo
const svaDebugLogs = [];

function registrarLogDebugSva(loginEnviado, senhaEnviada, status, detalhes, senhaCadastrada = null) {
    const entry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        loginEnviado,
        senhaEnviada,
        status,
        detalhes,
        senhaCadastrada
    };
    svaDebugLogs.unshift(entry);
    if (svaDebugLogs.length > 50) svaDebugLogs.pop();
}

        if (assinatura) {
            const vencimento = new Date(assinatura.data_vencimento);
            if (assinatura.status === 'ativa' && vencimento > agora) {
                console.log(`[SVA AUTH OK] Acesso autorizado para cliente pago: ${assinatura.login_tv} (Expira em: ${assinatura.data_vencimento})`);
                await helpers.registrarPingSessao(userWithDomain, dispositivo, ip, 'Canais digitais e Filmes HD');
                registrarLogDebugSva(userClean, passClean, 'SUCESSO', 'Acesso autorizado (Cliente Ativo).', assinatura.senha_tv);
                return res.status(200).json({ success: true, status: "active", msg: "Autenticado com sucesso." });
            } else {
                console.log(`[SVA AUTH BLOCKED] Conta de cliente bloqueada ou vencida: ${assinatura.login_tv}`);
                registrarLogDebugSva(userClean, passClean, 'VENCIDO', 'Conta de cliente vencida.', assinatura.senha_tv);
                
                // Gera cobrança Pix de renovação instantânea para exibição direta no app da TV
                let pixData = null;
                try {
                    const cobranca = await paymentService.gerarCobrancaPix(10.00, {
                        nome: `Cliente ${assinatura.login_tv}`,
                        email: `${userWithoutDomain}@tvplus.com`,
                        telefone: '5521964422488'
                    });
                    if (cobranca && cobranca.copiaCola) {
                        pixData = {
                            copiaCola: cobranca.copiaCola,
                            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(cobranca.copiaCola)}`
                        };
                    }
                } catch (pixErr) {
                    console.error("[SVA PIX ERROR]:", pixErr.message);
                }

                return res.status(200).json({ 
                    success: false, 
                    status: "blocked", 
                    msg: "Sua assinatura de TV está vencida. Pague o Pix de R$ 10,00 para renovar por +30 dias instantaneamente!",
                    valor: "10.00",
                    pix_copia_e_cola: pixData ? pixData.copiaCola : null,
                    pix_qr_code_url: pixData ? pixData.qrCodeUrl : null
                });
            }
        }

        // 2. Se não encontrou em assinaturas, busca na tabela de testes grátis de 3 horas
        const teste = await new Promise((resolve, reject) => {
            dbClient.get(
                `SELECT * FROM testes 
                 WHERE (LOWER(TRIM(login_tv)) = ? OR LOWER(TRIM(login_tv)) = ? OR LOWER(TRIM(login_tv)) = ? OR REPLACE(LOWER(TRIM(login_tv)), '@tvplus', '') = ? OR LOWER(TRIM(login_tv)) LIKE ?) 
                   AND (TRIM(senha_tv) = ? OR CAST(senha_tv AS TEXT) = ?)`,
                [userClean, userWithDomain, userWithoutDomain, userWithoutDomain, userLikePattern, passClean, passClean],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (teste) {
            const expiracaoTeste = new Date(teste.data_expiracao);
            if (teste.status === 'ativo' && expiracaoTeste > agora) {
                console.log(`[SVA AUTH OK] Acesso autorizado para TESTE GRÁTIS: ${teste.login_tv} (Validade até: ${teste.data_expiracao})`);
                await helpers.registrarPingSessao(teste.login_tv, dispositivo, ip, 'Teste Grátis 3 Horas');
                return res.status(200).json({ success: true, status: "active", msg: "Autenticado com sucesso (Teste Grátis de 3 Horas)." });
            } else {
                console.log(`[SVA AUTH BLOCKED] Teste grátis expirado: ${teste.login_tv}`);
                
                // Gera Pix de R$ 10,00 para o cliente de teste assinar na hora direto na TV
                let pixData = null;
                try {
                    const cobranca = await paymentService.gerarCobrancaPix(10.00, {
                        nome: `Teste ${teste.login_tv}`,
                        email: `${userWithoutDomain}@tvplus.com`,
                        telefone: teste.telefone
                    });
                    if (cobranca && cobranca.copiaCola) {
                        pixData = {
                            copiaCola: cobranca.copiaCola,
                            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(cobranca.copiaCola)}`
                        };
                    }
                } catch (pixErr) {
                    console.error("[SVA PIX ERROR]:", pixErr.message);
                }

                return res.status(200).json({ 
                    success: false, 
                    status: "blocked", 
                    msg: "Seu teste grátis de 3 horas expirou! Assine agora por R$ 10,00/mês pagando o Pix abaixo para liberar o sinal instantaneamente!",
                    valor: "10.00",
                    pix_copia_e_cola: pixData ? pixData.copiaCola : null,
                    pix_qr_code_url: pixData ? pixData.qrCodeUrl : null
                });
            }
        }

        // 3. Se a conta não existe localmente ainda (ex: cadastrada direto no ERP como ellen@tvplus), sincroniza e autoriza automaticamente
        console.log(`[SVA AUTH AUTO-SYNC] Conta de TV '${userWithDomain}' detectada do ERP. Sincronizando no banco local...`);
        const clienteAuto = await helpers.criarOuObterCliente(
            userWithoutDomain.toUpperCase(),
            `${userWithoutDomain}@tvplus.com`,
            '5521964422488'
        );
        await helpers.ativarAssinatura(clienteAuto.id, userWithDomain, passClean, 30 * 24);

        console.log(`[SVA AUTH OK] Acesso auto-sincronizado e autorizado para: ${userWithDomain}`);
        await helpers.registrarPingSessao(userWithDomain, dispositivo, ip, 'Canais ao Vivo e Filmes HD');
        return res.status(200).json({ success: true, status: "active", msg: "Autenticado com sucesso." });

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
 * ROTA ADMIN: Disparar Pix QR Code diretamente para a tela da TV do cliente logado
 * POST /api/admin/enviar-pix-tv
 */
app.post('/api/admin/enviar-pix-tv', async (req, res) => {
    const { login_tv } = req.body;
    if (!login_tv) {
        return res.status(400).json({ error: 'O login_tv é obrigatório.' });
    }

    try {
        const valor = 10.00;
        const loginSemDominio = login_tv.replace(/@.*$/, '');
        const cobranca = await paymentService.gerarCobrancaPix(valor, {
            nome: `Cliente ${login_tv}`,
            email: `${loginSemDominio}@tvplus.com`,
            telefone: '5521964422488'
        });

        const pixData = {
            txid: cobranca.txid,
            valor: '10.00',
            copiaCola: cobranca.copiaCola,
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(cobranca.copiaCola)}`
        };

        // Salva a solicitação de Pix forçado no banco para exibição imediata na TV
        await helpers.forcarPixNaTv(login_tv, pixData);

        // Registra o pagamento pendente para o cliente correspondente se existir
        const dbClient = require('./database').db;
        const clienteRow = await new Promise(resolve => {
            dbClient.get('SELECT cliente_id FROM assinaturas WHERE login_tv LIKE ? OR REPLACE(login_tv, "@tvplus", "") = ?', [`%${loginSemDominio}%`, loginSemDominio], (e, r) => resolve(r));
        });

        if (clienteRow && clienteRow.cliente_id) {
            await helpers.criarPagamento(clienteRow.cliente_id, cobranca.txid, valor);
        }

        console.log(`[ADMIN ENVIAR PIX TV] 📺 Pix de R$ 10,00 disparado para a tela da TV do usuário: ${login_tv}`);
        res.status(200).json({
            success: true,
            message: `Pix QR Code de R$ 10,00 enviado com sucesso para a tela da TV de ${login_tv}!`,
            pixData
        });
    } catch (error) {
        console.error('[ADMIN ENVIAR PIX TV ERROR]:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ROTA: Gerar Pix QR Code de Teste/Renovação direto pelo Painel Admin
 * POST /api/admin/gerar-pix-teste
 */
app.post('/api/admin/gerar-pix-teste', async (req, res) => {
    const { login_tv, cliente_id } = req.body;
    try {
        const valor = 10.00;
        const cobranca = await paymentService.gerarCobrancaPix(valor, {
            nome: login_tv || 'Cliente TV',
            email: `${login_tv || 'cliente'}@tvplus.com`,
            telefone: '5521964422488'
        });

        let targetClienteId = cliente_id;
        if (!targetClienteId && login_tv) {
            const dbClient = require('./database').db;
            const row = await new Promise(resolve => {
                dbClient.get('SELECT cliente_id FROM assinaturas WHERE login_tv = ?', [login_tv], (e, r) => resolve(r));
            });
            if (row) targetClienteId = row.cliente_id;
        }

        if (targetClienteId) {
            await helpers.criarPagamento(targetClienteId, cobranca.txid, valor);
        }

        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(cobranca.copiaCola)}`;

        res.status(200).json({
            success: true,
            txid: cobranca.txid,
            valor: valor,
            copiaCola: cobranca.copiaCola,
            qrCodeUrl: qrCodeUrl
        });
    } catch (error) {
        console.error('[ADMIN GERAR PIX ERROR]:', error.message);
        res.status(500).json({ error: error.message });
    }
});
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
        
        // Remove sufixo 'suspenso' se existir no login
        const loginLimpo = assinatura.login_tv.replace(/suspenso$/, '');
        
        // Se a assinatura estava pendente (compra direta), enfileira cadastro no ReceitaNet pela primeira vez.
        // Se já estava ativa ou suspensa, enfileira a reativação no ReceitaNet ERP de forma totalmente assíncrona.
        const receitanetQueue = require('./services/receitanetQueue');
        if (assinatura.status === 'pendente') {
            console.log(`[CONFIRMAÇÃO] Novo cliente detectado. Enfileirando cadastro no ERP em 0.01s...`);
            receitanetQueue.adicionarTarefa('CADASTRO_E_ATIVACAO', {
                cliente,
                loginTv: loginLimpo,
                senhaTv: assinatura.senha_tv
            });
        } else {
            console.log(`[CONFIRMAÇÃO] Enfileirando reativação do login (${loginLimpo}) no ERP em 0.01s...`);
            receitanetQueue.adicionarTarefa('REATIVAR', {
                loginTv: loginLimpo,
                cpf: cliente.cpfcnpj,
                nome: cliente.nome
            });
        }

        // Limpa Pix forçado e restaura o status da sessão para liberar a TV imediatamente
        await helpers.limparPixForcado(loginLimpo);
        dbClient.run("UPDATE sessoes_ativas SET status = 'ONLINE' WHERE login_tv LIKE ?", [`%${loginLimpo}%`]);

        // Estende a validade no banco local para +30 dias (ou +meses)
        const novaAssinatura = await helpers.ativarAssinatura(
            cliente.id, 
            loginLimpo, 
            assinatura.senha_tv, 
            horasExtensao, 
            assinatura.receitanet_lead_id, 
            assinatura.receitanet_cliente_id
        );

        // Notifica o cliente via WhatsApp com a mensagem de ativação / renovação concluída e os links oficiais!
        const nomeCapitalizado = capitalizeName(cliente.nome);
        const vencimentoFormatado = new Date(novaAssinatura.data_vencimento).toLocaleDateString('pt-BR');
        const msgReativacao = `Olá, *${nomeCapitalizado}*!\n\n` +
                              `Confirmamos o recebimento do seu Pix de R$ ${pagamento.valor.toFixed(2)}! 🥳\n` +
                              `Seu acesso ao aplicativo *SIGNALPLAY* foi ativado por *${meses * 30} dias* com sucesso.\n\n` +
                              `🔑 *Seus dados de acesso de TV:*\n` +
                              `• Usuário: *${loginLimpo}*\n` +
                              `• Senha: *${assinatura.senha_tv}*\n` +
                              `📅 Data de Vencimento: *${vencimentoFormatado}*\n\n` +
                              `📱 *Links e Passo a Passo para Instalar o SIGNALPLAY:*\n\n` +
                              `🍏 *Para iPhone / iPad / Apple TV (iOS):*\n` +
                              `https://apps.apple.com/br/app/signalplay/id6749374183\n\n` +
                              `🤖 *Para Android (Celular, Smart TV, TV Box & Firestick):*\n` +
                              `https://play.google.com/store/apps/details?id=br.com.signalplay.tv.mobile&hl=pt_BR\n\n` +
                              `💻 *Assistir no Computador / PC (Navegador):*\n` +
                              `https://tv.signalplay.com.br/login\n\n` +
                              `📋 *Como Acessar:*\n` +
                              `1. Abra a loja do seu aparelho ou acesse o link acima.\n` +
                              `2. Instale o app e insira o seu Usuário e Senha informados acima.\n\n` +
                              `⚠️ *Regra de Uso Importante:*\n` +
                              `• Você pode assistir em *ATÉ 3 aparelhos simultaneamente*.\n\n` +
                              `Se precisar de suporte, basta responder esta mensagem! Aproveite sua programação! 📺✨`;
        
        console.log(`[CONFIRMAÇÃO WA] Enviando mensagem de ativação/renovação concluída via WhatsApp para ${cliente.telefone}...`);
        await whatsappService.enviarMensagem(cliente.telefone, msgReativacao);

        return { login_tv: loginLimpo, senha_tv: assinatura.senha_tv };
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

            // 4. Enfileira o bloqueio/suspensão no ReceitaNet ERP em segundo plano (resposta imediata para a tela em 0.01s)
            const receitanetQueue = require('./services/receitanetQueue');
            receitanetQueue.adicionarTarefa('SUSPENDER', {
                loginTv: row.login_tv,
                cpf: row.cpfcnpj,
                nome: row.nome
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
            
            const receitanetQueue = require('./services/receitanetQueue');
            
            if (row.status === 'pendente') {
                db.get('SELECT * FROM clientes WHERE id = ?', [cliente_id], async (err3, cliente) => {
                    if (err3 || !cliente) return res.status(404).json({ error: 'Cliente não localizado no banco local.' });
                    
                    receitanetQueue.adicionarTarefa('CADASTRO_E_ATIVACAO', {
                        cliente,
                        loginTv: row.login_tv,
                        senhaTv: row.senha_tv
                    });
                    
                    const novaDataVenc = new Date();
                    novaDataVenc.setDate(novaDataVenc.getDate() + 30);
                    db.run("UPDATE assinaturas SET status = 'ativa', data_vencimento = ? WHERE id = ?", [novaDataVenc.toISOString(), row.id], (err2) => {
                        if (err2) return res.status(500).json({ error: err2.message });
                        res.status(200).json({ message: 'Comando de ativação enfileirado em segundo plano!' });
                    });
                });
            } else {
                receitanetQueue.adicionarTarefa('REATIVAR', {
                    loginTv: row.login_tv,
                    cpf: row.cpfcnpj,
                    nome: row.nome
                });

                const novaDataVenc = new Date();
                novaDataVenc.setDate(novaDataVenc.getDate() + 30);
                db.run("UPDATE assinaturas SET status = 'ativa', data_vencimento = ? WHERE id = ?", [novaDataVenc.toISOString(), row.id], (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.status(200).json({ message: 'Comando de reativação enfileirado em segundo plano!' });
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
            
            // Enfileira a exclusão no ERP em segundo plano
            const receitanetQueue = require('./services/receitanetQueue');
            receitanetQueue.adicionarTarefa('SUSPENDER', {
                loginTv: row.login_tv,
                cpf: row.cpfcnpj,
                nome: row.nome
            });
            
            // Exclui localmente do SQLite em < 0.01 segundo para liberar a tela imediatamente
            db.run('DELETE FROM pagamentos WHERE cliente_id = ?', [cliente_id], () => {
                db.run('DELETE FROM assinaturas WHERE cliente_id = ?', [cliente_id], () => {
                    db.run('DELETE FROM clientes WHERE id = ?', [cliente_id], () => {
                        res.status(200).json({ message: 'Cliente excluído localmente em 0.01s! O robô desativará a conta no ERP em segundo plano.' });
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
 * ROTA: Retorna as últimas 50 tentativas de login SVA registradas no servidor com diagnóstico completo
 * GET /api/admin/sva-debug-logs
 */
app.get('/api/admin/sva-debug-logs', (req, res) => {
    res.status(200).json(svaDebugLogs);
});

/**
 * ROTA: Atualiza a senha de um cliente ou teste no banco local em 1 clique
 * POST /api/admin/atualizar-senha-cliente
 */
app.post('/api/admin/atualizar-senha-cliente', async (req, res) => {
    const { login_tv, nova_senha } = req.body;
    if (!login_tv || !nova_senha) {
        return res.status(400).json({ error: 'Login e nova senha são obrigatórios.' });
    }

    try {
        const dbClient = require('./database').db;
        const passClean = nova_senha.toString().trim();

        // Atualiza na tabela assinaturas
        await new Promise(resolve => {
            dbClient.run('UPDATE assinaturas SET senha_tv = ? WHERE login_tv LIKE ? OR REPLACE(login_tv, "@tvplus", "") LIKE ?', [passClean, `%${login_tv}%`, `%${login_tv}%`], resolve);
        });

        // Atualiza na tabela testes
        await new Promise(resolve => {
            dbClient.run('UPDATE testes SET senha_tv = ? WHERE login_tv LIKE ? OR REPLACE(login_tv, "@tvplus", "") LIKE ?', [passClean, `%${login_tv}%`, `%${login_tv}%`], resolve);
        });

        console.log(`[ADMIN SENHA ATUALIZADA] 🔑 Senha do usuário '${login_tv}' alterada para '${passClean}' com sucesso.`);
        res.status(200).json({ success: true, message: `Senha do usuário '${login_tv}' atualizada para '${passClean}'!` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * ROTA: Enviar Pix QR Code diretamente para a tela da TV do cliente logado
 * POST /api/admin/enviar-pix-tv
 */
app.post('/api/admin/enviar-pix-tv', async (req, res) => {
    const { login_tv } = req.body;
    if (!login_tv) return res.status(400).json({ error: 'Login do usuário é obrigatório.' });

    try {
        const valor = 10.00;
        const cobranca = await paymentService.gerarCobrancaPix(valor, {
            nome: login_tv,
            email: 'cliente.tvplus.oficial@gmail.com',
            telefone: '5521964422488'
        });

        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(cobranca.copiaCola)}`;

        const pixData = {
            txid: cobranca.txid,
            valor: valor,
            copiaCola: cobranca.copiaCola,
            qrCodeUrl: qrCodeUrl
        };

        // Salva na tabela sessoes_ativas para exibição imediata no próximo ping do app da TV
        await helpers.forcarPixNaTv(login_tv, pixData);

        console.log(`[PIX TV ENVIADO] 📺 Pix QR Code disparado para a tela da TV do cliente: ${login_tv}`);
        res.status(200).json({
            success: true,
            message: `Pix QR Code disparado para a TV do cliente ${login_tv}! O código aparecerá na tela no próximo segundo.`,
            pixData: pixData
        });
    } catch (error) {
        console.error('[ENVIAR PIX TV ERROR]:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ROTA: Listar todos os testes grátis de 3 horas ativos (oculta testes excluídos)
 * GET /api/admin/testes
 */
app.get('/api/admin/testes', async (req, res) => {
    try {
        db.all("SELECT * FROM testes WHERE status != 'excluido' ORDER BY id DESC", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(200).json(rows || []);
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * ROTA: Expirar e Excluir teste grátis do Admin e do ERP
 * POST /api/admin/excluir-teste
 */
app.post('/api/admin/excluir-teste', async (req, res) => {
    const { id } = req.body;
    try {
        db.get('SELECT * FROM testes WHERE id = ?', [id], async (err, row) => {
            if (err || !row) return res.status(404).json({ error: 'Teste não localizado.' });

            // Marca como excluído no banco local para remover da tabela do Admin (mas retém o número de WhatsApp travado contra novos testes)
            await helpers.marcarTesteExpirado(row.id);

            // Enfileira a exclusão completa/rescisão do teste no ReceitaNet ERP em segundo plano
            const receitanetQueue = require('./services/receitanetQueue');
            receitanetQueue.adicionarTarefa('EXCLUIR_COMPLETO', { loginTv: row.login_tv });

            res.status(200).json({ message: `Teste ${row.login_tv} removido do Painel Admin e enfileirado para exclusão completa no ERP!` });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * ROTA: Listar todas as sessões ativas e telemetria de clientes logados
 * GET /api/admin/sessoes
 */
app.get('/api/admin/sessoes', async (req, res) => {
    try {
        const sessoes = await helpers.obterSessoesAtivas();
        res.status(200).json(sessoes || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * ROTA: Derrubar / Interromper conexão de um cliente em tempo real (Kick)
 * POST /api/admin/derrubar-sessao
 */
app.post('/api/admin/derrubar-sessao', async (req, res) => {
    const { login_tv } = req.body;
    if (!login_tv) return res.status(400).json({ error: 'Login do usuário é obrigatório.' });

    try {
        // 1. Invalida a sessão no banco SQLite para forçar HTTP 403 Forbidden no próximo ping do app
        await helpers.derrubarSessao(login_tv);

        // 2. Enfileira o bloqueio/alteração no ReceitaNet ERP em segundo plano
        const receitanetQueue = require('./services/receitanetQueue');
        receitanetQueue.adicionarTarefa('SUSPENDER', { loginTv: login_tv });

        console.log(`[DERRUBAR SESSÃO] ⚡ Conexão do usuário ${login_tv} foi encerrada pelo Administrador!`);
        res.status(200).json({ message: `Conexão do usuário ${login_tv} foi derrubada com sucesso! O aplicativo será desconectado no próximo ping.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * ROTA DE DIAGNÓSTICO: Simular mensagem do WhatsApp recebida e testar resposta da IA
 * POST /api/admin/test-bot
 */
app.post('/api/admin/test-bot', async (req, res) => {
    const { telefone, mensagem } = req.body;
    const testPhone = telefone ? telefone.replace(/\D/g, '') : '5521964422488';
    const testMsg = mensagem || 'oi';

    console.log(`[TESTE ROBÔ IA] Simulando mensagem recebida de +${testPhone}: "${testMsg}"`);

    try {
        const aiChatbotService = require('./services/aiChatbot');
        const estado = await helpers.obterEstadoBot(testPhone);
        
        // Executa o processamento do chatbot
        await aiChatbotService.processarMensagemEntrada(testPhone, testMsg);

        res.status(200).json({
            status: 'sucesso',
            mensagemSimulada: testMsg,
            telefone: testPhone,
            modoAtual: estado ? estado.modo : 'IA',
            detalhe: 'Mensagem processada pelo robô IA. Verifique o console de logs ou o celular registrado!'
        });
    } catch (error) {
        console.error('[TESTE ROBÔ IA ERROR]:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * WEBHOOK: Recebe todas as mensagens que chegam no WhatsApp via Z-API
 * POST /api/webhook/whatsapp
 */
app.post('/api/webhook/whatsapp', async (req, res) => {
    try {
        const body = req.body || {};
        console.log(`[WEBHOOK WHATSAPP RECEBIDO] Full Body:`, JSON.stringify(body));

        // Extração infalível de número de telefone (remove sufixos como @c.us e caracteres não-numéricos)
        let rawPhone = body.phone || body.from || body.chatId || body.sender || body.participant ||
                       (body.data && (body.data.phone || body.data.from || body.data.chatId)) || '';
        
        const phone = rawPhone.toString().replace(/@.*$/, '').replace(/\D/g, '');
        const isGroup = body.isGroup === true || (body.data && body.data.isGroup === true);
        
        // Extração infalível do texto da mensagem enviada pelo cliente
        let text = '';
        if (typeof body.text === 'string') text = body.text;
        else if (body.text && typeof body.text === 'object' && body.text.message) text = body.text.message;
        else if (body.text && typeof body.text === 'object' && body.text.text) text = body.text.text;
        else if (typeof body.message === 'string') text = body.message;
        else if (typeof body.body === 'string') text = body.body;
        else if (typeof body.content === 'string') text = body.content;
        else if (body.data && typeof body.data.message === 'string') text = body.data.message;
        else if (body.data && typeof body.data.text === 'string') text = body.data.text;
        else if (body.data && body.data.message && typeof body.data.message.text === 'string') text = body.data.message.text;

        console.log(`[WEBHOOK WHATSAPP ANALISE] Telefone: "${phone}", Grupo: ${isGroup}, Texto: "${text}"`);

        // Processa a mensagem se houver número e texto válido e não for grupo
        if (!isGroup && phone && text && text.trim().length > 0) {
            const aiChatbotService = require('./services/aiChatbot');
            aiChatbotService.processarMensagemEntrada(phone, text).catch(err => {
                console.error("[WEBHOOK WHATSAPP ERROR] Erro no processamento da mensagem pelo robô:", err.message);
            });
        }

        res.status(200).json({ status: 'success', message: 'Webhook recebido com sucesso' });
    } catch (error) {
        console.error('[WEBHOOK WHATSAPP ERROR]:', error.message);
        res.status(200).json({ status: 'error', message: error.message });
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
    
    // Inicia checagem automática em tempo real de Pix pagos a cada 15 segundos
    const { verificarPagamentosPendentes } = require('./cron');
    setInterval(() => {
        verificarPagamentosPendentes(processarConfirmacaoPagamento);
    }, 15000);
    console.log('[PIX POLLING] Monitor em tempo real de pagamentos Pix ativado (a cada 15 segundos).');
});
