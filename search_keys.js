const fs = require('fs');
const path = require('path');

const filePath = "C:\\Users\\thiag\\.gemini\\antigravity\\brain\\c58d3f5d-43a9-448f-b2de-753c9bc197c9\\.system_generated\\steps\\185\\content.md";

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por "access_key" ou similar
    const regexes = [
        /access_key/gi,
        /accessKey/gi,
        /apiKey/gi,
        /public-apis/gi,
        /collection_uuid/gi,
        /collection/gi
    ];
    
    regexes.forEach(regex => {
        let match;
        const testRegex = new RegExp(`.{0,50}${regex.source}.{0,50}`, 'gi');
        if ((match = testRegex.exec(html)) !== null) {
            console.log(`Encontrado com regex ${regex.source}: ${match[0].trim()}`);
        }
    });

} catch (error) {
    console.error("Erro:", error.message);
}
