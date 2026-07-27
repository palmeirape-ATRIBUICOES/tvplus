const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados SQLite:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite local.');
    }
});

// Inicialização das tabelas
function initDb() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Tabela de Clientes
            db.run(`
                CREATE TABLE IF NOT EXISTS clientes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    telefone TEXT NOT NULL,
                    cpfcnpj TEXT,
                    cep TEXT,
                    endereco TEXT,
                    numero TEXT,
                    bairro TEXT,
                    cidade TEXT,
                    uf TEXT,
                    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => { 
                if (err) return reject(err);
                // Executa migrações das novas colunas de endereço/cpf no cliente caso já existisse
                db.run("ALTER TABLE clientes ADD COLUMN cpfcnpj TEXT", () => {});
                db.run("ALTER TABLE clientes ADD COLUMN cep TEXT", () => {});
                db.run("ALTER TABLE clientes ADD COLUMN endereco TEXT", () => {});
                db.run("ALTER TABLE clientes ADD COLUMN numero TEXT", () => {});
                db.run("ALTER TABLE clientes ADD COLUMN bairro TEXT", () => {});
                db.run("ALTER TABLE clientes ADD COLUMN cidade TEXT", () => {});
                db.run("ALTER TABLE clientes ADD COLUMN uf TEXT", () => {});
            });

            // Tabela de Assinaturas
            db.run(`
                CREATE TABLE IF NOT EXISTS assinaturas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cliente_id INTEGER NOT NULL,
                    status TEXT DEFAULT 'pendente', -- pendente, ativa, vencida, suspensa
                    data_inicio DATETIME,
                    data_vencimento DATETIME,
                    login_tv TEXT,
                    senha_tv TEXT,
                    aviso_enviado INTEGER DEFAULT 0, -- 0 = não enviado, 1 = enviado
                    ispfy_cliente_id TEXT,
                    ispfy_contrato_id TEXT,
                    receitanet_lead_id TEXT,
                    receitanet_cliente_id TEXT,
                    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
                )
            `, (err) => { 
                if (err) return reject(err);
                // Executa migrações das novas colunas caso a tabela já existisse
                db.run("ALTER TABLE assinaturas ADD COLUMN ispfy_cliente_id TEXT", () => {});
                db.run("ALTER TABLE assinaturas ADD COLUMN ispfy_contrato_id TEXT", () => {});
                db.run("ALTER TABLE assinaturas ADD COLUMN receitanet_lead_id TEXT", () => {});
                db.run("ALTER TABLE assinaturas ADD COLUMN receitanet_cliente_id TEXT", () => {});
            });

            // Tabela de Pagamentos
            db.run(`
                CREATE TABLE IF NOT EXISTS pagamentos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cliente_id INTEGER NOT NULL,
                    txid_pix TEXT UNIQUE NOT NULL,
                    valor REAL NOT NULL,
                    status TEXT DEFAULT 'pendente', -- pendente, pago, expirado
                    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                    data_pagamento DATETIME,
                    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
                )
            `, (err) => { 
                if (err) return reject(err);

                // Tabela de Atendimento do Bot de IA / Humano
                db.run(`
                    CREATE TABLE IF NOT EXISTS conversas_bot (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        telefone TEXT UNIQUE NOT NULL,
                        modo TEXT DEFAULT 'IA',
                        historico TEXT DEFAULT '[]',
                        ultima_interacao DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (errBot) => {
                    if (errBot) return reject(errBot);

                    // Tabela de Testes Grátis de 3 Horas
                    db.run(`
                        CREATE TABLE IF NOT EXISTS testes (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            telefone TEXT UNIQUE NOT NULL,
                            login_tv TEXT UNIQUE NOT NULL,
                            senha_tv TEXT NOT NULL,
                            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                            data_expiracao DATETIME NOT NULL,
                            status TEXT DEFAULT 'ativo',
                            aviso_expiracao_enviado INTEGER DEFAULT 0
                        )
                    `, (errTeste) => {
                        if (errTeste) return reject(errTeste);

                        // Tabela de Sessões Ativas & Telemetria em Tempo Real (Quem está logado / assistindo)
                        db.run(`
                            CREATE TABLE IF NOT EXISTS sessoes_ativas (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                login_tv TEXT UNIQUE NOT NULL,
                                dispositivo TEXT,
                                ip_origem TEXT,
                                canal_atual TEXT DEFAULT 'Sinal Digital Live',
                                ultimo_ping DATETIME DEFAULT CURRENT_TIMESTAMP,
                                status TEXT DEFAULT 'ONLINE',
                                pix_forcado TEXT
                            )
                        `, (errSessao) => {
                            if (errSessao) return reject(errSessao);
                            // Adiciona coluna pix_forcado se não existir
                            db.run("ALTER TABLE sessoes_ativas ADD COLUMN pix_forcado TEXT", () => {});
                            console.log('Tabelas do banco de dados (clientes, assinaturas, pagamentos, conversas_bot, testes, sessoes_ativas) verificadas com sucesso.');
                            resolve();
                        });
                    });
                });
            });
        });
    });
}

