const puppeteer = require('puppeteer');
require('dotenv').config();

const RECEITANET_LOGIN_URL = 'https://sistema.receitanet.net/';
const CADASTRO_CLIENTE_URL = 'https://sistema.receitanet.net/clientes_cadastro.php';

/**
 * Módulos de Automação Dedicados e Exclusivos para o Provedor Star TV (@startv).
 * Este robô é totalmente isolado e utiliza a lógica exata de inclusão do ERP ReceitaNet.
 */
class StartvRobotService {
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

        // Testar se a sessão atual continua viva no ERP
        if (this.browser && this.page && !this.page.isClosed()) {
            try {
                const urlAtual = this.page.url();
                const isLoginPage = await this.page.$('#username').catch(() => null);

                if (urlAtual.includes('sistema.receitanet.net') && !isLoginPage) {
                    console.log(`[STARTV-ROBOT EXCLUSIVO] ⚡ Sessão ativa mantida em memória!`);
                    return this.page;
                }
            } catch (e) {
                try { await this.browser.close(); } catch(err) {}
                this.browser = null;
                this.page = null;
            }
        }

        console.log(`[STARTV-ROBOT EXCLUSIVO] 🚀 Autenticando no ERP ReceitaNet...`);
        
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

        if (this.browser) {
            try { await this.browser.close(); } catch(e) {}
        }

        this.browser = await puppeteer.launch(launchOptions);
        this.page = await this.browser.newPage();

        // Intercepta e bloqueia mídias pesadas para performance máxima
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

