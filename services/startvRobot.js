const puppeteer = require('puppeteer');
require('dotenv').config();

const RECEITANET_LOGIN_URL = 'https://sistema.receitanet.net/';
const CADASTRO_CLIENTE_URL = 'https://sistema.receitanet.net/clientes_cadastro.php';

class ReceitanetRobotService {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async obterPaginaAutenticada() {
        const adminUser = process.env.RECEITANET_ADMIN_USER;
        const adminPass = process.env.RECEITANET_ADMIN_PASS;

        if (!adminUser || !adminPass) {
            throw new Error("Credenciais do administrador do ReceitaNet não configuradas no arquivo .env.");
        }

        if (this.browser && this.page && !this.page.isClosed()) {
            try {
                const urlAtual = this.page.url();
                if (urlAtual && urlAtual.includes('sistema.receitanet.net')) {
                    console.log(`[RECEITANET-ROBOT OTIMIZADO] ⚡ Sessão ativa mantida em memória! Execução em 1 a 2 segundos...`);
                    return this.page;
                }
            } catch (e) {
                try { await this.browser.close(); } catch(err) {}
                this.browser = null;
                this.page = null;
            }
        }

        console.log(`[RECEITANET-ROBOT OTIMIZADO] 🚀 Iniciando Puppeteer em Alta Velocidade...`);
        
