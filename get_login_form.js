const axios = require('axios');

async function getLoginForm() {
    const url = 'http://levemaisfibra.ispfycloud.com.br:8080/';
    console.log(`Buscando formulário de login em: ${url}`);
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        
        const html = res.data;
        
        // Vamos procurar tags form e input
        const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
        let match = formRegex.exec(html);
        if (match) {
            console.log("Formulário de Login Encontrado:");
            console.log(match[0]);
        } else {
            console.log("Nenhum formulário encontrado na raiz.");
            // Imprime todo o corpo do html para analisar se é carregado via JS ou de outra forma
            console.log("HTML Completo:");
            console.log(html);
        }
    } catch (error) {
        console.error("Erro:", error.message);
    }
}

getLoginForm();
