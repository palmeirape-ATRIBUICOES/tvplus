const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'easycad.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por blocos de script no HTML do easycad
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let count = 0;
    
    console.log("Analisando scripts internos do EasyCAD...");
    
    while ((match = scriptRegex.exec(html)) !== null) {
        const content = match[1];
        count++;
        
        // Verifica se o script possui palavras-chave de post ou envio
        if (content.includes('$.post') || content.includes('$.ajax') || content.includes('axios') || content.includes('submit') || content.includes('save') || content.includes('cadastrar')) {
            console.log(`\n--- Script Inline Interessante ${count} (Tamanho: ${content.length}) ---`);
            // Imprime linhas que contêm ajax, post, ou submit
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes('$.post') || line.includes('$.ajax') || line.includes('url') || line.includes('data') || line.includes('success') || line.includes('error') || line.includes('save') || line.includes('serialize')) {
                    console.log(`L${idx + 1}: ${line.trim()}`);
                }
            });
            
            // Grava o script completo em um arquivo para podermos ver tudo se necessário
            fs.writeFileSync(`easycad_script_${count}.js`, content);
            console.log(`Script completo salvo em: easycad_script_${count}.js`);
        }
    }

} catch (error) {
    console.error("Erro:", error.message);
}
