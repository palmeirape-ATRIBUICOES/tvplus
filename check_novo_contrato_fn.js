const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'contratos_iframe.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura pela declaração da função novo_contrato
    const regex = /function novo_contrato[\s\S]*?\}/gi;
    const match = html.match(regex);
    if (match) {
        console.log("Definição da função novo_contrato:");
        console.log(match[0]);
    } else {
        console.log("Função novo_contrato não localizada em blocos de script do iframe.");
        // Procura por qualquer texto 'novo_contrato'
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
