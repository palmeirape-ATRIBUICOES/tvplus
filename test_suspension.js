const robot = require('./services/receitanetRobot');

async function testSuspension() {
    console.log("=== INICIANDO TESTE DE SUSPENSÃO E REATIVAÇÃO ===");
    
    // 1. Gera um login único de teste
    const randomNum = Math.floor(Math.random() * 10000);
    const login = `susp_test_${randomNum}@tvplus`;
    const senha = 'password123';
    
    const cliente = {
        nome: `Thiago Teste Suspensao ${randomNum}`,
        cpfcnpj: '000.000.000-00'
    };

    try {
        // 2. Primeiro cadastra o cliente para que ele exista no ReceitaNet
        console.log("\n[1/3] Cadastrando cliente de teste...");
        await robot.cadastrarEAtivarTV(cliente, login, senha);
        console.log(`Cliente cadastrado com login: ${login}`);

        // 3. Executa o bloqueio (adiciona _SUSPENSO)
        console.log("\n[2/3] Executando rotina de bloqueio...");
        await robot.bloquearCliente(login);
        console.log(`Cliente bloqueado no ReceitaNet!`);

        // 4. Executa a reativação (remove _SUSPENSO)
        console.log("\n[3/3] Executando rotina de reativação...");
        await robot.reativarCliente(login);
        console.log(`Cliente reativado no ReceitaNet!`);

        console.log("\n=== TESTE DE SUSPENSÃO E REATIVAÇÃO CONCLUÍDO COM SUCESSO! ===");
    } catch (e) {
        console.error("FALHA NO TESTE DE SUSPENSÃO:", e.message);
    }
}

testSuspension();
