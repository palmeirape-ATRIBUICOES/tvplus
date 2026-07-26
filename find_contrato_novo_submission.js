const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'contrato_novo.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por scripts que contêm $.post ou $.ajax
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let count = 0;
    
    console.log("Analisando scripts de contrato_novo.html...");
    while ((match = scriptRegex.exec(html)) !== null) {
        const content = match[1];
        count++;
        
        if (content.includes('$.post') || content.includes('$.ajax') || content.includes('submit') || content.includes('serialize')) {
            console.log(`\n--- Script ${count} (Tamanho: ${content.length}) ---`);
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes('$.post') || line.includes('$.ajax') || line.includes('url') || line.includes('serialize') || line.includes('contrato_novo.php') || line.includes('save')) {
                    console.log(`L${idx + 1}: ${line.trim()}`);
                }
            });
            fs.writeFileSync(`contrato_novo_script_${count}.js`, content);
        }
    }

} catch (error) {
    console.error("Erro:", error.message);
}
