const axios = require('axios');
const FormData = require('form-data'); // Módulo nativo no node_modules do Express/Axios

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

async function createClient() {
    console.log("Enviando solicitação de criação de novo cliente...");
    
    const form = new FormData();
    form.append('nome_razao', 'Thiago Teste Integrador');
    form.append('cpf_cnpj', generateCPF());
    form.append('endereco_cobranca_id_cidade', '6887');
    form.append('endereco_cobranca_rua', 'Rua Teste');
    form.append('endereco_cobranca_bairro', 'Centro');
    form.append('fone1', '21999999999');
    form.append('data_cadastro', new Date().toISOString().substring(0, 10));
    
    try {
        const res = await axios.post(url, form, {
            headers: {
                'Token': token,
                ...form.getHeaders()
            }
        });
        console.log("Sucesso no cadastro! Código:", res.status);
        console.log("Resposta JSON:");
        console.log(JSON.stringify(res.data, null, 2));
    } catch (error) {
        console.error("Erro no cadastro:", error.message);
        if (error.response) {
            console.error("Detalhes:", JSON.stringify(error.response.data));
        }
    }
}

createClient();
