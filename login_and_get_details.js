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
        console.log("Login efetuado com sucesso! Cookie:", cookieHeader);
        
        const detailsUrl = 'http://levemaisfibra.ispfycloud.com.br:8080/sis_cobrancas/detalhes.php?cliente=2234';
        console.log(`Buscando detalhes do cliente em: ${detailsUrl}`);
        
        const resDetails = await axios.get(detailsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Cookie': cookieHeader
            }
        });
        
        const html = resDetails.data;
        fs.writeFileSync('detalhes_cliente.html', html);
        console.log(`Salvo HTML (Tamanho: ${html.length} caracteres)`);
        
        if (html.includes('refresh')) {
            console.log("ALERTA: A resposta ainda contém redirecionamento. O login pode ter sido rejeitado pela sessão ou IP.");
            return;
        }
        
        // Procuramos por links de criação de contrato
        console.log("\nBuscando links/funções no HTML...");
        const regexes = [
            /contrato_cadastrar/gi,
            /cadastrar_contrato/gi,
            /contrato/gi,
            /button/gi,
            /ponto/gi
        ];
        
        regexes.forEach(regex => {
            const matches = html.match(new RegExp(`.{0,60}${regex.source}.{0,60}`, 'gi'));
            if (matches) {
                console.log(`Correspondências de ${regex.source} (primeiras 5):`);
                matches.slice(0, 5).forEach(m => console.log(`  - ${m.trim()}`));
            }
        });

    } catch (error) {
        console.error("Erro durante o processo:", error.message);
    }
}

run();
