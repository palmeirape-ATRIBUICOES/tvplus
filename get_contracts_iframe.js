const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

function md5(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

const username = 'thiagotv';
const passwordPlain = '@@12345678';
const passwordHash = md5(passwordPlain);

async function run() {
    const loginUrl = 'http://levemaisfibra.ispfycloud.com.br:8080/';
    console.log("Fazendo login real no ISPFY...");
    
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
            console.error("Erro: cookies de login não recebidos.");
            return;
        }
        
        const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
        
        const iframeUrl = 'http://levemaisfibra.ispfycloud.com.br:8080/sis_cobrancas/detalhescli/contratos.php?cliente=2234';
        console.log(`Buscando iframe de contratos em: ${iframeUrl}`);
        
        const resIframe = await axios.get(iframeUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Cookie': cookieHeader
            }
        });
        
        const html = resIframe.data;
        fs.writeFileSync('contratos_iframe.html', html);
        console.log(`Salvo HTML do iframe (Tamanho: ${html.length} caracteres)`);
        
        // Procuramos por "Novo contrato" ou arquivos .php no HTML do iframe
        console.log("\nBuscando links no iframe de contratos...");
        
        // Encontra todos os links ou php chamados
        const phpRegex = /[a-zA-Z0-9_\-\/]+\.php[?a-zA-Z0-9_&=\-]*/gi;
        const matches = html.match(phpRegex);
        if (matches) {
            const uniq = [...new Set(matches)];
            uniq.forEach(m => console.log(`  - PHP encontrado: ${m}`));
        }
        
        // Procura também por chamadas JS
        const matchesJs = html.match(/onclick=["']([^"']+)["']/gi);
        if (matchesJs) {
            matchesJs.forEach(m => console.log(`  - OnClick encontrado: ${m}`));
        }

    } catch (error) {
        console.error("Erro:", error.message);
    }
}

run();
