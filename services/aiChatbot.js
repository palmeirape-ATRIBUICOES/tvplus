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

        // 1. Obtém o estado atual da conversa (modo 'IA', 'HUMANO' ou 'CADASTRO_COLETA')
        const estado = await helpers.obterEstadoBot(fone);

        // Se a conversa está em MODO HUMANO, o robô não responde para não interferir na conversa do atendente
        if (estado && estado.modo === 'HUMANO') {
            console.log(`[IA CHATBOT] Atendimento em MODO HUMANO para +${fone}. Robô em silêncio.`);
            return;
        }

        // Se a conversa está em MODO CADASTRO_COLETA, executa o fluxo interativo de preenchimento
        if (estado && estado.modo === 'CADASTRO_COLETA') {
            await this.processarColetaCadastro(fone, mensagemTexto);
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

                // Enfileira o cadastro e provimento do plano CDNTV no ReceitaNet ERP usando exatamente o mesmo fluxo dos usuários pagos do site
                const receitanetQueue = require('./receitanetQueue');
                receitanetQueue.adicionarTarefa('CADASTRO_E_ATIVACAO', {
                    cliente: { nome: `Cliente Teste ${novoTeste.login_tv}`, email: `${novoTeste.login_tv}`, telefone: fone, cpfcnpj: '00000000000' },
                    loginTv: novoTeste.login_tv,
                    senhaTv: novoTeste.senha_tv
                });

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

    /**
     * Fluxo de Coleta de Dados Interativa para Clientes Convertidos de Testes
     */
    async processarColetaCadastro(fone, mensagemTexto) {
        const { db } = require('../database');
        
        // 1. Obtém o estado atual da coleta
        const dados = await new Promise((resolve) => {
            db.get('SELECT * FROM coleta_cadastro WHERE telefone = ?', [fone], (err, row) => resolve(row));
        });

        if (!dados) {
            // Se por algum motivo o registro não existir, recria na etapa NOME
            await new Promise((resolve) => {
                db.run("INSERT INTO coleta_cadastro (telefone, etapa) VALUES (?, 'NOME')", [fone], () => resolve());
            });
            await whatsappService.enviarMensagem(fone, "Ops! Ocorreu um pequeno erro de sincronização. Vamos iniciar seu cadastro definitivo.\n\n👉 *Qual é o seu NOME COMPLETO?*");
            return;
        }

        const etapa = dados.etapa || 'NOME';
        const msgLimpa = mensagemTexto.trim();
        const msgLower = msgLimpa.toLowerCase();

        switch (etapa) {
            case 'NOME':
                // Valida se enviou nome e sobrenome
                const partesNome = msgLimpa.split(/\s+/);
                if (partesNome.length < 2) {
                    await whatsappService.enviarMensagem(fone, "Por favor, informe o seu *NOME COMPLETO* (Nome e Sobrenome) para o cadastro:");
                    return;
                }
                
                await new Promise((resolve) => {
                    db.run("UPDATE coleta_cadastro SET nome = ?, etapa = 'CPF' WHERE telefone = ?", [msgLimpa, fone], () => resolve());
                });
                await whatsappService.enviarMensagem(fone, `Obrigado, *${msgLimpa}*! ✍️\n\n👉 Agora, informe o seu *CPF* (apenas os 11 números, sem pontos ou traços):`);
                break;

            case 'CPF':
                const cpfLimpo = msgLimpa.replace(/\D/g, '');
                if (cpfLimpo.length !== 11) {
                    await whatsappService.enviarMensagem(fone, "⚠️ *CPF inválido.* Por favor, digite o seu CPF correto com exatamente 11 números:");
                    return;
                }

                await new Promise((resolve) => {
                    db.run("UPDATE coleta_cadastro SET cpf = ?, etapa = 'CEP' WHERE telefone = ?", [cpfLimpo, fone], () => resolve());
                });
                await whatsappService.enviarMensagem(fone, "Perfeito! 💳\n\n👉 Agora, me informe o seu *CEP* (apenas os 8 números):");
                break;

            case 'CEP':
                const cepLimpo = msgLimpa.replace(/\D/g, '');
                if (cepLimpo.length !== 8) {
                    await whatsappService.enviarMensagem(fone, "⚠️ *CEP inválido.* Por favor, digite o seu CEP correto com exatamente 8 números:");
                    return;
                }

                await whatsappService.enviarMensagem(fone, "Buscando endereço...");
                
                let localizouCep = false;
                let logradouro = '', bairro = '', localidade = '', uf = '';
                try {
                    const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
                    const cepData = await res.json();
                    if (cepData && !cepData.erro) {
                        logradouro = cepData.logradouro || '';
                        bairro = cepData.bairro || '';
                        localidade = cepData.localidade || '';
                        uf = cepData.uf || '';
                        localizouCep = true;
                    }
                } catch (e) {
                    console.error("Erro ao buscar CEP:", e.message);
                }

                if (localizouCep) {
                    await new Promise((resolve) => {
                        db.run(
                            `UPDATE coleta_cadastro 
                             SET cep = ?, endereco = ?, bairro = ?, cidade = ?, uf = ?, etapa = 'NUMERO' 
                             WHERE telefone = ?`,
                            [cepLimpo, logradouro, bairro, localidade, uf, fone],
                            () => resolve()
                        );
                    });

                    const msgEndereco = `📍 *Endereço localizado:*\n` +
                                       `• Rua: ${logradouro}\n` +
                                       `• Bairro: ${bairro}\n` +
                                       `• Cidade/UF: ${localidade}/${uf}\n\n` +
                                       `👉 *Qual é o número da sua residência?*`;
                    await whatsappService.enviarMensagem(fone, msgEndereco);
                } else {
                    // CEP não localizado, pede endereço completo manualmente
                    await new Promise((resolve) => {
                        db.run("UPDATE coleta_cadastro SET cep = ?, etapa = 'ENDERECO' WHERE telefone = ?", [cepLimpo, fone], () => resolve());
                    });
                    await whatsappService.enviarMensagem(fone, "⚠️ Não consegui localizar o seu CEP automaticamente.\n\n👉 Por favor, digite o seu *Endereço Completo* (Rua, Bairro, Cidade e Estado):");
                }
                break;

            case 'ENDERECO':
                if (msgLimpa.length < 5) {
                    await whatsappService.enviarMensagem(fone, "Por favor, digite o seu endereço completo detalhado:");
                    return;
                }

                await new Promise((resolve) => {
                    db.run("UPDATE coleta_cadastro SET endereco = ?, etapa = 'NUMERO' WHERE telefone = ?", [msgLimpa, fone], () => resolve());
                });
                await whatsappService.enviarMensagem(fone, "👉 *Qual é o número da sua residência?*");
                break;

            case 'NUMERO':
                if (msgLimpa.length === 0) {
                    await whatsappService.enviarMensagem(fone, "Por favor, informe o número da sua residência:");
                    return;
                }

                await new Promise((resolve) => {
                    db.run("UPDATE coleta_cadastro SET numero = ?, etapa = 'CONFIRMACAO' WHERE telefone = ?", [msgLimpa, fone], () => resolve());
                });

                // Recupera os dados completos para confirmação
                const confirmDados = await new Promise((resolve) => {
                    db.get('SELECT * FROM coleta_cadastro WHERE telefone = ?', [fone], (err, row) => resolve(row));
                });

                const msgConfirm = `📋 *Por favor, confirme os seus dados de cadastro:*\n\n` +
                                   `👤 *Nome:* ${confirmDados.nome}\n` +
                                   `🆔 *CPF:* ${confirmDados.cpf}\n` +
                                   `📍 *Endereço:* ${confirmDados.endereco}, Nº ${confirmDados.numero}\n` +
                                   `🏘️ *Bairro:* ${confirmDados.bairro || 'Não informado'}\n` +
                                   `🏙️ *Cidade/UF:* ${confirmDados.cidade || 'Não informado'}/${confirmDados.uf || ''}\n` +
                                   `📬 *CEP:* ${confirmDados.cep}\n\n` +
                                   `Está tudo correto? Responda *SIM* para confirmar ou *NÃO* para recomeçar.`;
                
                await whatsappService.enviarMensagem(fone, msgConfirm);
                break;

            case 'CONFIRMACAO':
                if (msgLower === 'sim' || msgLower === 's' || msgLower === 'sim, correto' || msgLower === 'correto' || msgLower === 'certo') {
                    await whatsappService.enviarMensagem(fone, "Processando o seu cadastro definitivo...");

                    // 1. Atualiza dados do cliente na tabela clientes
                    const cliente = await new Promise((resolve) => {
                        db.get('SELECT * FROM clientes WHERE telefone = ?', [fone], (err, row) => resolve(row));
                    });

                    if (cliente) {
                        await new Promise((resolve) => {
                            db.run(
                                `UPDATE clientes 
                                 SET nome = ?, cpfcnpj = ?, cep = ?, endereco = ?, numero = ?, bairro = ?, cidade = ?, uf = ?
                                 WHERE id = ?`,
                                [dados.nome, dados.cpf, dados.cep, dados.endereco, dados.numero, dados.bairro, dados.cidade, dados.uf, cliente.id],
                                () => resolve()
                            );
                        });

                        // 2. Enfileira a ativação real no ReceitaNet ERP
                        const receitanetQueue = require('./receitanetQueue');
                        receitanetQueue.adicionarTarefa('CADASTRO_E_ATIVACAO', {
                            cliente: {
                                id: cliente.id,
                                nome: dados.nome,
                                cpfcnpj: dados.cpf,
                                cep: dados.cep,
                                endereco: dados.endereco,
                                numero: dados.numero,
                                bairro: dados.bairro,
                                cidade: dados.cidade,
                                uf: dados.uf,
                                telefone: fone,
                                email: `${dados.login_tv}@tvplus.com`
                            },
                            loginTv: dados.login_tv,
                            senhaTv: dados.senha_tv
                        });
                    }

                    // 3. Limpa o estado e restaura o robô para modo IA
                    await new Promise((resolve) => {
                        db.run('DELETE FROM coleta_cadastro WHERE telefone = ?', [fone], () => resolve());
                    });
                    const { helpers } = require('../database');
                    await helpers.definirModoBot(fone, 'IA');

                    const msgSucesso = `🎉 *CONCLUÍDO COM SUCESSO!* 🎉\n\n` +
                                       `Seus dados foram salvos e a ativação definitiva foi enfileirada no ERP.\n\n` +
                                       `Muito obrigado pela preferência e aproveite o melhor sinal de TV! 📺✨`;
                    await whatsappService.enviarMensagem(fone, msgSucesso);

                } else if (msgLower === 'não' || msgLower === 'nao' || msgLower === 'n' || msgLower === 'incorreto') {
                    // Reseta para a etapa NOME
                    await new Promise((resolve) => {
                        db.run("UPDATE coleta_cadastro SET etapa = 'NOME' WHERE telefone = ?", [fone], () => resolve());
                    });
                    await whatsappService.enviarMensagem(fone, "Sem problemas! Vamos recomeçar.\n\n👉 *Qual é o seu NOME COMPLETO?*");
                } else {
                    await whatsappService.enviarMensagem(fone, "Por favor, responda apenas *SIM* para confirmar os dados ou *NÃO* para recomeçar o preenchimento:");
                }
                break;
        }
    }
}

module.exports = new AiChatbotService();
