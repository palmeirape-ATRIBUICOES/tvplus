const axios = require('axios');

async function getLoginPage() {
    const url = 'http://levemaisfibra.ispfycloud.com.br:8080/home/';
    console.log(`Buscando a página de login em: ${url}`);
    try {
        const res = await axios.get(url, { 
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        console.log(`Status de resposta: ${res.status}`);
        console.log(`URL final após redirecionamento: ${res.request.res.responseUrl}`);
        
        // Procura por formulários no HTML
        const html = res.data;
        const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
        let match;
        let count = 0;
        
        while ((match = formRegex.exec(html)) !== null) {
            count++;
            console.log(`\n--- Formulário ${count} ---`);
            console.log(match[0].substring(0, 1000));
        }
        
        if (count === 0) {
            console.log("Nenhum formulário HTML encontrado na resposta.");
            console.log("Primeiros 1000 caracteres da resposta:");
            console.log(html.substring(0, 1000));
        }
    } catch (error) {
        console.error("Erro ao carregar página de login:", error.message);
    }
}

getLoginPage();
