const puppeteer = require('puppeteer');
require('dotenv').config();

async function testRobotLogin() {
    const adminUser = process.env.RECEITANET_ADMIN_USER;
    const adminPass = process.env.RECEITANET_ADMIN_PASS;

    if (!adminUser || !adminPass) {
        console.error("Erro: RECEITANET_ADMIN_USER e RECEITANET_ADMIN_PASS precisam estar no .env");
        return;
    }

    console.log("Iniciando Puppeteer para testar login...");
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    try {
        console.log("Acessando raiz do ReceitaNet...");
        await page.goto('https://sistema.receitanet.net/', { waitUntil: 'networkidle2' });

        console.log("Preenchendo credenciais...");
        await page.waitForSelector('#username', { timeout: 10000 });
        await page.type('#username', adminUser);
        await page.type('#password', adminPass);

        console.log("Clicando no botão de login...");
        await Promise.all([
            page.click('#kc-login'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        console.log("Login realizado com sucesso! Redirecionado para:", page.url());

        console.log("Acessando a tela de cadastro de cliente...");
        await page.goto('https://sistema.receitanet.net/clientes_cadastro.php', { waitUntil: 'networkidle2' });
        console.log("Carregado clientes_cadastro.php. URL atual:", page.url());

        // Tira uma screenshot para ver se carregou a página e os campos corretos
        const screenshotPath = 'C:\\Users\\thiag\\.gemini\\antigravity\\scratch\\tv-pix-platform\\cadastro_fields.png';
        await page.screenshot({ path: screenshotPath });
        console.log("Screenshot salva em:", screenshotPath);

        // Imprime os inputs encontrados
        const inputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input, select, button')).map(el => ({
                tag: el.tagName,
                name: el.name,
                id: el.id,
                type: el.type,
                value: el.value,
                text: el.textContent.trim()
            }));
        });
        console.log("\nCampos de entrada encontrados em clientes_cadastro.php:");
        inputs.forEach(ip => {
            if (ip.name || ip.id) {
                console.log(`Tag: <${ip.tag}> | Name: ${ip.name || 'N/A'} | ID: ${ip.id || 'N/A'} | Type: ${ip.type || 'N/A'} | Text: ${ip.text || 'N/A'}`);
            }
        });

    } catch (error) {
        console.error("Ocorreu um erro no teste:", error.message);
        await page.screenshot({ path: 'C:\\Users\\thiag\\.gemini\\antigravity\\scratch\\tv-pix-platform\\login_error.png' });
        console.log("Screenshot do erro salva em login_error.png");
    } finally {
        await browser.close();
    }
}

testRobotLogin();
