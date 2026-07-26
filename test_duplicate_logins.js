const axios = require('axios');

const baseUrl = 'http://localhost:3000/api';

async function runDuplicateTest() {
    console.log("=== INICIANDO TESTE DE LOGINS DUPLICADOS ===");
    
    const names = [
        { nome: 'Thiago Palmeira', email: 'thiago1@tv.com' },
        { nome: 'Thiago Palmeira Barbosa', email: 'thiago2@tv.com' },
        { nome: 'Thiago Palmeira Barbosa', email: 'thiago3@tv.com' },
        { nome: 'Thiago Palmeira Barbosa', email: 'thiago4@tv.com' }
    ];

    for (let i = 0; i < names.length; i++) {
        const payload = {
            nome: names[i].nome,
            email: names[i].email,
            telefone: `2199999000${i}`,
            cpfcnpj: `0000000000${i}`,
            cep: '25555355'
        };

        try {
            const res = await axios.post(`${baseUrl}/cadastro`, payload);
            console.log(`Cadastro ${i + 1} (${names[i].nome}):`, {
                login: res.data.login,
                senha: res.data.senha
            });
        } catch (error) {
            console.error(`Erro no cadastro ${i + 1}:`, error.message);
        }
    }
}

runDuplicateTest();
