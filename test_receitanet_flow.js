const axios = require('axios');

const baseUrl = 'http://localhost:3000/api';

function generateCPF() {
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
    return n;
}

async function runTest() {
    console.log("=== INICIANDO TESTE DO FLUXO COMPLETO RECEITANET & SVA LOCAL ===");
    
    const email = `teste_receita_${Math.floor(Math.random() * 10000)}@tv.com`;
    const cpf = generateCPF();
    const payload = {
        nome: 'Thiago Teste ReceitaNet',
        email: email,
        telefone: '21999999999',
        cpfcnpj: cpf,
        cep: '25555355',
        endereco: 'Avenida Principal',
        numero: '123',
        bairro: 'Centro',
        cidade: 'São João de Meriti',
        uf: 'RJ'
    };

    try {
        // Passo 1: Cadastro inicial (Trial 4h)
        console.log("\n1. Registrando novo cliente (esperado Trial de 4h)...");
        const cadRes = await axios.post(`${baseUrl}/cadastro`, payload);
        console.log("Resposta do Cadastro:", cadRes.data);
        const { login, senha } = cadRes.data;

        // Passo 2: Testar autenticação SVA CDNTV (Ativa)
        console.log("\n2. Testando autenticação SVA CDNTV (esperado Ativo/Sucesso)...");
        const authRes = await axios.post(`${baseUrl}/sva/cdntv/auth`, { username: login, password: senha });
        console.log("Resposta Autenticação SVA:", authRes.data);

        // Passo 3: Forçar expiração do Trial
        console.log("\n3. Forçando expiração do Trial (vencimento no passado)...");
        const forceRes = await axios.post(`${baseUrl}/admin/force-expired`);
        console.log("Resposta do force-expired:", forceRes.data);

        // Passo 4: Rodar Cron Worker (Suspender sinal e gerar Pix de cobrança)
        console.log("\n4. Rodando Cron Worker manualmente para suspender...");
        const cronRes = await axios.post(`${baseUrl}/admin/run-cron`);
        console.log("Resposta do Cron:", cronRes.data);

        // Passo 5: Testar autenticação SVA CDNTV (Bloqueado)
        console.log("\n5. Testando autenticação SVA CDNTV após expiração (esperado Bloqueado/403)...");
        try {
            await axios.post(`${baseUrl}/sva/cdntv/auth`, { username: login, password: senha });
            console.log("Erro: Acesso não deveria ser permitido!");
        } catch (err) {
            console.log("Sucesso! Acesso bloqueado conforme esperado. Status retornado:", err.response ? err.response.status : err.message);
            console.log("Dados do bloqueio SVA:", err.response ? err.response.data : '');
        }

        // Passo 6: Gerar Pix de Renovação (Simulado, escolhendo 2 meses)
        console.log("\n6. Gerando Pix de Renovação para 2 meses (R$ 20,00)...");
        // Buscamos o cliente para pegar o ID dele
        // No fluxo real o frontend tem o ID, vamos simular gerando direto no cadastro de renovação
        const cadReRes = await axios.post(`${baseUrl}/cadastro`, payload);
        console.log("Resposta do Cadastro para Re-vencido:", cadReRes.data);
        const clienteId = cadReRes.data.cliente_id;

        const pixRes = await axios.post(`${baseUrl}/pix/gerar`, { cliente_id: clienteId, meses: 2 });
        console.log("Resposta Geração Pix:", pixRes.data);
        const txid = pixRes.data.txid;

        // Passo 7: Simular pagamento do Pix (Aprovar)
        console.log("\n7. Simulando confirmação de pagamento Pix...");
        const payRes = await axios.post(`${baseUrl}/simular-pagamento`, { txid });
        console.log("Resposta Confirmação Pagamento:", payRes.data);

        // Passo 8: Testar autenticação SVA CDNTV (Reativado por 60 dias)
        console.log("\n8. Testando autenticação SVA CDNTV após pagamento (esperado Ativo)...");
        const authReRes = await axios.post(`${baseUrl}/sva/cdntv/auth`, { username: login, password: senha });
        console.log("Resposta Autenticação SVA reativada:", authReRes.data);

        console.log("\n=== TESTE DO FLUXO COMPLETO CONCLUÍDO COM SUCESSO! ===");

    } catch (error) {
        console.error("Falha no teste:", error.message);
        if (error.response) {
            console.error("Detalhes:", JSON.stringify(error.response.data));
        }
    }
}

runTest();
