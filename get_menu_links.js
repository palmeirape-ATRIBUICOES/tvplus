const puppeteer = require('puppeteer');
require('dotenv').config();

async function getMenuLinks() {
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

        // Espera carregar o menu
        await page.waitForSelector('a', { timeout: 10000 });
        
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(el => ({
                text: el.textContent.trim(),
                href: el.href
            }));
        });

        console.log("=== LINKS DO MENU ENCONTRADOS ===");
        links.forEach(l => {
            if (l.text.toLowerCase().includes('cliente') || l.text.toLowerCase().includes('novo')) {
                console.log(`Texto: "${l.text}" | Href: "${l.href}"`);
            }
        });
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
getMenuLinks();
