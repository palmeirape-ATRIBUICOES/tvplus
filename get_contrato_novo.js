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
    console.log("Realizando login...");
    
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
            console.error("Cookies não retornados.");
            return;
        }
        const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
        
        const contractUrl = 'http://levemaisfibra.ispfycloud.com.br:8080/sis_cobrancas/detalhescli/contrato_novo.php?cliente=2234';
        console.log(`Buscando contrato_novo.php em: ${contractUrl}`);
        
        const resContract = await axios.get(contractUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Cookie': cookieHeader
            }
        });
        
        const html = resContract.data;
        fs.writeFileSync('contrato_novo.html', html);
        console.log(`Salvo contrato_novo.html (Tamanho: ${html.length} caracteres).`);
        
        // Vamos procurar os inputs no HTML e os seus respectivos atributos 'name' ou 'id'
        const inputRegex = /<input[^>]+name=["']([^"']+)["'][^>]*>|<select[^>]+name=["']([^"']+)["'][^>]*>/gi;
        let match;
        const inputs = new Set();
        
        while ((match = inputRegex.exec(html)) !== null) {
            const name = match[1] || match[2];
            inputs.add(name);
        }
        
        console.log("\nCampos de formulário encontrados em contrato_novo.php:");
        inputs.forEach(name => console.log(`  - ${name}`));

    } catch (error) {
        console.error("Erro:", error.message);
    }
}

run();
