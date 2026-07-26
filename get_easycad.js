const axios = require('axios');
const fs = require('fs');

const cookieHeader = 'PHPSESSID=lngu5qq2j1hhlctpaugcijjpi4'; // Cookie da sessão ativa

async function getEasyCad() {
    const url = 'http://levemaisfibra.ispfycloud.com.br:8080/instalacao/easycad.php';
    console.log(`Buscando easycad.php em: ${url}`);
    
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Cookie': cookieHeader
            }
        });
        
        console.log(`Status de resposta: ${res.status}`);
        const html = res.data;
        fs.writeFileSync('easycad.html', html);
        console.log("Salvo HTML do easycad.php em easycad.html.");
        
        // Vamos procurar os inputs no HTML e os seus respectivos atributos 'name' ou 'id'
        const inputRegex = /<input[^>]+name=["']([^"']+)["'][^>]*>|<select[^>]+name=["']([^"']+)["'][^>]*>/gi;
        let match;
        const inputs = new Set();
        
        while ((match = inputRegex.exec(html)) !== null) {
            const name = match[1] || match[2];
            inputs.add(name);
        }
        
        console.log("\nCampos de formulário encontrados no EasyCAD (total " + inputs.size + "):");
        inputs.forEach(name => console.log(`  - ${name}`));
        
        // Procura também o arquivo javascript ou ação de envio do formulário
        console.log("\nProcurando ação de envio ou arquivos JS relacionados...");
        const submitAction = html.match(/action=["']([^"']+)["']/i);
        if (submitAction) {
            console.log(`  - Ação do Form (action): ${submitAction[1]}`);
        } else {
            console.log("  - Nenhuma ação de form direta (provavelmente enviado via Ajax).");
        }
        
    } catch (error) {
        console.error("Erro ao buscar easycad.php:", error.message);
    }
}

getEasyCad();
