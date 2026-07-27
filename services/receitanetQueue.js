const receitanetRobot = require('./receitanetRobot');

/**
 * Fila Concorrente e Assíncrona para Execução Independente de Automações do ERP ReceitaNet.
 * Permite que múltiplos comandos (criar testes, suspender, reativar, excluir) sejam executados 
 * em segundo plano sem travar o painel administrativo ou bloquear o servidor.
 */
class ReceitanetQueueService {
    constructor() {
        this.queue = [];
        this.activeWorkers = 0;
        this.maxWorkers = 3; // Permite até 3 automações simultâneas em segundo plano
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
            if (task.tipo === 'CADASTRO_E_ATIVACAO') {
                await receitanetRobot.cadastrarEAtivarTV(task.payload.cliente, task.payload.loginTv, task.payload.senhaTv);
            } else if (task.tipo === 'REATIVAR') {
                await receitanetRobot.reativarCliente(task.payload.loginTv, task.payload.cpf, task.payload.nome);
            } else if (task.tipo === 'SUSPENDER') {
                await receitanetRobot.suspenderCliente(task.payload.loginTv, task.payload.cpf, task.payload.nome);
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
