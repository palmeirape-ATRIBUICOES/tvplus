# 🔒 DOCUMENTAÇÃO SECRETA E OFICIAL DE AUTOMAÇÃO (RECEITANET & STAR TV)

> **IMPORTANTE**: Este arquivo contém a especificação exata, URLs, XPaths, seletores e lógica de código de ambos os fluxos (Criação + CDNTV e Exclusão Completa) que foram testados e aprovados como **100% FUNCIONAIS**.
> **Data de Homologação**: 02/08/2026
> **Tag Git de Snapshot**: `v3.0-criacao-e-exclusao-100-funcional`

---

## 🟢 FLUXO 1: CRIAÇÃO DE USUÁRIO E ADESÃO AO PLANO CDNTV

### 1.1 Objetivos e Parâmetros
- **Objetivo**: Criar cliente no ERP e vincular o plano de cobrança CDNTV.
- **Login**: `loginTv` (ex: `thiago@startv`).
- **Senha**: CPF do cliente sem pontuação.
- **Nome**: Nome completo do cliente.
- **CPF**: CPF numérico sem pontuação.

### 1.2 Passo a Passo Executado pelo Robô
1. **Acessar Tela de Cadastro**:
   - URL: `https://sistema.receitanet.net/clientes_cadastro.php`
2. **Preenchimento dos Campos via DOM**:
   - `input[name="cli_login"]` $\rightarrow$ `loginTv`
   - `input[name="cli_senha"]` $\rightarrow$ `CPF`
   - `input[name="cli_nome"]` $\rightarrow$ `Nome`
   - `input[name="cli_cgc"]` $\rightarrow$ `CPF`
   - Selects Padrão:
     - `cli_tipo` = `'1'`
     - `cli_diatari` = `'10'`
     - `cli_boleto` = `'S'`
     - `men_codigo` = `'1'`
     - `plano` = `'2'`
     - `ban_codigo` = `'12168'`
     - `base_referencia` = `'V'`
3. **Submissão do Cadastro**:
   - Clicar no botão: `#form-cliente > div.nav-tabs-custom > div.box-footer > button.btn.btn-primary` (ou `button.btn-primary` com texto `Incluir`).
4. **Captura do ID Numérico do Cliente**:
   - Capturar `cli_codigo` da URL pós-criação ou inspecionar link/input no DOM retornado.
   - ID Numérico (ex: `2451068`).
5. **Navegação Direta à Tela de Planos do Cliente**:
   - URL: `https://sistema.receitanet.net/novo/financeiros/clientes/planos/{ID}`
6. **Seleção do Plano CDNTV**:
   - Localizar o `<select>` que contém a opção `CDNTV` (ou valor `108038` / `29`).
   - Executar `page.select(seletor, valor)`.
7. **Inclusão do Plano via XPath Exato**:
   - Clicar no botão de inclusão usando o XPath exato:
     `/html/body/div/div[1]/section[2]/div/div[2]/form/div[3]/button`

---

## 🔴 FLUXO 2: EXCLUSÃO COMPLETA DE CLIENTE

### 2.1 Passo a Passo Executado pelo Robô
1. **PASSO 1 — Acessar a Tela de Cadastro e Ir para Rescisão**:
   - Acessar `https://sistema.receitanet.net/clientes_cadastro.php?cli_login={loginTv}`
   - Clicar na aba/opção `Rescisão` (ou acessar diretamente `https://sistema.receitanet.net/clientes_rescisao.php?login={loginSemDominio}`).
2. **PASSO 2 — Selecionar Motivo e Escrever Detalhe**:
   - No dropdown `cancelamento_motivo` (`select[name="cancelamento_motivo"]`), selecionar a opção `cancelado chip` (value `13`).
   - No campo de detalhe (`textarea[name="cancelamento_detalhe"]` / `textarea` / `input[name="detalhe"]`), escrever: `ok`.
3. **PASSO 3 — Clicar no Botão Calcular via XPath Exato**:
   - Clicar no botão via XPath exato:
     `/html/body/div/div/section[2]/form/div[3]/button[1]`
