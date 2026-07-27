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
    async bloquearCliente(login, cpf, nome) {
        const adminUser = process.env.RECEITANET_ADMIN_USER;
        const adminPass = process.env.RECEITANET_ADMIN_PASS;

        console.log(`[RECEITANET-ROBOT] Iniciando bloqueio do login: ${login} (CPF: ${cpf}, Nome: ${nome})`);
        
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

            // Acessa diretamente a ficha de edição do cliente via login na URL
            const editUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${login}`;
            console.log(`[RECEITANET-ROBOT] Acessando diretamente ficha do cliente em: ${editUrl}`);
            await page.goto(editUrl, { waitUntil: 'networkidle2' });

            const path = require('path');
            console.log(`[RECEITANET-ROBOT] Salvando screenshot de diagnóstico (ficha carregada)...`);
            await page.screenshot({ path: path.join(__dirname, '..', 'public', 'debug_edit_loaded.png'), fullPage: true });

            // Diagnóstico de campos preenchidos
            const formStatus = await page.evaluate(() => {
                const nomeInput = document.querySelector('input[name="cli_nome"]');
                const cpfInput = document.querySelector('input[name="cli_cgc"]');
                return {
                    nome: nomeInput ? nomeInput.value : null,
                    cpf: cpfInput ? cpfInput.value : null,
                    outerHTML: nomeInput ? nomeInput.outerHTML : null
                };
            });
            console.log(`[RECEITANET-ROBOT DIAGNOSE] Ficha carregada: Nome='${formStatus.nome}', CPF='${formStatus.cpf}'`);

            // Altera o campo cli_login adicionando "suspenso" diretamente pelo DOM (100% imune a problemas de teclado headless)
            await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });
            const nuevoLogin = `${login}suspenso`;
            
            await page.evaluate((targetNuevoLogin) => {
                const input = document.querySelector('input[name="cli_login"]');
                if (input) {
                    input.value = targetNuevoLogin;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    throw new Error("Campo cli_login não localizado na página para alteração.");
                }
            }, nuevoLogin);

            // Submete o formulário com segurança dentro da tag <form>
            await this.salvarFormularioCliente(page);

            console.log(`[RECEITANET-ROBOT] Salvando screenshot de diagnóstico (pós-gravação)...`);
            await page.screenshot({ path: path.join(__dirname, '..', 'public', 'debug_after_save.png'), fullPage: true });

            // Diagnóstico de página pós-salvamento
            const afterSaveStatus = await page.evaluate(() => {
                return {
                    url: window.location.href,
                    text: document.body.innerText.substring(0, 800)
                };
            });
            console.log(`[RECEITANET-ROBOT DIAGNOSE] Pós-salvamento URL: ${afterSaveStatus.url}`);
            console.log(`[RECEITANET-ROBOT DIAGNOSE] Pós-salvamento Texto:\n${afterSaveStatus.text}\n=== FIM DO TEXTO ===`);

            // --- AUDITORIA DE CONFIRMAÇÃO DIRETA NO ERP ---
            console.log(`[RECEITANET-ROBOT AUDITORIA] Confirmando alteração diretamente no ERP para '${nuevoLogin}'...`);
            const verifyUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${nuevoLogin}`;
            await page.goto(verifyUrl, { waitUntil: 'networkidle2' });
            
            const verifyResult = await page.evaluate(() => {
                const loginInput = document.querySelector('input[name="cli_login"]');
                const nomeInput = document.querySelector('input[name="cli_nome"]');
                return {
                    login: loginInput ? loginInput.value : null,
                    nome: nomeInput ? nomeInput.value : null
                };
            });
            console.log(`[RECEITANET-ROBOT AUDITORIA] Resultado no ERP: Login='${verifyResult.login}', Nome='${verifyResult.nome}'`);
            
            if (verifyResult.login !== nuevoLogin) {
                throw new Error(`[FALHA DE AUDITORIA ERP] O ERP rejeitou a alteração! Esperado login '${nuevoLogin}', mas o ERP retornou '${verifyResult.login}'.`);
            }

            console.log(`[RECEITANET-ROBOT SUCCESS] AUDITADO E CONFIRMADO NO ERP: Cliente ${login} bloqueado com sucesso (renomeado para ${nuevoLogin})!`);
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
    async reativarCliente(login, cpf, nome) {
        const adminUser = process.env.RECEITANET_ADMIN_USER;
        const adminPass = process.env.RECEITANET_ADMIN_PASS;

        console.log(`[RECEITANET-ROBOT] Iniciando reativação do login: ${login} (CPF: ${cpf}, Nome: ${nome})`);
        
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

            // Acessa diretamente a ficha de edição do cliente suspenso via login na URL
            const editUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${login}suspenso`;
            console.log(`[RECEITANET-ROBOT] Acessando diretamente ficha do cliente suspenso em: ${editUrl}`);
            await page.goto(editUrl, { waitUntil: 'networkidle2' });

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

            // Submete o formulário com segurança dentro da tag <form>
            await this.salvarFormularioCliente(page);

            // --- AUDITORIA DE CONFIRMAÇÃO DIRETA NO ERP ---
            console.log(`[RECEITANET-ROBOT AUDITORIA] Confirmando reativação diretamente no ERP para '${login}'...`);
            const verifyUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${login}`;
            await page.goto(verifyUrl, { waitUntil: 'networkidle2' });
            
            const verifyResult = await page.evaluate(() => {
                const loginInput = document.querySelector('input[name="cli_login"]');
                const nomeInput = document.querySelector('input[name="cli_nome"]');
                return {
                    login: loginInput ? loginInput.value : null,
                    nome: nomeInput ? nomeInput.value : null
                };
            });
            console.log(`[RECEITANET-ROBOT AUDITORIA] Resultado no ERP pós-reativação: Login='${verifyResult.login}', Nome='${verifyResult.nome}'`);
            
            if (verifyResult.login !== login) {
                throw new Error(`[FALHA DE AUDITORIA ERP] O ERP rejeitou a reativação! Esperado login '${login}', mas o ERP retornou '${verifyResult.login}'.`);
            }

            console.log(`[RECEITANET-ROBOT SUCCESS] AUDITADO E CONFIRMADO NO ERP: Cliente ${login} reativado com sucesso!`);
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
     * Submete com segurança o formulário de cadastro/edição do cliente isolando os elementos da tag <form>
     */
    async salvarFormularioCliente(page) {
        console.log(`[RECEITANET-ROBOT] Submetendo formulário via AJAX com parâmetro 'atualizar=1'...`);
        
        await page.evaluate(() => {
            const form = document.querySelector('form[name*="cli"], form[action*="cadastro"], form');
            if (form) {
                // Garante que o parâmetro obrigatório do PHP 'atualizar=1' exista no formulário
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
                
                // Localiza o botão exato do ReceitaNet e clica
                const btnAtualizar = form.querySelector('button[name="atualizar"], button[value="1"], button.btn-primary') ||
                                     Array.from(form.querySelectorAll('button, input[type="submit"]')).find(b => {
                                         const txt = (b.textContent || b.value || '').trim();
                                         return txt.includes('Gravar no ReceitaNet') || txt.includes('Gravar');
                                     });
                
                if (btnAtualizar) {
                    btnAtualizar.click();
                } else {
                    form.submit();
                }
            } else {
                throw new Error("Formulário principal do cliente não encontrado no DOM.");
            }
        });

        // Aguarda 5 segundos para a requisição de background AJAX processar no servidor do ReceitaNet
        console.log(`[RECEITANET-ROBOT] Aguardando processamento da gravação assíncrona (AJAX)...`);
        await new Promise(r => setTimeout(r, 5000));
    }

    /**
     * Efetua a rescisão contratual (cancelado chip) e exclui o cliente do ReceitaNet
     * @param {string} login - Login original do cliente
     */
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

            // 2. Acessa diretamente a ficha de edição do cliente via login na URL
            const editUrl = `${CADASTRO_CLIENTE_URL}?cli_login=${login}`;
            console.log(`[RECEITANET-ROBOT] Acessando diretamente ficha do cliente em: ${editUrl}`);
            await page.goto(editUrl, { waitUntil: 'networkidle2' });

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
    async localizarEAbriFichaCliente(page, login, cpf, nome) {
        let loadedFicha = false;
        
        // Define os termos de busca em ordem de prioridade
        const termosBusca = [];
        if (cpf) {
            const cpfLimpo = cpf.replace(/\D/g, '');
            if (cpfLimpo.length >= 11) termosBusca.push(cpfLimpo);
            termosBusca.push(cpf);
        }
        termosBusca.push(login);
        if (nome) termosBusca.push(nome);
        
        console.log(`[RECEITANET-ROBOT] Termos de busca priorizados:`, termosBusca);
        
        try {
            console.log(`[RECEITANET-ROBOT] Buscando cliente '${login}' na nova listagem de clientes (/novo/clientes)...`);
            await page.goto('https://sistema.receitanet.net/novo/clientes', { waitUntil: 'networkidle2', timeout: 20000 });
            
            // Aguarda a página carregar
            await page.waitForSelector('input', { timeout: 10000 });
            
            // Procura e preenche o campo de busca de login específico na página
            console.log(`[RECEITANET-ROBOT] Localizando campo de filtro de LOGIN...`);
            const filterSuccess = await page.evaluate((targetLogin) => {
                const inputs = Array.from(document.querySelectorAll('input'));
                
                // Busca por input que contenha login no ID, Name ou Placeholder
                let loginInput = inputs.find(i => {
                    const id = (i.id || '').toLowerCase();
                    const name = (i.name || '').toLowerCase();
                    const placeholder = (i.placeholder || '').toLowerCase();
                    return id.includes('login') || name.includes('login') || placeholder.includes('login');
                });
                
                // Fallback para campos de filtro gerais
                if (!loginInput) {
                    loginInput = inputs.find(i => {
                        const placeholder = (i.placeholder || '').toLowerCase();
                        const name = (i.name || '').toLowerCase();
                        return placeholder.includes('buscar') || placeholder.includes('filtrar') || placeholder.includes('pesquisar') || name.includes('busca') || name.includes('filtro');
                    });
                }
                
                if (loginInput) {
                    loginInput.value = targetLogin;
                    loginInput.dispatchEvent(new Event('input', { bubbles: true }));
                    loginInput.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
                return false;
            }, login);

            if (!filterSuccess) {
                console.log(`[RECEITANET-ROBOT WARNING] Campo específico de busca não localizado por atributos. Tentando digitação direta no primeiro input visível...`);
                const firstInput = await page.$('input[type="text"], input:not([type="hidden"])');
                if (firstInput) {
                    await firstInput.click();
                    await page.evaluate(el => el.value = '', firstInput);
                    await firstInput.type(login);
                }
            }
            
            // Aguarda a tabela filtrar via AJAX
            console.log(`[RECEITANET-ROBOT] Aguardando filtragem da listagem...`);
            await new Promise(r => setTimeout(r, 4000));
            
            // Clica no link com o login correspondente na tabela (suporta td, span e a)
            console.log(`[RECEITANET-ROBOT] Clicando no registro do cliente na tabela...`);
            await Promise.all([
                page.evaluate((targetLogin) => {
                    const elements = Array.from(document.querySelectorAll('a, td, span'));
                    const match = elements.find(el => {
                        const txt = el.textContent.trim();
                        return txt === targetLogin || txt === `${targetLogin}suspenso`;
                    });
                    
                    if (match) {
                        const clickable = match.tagName === 'A' ? match : (match.closest('a') || match);
                        clickable.click();
                    } else {
                        throw new Error("Login não localizado nos textos da tabela.");
                    }
                }, login),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 })
            ]);
            
            loadedFicha = true;
            console.log(`[RECEITANET-ROBOT] Ficha carregada via listagem de clientes: ${page.url()}`);
        } catch (tblErr) {
            console.log(`[RECEITANET-ROBOT WARNING] Falha ao achar pela listagem (/novo/clientes): ${tblErr.message}. Tentando busca global por autocomplete...`);
        }
        
        if (!loadedFicha) {
            console.log(`[RECEITANET-ROBOT] Buscando cliente '${login}' pela busca global...`);
            await page.goto(CADASTRO_CLIENTE_URL, { waitUntil: 'networkidle2' });
            
            const searchSelector = 'input[placeholder*="Nome/Login"], input[placeholder*="Digite o Nome"], input.input';
            await page.waitForSelector(searchSelector, { timeout: 10000 });
            
            // Tenta buscar com cada termo (CPF primeiro, depois Nome, depois Login) até o dropdown aparecer
            for (const termo of termosBusca) {
                console.log(`[RECEITANET-ROBOT] Pesquisando termo '${termo}' no autocomplete...`);
                await page.click(searchSelector);
                
                await page.evaluate((sel) => {
                    document.querySelector(sel).value = '';
                }, searchSelector);
                
                await page.type(searchSelector, termo);
                
                // Aguarda o dropdown de sugestões aparecer no DOM
                console.log(`[RECEITANET-ROBOT] Aguardando o menu de sugestões (jQuery UI) ficar visível para '${termo}'...`);
                const dropdownSelector = 'ul.ui-autocomplete li.ui-menu-item, .ui-menu-item, .autocomplete-suggestion';
                
                try {
                    await page.waitForSelector(dropdownSelector, { timeout: 8000 });
                    
                    // Clica na primeira sugestão carregada e aguarda a navegação
                    console.log(`[RECEITANET-ROBOT] Clicando na sugestão do autocomplete...`);
                    await Promise.all([
                        page.click(dropdownSelector),
                        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 })
                    ]);
                    
                    loadedFicha = true;
                    console.log(`[RECEITANET-ROBOT] Ficha carregada com sucesso via autocomplete: ${page.url()}`);
                    break; // Sai do loop se der certo
                } catch (autoErr) {
                    console.log(`[RECEITANET-ROBOT WARNING] Autocomplete não abriu para o termo '${termo}': ${autoErr.message}`);
                }
            }
        }
        
        if (!loadedFicha) {
            throw new Error(`Não foi possível carregar a ficha cadastral do cliente '${login}' por nenhum método.`);
        }
        
        return page.url();
    }
}

module.exports = new ReceitanetRobotService();
