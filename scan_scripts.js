const fs = require('fs');

const filePath = "C:\\Users\\thiag\\.gemini\\antigravity\\brain\\c58d3f5d-43a9-448f-b2de-753c9bc197c9\\.system_generated\\steps\\185\\content.md";

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por todos os scripts
    const regex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let count = 0;
    
    console.log("Escaneando scripts dinamicamente no HTML...");
    while ((match = regex.exec(html)) !== null) {
        const content = match[1].trim();
        count++;
        
        // Regex para encontrar URLs
        const urlRegex = /https?:\/\/[^\s"'`<>]+/g;
        let urlMatch;
        const found = [];
        
        while ((urlMatch = urlRegex.exec(content)) !== null) {
            found.push(urlMatch[0]);
        }
        
        if (found.length > 0) {
            console.log(`\n--- Script ${count} (Tamanho: ${content.length} caracteres) ---`);
            const uniq = [...new Set(found)].slice(0, 30);
            uniq.forEach(u => console.log(`  - ${u}`));
        }
    }
} catch (error) {
    console.error("Erro:", error.message);
}
