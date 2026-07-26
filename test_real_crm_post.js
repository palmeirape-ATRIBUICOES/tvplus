const axios = require('axios');
const querystring = require('querystring');

async function testRealPost() {
    const url = 'https://sistema.receitanet.net/novo/crm/formulario/3431';
    
    // CPF aleatório válido
    let n = '';
    for (let i = 0; i < 9; i++) n += Math.floor(Math.random() * 10);
    let d1 = 0, d2 = 0;
    for (let i = 0; i < 9; i++) d1 += parseInt(n[i]) * (10 - i);
    d1 = 11 - (d1 % 11);
    if (d1 >= 10) d1 = 0;
    n += d1;
    for (let i = 0; i < 10; i++) d2 += parseInt(n[i]) * (11 - i);
    d2 = 11 - (d2 % 11);
    if (d2 >= 10) d2 = 0;
    n += d2;
    const formattedCpf = `${n.substring(0, 3)}.${n.substring(3, 6)}.${n.substring(6, 9)}-${n.substring(9)}`;

    const payload = {
        nome: 'Thiago Teste Obser CRM',
        cpfcnpj: formattedCpf,
        email: `thiagoteste_${Math.floor(Math.random()*1000)}@teste.com`,
        telefone1: '(21)99999-8888',
        cep: '21000-000',
        numero: '123',
        observacaocliente: 'Adesao via Landing Page TV-Pix.',
        observacaonegocio: 'SVA CDNTV Trial 4h. Login: teste@tvplus / Senha: tv123'
    };

    console.log("Enviando POST real para o ReceitaNet...");
    console.log("Payload:", payload);

    try {
        const res = await axios.post(url, querystring.stringify(payload), {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0'
            }
        });
        console.log("Resposta do ReceitaNet:", res.data);
    } catch (error) {
        console.error("Erro na requisição:", error.message);
        if (error.response) {
            console.error("Dados do Erro:", JSON.stringify(error.response.data));
        }
    }
}

testRealPost();
