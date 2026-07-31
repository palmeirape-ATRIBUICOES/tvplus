const puppeteer = require('puppeteer');
require('dotenv').config();

const RECEITANET_LOGIN_URL = 'https://sistema.receitanet.net/';
const CADASTRO_CLIENTE_URL = 'https://sistema.receitanet.net/clientes_cadastro.php';

/**
 * Módulos de Automação Dedicados e Exclusivos para o Provedor Star TV (@startv).
 * Este robô é totalmente isolado, reutiliza sessão de forma ultra-rápida
 * e trata re-autenticação automática no ERP.
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

        // Testar se o navegador atual em memória continua logado
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
                '--disable-gpu'
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

        // Intercepta e bloqueia mídias pesadas para performance máxima (300ms)
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
        console.log(`[STARTV-ROBOT EXCLUSIVO] Clicando no botão de gravação oficial no ERP...`);
        
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

        console.log(`[STARTV-ROBOT EXCLUSIVO] Aguardando processamento da gravação assíncrona (4 segundos)...`);
        await new Promise(r => setTimeout(r, 4000));
    }

    async cadastrarEAtivarTV(cliente, loginTv, senhaTv) {
        console.log(`[STARTV-ROBOT EXCLUSIVO] 🚀 Cadastrando e ativando assinante Star TV: ${loginTv}`);
        const page = await this.obterPaginaAutenticada();

        try {
            const loginSemDominio = (loginTv || '').replace(/@.*$/, '');
            const editUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${encodeURIComponent(loginTv)}`;
            
            console.log(`[STARTV-ROBOT EXCLUSIVO] Verificando existência de ${loginTv} no ERP...`);
            await page.goto(editUrl, { waitUntil: 'domcontentloaded' });
            
            const alreadyExists = await page.waitForSelector('input[name="cli_login"]', { timeout: 5000 })
                .then(async () => {
                    return await page.evaluate((target) => {
                        const val = document.querySelector('input[name="cli_login"]')?.value;
                        return val && val.trim().toLowerCase() === target.trim().toLowerCase();
                    }, loginTv);
                })
                .catch(() => false);

            if (alreadyExists) {
                console.log(`[STARTV-ROBOT EXCLUSIVO] Assinante ${loginTv} já cadastrado no ERP. Garantindo status ativo...`);
                await page.evaluate(() => {
                    const setVal = (selector, val) => {
                        const el = document.querySelector(selector);
                        if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
                    };
                    setVal('select[name="cli_boleto"]', 'S');
                    setVal('select[name="men_codigo"]', '1');
                });
                await this.salvarFormularioCliente(page);
            } else {
                console.log(`[STARTV-ROBOT EXCLUSIVO] Preenchendo cadastro de novo assinante para ${loginTv}...`);
                await page.goto(CADASTRO_CLIENTE_URL, { waitUntil: 'domcontentloaded' });
                await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });

                const cpfLimpo = (cliente.cpfcnpj || '00000000000').toString().replace(/\D/g, '');
                const emailFormatado = (cliente.email || `${loginTv}@email.com`).toString();

                await page.type('input[name="cli_login"]', (loginTv || '').toString());
                await page.type('input[name="cli_senha"]', (senhaTv || cpfLimpo).toString());
                await page.type('input[name="cli_nome"]', (cliente.nome || 'Cliente Star TV').toString());
                await page.type('input[name="cli_cgc"]', cpfLimpo);

                try { await page.type('input[name="cli_email"]', emailFormatado); } catch (e) {}

                await page.evaluate(() => {
                    const setVal = (selector, val) => {
                        const el = document.querySelector(selector);
                        if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
                    };

                    setVal('select[name="cli_tipo"]', '1');
                    setVal('select[name="cli_diatari"]', '10');
                    setVal('select[name="cli_boleto"]', 'S');
                    setVal('select[name="men_codigo"]', '1');
                    setVal('select[name="plano"]', '2');
                    setVal('select[name="ban_codigo"]', '12168');
                    setVal('select[name="base_referencia"]', 'V');

                    const chkDesc = document.querySelector('input[name="desconto_ate_vencimento"]');
                    if (chkDesc) chkDesc.checked = true;
                });

                await this.salvarFormularioCliente(page);
            }

            // Ativa o plano CDNTV
            console.log(`[STARTV-ROBOT EXCLUSIVO] Ativando plano CDNTV no módulo de serviços...`);
            const legacyPlanoUrl = `${RECEITANET_LOGIN_URL}clientes_plano.php?login=${encodeURIComponent(loginTv)}`;
            await page.goto(legacyPlanoUrl, { waitUntil: 'domcontentloaded' });
            
            const hasPlanoSelect = await page.waitForSelector('select[name="pla_codigo"]', { timeout: 5000 }).then(() => true).catch(() => false);
            if (hasPlanoSelect) {
                await page.evaluate(() => {
                    const select = document.querySelector('select[name="pla_codigo"]');
                    if (select) {
                        const opt = Array.from(select.options).find(o => o.value === '29' || o.text.toLowerCase().includes('cdntv'));
                        if (opt) select.value = opt.value;
                        else select.value = '29';
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });

                await Promise.all([
                    page.evaluate(() => {
                        const btn = document.querySelector('button[name="cadastrar"], input[name="cadastrar"]');
                        if (btn) btn.click();
                    }),
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {})
                ]);
            }

            console.log(`[STARTV-ROBOT EXCLUSIVO SUCCESS] ✅ Assinante ${loginTv} cadastrado e ativado no ERP com sucesso!`);
            return true;
        } catch (error) {
            console.error(`[STARTV-ROBOT EXCLUSIVO ERROR] ❌ Erro ao cadastrar assinante:`, error.message);
            // Se houve falha de sessão, invalida a página atual para forçar novo login no próximo
            this.page = null;
            throw error;
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
            this.page = null;
            throw error;
        }
    }
}

module.exports = new StartvRobotService();