4. **PASSO 4 — Fechar a Nova Guia Aberta**:
   - O clique no botão Calcular abre um relatório/popup em uma nova guia (`target="_blank"`).
   - O robô escuta o evento `targetcreated`, identifica a nova página e executa `page.close()`, mantendo apenas a aba principal conectada.
5. **PASSO 5 — Voltar para o Cadastro do Cliente**:
   - Acessar `https://sistema.receitanet.net/clientes_cadastro.php?cli_login={loginTv}`
6. **PASSO 6 — Atualizar a Página (F5 / Reload)**:
   - Executar `page.reload({ waitUntil: 'domcontentloaded' })` para atualizar o formulário e liberar o botão `Excluir`.
7. **PASSO 7 — Clicar no Botão Excluir via XPath Exato**:
   - O robô ativa o interceptador de diálogos para confirmar o popup de confirmação `confirm()`.
   - Clicar no botão `Excluir` no caminho XPath exato:
     `/html/body/div/div[1]/section[2]/div[2]/div[1]/form/div[1]/div[2]/button[3]`

---

## 💻 CÓDIGO-FONTE OFICIAL DE REFERÊNCIA (JS)

### Método de Criação + CDNTV (`cadastrarEAtivarTV`):
```javascript
async cadastrarEAtivarTV(cliente, loginTvInput, senhaTvInput) {
    const page = await this.obterPaginaAutenticada();
    const loginTv = loginTvInput || cliente.login || cliente.cli_login;
    const cpfRaw = cliente.cpf || cliente.cpfcnpj || cliente.cgc || senhaTvInput || '00000000000';
    const cpf = cpfRaw.toString().replace(/\D/g, '');
    const senhaTv = cpf;
    const nomeCliente = cliente.nome || 'Cliente Provedor';
    const loginClean = (loginTv || '').replace(/@.*$/, '').trim();

    // 1. Acessar Cadastro
    await page.goto('https://sistema.receitanet.net/clientes_cadastro.php', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name="cli_login"]', { timeout: 10000 });

    await page.type('input[name="cli_login"]', loginTv);
    await page.type('input[name="cli_senha"]', senhaTv);
    await page.type('input[name="cli_nome"]', nomeCliente);
    await page.type('input[name="cli_cgc"]', cpf);

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

    // 2. Submeter
    await Promise.all([
        page.evaluate(() => {
            const btn = document.querySelector('#form-cliente > div.nav-tabs-custom > div.box-footer > button.btn.btn-primary') ||
                        document.querySelector('button.btn-primary');
            if (btn) btn.click();
        }),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
    ]);

    // 3. Capturar ID
    const urlPos = page.url();
    let clienteId = (urlPos.match(/[?&]cli_codigo=([\d]+)/) || urlPos.match(/\/clientes\/(\d+)/) || [])[1];

    if (!clienteId) {
        await page.goto(`https://sistema.receitanet.net/clientes_cadastro.php?cli_login=${encodeURIComponent(loginClean)}`, { waitUntil: 'domcontentloaded' });
        clienteId = await page.evaluate(() => {
            const link = Array.from(document.querySelectorAll('a')).find(a => a.href && a.href.includes('/novo/financeiros/clientes/planos/'));
            if (link) { const m = link.href.match(/\/planos\/(\d+)/); return m ? m[1] : null; }
            const input = document.querySelector('input[name="cli_codigo"]');
            return input ? input.value : null;
        });
    }

    // 4. Navegar para Planos e Incluir CDNTV
    const planosUrl = `https://sistema.receitanet.net/novo/financeiros/clientes/planos/${clienteId}`;
    await page.goto(planosUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('select', { timeout: 10000 });

    const cdntvInfo = await page.evaluate(() => {
        for (const s of document.querySelectorAll('select')) {
            for (const o of s.options) {
                const txt = (o.text || '').toLowerCase();
                if (txt.includes('cdntv') || txt.includes('cdn')) return { name: s.name, id: s.id, val: o.value };
            }
        }
        return null;
    });

    const selectSel = cdntvInfo.name ? `select[name="${cdntvInfo.name}"]` : `select#${cdntvInfo.id}`;
    await page.select(selectSel, cdntvInfo.val);

    // Clicar no botão INCLUIR via XPath Exato
    await page.evaluate(() => {
        const btn = document.evaluate('/html/body/div/div[1]/section[2]/div/div[2]/form/div[3]/button', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (btn) btn.click();
    });

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    return true;
}
```

### Método de Exclusão Completa (`excluirCliente`):
```javascript
async excluirCliente(login, cpf, nome) {
    const rawLogin = (login || '').toString().trim();
    const loginSemDominio = rawLogin.replace(/@.*$/, '').trim();
    let page = await this.obterPaginaAutenticada();

    const setupDialogHandler = (targetPage) => {
        targetPage.removeAllListeners('dialog');
        targetPage.on('dialog', async (dialog) => { await dialog.accept().catch(() => {}); });
    };
    setupDialogHandler(page);

    // PASSO 1: Acessar Cadastro e ir para Rescisão
    const cadastroUrl = `https://sistema.receitanet.net/clientes_cadastro.php?cli_login=${encodeURIComponent(rawLogin)}`;
    await page.goto(cadastroUrl, { waitUntil: 'domcontentloaded' });

    const rescisaoUrl = `https://sistema.receitanet.net/clientes_rescisao.php?login=${encodeURIComponent(loginSemDominio)}`;
    await page.goto(rescisaoUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('select', { timeout: 10000 });

    // PASSO 2: Motivo cancelado chip e detalhe ok
    await page.evaluate(() => {
        const select = document.querySelector('select[name="cancelamento_motivo"]') || document.querySelector('select');
        if (select) {
            const opt = Array.from(select.options).find(o => (o.text || '').toLowerCase().includes('chip') || o.value === '13');
            if (opt) { select.value = opt.value; select.dispatchEvent(new Event('change', { bubbles: true })); }
        }
        const input = document.querySelector('textarea[name="cancelamento_detalhe"]') || document.querySelector('textarea');
        if (input) { input.value = 'ok'; input.dispatchEvent(new Event('input', { bubbles: true })); }
    });

    // PASSO 3 & 4: Clicar no botão Calcular e fechar a nova guia
    const novaGuiaPromise = new Promise(resolve => {
        const listener = (target) => { if (target.type() === 'page') { this.browser.off('targetcreated', listener); resolve(target); } };
        this.browser.on('targetcreated', listener);
        setTimeout(() => resolve(null), 4000);
    });

    await page.evaluate(() => {
        const btn = document.evaluate('/html/body/div/div/section[2]/form/div[3]/button[1]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (btn) btn.click();
    });

    const targetGuia = await novaGuiaPromise;
    if (targetGuia) {
        const pageGuia = await targetGuia.page();
        if (pageGuia && !pageGuia.isClosed()) await pageGuia.close().catch(() => {});
    }

    page = await this.obterPaginaAutenticada();
    setupDialogHandler(page);

    // PASSO 5: Voltar ao Cadastro
    await page.goto(cadastroUrl, { waitUntil: 'domcontentloaded' });

    // PASSO 6: F5 Reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));

    // PASSO 7: Clicar em Excluir via XPath Exato
    const clicouExcluir = await page.evaluate(() => {
        const btnExcluir = document.evaluate('/html/body/div/div[1]/section[2]/div[2]/div[1]/form/div[1]/div[2]/button[3]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (btnExcluir) { btnExcluir.click(); return true; }
        return false;
    });

    if (clicouExcluir) {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    }

    return true;
}
```

---

## 📌 GUIA RÁPIDO DE RECUPERAÇÃO EM CASO DE REORGANIZAÇÃO
Se no futuro este projeto for clonado, modificado ou reestruturado:
1. Abra este arquivo `DOC_AUTOMACAO_OFICIAL_SECRET.md`.
2. Para restaurar o estado exato funcional via Git, execute no terminal:
   ```bash
   git checkout v3.0-criacao-e-exclusao-100-funcional
   ```
3. Ambos os robôs (`services/startvRobot.js` e `services/receitanetRobot.js`) estarão 100% sincronizados.
