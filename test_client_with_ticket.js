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

async function testWithTicket() {
    console.log("Cadastrando novo cliente com o campo abrir_ticket preenchido...");
    
    const form = new FormData();
    form.append('nome_razao', 'Thiago Teste com Ticket');
    form.append('cpf_cnpj', generateCPF());
    form.append('endereco_cobranca_id_cidade', '6887');
    form.append('endereco_cobranca_rua', 'Rua das Flores');
    form.append('endereco_cobranca_bairro', 'Centro');
    form.append('fone1', '21999999999');
    form.append('data_cadastro', new Date().toISOString().substring(0, 10));
    form.append('abrir_ticket', 'Ativação automática via plataforma de TV Pix');
    
    try {
        const res = await axios.post(url, form, {
            headers: {
                'Token': token,
                ...form.getHeaders()
            }
        });
        
        const clientId = res.data.id;
        console.log(`Cliente cadastrado com ID: ${clientId}`);
        
        console.log("Aguardando 3 segundos para propagação do banco...");
        await new Promise(r => setTimeout(r, 3000));
        
        // Verifica se foi criado contrato para este cliente
        const contractRes = await axios.get(`http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente/contrato`, {
            headers: { 'Token': token }
        });
        
        const contracts = contractRes.data.data || contractRes.data;
        const clientContracts = contracts.filter(c => Number(c.id_cliente) === clientId);
        console.log(`Contratos encontrados para o cliente ${clientId}:`, JSON.stringify(clientContracts, null, 2));
        
        if (clientContracts.length > 0) {
            const contractId = clientContracts[0].id;
            // Busca pontos vinculados a este contrato
            const pointRes = await axios.get(`http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente/contrato/ponto`, {
                headers: { 'Token': token }
            });
            const points = pointRes.data.data || pointRes.data;
            const contractPoints = points.filter(p => p.id_contrato === contractId);
            console.log(`Pontos encontrados para o contrato ${contractId}:`, JSON.stringify(contractPoints, null, 2));
        } else {
            console.log("Nenhum contrato foi criado automaticamente mesmo com ticket.");
        }
        
    } catch (error) {
        console.error("Erro no teste:", error.message);
        if (error.response) {
            console.error("Detalhes:", JSON.stringify(error.response.data));
        }
    }
}

testWithTicket();
