const fs = require('fs');

const apis = ['chatbot_api.yaml', 'ura_api.yaml'];

apis.forEach(fileName => {
    if (!fs.existsSync(fileName)) {
        console.log(`Arquivo ${fileName} não existe.`);
        return;
    }
    const content = fs.readFileSync(fileName, 'utf8');
    console.log(`=== Análise do arquivo: ${fileName} ===`);
    
    // Procura por status, block, put, patch no arquivo
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('status') || line.toLowerCase().includes('bloque') || line.toLowerCase().includes('put:') || line.toLowerCase().includes('patch:')) {
            console.log(`L${idx+1}: ${line.trim()}`);
        }
    });
    console.log('---------------------------------------------\n');
});