        await this.page.goto(RECEITANET_LOGIN_URL, { waitUntil: 'networkidle2' });
        await this.page.waitForSelector('#username', { timeout: 10000 });
        await this.page.type('#username', adminUser);
        await this.page.type('#password', adminPass);
        await Promise.all([
            this.page.click('#kc-login'),
            this.page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        console.log(`[STARTV-ROBOT EXCLUSIVO] ✅ Autenticação no ERP efetuada com sucesso!`);
        return this.page;
    }

    async salvarFormularioCliente(page) {
        console.log(`[STARTV-ROBOT EXCLUSIVO] Gravando edições de formulário no ERP...`);
        
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
            }
        });

        await new Promise(r => setTimeout(r, 4000));
    }

    async cadastrarEAtivarTV(cliente, loginTv, senhaTv) {
        console.log(`[STARTV-ROBOT EXCLUSIVO] 🚀 Cadastrando e ativando assinante Star TV: ${loginTv}`);
        const page = await this.obterPaginaAutenticada();

        try {
            const loginSemDominio = (loginTv || '').replace(/@.*$/, '').trim();
            const editUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${encodeURIComponent(loginTv)}`;
            const suspensoUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${encodeURIComponent(loginSemDominio + 'suspenso')}`;
            
            console.log(`[STARTV-ROBOT EXCLUSIVO] Verificando existência de ${loginTv} no ERP...`);
            
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
                console.log(`[STARTV-ROBOT EXCLUSIVO] Assinante ${loginTv} já ativo no ERP. Pulando criação e garantindo ativação...`);
            } else if (existsSuspended) {
                console.log(`[STARTV-ROBOT EXCLUSIVO] Assinante ${loginTv} está em modo suspenso. Restaurando cadastro...`);
                await page.evaluate((originalLog) => {
                    const input = document.querySelector('input[name="cli_login"]');
                    if (input) {
                        input.value = originalLog;
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }, loginTv);
                await this.salvarFormularioCliente(page);
            } else {
                console.log(`[STARTV-ROBOT EXCLUSIVO] Criando NOVO cadastro para assinante ${loginTv}...`);
                await page.goto(CADASTRO_CLIENTE_URL, { waitUntil: 'networkidle2' });
                await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });

                await page.type('input[name="cli_login"]', (loginTv || '').toString());
                await page.type('input[name="cli_senha"]', (senhaTv || '').toString());
                await page.type('input[name="cli_nome"]', (cliente.nome || 'Cliente Star TV').toString());
                
                const cpfValor = (cliente.cpfcnpj || '00000000000').toString().replace(/\D/g, '');
                await page.type('input[name="cli_cgc"]', cpfValor);

                const emailValor = (cliente.email || `${loginTv}@email.com`).toString();
                try {
                    await page.type('input[name="cli_email"]', emailValor);
                } catch (e) {}

                console.log(`[STARTV-ROBOT EXCLUSIVO] Aplicando parâmetros oficiais de mensalidade no ERP...`);
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

                console.log(`[STARTV-ROBOT EXCLUSIVO] Clicando no botão 'Incluir' para registrar o cliente no ERP...`);
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

            console.log(`[STARTV-ROBOT EXCLUSIVO] Assinante ${loginTv} cadastrado com sucesso! Abrindo tela de Planos de Cobrança...`);
            
            // 1. Vincula plano no Novo ERP
            try {
                console.log(`[STARTV-ROBOT EXCLUSIVO] Clicando no botão 'Planos' abaixo do cadastro...`);
                const clickedPlanos = await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('a')).find(a => a.textContent.trim() === 'Planos' || a.className.includes('bg-blue'));
                    if (btn) {
                        btn.click();
                        return true;
                    }
                    return false;
                });

                if (clickedPlanos) {
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
                }

                if (!page.url().includes('/planos/')) {
                    console.log(`[STARTV-ROBOT EXCLUSIVO] Buscando a URL do plano do cliente ${loginTv}...`);
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
                }

                if (page.url().includes('/planos/')) {
                    console.log(`[STARTV-ROBOT EXCLUSIVO] Gravando mensalidade 'CDNTV-R$0,00' no Novo ERP...`);
                    await page.waitForSelector('select[name="mensalidade_id"], select', { timeout: 10000 });

                    await Promise.all([
                        page.evaluate(() => {
                            const select = document.querySelector('select[name="mensalidade_id"]');
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
                }
            } catch (eNovoPlano) {
                console.error(`[STARTV-ROBOT EXCLUSIVO WARNING] Erro ao vincular plano no Novo ERP:`, eNovoPlano.message);
            }

            // 2. Vínculo no Módulo Legacy
            try {
                const legacyPlanoUrl = `${RECEITANET_LOGIN_URL}clientes_plano.php?login=${encodeURIComponent(loginTv)}`;
                console.log(`[STARTV-ROBOT EXCLUSIVO] Gravando plano 'CDNTV' (pla_codigo 29) no módulo legacy...`);
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
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
                ]);
            } catch (eLegacy) {
                console.error(`[STARTV-ROBOT EXCLUSIVO WARNING] Erro ao vincular plano no módulo legacy:`, eLegacy.message);
            }

            console.log(`[STARTV-ROBOT EXCLUSIVO SUCCESS] ✅ Assinante ${loginTv} cadastrado e ativado no ERP com sucesso!`);
            return true;
        } catch (error) {
            console.error(`[STARTV-ROBOT EXCLUSIVO ERROR] ❌ Erro ao cadastrar assinante:`, error.message);
            throw error;
        } finally {
            await this.fecharNavegador();
        }
    }

    async fecharNavegador() {
        if (this.browser) {
            try { await this.browser.close(); } catch(e) {}
            this.browser = null;
            this.page = null;
            console.log(`[STARTV-ROBOT EXCLUSIVO] 🧹 Navegador encerrado com sucesso! RAM liberada.`);
        }
    }

    async excluirCliente(login, cpf, nome) {
        const rawLogin = (login || '').toString().trim().toLowerCase();
        const loginSemDominio = rawLogin.replace(/@.*$/, '').replace(/[\s\+].*$/, '').trim();
        const loginComDominio = rawLogin.includes('@') ? rawLogin : `${rawLogin}@tvplus`;

        console.log(`[STARTV-ROBOT EXCLUSIVO] 🗑️ Excluindo assinante: '${rawLogin}'...`);
        const page = await this.obterPaginaAutenticada();

        try {
            const variacoesLogin = [
                loginSemDominio,
                loginComDominio,
                `${loginSemDominio}suspenso`
            ];

            for (const targetLogin of variacoesLogin) {
                if (!targetLogin) continue;

                const cadastroUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${encodeURIComponent(targetLogin)}`;
                await page.goto(cadastroUrl, { waitUntil: 'domcontentloaded' });
                
                const hasInput = await page.waitForSelector('input[name="cli_login"]', { timeout: 5000 }).then(() => true).catch(() => false);
                if (!hasInput) continue;

                try {
                    await page.evaluate(() => {
                        const setVal = (selector, val) => {
                            const el = document.querySelector(selector);
                            if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
                        };
                        setVal('select[name="cli_boleto"]', 'N');
                        setVal('select[name="men_codigo"]', '2');
                        
                        const selectStatus = document.querySelector('select[name="cli_status"], select[name="status"]');
                        if (selectStatus) {
                            const opt = Array.from(selectStatus.options).find(o => o.text.toLowerCase().includes('suspenso') || o.value === '2' || o.value === 'S');
                            if (opt) selectStatus.value = opt.value;
                        }
                    });

                    await this.salvarFormularioCliente(page);
                } catch (e) {}

                // Rescisão
                const rescisaoUrl = `https://sistema.receitanet.net/clientes_rescisao.php?login=${encodeURIComponent(targetLogin)}`;
                await page.goto(rescisaoUrl, { waitUntil: 'domcontentloaded' });

                const hasSelect = await page.waitForSelector('select[name="cancelamento_motivo"]', { timeout: 8000 }).then(() => true).catch(() => false);
                if (hasSelect) {
                    await page.evaluate(() => {
                        const select = document.querySelector('select[name="cancelamento_motivo"]');
                        if (select) {
                            const opt = Array.from(select.options).find(o => o.text.toLowerCase().includes('chip') || o.value === '13');
                            if (opt) select.value = opt.value;
                            else select.value = '13';
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        const input = document.querySelector('textarea') || document.querySelector('input[name="detalhe"]');
                        if (input) input.value = 'OK';
                    });

                    await Promise.all([
                        page.evaluate(() => {
                            const btn = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn')).find(b => b.textContent.trim().toUpperCase().includes('CALCULAR'));
                            if (btn) btn.click();
                            else document.querySelector('form')?.submit();
                        }),
                        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {})
                    ]);
                }

                await page.goto(cadastroUrl, { waitUntil: 'domcontentloaded' });
                await page.reload({ waitUntil: 'domcontentloaded' });

                const hasExcluirBtn = await page.evaluate(() => {
                    const btn = document.getElementById('Excluir') || Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a')).find(b => b.textContent.trim() === 'Excluir' || b.value?.trim() === 'Excluir');
                    return btn ? true : false;
                });

                if (hasExcluirBtn) {
                    await Promise.all([
                        page.evaluate(() => {
                            const btn = document.getElementById('Excluir') || Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a')).find(b => b.textContent.trim() === 'Excluir' || b.value?.trim() === 'Excluir');
                            if (btn) btn.click();
                        }),
                        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
                    ]);
                    console.log(`[STARTV-ROBOT EXCLUSIVO SUCCESS] ✅ Assinante '${targetLogin}' excluído do ERP!`);
                    break;
                }
            }

            return true;
        } catch (error) {
            console.error(`[STARTV-ROBOT EXCLUSIVO ERROR] ❌ Erro ao excluir assinante:`, error.message);
            throw error;
        } finally {
            await this.fecharNavegador();
        }
    }
}

module.exports = new StartvRobotService();