// Funções utilitárias usando Promises
const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// Helpers do Banco
const dbHelpers = {
    // Conversas do Bot IA / Humano
    async obterEstadoBot(telefone) {
        let fone = telefone.replace(/\D/g, '');
        // Garante que a tabela conversas_bot exista no SQLite
        await dbRun(`
            CREATE TABLE IF NOT EXISTS conversas_bot (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telefone TEXT UNIQUE NOT NULL,
                modo TEXT DEFAULT 'IA',
                historico TEXT DEFAULT '[]',
                ultima_interacao DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).catch(() => {});

        let row = await dbGet('SELECT * FROM conversas_bot WHERE telefone = ?', [fone]).catch(() => null);
        if (!row) {
            await dbRun('INSERT INTO conversas_bot (telefone, modo) VALUES (?, ?)', [fone, 'IA']).catch(() => {});
            row = { telefone: fone, modo: 'IA', historico: '[]' };
        }
        return row;
    },

    async definirModoBot(telefone, modo) {
        let fone = telefone.replace(/\D/g, '');
        await dbRun(`
            CREATE TABLE IF NOT EXISTS conversas_bot (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telefone TEXT UNIQUE NOT NULL,
                modo TEXT DEFAULT 'IA',
                historico TEXT DEFAULT '[]',
                ultima_interacao DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).catch(() => {});

        await dbRun(`
            INSERT INTO conversas_bot (telefone, modo, ultima_interacao)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(telefone) DO UPDATE SET modo = excluded.modo, ultima_interacao = CURRENT_TIMESTAMP
        `, [fone, modo]);
    },

    async salvarHistoricoBot(telefone, historicoJson) {
        let fone = telefone.replace(/\D/g, '');
        await dbRun(`
            UPDATE conversas_bot SET historico = ?, ultima_interacao = CURRENT_TIMESTAMP WHERE telefone = ?
        `, [JSON.stringify(historicoJson), fone]).catch(() => {});
    },

    async listarConversasBot() {
        await dbRun(`
            CREATE TABLE IF NOT EXISTS conversas_bot (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telefone TEXT UNIQUE NOT NULL,
                modo TEXT DEFAULT 'IA',
                historico TEXT DEFAULT '[]',
                ultima_interacao DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).catch(() => {});

        return await dbAll('SELECT * FROM conversas_bot ORDER BY ultima_interacao DESC').catch(() => []);
    },

    // Testes Grátis de 3 Horas (Validação e Geração Sequencial)
    async obterTestePorTelefone(telefone) {
        let fone = telefone.replace(/\D/g, '');
        // Exceção de Desenvolvedor: O número 21964422488 tem permissão para testes infinitos
        if (fone.includes('21964422488')) {
            return null;
        }

        await dbRun(`
            CREATE TABLE IF NOT EXISTS testes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telefone TEXT UNIQUE NOT NULL,
                login_tv TEXT UNIQUE NOT NULL,
                senha_tv TEXT NOT NULL,
                data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                data_expiracao DATETIME NOT NULL,
                status TEXT DEFAULT 'ativo',
                aviso_expiracao_enviado INTEGER DEFAULT 0
            )
        `).catch(() => {});

        return await dbGet("SELECT * FROM testes WHERE telefone = ? AND status != 'excluido'", [fone]).catch(() => null);
    },

    async criarNovoTeste(telefone) {
        let fone = telefone.replace(/\D/g, '');
        
        // Se for o número de testes do desenvolvedor (21964422488), remove testes antigos para permitir inserção sem conflito
        if (fone.includes('21964422488')) {
            await dbRun('DELETE FROM testes WHERE telefone LIKE "%21964422488%"').catch(() => {});
        }

        await dbRun(`
            CREATE TABLE IF NOT EXISTS testes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telefone TEXT UNIQUE NOT NULL,
                login_tv TEXT UNIQUE NOT NULL,
                senha_tv TEXT NOT NULL,
                data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                data_expiracao DATETIME NOT NULL,
                status TEXT DEFAULT 'ativo',
                aviso_expiracao_enviado INTEGER DEFAULT 0
            )
        `).catch(() => {});

        // Calcula o próximo sequencial de teste (ex: teste1@tvplus, teste2@tvplus)
        const countRow = await dbGet('SELECT count(*) as total FROM testes').catch(() => ({ total: 0 }));
        const proximoNum = (countRow ? countRow.total : 0) + 1;
        const loginTeste = `teste${proximoNum}@tvplus`;
        
        // Gera senha numérica aleatória de 4 dígitos
        const senhaTeste = Math.floor(1000 + Math.random() * 9000).toString();

        // Validade exata de 3 HORAS
        const dataExpiracao = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

        await dbRun(`
            INSERT INTO testes (telefone, login_tv, senha_tv, data_expiracao, status)
            VALUES (?, ?, ?, ?, 'ativo')
        `, [fone, loginTeste, senhaTeste, dataExpiracao]);

        return {
            telefone: fone,
            login_tv: loginTeste,
            senha_tv: senhaTeste,
            data_expiracao: dataExpiracao,
            duracaoHoras: 3
        };
    },

    async buscarTestesExpirados() {
        const agora = new Date().toISOString();
        await dbRun(`
            CREATE TABLE IF NOT EXISTS testes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telefone TEXT UNIQUE NOT NULL,
                login_tv TEXT UNIQUE NOT NULL,
                senha_tv TEXT NOT NULL,
                data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                data_expiracao DATETIME NOT NULL,
                status TEXT DEFAULT 'ativo',
                aviso_expiracao_enviado INTEGER DEFAULT 0
            )
        `).catch(() => {});

        return await dbAll(`
            SELECT * FROM testes 
            WHERE status = 'ativo' AND data_expiracao <= ? AND aviso_expiracao_enviado = 0
        `, [agora]).catch(() => []);
    },

    async marcarTesteExpirado(id) {
        await dbRun(`
            UPDATE testes SET status = 'excluido', aviso_expiracao_enviado = 1 WHERE id = ?
        `, [id]).catch(() => {});
    },

    // Telemetria & Monitor de Conexões em Tempo Real
    async registrarPingSessao(loginTv, dispositivo = 'SignalPlay App', ip = '127.0.0.1', canal = 'Canais ao Vivo Ultra HD') {
        await dbRun(`
            CREATE TABLE IF NOT EXISTS sessoes_ativas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                login_tv TEXT UNIQUE NOT NULL,
                dispositivo TEXT,
                ip_origem TEXT,
                canal_atual TEXT DEFAULT 'Sinal Digital Live',
                ultimo_ping DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'ONLINE'
            )
        `).catch(() => {});

        // Insere ou atualiza o ping mais recente mantendo o status se for DERRUBADO
        await dbRun(`
            INSERT INTO sessoes_ativas (login_tv, dispositivo, ip_origem, canal_atual, status, ultimo_ping)
            VALUES (?, ?, ?, ?, 'ONLINE', CURRENT_TIMESTAMP)
            ON CONFLICT(login_tv) DO UPDATE SET 
                dispositivo = excluded.dispositivo,
                ip_origem = excluded.ip_origem,
                canal_atual = excluded.canal_atual,
                ultimo_ping = CURRENT_TIMESTAMP
        `, [loginTv, dispositivo, ip, canal]);
    },

    async obterSessoesAtivas() {
        await dbRun(`
            CREATE TABLE IF NOT EXISTS sessoes_ativas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                login_tv TEXT UNIQUE NOT NULL,
                dispositivo TEXT,
                ip_origem TEXT,
                canal_atual TEXT DEFAULT 'Sinal Digital Live',
                ultimo_ping DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'ONLINE',
                pix_forcado TEXT
            )
        `).catch(() => {});

        // Marca como OFFLINE se o último ping de transmissão foi há mais de 45 segundos
        await dbRun("UPDATE sessoes_ativas SET status = 'OFFLINE' WHERE status = 'ONLINE' AND (julianday('now') - julianday(ultimo_ping)) * 86400 > 45").catch(() => {});

        return await dbAll('SELECT * FROM sessoes_ativas ORDER BY ultimo_ping DESC').catch(() => []);
    },

    async derrubarSessao(loginTv) {
        await dbRun(`
            UPDATE sessoes_ativas SET status = 'DERRUBADO', ultimo_ping = CURRENT_TIMESTAMP WHERE login_tv = ?
        `, [loginTv]).catch(() => {});
    },

    async verificarSessaoDerrubada(loginTv) {
        const sessao = await dbGet('SELECT * FROM sessoes_ativas WHERE login_tv = ?', [loginTv]).catch(() => null);
        return sessao && sessao.status === 'DERRUBADO';
    },

    async forcarPixNaTv(loginTv, pixData) {
        const payloadStr = typeof pixData === 'object' ? JSON.stringify(pixData) : pixData;
        await dbRun(`
            INSERT INTO sessoes_ativas (login_tv, status, pix_forcado, ultimo_ping)
            VALUES (?, 'ONLINE', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(login_tv) DO UPDATE SET 
                pix_forcado = excluded.pix_forcado,
                ultimo_ping = CURRENT_TIMESTAMP
        `, [loginTv, payloadStr]).catch(() => {});
    },

    async obterPixForcado(loginTv) {
        const sessao = await dbGet('SELECT pix_forcado FROM sessoes_ativas WHERE login_tv = ?', [loginTv]).catch(() => null);
        if (sessao && sessao.pix_forcado) {
            try {
                return JSON.parse(sessao.pix_forcado);
            } catch (e) {
                return sessao.pix_forcado;
            }
        }
        return null;
    },

    async limparPixForcado(loginTv) {
        await dbRun('UPDATE sessoes_ativas SET pix_forcado = NULL WHERE login_tv = ?', [loginTv]).catch(() => {});
    },

    // Clientes
    async criarOuObterCliente(nome, email, telefone, cpfcnpj = null, cep = null, endereco = null, numero = null, bairro = null, cidade = null, uf = null) {
        // Normaliza telefone (remove caracteres não numéricos)
        const telLimpo = telefone.replace(/\D/g, '');
        const cpfLimpo = cpfcnpj ? cpfcnpj.replace(/\D/g, '') : null;
        
        let cliente = await dbGet('SELECT * FROM clientes WHERE cpfcnpj = ?', [cpfLimpo]);
        if (!cliente) {
            const res = await dbRun(
                `INSERT INTO clientes (nome, email, telefone, cpfcnpj, cep, endereco, numero, bairro, cidade, uf) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [nome, email, telLimpo, cpfLimpo, cep, endereco, numero, bairro, cidade, uf]
            );
            cliente = { id: res.lastID, nome, email, telefone: telLimpo, cpfcnpj: cpfLimpo };
        } else {
            // Atualiza dados se mudou
            await dbRun(
                `UPDATE clientes 
                 SET nome = ?, telefone = ?, cpfcnpj = coalesce(?, cpfcnpj), cep = coalesce(?, cep), 
                     endereco = coalesce(?, endereco), numero = coalesce(?, numero), bairro = coalesce(?, bairro), 
                     cidade = coalesce(?, cidade), uf = coalesce(?, uf) 
                 WHERE id = ?`,
                [nome, telLimpo, cpfLimpo, cep, endereco, numero, bairro, cidade, uf, cliente.id]
            );
            cliente.nome = nome;
            cliente.telefone = telLimpo;
            if (cpfLimpo) cliente.cpfcnpj = cpfLimpo;
        }
        return cliente;
    },

    // Pagamentos
    async criarPagamento(clienteId, txid, valor) {
        await dbRun(
            'INSERT INTO pagamentos (cliente_id, txid_pix, valor, status) VALUES (?, ?, ?, ?)',
            [clienteId, txid, valor, 'pendente']
        );
        return { cliente_id: clienteId, txid_pix: txid, valor, status: 'pendente' };
    },

    async obterPagamentoPorTxid(txid) {
        return await dbGet('SELECT * FROM pagamentos WHERE txid_pix = ?', [txid]);
    },

    async atualizarStatusPagamento(txid, status) {
        const dataPagamento = status === 'pago' ? new Date().toISOString() : null;
        await dbRun(
            'UPDATE pagamentos SET status = ?, data_pagamento = ? WHERE txid_pix = ?',
            [status, dataPagamento, txid]
        );
    },

    // Assinaturas
    async obterAssinaturaPorClienteId(clienteId) {
        return await dbGet('SELECT * FROM assinaturas WHERE cliente_id = ?', [clienteId]);
    },

    async criarOuObterAssinaturaPendente(clienteId) {
        let assinatura = await dbGet('SELECT * FROM assinaturas WHERE cliente_id = ?', [clienteId]);
        if (!assinatura) {
            const res = await dbRun('INSERT INTO assinaturas (cliente_id, status) VALUES (?, ?)', [clienteId, 'pendente']);
            assinatura = { id: res.lastID, cliente_id: clienteId, status: 'pendente' };
        }
        return assinatura;
    },

    async ativarAssinatura(clienteId, loginTv, senhaTv, horasDuracao = 720, receitanetLeadId = null, receitanetClienteId = null) {
        const dataInicio = new Date();
        const dataVencimento = new Date();
        dataVencimento.setMilliseconds(dataVencimento.getMilliseconds() + (horasDuracao * 60 * 60 * 1000));

        const dataInicioStr = dataInicio.toISOString();
        const dataVencimentoStr = dataVencimento.toISOString();

        await dbRun(
            `UPDATE assinaturas 
             SET status = 'ativa', data_inicio = ?, data_vencimento = ?, login_tv = ?, senha_tv = ?, aviso_enviado = 0, 
                 receitanet_lead_id = ?, receitanet_cliente_id = ?
             WHERE cliente_id = ?`,
            [dataInicioStr, dataVencimentoStr, loginTv, senhaTv, receitanetLeadId, receitanetClienteId, clienteId]
        );

        return {
            cliente_id: clienteId,
            status: 'ativa',
            data_inicio: dataInicioStr,
            data_vencimento: dataVencimentoStr,
            login_tv: loginTv,
            senha_tv: senhaTv,
            receitanet_lead_id: receitanetLeadId,
            receitanet_cliente_id: receitanetClienteId
        };
    },

    async atualizarStatusAssinatura(assinaturaId, status) {
        await dbRun('UPDATE assinaturas SET status = ? WHERE id = ?', [status, assinaturaId]);
    },

    async marcarAvisoEnviado(assinaturaId) {
        await dbRun('UPDATE assinaturas SET aviso_enviado = 1 WHERE id = ?', [assinaturaId]);
    },

    async desmarcarAvisoEnviado(assinaturaId) {
        await dbRun('UPDATE assinaturas SET aviso_enviado = 0 WHERE id = ?', [assinaturaId]);
    },

    // Buscas de Cron
    async buscarAssinaturasExpirando(diasAviso = 3) {
        const hoje = new Date();
        const limite = new Date();
        limite.setDate(hoje.getDate() + diasAviso);

        // Retorna assinaturas ativas cujo vencimento está antes do limite e que ainda não receberam o aviso de expiração
        return await dbAll(`
            SELECT a.*, c.nome, c.telefone, c.email 
            FROM assinaturas a
            JOIN clientes c ON a.cliente_id = c.id
            WHERE a.status = 'ativa' 
              AND a.data_vencimento <= ? 
              AND a.aviso_enviado = 0
        `, [limite.toISOString()]);
    },

    async buscarAssinaturasVencidasNaoBloqueadas() {
        const hoje = new Date().toISOString();

        // Retorna assinaturas ativas cujo vencimento já passou da data atual
        return await dbAll(`
            SELECT a.*, c.nome, c.telefone, c.email 
            FROM assinaturas a
            JOIN clientes c ON a.cliente_id = c.id
            WHERE a.status = 'ativa' 
              AND a.data_vencimento < ?
        `, [hoje]);
    },

    async buscarAssinaturasSuspensas() {
        return await dbAll(`
            SELECT a.*, c.nome, c.telefone, c.email 
            FROM assinaturas a
            JOIN clientes c ON a.cliente_id = c.id
            WHERE a.status = 'suspensa'
        `);
    }
};

module.exports = {
    initDb,
    helpers: dbHelpers,
    db
};
