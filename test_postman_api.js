const axios = require('axios');

const id = 'pycbwgl';
const urls = [
    `https://api.getpostman.com/collections/${id}`,
    `https://www.postman.com/api/collections/${id}`,
    `https://www.postman.com/api/documentations/${id}`,
    `https://www.postman.com/api/documentations/${id}/collection`,
    `https://www.postman.com/api/collections/${id}/json`
];

async function test() {
    for (const url of urls) {
        console.log(`Testando GET: ${url}`);
        try {
            const res = await axios.get(url, { timeout: 4000 });
            console.log(`SUCESSO! Status: ${res.status}`);
            console.log("Início dos dados retornados:", JSON.stringify(res.data).substring(0, 300));
            return; // Encontrou!
        } catch (error) {
            console.log(`Falhou. Erro: ${error.message}`);
            if (error.response) {
                console.log(`Status: ${error.response.status}. Detalhes:`, JSON.stringify(error.response.data).substring(0, 150));
            }
        }
        console.log('-----------------------------------');
    }
    console.log("Nenhum endpoint simples funcionou.");
}

test();
