const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'easycad.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por textareas e inputs de texto que possam conter observações
    const regex = /<textarea[^>]*>([\s\S]*?)<\/textarea>|<textarea[^>]*\/>/gi;
    let match;
    console.log("=== Textareas encontrados ===");
    while ((match = regex.exec(html)) !== null) {
        console.log(match[0]);
    }
    
    // Procura por inputs que contêm "obs" ou "obs" no nome
    console.log("\n=== Inputs contendo 'obs' no nome ===");
    const inputRegex = /<input[^>]+name=["']([^"']+)["'][^>]*>/gi;
    let inpMatch;
    while ((inpMatch = inputRegex.exec(html)) !== null) {
        if (inpMatch[1].toLowerCase().includes('obs')) {
            console.log(inpMatch[0]);
        }
    }
} catch (error) {
    console.error("Erro:", error.message);
}
