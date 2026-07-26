const axios = require('axios');

const url = 'http://levemaisfibra.ispfycloud.com.br:8020/api/object/plano';
const token = 'dcc58870e96789b124c64c830cf65035';

async function getPlans() {
    console.log("Consultando planos cadastrados no ISPFY...");
    try {
        const res = await axios.get(url, {
            headers: { 'Token': token }
        });
        const list = res.data.data || res.data;
        console.log("Planos Encontrados:");
        list.forEach(p => {
            console.log(`- ID: ${p.id} | Nome: "${p.nome}" | Tipo: "${p.tipo}" | Mensal: "${p.valor_mensal}"`);
        });
    } catch (error) {
        console.error("Erro na consulta:", error.message);
    }
}

getPlans();
