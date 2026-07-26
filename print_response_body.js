const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'contract_response.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    console.log("=== Analisando scripts e alertas na resposta ===");
    // Imprime as últimas 100 linhas do HTML
    const lines = html.split('\n');
    const lastLines = lines.slice(-80);
    console.log("Últimas 80 linhas do HTML de resposta:");
    lastLines.forEach((l, i) => {
        console.log(`${lines.length - 80 + i + 1}: ${l.trim()}`);
    });

} catch (error) {
    console.error("Erro:", error.message);
}
