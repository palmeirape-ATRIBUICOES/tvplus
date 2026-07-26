const puppeteer = require('puppeteer');
require('dotenv').config();

async function getInputs() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto('https://sistema.receitanet.net/', { waitUntil: 'networkidle2' });
        await page.waitForSelector('#username');
        await page.type('#username', process.env.RECEITANET_ADMIN_USER);
        await page.type('#password', process.env.RECEITANET_ADMIN_PASS);
        await Promise.all([
            page.click('#kc-login'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        await page.goto('https://sistema.receitanet.net/clientes_cadastro.php', { waitUntil: 'networkidle2' });
        
        const inputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input, select, textarea, button')).map(el => ({
                tag: el.tagName,
                name: el.name,
                id: el.id,
                type: el.type,
                class: el.className,
                placeholder: el.placeholder,
                text: el.textContent.trim()
            }));
        });

        console.log("=== TODOS OS CAMPOS ENCONTRADOS ===");
        inputs.forEach(ip => {
            // Filtra apenas os que são relevantes para o formulário de cadastro de cliente
            // que aparecem no topo
            if (ip.id || ip.name) {
                console.log(`Tag: <${ip.tag}> | Name: "${ip.name}" | ID: "${ip.id}" | Type: "${ip.type}" | Class: "${ip.class}" | Text: "${ip.text}"`);
            }
        });
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
getInputs();
