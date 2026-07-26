const axios = require('axios');

async function getCRMFields() {
    console.log("Consultando os campos do formulário CRM 2445 no ReceitaNet...");
    try {
        const res = await axios.get('https://sistema.receitanet.net/novo/crm/formulario/3431', {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
        });
        console.log("Campos retornados pelo ReceitaNet:");
        console.log(JSON.stringify(res.data, null, 2));
    } catch (error) {
        console.error("Erro ao consultar campos:", error.message);
        if (error.response) {
            console.error("Detalhes:", JSON.stringify(error.response.data));
        }
    }
}

getCRMFields();
