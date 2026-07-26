const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ISPFY.json');

try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log("Coleção Postman carregada com sucesso.");
    console.log(`Nome da Coleção: ${data.info ? data.info.name : 'Sem nome'}`);
    
    // Função recursiva para buscar requisições no arquivo exportado do Postman
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
                url: item.request.url ? (typeof item.request.url === 'string' ? item.request.url : item.request.url.raw) : '',
                body: item.request.body
            });
        }
        return results;
    }
    
    const requests = searchRequests(data.item);
    console.log(`\nTotal de requisições encontradas: ${requests.length}`);
    
    // Busca por requisições de interesse
    const targets = ["Novo cliente", "Testa novo plano"];
    
    targets.forEach(target => {
        const found = requests.find(r => r.name.toLowerCase().includes(target.toLowerCase()));
        if (found) {
            console.log(`\n=================== ENCONTRADO: ${found.name} ===================`);
            console.log(`Método: ${found.method}`);
            console.log(`URL: ${found.url}`);
            if (found.body) {
                console.log(`Modo do Body: ${found.body.mode}`);
                if (found.body.mode === 'formdata' && found.body.formdata) {
                    console.log("Campos Form-Data:");
                    found.body.formdata.forEach(field => {
                        console.log(`  - ${field.key}: "${field.value || ''}" (${field.description || 'Sem descrição'}) [${field.disabled ? 'DESATIVADO' : 'ATIVO'}]`);
                    });
                } else if (found.body.mode === 'raw' && found.body.raw) {
                    console.log("Corpo Raw (JSON):");
                    console.log(found.body.raw);
                }
            } else {
                console.log("Sem corpo configurado.");
            }
        } else {
            console.log(`\n[AVISO] Requisição contendo "${target}" não foi localizada.`);
        }
    });

} catch (error) {
    console.error("Erro ao analisar a coleção:", error.message);
}
