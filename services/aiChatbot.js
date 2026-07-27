const { helpers } = require('../database');
const whatsappService = require('./whatsapp');

/**
 * Agente de Atendimento Inteligente por IA para o WhatsApp da AuraTV / SignalPlay
 */
class AiChatbotService {
    /**
     * Processa a mensagem recebida de um cliente
     * @param {string} telefone - Telefone do cliente (com DDI e DDD)
     * @param {string} mensagemTexto - Texto enviado pelo cliente
     */
    async processarMensagemEntrada(telefone, mensagemTexto) {
        if (!telefone || !mensagemTexto) return;
        const texto = mensagemTexto.trim().toLowerCase();
        const fone = telefone.replace(/\D/g, '');

        console.log(`[IA CHATBOT] Mensagem recebida de +${fone}: "${mensagemTexto}"`);

        // 1. Obtém o estado atual da conversa (modo 'IA' ou 'HUMANO')
        const estado = await helpers.obterEstadoBot(fone);

        // Se a conversa está em MODO HUMANO, o robô não responde para não interferir na conversa do atendente
        if (estado && estado.modo === 'HUMANO') {
            console.log(`[IA CHATBOT] Atendimento em MODO HUMANO para +${fone}. Robô em silêncio.`);
            return;
        }

        // 2. Verifica se o cliente quer falar com atendente humano
        const palavrasChaveHumano = [
            'falar com atendente', 'atendente', 'humano', 'suporte humano',
            'falar com humano', 'falar com suporte', 'falar com alguem', 'falar com pessoa',
            'preciso de ajuda humana', 'operador'
        ];

        const solicitaHumano = palavrasChaveHumano.some(p => texto.includes(p));

        if (solicitaHumano) {
            console.log(`[IA CHATBOT] Cliente +${fone} solicitou ATENDIMENTO HUMANO! Pausando robô...`);
            
            // Alterna o modo da conversa para HUMANO no banco de dados
            await helpers.definirModoBot(fone, 'HUMANO');

            // Avisa o cliente que o suporte humano foi acionado
            const msgCliente = `Entendido! 👨‍💻 Pausei o meu atendimento automático e avisei a nossa equipe.\n\n` +
                               `Um atendente humano irá conversar com você por aqui em instantes. Aguarde um momento!`;
            await whatsappService.enviarMensagem(fone, msgCliente);

            // Notifica o Administrador no WhatsApp sobre a solicitação de suporte
            const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || fone;
            const avisoAdmin = `⚠️ *SOLICITAÇÃO DE ATENDIMENTO HUMANO*\n\n` +
                               `O cliente do número *+${fone}* pediu para falar com um atendente humano.\n` +
                               `O robô IA foi *pausado* para este número. Você pode responder diretamente por aqui ou gerenciar no painel admin (/admin.html).`;
            
            if (adminPhone !== fone) {
                await whatsappService.enviarMensagem(adminPhone, avisoAdmin);
            }
            return;
        }

        // 3. Respostas Inteligentes Pré-Configuradas (FAQ & Suporte Automatizado)
        let respostaIA = '';

        if (texto.includes('valor') || texto.includes('preço') || texto.includes('quanto') || texto.includes('plano') || texto.includes('mensalidade')) {
            respostaIA = `Olá! 📺 O nosso plano completo do aplicativo *SIGNALPLAY* custa apenas *R$ 10,00 por mês* (ou R$ 10,00 a cada 30 dias).\n\n` +
                         `✨ *Benefícios do Plano:*\n` +
                         `• Acesso a todos os canais de TV, filmes e séries.\n` +
                         `• Permite assistir em *ATÉ 3 aparelhos ao mesmo tempo*.\n` +
                         `• Sem fidelidade, cancele ou renove quando quiser.\n\n` +
                         `Deseja realizar o teste grátis ou já quer assinar por Pix?`;
        } else if (texto.includes('instalar') || texto.includes('baixar') || texto.includes('app') || texto.includes('aplicativo') || texto.includes('tv') || texto.includes('link') || texto.includes('firestick')) {
            respostaIA = `📱 *Links Oficiais de Download do SIGNALPLAY:*\n\n` +
                         `🍏 *Para iPhone / iPad / Apple TV (iOS):*\n` +
                         `https://apps.apple.com/br/app/signalplay/id6749374183\n\n` +
                         `🤖 *Para Android (Celular, Smart TV, TV Box & Firestick):*\n` +
                         `https://play.google.com/store/apps/details?id=br.com.signalplay.tv.mobile&hl=pt_BR\n\n` +
                         `💻 *Assistir no Computador / PC:* \n` +
                         `https://tv.signalplay.com.br/login\n\n` +
                         `Basta abrir o aplicativo no seu dispositivo e inserir seu Usuário e Senha para assistir em *até 3 telas ao mesmo tempo*!`;
        } else if (texto.includes('teste') || texto.includes('testar') || texto.includes('gratis') || texto.includes('gratuito')) {
            // Checa se este número já realizou teste grátis anteriormente (trava de uso único por número)
            const testeExistente = await helpers.obterTestePorTelefone(fone);

            if (testeExistente) {
                respostaIA = `⚠️ *Você já solicitou um teste grátis anteriormente com este número!*\n\n` +
                             `Cada cliente tem direito a apenas 1 teste grátis por número de WhatsApp.\n\n` +
                             `Para ter acesso completo por 30 dias a todos os canais de TV, filmes e séries em até 3 telas simultâneas, assine agora por apenas *R$ 10,00/mês* acessando nosso site:\n` +
                             `👉 https://tv-pix-platform.onrender.com`;
            } else {
                // Gera novo teste sequencial (ex: teste1@tvplus, teste2@tvplus) válido por 3 horas
                const novoTeste = await helpers.criarNovoTeste(fone);

                // Dispara o robô em segundo plano para cadastrar e ativar o sinal do teste no ReceitaNet ERP
                const robot = require('./receitanetRobot');
                robot.cadastrarEAtivarTV(
                    { nome: `Cliente Teste ${novoTeste.login_tv}`, email: novoTeste.login_tv, telefone: fone },
                    novoTeste.login_tv,
                    novoTeste.senha_tv
                ).catch(err => console.error(`[IA TESTE ROBOT ERROR]:`, err.message));

                const expiraHora = new Date(novoTeste.data_expiracao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                respostaIA = `🎁 *SEU TESTE GRÁTIS DO SIGNALPLAY FOI GERADO COM SUCESSO!* 🎁\n\n` +
                             `⚠️ *Lembrando:* Este é um teste temporário *válido por 3 HORAS* (expira às *${expiraHora}*).\n\n` +
                             `🔑 *Seus dados de teste (Acesso de TV):*\n` +
                             `• Usuário: *${novoTeste.login_tv}*\n` +
                             `• Senha: *${novoTeste.senha_tv}*\n` +
                             `⏱️ Validade: *3 Horas (Expirará às ${expiraHora})*\n\n` +
                             `📱 *Links para Baixar o SIGNALPLAY:*\n\n` +
                             `🍏 *iPhone / iPad / Apple TV (iOS):*\n` +
                             `https://apps.apple.com/br/app/signalplay/id6749374183\n\n` +
                             `🤖 *Android (Celular, Smart TV, TV Box & Firestick):*\n` +
                             `https://play.google.com/store/apps/details?id=br.com.signalplay.tv.mobile&hl=pt_BR\n\n` +
                             `💻 *Assistir no Computador / PC (Navegador):*\n` +
                             `https://tv.signalplay.com.br/login\n\n` +
                             `📋 *Como Acessar:*\n` +
                             `1. Baixe o app no link acima ou abra no PC.\n` +
                             `2. Digite o Usuário *${novoTeste.login_tv}* e Senha *${novoTeste.senha_tv}*.\n\n` +
                             `Aproveite seus canais favoritos e tenha uma ótima experiência! 📺✨`;
            }
        } else if (texto.includes('pix') || texto.includes('pagar') || texto.includes('renovar') || texto.includes('pagamento')) {
            respostaIA = `💳 *Renovação via Pix:*\n\n` +
                         `Para renovar sua assinatura por R$ 10,00 (30 dias), acesse nosso painel ou peça o seu Pix por aqui!\n` +
                         `Lembrando que o Pix Copia e Cola é enviado em uma mensagem separada para facilitar o envio no app do seu banco.`;
        } else if (texto.includes('oi') || texto.includes('olá') || texto.includes('boa tarde') || texto.includes('bom dia') || texto.includes('boa noite') || texto.includes('menu')) {
            respostaIA = `Olá! 👋 Seja bem-vindo ao atendimento automático da *AuraTV / SIGNALPLAY*!\n\n` +
                         `Como posso te ajudar hoje?\n` +
                         `1️⃣ Digite *Valores* para saber preços e regras de 3 telas.\n` +
                         `2️⃣ Digite *Instalar* para ver como baixar o app SIGNALPLAY.\n` +
                         `3️⃣ Digite *Teste* para liberar seu teste grátis.\n` +
                         `4️⃣ Digite *Falar com atendente* para ser transferido para um suporte humano!`;
        } else {
            respostaIA = `Obrigado pelo contato! 🤖 Entendi sua mensagem.\n\n` +
                         `Para saber sobre preços e telas, digite *Valores*.\n` +
                         `Para baixar o app, digite *Instalar*.\n` +
                         `Caso deseje conversar diretamente com o nosso suporte, digite *Falar com atendente*!`;
        }

        // 4. Envia a resposta da IA para o cliente
        if (respostaIA) {
            console.log(`[IA CHATBOT] Enviando resposta para +${fone}...`);
            await whatsappService.enviarMensagem(fone, respostaIA);
        }
    }
}

module.exports = new AiChatbotService();
