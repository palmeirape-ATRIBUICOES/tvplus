const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'contrato_novo.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por select name="id_doc_model"
    const regex = /<select[^>]*name=["'](id_doc_model|id_nfcom_preset|nfe_2x_tipo_lanc|txt_especie|txt_tipo_fat|txt_carteira)["'][^>]*>([\s\S]*?)<\/select>/gi;
    let match;
    console.log("=== Analisando Dropdowns em contrato_novo.html ===");
    while ((match = regex.exec(html)) !== null) {
        const name = match[1];
        const content = match[2];
        console.log(`\nDropdown: ${name}`);
        const optionRegex = /<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi;
        let optMatch;
        while ((optMatch = optionRegex.exec(content)) !== null) {
            console.log(`  - Valor: "${optMatch[1]}" -> Texto: "${optMatch[2].trim()}"`);
        }
    }

} catch (error) {
    console.error("Erro:", error.message);
}
