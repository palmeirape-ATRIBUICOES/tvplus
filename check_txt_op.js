const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'easycad_script_6.js');

try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Procura por txt_op
    const lines = content.split('\n');
    console.log("Linhas contendo txt_op:");
    lines.forEach((line, idx) => {
        if (line.includes('txt_op')) {
            console.log(`L${idx + 1}: ${line.trim()}`);
        }
    });

} catch (error) {
    console.error("Erro:", error.message);
}
