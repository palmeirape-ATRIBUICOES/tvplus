const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'easycad.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por inputs hidden
    const regex = /<input[^>]+type=["']hidden["'][^>]*>/gi;
    let match;
    console.log("Inputs Hidden encontrados no HTML:");
    while ((match = regex.exec(html)) !== null) {
        console.log(match[0]);
    }
} catch (error) {
    console.error("Erro:", error.message);
}
