const puppeteer = require('puppeteer');
require('dotenv').config();

async function verifyClient() {
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

        // Tenta carregar a URL com o login original
        console.log("Verificando se o login original existe...");
        await page.goto('https://sistema.receitanet.net/clientes_cadastro.php?cli_login=susp_test_6895@tvplus', { waitUntil: 'networkidle2' });
        
        // Tira screenshot para ver qual página abriu
        await page.screenshot({ path: 'C:\\Users\\thiag\\.gemini\\antigravity\\scratch\\tv-pix-platform\\verify_original.png' });
        
        // Verifica se há o campo login na página
        const originalExists = await page.evaluate(() => {
            const input = document.querySelector('input[name="cli_login"]');
            return input ? input.value : null;
        });
        console.log("Valor do login encontrado na URL original:", originalExists);

        // Tenta carregar a URL com o login suspenso
        console.log("\nVerificando se o login suspenso existe...");
        await page.goto('https://sistema.receitanet.net/clientes_cadastro.php?cli_login=susp_test_6895@tvplus_SUSPENSO', { waitUntil: 'networkidle2' });
        await page.screenshot({ path: 'C:\\Users\\thiag\\.gemini\\antigravity\\scratch\\tv-pix-platform\\verify_suspended.png' });
        const suspendedExists = await page.evaluate(() => {
            const input = document.querySelector('input[name="cli_login"]');
            return input ? input.value : null;
        });
        console.log("Valor do login encontrado na URL suspensa:", suspendedExists);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
verifyClient();
