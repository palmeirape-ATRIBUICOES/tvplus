const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'detalhes_cliente.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    console.log(`Tamanho do arquivo: ${html.length} caracteres.`);
    
    // Procura por links ou iframe no html
    const regex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let match;
    console.log("\nLinks encontrados:");
    let count = 0;
    while ((match = regex.exec(html)) !== null) {
        count++;
        if (count <= 20) {
            console.log(`  - ${match[1]}`);
        }
    }
    
    // Procura por botões ou trechos com "contrato"
    console.log("\nProcurando por 'contrato' de forma ampla:");
    const lines = html.split('\n');
    let foundLines = 0;
    lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('contrato') || line.toLowerCase().includes('ponto') || line.toLowerCase().includes('cadastro')) {
            foundLines++;
            if (foundLines <= 20) {
                console.log(`L${idx + 1}: ${line.trim().substring(0, 150)}`);
            }
        }
    });
} catch (error) {
    console.error("Erro:", error.message);
}
