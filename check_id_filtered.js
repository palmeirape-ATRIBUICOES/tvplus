const axios = require('axios');

const token = 'dcc58870e96789b124c64c830cf65035';
const id = '2234';

async function checkFiltered() {
    console.log(`Buscando dados filtrados para o ID ${id}...`);
    try {
        // Tenta obter o cliente diretamente filtrando por ID
        const resClient = await axios.get(`http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente?id=EQ:${id}`, {
            headers: { 'Token': token }
        });
        console.log("Resultado Cliente (id=EQ):");
        console.log(JSON.stringify(resClient.data, null, 2));

        // Tenta obter o cliente diretamente usando id=id
        const resClient2 = await axios.get(`http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente?id=${id}`, {
            headers: { 'Token': token }
        });
        console.log("Resultado Cliente (id=id):");
        console.log(JSON.stringify(resClient2.data, null, 2));

        // Tenta buscar usando a rota tool/assinante/info
        const resToolInfo = await axios.get(`http://levemaisfibra.ispfycloud.com.br:8020/api/tool/assinante/info?id=${id}`, {
            headers: { 'Token': token }
        });
        console.log("Resultado assinante/info (id=id):");
        console.log(JSON.stringify(resToolInfo.data, null, 2));

    } catch (error) {
        console.error("Erro na busca filtrada:", error.message);
        if (error.response) {
            console.error("Resposta:", JSON.stringify(error.response.data));
        }
    }
}

checkFiltered();
