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
    const svaRequests = requests.filter(r => r.request.url.raw && r.request.url.raw.includes('sva'));
    
    console.log(`=== Encontradas ${svaRequests.length} requisições SVA ===`);
    svaRequests.forEach(r => {
        console.log(`\nNome: ${r.name}`);
        console.log(`Método: ${r.request.method}`);
        console.log(`URL: ${r.request.url.raw}`);
        console.log(`Headers:`, JSON.stringify(r.request.header, null, 2));
        console.log(`Body:`, JSON.stringify(r.request.body, null, 2));
    });

} catch (error) {
    console.error("Erro:", error.message);
}
