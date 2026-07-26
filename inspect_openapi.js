const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'openapi.yaml');

try {
    const yaml = fs.readFileSync(filePath, 'utf8');
    console.log(`Tamanho do openapi.yaml: ${yaml.length} bytes.`);
    
    // Procura por caminhos e métodos
    const lines = yaml.split('\n');
    console.log("\nRotas encontradas no openapi.yaml:");
    let paths = [];
    lines.forEach(line => {
        if (line.trim().startsWith('/') && line.trim().endsWith(':')) {
            const route = line.trim().slice(0, -1);
            paths.push(route);
            console.log(`  - ${route}`);
        }
    });

    // Procura descrições ou métodos para rotas chave
    console.log("\nProcurando referências importantes:");
    lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('post:') || line.toLowerCase().includes('put:') || line.toLowerCase().includes('delete:') || line.toLowerCase().includes('patch:')) {
            console.log(`L${idx+1}: ${line.trim()}`);
        }
    });

} catch (error) {
    console.error("Erro:", error.message);
}
