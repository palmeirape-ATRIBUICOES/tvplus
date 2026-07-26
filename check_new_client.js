const axios = require('axios');

const token = 'dcc58870e96789b124c64c830cf65035';

async function checkClientData() {
    const clientId = '2234';
    console.log(`Verificando se contratos foram criados automaticamente para o cliente ${clientId}...`);
    try {
        // Busca contratos vinculados ao cliente
        const contractRes = await axios.get(`http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente/contrato`, {
            headers: { 'Token': token }
        });
        
        const contracts = contractRes.data.data || contractRes.data;
        const clientContracts = contracts.filter(c => c.id_cliente === clientId);
        console.log(`Contratos vinculados ao cliente ${clientId}:`, JSON.stringify(clientContracts, null, 2));
        
        if (clientContracts.length > 0) {
            const contractId = clientContracts[0].id;
            // Busca pontos vinculados a este contrato
            const pointRes = await axios.get(`http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente/contrato/ponto`, {
                headers: { 'Token': token }
            });
            const points = pointRes.data.data || pointRes.data;
            const contractPoints = points.filter(p => p.id_contrato === contractId);
            console.log(`Pontos vinculados ao contrato ${contractId}:`, JSON.stringify(contractPoints, null, 2));
        }
    } catch (error) {
        console.error("Erro na consulta:", error.message);
    }
}

checkClientData();
