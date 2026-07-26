const axios = require('axios');
const cheerio = require('cheerio');

async function checkLoginHtml() {
    console.log("Requisitando a página de login do ReceitaNet...");
    try {
        const res = await axios.get('https://sistema.receitanet.net/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(res.data);
        console.log("Inputs de formulário localizados na página:");
        $('input, button, form').each((i, el) => {
            const tag = el.tagName;
            const name = $(el).attr('name');
            const id = $(el).attr('id');
            const type = $(el).attr('type');
            const placeholder = $(el).attr('placeholder');
            const action = $(el).attr('action');
            
            console.log(`Tag: <${tag}> | Name: ${name || 'N/A'} | ID: ${id || 'N/A'} | Type: ${type || 'N/A'} | Placeholder: ${placeholder || 'N/A'} | Action: ${action || 'N/A'}`);
        });

        // Imprime o HTML completo se necessário para análise profunda
        if ($('input').length === 0) {
            console.log("\nHTML completo recebido:");
            console.log(res.data.substring(0, 2000));
        }

    } catch (error) {
        console.error("Erro ao requisitar página:", error.message);
    }
}

checkLoginHtml();
