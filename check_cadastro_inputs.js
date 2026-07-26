const puppeteer = require('puppeteer');
require('dotenv').config();

async function checkCadastroInputs() {
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
        
        // Extrai o HTML e atributos de todos os inputs da página
        const inputsData = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input, select, textarea')).map(el => {
                // Encontra label associada ou elemento pai
                let label = '';
                const parent = el.closest('.form-group') || el.parentElement;
                if (parent) {
                    const lblEl = parent.querySelector('label');
                    if (lblEl) label = lblEl.textContent.trim();
                }
                return {
                    tag: el.tagName,
                    name: el.name,
                    id: el.id,
                    type: el.type,
                    label: label
                };
            });
        });

        console.log("=== CAMPOS DE ENTRADA E SEUS LABELS ===");
        inputsData.forEach(ip => {
            if (ip.label || ip.name) {
                console.log(`Label: "${ip.label}" | Tag: <${ip.tag}> | Name: "${ip.name}" | ID: "${ip.id}" | Type: "${ip.type}"`);
            }
        });
        
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
checkCadastroInputs();
