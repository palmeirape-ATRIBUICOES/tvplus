const puppeteer = require('puppeteer');
require('dotenv').config();

async function checkPlansPage() {
    console.log("Iniciando check da página de planos...");
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
        const login = `test_plan_${Math.floor(Math.random()*1000)}@tvplus`;
        await page.type('input[name="cli_login"]', login);
        await page.type('input[name="cli_senha"]', '123456');
        await page.type('input[name="cli_nome"]', 'Thiago Teste Pagina Planos');
        await page.type('input[name="cli_cgc"]', '000.000.000-00');

        console.log("Criando cliente...");
        await Promise.all([
            page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
                const btn = buttons.find(b => b.textContent.trim() === 'Incluir');
                if (btn) btn.click();
            }),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        console.log("Acessando página de planos...");
        await page.waitForSelector('a[href*="/novo/financeiros/clientes/planos/"]', { timeout: 10000 });
        await Promise.all([
            page.evaluate(() => {
                const btn = document.querySelector('a[href*="/novo/financeiros/clientes/planos/"]');
                if (btn) btn.click();
                else throw new Error("Link de planos não localizado.");
            }),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        console.log("Página de planos carregada! URL atual:", page.url());

        // Tira uma screenshot para depuração visual
        const screenshotPath = 'C:\\Users\\thiag\\.gemini\\antigravity\\scratch\\tv-pix-platform\\planos_page.png';
        await page.screenshot({ path: screenshotPath });
        console.log("Screenshot salva em:", screenshotPath);

        // Extrai todos os campos da página de planos
        const fields = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input, select, button')).map(el => {
                let options = [];
                if (el.tagName === 'SELECT') {
                    options = Array.from(el.options).map(opt => ({
                        text: opt.text.trim(),
                        value: opt.value
                    }));
                }
                return {
                    tag: el.tagName,
                    name: el.name,
                    id: el.id,
                    type: el.type,
                    text: el.textContent.trim(),
                    options: options
                };
            });
        });

        console.log("\nElementos encontrados na página de planos:");
        fields.forEach(f => {
            console.log(`Tag: <${f.tag}> | Name: "${f.name}" | ID: "${f.id}" | Text: "${f.text}"`);
            if (f.options.length > 0) {
                console.log("  Opções do Select:");
                f.options.forEach(o => console.log(`    - Valor: "${o.value}" | Texto: "${o.text}"`));
            }
        });

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

checkPlansPage();
