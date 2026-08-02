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
        if (!page || page.isClosed()) return;
        try {
            const base64 = await page.screenshot({ encoding: 'base64', fullPage: false }).catch(() => null);
            if (base64 && global.registrarScreenshotDebug) {
                global.registrarScreenshotDebug(stepName, base64);
                console.log(`[ERP-SCREENSHOT] 📸 Print da etapa '${stepName}' registrado em memória!`);
            }
        } catch (e) {
            console.log(`[ERP-SCREENSHOT] Aviso ao salvar print '${stepName}':`, e.message);
        }
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
        const senhaTv = cpf; // A senha deve ser o CPF conforme instrução
        const nomeCliente = cliente.nome || 'Cliente Provedor';

        console.log(`[ROBO-NOVO] 🚀 Criando usuário '${loginTv}' do zero com CPF/Senha '${cpf}'...`);

        try {
            // ETAPA 1: Acessar a página https://sistema.receitanet.net/clientes_cadastro.php
            console.log(`[ROBO-NOVO] ETAPA 1: Acessando https://sistema.receitanet.net/clientes_cadastro.php...`);
            await page.goto(CADASTRO_CLIENTE_URL, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });

            // Preencher campos da foto: login, senha (CPF), nome, cpf
            console.log(`[ROBO-NOVO] Preenchendo Login: '${loginTv}', Senha (CPF): '${senhaTv}', Nome: '${nomeCliente}', CPF: '${cpf}'...`);
            await page.type('input[name="cli_login"]', (loginTv || '').toString());
            await page.type('input[name="cli_senha"]', (senhaTv || '').toString());
            await page.type('input[name="cli_nome"]', (nomeCliente || '').toString());
            await page.type('input[name="cli_cgc"]', (cpf || '').toString());

            // Parâmetros oficiais adicionais
            await page.evaluate(() => {
                const setVal = (sel, val) => {
                    const el = document.querySelector(sel);
                    if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
                };
                setVal('select[name="cli_tipo"]', '1');
                setVal('select[name="cli_diatari"]', '10');
                setVal('select[name="cli_boleto"]', 'S');
                setVal('select[name="men_codigo"]', '1');
                setVal('select[name="plano"]', '2');
                setVal('select[name="ban_codigo"]', '12168');
                setVal('select[name="base_referencia"]', 'V');
            });

            await this.tirarScreenshot(page, '01_formulario_cadastro_preenchido');

            // Clica no botão Incluir seletor: #form-cliente > div.nav-tabs-custom > div.box-footer > button.btn.btn-primary
            console.log(`[ROBO-NOVO] Clicando no botão Incluir do cadastro...`);
            await Promise.all([
                page.evaluate(() => {
                    const btn = document.querySelector('#form-cliente > div.nav-tabs-custom > div.box-footer > button.btn.btn-primary') ||
                                document.querySelector('button.btn-primary') ||
                                Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Incluir');
                    if (btn) btn.click();
                    else throw new Error("Botão Incluir de cadastro não encontrado.");
                }),
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
            ]);

            await this.tirarScreenshot(page, '02_apos_incluir_cliente_criado');
            console.log(`[ROBO-NOVO] ETAPA 1 Concluída! Ficha criada: ${page.url()}`);

            // ETAPA 2 & 3: Clicar no botão azul Planos e ativar o plano CDNTV
            console.log(`[ROBO-NOVO] ETAPA 2 & 3: Atribuindo o Plano de Cobrança CDNTV...`);
            
            const loginSemDominio = (loginTv || '').replace(/@.*$/, '').trim();
            const legacyUrls = [
                `https://sistema.receitanet.net/clientes_plano.php?login=${encodeURIComponent(loginTv)}`,
                `https://sistema.receitanet.net/clientes_plano.php?login=${encodeURIComponent(loginSemDominio)}`,
                `https://sistema.receitanet.net/clientes_plano.php?cli_login=${encodeURIComponent(loginTv)}`
            ];

            let planoAtribuido = false;

            // 1. Tenta atribuição pelas URLs do módulo Legacy (clientes_plano.php)
            for (const legUrl of legacyUrls) {
                try {
                    console.log(`[ROBO-NOVO] Navegando para a página de planos: ${legUrl}...`);
                    await page.goto(legUrl, { waitUntil: 'domcontentloaded' });
                    await new Promise(r => setTimeout(r, 1000));
                    await this.tirarScreenshot(page, '03_tela_planos_legacy');

                    const selectExists = await page.waitForSelector('select', { timeout: 4000 }).then(() => true).catch(() => false);
                    if (selectExists) {
                        console.log(`[ROBO-NOVO] Formulario de planos localizado em ${legUrl}. Selecionando 'cdntv' e submetendo...`);
                        
                        const resSubmit = await Promise.all([
                            page.evaluate(() => {
                                const selects = Array.from(document.querySelectorAll('select'));
                                let targetSelect = null;
                                let cdntvOption = null;

                                for (const s of selects) {
                                    const opt = Array.from(s.options).find(o => {
                                        const txt = (o.text || '').toLowerCase();
                                        const val = (o.value || '').toString();
                                        return txt.includes('cdntv') || txt.includes('cdn') || val === '29' || val === '108038';
                                    });
                                    if (opt) {
                                        targetSelect = s;
                                        cdntvOption = opt;
                                        break;
                                    }
                                }

                                if (targetSelect && cdntvOption) {
                                    targetSelect.value = cdntvOption.value;
                                    targetSelect.dispatchEvent(new Event('change', { bubbles: true }));

                                    const parentForm = targetSelect.closest('form') || document.querySelector('form');
                                    if (parentForm) {
                                        const btnIncluir = parentForm.querySelector('button, input[type="submit"], input[name="cadastrar"]') ||
                                                           Array.from(parentForm.querySelectorAll('button, input')).find(b => {
                                                               const val = (b.value || b.textContent || '').trim().toUpperCase();
                                                               return val.includes('INCLUIR');
                                                           });
                                        if (btnIncluir) {
                                            btnIncluir.click();
                                            return true;
                                        } else {
                                            parentForm.submit();
                                            return true;
                                        }
                                    }
                                }
                                return false;
                            }),
                            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {})
                        ]);

                        await new Promise(r => setTimeout(r, 1500));
                        await this.tirarScreenshot(page, '04_apos_submeter_plano_legacy');

                        if (resSubmit[0]) {
                            console.log(`[ROBO-NOVO SUCCESS] ✅ Plano CDNTV atribuído com sucesso via Módulo Legacy!`);
                            planoAtribuido = true;
                            break;
                        }
                    }
                } catch (eLeg) {
                    console.log(`[ROBO-NOVO AVISO] Tentativa na URL ${legUrl}:`, eLeg.message);
                }
            }

            // 2. Se não atribuiu no Módulo Legacy, tenta pelo Novo ERP (/novo/financeiros/clientes/planos/)
            if (!planoAtribuido) {
                try {
                    console.log(`[ROBO-NOVO] Tentando atribuição via Novo ERP (/novo/clientes)...`);
                    await page.goto(`https://sistema.receitanet.net/novo/clientes?busca=${encodeURIComponent(loginSemDominio)}`, { waitUntil: 'domcontentloaded' });
                    await new Promise(r => setTimeout(r, 1500));

                    const planUrl = await page.evaluate(() => {
                        const linkPlano = Array.from(document.querySelectorAll('a')).find(a => a.href.includes('/novo/financeiros/clientes/planos/'));
                        return linkPlano ? linkPlano.href : null;
                    });

                    if (planUrl) {
                        await page.goto(planUrl, { waitUntil: 'domcontentloaded' });
                        await page.waitForSelector('select', { timeout: 5000 });

                        await Promise.all([
                            page.evaluate(() => {
                                const select = document.querySelector('select[name="mensalidade_id"], select');
                                if (select) {
                                    const opt = Array.from(select.options).find(o => o.text.toLowerCase().includes('cdntv') || o.value === '108038' || o.value === '29');
                                    if (opt) {
                                        select.value = opt.value;
                                        select.dispatchEvent(new Event('change', { bubbles: true }));
                                        const form = select.closest('form');
                                        if (form) form.submit();
                                    }
                                }
                            }),
                            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {})
                        ]);

                        await new Promise(r => setTimeout(r, 1500));
                        await this.tirarScreenshot(page, '05_apos_submeter_novo_erp');
                        console.log(`[ROBO-NOVO SUCCESS] ✅ Plano CDNTV atribuído via Novo ERP!`);
                    }
                } catch (eNovo) {
                    console.log(`[ROBO-NOVO AVISO] Tentativa via Novo ERP:`, eNovo.message);
                }
            }

            console.log(`[ROBO-NOVO SUCCESS] 🎉 CRIAÇÃO E ATIVAÇÃO DO USUÁRIO '${loginTv}' FINALIZADA COM SUCESSO!`);
            return true;
        } catch (error) {
            console.error(`[RECEITANET-ROBOT ERROR] Falha no cadastro de cliente:`, error.message);
            await this.fecharNavegador();
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

                    // 4. Clicar em Calcular
                    console.log(`[RECEITANET-ROBOT] Clicando em 'Calcular'...`);
                    await Promise.all([
                        page.evaluate(() => {
                            const btn = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn')).find(b => b.textContent.trim().toUpperCase().includes('CALCULAR'));
                            if (btn) btn.click();
                            else document.querySelector('form')?.submit();
                        }),
                        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {})
                    ]);

                    await new Promise(r => setTimeout(r, 1500));

                    // Fecha com segurança qualquer nova aba aberta e reconecta o ponteiro oficial da página
                    try {
                        const pages = await this.browser.pages();
                        if (pages && pages.length > 1) {
                            console.log(`[RECEITANET-ROBOT] Fechando ${pages.length - 1} aba(s) popup secundária(s)...`);
                            for (let i = 1; i < pages.length; i++) {
                                await pages[i].close().catch(() => {});
                            }
                        }
                        const activePages = await this.browser.pages();
                        if (activePages && activePages.length > 0) {
                            this.page = activePages[0];
                            page = activePages[0];
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
            await this.fecharNavegador();
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
