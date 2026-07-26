const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const cheerio = require('cheerio');

function md5(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

const username = 'thiagotv';
const passwordPlain = '@@12345678';
const passwordHash = md5(passwordPlain);

async function autoSubmitContract() {
    const clientId = '2234'; // Thiago Teste Integrador
    
    try {
        // 1. Login
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
            console.error("Cookies de login não retornados.");
            return;
        }
        const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
        console.log("Login OK!");

        // 2. Lê o arquivo contrato_novo.html local para extrair os inputs padrão
        console.log("Analisando o HTML de contrato_novo.php...");
        const html = fs.readFileSync(path.join(__dirname, 'contrato_novo.html'), 'utf8');
        const $ = cheerio.load(html);
        
        const formPayload = {};
        
        // Coleta todos os inputs de frmPostar
        $('form#frmPostar input, form#frmPostar select, form#frmPostar textarea').each((idx, elem) => {
            const name = $(elem).attr('name');
            if (!name) return;
            
            const type = $(elem).attr('type');
            if (type === 'button' || type === 'submit') return;
            
            let val = $(elem).val() || '';
            
            if ((type === 'checkbox' || type === 'radio') && !$(elem).attr('checked')) {
                return;
            }
            
            if (name.endsWith('[]')) {
                if (!formPayload[name]) formPayload[name] = [];
                formPayload[name].push(val);
            } else {
                formPayload[name] = val;
            }
        });
        
        console.log(`Coletados ${Object.keys(formPayload).length} campos do formulário de contrato.`);

        // 3. Modifica os campos essenciais do contrato
        formPayload['txt_op'] = 'op2'; // Crucial: ativa a gravação!
        
        formPayload['txt_nome_ponto'] = 'PONTO A';
        formPayload['txt_cep'] = '25520430';
        formPayload['txt_id_cidade'] = '6887'; // São João de Meriti
        formPayload['txt_bairro'] = 'CENTRO';
        formPayload['txt_endereco'] = 'RUA VEREADOR ARMANDO DE OLIVEIRA';
        formPayload['txt_numero'] = '5';
        formPayload['txt_complemento'] = 'CASA';
        
        // Contrato
        formPayload['txt_tenant'] = '9'; // Thiago TV
        formPayload['txt_carteira'] = '5'; // Boleto Próprio
        formPayload['txt_fidelidade'] = '0'; // Sem fidelidade
        formPayload['txt_especie'] = 'naoinformado';
        formPayload['txt_faturavel'] = 's';
        formPayload['txt_tipo_fat'] = 'auto';
        formPayload['txt_faturamento'] = '05'; // Vencimento Dia 5
        formPayload['id_doc_model'] = '11'; // Contrato integral (evita erro de chave estrangeira)
        
        // Planos e Serviços (Array de produtos)
        // 1. CDNTV (SVA, ID 47, valor 0.00)
        // 2. PLANO TV THIAGO 20 (Internet, ID 48, valor 20.00)
        formPayload['txt_produto_tipo[]'] = ['sva', 'net'];
        formPayload['txt_produto_item[]'] = ['47', '48'];
        formPayload['txt_id_produto[]'] = ['47', '48'];
        
        // Transforma em string no formato x-www-form-urlencoded compatível com PHP arrays
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
        bodyString = bodyString.slice(0, -1);

        console.log("Enviando POST de gravação de contrato...");
        const targetUrl = `http://levemaisfibra.ispfycloud.com.br:8080/sis_cobrancas/detalhescli/contrato_novo.php?cliente=${clientId}`;
        
        const response = await axios.post(targetUrl, bodyString, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Cookie': cookieHeader,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        console.log("\nStatus da resposta:", response.status);
        fs.writeFileSync('contract_response.html', response.data);
        console.log("Resposta completa gravada em 'contract_response.html'.");
        
        // Verifica se há alguma mensagem de erro comum de banco no HTML retornado
        const htmlLower = response.data.toLowerCase();
        if (htmlLower.includes('error') || htmlLower.includes('fail') || htmlLower.includes('cannot') || htmlLower.includes('constraint')) {
            console.log("Aviso: Palavras de erro detectadas na resposta!");
            // Imprime linhas próximas às palavras de erro
            const lines = response.data.split('\n');
            lines.forEach((line, idx) => {
                if (line.toLowerCase().includes('error') || line.toLowerCase().includes('fail') || line.toLowerCase().includes('cannot') || line.toLowerCase().includes('constraint') || line.toLowerCase().includes('alert') || line.toLowerCase().includes('swal')) {
                    console.log(`L${idx+1}: ${line.trim()}`);
                }
            });
        }
        
        // Verifica se a gravação deu certo listando os contratos do cliente de novo
        console.log("\nVerificando contratos reais do cliente após a requisição...");
        const tokenAPI = 'dcc58870e96789b124c64c830cf65035';
        const contractRes = await axios.get(`http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente/contrato`, {
            headers: { 'Token': tokenAPI }
        });
        const contracts = contractRes.data.data || contractRes.data;
        const clientContracts = contracts.filter(c => Number(c.id_cliente) === Number(clientId));
        console.log("Contratos Atuais do Cliente 2234:", JSON.stringify(clientContracts, null, 2));

    } catch (error) {
        console.error("Erro no fluxo:", error.message);
    }
}

autoSubmitContract();
