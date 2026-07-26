const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');

function md5(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

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

const username = 'thiagotv';
const passwordPlain = '@@12345678';
const passwordHash = md5(passwordPlain);

async function runTest() {
    const loginUrl = 'http://levemaisfibra.ispfycloud.com.br:8080/';
    console.log("Realizando Login...");
    
    try {
        const loginRes = await axios.post(loginUrl, {
            login: 'user',
            username: username,
            password: passwordHash,
            keep: false
        }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Content-Type': 'application/json'
            }
        });
        
        const cookies = loginRes.headers['set-cookie'];
        if (!cookies) {
            console.error("Erro: Cookies de login não retornados.");
            return;
        }
        const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
        
        console.log("Login efetuado com sucesso. Enviando cadastro rápido via EasyCAD...");
        
        // Define os dados do novo cliente
        const cpf = generateCPF();
        const nomeCliente = 'Thiago Teste Integrado EasyCAD';
        const emailCliente = `thiagoeasy${Math.floor(100 + Math.random() * 900)}@tv.com`;
        const foneCliente = '21987654321';
        const senhaConexao = Math.floor(10000000 + Math.random() * 90000000).toString(); // Senha numérica de 8 dígitos
        
        // Payload em formato x-www-form-urlencoded
        const payload = {
            txt_nome: nomeCliente,
            txt_fantasia: '',
            txt_cgc: cpf,
            txt_rg: '',
            txt_nascimento: '1998-01-01',
            txt_data_cadastro: new Date().toISOString().substring(0, 10),
            
            txt_tipo_end: 'ins',
            txt_nome_ponto: 'PONTO A',
            txt_cep: '25520430',
            txt_id_cidade: '6887', // São João de Meriti
            txt_bairro: 'CENTRO',
            txt_endereco: 'RUA VEREADOR ARMANDO DE OLIVEIRA',
            txt_numero: '5',
            txt_complemento: 'CASA',
            txt_lat: '',
            txt_lon: '',
            
            // Contatos
            'txt_tipo_contato[0]': 'EMAIL',
            'txt_contato[0]': emailCliente,
            'txt_tipo_contato[1]': 'CELULAR',
            'txt_contato[1]': foneCliente,
            
            // Contrato
            txt_tenant: '9', // Thiago TV
            txt_carteira: '5', // Boleto Próprio
            txt_fidelidade: '0', // Sem fidelidade
            txt_eqp: '0',
            txt_bonus: '0',
            txt_profile: '0',
            txt_desconto_recorrente: '0.00',
            txt_desconto_adesao: '0.00',
            txt_desconto_rescisao: '0.00',
            txt_especie: 'naoinformado',
            txt_faturavel: 's',
            txt_tipo_fat: 'auto',
            txt_faturamento: '05', // Vencimento Dia 5
            txt_obsfin: '',
            
            // Planos e Serviços (Array de produtos)
            // 1. CDNTV (SVA, ID 47, valor 0.00)
            'txt_produto_tipo[0]': 'sva',
            'txt_produto_item[0]': '47',
            'txt_id_produto[0]': '47',
            
            // 2. PLANO TV THIAGO 20 (Internet, ID 48, valor 20.00)
            'txt_produto_tipo[1]': 'net',
            'txt_produto_item[1]': '48',
            'txt_id_produto[1]': '48',
            
            // Conexão
            tipo_conexao: 'none', // Sem conexão
            txt_tecnologia: 'outro',
            txt_usuario: emailCliente, // E-mail será o usuário da TV
            txt_senha: senhaConexao,     // Senha da TV
            
            hid_validator: Math.random().toString()
        };
        
        const response = await axios.post(
            'http://levemaisfibra.ispfycloud.com.br:8080/instalacao/easycad.php',
            querystring.stringify(payload),
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                    'Cookie': cookieHeader,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        console.log("Status de envio do EasyCAD:", response.status);
        console.log("Resposta bruta do servidor:");
        console.log(response.data);
        
    } catch (error) {
        console.error("Erro no teste de cadastro rápido:", error.message);
        if (error.response) {
            console.error("Dados de erro:", error.response.data);
        }
    }
}

runTest();
