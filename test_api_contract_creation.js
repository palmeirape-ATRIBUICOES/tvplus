const axios = require('axios');
const FormData = require('form-data');

const url = 'http://levemaisfibra.ispfycloud.com.br:8020/api/tool/cliente/novo';
const token = 'dcc58870e96789b124c64c830cf65035';

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

async function testParams() {
    console.log("Registrando cliente de teste passando parâmetros de plano...");
    
    const form = new FormData();
    form.append('nome_razao', 'Thiago Teste Parametro Plano');
    form.append('cpf_cnpj', generateCPF());
    form.append('endereco_cobranca_id_cidade', '6887');
    form.append('endereco_cobranca_rua', 'Rua Teste Plano');
    form.append('endereco_cobranca_bairro', 'Centro');
    form.append('fone1', '21999999999');
    form.append('data_cadastro', new Date().toISOString().substring(0, 10));
    
    // Parâmetros de plano hipotéticos
    form.append('id_plano', '48');
    form.append('plano_id', '48');
    form.append('id_plano_internet', '48');
    form.append('plano', '48');
    form.append('id_produto', '48');
    
    try {
        const res = await axios.post(url, form, {
            headers: {
                'Token': token,
                ...form.getHeaders()
            }
        });
        
        const clientId = res.data.id;
        console.log(`Cliente cadastrado com ID: ${clientId}`);
        
        // Verifica se algum contrato foi criado
        console.log("Consultando contratos para o novo cliente...");
        const contractRes = await axios.get(`http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente/contrato`, {
            headers: { 'Token': token }
        });
        const contracts = contractRes.data.data || contractRes.data;
        const clientContracts = contracts.filter(c => Number(c.id_cliente) === clientId);
        console.log("Contratos criados:", JSON.stringify(clientContracts, null, 2));
        
    } catch (error) {
        console.error("Erro:", error.message);
        if (error.response) {
            console.error("Detalhes:", JSON.stringify(error.response.data));
        }
    }
}

testParams();
