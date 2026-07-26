const axios = require('axios');

const urls = [
    'http://levemaisfibra.ispfycloud.com.br:8080/',
    'http://levemaisfibra.ispfycloud.com.br:8080/home/main.php',
    'http://levemaisfibra.ispfycloud.com.br:8080/home/index.php',
    'http://levemaisfibra.ispfycloud.com.br:8080/index.php'
];

async function testPaths() {
    for (const url of urls) {
        console.log(`Testando: ${url}`);
        try {
            const res = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
                },
                maxRedirects: 3
            });
            console.log(` -> SUCESSO! Status: ${res.status}`);
            console.log(` -> Resposta final URL: ${res.request.res.responseUrl}`);
            console.log(" -> Conteúdo (primeiros 200 carac):", res.data.substring(0, 200).replace(/\s+/g, ' '));
        } catch (error) {
            console.log(` -> FALHA: ${error.message}`);
            if (error.response) {
                console.log(`   -> Status retornado: ${error.response.status}`);
            }
        }
        console.log('-------------------------------------------');
    }
}

testPaths();
