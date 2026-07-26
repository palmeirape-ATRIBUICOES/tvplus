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
            results.push({
                name: item.name,
                method: item.request.method,
                url: item.request.url ? (typeof item.request.url === 'string' ? item.request.url : item.request.url.raw) : ''
            });
        }
        return results;
    }
    
    const requests = searchRequests(data.item);
    console.log("Lista completa de requisições na coleção:");
    requests.forEach((r, idx) => {
        console.log(`${idx + 1}. [${r.method}] ${r.name} -> ${r.url}`);
    });

} catch (error) {
    console.error("Erro:", error.message);
}
