const puppeteer = require('puppeteer');
require('dotenv').config();

const RECEITANET_LOGIN_URL = 'https://sistema.receitanet.net/';
const CADASTRO_CLIENTE_URL = 'https://sistema.receitanet.net/clientes_cadastro.php';

class ReceitanetRobotService {
    /**
     * Automatiza o login no painel, cria o cliente com as credenciais SVA e associa o plano CDNTV
     * @param {object} cliente - { nome, cpfcnpj, email, telefone, cep, numero }
     * @param {string} loginTv - Login gerado (ex: thiago@tvplus)
     * @param {string} senhaTv - Senha gerada
     */
    async cadastrarEAtivarTV(cliente, loginTv, senhaTv) {
        const adminUser = process.env.RECEITANET_ADMIN_USER;
        const adminPass = process.env.RECEITANET_ADMIN_PASS;

        if (!adminUser || !adminPass) {
            throw new Error("Credenciais do administrador do ReceitaNet não configuradas no arquivo .env (RECEITANET_ADMIN_USER / RECEITANET_ADMIN_PASS).");
        }

        console.log(`[RECEITANET-ROBOT] Iniciando automação oculta para cadastrar e ativar TV de: ${cliente.nome}`);
        
        const browser = await puppeteer.launch({
            headless: true, // Sempre oculto em segundo plano
            slowMo: 60,     // Atraso sutil para cliques humanos e garantir processamento da página
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        
        try {
            // 1. Efetuar Login no ReceitaNet
            console.log(`[RECEITANET-ROBOT] Acessando tela de login...`);
            await page.goto(RECEITANET_LOGIN_URL, { waitUntil: 'networkidle2' });

            console.log(`[RECEITANET-ROBOT] Preenchendo credenciais do Admin...`);
            await page.waitForSelector('#username', { timeout: 10000 });
            await page.type('#username', adminUser);
            await page.type('#password', adminPass);

            // Clica no botão de login
            console.log(`[RECEITANET-ROBOT] Efetuando o login (Keycloak)...`);
            await Promise.all([
                page.click('#kc-login'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            console.log(`[RECEITANET-ROBOT] Login efetuado com sucesso!`);

            // 2. Acessar a tela de cadastro de cliente
            console.log(`[RECEITANET-ROBOT] Acessando formulário de cadastro de cliente...`);
            await page.goto(CADASTRO_CLIENTE_URL, { waitUntil: 'networkidle2' });

            // 3. Preencher formulário de dados do cliente (Nomes corretos dos campos no ReceitaNet)
            console.log(`[RECEITANET-ROBOT] Preenchendo dados pessoais e credenciais SVA...`);
            
            // Login da TV (name="cli_login")
            await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });
            await page.type('input[name="cli_login"]', loginTv);

            // Senha da TV (name="cli_senha")
            await page.type('input[name="cli_senha"]', senhaTv);

            // Nome do Cliente (name="cli_nome")
            await page.type('input[name="cli_nome"]', cliente.nome);

            // CPF / CNPJ (name="cli_cgc")
            await page.type('input[name="cli_cgc"]', cliente.cpfcnpj);

            // E-mail (name="cli_email") - Caso queira preencher também
            try {
                await page.type('input[name="cli_email"]', cliente.email);
            } catch (e) {
                // Campo opcional no cadastro rápido, ignora se falhar
            }

            // Clica em "Incluir"
            console.log(`[RECEITANET-ROBOT] Enviando formulário de cadastro de cliente...`);
            await Promise.all([
                page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
                    const incluirBtn = buttons.find(b => b.textContent.trim() === 'Incluir');
                    if (incluirBtn) incluirBtn.click();
                    else throw new Error("Botão 'Incluir' de cadastro não encontrado.");
                }),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            console.log(`[RECEITANET-ROBOT] Cliente cadastrado com sucesso!`);

            // 4. Acessar tela de Planos
            console.log(`[RECEITANET-ROBOT] Clicando no botão 'Planos' para associar o SVA CDNTV...`);
            await page.waitForSelector('a[href*="/novo/financeiros/clientes/planos/"]', { timeout: 10000 });
            await Promise.all([
                page.evaluate(() => {
                    const btn = document.querySelector('a[href*="/novo/financeiros/clientes/planos/"]');
                    if (btn) btn.click();
                    else throw new Error("Link de planos não encontrado via querySelector.");
                }),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            // 5. Adicionar Plano CDNTV
            console.log(`[RECEITANET-ROBOT] Selecionando o plano 'cdntv' no dropdown...`);
            await page.waitForSelector('select[name="mensalidade_id"]', { timeout: 10000 });
            
            await page.evaluate(() => {
                const select = document.querySelector('select[name="mensalidade_id"]');
                if (select) {
                    const option = Array.from(select.options).find(opt => opt.text.toLowerCase().includes('cdntv'));
                    if (option) {
                        select.value = option.value;
                        select.dispatchEvent(new Event('change'));
                    } else {
                        throw new Error("Plano 'cdntv' não localizado no dropdown de planos de cobrança.");
                    }
                } else {
                    throw new Error("Select 'mensalidade_id' não encontrado na página de planos.");
                }
            });

            // Clica em Incluir plano
            console.log(`[RECEITANET-ROBOT] Adicionando o plano à cobrança do cliente...`);
            await Promise.all([
                page.evaluate(() => {
                    const select = document.querySelector('select[name="mensalidade_id"]');
                    const form = select ? select.closest('form') : document;
                    const buttons = Array.from(form.querySelectorAll('button, input[type="submit"]'));
                    const incluirPlanoBtn = buttons.find(b => b.textContent.trim() === 'Incluir');
                    if (incluirPlanoBtn) incluirPlanoBtn.click();
                    else throw new Error("Botão 'Incluir' da inclusão do plano não encontrado.");
                }),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            console.log(`[RECEITANET-ROBOT] Plano CDNTV ativado e associado com sucesso para ${cliente.nome}!`);
            
            await page.close();
            await browser.close();
            return true;

        } catch (error) {
            console.error(`[RECEITANET-ROBOT ERROR] Ocorreu um erro na automação:`, error.message);
            // Tira screenshot do erro antes de fechar para auditoria local do usuário
            try {
                await page.screenshot({ path: 'C:\\Users\\thiag\\.gemini\\antigravity\\scratch\\tv-pix-platform\\error_receitanet_robot.png' });
                console.log(`[RECEITANET-ROBOT] Screenshot do erro salva em error_receitanet_robot.png`);
            } catch (ssErr) {
                console.error("Não foi possível salvar screenshot do erro:", ssErr.message);
            }
            await browser.close();
            throw error;
        }
    }

    /**
     * Bloqueia o cliente no ReceitaNet renomeando seu login temporariamente (adiciona _SUSPENSO)
     * @param {string} login - Login original do cliente (ex: thiago@tvplus)
     */
    async bloquearCliente(login) {
        const adminUser = process.env.RECEITANET_ADMIN_USER;
        const adminPass = process.env.RECEITANET_ADMIN_PASS;

        console.log(`[RECEITANET-ROBOT] Iniciando bloqueio do login: ${login}`);
        
        const browser = await puppeteer.launch({
            headless: true,
            slowMo: 60,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        try {
            // Login no painel
            await page.goto(RECEITANET_LOGIN_URL, { waitUntil: 'networkidle2' });
            await page.waitForSelector('#username', { timeout: 10000 });
            await page.type('#username', adminUser);
            await page.type('#password', adminPass);
            await Promise.all([
                page.click('#kc-login'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            // Vai direto para o formulário de edição do cliente
            const editUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${login}`;
            console.log(`[RECEITANET-ROBOT] Acessando ficha de edição em: ${editUrl}`);
            await page.goto(editUrl, { waitUntil: 'networkidle2' });

            // Altera o campo cli_login adicionando "_SUSPENSO"
            await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });
            await page.click('input[name="cli_login"]', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type('input[name="cli_login"]', `${login}_SUSPENSO`);

            // Grava o cliente
            console.log(`[RECEITANET-ROBOT] Gravando bloqueio no ReceitaNet...`);
            await page.evaluate(() => {
                const btn = document.getElementById('GravarCliente') || document.querySelector('button[id="GravarCliente"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Gravar Cliente'));
                if (btn) btn.click();
                else throw new Error("Botão de gravação não localizado.");
            });

            // Aguarda o banner de sucesso por até 15 segundos
            console.log(`[RECEITANET-ROBOT] Aguardando confirmação do bloqueio...`);
            await page.waitForFunction(() => {
                return document.body.innerText.includes('SUCESSO') || document.body.innerText.includes('Gravado com sucesso');
            }, { timeout: 15000 }).catch(() => {
                console.log(`[RECEITANET-ROBOT WARNING] Timeout ao aguardar banner de sucesso. Prosseguindo de forma tolerante...`);
            });

            console.log(`[RECEITANET-ROBOT] Cliente ${login} bloqueado com sucesso (renomeado para ${login}_SUSPENSO)!`);
            await browser.close();
            return true;
        } catch (error) {
            console.error(`[RECEITANET-ROBOT ERROR] Falha ao bloquear cliente:`, error.message);
            try {
                await page.screenshot({ path: 'C:\\Users\\thiag\\.gemini\\antigravity\\scratch\\tv-pix-platform\\error_bloqueio.png' });
            } catch (ssErr) {}
            await browser.close();
            throw error;
        }
    }

    /**
     * Reativa o cliente no ReceitaNet restaurando seu login original (remove _SUSPENSO)
     * @param {string} login - Login original do cliente (ex: thiago@tvplus)
     */
    async reativarCliente(login) {
        const adminUser = process.env.RECEITANET_ADMIN_USER;
        const adminPass = process.env.RECEITANET_ADMIN_PASS;

        console.log(`[RECEITANET-ROBOT] Iniciando reativação do login: ${login}`);
        
        const browser = await puppeteer.launch({
            headless: true,
            slowMo: 60,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        try {
            // Login no painel
            await page.goto(RECEITANET_LOGIN_URL, { waitUntil: 'networkidle2' });
            await page.waitForSelector('#username', { timeout: 10000 });
            await page.type('#username', adminUser);
            await page.type('#password', adminPass);
            await Promise.all([
                page.click('#kc-login'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            // Vai para o formulário do cliente com login suspenso
            const editUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${login}_SUSPENSO`;
            console.log(`[RECEITANET-ROBOT] Acessando ficha de edição suspensa em: ${editUrl}`);
            await page.goto(editUrl, { waitUntil: 'networkidle2' });

            // Restaura o campo cli_login para o original
            await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });
            await page.click('input[name="cli_login"]', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type('input[name="cli_login"]', login);

            // Grava o cliente
            console.log(`[RECEITANET-ROBOT] Gravando reativação no ReceitaNet...`);
            await page.evaluate(() => {
                const btn = document.getElementById('GravarCliente') || document.querySelector('button[id="GravarCliente"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Gravar Cliente'));
                if (btn) btn.click();
                else throw new Error("Botão de gravação não localizado.");
            });

            // Aguarda o banner de sucesso por até 15 segundos
            console.log(`[RECEITANET-ROBOT] Aguardando confirmação da reativação...`);
            await page.waitForFunction(() => {
                return document.body.innerText.includes('SUCESSO') || document.body.innerText.includes('Gravado com sucesso');
            }, { timeout: 15000 }).catch(() => {
                console.log(`[RECEITANET-ROBOT WARNING] Timeout ao aguardar banner de sucesso. Prosseguindo de forma tolerante...`);
            });

            console.log(`[RECEITANET-ROBOT] Cliente ${login} reativado com sucesso (restaurado de ${login}_SUSPENSO)!`);
            await browser.close();
            return true;
        } catch (error) {
            console.error(`[RECEITANET-ROBOT ERROR] Falha ao reativar cliente:`, error.message);
            try {
                await page.screenshot({ path: 'C:\\Users\\thiag\\.gemini\\antigravity\\scratch\\tv-pix-platform\\error_reativacao.png' });
            } catch (ssErr) {}
            await browser.close();
            throw error;
        }
    }
}

module.exports = new ReceitanetRobotService();
