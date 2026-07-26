const axios = require('axios');

const url = 'http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente/contrato/ponto';
const token = 'dcc58870e96789b124c64c830cf65035';

async function getPoints() {
    console.log("Consultando pontos de contrato no ISPFY...");
    try {
        const res = await axios.get(url, {
            headers: { 'Token': token }
        });
        console.log("Pontos de contrato retornados (limite 3):");
        const list = res.data.data || res.data;
        console.log(JSON.stringify(list.slice(0, 3), null, 2));
    } catch (error) {
        console.error("Erro na consulta:", error.message);
    }
}

getPoints();
