const puppeteer = require('puppeteer');
require('dotenv').config();

const RECEITANET_LOGIN_URL = 'https://sistema.receitanet.net/';
const CADASTRO_CLIENTE_URL = 'https://sistema.receitanet.net/clientes_cadastro.php';

class ReceitanetRobotService {
    async cadastrarEAtivarTV(cliente, loginTv, senhaTv) {
        const adminUser = process.env.RECEITANET_ADMIN_USER;
        const adminPass = process.env.RECEITANET_ADMIN_PASS;

        if (!adminUser || !adminPass) {
            throw new Error("Credenciais do administrador do ReceitaNet não configuradas no arquivo .env.");
        }

        console.log(`[RECEITANET-ROBOT] Iniciando criação e ativação do login SVA: ${loginTv}`);
        
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
            await page.goto(RECEITANET_LOGIN_URL, { waitUntil: 'networkidle2' });
            await page.waitForSelector('#username', { timeout: 10000 });
            await page.type('#username', adminUser);
            await page.type('#password', adminPass);
            await Promise.all([
                page.click('#kc-login'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            await page.goto(CADASTRO_CLIENTE_URL, { waitUntil: 'networkidle2' });
            await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });
            await page.type('input[name="cli_login"]', loginTv);
            await page.type('input[name="cli_senha"]', senhaTv);
            await page.type('input[name="cli_nome"]', cliente.nome);
            await page.type('input[name="cli_cgc"]', cliente.cpfcnpj);

            try {
                await page.type('input[name="cli_email"]', cliente.email);
            } catch (e) {}

            await Promise.all([
                page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
                    const incluirBtn = buttons.find(b => b.textContent.trim() === 'Incluir');
                    if (incluirBtn) incluirBtn.click();
                    else throw new Error("Botão 'Incluir' de cadastro não encontrado.");
                }),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            console.log(`[RECEITANET-ROBOT] Cliente cadastrado com sucesso! Associando plano CDNTV...`);

            const planoSelector = 'a[href*="/novo/financeiros/clientes/planos/"]';
            const btnPlano = await page.$(planoSelector);
            if (btnPlano) {
                await Promise.all([
                    btnPlano.click(),
                    page.waitForNavigation({ waitUntil: 'networkidle2' })
                ]);
                
                await page.waitForSelector('select', { timeout: 10000 });
                await page.evaluate(() => {
                    const selects = Array.from(document.querySelectorAll('select'));
                    const selectPlano = selects.find(s => Array.from(s.options).some(opt => opt.text.toUpperCase().includes('CDNTV') || opt.text.toUpperCase().includes('TV')));
                    if (selectPlano) {
                        const opt = Array.from(selectPlano.options).find(o => o.text.toUpperCase().includes('CDNTV') || o.text.toUpperCase().includes('TV'));
                        selectPlano.value = opt.value;
                        selectPlano.dispatchEvent(new Event('change'));
                    }
                });

                await Promise.all([
                    page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
                        const btnGravar = buttons.find(b => b.textContent.trim().includes('Gravar') || b.textContent.trim().includes('Adicionar'));
                        if (btnGravar) btnGravar.click();
                    }),
                    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {})
                ]);
            }

            await browser.close();
            return true;
        } catch (error) {
            console.error(`[RECEITANET-ROBOT ERROR] Falha no cadastro de cliente:`, error.message);
            await browser.close();
            throw error;
        }
    }

    async bloquearCliente(login, cpf, nome) {
        const adminUser = process.env.RECEITANET_ADMIN_USER;
        const adminPass = process.env.RECEITANET_ADMIN_PASS;
        const nuevoLogin = `${login}suspenso`;

        console.log(`[RECEITANET-ROBOT] Iniciando bloqueio do login: ${login} -> ${nuevoLogin} (CPF: ${cpf}, Nome: ${nome})`);
        
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
            await page.goto(RECEITANET_LOGIN_URL, { waitUntil: 'networkidle2' });
            await page.waitForSelector('#username', { timeout: 10000 });
            await page.type('#username', adminUser);
            await page.type('#password', adminPass);
            await Promise.all([
                page.click('#kc-login'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            // 1. Carrega a ficha oficial do cliente via busca input[name="search"] (permaneça na aba padrão DADOS PESSOAIS)
            await this.abrirFichaClienteReal(page, login, cpf, nome);

            // 2. Na aba padrão DADOS PESSOAIS, localiza o campo cli_login e altera para login + "suspenso"
            console.log(`[RECEITANET-ROBOT] Alterando campo cli_login na aba DADOS PESSOAIS para '${nuevoLogin}'...`);
            await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });
            
            await page.evaluate((targetNuevoLogin) => {
                const input = document.querySelector('input[name="cli_login"]');
                if (input) {
                    input.value = targetNuevoLogin;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    throw new Error("Campo cli_login não localizado na aba DADOS PESSOAIS.");
                }
            }, nuevoLogin);

            // 3. Submete o formulário com o botão vermelho 'Gravar no ReceitaNet + Servidor' (com atualizar=1)
            await this.salvarFormularioCliente(page);

            // 4. --- AUDITORIA DE CONFIRMAÇÃO DIRETA NO ERP ---
            console.log(`[RECEITANET-ROBOT AUDITORIA] Confirmando alteração diretamente no ERP para '${nuevoLogin}'...`);
            await this.abrirFichaClienteReal(page, nuevoLogin, cpf, nome);

            const verifyResult = await page.evaluate(() => {
                const loginInput = document.querySelector('input[name="cli_login"]');
                const nomeInput = document.querySelector('input[name="cli_nome"]');
                return {
                    login: loginInput ? loginInput.value : null,
                    nome: nomeInput ? nomeInput.value : null
                };
            });
            console.log(`[RECEITANET-ROBOT AUDITORIA] Resultado auditado no ERP (Aba Dados Pessoais): Login='${verifyResult.login}', Nome='${verifyResult.nome}'`);
            
            if (verifyResult.login !== nuevoLogin) {
                throw new Error(`[FALHA DE AUDITORIA ERP] O ERP rejeitou a alteração! Esperado login '${nuevoLogin}', mas no ERP consta '${verifyResult.login}'.`);
            }

            console.log(`[RECEITANET-ROBOT SUCCESS] AUDITADO E CONFIRMADO NO ERP: Cliente ${login} bloqueado com sucesso (renomeado para ${nuevoLogin})!`);
            await browser.close();
            return true;
        } catch (error) {
            console.error(`[RECEITANET-ROBOT ERROR] Falha ao bloquear cliente:`, error.message);
            await browser.close();
            throw error;
        }
    }

    async reativarCliente(login, cpf, nome) {
        const adminUser = process.env.RECEITANET_ADMIN_USER;
        const adminPass = process.env.RECEITANET_ADMIN_PASS;
        const loginSuspenso = `${login}suspenso`;

        console.log(`[RECEITANET-ROBOT] Iniciando reativação do login: ${loginSuspenso} -> ${login} (CPF: ${cpf}, Nome: ${nome})`);
        
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
            await page.goto(RECEITANET_LOGIN_URL, { waitUntil: 'networkidle2' });
            await page.waitForSelector('#username', { timeout: 10000 });
            await page.type('#username', adminUser);
            await page.type('#password', adminPass);
            await Promise.all([
                page.click('#kc-login'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            await this.abrirFichaClienteReal(page, loginSuspenso, cpf, nome);

            console.log(`[RECEITANET-ROBOT] Restaurando campo cli_login na aba DADOS PESSOAIS para '${login}'...`);
            await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });
            await page.evaluate((loginOriginal) => {
                const input = document.querySelector('input[name="cli_login"]');
                if (input) {
                    input.value = loginOriginal;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    throw new Error("Campo cli_login não localizado na aba DADOS PESSOAIS.");
                }
            }, login);

            await this.salvarFormularioCliente(page);

            // --- AUDITORIA DE CONFIRMAÇÃO DIRETA NO ERP ---
            console.log(`[RECEITANET-ROBOT AUDITORIA] Confirmando reativação diretamente no ERP para '${login}'...`);
            await this.abrirFichaClienteReal(page, login, cpf, nome);

            const verifyResult = await page.evaluate(() => {
                const loginInput = document.querySelector('input[name="cli_login"]');
                const nomeInput = document.querySelector('input[name="cli_nome"]');
                return {
                    login: loginInput ? loginInput.value : null,
                    nome: nomeInput ? nomeInput.value : null
                };
            });
            console.log(`[RECEITANET-ROBOT AUDITORIA] Resultado auditado no ERP pós-reativação: Login='${verifyResult.login}', Nome='${verifyResult.nome}'`);
            
            if (verifyResult.login !== login) {
                throw new Error(`[FALHA DE AUDITORIA ERP] O ERP rejeitou a reativação! Esperado login '${login}', mas no ERP consta '${verifyResult.login}'.`);
            }

            console.log(`[RECEITANET-ROBOT SUCCESS] AUDITADO E CONFIRMADO NO ERP: Cliente ${login} reativado com sucesso!`);
            await browser.close();
            return true;
        } catch (error) {
            console.error(`[RECEITANET-ROBOT ERROR] Falha ao reativar cliente:`, error.message);
            await browser.close();
            throw error;
        }
    }

    async excluirCliente(login, cpf, nome) {
        const adminUser = process.env.RECEITANET_ADMIN_USER;
        const adminPass = process.env.RECEITANET_ADMIN_PASS;

        console.log(`[RECEITANET-ROBOT] Iniciando exclusão completa do login: ${login} (CPF: ${cpf}, Nome: ${nome})`);
        
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

        page.on('dialog', async dialog => {
            console.log(`[RECEITANET-ROBOT] Caixa de diálogo detectada: "${dialog.message()}". Confirmando...`);
            await dialog.accept();
        });

        try {
            await page.goto(RECEITANET_LOGIN_URL, { waitUntil: 'networkidle2' });
            await page.waitForSelector('#username', { timeout: 10000 });
            await page.type('#username', adminUser);
            await page.type('#password', adminPass);
            await Promise.all([
                page.click('#kc-login'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            await this.abrirFichaClienteReal(page, login, cpf, nome);

            console.log(`[RECEITANET-ROBOT] Acessando tela de rescisão...`);
            await Promise.all([
                page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button, input, a')).find(b => b.textContent.trim().includes('Rescisão'));
                    if (btn) btn.click();
                    else throw new Error("Botão/aba 'Rescisão' não encontrado.");
                }),
                page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {})
            ]);

            console.log(`[RECEITANET-ROBOT] Selecionando motivo 'cancelado chip'...`);
            await page.waitForSelector('select', { timeout: 10000 });
            await page.evaluate(() => {
                const selects = Array.from(document.querySelectorAll('select'));
                const selectMotivo = selects.find(s => Array.from(s.options).some(o => o.text.toLowerCase().includes('chip')));
                if (selectMotivo) {
                    const opt = Array.from(selectMotivo.options).find(o => o.text.toLowerCase().includes('chip'));
                    selectMotivo.value = opt.value;
                    selectMotivo.dispatchEvent(new Event('change'));
                }
            });

            console.log(`[RECEITANET-ROBOT] Confirmando rescisão contratual...`);
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
                const btnGravar = buttons.find(b => b.textContent.trim().includes('Gravar') || b.textContent.trim().includes('Salvar') || b.textContent.trim().includes('Confirmar'));
                if (btnGravar) btnGravar.click();
            });

            await new Promise(r => setTimeout(r, 4000));
            console.log(`[RECEITANET-ROBOT] Cliente ${login} excluído e contrato rescindido no ReceitaNet!`);
            await browser.close();
            return true;
        } catch (error) {
            console.error(`[RECEITANET-ROBOT ERROR] Falha ao excluir cliente:`, error.message);
            await browser.close();
            throw error;
        }
    }

    /**
     * Carrega a ficha de edição real do cliente buscando na barra oficial do menu: input[name="search"] (placeholder="Nome/Login/Tel./CPF")
     */
    async abrirFichaClienteReal(page, login, cpf, nome) {
        console.log(`[RECEITANET-ROBOT] Buscando cliente na barra oficial input[name="search"]...`);
        
        if (!page.url().includes('receitanet.net')) {
            await page.goto(CADASTRO_CLIENTE_URL, { waitUntil: 'networkidle2' });
        }
        
        const searchSelector = 'input[name="search"], input[placeholder="Nome/Login/Tel./CPF"], input[title="Nome/Login/Tel./CPF"]';
        await page.waitForSelector(searchSelector, { timeout: 10000 });
        
        const termos = [login];
        if (nome) termos.push(nome.split(' ')[0]);
        if (cpf) {
            termos.push(cpf);
            const cpfLimpo = cpf.replace(/\D/g, '');
            if (cpfLimpo.length >= 11) termos.push(cpfLimpo);
        }
        
        let loaded = false;
        const dropdownSelector = 'ul.ui-autocomplete li.ui-menu-item, .ui-menu-item, .autocomplete-suggestion, li.ui-menu-item a';

        for (const termo of termos) {
            try {
                console.log(`[RECEITANET-ROBOT] Pesquisando termo '${termo}' na barra input[name="search"]...`);
                const inputSearch = await page.$(searchSelector);
                await inputSearch.click();
                
                await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    if (el) el.value = '';
                }, searchSelector);
                
                await inputSearch.type(termo);
                
                console.log(`[RECEITANET-ROBOT] Aguardando o menu suspenso ou resultado para '${termo}'...`);
                const hasDropdown = await page.waitForSelector(dropdownSelector, { timeout: 5000 }).then(() => true).catch(() => false);
                
                if (hasDropdown) {
                    console.log(`[RECEITANET-ROBOT] Sugestão encontrada! Clicando no resultado do menu suspenso...`);
                    await Promise.all([
                        page.click(dropdownSelector),
                        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 })
                    ]);
                } else {
                    console.log(`[RECEITANET-ROBOT] Pressionando Enter na barra input[name="search"]...`);
                    await Promise.all([
                        page.keyboard.press('Enter'),
                        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 })
                    ]);
                }
                
                loaded = true;
                console.log(`[RECEITANET-ROBOT] Ficha oficial com cli_id carregada com sucesso via input[name="search"]: ${page.url()}`);
                break;
            } catch (err) {
                console.log(`[RECEITANET-ROBOT WARNING] Termo '${termo}' no input[name="search"]: ${err.message}`);
            }
        }

        if (!loaded) {
            throw new Error(`Não foi possível localizar o cliente '${login}' no ERP usando input[name="search"].`);
        }
    }

    async salvarFormularioCliente(page) {
        console.log(`[RECEITANET-ROBOT] Submetendo formulário via AJAX com parâmetro 'atualizar=1' no botão vermelho...`);
        
        await page.evaluate(() => {
            const form = document.querySelector('form[name*="cli"], form[action*="cadastro"], form');
            if (form) {
                let inputAtualizar = form.querySelector('input[name="atualizar"]');
                if (!inputAtualizar) {
                    inputAtualizar = document.createElement('input');
                    inputAtualizar.type = 'hidden';
                    inputAtualizar.name = 'atualizar';
                    inputAtualizar.value = '1';
                    form.appendChild(inputAtualizar);
                } else {
                    inputAtualizar.value = '1';
                }
                
                const buttons = Array.from(form.querySelectorAll('button, input'));
                const btnRed = buttons.find(b => {
                    const txt = (b.textContent || b.value || '').trim();
                    return txt.includes('Servidor') && txt.includes('Gravar');
                }) || form.querySelector('button.btn-danger');
                
                const btnBlue = form.querySelector('button.btn-primary') || buttons.find(b => (b.textContent || b.value || '').includes('Gravar'));
                
                const targetBtn = btnRed || btnBlue;
                if (targetBtn) {
                    targetBtn.click();
                } else {
                    form.submit();
                }
            } else {
                throw new Error("Formulário principal do cliente não encontrado no DOM.");
            }
        });

        console.log(`[RECEITANET-ROBOT] Aguardando processamento da gravação assíncrona...`);
        await new Promise(r => setTimeout(r, 5000));
    }
}

module.exports = new ReceitanetRobotService();
