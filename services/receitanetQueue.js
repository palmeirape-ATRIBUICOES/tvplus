const receitanetRobot = require('./receitanetRobot');
const startvRobot = require('./startvRobot');

/**
 * Fila Concorrente e Assíncrona para Execução Independente de Automações do ERP ReceitaNet.
 * Permite que múltiplos comandos (criar testes, suspender, reativar, excluir) sejam executados 
 * em segundo plano sem travar o painel administrativo ou bloquear o servidor.
 */
class ReceitanetQueueService {
    constructor() {
        this.queue = [];
        this.activeWorkers = 0;
        this.maxWorkers = 1; // Fila Estritamente Sequencial (1 por vez) para evitar colisão de sessão no ERP
    }

    /**
     * Enfileira uma nova automação e retorna resposta imediata para a API
     * @param {string} tipo - 'CADASTRO_E_ATIVACAO', 'REATIVAR', 'SUSPENDER'
     * @param {object} payload - Parâmetros da automação
     * @returns {string} jobId
     */
    adicionarTarefa(tipo, payload) {
        const jobId = 'JOB_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const task = { jobId, tipo, payload, criadoEm: new Date() };
        
        this.queue.push(task);
        console.log(`[RECEITANET QUEUE] 🚀 Tarefa ${jobId} (${tipo}) enfileirada em 0.01s. Total na fila: ${this.queue.length}`);
        
        // Dispara o worker de forma não-bloqueante
        setTimeout(() => this.processarProxima(), 10);
        
        return jobId;
    }

    async processarProxima() {
        if (this.activeWorkers >= this.maxWorkers || this.queue.length === 0) {
            return;
        }

        const task = this.queue.shift();
        this.activeWorkers++;
        
        console.log(`[RECEITANET WORKER ${this.activeWorkers}/${this.maxWorkers}] ⚙️ Executando tarefa em segundo plano ${task.jobId} (${task.tipo})...`);

        try {
            const loginTarget = task.payload ? (task.payload.loginTv || task.payload.login_tv || '') : '';
            // O robô exclusivo (startvRobot) processa todos os logins de provedores (@startv, @fibracom, @cliente1, etc)
            const robotToUse = startvRobot;

            console.log(`[RECEITANET QUEUE] 🛡️ Direcionado para o Robô Exclusivo de Provedores (${loginTarget}).`);

            if (task.tipo === 'CADASTRO_E_ATIVACAO') {
                const cpfFinal = task.payload.cpf || task.payload.cpfcnpj || (task.payload.cliente && (task.payload.cliente.cpf || task.payload.cliente.cpfcnpj)) || '';
                const clienteObj = {
                    nome: task.payload.nome || (task.payload.cliente && task.payload.cliente.nome) || 'Cliente Provedor',
                    cpf: cpfFinal,
                    cpfcnpj: cpfFinal,
                    email: task.payload.email || (task.payload.cliente && task.payload.cliente.email) || '',
                    telefone: task.payload.telefone || (task.payload.cliente && task.payload.cliente.telefone) || ''
                };
                const loginTv = task.payload.loginTv || task.payload.login_tv || (task.payload.cliente && task.payload.cliente.login_tv);
                const senhaTv = task.payload.senhaTv || task.payload.senha_tv || cpfFinal;
                await robotToUse.cadastrarEAtivarTV(clienteObj, loginTv, senhaTv);
            } else if (task.tipo === 'REATIVAR') {
                await robotToUse.reativarCliente(task.payload.loginTv, task.payload.cpf, task.payload.nome);
            } else if (task.tipo === 'SUSPENDER') {
                await robotToUse.suspenderCliente(task.payload.loginTv, task.payload.cpf, task.payload.nome);
            } else if (task.tipo === 'EXCLUIR_COMPLETO') {
                await robotToUse.excluirCliente(task.payload.loginTv, task.payload.cpf, task.payload.nome);
            }
            console.log(`[RECEITANET WORKER SUCESSO] ✅ Tarefa ${task.jobId} (${task.tipo}) finalizada com sucesso!`);
        } catch (error) {
            console.error(`[RECEITANET WORKER ERRO] ❌ Tarefa ${task.jobId} falhou:`, error.message);
        } finally {
            this.activeWorkers--;
            // Processa próxima tarefa se houver
            this.processarProxima();
        }
    }

    obterStatusFila() {
        return {
            tarefasPendentes: this.queue.length,
            workersAtivos: this.activeWorkers,
            maxWorkers: this.maxWorkers
        };
    }
}

module.exports = new ReceitanetQueueService();
