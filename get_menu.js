const axios = require('axios');
const fs = require('fs');

const cookieHeader = 'PHPSESSID=lngu5qq2j1hhlctpaugcijjpi4'; // Cookie da sessão ativa

async function getMenu() {
    try {
        const res = await axios.get('http://levemaisfibra.ispfycloud.com.br:8080/home/main.php', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Cookie': cookieHeader
            }
        });
        
        const html = res.data;
        fs.writeFileSync('main_php.html', html);
        console.log("Salvo HTML do main.php em main_php.html.");
        
        // Encontra todos os arquivos .php referenciados no html
        const phpRegex = /[a-zA-Z0-9_\-\/]+\.php[?a-zA-Z0-9_&=\-]*/gi;
        const matches = html.match(phpRegex);
        if (matches) {
            console.log("\nArquivos PHP e rotas encontradas no HTML:");
            const uniq = [...new Set(matches)];
            uniq.forEach(m => console.log(`  - ${m}`));
        } else {
            console.log("Nenhum arquivo PHP referenciado diretamente no HTML.");
        }
        
        // Também procura por tags script e seus atributos src
        const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
        let match;
        console.log("\nScripts na página main.php:");
        while ((match = scriptRegex.exec(html)) !== null) {
            console.log(`  - ${match[1]}`);
        }
        
    } catch (error) {
        console.error("Erro:", error.message);
    }
}

getMenu();
