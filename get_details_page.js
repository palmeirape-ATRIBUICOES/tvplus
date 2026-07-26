const axios = require('axios');
const fs = require('fs');

const cookieHeader = 'PHPSESSID=lngu5qq2j1hhlctpaugcijjpi4'; // Cookie da sessão ativa
const clientId = '2234';

async function getDetailsPage() {
    const url = `http://levemaisfibra.ispfycloud.com.br:8080/sis_cobrancas/detalhes.php?cliente=${clientId}`;
    console.log(`Buscando detalhes.php em: ${url}`);
    
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Cookie': cookieHeader
            }
        });
        
        console.log(`Status de resposta: ${res.status}`);
        const html = res.data;
        fs.writeFileSync('detalhes_cliente.html', html);
        console.log("Salvo HTML em detalhes_cliente.html.");
        
        // Procuramos links ou funções JS associadas a "Novo contrato"
        console.log("\nProcurando referências a 'contrato' ou '+ Novo' no HTML...");
        const regexes = [
            /contrato_cadastrar/gi,
            /cadastrar_contrato/gi,
            /contrato/gi,
            /button/gi
        ];
        
        regexes.forEach(regex => {
            const matches = html.match(new RegExp(`.{0,60}${regex.source}.{0,60}`, 'gi'));
            if (matches) {
                console.log(`Encontrado com regex ${regex.source} (primeiras 5 correspondências):`);
                matches.slice(0, 5).forEach(m => console.log(`  - ${m.trim()}`));
            }
        });
        
    } catch (error) {
        console.error("Erro ao buscar detalhes do cliente:", error.message);
    }
}

getDetailsPage();
