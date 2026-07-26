const axios = require('axios');

const url = 'http://levemaisfibra.ispfycloud.com.br:8020/api/object/suporte/ticket';
const token = 'dcc58870e96789b124c64c830cf65035';

async function getTickets() {
    console.log("Consultando chamados/tickets no ISPFY...");
    try {
        const res = await axios.get(url, {
            headers: { 'Token': token }
        });
        const list = res.data.data || res.data;
        console.log(`Total de tickets retornados: ${list.length}`);
        console.log("Amostra (primeiros 3):");
        console.log(JSON.stringify(list.slice(0, 3), null, 2));
    } catch (error) {
        console.error("Erro na consulta:", error.message);
    }
}

getTickets();
