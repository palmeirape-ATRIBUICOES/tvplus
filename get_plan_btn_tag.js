const puppeteer = require('puppeteer');
require('dotenv').config();

async function getPlanBtnTag() {
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
        
        await page.waitForSelector('input[name="cli_login"]');
        const login = `test_tag_${Math.floor(Math.random()*1000)}@tvplus`;
        await page.type('input[name="cli_login"]', login);
        await page.type('input[name="cli_senha"]', '123456');
        await page.type('input[name="cli_nome"]', 'Thiago Teste Tag');
        await page.type('input[name="cli_cgc"]', '000.000.000-00');

        await Promise.all([
            page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
                const btn = buttons.find(b => b.textContent.trim() === 'Incluir');
                if (btn) btn.click();
            }),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        // Procura especificamente o botão Planos
        const btnDetails = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const match = elements.find(el => el.textContent.trim() === 'Planos' && (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'DIV' || el.tagName === 'SPAN'));
            if (match) {
                return {
                    tagName: match.tagName,
                    className: match.className,
                    id: match.id,
                    href: match.href || match.getAttribute('href') || 'N/A',
                    onclick: match.getAttribute('onclick') || 'N/A',
                    innerHTML: match.innerHTML
                };
            }
            return null;
        });

        console.log("=== DETALHES DO BOTÃO PLANOS ===");
        console.log(JSON.stringify(btnDetails, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
getPlanBtnTag();
