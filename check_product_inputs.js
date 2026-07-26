const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'easycad.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por txt_produto_tipo e outros campos de produto no HTML
    console.log("=== Analisando inputs de produtos no EasyCAD ===");
    
    const lines = html.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('txt_produto_tipo') || line.includes('txt_id_produto') || line.includes('txt_produto_item')) {
            console.log(`L${idx + 1}: ${line.trim()}`);
        }
    });

} catch (error) {
    console.error("Erro:", error.message);
}
