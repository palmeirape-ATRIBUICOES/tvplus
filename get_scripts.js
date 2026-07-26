const axios = require('axios');

async function getScripts() {
    const url = 'http://levemaisfibra.ispfycloud.com.br:8080/';
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        
        const html = res.data;
        const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
        let match;
        console.log("Scripts localizados na página de login:");
        while ((match = scriptRegex.exec(html)) !== null) {
            console.log(`- ${match[1]}`);
        }
        
        // Também procura por scripts inline que possam ter a configuração do Vue
        const inlineScriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
        let inlineMatch;
        let count = 0;
        while ((inlineMatch = inlineScriptRegex.exec(html)) !== null) {
            const src = inlineMatch[0];
            if (!src.includes('src=')) {
                count++;
                console.log(`\n--- Script Inline ${count} (Tamanho: ${inlineMatch[1].length} carac) ---`);
                console.log(inlineMatch[1].substring(0, 1000));
            }
        }
    } catch (error) {
        console.error("Erro:", error.message);
    }
}

getScripts();
