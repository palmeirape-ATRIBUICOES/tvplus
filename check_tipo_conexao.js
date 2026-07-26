const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'easycad.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por inputs com name="tipo_conexao"
    const regex = /<input[^>]+name=["']tipo_conexao["'][^>]*>/gi;
    let match;
    console.log("Valores para tipo_conexao encontrados no HTML:");
    while ((match = regex.exec(html)) !== null) {
        console.log(match[0]);
    }
} catch (error) {
    console.error("Erro:", error.message);
}
