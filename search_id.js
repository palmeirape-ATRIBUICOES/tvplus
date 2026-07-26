const fs = require('fs');
const path = require('path');

const filePath = "C:\\Users\\thiag\\.gemini\\antigravity\\brain\\c58d3f5d-43a9-448f-b2de-753c9bc197c9\\.system_generated\\steps\\185\\content.md";

try {
    const html = fs.readFileSync(filePath, 'utf8');
    
    // Procura por "pycbwgl"
    const regex = /.{0,100}pycbwgl.{0,100}/g;
    let match;
    let count = 0;
    while ((match = regex.exec(html)) !== null) {
        count++;
        console.log(`Match ${count}: ${match[0].trim()}`);
    }

} catch (error) {
    console.error("Erro:", error.message);
}
