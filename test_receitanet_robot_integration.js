const robot = require('./services/receitanetRobot');

async function testIntegration() {
    console.log("=== TESTANDO ROBÔ RPA RECEITANET ===");
    
    // CPF aleatório válido
    let n = '';
    for (let i = 0; i < 9; i++) n += Math.floor(Math.random() * 10);
    let d1 = 0, d2 = 0;
    for (let i = 0; i < 9; i++) d1 += parseInt(n[i]) * (10 - i);
    d1 = 11 - (d1 % 11);
    if (d1 >= 10) d1 = 0;
    n += d1;
    for (let i = 0; i < 10; i++) d2 += parseInt(n[i]) * (11 - i);
    d2 = 11 - (d2 % 11);
    if (d2 >= 10) d2 = 0;
    n += d2;
    const formattedCpf = `${n.substring(0, 3)}.${n.substring(3, 6)}.${n.substring(6, 9)}-${n.substring(9)}`;

    const cliente = {
        nome: 'Thiago Teste Robot',
        cpfcnpj: formattedCpf,
        email: `thiagorobot_${Math.floor(Math.random() * 1000)}@teste.com`,
        telefone: '21999998888',
        cep: '21000000',
        numero: '123'
    };

    const login = `thiagorob_${Math.floor(Math.random() * 1000)}@tvplus`;
    const senha = `${Math.floor(100000 + Math.random() * 900000)}`;

    try {
        await robot.cadastrarEAtivarTV(cliente, login, senha);
        console.log("=== ROBÔ EXECUTOU COM SUCESSO E COMPLETOU A INTEGRAÇÃO ===");
    } catch (e) {
        console.error("FALHA NA INTEGRAÇÃO DO ROBÔ:", e.message);
    }
}

testIntegration();
