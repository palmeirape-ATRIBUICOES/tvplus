// Estado do Cliente/Pagamento Atual
let currentTxid = null;
let currentClienteId = null;
let statusInterval = null;

// Validadores de CPF e CNPJ
function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma = soma + parseInt(cpf.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto == 10) || (resto == 11)) resto = 0;
    if (resto != parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma = soma + parseInt(cpf.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto == 10) || (resto == 11)) resto = 0;
    if (resto != parseInt(cpf.substring(10, 11))) return false;
    return true;
}

function validarCNPJ(cnpj) {
    cnpj = cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado != parseInt(digitos.charAt(0))) return false;
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado != parseInt(digitos.charAt(1))) return false;
    return true;
}

function validarDocumento(doc) {
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 11) return validarCPF(clean);
    if (clean.length === 14) return validarCNPJ(clean);
    return false;
}

// Função de Rolagem Suave para o Checkout
window.scrollToCheckout = function() {
    const el = document.getElementById('checkoutSection');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
};

// Elementos do DOM
const stepForm = document.getElementById('stepForm');
const stepPix = document.getElementById('stepPix');
const stepSuccess = document.getElementById('stepSuccess');
const checkoutCard = document.getElementById('checkoutCard');

// Formulário de Cadastro
const cadastroForm = document.getElementById('cadastroForm');
const btnSubmitTrial = document.getElementById('btnSubmitTrial');
const btnSubmitBuy = document.getElementById('btnSubmitBuy');

// Pix e Renovação
const mesesSelect = document.getElementById('mesesSelect');
const btnGerarNovoPix = document.getElementById('btnGerarNovoPix');
const valorTagContainer = document.getElementById('valorTagContainer');
const pixValorDisplay = document.getElementById('pixValorDisplay');
const qrCodeWrapper = document.getElementById('qrCodeWrapper');
const pixQrCode = document.getElementById('pixQrCode');
const pixInstructionsText = document.getElementById('pixInstructionsText');
const copiaColaContainer = document.getElementById('copiaColaContainer');
const pixCopiaCola = document.getElementById('pixCopiaCola');
const btnCopiarPix = document.getElementById('btnCopiarPix');
const btnSimularPix = document.getElementById('btnSimularPix');
const qrOverlay = document.getElementById('qrOverlay');

const statusIndicatorContainer = document.getElementById('statusIndicatorContainer');
const sandboxAreaContainer = document.getElementById('sandboxAreaContainer');

// Credenciais
const resLogin = document.getElementById('resLogin');
const resSenha = document.getElementById('resSenha');

// Admin Panel
const btnOpenAdmin = document.getElementById('btnOpenAdmin');
const btnCloseAdmin = document.getElementById('btnCloseAdmin');
const adminModal = document.getElementById('adminModal');
const btnTriggerCron = document.getElementById('btnTriggerCron');
const btnForceExpiring = document.getElementById('btnForceExpiring');
const btnForceExpired = document.getElementById('btnForceExpired');
const adminOutput = document.getElementById('adminOutput');

/* ========================================================
   Fluxo Principal de Vendas & Checkout
   ======================================================== */

// Função centralizada para submeter o formulário
async function submeterFormulario(tipoCadastro) {
    // Desabilitar botões
    btnSubmitTrial.disabled = true;
    btnSubmitBuy.disabled = true;
    
    const originalTrialHtml = btnSubmitTrial.innerHTML;
    const originalBuyHtml = btnSubmitBuy.innerHTML;

    if (tipoCadastro === 'trial') {
        btnSubmitTrial.innerHTML = `<span>Ativando...</span> <i class="fa-solid fa-spinner fa-spin"></i>`;
    } else {
        btnSubmitBuy.innerHTML = `<span>Gerando Pix...</span> <i class="fa-solid fa-spinner fa-spin"></i>`;
    }

    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const telefone = document.getElementById('telefone').value;
    const cpfcnpj = document.getElementById('cpfcnpj').value;

    try {
        const response = await fetch('/api/cadastro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, telefone, cpfcnpj, tipoCadastro })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro desconhecido ao cadastrar.');
        }
        
        // Se a assinatura de teste foi ativada
        if (data.status === 'ativa') {
            mostrarSucesso(data.login, data.senha);
            return;
        }
        
        // Se for compra direta Pix ou teste expirado, precisamos de pagamento
        if (data.status === 'pendente' || data.status === 'suspensa') {
            currentClienteId = data.cliente_id;
            if (data.message && data.status === 'suspensa') {
                alert(data.message);
            }
            
            // Prepara a tela de Pix
            resetPixUI();

            // Se veio os dados do Pix diretamente (Fluxo Compra Direta)
            if (data.pixQrCode && data.pixCopiaCola) {
                currentTxid = data.txid;
                pixValorDisplay.textContent = `R$ 10,00`;
                
                if (data.pixQrCode.startsWith('data:image')) {
                    pixQrCode.src = data.pixQrCode;
                } else {
                    pixQrCode.src = `data:image/png;base64,${data.pixQrCode}`;
                }
                
                pixCopiaCola.value = data.pixCopiaCola;
                
                // Exibe os containers do Pix
                valorTagContainer.style.display = 'block';
                qrCodeWrapper.style.display = 'block';
                pixInstructionsText.style.display = 'block';
                copiaColaContainer.style.display = 'flex';
                statusIndicatorContainer.style.display = 'block';
                sandboxAreaContainer.style.display = 'block';
                
                // Inicia pooling de confirmação
                iniciarChecagemStatus(currentTxid);
            }
            
            // Transiciona para o passo do Pix
            switchStep(stepForm, stepPix);
        }
        
    } catch (error) {
        alert(`Erro: ${error.message}`);
        btnSubmitTrial.disabled = false;
        btnSubmitBuy.disabled = false;
        btnSubmitTrial.innerHTML = originalTrialHtml;
        btnSubmitBuy.innerHTML = originalBuyHtml;
    }
}

