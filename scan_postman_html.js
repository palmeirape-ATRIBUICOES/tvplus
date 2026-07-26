const fs = require('fs');
const path = require('path');

const filePath = "C:\\Users\\thiag\\.gemini\\antigravity\\brain\\c58d3f5d-43a9-448f-b2de-753c9bc197c9\\.system_generated\\steps\\185\\content.md";

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por todas as URLs ou caminhos que contêm /tool/ ou /object/ no arquivo HTML
    const paths = new Set();
    const regex = /(\/tool\/[a-zA-Z0-9_\-\/]+|\/object\/[a-zA-Z0-9_\-\/]+)/g;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
        paths.add(match[1]);
    }
    
    console.log("Caminhos contendo /tool/ ou /object/ localizados:");
    paths.forEach(p => {
        console.log(`- ${p}`);
    });
    
    // Procura por qualquer string de texto contendo verbos HTTP e rotas próximas
    console.log("\nProcurando por referências a POST:");
    const postRegex = /POST[\s\S]{1,50}(\/object\/|\/tool\/|\/api\/)[a-zA-Z0-9_\-\/]+/gi;
    const postMatches = html.match(postRegex);
    if (postMatches) {
        postMatches.forEach(m => console.log(`- ${m.trim()}`));
    } else {
        console.log("Nenhuma correspondência direta de POST + rota.");
    }

} catch (error) {
    console.error("Erro:", error.message);
}
