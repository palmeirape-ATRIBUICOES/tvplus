const axios = require('axios');

const url = 'http://levemaisfibra.ispfycloud.com.br:8020/api/object/plano';
const token = 'dcc58870e96789b124c64c830cf65035';

async function getPlans() {
    console.log("Buscando planos contendo 'THIAGO' ou 'CDN' no ISPFY...");
    try {
        const resAll = await axios.get(`${url}?limit=200`, {
            headers: { 'Token': token }
        });
        const list = resAll.data.data || resAll.data;
        console.log("Planos localizados (busca ampla):");
        
        const filtered = list.filter(p => p.nome.toUpperCase().includes('THIAGO') || p.nome.toUpperCase().includes('CDN') || p.nome.toUpperCase().includes('TV'));
        filtered.forEach(p => {
            console.log(`- ID: ${p.id} | Nome: "${p.nome}" | Tipo: "${p.tipo}" | Mensal: "${p.valor_mensal}"`);
        });
    } catch (error) {
        console.error("Erro na consulta:", error.message);
    }
}

getPlans();