// Vincula os cliques com a validação manual do formulário HTML5 e verificação matemática de documento
btnSubmitTrial.addEventListener('click', () => {
    if (cadastroForm.reportValidity()) {
        const doc = document.getElementById('cpfcnpj').value;
        if (!validarDocumento(doc)) {
            alert('Por favor, digite um CPF ou CNPJ válido.');
            document.getElementById('cpfcnpj').focus();
            return;
        }
        submeterFormulario('trial');
    }
});

btnSubmitBuy.addEventListener('click', () => {
    if (cadastroForm.reportValidity()) {
        const doc = document.getElementById('cpfcnpj').value;
        if (!validarDocumento(doc)) {
            alert('Por favor, digite um CPF ou CNPJ válido.');
            document.getElementById('cpfcnpj').focus();
            return;
        }
        submeterFormulario('buy');
    }
});

// Reset visual dos containers do Pix antes da geração
function resetPixUI() {
    valorTagContainer.style.display = 'none';
    qrCodeWrapper.style.display = 'none';
    pixInstructionsText.style.display = 'none';
    copiaColaContainer.style.display = 'none';
    statusIndicatorContainer.style.display = 'none';
    sandboxAreaContainer.style.display = 'none';
    btnGerarNovoPix.disabled = false;
    btnGerarNovoPix.innerHTML = `<span>Gerar QR Code de Pagamento</span> <i class="fa-solid fa-qrcode"></i>`;
}

// 2. Ação de Gerar Cobrança Pix para Assinatura Suspensa/Renovação
btnGerarNovoPix.addEventListener('click', async () => {
    if (!currentClienteId) {
        alert("Erro: ID do cliente ausente.");
        return;
    }

    btnGerarNovoPix.disabled = true;
    btnGerarNovoPix.innerHTML = `<span>Gerando Pix...</span> <i class="fa-solid fa-spinner fa-spin"></i>`;

    const meses = mesesSelect.value;

    try {
        const response = await fetch('/api/pix/gerar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente_id: currentClienteId, meses })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao gerar Pix.');
        }

        currentTxid = data.txid;

        // Atualiza a UI do Pix
        pixValorDisplay.textContent = `R$ ${data.valor.toFixed(2)}`;
        
        if (data.qrCodeBase64.startsWith('data:image')) {
            pixQrCode.src = data.qrCodeBase64;
        } else {
            pixQrCode.src = `data:image/png;base64,${data.qrCodeBase64}`;
        }
        
        pixCopiaCola.value = data.copiaCola;

        // Exibe os containers do Pix
        valorTagContainer.style.display = 'block';
        qrCodeWrapper.style.display = 'block';
        pixInstructionsText.style.display = 'block';
        copiaColaContainer.style.display = 'flex';
        statusIndicatorContainer.style.display = 'block';
        sandboxAreaContainer.style.display = 'block';

        btnGerarNovoPix.innerHTML = `<span>Pix Gerado com Sucesso</span> <i class="fa-solid fa-check"></i>`;

        // Inicia pooling de confirmação
        iniciarChecagemStatus(currentTxid);

    } catch (error) {
        alert(`Erro ao gerar cobrança: ${error.message}`);
        resetPixUI();
    }
});

// 3. Copiar Chave Pix Copia e Cola
btnCopiarPix.addEventListener('click', () => {
    pixCopiaCola.select();
    pixCopiaCola.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(pixCopiaCola.value).then(() => {
        const originalText = btnCopiarPix.innerHTML;
        btnCopiarPix.innerHTML = `<i class="fa-solid fa-check"></i> Copiado!`;
        btnCopiarPix.style.color = '#00ff80';
        btnCopiarPix.style.borderColor = 'rgba(0, 255, 128, 0.3)';
        
        setTimeout(() => {
            btnCopiarPix.innerHTML = originalText;
            btnCopiarPix.style.color = '';
            btnCopiarPix.style.borderColor = '';
        }, 2000);
    });
});

