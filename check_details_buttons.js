const puppeteer = require('puppeteer');
require('dotenv').config();

async function checkDetailsButtons() {
    console.log("Iniciando check de botões de detalhes...");
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

        // Vamos cadastrar um cliente temporário para chegar na tela de detalhes
        await page.goto('https://sistema.receitanet.net/clientes_cadastro.php', { waitUntil: 'networkidle2' });
        
        await page.waitForSelector('input[name="cli_login"]');
        const login = `test_btn_${Math.floor(Math.random()*1000)}@tvplus`;
        await page.type('input[name="cli_login"]', login);
        await page.type('input[name="cli_senha"]', '123456');
        await page.type('input[name="cli_nome"]', 'Thiago Teste Botao');
        await page.type('input[name="cli_cgc"]', '000.000.000-00'); // CPF placeholder

        console.log("Clicando em incluir...");
        await Promise.all([
            page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
                const btn = buttons.find(b => b.textContent.trim() === 'Incluir');
                if (btn) btn.click();
            }),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        console.log("Chegou na tela pós-inclusão. URL:", page.url());

        // Extrai todos os links com seus textos, classes e IDs que estão na área de conteúdo
        // Evitando o menu lateral (que geralmente fica em tags <aside> ou classes contendo "sidebar")
        const buttons = await page.evaluate(() => {
            const list = [];
            // Remove a sidebar da busca
            const sidebar = document.querySelector('aside, .main-sidebar, .sidebar');
            const allLinks = Array.from(document.querySelectorAll('a, button'));
            
            allLinks.forEach(el => {
                // Se o elemento não estiver dentro da sidebar
                if (!sidebar || !sidebar.contains(el)) {
                    list.push({
                        text: el.textContent.trim(),
                        id: el.id,
                        class: el.className,
                        href: el.href || 'N/A'
                    });
                }
            });
            return list;
        });

        console.log("\nBotões/Links encontrados fora da Sidebar:");
        buttons.forEach(b => {
            if (b.text) {
                console.log(`Texto: "${b.text}" | Class: "${b.class}" | ID: "${b.id}" | Href: "${b.href}"`);
            }
        });

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

checkDetailsButtons();
