const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'contrato_novo.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por tags form no HTML
    const regex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
    let match;
    console.log("Formulários encontrados em contrato_novo.html:");
    while ((match = regex.exec(html)) !== null) {
        console.log(match[0].substring(0, 300));
        console.log("-----------------------------------------");
    }
    
    // Procura por form action
    const actionRegex = /action=["']([^"']+)["']/gi;
    let actionMatch;
    while ((actionMatch = actionRegex.exec(html)) !== null) {
        console.log(`Action encontrada: ${actionMatch[1]}`);
    }
} catch (error) {
    console.error("Erro:", error.message);
}
