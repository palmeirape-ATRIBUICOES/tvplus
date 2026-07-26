const axios = require('axios');
const fs = require('fs');

async function dumpScript() {
    const url = 'http://levemaisfibra.ispfycloud.com.br:8080/';
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        
        const html = res.data;
        const inlineScriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
        let inlineMatch;
        let count = 0;
        while ((inlineMatch = inlineScriptRegex.exec(html)) !== null) {
            const src = inlineMatch[0];
            if (!src.includes('src=')) {
                count++;
                if (count === 1) {
                    fs.writeFileSync('login_script_1.js', inlineMatch[1]);
                    console.log("Salvo inline script 1 em 'login_script_1.js'.");
                    return;
                }
            }
        }
    } catch (error) {
        console.error("Erro:", error.message);
    }
}

dumpScript();
