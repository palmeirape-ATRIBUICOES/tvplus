const axios = require('axios');

const token = 'dcc58870e96789b124c64c830cf65035';
const clientId = '2234';

async function checkAgain() {
    console.log("Consultando novamente os contratos no ISPFY...");
    try {
        const res = await axios.get('http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente/contrato', {
            headers: { 'Token': token }
        });
        const list = res.data.data || res.data;
        const filtered = list.filter(c => Number(c.id_cliente) === Number(clientId));
        console.log(`Contratos encontrados para o cliente ${clientId}:`);
        console.log(JSON.stringify(filtered, null, 2));
    } catch (e) {
        console.error("Erro:", e.message);
    }
}

checkAgain();
