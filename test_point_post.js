const axios = require('axios');

const url = 'http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente/contrato/ponto';
const token = 'dcc58870e96789b124c64c830cf65035';

async function test() {
    console.log(`Testando POST em: ${url}`);
    try {
        const res = await axios.post(url, {}, {
            headers: { 'Token': token, 'Content-Type': 'application/json' }
        });
        console.log(`SUCESSO! Status: ${res.status}`);
        console.log("Dados:", res.data);
    } catch (error) {
        console.log(`Erro ao chamar endpoint: ${error.message}`);
        if (error.response) {
            console.log(`Status retornado: ${error.response.status}`);
            console.log(`Dados da resposta:`, JSON.stringify(error.response.data));
        }
    }
}

test();
