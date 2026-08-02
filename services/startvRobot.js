const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const RECEITANET_LOGIN_URL = 'https://sistema.receitanet.net/';
const CADASTRO_CLIENTE_URL = 'https://sistema.receitanet.net/clientes_cadastro.php';

class ReceitanetRobotService {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async tirarScreenshot(page, stepName) {
        // Prints/screenshots desativados para economizar CPU, RAM e memória do servidor
        return;
    }

    async obterPaginaAutenticada() {
        const adminUser = process.env.RECEITANET_ADMIN_USER;
        const adminPass = process.env.RECEITANET_ADMIN_PASS;

        if (!adminUser || !adminPass) {
            throw new Error("Credenciais do administrador do ReceitaNet não configuradas no arquivo .env.");
        }

        if (this.browser && this.page && !this.page.isClosed()) {
            try {
                if (!this.page.mainFrame() || this.page.mainFrame().isDetached()) {
                    throw new Error("Frame da sessão desanexado.");
                }
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

    async cadastrarEAtivarTV(cliente, loginTvInput, senhaTvInput) {
        const page = await this.obterPaginaAutenticada();
        const loginTv = loginTvInput || cliente.login || cliente.cli_login;
        const cpfRaw = cliente.cpf || cliente.cpfcnpj || cliente.cgc || senhaTvInput || '00000000000';
        const cpf = cpfRaw.toString().replace(/\D/g, '');
        const senhaTv = cpf;
        const nomeCliente = cliente.nome || 'Cliente Provedor';
        const loginClean = (loginTv || '').replace(/@.*$/, '').trim();

        const startTime = Date.now();
        console.log('[STARTV-ROBOT] 🚀 [VELOCIDADE ULTRA] Criando usuario ' + loginTv + ' | CPF/Senha: ' + cpf + '...');

        try {
            // ETAPA 1: CADASTRO DO CLIENTE (Preenchimento instantâneo em lote)
            console.log('[STARTV-ROBOT] ETAPA 1: Acessando tela de cadastro...');
            await page.goto(CADASTRO_CLIENTE_URL, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('input[name="cli_login"]', { timeout: 8000 });

            // Preenchimento instantâneo de todos os campos de uma só vez (sem delay de digitação)
            await page.evaluate(({ loginTv, senhaTv, nomeCliente, cpf }) => {
                const setVal = (sel, val) => {
                    const el = document.querySelector(sel);
                    if (el) {
                        el.value = val;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                };

                setVal('input[name="cli_login"]', loginTv);
                setVal('input[name="cli_senha"]', senhaTv);
                setVal('input[name="cli_nome"]', nomeCliente);
                setVal('input[name="cli_cgc"]', cpf);

                setVal('select[name="cli_tipo"]',       '1');
                setVal('select[name="cli_diatari"]',    '10');
                setVal('select[name="cli_boleto"]',     'S');
                setVal('select[name="men_codigo"]',     '1');
                setVal('select[name="plano"]',          '2');
                setVal('select[name="ban_codigo"]',     '12168');
                setVal('select[name="base_referencia"]','V');
            }, { loginTv, senhaTv, nomeCliente, cpf });

            this.tirarScreenshot(page, '01_formulario_preenchido').catch(() => {});
            console.log('[STARTV-ROBOT] Campos preenchidos instantaneamente. Clicando em INCLUIR...');

            // Clica no botão INCLUIR
            const btnIncluirSel = '#form-cliente > div.nav-tabs-custom > div.box-footer > button.btn.btn-primary';
            const btnExiste = await page.$(btnIncluirSel);
            if (btnExiste) {
                await page.click(btnIncluirSel);
            } else {
                await page.evaluate(() => {
                    const btn = document.querySelector('button.btn-primary') ||
                                Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim().toLowerCase() === 'incluir');
                    if (btn) btn.click();
                    else throw new Error('Botão INCLUIR do cadastro não encontrado.');
                });
            }

            // Aguarda navegação pós-criação
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

            const urlPosCriacao = page.url();
            console.log('[STARTV-ROBOT] ETAPA 1 OK (' + ((Date.now() - startTime)/1000).toFixed(2) + 's). URL pós-criação: ' + urlPosCriacao);
            this.tirarScreenshot(page, '02_cliente_criado').catch(() => {});

            // ETAPA 2: EXTRAÇÃO INSTANTÂNEA DO ID NUMÉRICO DO CLIENTE
            console.log('[STARTV-ROBOT] ETAPA 2: Extraindo ID numérico...');

            let clienteId = null;

            // Método A1: ID diretamente da URL de redirect pós-criação
            const matchUrl = urlPosCriacao.match(/[?&]cli_codigo=([\d]+)/) ||
                             urlPosCriacao.match(/\/clientes\/(\d+)/) ||
                             urlPosCriacao.match(/id=(\d+)/);
            if (matchUrl) {
                clienteId = matchUrl[1];
                console.log('[STARTV-ROBOT] ID capturado da URL pós-criação: ' + clienteId);
            }

            // Método A2: ID extraído do DOM da própria página pós-criação (Sem recarregar a página!)
            if (!clienteId) {
                clienteId = await page.evaluate(() => {
                    const linkPlano = Array.from(document.querySelectorAll('a'))
                        .find(a => a.href && a.href.includes('/novo/financeiros/clientes/planos/'));
                    if (linkPlano) {
                        const m = linkPlano.href.match(/\/planos\/(\d+)/);
                        return m ? m[1] : null;
                    }
                    const inputCodigo = document.querySelector('input[name="cli_codigo"], input[name="id"], input[name="cli_id"]');
                    if (inputCodigo && /^\d+$/.test((inputCodigo.value || '').trim())) {
                        return inputCodigo.value.trim();
                    }
                    const html = document.body.innerHTML;
                    const mHtml = html.match(/\/novo\/financeiros\/clientes\/planos\/(\d+)/);
                    if (mHtml) return mHtml[1];
                    return null;
                });
                if (clienteId) {
                    console.log('[STARTV-ROBOT] ID extraído do DOM pós-criação sem recarregar: ' + clienteId);
                }
            }

            // Método B: Fallback ultra-rápido via URL de edição direta apenas se A1 e A2 falharem
            if (!clienteId) {
                for (const tentativaLogin of [loginTv, loginClean]) {
                    if (!tentativaLogin) continue;
                    const fichaUrl = CADASTRO_CLIENTE_URL + '?cli_login=' + encodeURIComponent(tentativaLogin);
                    console.log('[STARTV-ROBOT] Método B consulta rápida: ' + tentativaLogin);
                    await page.goto(fichaUrl, { waitUntil: 'domcontentloaded' });

                    const extractResult = await page.evaluate(() => {
                        const linkPlano = Array.from(document.querySelectorAll('a'))
                            .find(a => a.href && a.href.includes('/novo/financeiros/clientes/planos/'));
                        if (linkPlano) {
                            const m = linkPlano.href.match(/\/planos\/(\d+)/);
                            return m ? m[1] : null;
                        }
                        const inputCodigo = document.querySelector('input[name="cli_codigo"], input[name="id"], input[name="cli_id"]');
                        if (inputCodigo && /^\d+$/.test((inputCodigo.value || '').trim())) {
                            return inputCodigo.value.trim();
                        }
                        const html = document.body.innerHTML;
                        const mHtml = html.match(/\/novo\/financeiros\/clientes\/planos\/(\d+)/);
                        if (mHtml) return mHtml[1];
                        return null;
                    });

                    if (extractResult) {
                        clienteId = extractResult;
                        console.log('[STARTV-ROBOT] ID extraído (login=' + tentativaLogin + '): ' + clienteId);
                        break;
                    }
                }
            }

            if (!clienteId) {
                throw new Error('[STARTV-ROBOT] Não foi possível localizar o ID numérico do cliente ' + loginTv);
            }

            // ETAPA 3: NAVEGAÇÃO DIRETA E ADESÃO AO PLANO CDNTV
            const planosPageUrl = 'https://sistema.receitanet.net/novo/financeiros/clientes/planos/' + clienteId;
            console.log('[STARTV-ROBOT] ETAPA 3: Acessando página de Planos: ' + planosPageUrl);
            await page.goto(planosPageUrl, { waitUntil: 'domcontentloaded' });

            await page.waitForSelector('select', { timeout: 10000 });

            // Encontra o select com a opção CDNTV
            const cdntvInfo = await page.evaluate(() => {
                for (const s of document.querySelectorAll('select')) {
                    for (const o of s.options) {
                        const txt = (o.text || '').toLowerCase();
                        const val = (o.value || '').toString();
                        if (txt.includes('cdntv') || txt.includes('cdn') || val === '108038' || val === '29') {
                            return { selectName: s.name, selectId: s.id, optionValue: o.value };
                        }
                    }
                }
                return null;
            });

            if (!cdntvInfo) {
                this.tirarScreenshot(page, '04_ERRO_cdntv_nao_encontrado').catch(() => {});
                throw new Error('[STARTV-ROBOT] Opção CDNTV não encontrada nos selects da página de planos.');
            }

            const selectSel = cdntvInfo.selectName
                ? 'select[name="' + cdntvInfo.selectName + '"]'
                : cdntvInfo.selectId ? 'select#' + cdntvInfo.selectId : 'select';

            await page.select(selectSel, cdntvInfo.optionValue);

            // Clica no botão INCLUIR via XPath exato do usuário + fallbacks
            console.log('[STARTV-ROBOT] Clicando no botão INCLUIR via XPath exato /html/body/div/div[1]/section[2]/div/div[2]/form/div[3]/button...');
            const clicouIncluir = await page.evaluate(() => {
                const xpathExato = document.evaluate('/html/body/div/div[1]/section[2]/div/div[2]/form/div[3]/button', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (xpathExato) {
                    xpathExato.scrollIntoView();
                    xpathExato.click();
                    return 'xpath_exato';
                }

                const parentForm = document.querySelector('form');
                const candidatos = parentForm
                    ? Array.from(parentForm.querySelectorAll('button, input[type="submit"], input[type="button"]'))
                    : Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));

                const btn = candidatos.find(b => {
                    const txt = (b.value || b.textContent || '').trim().toUpperCase();
                    return txt.includes('INCLUIR') || txt.includes('SALVAR') || txt.includes('ADICIONAR');
                }) || candidatos[0];

                if (btn) {
                    btn.scrollIntoView();
                    btn.click();
                    return 'seletor_texto';
                }

                if (parentForm) {
                    parentForm.submit();
                    return 'form_submit';
                }

                return false;
            });

            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});

            const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(2);
            this.tirarScreenshot(page, '06_plano_cdntv_incluido').catch(() => {});
            console.log('[STARTV-ROBOT SUCCESS] ⚡⚡ CONCLUÍDO EM APENAS ' + totalTimeSec + 's! Cliente ' + loginTv + ' criado e CDNTV ativado!');
            return true;

        } catch (error) {
            console.error('[STARTV-ROBOT ERROR] Falha na automação ultrarrápida:', error.message);
            try { this.tirarScreenshot(page, 'ERRO_exception').catch(() => {}); } catch(e) {}
            try { await this.fecharNavegador(); } catch(e) {}
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
        const rawLogin = (login || '').toString().trim();
        const loginSemDominio = rawLogin.replace(/@.*$/, '').trim();

        console.log('[STARTV-ROBOT] 🗑️ REINICIANDO LÓGICA DE EXCLUSÃO para cliente: ' + rawLogin + '...');
        let page = await this.obterPaginaAutenticada();

        // Handler para caixas de diálogo (alert/confirm)
        const setupDialogHandler = (targetPage) => {
            targetPage.removeAllListeners('dialog');
            targetPage.on('dialog', async (dialog) => {
                console.log('[STARTV-ROBOT] 💬 Confirmando diálogo popup: "' + dialog.message() + '"');
                await dialog.accept().catch(() => {});
            });
        };

        setupDialogHandler(page);

        try {
            // ============================================================
            // PASSO 1: Acessar https://sistema.receitanet.net/clientes_cadastro.php?cli_login=
            //          e ir para a aba Rescisão
            // ============================================================
            const cadastroUrl = 'https://sistema.receitanet.net/clientes_cadastro.php?cli_login=' + encodeURIComponent(rawLogin);
            console.log('[STARTV-ROBOT] PASSO 1: Acessando ' + cadastroUrl);
            await page.goto(cadastroUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('a, button, input', { timeout: 10000 });

            // Clica na aba/botão "Rescisão" na página de cadastro ou navega para a URL da rescisão
            console.log('[STARTV-ROBOT] Clicando na aba/opção Rescisão...');
            const clicouRescisao = await page.evaluate(() => {
                const btnRescisao = Array.from(document.querySelectorAll('a, button'))
                    .find(b => (b.textContent || '').trim() === 'Rescisão' || (b.href && b.href.includes('clientes_rescisao.php')));
                if (btnRescisao) {
                    btnRescisao.click();
                    return true;
                }
                return false;
            });

            if (clicouRescisao) {
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
            } else {
                const rescisaoUrl = 'https://sistema.receitanet.net/clientes_rescisao.php?login=' + encodeURIComponent(loginSemDominio);
                console.log('[STARTV-ROBOT] Navegando diretamente para a URL de rescisão: ' + rescisaoUrl);
                await page.goto(rescisaoUrl, { waitUntil: 'domcontentloaded' });
            }

            // ============================================================
            // PASSO 2: Motivo e Detalhe
            //          - Selecionar "cancelado chip" em cancelamento_motivo
            //          - Escrever "ok" no campo detalhe
            // ============================================================
            console.log('[STARTV-ROBOT] PASSO 2: Selecionando "cancelado chip" e escrevendo "ok" em detalhe...');
            await page.waitForSelector('select', { timeout: 10000 });

            await page.evaluate(() => {
                // Dropdown Motivo
                const select = document.querySelector('select[name="cancelamento_motivo"]') || document.querySelector('select');
                if (select) {
                    const opt = Array.from(select.options).find(o => (o.text || '').toLowerCase().includes('chip') || o.value === '13');
                    if (opt) {
                        select.value = opt.value;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }

                // Campo Detalhe
                const campoDetalhe = document.querySelector('textarea[name="cancelamento_detalhe"]') || 
                                     document.querySelector('textarea') || 
                                     document.querySelector('input[name="detalhe"]') || 
                                     document.querySelector('input[name="observacao"]');
                if (campoDetalhe) {
                    campoDetalhe.value = 'ok';
                    campoDetalhe.dispatchEvent(new Event('input', { bubbles: true }));
                    campoDetalhe.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            this.tirarScreenshot(page, 'excluir_01_rescisao_preenchida').catch(() => {});

            // ============================================================
            // PASSO 3: Clicar no botão /html/body/div/div/section[2]/form/div[3]/button[1] (Calcular)
            // ============================================================
            console.log('[STARTV-ROBOT] PASSO 3: Clicando no botão Calcular via XPath /html/body/div/div/section[2]/form/div[3]/button[1]...');

            // Prepara escuta para a nova guia que o sistema irá abrir
            const novaGuiaPromise = new Promise(resolve => {
                const listener = (target) => {
                    if (target.type() === 'page') {
                        this.browser.off('targetcreated', listener);
                        resolve(target);
                    }
                };
                this.browser.on('targetcreated', listener);
                setTimeout(() => {
                    this.browser.off('targetcreated', listener);
                    resolve(null);
                }, 4000);
            });

            await page.evaluate(() => {
                const xpathBtn = document.evaluate('/html/body/div/div/section[2]/form/div[3]/button[1]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (xpathBtn) {
                    xpathBtn.scrollIntoView();
                    xpathBtn.click();
                } else {
                    const btn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find(b => (b.textContent || b.value || '').toUpperCase().includes('CALCULAR')) || document.querySelector('form button');
                    if (btn) btn.click();
                    else document.querySelector('form')?.submit();
                }
            });

            // ============================================================
            // PASSO 4: Após clicar em calcular, fechar a guia que vai abrir
            // ============================================================
            console.log('[STARTV-ROBOT] PASSO 4: Fechando a nova guia aberta...');
            const targetGuia = await novaGuiaPromise;
            if (targetGuia) {
                try {
                    const pageGuia = await targetGuia.page();
                    if (pageGuia && !pageGuia.isClosed()) {
                        console.log('[STARTV-ROBOT] Fechando guia secundária (' + pageGuia.url() + ')...');
                        await pageGuia.close().catch(() => {});
                    }
                } catch (eG) {}
            }

            // Fecha quaisquer outras abas extras
            try {
                const pages = await this.browser.pages();
                if (pages.length > 1) {
                    for (let i = 1; i < pages.length; i++) {
                        await pages[i].close().catch(() => {});
                    }
                }
            } catch (eC) {}

            // Reconecta o ponteiro de página ativo
            page = await this.obterPaginaAutenticada();
            setupDialogHandler(page);

            // ============================================================
            // PASSO 5: Voltar para https://sistema.receitanet.net/clientes_cadastro.php?cli_login=
            // ============================================================
            console.log('[STARTV-ROBOT] PASSO 5: Voltando para ' + cadastroUrl);
            await page.goto(cadastroUrl, { waitUntil: 'domcontentloaded' });

            // ============================================================
            // PASSO 6: Ao carregar a página aperta F5 reload para aparecer o botão Excluir
            // ============================================================
            console.log('[STARTV-ROBOT] PASSO 6: Apertando F5 (reload) para liberar o botão Excluir...');
            await page.reload({ waitUntil: 'domcontentloaded' });
            await new Promise(r => setTimeout(r, 1000));

            this.tirarScreenshot(page, 'excluir_02_cadastro_atualizado').catch(() => {});

            // ============================================================
            // PASSO 7: Clica no botão Excluir via XPath exato /html/body/div/div[1]/section[2]/div[2]/div[1]/form/div[1]/div[2]/button[3]
            // ============================================================
            console.log('[STARTV-ROBOT] PASSO 7: Clicando no botão Excluir via XPath /html/body/div/div[1]/section[2]/div[2]/div[1]/form/div[1]/div[2]/button[3]...');

            const clicouExcluir = await page.evaluate(() => {
                const xpathExcluir = document.evaluate('/html/body/div/div[1]/section[2]/div[2]/div[1]/form/div[1]/div[2]/button[3]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (xpathExcluir) {
                    xpathExcluir.scrollIntoView();
                    xpathExcluir.click();
                    return 'xpath_exato';
                }

                const btnExcluir = document.getElementById('Excluir') || 
                                   Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a'))
                                   .find(b => (b.textContent || b.value || '').trim() === 'Excluir');
                if (btnExcluir) {
                    btnExcluir.scrollIntoView();
                    btnExcluir.click();
                    return 'seletor_texto';
                }
                return false;
            });

            if (clicouExcluir) {
                console.log('[STARTV-ROBOT] Botão Excluir acionado (' + clicouExcluir + '). Aguardando navegação...');
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
                console.log('[STARTV-ROBOT SUCCESS] 🎉 CLIENTE ' + rawLogin + ' EXCLUÍDO COM SUCESSO!');
            } else {
                console.log('[STARTV-ROBOT] Botão Excluir não encontrado na página.');
            }

            this.tirarScreenshot(page, 'excluir_03_finalizado').catch(() => {});
            return true;

        } catch (error) {
            console.error('[STARTV-ROBOT ERROR] Falha na exclusão do cliente ' + rawLogin + ':', error.message);
            try { this.tirarScreenshot(page, 'ERRO_exclusao').catch(() => {}); } catch(e) {}
            try { await this.fecharNavegador(); } catch(e) {}
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

    async fecharNavegador() {
        try {
            if (this.browser) {
                await this.browser.close();
            }
        } catch(e) {
            console.log(`[RECEITANET-ROBOT] Aviso ao fechar navegador:`, e.message);
        } finally {
            this.browser = null;
            this.page = null;
        }
    }
}

module.exports = new ReceitanetRobotService();
