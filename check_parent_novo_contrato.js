const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'detalhes_cliente.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura pela declaração da função novo_contrato
    const regex = /function novo_contrato[\s\S]*?\}|novo_contrato\s*=\s*function[\s\S]*?\}/gi;
    const match = html.match(regex);
    if (match) {
        console.log("Definição da função novo_contrato no pai:");
        console.log(match[0]);
    } else {
        console.log("Função novo_contrato não localizada no pai. Mostrando linhas contendo 'novo_contrato':");
        const lines = html.split('\n');
        lines.forEach((line, idx) => {
            if (line.includes('novo_contrato')) {
                console.log(`L${idx + 1}: ${line.trim()}`);
            }
        });
    }

} catch (error) {
    console.error("Erro:", error.message);
}
