const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'contrato_novo_script_5.js');

try {
    if (!fs.existsSync(filePath)) {
        console.log("Arquivo contrato_novo_script_5.js não existe!");
        return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Procura por frmPostar
    const lines = content.split('\n');
    console.log("Linhas em contrato_novo_script_5.js contendo frmPostar ou submit:");
    lines.forEach((line, idx) => {
        if (line.includes('frmPostar') || line.includes('submit') || line.includes('postar')) {
            console.log(`L${idx + 1}: ${line.trim()}`);
        }
    });

} catch (error) {
    console.error("Erro:", error.message);
}
