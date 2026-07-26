const axios = require('axios');

const url = 'http://levemaisfibra.ispfycloud.com.br:8020/api/object/cidade';
const token = 'dcc58870e96789b124c64c830cf65035';

async function findCity() {
    console.log("Buscando ID da cidade 'SÃO JOÃO DE MERITI'...");
    try {
        const res = await axios.get(`${url}?nome=CONTAINS:Meriti`, {
            headers: { 'Token': token }
        });
        console.log("Resposta da busca de cidade:");
        console.log(JSON.stringify(res.data, null, 2));
    } catch (error) {
        console.error("Erro na busca:", error.message);
        if (error.response) {
            console.error("Detalhes:", JSON.stringify(error.response.data));
        }
    }
}

findCity();
