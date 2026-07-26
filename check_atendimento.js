const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'easycad.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    console.log("=== Buscando ocorrências de 'atendimento' ===");
    const regex = /.{0,100}atendimento.{0,100}/gi;
    let match;
    let count = 0;
    while ((match = regex.exec(html)) !== null) {
        count++;
        console.log(`${count}: ${match[0].trim()}`);
    }
} catch (error) {
    console.error("Erro:", error.message);
}
