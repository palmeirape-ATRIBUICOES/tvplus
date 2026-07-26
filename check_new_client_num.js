const axios = require('axios');

const token = 'dcc58870e96789b124c64c830cf65035';

async function checkClientData() {
    const clientId = 2234;
    console.log(`Verificando contratos vinculados ao cliente ${clientId} (usando comparação flexível)...`);
    try {
        const contractRes = await axios.get(`http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente/contrato`, {
            headers: { 'Token': token }
        });
        
        const contracts = contractRes.data.data || contractRes.data;
        
        // Vamos listar os IDs de cliente de todos os contratos para entender
        console.log("Amostra de contratos retornados pelo ISPFY:");
        console.log(JSON.stringify(contracts.slice(0, 3), null, 2));
        
        const clientContracts = contracts.filter(c => Number(c.id_cliente) === clientId);
        console.log(`Contratos encontrados para o cliente ${clientId}:`, JSON.stringify(clientContracts, null, 2));
        
    } catch (error) {
        console.error("Erro na consulta:", error.message);
    }
}

checkClientData();