// 4. Simular Pagamento Pix (Botão Sandbox)
btnSimularPix.addEventListener('click', async () => {
    if (!currentTxid) return;
    
    qrOverlay.classList.add('active');
    
    try {
        const response = await fetch('/api/simular-pagamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ txid: currentTxid })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            pararChecagemStatus();
            mostrarSucesso(data.login, data.senha);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        alert(`Erro na simulação: ${error.message}`);
        qrOverlay.classList.remove('active');
    }
});

// Helpers de Transição e Pooling
function switchStep(fromStep, toStep) {
    fromStep.classList.remove('active');
    setTimeout(() => {
        fromStep.style.display = 'none';
        toStep.style.display = 'block';
        setTimeout(() => {
            toStep.classList.add('active');
        }, 50);
    }, 400);
}

function iniciarChecagemStatus(txid) {
    pararChecagemStatus();
    
    statusInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/status/${txid}`);
            const data = await response.json();
            
            if (data.status === 'pago') {
                pararChecagemStatus();
                mostrarSucesso(data.login, data.senha);
            }
        } catch (error) {
            console.error('Erro ao checar status:', error);
        }
    }, 3000);
}

function pararChecagemStatus() {
    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }
}

function mostrarSucesso(login, senha) {
    resLogin.textContent = login;
    resSenha.textContent = senha;
    
    // Se o overlay do QR Code estiver ativo, desativa
    qrOverlay.classList.remove('active');
    
    // Transiciona para o sucesso (Passo 3)
    if (stepPix.style.display === 'block') {
        switchStep(stepPix, stepSuccess);
    } else {
        switchStep(stepForm, stepSuccess);
    }
}

function resetFlow() {
    pararChecagemStatus();
    currentTxid = null;
    currentClienteId = null;
    
    // Limpar campos
    cadastroForm.reset();
    btnSubmitCadastro.disabled = false;
    btnSubmitCadastro.innerHTML = `<span>Ativar Teste Grátis (4 Horas)</span> <i class="fa-solid fa-bolt"></i>`;
    
    // Voltar para o Passo 1
    stepSuccess.classList.remove('active');
    setTimeout(() => {
        stepSuccess.style.display = 'none';
        stepPix.style.display = 'none';
        stepForm.style.display = 'block';
        setTimeout(() => {
            stepForm.classList.add('active');
        }, 50);
    }, 400);
}

// Utilitário de Cópia Genérico
function copyText(elementId) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector(`#${elementId} + button`);
        const originalIcon = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-check" style="color: #00ff80;"></i>`;
        setTimeout(() => {
            btn.innerHTML = originalIcon;
        }, 1500);
    });
}

/* ========================================================
   Painel do Desenvolvedor (Admin & Simulações)
   ======================================================= */

// Abrir e Fechar Modal
btnOpenAdmin.addEventListener('click', () => adminModal.classList.add('active'));
btnCloseAdmin.addEventListener('click', () => adminModal.classList.remove('active'));

// Fechar ao clicar fora do modal
window.addEventListener('click', (e) => {
    if (e.target === adminModal) {
        adminModal.classList.remove('active');
    }
});

// Logs do Console de Testes
function logAdmin(msg, isError = false) {
    adminOutput.textContent = msg;
    adminOutput.style.color = isError ? '#ff4c4c' : '#39ff14';
    console.log(`[DEV-TEST] ${msg}`);
}

// 1. Executar Cron de Vencimento
btnTriggerCron.addEventListener('click', async () => {
    logAdmin("Disparando rotina de checagem de vencimento e trial...");
    btnTriggerCron.disabled = true;
    
    try {
        const response = await fetch('/api/admin/run-cron', { method: 'POST' });
        const data = await response.json();
        
        if (response.ok) {
            logAdmin(`Cron executado com sucesso: ${data.message}`);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        logAdmin(`Erro ao executar Cron: ${error.message}`, true);
    } finally {
        btnTriggerCron.disabled = false;
    }
});

// 2. Forçar Assinatura Expirando (3 dias antes)
btnForceExpiring.addEventListener('click', async () => {
    logAdmin("Alterando data de expiração do último cliente para daqui a 2 dias...");
    
    try {
        const response = await fetch('/api/admin/force-expiring', { method: 'POST' });
        const data = await response.json();
        
        if (response.ok) {
            logAdmin(`Sucesso! ${data.message}`);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        logAdmin(`Erro: ${error.message}`, true);
    }
});

// 3. Forçar Assinatura Vencida / Teste Expirado (Ontem)
btnForceExpired.addEventListener('click', async () => {
    logAdmin("Alterando data de expiração do último cliente para vencido agora...");
    
    try {
        const response = await fetch('/api/admin/force-expired', { method: 'POST' });
        const data = await response.json();
        
        if (response.ok) {
            logAdmin(`Sucesso! ${data.message}`);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        logAdmin(`Erro: ${error.message}`, true);
    }
});
