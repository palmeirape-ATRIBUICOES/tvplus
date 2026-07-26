const axios = require('axios');
const fs = require('fs');

const urls = [
    { name: 'chatbot', url: 'https://www.receitanet.net/api/chatbot/openapi.yaml' },
    { name: 'ura', url: 'https://www.receitanet.net/api/ura/openapi.yaml' }
];

async function downloadAPIs() {
    console.log("Baixando especificações OpenAPI do ReceitaNet...");
    for (const api of urls) {
        try {
            console.log(`Baixando ${api.name} de: ${api.url}`);
            const res = await axios.get(api.url, { timeout: 8000 });
            fs.writeFileSync(`${api.name}_api.yaml`, res.data);
            console.log(`Salvo ${api.name}_api.yaml (Tamanho: ${res.data.length} bytes).`);
            
            // Analisa brevemente os caminhos (paths) no YAML
            const lines = res.data.split('\n');
            console.log(`Rotas encontradas em ${api.name}_api:`);
            lines.forEach(line => {
                if (line.trim().startsWith('/') && line.trim().endsWith(':')) {
                    console.log(`  - ${line.trim().slice(0, -1)}`);
                }
            });
        } catch (error) {
            console.error(`Erro ao baixar ${api.name}:`, error.message);
        }
        console.log('---------------------------------------------');
    }
}

downloadAPIs();
