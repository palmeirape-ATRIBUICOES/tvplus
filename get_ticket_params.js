const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ISPFY.json');

try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    function searchRequests(item, results = []) {
        if (!item) return results;
        if (Array.isArray(item)) {
            item.forEach(i => searchRequests(i, results));
        } else if (item.item) {
            searchRequests(item.item, results);
        } else if (item.request) {
            results.push(item);
        }
        return results;
    }
    
    const requests = searchRequests(data.item);
    const found = requests.find(r => r.name.toLowerCase().includes("novo ticket"));
    if (found) {
        console.log(`=== Parâmetros de: ${found.name} ===`);
        console.log(`Método: ${found.request.method}`);
        console.log(`URL: ${found.request.url.raw || found.request.url}`);
        if (found.request.body && found.request.body.formdata) {
            found.request.body.formdata.forEach(f => {
                console.log(`  - ${f.key}: "${f.value || ''}" (${f.description || 'Sem descrição'})`);
            });
        } else {
            console.log("Sem corpo configurado ou não é formdata.");
            console.log(JSON.stringify(found.request.body, null, 2));
        }
    } else {
        console.log("Requisição 'Novo ticket' não encontrada.");
    }

} catch (error) {
    console.error("Erro:", error.message);
}
