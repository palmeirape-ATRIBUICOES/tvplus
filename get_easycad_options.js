const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'easycad.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Vamos procurar selects no HTML
    const selectRegex = /<select[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi;
    let match;
    
    console.log("=== Opções dos campos Select no EasyCAD ===");
    
    while ((match = selectRegex.exec(html)) !== null) {
        const name = match[1];
        const content = match[2];
        
        if (["txt_tenant", "txt_carteira", "txt_fidelidade", "txt_tipo_end", "txt_especie", "txt_tipo_fat", "tipo_conexao", "txt_tecnologia"].includes(name)) {
            console.log(`\nCampo: ${name}`);
            const optionRegex = /<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi;
            let optMatch;
            while ((optMatch = optionRegex.exec(content)) !== null) {
                console.log(`  - Valor: "${optMatch[1]}" -> Texto: "${optMatch[2].trim()}"`);
            }
        }
    }
    
    // Vamos também procurar referências aos produtos (planos)
    console.log("\n=== Buscando IDs de Planos/Produtos ===");
    // Tenta encontrar opções de planos pré-renderizados
    const prodSelectRegex = /<select[^>]*id=["']txt_id_produto["'][^>]*>([\s\S]*?)<\/select>|<select[^>]*name=["']txt_id_produto\[\]["'][^>]*>([\s\S]*?)<\/select>/gi;
    let prodMatch = prodSelectRegex.exec(html);
    if (prodMatch) {
        const content = prodMatch[1] || prodMatch[2];
        const optionRegex = /<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi;
        let optMatch;
        while ((optMatch = optionRegex.exec(content)) !== null) {
            console.log(`  - Plano ID: "${optMatch[1]}" -> Nome: "${optMatch[2].trim()}"`);
        }
    } else {
        console.log("Dropdown de planos não renderizado diretamente (pode ser carregado via ajax / js).");
    }

} catch (error) {
    console.error("Erro:", error.message);
}
