const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const cheerio = require('cheerio'); // Usado para fazer parse do HTML de forma robusta e limpa

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

async function autoSubmit() {
    try {
        // 1. Faz o Login para obter a sessão
        const loginUrl = 'http://levemaisfibra.ispfycloud.com.br:8080/';
        console.log("Realizando Login...");
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
        console.log("Login OK!");

        // 2. Lê o arquivo easycad.html local para extrair todos os inputs e seus valores padrão
        console.log("Analisando o HTML do formulário EasyCAD...");
        const html = fs.readFileSync(path.join(__dirname, 'easycad.html'), 'utf8');
        const $ = cheerio.load(html);
        
        const formPayload = {};
        
        // Coleta todos os inputs do formulário #frmPostar
        $('form#frmPostar input, form#frmPostar select, form#frmPostar textarea').each((idx, elem) => {
            const name = $(elem).attr('name');
            if (!name) return;
            
            // Ignora botões
            const type = $(elem).attr('type');
            if (type === 'button' || type === 'submit') return;
            
            let val = $(elem).val() || '';
            
            // Para checkbox ou radio, só define se estiver checado por padrão
            if ((type === 'checkbox' || type === 'radio') && !$(elem).attr('checked')) {
                return;
            }
            
            // Inicializa arrays se for o caso
            if (name.endsWith('[]')) {
                if (!formPayload[name]) formPayload[name] = [];
                formPayload[name].push(val);
            } else {
                formPayload[name] = val;
            }
        });
        
        console.log(`Coletados ${Object.keys(formPayload).length} campos únicos do formulário.`);

        // 3. Modifica os campos que queremos preencher para o nosso cliente
        const cpf = generateCPF();
        const nomeCliente = 'Pedro Silva Teste Automático';
        const emailCliente = `pedrosilva${Math.floor(100 + Math.random() * 900)}@tv.com`;
        const foneCliente = '21987654321';
        const senhaConexao = Math.floor(10000000 + Math.random() * 90000000).toString();
        
        formPayload['txt_nome'] = nomeCliente;
        formPayload['txt_cgc'] = cpf;
        formPayload['txt_nascimento'] = '1998-01-01';
        formPayload['txt_data_cadastro'] = new Date().toISOString().substring(0, 10);
        
        formPayload['txt_tipo_end'] = 'ins';
        formPayload['txt_nome_ponto'] = 'PONTO A';
        formPayload['txt_cep'] = '25520430';
        formPayload['txt_id_cidade'] = '6887'; // São João de Meriti
        formPayload['txt_bairro'] = 'CENTRO';
        formPayload['txt_endereco'] = 'RUA VEREADOR ARMANDO DE OLIVEIRA';
        formPayload['txt_numero'] = '5';
        formPayload['txt_complemento'] = 'CASA';
        
        // Contatos
        formPayload['txt_tipo_contato[]'] = ['EMAIL', 'CELULAR'];
        formPayload['txt_contato[]'] = [emailCliente, foneCliente];
        
        // Contrato
        formPayload['txt_tenant'] = '9'; // Thiago TV
        formPayload['txt_carteira'] = '5'; // Boleto Próprio
        formPayload['txt_fidelidade'] = '0'; // Sem fidelidade
        formPayload['txt_especie'] = 'naoinformado';
        formPayload['txt_faturavel'] = 's';
        formPayload['txt_tipo_fat'] = 'auto';
        formPayload['txt_faturamento'] = '05'; // Vencimento Dia 5
        
        // Planos e Serviços
        // 1. CDNTV (SVA, ID 47, valor 0.00)
        // 2. PLANO TV THIAGO 20 (Internet, ID 48, valor 20.00)
        formPayload['txt_produto_tipo[]'] = ['sva', 'net'];
        formPayload['txt_produto_item[]'] = ['47', '48'];
        formPayload['txt_id_produto[]'] = ['47', '48'];
        
        // Conexão
        formPayload['tipo_conexao'] = 'none'; // Sem conexão
        formPayload['txt_tecnologia'] = 'outro';
        formPayload['txt_usuario'] = emailCliente;
        formPayload['txt_senha'] = senhaConexao;
        
        formPayload['hid_validator'] = Math.random().toString();
        
        console.log("\nPayload que será enviado (amostra):");
        console.log(JSON.stringify(formPayload, null, 2));

        // Transforma o payload em querystring para o envio x-www-form-urlencoded
        // Como o querystring nativo não formata arrays da forma que o PHP espera (tipo txt_contato[]=val1&txt_contato[]=val2),
        // nós vamos construir a string manualmente.
        let bodyString = '';
        for (const key in formPayload) {
            const val = formPayload[key];
            if (Array.isArray(val)) {
                val.forEach(v => {
                    bodyString += `${encodeURIComponent(key)}=${encodeURIComponent(v)}&`;
                });
            } else {
                bodyString += `${encodeURIComponent(key)}=${encodeURIComponent(val)}&`;
            }
        }
        bodyString = bodyString.slice(0, -1); // remove o último '&'

        console.log("\nEnviando POST de cadastro rápido para o easycad.php...");
        const response = await axios.post(
            'http://levemaisfibra.ispfycloud.com.br:8080/instalacao/easycad.php',
            bodyString,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                    'Cookie': cookieHeader,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        console.log("\nStatus da resposta:", response.status);
        console.log("Resposta bruta do ISPFY:");
        console.log(response.data);

    } catch (error) {
        console.error("Erro no fluxo:", error.message);
    }
}

autoSubmit();
