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
        
        const launchOptions = {
            headless: true, // Sempre oculto em segundo plano
            slowMo: 60,     // Atraso sutil para cliques humanos e garantir processamento da página
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };

        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }

        const browser = await puppeteer.launch(launchOptions);

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
        
        const launchOptions = {
            headless: true,
            slowMo: 60,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };

        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }

        const browser = await puppeteer.launch(launchOptions);
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

            // Localiza e abre a ficha de edição real do cliente no ReceitaNet
            const editUrl = await this.localizarEAbriFichaCliente(page, login);

            // Altera o campo cli_login adicionando "_SUSPENSO" diretamente pelo DOM (100% imune a problemas de teclado headless)
            await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });
            await page.evaluate((loginOriginal) => {
                const input = document.querySelector('input[name="cli_login"]');
                if (input) {
                    input.value = `${loginOriginal}_SUSPENSO`;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    throw new Error("Campo cli_login não localizado na página para alteração.");
                }
            }, login);

            // Grava o cliente e atualiza o Servidor Radius (botão vermelho) para cortar o sinal na hora
            console.log(`[RECEITANET-ROBOT] Gravando bloqueio no ReceitaNet + Servidor...`);
            await Promise.all([
                page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, input, a'));
                    const btnServidor = buttons.find(b => b.textContent.trim().includes('Servidor'));
                    const btnDefault = document.getElementById('GravarCliente') || buttons.find(b => b.textContent.trim().includes('Gravar no ReceitaNet'));
                    
                    const btn = btnServidor || btnDefault;
                    if (btn) btn.click();
                    else throw new Error("Botão de gravação não localizado.");
                }),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
            ]);

            // Delay de segurança de 3 segundos para garantir a gravação no banco do ReceitaNet
            console.log(`[RECEITANET-ROBOT] Aguardando gravação física no ERP...`);
            await new Promise(resolve => setTimeout(resolve, 3000));

            console.log(`[RECEITANET-ROBOT] Cliente ${login} bloqueado com sucesso (renomeado para ${login}_SUSPENSO e sincronizado com o Servidor)!`);
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
        
        const launchOptions = {
            headless: true,
            slowMo: 60,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };

        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }

        const browser = await puppeteer.launch(launchOptions);
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

            // Localiza e abre a ficha de edição real do cliente suspenso no ReceitaNet
            const editUrl = await this.localizarEAbriFichaCliente(page, login);

            // Restaura o campo cli_login para o original diretamente pelo DOM (100% imune a problemas de teclado headless)
            await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });
            await page.evaluate((loginOriginal) => {
                const input = document.querySelector('input[name="cli_login"]');
                if (input) {
                    input.value = loginOriginal;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    throw new Error("Campo cli_login não localizado na página para alteração.");
                }
            }, login);

            // Grava o cliente e atualiza o Servidor Radius (botão vermelho) para liberar o sinal na hora
            console.log(`[RECEITANET-ROBOT] Gravando reativação no ReceitaNet + Servidor...`);
            await Promise.all([
                page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, input, a'));
                    const btnServidor = buttons.find(b => b.textContent.trim().includes('Servidor'));
                    const btnDefault = document.getElementById('GravarCliente') || buttons.find(b => b.textContent.trim().includes('Gravar no ReceitaNet'));
                    
                    const btn = btnServidor || btnDefault;
                    if (btn) btn.click();
                    else throw new Error("Botão de gravação não localizado.");
                }),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
            ]);

            // Delay de segurança de 3 segundos para garantir a gravação no banco do ReceitaNet
            console.log(`[RECEITANET-ROBOT] Aguardando gravação física no ERP...`);
            await new Promise(resolve => setTimeout(resolve, 3000));

            console.log(`[RECEITANET-ROBOT] Cliente ${login} reativado com sucesso (restaurado de ${login}_SUSPENSO e sincronizado com o Servidor)!`);
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

    /**
     * Efetua a rescisão contratual (cancelado chip) e exclui o cliente do ReceitaNet
     * @param {string} login - Login original do cliente
     */
    async excluirCliente(login) {
        const adminUser = process.env.RECEITANET_ADMIN_USER;
        const adminPass = process.env.RECEITANET_ADMIN_PASS;

        console.log(`[RECEITANET-ROBOT] Iniciando exclusão completa do login: ${login}`);
        
        const launchOptions = {
            headless: true,
            slowMo: 60,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };

        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }

        const browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();

        // Handler para aceitar automaticamente popups de confirmação do navegador
        page.on('dialog', async dialog => {
            console.log(`[RECEITANET-ROBOT] Caixa de diálogo detectada: "${dialog.message()}". Confirmando...`);
            await dialog.accept();
        });

        try {
            // 1. Login no painel
            await page.goto(RECEITANET_LOGIN_URL, { waitUntil: 'networkidle2' });
            await page.waitForSelector('#username', { timeout: 10000 });
            await page.type('#username', adminUser);
            await page.type('#password', adminPass);
            await Promise.all([
                page.click('#kc-login'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            // 2. Localiza e abre a ficha do cliente real no ReceitaNet
            const editUrl = await this.localizarEAbriFichaCliente(page, login);

            // 3. Clica em "Rescisão" (ou botão correspondente)
            console.log(`[RECEITANET-ROBOT] Acessando tela de rescisão...`);
            await Promise.all([
                page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button, input, a')).find(b => b.textContent.trim().includes('Rescisão'));
                    if (btn) btn.click();
                    else throw new Error("Botão/aba 'Rescisão' não encontrado.");
                }),
                page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {})
            ]);

            // 4. Seleciona o motivo "cancelado chip" no select dropdown
            console.log(`[RECEITANET-ROBOT] Selecionando motivo 'cancelado chip'...`);
            await page.waitForSelector('select', { timeout: 10000 });
            await page.evaluate(() => {
                const select = document.querySelector('select');
                if (select) {
                    const option = Array.from(select.options).find(o => o.text.toLowerCase().includes('cancelado chip'));
                    if (option) {
                        select.value = option.value;
                        select.dispatchEvent(new Event('change'));
                    } else {
                        throw new Error("Opção 'cancelado chip' não localizada no select de motivos.");
                    }
                } else {
                    throw new Error("Select de motivo de rescisão não localizado.");
                }
            });

            // 5. Escreve "ok" em detalhes
            console.log(`[RECEITANET-ROBOT] Preenchendo campo de detalhes com 'ok'...`);
            await page.evaluate(() => {
                const input = document.querySelector('textarea') || document.querySelector('input[name="detalhe"]') || document.querySelector('input[name="observacao"]');
                if (input) {
                    input.value = 'ok';
                    input.dispatchEvent(new Event('input'));
                } else {
                    throw new Error("Campo de detalhe da rescisão não localizado.");
                }
            });

            // 6. Clica em "CALCULAR"
            console.log(`[RECEITANET-ROBOT] Clicando em CALCULAR...`);
            await Promise.all([
                page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button, input[type="submit"], a')).find(b => b.textContent.trim().toUpperCase().includes('CALCULAR'));
                    if (btn) btn.click();
                    else throw new Error("Botão 'CALCULAR' não localizado.");
                }),
                page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {})
            ]);

            // 7. Retorna para a tela do cliente
            console.log(`[RECEITANET-ROBOT] Retornando para a ficha do cliente...`);
            await page.goto(editUrl, { waitUntil: 'networkidle2' });

            // 8. Clica em "Excluir"
            console.log(`[RECEITANET-ROBOT] Clicando no botão 'Excluir'...`);
            await page.waitForSelector('button', { timeout: 10000 });
            await Promise.all([
                page.evaluate(() => {
                    const btn = document.getElementById('Excluir') || Array.from(document.querySelectorAll('button, input, a')).find(b => b.textContent.trim() === 'Excluir');
                    if (btn) btn.click();
                    else throw new Error("Botão 'Excluir' não localizado.");
                }),
                page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {})
            ]);

            console.log(`[RECEITANET-ROBOT] Cliente ${login} rescindido e excluído com sucesso do ReceitaNet!`);
            await browser.close();
            return true;

        } catch (error) {
            console.error(`[RECEITANET-ROBOT ERROR] Falha ao excluir cliente:`, error.message);
            try {
                await page.screenshot({ path: 'C:\\Users\\thiag\\.gemini\\antigravity\\scratch\\tv-pix-platform\\error_exclusao.png' });
            } catch (ssErr) {}
            await browser.close();
            throw error;
        }
    }

    /**
     * Localiza o cliente no ReceitaNet pela tabela de listagem ou pela busca global e abre a ficha de edição
     */
    async localizarEAbriFichaCliente(page, login) {
        let loadedFicha = false;
        
        try {
            console.log(`[RECEITANET-ROBOT] Buscando cliente '${login}' na listagem de clientes...`);
            await page.goto('https://sistema.receitanet.net/clientes.php', { waitUntil: 'networkidle2', timeout: 20000 });
            
            // Tenta localizar a busca da tabela
            const tableSearch = await page.$('input[type="search"], input[name="busca"], #pesquisa');
            if (tableSearch) {
                await tableSearch.click();
                await page.evaluate((el) => { el.value = ''; }, tableSearch);
                await tableSearch.type(login);
                await new Promise(r => setTimeout(r, 2000));
            }
            
            // Clica no link com o login correspondente na tabela
            await Promise.all([
                page.evaluate((targetLogin) => {
                    const links = Array.from(document.querySelectorAll('a'));
                    const link = links.find(l => {
                        const txt = l.textContent.trim();
                        return txt === targetLogin || 
                               txt === `${targetLogin}_SUSPENSO` || 
                               txt.includes(targetLogin);
                    });
                    if (link) link.click();
                    else throw new Error("Link com o login correspondente não encontrado na tabela.");
                }, login),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 })
            ]);
            loadedFicha = true;
            console.log(`[RECEITANET-ROBOT] Ficha carregada via listagem de clientes: ${page.url()}`);
        } catch (tblErr) {
            console.log(`[RECEITANET-ROBOT WARNING] Falha ao achar pela listagem (${tblErr.message}). Tentando busca global por autocomplete...`);
        }
        
        if (!loadedFicha) {
            console.log(`[RECEITANET-ROBOT] Buscando cliente '${login}' pela busca global...`);
            await page.goto(CADASTRO_CLIENTE_URL, { waitUntil: 'networkidle2' });
            
            const searchSelector = 'input[placeholder*="Nome/Login"], input[placeholder*="Digite o Nome"], input.input';
            await page.waitForSelector(searchSelector, { timeout: 10000 });
            await page.click(searchSelector);
            await page.type(searchSelector, login);
            await new Promise(r => setTimeout(r, 3000));
            
            await page.keyboard.press('ArrowDown');
            await new Promise(r => setTimeout(r, 500));
            
            await Promise.all([
                page.keyboard.press('Enter'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 })
            ]);
            console.log(`[RECEITANET-ROBOT] Ficha carregada via busca global por autocomplete: ${page.url()}`);
        }
        
        return page.url();
    }
}

module.exports = new ReceitanetRobotService();
