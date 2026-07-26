const fs = require('fs');

const filePath = "C:\\Users\\thiag\\.gemini\\antigravity\\brain\\c58d3f5d-43a9-448f-b2de-753c9bc197c9\\.system_generated\\steps\\185\\content.md";

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por UUIDs padrão (ex: 8-4-4-4-12 caracteres hex)
    const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
    let match;
    const uuids = new Set();
    while ((match = uuidRegex.exec(html)) !== null) {
        uuids.add(match[0]);
    }
    
    // Procura por UIDs do Postman no formato: idUsuario-idColecao (ex: 123456-abc123ab-1234-...)
    // Ou simplesmente padrões com hífen e números no início, tipo "12345678-abc..." ou "12345-..."
    const postmanUidRegex = /\b\d{4,10}-[a-f0-9-]{10,40}\b/gi;
    while ((match = postmanUidRegex.exec(html)) !== null) {
        uuids.add(match[0]);
    }

    console.log("IDs / UUIDs localizados no HTML:");
    uuids.forEach(id => console.log(`- ${id}`));

} catch (error) {
    console.error("Erro:", error.message);
}
