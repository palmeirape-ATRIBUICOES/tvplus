const axios = require('axios');
const crypto = require('crypto');

function md5(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

const username = 'thiagotv';
const passwordPlain = '@@12345678';
const passwordHash = md5(passwordPlain);

console.log(`Senha em MD5: ${passwordHash}`);

async function loginAndInspect() {
    const loginUrl = 'http://levemaisfibra.ispfycloud.com.br:8080/';
    console.log(`Fazendo login em: ${loginUrl}`);
    
    try {
        // Realiza o POST de login
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
        
        console.log("Status do Login:", loginRes.status);
        console.log("Dados do Login:", JSON.stringify(loginRes.data));
        
        // Obtém os cookies da resposta
        const cookies = loginRes.headers['set-cookie'];
        console.log("Cookies recebidos:", cookies);
        
        if (!cookies) {
            console.log("Nenhum cookie recebido. Login falhou ou sessões desativadas.");
            return;
        }
        
        const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
        console.log("Cookie para requisições seguintes:", cookieHeader);
        
        // Faz requisição à página principal do painel
        console.log("\nAcessando main.php...");
        const mainRes = await axios.get('http://levemaisfibra.ispfycloud.com.br:8080/home/main.php', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Cookie': cookieHeader
            }
        });
        
        console.log("Status main.php:", mainRes.status);
        const mainHtml = mainRes.data;
        
        // Vamos procurar links ou referências a cadastro rápido no HTML do main.php
        console.log("\nProcurando por menções a 'cadastro' ou 'rapido' no HTML de main.php...");
        const regexes = [
            /rapido/gi,
            /cadastro/gi,
            /wizard/gi,
            /client/gi
        ];
        
        regexes.forEach(regex => {
            const matches = mainHtml.match(new RegExp(`.{0,50}${regex.source}.{0,50}`, 'gi'));
            if (matches) {
                console.log(`Encontrado com regex ${regex.source} (exemplo):`);
                matches.slice(0, 5).forEach(m => console.log(`  - ${m.trim()}`));
            }
        });

    } catch (error) {
        console.error("Erro durante o processo:", error.message);
        if (error.response) {
            console.error("Status da resposta:", error.response.status);
            console.error("Dados da resposta:", JSON.stringify(error.response.data));
        }
    }
}

loginAndInspect();
