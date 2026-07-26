const axios = require('axios');

const token = 'dcc58870e96789b124c64c830cf65035';

async function checkId() {
    const id = '2234';
    console.log(`Verificando o que o ID ${id} representa no ISPFY...`);
    try {
        // 1. Tenta buscar como Cliente
        const clientRes = await axios.get(`http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente`, {
            headers: { 'Token': token }
        });
        const clients = clientRes.data.data || clientRes.data;
        const client = clients.find(c => c.id === id);
        console.log("Busca por Cliente:", client ? `ENCONTRADO: ${client.nome} (doc: ${client.doc})` : "NÃO ENCONTRADO");

        // 2. Tenta buscar como Contrato
        const contractRes = await axios.get(`http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente/contrato`, {
            headers: { 'Token': token }
        });
        const contracts = contractRes.data.data || contractRes.data;
        const contract = contracts.find(c => c.id === id);
        console.log("Busca por Contrato:", contract ? `ENCONTRADO: Cliente ID=${contract.id_cliente}` : "NÃO ENCONTRADO");

        // 3. Tenta buscar como Ponto
        const pointRes = await axios.get(`http://levemaisfibra.ispfycloud.com.br:8020/api/object/cliente/contrato/ponto`, {
            headers: { 'Token': token }
        });
        const points = pointRes.data.data || pointRes.data;
        const point = points.find(p => p.id === id);
        console.log("Busca por Ponto:", point ? `ENCONTRADO: Contrato ID=${point.id_contrato}, Usuário=${point.usuario}` : "NÃO ENCONTRADO");

    } catch (error) {
        console.error("Erro na consulta:", error.message);
    }
}

checkId();
