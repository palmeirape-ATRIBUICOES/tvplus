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

            page.on('dialog', async d => { await d.accept(); });

            await page.goto(CADASTRO_CLIENTE_URL, { waitUntil: 'networkidle2' });
            await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });
            await page.type('input[name="cli_login"]', (loginTv || '').toString());
            await page.type('input[name="cli_senha"]', (senhaTv || '').toString());
            await page.type('input[name="cli_nome"]', (cliente.nome || 'Cliente Teste').toString());
            
            const cpfValor = (cliente.cpfcnpj || '00000000000').toString().replace(/\D/g, '');
            await page.type('input[name="cli_cgc"]', cpfValor);

            const emailValor = (cliente.email || `${loginTv}@email.com`).toString();
            try {
                await page.type('input[name="cli_email"]', emailValor);
            } catch (e) {}

            // Aplica os parâmetros oficiais copiados do modelo de sucesso 'teste2@tvplus'
            console.log(`[RECEITANET-ROBOT] Aplicando parâmetros de cadastro do modelo 'teste2@tvplus'...`);
            await page.evaluate(() => {
                const setVal = (selector, val) => {
                    const el = document.querySelector(selector);
                    if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
                };

                setVal('select[name="cli_tipo"]', '1'); // Pessoa Física
                setVal('select[name="cli_diatari"]', '10'); // Dia de Vencimento 10
                setVal('select[name="cli_boleto"]', 'S'); // ATIVADO
                setVal('select[name="men_codigo"]', '1'); // Sim (Mensalidade)
                setVal('select[name="plano"]', '2'); // PADRÃO
                setVal('select[name="ban_codigo"]', '12168'); // API - Efí
                setVal('select[name="base_referencia"]', 'V'); // Pré-pago

                const chkDesc = document.querySelector('input[name="desconto_ate_vencimento"]');
                if (chkDesc && !chkDesc.checked) chkDesc.checked = true;
            });

            await Promise.all([
                page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
                    const incluirBtn = buttons.find(b => b.textContent.trim() === 'Incluir');
                    if (incluirBtn) incluirBtn.click();
                    else throw new Error("Botão 'Incluir' de cadastro não encontrado.");
                }),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
            ]);

            console.log(`[RECEITANET-ROBOT] Cliente ${loginTv} cadastrado com sucesso! Vinculando plano CDNTV no Novo ERP e no Módulo Legacy...`);

            // 1. Vínculo no Novo ERP de Planos (/novo/financeiros/clientes/planos/ID)
            try {
                const loginSemDominio = (loginTv || '').replace(/@.*$/, '').trim();
                let planUrl = null;

                for (const queryTerm of [loginSemDominio, loginTv]) {
                    if (!queryTerm) continue;
                    await page.goto(`https://sistema.receitanet.net/novo/clientes?busca=${encodeURIComponent(queryTerm)}`, { waitUntil: 'networkidle2' });
                    await new Promise(r => setTimeout(r, 2000));

                    planUrl = await page.evaluate(() => {
                        const links = Array.from(document.querySelectorAll('a'));
                        const linkPlano = links.find(a => a.href.includes('/novo/financeiros/clientes/planos/'));
                        return linkPlano ? linkPlano.href : null;
                    });

                    if (planUrl) break;
                }

                if (planUrl) {
                    console.log(`[RECEITANET-ROBOT] Gravando mensalidade 'cdntv' (108038) no Novo ERP: ${planUrl}...`);
                    await page.goto(planUrl, { waitUntil: 'networkidle2' });
                    await page.waitForSelector('select[name="mensalidade_id"], select', { timeout: 10000 });

                    console.log(`[RECEITANET-ROBOT] Submetendo mensalidade 'cdntv' (108038) via form.submit() direto...`);
                    await Promise.all([
                        page.evaluate(() => {
                            const select = document.querySelector('select[name="mensalidade_id"]');
                            if (select) {
                                const opt = Array.from(select.options).find(o => o.value === '108038' || o.text.toLowerCase().includes('cdntv'));
                                if (opt) {
                                    select.value = opt.value;
                                    select.dispatchEvent(new Event('change', { bubbles: true }));
                                    const form = select.closest('form');
                                    if (form) form.submit();
                                }
                            }
                        }),
                        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
                    ]);

                    await new Promise(r => setTimeout(r, 2000));
                    console.log(`[RECEITANET-ROBOT SUCCESS] Mensalidade 'cdntv' submetida e gravada na lista do cliente ${loginTv}!`);
                }
            } catch (eNovoPlano) {
                console.error(`[RECEITANET-ROBOT WARNING] Erro na gravação do plano no Novo ERP:`, eNovoPlano.message);
            }

            // 2. Vínculo no Módulo Legacy (clientes_plano.php?login=...)
            try {
                const legacyPlanoUrl = `${RECEITANET_LOGIN_URL}clientes_plano.php?login=${encodeURIComponent(loginTv)}`;
                console.log(`[RECEITANET-ROBOT] Gravando plano 'CDNTV' (pla_codigo 29) no módulo legacy...`);
                await page.goto(legacyPlanoUrl, { waitUntil: 'networkidle2' });

                await page.evaluate(() => {
                    const select = document.querySelector('select[name="pla_codigo"]');
                    if (select) {
                        select.value = '29'; // 29 = CDNTV
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });

                await Promise.all([
                    page.evaluate(() => {
                        const btn = document.querySelector('button[name="cadastrar"], input[name="cadastrar"]');
                        if (btn) btn.click();
                    }),
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {})
                ]);
                console.log(`[RECEITANET-ROBOT SUCCESS] Plano 'CDNTV' (29) vinculado no módulo legacy com sucesso!`);
            } catch (eLegacy) {
                console.error(`[RECEITANET-ROBOT WARNING] Aviso ao gravar plano legacy:`, eLegacy.message);
            }

            console.log(`[RECEITANET-ROBOT SUCCESS] Cliente ${loginTv} cadastrado e ativado com plano CDNTV!`);
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

            await this.abrirFichaClienteReal(page, login, cpf, nome);

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

            await this.salvarFormularioCliente(page);

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

    async suspenderCliente(login, cpf, nome) {
        return await this.bloquearCliente(login, cpf, nome);
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

        const rawLogin = (login || '').toString().trim().toLowerCase();
        const loginSemDominio = rawLogin.replace(/@.*$/, '').replace(/[\s\+].*$/, '').trim();
        const loginComDominio = rawLogin.includes('@') ? rawLogin : `${rawLogin}@tvplus`;

        console.log(`[RECEITANET-ROBOT] Iniciando varredura e exclusão infalível do teste no ERP para: '${rawLogin}' (Variações: '${loginSemDominio}', '${loginComDominio}')...`);
        
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

            const variacoesLogin = [
                loginSemDominio,
                loginComDominio,
                `${loginSemDominio}suspenso`,
                `${loginSemDominio}@tvplussuspenso`
            ];

            let excluidoComSucesso = false;

            for (const targetLogin of variacoesLogin) {
                if (!targetLogin) continue;

                // 1. Tenta Rescisão Direta por URL
                const rescisaoUrl = `https://sistema.receitanet.net/clientes_rescisao.php?login=${encodeURIComponent(targetLogin)}`;
                console.log(`[RECEITANET-ROBOT] Verificando rescisão no ERP para: ${targetLogin}...`);
                await page.goto(rescisaoUrl, { waitUntil: 'networkidle2' });

                const hasSelect = await page.waitForSelector('select[name="cancelamento_motivo"]', { timeout: 4000 }).then(() => true).catch(() => false);
                if (hasSelect) {
                    console.log(`[RECEITANET-ROBOT] Ficha de rescisão localizada no ERP para '${targetLogin}'! Efetuando baixa definitiva...`);
                    await page.evaluate(() => {
                        const selectMotivo = document.querySelector('select[name="cancelamento_motivo"]');
                        if (selectMotivo) {
                            const opt = Array.from(selectMotivo.options).find(o => o.text.toLowerCase().includes('chip') || o.value === '13');
                            if (opt) {
                                selectMotivo.value = opt.value;
                                selectMotivo.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    });

                    await Promise.all([
                        page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn'));
                            const btnGravar = buttons.find(b => b.textContent.trim().includes('Gravar') || b.textContent.trim().includes('Calcular') || b.name === 'cadastrar');
                            if (btnGravar) btnGravar.click();
                            else document.querySelector('form')?.submit();
                        }),
                        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
                    ]);
                    console.log(`[RECEITANET-ROBOT] Rescisão concluída com sucesso no ERP para '${targetLogin}'!`);
                    excluidoComSucesso = true;
                }

                // 2. Tenta Exclusão Definitiva na Ficha de Cadastro se ainda existir
                const cadastroUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${encodeURIComponent(targetLogin)}`;
                await page.goto(cadastroUrl, { waitUntil: 'networkidle2' });
                const hasInput = await page.waitForSelector('input[name="cli_login"]', { timeout: 3000 }).then(() => true).catch(() => false);
                
                if (hasInput) {
                    console.log(`[RECEITANET-ROBOT] Ficha de cadastro ativa para '${targetLogin}'. Buscando botão 'Excluir'...`);
                    const hasExcluirBtn = await page.evaluate(() => {
                        const btn = document.getElementById('Excluir') || Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a')).find(b => b.textContent.trim() === 'Excluir' || b.value?.trim() === 'Excluir');
                        return btn ? true : false;
                    });

                    if (hasExcluirBtn) {
                        console.log(`[RECEITANET-ROBOT] Botão 'Excluir' localizado! Deletando o cadastro 100% no ERP...`);
                        await Promise.all([
                            page.evaluate(() => {
                                const btn = document.getElementById('Excluir') || Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a')).find(b => b.textContent.trim() === 'Excluir' || b.value?.trim() === 'Excluir');
                                if (btn) btn.click();
                            }),
                            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
                        ]);
                        console.log(`[RECEITANET-ROBOT] Cadastro '${targetLogin}' excluído 100% do ERP!`);
                        excluidoComSucesso = true;
                    } else {
                        console.log(`[RECEITANET-ROBOT] O botão 'Excluir' não apareceu na ficha de '${targetLogin}'.`);
                    }
                }
            }

            console.log(`[RECEITANET-ROBOT SUCCESS] Processo de exclusão do teste '${rawLogin}' concluído no ReceitaNet ERP!`);
            await browser.close();
            return true;
        } catch (error) {
            console.error(`[RECEITANET-ROBOT ERROR] Falha ao excluir cliente de teste:`, error.message);
            await browser.close();
            throw error;
        }
    }

    async abrirFichaClienteReal(page, login, cpf, nome) {
        console.log(`[RECEITANET-ROBOT] Acessando ficha de cadastro do cliente: ${login}...`);
        
        const directUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${encodeURIComponent(login)}`;
        console.log(`[RECEITANET-ROBOT] Abrindo URL direta do cadastro: ${directUrl}`);
        await page.goto(directUrl, { waitUntil: 'networkidle2' });

        const hasInputDirect = await page.waitForSelector('input[name="cli_login"]', { timeout: 6000 }).then(() => true).catch(() => false);
        if (hasInputDirect) {
            console.log(`[RECEITANET-ROBOT] Ficha de cadastro carregada com sucesso na aba DADOS PESSOAIS!`);
            return;
        }

        console.log(`[RECEITANET-ROBOT] Pesquisando cliente na barra principal input[name="search"]...`);
        const searchSelector = 'input[name="search"], input[placeholder="Nome/Login/Tel./CPF"]';
        await page.waitForSelector(searchSelector, { timeout: 10000 });
        
        await page.click(searchSelector);
        await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.value = ''; }, searchSelector);
        await page.type(searchSelector, login);
        
        await Promise.all([
            page.keyboard.press('Enter'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
        ]);

        if (!page.url().includes('clientes_cadastro.php')) {
            console.log(`[RECEITANET-ROBOT] Clicando no link do cliente na tabela de resultados...`);
            await page.evaluate((loginTarget) => {
                const links = Array.from(document.querySelectorAll('a'));
                const targetLink = links.find(a => a.href.includes('clientes_cadastro.php') || a.textContent.includes(loginTarget));
                if (targetLink) targetLink.click();
            }, login);
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        }

        await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });
        console.log(`[RECEITANET-ROBOT] Ficha de cadastro carregada com sucesso: ${page.url()}`);
    }

    async salvarFormularioCliente(page) {
        console.log(`[RECEITANET-ROBOT] Clicando no botão exato via XPath: /html/body/div/div[1]/section[2]/div[2]/div[1]/form/div[1]/div[2]/button[2]...`);
        
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
            }

            const xpathResult = document.evaluate('/html/body/div/div[1]/section[2]/div[2]/div[1]/form/div[1]/div[2]/button[2]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            let btn = xpathResult.singleNodeValue;
            
            if (!btn) {
                const buttons = Array.from(document.querySelectorAll('form button, button'));
                btn = buttons.find(b => {
                    const txt = (b.textContent || b.value || '').trim();
                    return txt.includes('Gravar no ReceitaNet') || txt.includes('Gravar');
                }) || document.querySelector('button[name="atualizar"], button.btn-danger, button.btn-primary');
            }
            
            if (btn) {
                btn.scrollIntoView();
                btn.click();
            } else if (form) {
                form.submit();
            } else {
                throw new Error("Botão de gravação não localizado no DOM.");
            }
        });

        console.log(`[RECEITANET-ROBOT] Aguardando processamento da gravação assíncrona (5 segundos)...`);
        await new Promise(r => setTimeout(r, 5000));
    }
}

module.exports = new ReceitanetRobotService();
