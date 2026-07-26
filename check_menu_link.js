const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'main_php.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por easycad.php no html de main.php
    const lines = html.split('\n');
    console.log("Linhas em main.php contendo easycad.php:");
    lines.forEach((line, idx) => {
        if (line.includes('easycad.php') || line.includes('easycad')) {
            console.log(`L${idx + 1}: ${line.trim()}`);
        }
    });
} catch (error) {
    console.error("Erro:", error.message);
}