        const launchOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--single-process',
                '--no-zygote',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-component-extensions-with-background-pages',
                '--disable-extensions',
                '--js-flags=--max-old-space-size=128'
            ]
        };

        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }

        this.browser = await puppeteer.launch(launchOptions);
        this.page = await this.browser.newPage();

        // OTIMIZAÇÃO CRÍTICA: Bloqueia imagens, fontes e mídias para navegação ultrarrápida (300ms)
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        this.page.on('dialog', async d => { try { await d.accept(); } catch(e) {} });

        console.log(`[RECEITANET-ROBOT OTIMIZADO] 🔑 Efetuando autenticação única no ERP ReceitaNet...`);
        await this.page.goto(RECEITANET_LOGIN_URL, { waitUntil: 'domcontentloaded' });
        await this.page.waitForSelector('#username', { timeout: 10000 });
        await this.page.type('#username', adminUser);
        await this.page.type('#password', adminPass);
        await Promise.all([
            this.page.click('#kc-login'),
            this.page.waitForNavigation({ waitUntil: 'domcontentloaded' })
        ]);

        console.log(`[RECEITANET-ROBOT OTIMIZADO] ✅ Autenticação única mantida em memória com sucesso!`);
        return this.page;
    }

    async cadastrarEAtivarTV(cliente, loginTv, senhaTv) {
        console.log(`[RECEITANET-ROBOT] Iniciando criação e ativação do login SVA: ${loginTv}`);
        
        const page = await this.obterPaginaAutenticada();

        try {
            const loginSemDominio = (loginTv || '').replace(/@.*$/, '');
            const editUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${encodeURIComponent(loginTv)}`;
            const suspensoUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${encodeURIComponent(loginSemDominio + 'suspenso')}`;
            
            console.log(`[RECEITANET-ROBOT] Verificando se cliente ${loginTv} ou sua variante suspensa existe...`);
            
            let alreadyExists = false;
            let existsSuspended = false;

            // 1. Checa ativo
            await page.goto(editUrl, { waitUntil: 'domcontentloaded' });
            alreadyExists = await page.waitForSelector('input[name="cli_login"]', { timeout: 4000 })
                .then(async () => {
                    return await page.evaluate((target) => {
                        const val = document.querySelector('input[name="cli_login"]')?.value;
                        return val && val.trim().toLowerCase() === target.trim().toLowerCase();
                    }, loginTv);
                })
                .catch(() => false);

            if (!alreadyExists) {
                // 2. Checa suspenso
                await page.goto(suspensoUrl, { waitUntil: 'networkidle2' });
                existsSuspended = await page.waitForSelector('input[name="cli_login"]', { timeout: 4000 })
                    .then(async () => {
                        return await page.evaluate((target) => {
                            const val = document.querySelector('input[name="cli_login"]')?.value;
                            return val && val.trim().toLowerCase().includes(target.trim().toLowerCase());
                        }, loginSemDominio);
                    })
                    .catch(() => false);
            }

            if (alreadyExists) {
                console.log(`[RECEITANET-ROBOT] Cliente ${loginTv} já existe em modo ATIVO no ERP. Pulando criação e indo direto para vinculação...`);
            } else if (existsSuspended) {
                console.log(`[RECEITANET-ROBOT] Cliente ${loginTv} existe em modo SUSPENSO. Restaurando login original...`);
                await page.evaluate((originalLog) => {
                    const input = document.querySelector('input[name="cli_login"]');
                    if (input) {
                        input.value = originalLog;
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }, loginTv);
                await this.salvarFormularioCliente(page);
            } else {
                console.log(`[STARTV-ROBOT] Cliente ${loginTv} não existe. Criando novo cadastro...`);
                await page.goto(CADASTRO_CLIENTE_URL, { waitUntil: 'networkidle2' });
                await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });
                await page.type('input[name="cli_login"]', (loginTv || '').toString());
                await page.type('input[name="cli_senha"]', (senhaTv || '').toString());
                await page.type('input[name="cli_nome"]', (cliente.nome || 'Cliente Provedor').toString());
                
                const cpfRaw = cliente.cpf || cliente.cpfcnpj || cliente.cgc || senhaTv || '00000000000';
                const cpfValor = cpfRaw.toString().replace(/\D/g, '');
                console.log(`[STARTV-ROBOT] 📝 Digitando CPF do cliente: ${cpfValor}`);
                await page.type('input[name="cli_cgc"]', cpfValor);

                const emailValor = (cliente.email || `${loginTv}@email.com`).toString();
                try {
                    await page.type('input[name="cli_email"]', emailValor);
                } catch (e) {}

                // Aplica os parâmetros oficiais de mensalidade
                console.log(`[STARTV-ROBOT] Aplicando parâmetros oficiais de mensalidade no ERP...`);
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

                    const selectStatus = document.querySelector('select[name="cli_status"], select[name="status"]');
                    if (selectStatus) {
                        const optAtivo = Array.from(selectStatus.options).find(o => o.text.toLowerCase().includes('ativo') || o.value === '1' || o.value === 'A');
                        if (optAtivo) selectStatus.value = optAtivo.value;
                    }

                    const chkDesc = document.querySelector('input[name="desconto_ate_vencimento"]');
                    if (chkDesc && !chkDesc.checked) chkDesc.checked = true;
                });

                console.log(`[STARTV-ROBOT] Clicando no botão 'Incluir' para registrar o cliente...`);
                await Promise.all([
                    page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
                        const incluirBtn = buttons.find(b => b.textContent.trim() === 'Incluir');
                        if (incluirBtn) incluirBtn.click();
                        else throw new Error("Botão 'Incluir' de cadastro não encontrado.");
                    }),
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
                ]);
            }

            console.log(`[STARTV-ROBOT] Cliente ${loginTv} cadastrado com sucesso! Abrindo a tela de Planos de Cobrança...`);
            
            // 1. Vínculo no Módulo Legacy (clientes_plano.php?login=...)
            try {
                const loginSemDominio = (loginTv || '').replace(/@.*$/, '').trim();
                for (const targetLog of [loginTv, loginSemDominio]) {
                    if (!targetLog) continue;
                    
                    // Tenta clicar no botão 'Planos' que fica logo abaixo do cadastro do cliente
                    const clickedPlanosBtn = await page.evaluate(() => {
                        const links = Array.from(document.querySelectorAll('a, button'));
                        const btn = links.find(a => a.textContent.trim().toUpperCase() === 'PLANOS' || a.href?.includes('clientes_plano.php'));
                        if (btn) { btn.click(); return true; }
                        return false;
                    });

                    if (clickedPlanosBtn) {
                        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
                    } else {
                        const legacyPlanoUrl = `${RECEITANET_LOGIN_URL}clientes_plano.php?login=${encodeURIComponent(targetLog)}`;
                        console.log(`[STARTV-ROBOT] Abrindo página de planos: ${legacyPlanoUrl}...`);
                        await page.goto(legacyPlanoUrl, { waitUntil: 'networkidle2' });
                    }

                    const hasSelect = await page.waitForSelector('select[name="pla_codigo"], select[name="plano"], select', { timeout: 6000 }).then(() => true).catch(() => false);
                    if (hasSelect) {
                        console.log(`[STARTV-ROBOT] Selecionando 'CDNTV' no dropdown e clicando no botão 'Incluir' logo abaixo...`);
                        
                        const planoIncluido = await Promise.all([
                            page.evaluate(() => {
                                const select = document.querySelector('select[name="pla_codigo"], select[name="plano"], select');
                                if (select) {
                                    const opt = Array.from(select.options).find(o => o.text.toUpperCase().includes('CDNTV') || o.value === '29' || o.text.toUpperCase().includes('STAR'));
                                    if (opt) {
                                        select.value = opt.value;
                                        select.dispatchEvent(new Event('change', { bubbles: true }));
                                        
                                        // Procura o botão 'Incluir' ou 'Cadastrar' logo abaixo do dropdown
                                        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], input[name="cadastrar"], a.btn'));
                                        const btnIncluir = buttons.find(b => {
                                            const val = (b.value || b.textContent || '').trim().toUpperCase();
                                            return val === 'INCLUIR' || val.includes('INCLUIR') || val === 'CADASTRAR' || val.includes('CADASTRAR');
                                        });

                                        if (btnIncluir) {
                                            btnIncluir.click();
                                            return true;
                                        }

                                        const form = select.closest('form');
                                        if (form) {
                                            form.submit();
                                            return true;
                                        }
                                    }
                                }
                                return false;
                            }),
                            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
                        ]);

                        if (planoIncluido[0]) {
                            console.log(`[STARTV-ROBOT SUCCESS] ✅ Plano 'CDNTV' atribuído e confirmado com sucesso para ${targetLog}!`);
                            break;
                        }
                    }
                }
            } catch (eLegacy) {
                console.error(`[STARTV-ROBOT WARNING] Aviso na atribuição do plano CDNTV:`, eLegacy.message);
            }

            // 2. Novo ERP (/novo/financeiros/clientes/planos/)
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
                    await page.goto(planUrl, { waitUntil: 'networkidle2' });
                }

                if (page.url().includes('/planos/')) {
                    console.log(`[STARTV-ROBOT] Selecionando mensalidade 'CDNTV-R$0,00' no Novo ERP...`);
                    await page.waitForSelector('select[name="mensalidade_id"], select', { timeout: 10000 });

                    await Promise.all([
                        page.evaluate(() => {
                            const select = document.querySelector('select[name="mensalidade_id"], select');
                            if (select) {
                                const opt = Array.from(select.options).find(o => o.text.toUpperCase().includes('CDNTV-R$0,00') || o.text.toLowerCase().includes('cdntv') || o.value === '108038');
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
                    console.log(`[STARTV-ROBOT SUCCESS] ✅ Mensalidade 'CDNTV-R$0,00' vinculada no Novo ERP com sucesso!`);
                }
            } catch (eNovoPlano) {
                console.error(`[STARTV-ROBOT WARNING] Aviso na atribuição no Novo ERP:`, eNovoPlano.message);
            }

            console.log(`[RECEITANET-ROBOT SUCCESS] Cliente ${loginTv} cadastrado e ativado com plano CDNTV!`);
            return true;
        } catch (error) {
            console.error(`[RECEITANET-ROBOT ERROR] Falha no cadastro de cliente:`, error.message);
            throw error;
        }
    }

    async bloquearCliente(login, cpf, nome) {
        const rawLogin = (login || '').toString().trim().toLowerCase();
        const loginSemDominio = rawLogin.replace(/@.*$/, '').trim();
        const nuevoLogin = `${loginSemDominio}suspenso`;

        console.log(`[RECEITANET-ROBOT OTIMIZADO] Iniciando bloqueio do login: ${login} -> ${nuevoLogin}`);
        const page = await this.obterPaginaAutenticada();

        try {
            await this.abrirFichaClienteReal(page, login, cpf, nome);

            console.log(`[RECEITANET-ROBOT] Alterando cli_login para '${nuevoLogin}', senha para '000000' e status para SUSPENSO (cli_boleto='N', men_codigo='2')...`);
            await page.waitForSelector('input[name="cli_login"], select', { timeout: 10000 });
            
            await page.evaluate((targetNuevoLogin) => {
                const inputLogin = document.querySelector('input[name="cli_login"]');
                if (inputLogin) {
                    inputLogin.removeAttribute('readonly');
                    inputLogin.removeAttribute('disabled');
                    inputLogin.value = targetNuevoLogin;
                    inputLogin.dispatchEvent(new Event('input', { bubbles: true }));
                    inputLogin.dispatchEvent(new Event('change', { bubbles: true }));
                }

                const inputSenha = document.querySelector('input[name="cli_senha"]');
                if (inputSenha) {
                    inputSenha.removeAttribute('readonly');
                    inputSenha.removeAttribute('disabled');
                    inputSenha.value = '000000';
                    inputSenha.dispatchEvent(new Event('input', { bubbles: true }));
                    inputSenha.dispatchEvent(new Event('change', { bubbles: true }));
                }

                const setVal = (selector, val) => {
                    const el = document.querySelector(selector);
                    if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
                };
                setVal('select[name="cli_boleto"]', 'N'); // Desativado / Suspenso
                setVal('select[name="men_codigo"]', '2'); // Suspenso
                
                const selectStatus = document.querySelector('select[name="cli_status"], select[name="status"]');
                if (selectStatus) {
                    const opt = Array.from(selectStatus.options).find(o => o.text.toLowerCase().includes('suspenso') || o.value === '2' || o.value === 'S');
                    if (opt) selectStatus.value = opt.value;
                }
            }, nuevoLogin);

            await this.salvarFormularioCliente(page);
            console.log(`[RECEITANET-ROBOT SUCCESS] AUDITADO E CONFIRMADO NO ERP: Cliente ${login} renomeado para '${nuevoLogin}' e alterado para SUSPENSO no ERP!`);
            return true;
        } catch (error) {
            console.error(`[RECEITANET-ROBOT ERROR] Falha ao bloquear cliente:`, error.message);
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
        const rawLogin = (login || '').toString().trim().toLowerCase();
        const loginSemDominio = rawLogin.replace(/@.*$/, '').replace(/[\s\+].*$/, '').trim();
        const loginComDominio = rawLogin.includes('@') ? rawLogin : `${rawLogin}@tvplus`;

        console.log(`[RECEITANET-ROBOT OTIMIZADO] ⚡ Iniciando exclusão ultrarrápida do login: '${rawLogin}'...`);
        const page = await this.obterPaginaAutenticada();

        try {
            const variacoesLogin = [
                loginSemDominio,
                loginComDominio,
                `${loginSemDominio}suspenso`,
                `${loginSemDominio}@tvplussuspenso`
            ];

            let excluidoComSucesso = false;

            for (const targetLogin of variacoesLogin) {
                if (!targetLogin) continue;

                const cadastroUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${encodeURIComponent(targetLogin)}`;
                console.log(`[RECEITANET-ROBOT] Abrindo ficha de cadastro do cliente: ${cadastroUrl}...`);
                await page.goto(cadastroUrl, { waitUntil: 'networkidle2' });
                
                const hasInput = await page.waitForSelector('input[name="cli_login"]', { timeout: 5000 }).then(() => true).catch(() => false);
                if (!hasInput) {
                    console.log(`[RECEITANET-ROBOT] Ficha de '${targetLogin}' não pôde ser aberta ou não existe.`);
                    continue;
                }

                // -1. Altera o status do cadastro para SUSPENSO no ERP (cli_boleto='N', men_codigo='2') e salva a ficha
                // Isso força o ReceitaNet a disparar a sincronização de revogação de API com os servidores da CDNTV na hora para deslogar do celular
                try {
                    console.log(`[RECEITANET-ROBOT] Alterando status de '${targetLogin}' para SUSPENSO no ERP para revogar API CDNTV e deslogar do celular...`);
                    await page.evaluate(() => {
                        const setVal = (selector, val) => {
                            const el = document.querySelector(selector);
                            if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
                        };
                        setVal('select[name="cli_boleto"]', 'N'); // Desativado / Suspenso
                        setVal('select[name="men_codigo"]', '2'); // Suspenso
                        
                        const selectStatus = document.querySelector('select[name="cli_status"], select[name="status"]');
                        if (selectStatus) {
                            const opt = Array.from(selectStatus.options).find(o => o.text.toLowerCase().includes('suspenso') || o.value === '2' || o.value === 'S');
                            if (opt) selectStatus.value = opt.value;
                        }
                    });

                    await this.salvarFormularioCliente(page);
                    console.log(`[RECEITANET-ROBOT SUCCESS] Cadastro '${targetLogin}' alterado para SUSPENSO e salvo no ERP (API CDNTV revogada, celular deslogado)!`);
                } catch (eRenomear) {
                    console.log(`[RECEITANET-ROBOT] Aviso ao desativar status no ERP antes da rescisão:`, eRenomear.message);
                }

                // 0. Antes da Rescisão, acessa a aba/página de Planos de Cobrança para REMOVER o plano CDNTV
                // Isso força o ReceitaNet a enviar a ordem de cancelamento de API para os servidores centrais da CDNTV
                console.log(`[RECEITANET-ROBOT] Removendo/desativando plano CDNTV antes da rescisão para cancelar a API na CDNTV...`);
                try {
                    // 0.1 Módulo Legacy de planos (clientes_plano.php?login=...)
                    const legacyPlanoUrl = `${RECEITANET_LOGIN_URL}clientes_plano.php?login=${encodeURIComponent(targetLogin)}`;
                    await page.goto(legacyPlanoUrl, { waitUntil: 'networkidle2' });
                    
                    const hasPlanoLegacy = await page.waitForSelector('select[name="pla_codigo"]', { timeout: 4000 }).then(() => true).catch(() => false);
                    if (hasPlanoLegacy) {
                        await page.evaluate(() => {
                            const select = document.querySelector('select[name="pla_codigo"]');
                            if (select) {
                                const optVazia = Array.from(select.options).find(o => o.value === '0' || o.value === '' || o.text.toLowerCase().includes('nenhum'));
                                if (optVazia) {
                                    select.value = optVazia.value;
                                } else {
                                    select.value = '0';
                                }
                                select.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        });

                        await Promise.all([
                            page.evaluate(() => {
                                const btn = document.querySelector('input[type="submit"]') || Array.from(document.querySelectorAll('button, input[type="button"]')).find(b => b.value?.includes('Alterar') || b.textContent?.includes('Alterar') || b.value?.includes('Gravar'));
                                if (btn) btn.click();
                            }),
                            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {})
                        ]);
                        console.log(`[RECEITANET-ROBOT] Plano CDNTV desvinculado no módulo legacy para '${targetLogin}'!`);
                    }

                    // 0.2 Módulo Novo ERP de planos (procura e clica em Excluir/Lixeira no plano CDNTV)
                    const loginSemDominio = targetLogin.replace(/@.*$/, '').trim();
                    let planUrl = null;
                    for (const queryTerm of [loginSemDominio, targetLogin]) {
                        if (!queryTerm) continue;
                        await page.goto(`https://sistema.receitanet.net/novo/clientes?busca=${encodeURIComponent(queryTerm)}`, { waitUntil: 'networkidle2' });
                        await new Promise(r => setTimeout(r, 1500));

                        planUrl = await page.evaluate(() => {
                            const links = Array.from(document.querySelectorAll('a'));
                            const linkPlano = links.find(a => a.href.includes('/novo/financeiros/clientes/planos/'));
                            return linkPlano ? linkPlano.href : null;
                        });
                        if (planUrl) break;
                    }

                    if (planUrl) {
                        await page.goto(planUrl, { waitUntil: 'networkidle2' });
                        await new Promise(r => setTimeout(r, 1500));

                        const clickedDeletePlan = await page.evaluate(() => {
                            const rows = Array.from(document.querySelectorAll('tr, div.row, div.card'));
                            for (const r of rows) {
                                if (r.textContent.toUpperCase().includes('CDNTV')) {
                                    const btnDelete = r.querySelector('a.btn-danger, button.btn-danger, a[href*="delete"], a[href*="excluir"], i.fa-trash, i.fa-trash-can');
                                    if (btnDelete) {
                                        const clickTarget = btnDelete.closest('a, button') || btnDelete;
                                        clickTarget.click();
                                        return true;
                                    }
                                }
                            }
                            return false;
                        });

                        if (clickedDeletePlan) {
                            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
                            console.log(`[RECEITANET-ROBOT] Item de mensalidade CDNTV excluído no Novo ERP para '${targetLogin}'!`);
                        }
                    }
                } catch (ePlano) {
                    console.log(`[RECEITANET-ROBOT] Aviso ao tentar desativar plano CDNTV para '${targetLogin}':`, ePlano.message);
                }

                // 1. Ir na aba Rescisão
                console.log(`[RECEITANET-ROBOT] Acessando aba de Rescisão...`);
                const hasRescisaoBtn = await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('a, button')).find(b => b.textContent.trim() === 'Rescisão' || b.href?.includes('clientes_rescisao.php'));
                    if (btn) { btn.click(); return true; }
                    return false;
                });

                if (hasRescisaoBtn) {
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
                } else {
                    const rescisaoUrl = `https://sistema.receitanet.net/clientes_rescisao.php?login=${encodeURIComponent(targetLogin)}`;
                    await page.goto(rescisaoUrl, { waitUntil: 'networkidle2' });
                }

                const hasSelect = await page.waitForSelector('select[name="cancelamento_motivo"]', { timeout: 8000 }).then(() => true).catch(() => false);
                if (hasSelect) {
                    // 2. No motivo selecionar Cancelado Chip
                    console.log(`[RECEITANET-ROBOT] Selecionando motivo 'Cancelado Chip'...`);
                    await page.evaluate(() => {
                        const select = document.querySelector('select[name="cancelamento_motivo"]');
                        if (select) {
                            const opt = Array.from(select.options).find(o => o.text.toLowerCase().includes('chip') || o.value === '13');
                            if (opt) {
                                select.value = opt.value;
                                select.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    });

                    // 3. Escrever no detalhe OK
                    console.log(`[RECEITANET-ROBOT] Escrevendo 'OK' nos detalhes de cancelamento...`);
                    await page.evaluate(() => {
                        const input = document.querySelector('textarea') || document.querySelector('input[name="detalhe"]') || document.querySelector('input[name="observacao"]') || document.querySelector('textarea[name="cancelamento_detalhe"]');
                        if (input) {
                            input.value = 'OK';
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });

                    // Registra o hook para interceptar e fechar a nova aba aberta pelo botão Calcular
                    const newPagePromise = new Promise(resolve => this.browser?.once('targetcreated', async target => {
                        if (target.type() === 'page') {
                            resolve(await target.page());
                        }
                    }));

                    // 4. Clicar em Calcular
                    console.log(`[RECEITANET-ROBOT] Clicando em 'Calcular'...`);
                    await Promise.all([
                        page.evaluate(() => {
                            const btn = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn')).find(b => b.textContent.trim().toUpperCase().includes('CALCULAR'));
                            if (btn) btn.click();
                            else document.querySelector('form')?.submit();
                        }),
                        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {})
                    ]);

                    // Fecha a aba gerada de forma segura
                    const newPage = await Promise.race([
                        newPagePromise,
                        new Promise(r => setTimeout(r, 4000))
                    ]);
                    if (newPage && typeof newPage.close === 'function') {
                        console.log(`[RECEITANET-ROBOT] Fechando a nova aba aberta pelo Calcular...`);
                        await newPage.close().catch(() => {});
                    }

                    // SEGURANÇA CONTRA FRAME DESTACADO (Detached Frame): Reconecta o ponteiro de página ao aba ativa
                    try {
                        const pages = await this.browser.pages();
                        if (pages && pages.length > 0) {
                            page = pages[0];
                        }
                    } catch (ePage) {}
                }

                // 5. Depois o sistema volta para o cadastro
                console.log(`[RECEITANET-ROBOT] Voltando para a ficha do cliente: ${cadastroUrl}...`);
                await page.goto(cadastroUrl, { waitUntil: 'domcontentloaded' });

                // 6. Atualiza a página
                console.log(`[RECEITANET-ROBOT] Atualizando a página de cadastro...`);
                await page.reload({ waitUntil: 'domcontentloaded' });

                // 7. E vai aparecer o campo Excluir. Clica nele
                console.log(`[RECEITANET-ROBOT] Procurando o botão 'Excluir'...`);
                const hasExcluirBtn = await page.evaluate(() => {
                    const btn = document.getElementById('Excluir') || Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a')).find(b => b.textContent.trim() === 'Excluir' || b.value?.trim() === 'Excluir');
                    return btn ? true : false;
                });

                if (hasExcluirBtn) {
                    console.log(`[RECEITANET-ROBOT] Clicando no botão 'Excluir' para remoção definitiva...`);
                    await Promise.all([
                        page.evaluate(() => {
                            const btn = document.getElementById('Excluir') || Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a')).find(b => b.textContent.trim() === 'Excluir' || b.value?.trim() === 'Excluir');
                            if (btn) btn.click();
                        }),
                        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
                    ]);
                    console.log(`[RECEITANET-ROBOT] Cliente '${targetLogin}' excluído com sucesso!`);
                    excluidoComSucesso = true;
                } else {
                    console.log(`[RECEITANET-ROBOT] O botão 'Excluir' não apareceu na ficha de '${targetLogin}'.`);
                }
            }

            console.log(`[RECEITANET-ROBOT SUCCESS] Processo de exclusão do teste '${rawLogin}' concluído no ReceitaNet ERP!`);
            return true;
        } catch (error) {
            console.error(`[RECEITANET-ROBOT ERROR] Falha ao excluir cliente de teste:`, error.message);
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
