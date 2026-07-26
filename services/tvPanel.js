const axios = require('axios');
const querystring = require('querystring');
const receitanetRobot = require('./receitanetRobot');
require('dotenv').config();

const MOCK_MODE = process.env.MOCK_TV === 'true';
const RECEITANET_CRM_URL = process.env.RECEITANET_CRM_URL || 'https://sistema.receitanet.net/novo/crm/formulario/2445';
const PLANO_INTERNET = process.env.RECEITANET_PLANO_INTERNET || '12806';
const PLANO_TV = process.env.RECEITANET_PLANO_TV || '33891';

// Helpers de formatação
function formatCPF(cpf) {
    if (!cpf) return '';
    const clean = cpf.replace(/\D/g, '');
    if (clean.length === 11) {
        return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}`;
    }
    return cpf;
}

function formatPhone(phone) {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11) {
        return `(${clean.substring(0, 2)})${clean.substring(2, 7)}-${clean.substring(7)}`;
    } else if (clean.length === 10) {
        return `(${clean.substring(0, 2)})${clean.substring(2, 6)}-${clean.substring(6)}`;
    }
    return phone;
}

async function isLoginTaken(login) {
    const dbClient = require('../database').db;
    return new Promise((resolve) => {
        dbClient.get('SELECT id FROM assinaturas WHERE login_tv = ?', [login], (err, row) => {
            if (row) resolve(true);
            else resolve(false);
        });
    });
}

async function generateUniqueLogin(nomeCompleto) {
    const normalized = nomeCompleto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .trim();

    const parts = normalized.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) return `user${Math.floor(Math.random() * 1000)}@tvplus`;

    const firstName = parts[0];
    const lastNameParts = parts.slice(1);

    // Tentativa 1: primeiro_nome@tvplus (ex: thiago@tvplus)
    let candidate = `${firstName}@tvplus`;
    if (!(await isLoginTaken(candidate))) return candidate;

    // Tentativa 2: primeiro_nome + inicial_do_segundo_nome@tvplus (ex: thiagop@tvplus)
    if (lastNameParts.length > 0) {
        candidate = `${firstName}${lastNameParts[0][0]}@tvplus`;
        if (!(await isLoginTaken(candidate))) return candidate;
    }

    // Tentativa 3: primeiro_nome + iniciais_de_todos_os_sobrenomes@tvplus (ex: thiagopb@tvplus)
    if (lastNameParts.length > 1) {
        const initials = lastNameParts.map(p => p[0]).join('');
        candidate = `${firstName}${initials}@tvplus`;
        if (!(await isLoginTaken(candidate))) return candidate;
    }

    // Tentativa 4: primeiro_nome + iniciais + número incremental (ex: thiagopb2@tvplus)
    const base = lastNameParts.length > 0 
        ? `${firstName}${lastNameParts.map(p => p[0]).join('')}`
        : firstName;
        
    let counter = 2;
    while (true) {
        candidate = `${base}${counter}@tvplus`;
        if (!(await isLoginTaken(candidate))) return candidate;
        counter++;
    }
}

/**
 * Serviço de Integração com o CRM do ReceitaNet para cadastro de leads e controle do SVA CDNTV
 */
class TvPanelService {
    /**
     * Cadastra um novo lead no ReceitaNet com planos e gera as credenciais do SVA CDNTV
     * @param {object} cliente - { nome, email, telefone, cpfcnpj, cep, endereco, numero, complemento, bairro, cidade, uf }
     * @returns {Promise<{login: string, senha: string, receitanet_lead_id: string}>}
     */
    async cadastrarCliente(cliente) {
        // Gerar login único seguindo o padrão @tvplus e senha numérica de 6 dígitos
        const login = await generateUniqueLogin(cliente.nome);
        const senha = `${Math.floor(100000 + Math.random() * 900000)}`;

        if (MOCK_MODE) {
            console.log(`[RECEITANET-MOCK] Cadastrando lead no ReceitaNet...`);
            console.log(`Dados SVA: Login: ${login} | Senha: ${senha}`);
            return {
                login,
                senha,
                receitanet_lead_id: 'mock_lead_' + Math.floor(Math.random() * 10000)
            };
        }

        console.log(`[RECEITANET-REAL] Enviando lead para o ReceitaNet: ${cliente.nome}`);
        
        try {
            const payload = {
                nome: cliente.nome,
                cpfcnpj: formatCPF(cliente.cpfcnpj || '000.000.000-00'),
                rgie: '',
                datanascimento: '2000-01-01',
                email: cliente.email,
                telefone1: formatPhone(cliente.telefone),
                telefone2: formatPhone(cliente.telefone),
                cep: cliente.cep || '25555-355',
                endereco: (cliente.endereco || 'RUA DE TESTE').toUpperCase(),
                numero: cliente.numero || 'S/N',
                complemento: (cliente.complemento || 'CASA').toUpperCase(),
                referencia: '',
                bairro: (cliente.bairro || 'CENTRO').toUpperCase(),
                cidade: (cliente.cidade || 'SAO JOAO DE MERITI').toUpperCase(),
                uf: (cliente.uf || 'RJ').toUpperCase(),
                observacaocliente: 'Adesao via Landing Page TV-Pix.',
                valorinstalacao: '0.00',
                plano1: PLANO_INTERNET,
                plano2: PLANO_TV,
                observacaonegocio: `SVA CDNTV Trial 4h. Credenciais geradas - Login: ${login} / Senha: ${senha}`
            };

            const bodyString = querystring.stringify(payload);

            const response = await axios.post(RECEITANET_CRM_URL, bodyString, {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const data = response.data;
            console.log(`[RECEITANET-REAL] Resposta recebida:`, JSON.stringify(data));

            if (data.success === true || data.success === 'true') {
                const leadId = data.id || `lead_${Date.now()}`;
                console.log(`[RECEITANET-REAL] Lead cadastrado com sucesso no ReceitaNet. ID: ${leadId}`);
                return {
                    login,
                    senha,
                    receitanet_lead_id: leadId.toString()
                };
            } else {
                const errors = data.errors ? JSON.stringify(data.errors) : 'Erro desconhecido no ReceitaNet.';
                throw new Error(`Falha no CRM ReceitaNet: ${errors}`);
            }

        } catch (error) {
            console.error('[RECEITANET-REAL ERROR] Erro na requisição CRM:', error.message);
            throw new Error(`Erro na API do ReceitaNet: ${error.message}`);
        }
    }

    /**
     * Bloqueia o sinal SVA do cliente localmente
     * @param {string} login - Login do usuário na TV
     * @returns {Promise<boolean>}
     */
    async bloquearCliente(login) {
        console.log(`[RECEITANET] Robô de TV bloqueando sinal para: ${login} (remoto ReceitaNet)`);
        try {
            await receitanetRobot.bloquearCliente(login);
            return true;
        } catch (e) {
            console.error(`[RECEITANET-PANEL ERROR] Falha ao bloquear cliente remoto no ReceitaNet:`, e.message);
            return false;
        }
    }

    /**
     * Reativa o sinal SVA do cliente no ReceitaNet
     * @param {string} login - Login do usuário na TV
     * @returns {Promise<boolean>}
     */
    async reativarCliente(login) {
        console.log(`[RECEITANET] Robô de TV reativando sinal para: ${login} (remoto ReceitaNet)`);
        try {
            await receitanetRobot.reativarCliente(login);
            return true;
        } catch (e) {
            console.error(`[RECEITANET-PANEL ERROR] Falha ao reativar cliente remoto no ReceitaNet:`, e.message);
            return false;
        }
    }
}

module.exports = new TvPanelService();
