const axios = require('axios');

const token = 'dcc58870e96789b124c64c830cf65035';

async function checkTicket() {
    try {
        const res = await axios.get('http://levemaisfibra.ispfycloud.com.br:8020/api/object/suporte/ticket?id=EQ:6963', {
            headers: { 'Token': token }
        });
        console.log("Resultado da busca direta do Ticket 6963:");
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error("Erro:", e.message);
    }
}

checkTicket();
