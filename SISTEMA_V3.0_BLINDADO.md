# 🛡️ SISTEMA V3.0 BLINDADO — PONTO DE RESTAURAÇÃO INVIOLÁVEL

## 📌 Visão Geral
Este documento e as tags de repositório associadas marcam a **Versão 3.0 Blindada Oficial** do sistema.
Tanto a criação rápida de clientes com vinculação automática do plano **CDNTV** quanto o fluxo de **exclusão completa** (via rescisão, fechamento de nova guia e confirmação F5) foram testados, homologados e selados como **100% FUNCIONAIS E PERFEITOS**.

- **Versão no package.json**: `3.0.0`
- **Tags Git**: `v3.0.0-blindado`, `v3.0`
- **Data da Blindagem**: 02/08/2026

---

## ⚙️ Especificação das Funcionalidades Blindadas

### 🟢 1. CRIAÇÃO DE USUÁRIOS + PLANO CDNTV (ALTA VELOCIDADE)
- **Servidores Robôs**: `services/startvRobot.js` e `services/receitanetRobot.js` (método `cadastrarEAtivarTV`)
- **Preenchimento Instantâneo**: Injeção direta no DOM de todos os campos de cadastro (Login, Senha/CPF, Nome, CPF) e selects padrão sem delays artificiais.
- **Captura Resiliente de ID**: Extração automática do `cli_codigo` diretamente do retorno ou URL pós-criação.
- **Inclusão do Plano CDNTV**: Navegação direta a `/novo/financeiros/clientes/planos/{ID}`, seleção do plano via `page.select()` e submissão via XPath exato:
  `/html/body/div/div[1]/section[2]/div/div[2]/form/div[3]/button`

### 🔴 2. EXCLUSÃO COMPLETA DE CLIENTES (PASSOS ESTRITOS)
- **Servidores Robôs**: `services/startvRobot.js` e `services/receitanetRobot.js` (método `excluirCliente`)
- **Passo a Passo Reiniciado e Garantido**:
  1. Acessa `clientes_cadastro.php?cli_login={login}` e vai para a opção **Rescisão** (ou `clientes_rescisao.php?login={loginSemDominio}`).
  2. No dropdown `cancelamento_motivo`, seleciona `cancelado chip`.
  3. No campo detalhe, digita `ok`.
  4. Clica no botão **Calcular** via XPath exato: `/html/body/div/div/section[2]/form/div[3]/button[1]`.
  5. Intercepta e **fecha automaticamente a nova guia/popup** gerada (`pageGuia.close()`), mantendo a sessão do navegador limpa e reconectada.
  6. Retorna ao cadastro `clientes_cadastro.php?cli_login={login}`.
  7. Executa **F5 (reload)** para atualizar a página e liberar o botão Excluir.
  8. Intercepta e aceita automaticamente diálogos `confirm()`.
  9. Clica em **Excluir** via XPath exato:
     `/html/body/div/div[1]/section[2]/div[2]/div[1]/form/div[1]/div[2]/button[3]`

### ⚡ 3. OTIMIZAÇÃO E PERFORMANCE (SEM PRINTS DE TELA)
- **Screenshots Desativados**: O método `tirarScreenshot()` foi transformado em no-op instantâneo para economizar CPU, eliminar consumo de RAM por base64 e acelerar a resposta.

---

## 🛠️ COMO RESTAURAR ESTA VERSÃO SE HOUVER QUALQUER PROBLEMA FUTURO

Se qualquer alteração futura danificar o sistema ou se você precisar retornar a este ponto exato:

```bash
# 1. Obter a versão blindada v3.0 do repositório
git fetch --all --tags
git checkout v3.0.0-blindado

# 2. Restaurar dependências e reiniciar o servidor
npm install
npm start
```

O sistema retornará imediatamente para este estado 100% funcional.
