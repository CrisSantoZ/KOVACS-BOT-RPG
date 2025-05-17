// index.js - Bot Principal do Discord para Arcádia RPG (V5 Final)

const { Client, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const express = require('express');
require('dotenv').config();
const Arcadia = require('./arcadia_sistema.js');

// --- CONSTANTES DE RESTRIÇÃO DE CANAL ---
const COMANDOS_CANAL_BEMVINDO = ['historia', 'listaracas', 'listaclasses', 'listareinos', 'comandos', 'ping', 'oi', 'arcadia', 'bemvindo'];
const COMANDOS_GERAIS_PERMITIDOS_EM_OUTROS_CANAIS = ['comandos', 'ficha', 'distribuirpontos', 'jackpot', 'usaritem', 'usarfeitico', 'aprenderfeitico', 'ping', 'historia'];
const COMANDOS_CANAL_RECRUTAMENTO = ['criar', 'ficha', 'comandos', 'ping', 'listaracas', 'listaclasses', 'listareinos'];
const COMANDOS_CANAL_ATUALIZACAO_FICHAS = ['ficha', 'distribuirpontos', 'comandos', 'ping'];

// --- Configuração do Express para Keep-Alive ---
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Arcádia (Discord) está online e operante!'));
app.listen(port, () => console.log(`Servidor web de keep-alive rodando na porta ${port}.`));

// --- Inicialização do Cliente Discord ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel, Partials.Message]
});

const OWNER_ID_DISCORD = process.env.OWNER_ID;

// --- Evento: Bot Pronto ---
client.on('ready', async () => {
    console.log(`Logado no Discord como ${client.user.tag}!`);
    client.user.setActivity('Arcádia RPG | Use /comandos', { type: ActivityType.Playing });
    try {
        await Arcadia.conectarMongoDB();
        await Arcadia.carregarFichasDoDB();
        console.log("Conexão com MongoDB e carregamento de dados iniciais concluídos.");
    } catch (error) {
        console.error("ERRO CRÍTICO na inicialização do DB no evento 'ready':", error);
    }
});

// --- Evento: Novo Membro no Servidor ---
client.on('guildMemberAdd', async member => {
    if (member.user.bot) return;
    console.log(`[EVENTO] Novo membro entrou: ${member.user.tag} (${member.id}) no servidor ${member.guild.name}`);

    const canalBoasVindas = member.guild.channels.cache.get(Arcadia.ID_CANAL_BOAS_VINDAS_RPG);
    if (canalBoasVindas && canalBoasVindas.isTextBased()) {
        try {
            const embedBoasVindas = Arcadia.gerarMensagemBoasVindas(member.displayName || member.user.username);
            await canalBoasVindas.send({ embeds: [embedBoasVindas] });
            console.log(`[BOAS-VINDAS] Mensagem enviada para ${member.user.tag}.`);
        } catch (error) {
            console.error(`[BOAS-VINDAS] Erro ao enviar mensagem para ${member.user.tag}:`, error);
        }
    } else {
        console.warn(`[AVISO DE CONFIG] Canal de boas-vindas ID "${Arcadia.ID_CANAL_BOAS_VINDAS_RPG}" não encontrado ou não é textual.`);
    }

    try {
        const cargoVisitante = member.guild.roles.cache.find(role => role.name === Arcadia.NOME_CARGO_VISITANTE);
        if (cargoVisitante) {
            await member.roles.add(cargoVisitante);
            console.log(`[CARGO] Cargo "${Arcadia.NOME_CARGO_VISITANTE}" adicionado a ${member.user.tag}.`);
        } else {
            console.warn(`[AVISO DE CONFIG] Cargo de visitante "${Arcadia.NOME_CARGO_VISITANTE}" não encontrado.`);
        }
    } catch (error) {
        console.error(`[CARGO] Erro ao adicionar cargo "${Arcadia.NOME_CARGO_VISITANTE}" para ${member.user.tag}:`, error);
    }
});

// --- Evento: Interação (Slash Commands, Autocomplete) ---
client.on('interactionCreate', async interaction => {
    // --- BLOCO DE AUTOCOMPLETE ---
    if (interaction.isAutocomplete()) {
        const commandName = interaction.commandName;
        const focusedOption = interaction.options.getFocused(true);
        let choices = [];
        const jogadorId = interaction.user.id; // Para buscar dados específicos do jogador

        try {
            if (commandName === 'usarfeitico' && focusedOption.name === 'feitico') {
                const magiasConhecidas = await Arcadia.getMagiasConhecidasParaAutocomplete(jogadorId);
                if (magiasConhecidas) {
                    choices = magiasConhecidas
                        .filter(magia => magia.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                        .map(magia => ({ name: magia.name, value: magia.value })); // { name: "Nome Feitiço", value: "id_feitico" }
                }
            } else if (commandName === 'aprenderfeitico' && focusedOption.name === 'feitico') {
                const todosFeiticos = await Arcadia.getTodosFeiticosBaseParaAutocomplete();
                if (todosFeiticos) {
                    choices = todosFeiticos
                        .filter(feitico => feitico.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                        .map(feitico => ({ name: feitico.name, value: feitico.value })); // { name: "Nome Feitiço (Origem)", value: "id_feitico" }
                }
            } else if (commandName === 'usaritem' && focusedOption.name === 'item') {
                const itensInventario = await Arcadia.getInventarioParaAutocomplete(jogadorId);
                if (itensInventario) {
                    choices = itensInventario
                        .filter(item => item.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                        .map(item => ({ name: item.name, value: item.value })); // { name: "Nome Item (xQtd)", value: "Nome Item" }
                }
            } else if (commandName === 'adminadditem' && focusedOption.name === 'item') {
                const itensBase = await Arcadia.getItensBaseParaAutocomplete();
                if (itensBase) {
                    choices = itensBase
                        .filter(item => item.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                        .map(item => ({ name: item.name, value: item.value })); // { name: "Nome Item Base", value: "Nome Item Base" }
                }
            } else if (commandName === 'admindelitem' && focusedOption.name === 'item') {
                const alvoId = interaction.options.getUser('jogador')?.id;
                if (alvoId) {
                    const itensInventarioAlvo = await Arcadia.getInventarioParaAutocomplete(alvoId);
                    if (itensInventarioAlvo) {
                        choices = itensInventarioAlvo
                            .filter(item => item.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                            .map(item => ({ name: item.name, value: item.value }));
                    }
                } else {
                     choices.push({name: `(Primeiro selecione o jogador alvo)`, value: focusedOption.value || "placeholder_no_alvo"});
                }
            }
            await interaction.respond(choices.slice(0, 25));
        } catch (error) {
            console.error(`[AUTOCOMPLETE] Erro ao processar autocomplete para /${commandName}, opção ${focusedOption.name}:`, error);
            try { await interaction.respond([]); } catch (respondError) { /* ignore */ }
        }
        return;
    }

    // --- TRATAMENTO DE COMANDOS SLASH ---
    if (!interaction.isChatInputCommand()) return;

    const { commandName, channelId, user, options, member } = interaction;
    const senderId = user.id;
    const senderUsername = user.username;
    const isOwner = senderId === OWNER_ID_DISCORD;
    console.log(`[Slash CMD] /${commandName} | by ${senderUsername} (${senderId})`);
    let respostaParaEnviar;
    let podeProcessar = true;

    // --- LÓGICA DE RESTRIÇÃO DE CANAL ---
    if (channelId === Arcadia.ID_CANAL_BOAS_VINDAS_RPG) {
        if (!COMANDOS_CANAL_BEMVINDO.includes(commandName)) podeProcessar = false;
    } else if (channelId === Arcadia.ID_CANAL_RECRUTAMENTO) {
        if (!COMANDOS_CANAL_RECRUTAMENTO.includes(commandName)) podeProcessar = false;
    } else if (channelId === Arcadia.ID_CANAL_ATUALIZACAO_FICHAS) {
        if (!COMANDOS_CANAL_ATUALIZACAO_FICHAS.includes(commandName)) podeProcessar = false;
    } else {
        const comandosBloqueadosEmOutrosCanais = [
            ...COMANDOS_CANAL_BEMVINDO.filter(cmd => !COMANDOS_GERAIS_PERMITIDOS_EM_OUTROS_CANAIS.includes(cmd)),
            ...COMANDOS_CANAL_RECRUTAMENTO.filter(cmd => !COMANDOS_GERAIS_PERMITIDOS_EM_OUTROS_CANAIS.includes(cmd))
        ].filter((value, index, self) => self.indexOf(value) === index);
        if (comandosBloqueadosEmOutrosCanais.includes(commandName)) {
            podeProcessar = false;
        }
    }

    if (!podeProcessar && !isOwner) {
        await interaction.reply({
            embeds: [Arcadia.gerarEmbedAviso("Comando Inválido Neste Canal", "Este comando não pode ser utilizado aqui.")],
            ephemeral: true
        });
        return;
    }

    try {
        const comandosAdmin = [
            'admincriar', 'adminaddxp', 'adminsetnivel', 'adminaddflorins',
            'adminaddessencia', 'adminadditem', 'admindelitem',
            'adminsetattr', 'adminaddpontosattr', 'adminexcluirficha'
        ];
        if (comandosAdmin.includes(commandName) && !isOwner) {
            respostaParaEnviar = Arcadia.gerarEmbedErro("Acesso Negado", "Este comando é apenas para administradores do bot.");
        } else {
            switch (commandName) {
                case 'ping': respostaParaEnviar = 'Pong!'; break;
                case 'oi': case 'arcadia': case 'bemvindo': respostaParaEnviar = Arcadia.gerarMensagemBoasVindas(senderUsername); break;
                case 'comandos': case 'help': respostaParaEnviar = Arcadia.gerarListaComandos(isOwner); break;
                case 'listaracas': respostaParaEnviar = Arcadia.gerarListaRacasEmbed(); break;
                case 'listaclasses': respostaParaEnviar = Arcadia.gerarListaClassesEmbed(); break;
                case 'listareinos': respostaParaEnviar = Arcadia.gerarListaReinosEmbed(); break;
                case 'historia': respostaParaEnviar = Arcadia.gerarEmbedHistoria(); break;
                case 'criar': {
                    const nomePersonagem = options.getString('nome');
                    const racaNomeInput = options.getString('raca');
                    const classeNomeInput = options.getString('classe');
                    const reinoNomeInput = options.getString('reino');
                    respostaParaEnviar = await Arcadia.processarCriarFichaSlash(senderId, senderUsername, nomePersonagem, racaNomeInput, classeNomeInput, reinoNomeInput);

                    if (respostaParaEnviar && typeof respostaParaEnviar.setTitle === 'function' && respostaParaEnviar.data && respostaParaEnviar.data.title && respostaParaEnviar.data.title.includes("🎉 Personagem Criado! 🎉")) {
                        if (member) { // 'member' é o GuildMember da interação
                            const fichaCriada = await Arcadia.getFichaOuCarregar(senderId); // Pega a ficha recém-criada para nomes canônicos
                            if (fichaCriada) {
                                let cargosAdicionadosMsgs = [];
                                let cargosNaoEncontradosMsgs = [];
                                let cargosRemovidosMsgs = [];

                                // 1. Remover cargo "Visitante"
                                const cargoVisitante = member.guild.roles.cache.find(role => role.name === Arcadia.NOME_CARGO_VISITANTE);
                                if (cargoVisitante && member.roles.cache.has(cargoVisitante.id)) {
                                    try { await member.roles.remove(cargoVisitante); cargosRemovidosMsgs.push(Arcadia.NOME_CARGO_VISITANTE); }
                                    catch (e) { console.error(`Erro ao REMOVER ${Arcadia.NOME_CARGO_VISITANTE} de ${senderUsername}:`, e); }
                                }

                                // Nomes dos cargos a serem adicionados
                                const nomesCargosParaAdicionar = [
                                    Arcadia.NOME_CARGO_AVENTUREIRO,
                                    Arcadia.MAPA_CARGOS_RACAS[fichaCriada.raca],       // Ex: "Raça: Eldari"
                                    Arcadia.MAPA_CARGOS_CLASSES[fichaCriada.classe],   // Ex: "Classe: Arcanista"
                                    Arcadia.MAPA_CARGOS_REINOS[fichaCriada.origemReino] // Ex: "Reino: Valdoria"
                                ].filter(Boolean); // Remove undefined/null se algum mapa não encontrar o cargo

                                for (const nomeCargo of nomesCargosParaAdicionar) {
                                    const cargoObj = member.guild.roles.cache.find(role => role.name === nomeCargo);
                                    if (cargoObj) {
                                        try { 
                                            if (!member.roles.cache.has(cargoObj.id)) { // Adiciona apenas se não tiver
                                                await member.roles.add(cargoObj); 
                                                cargosAdicionadosMsgs.push(nomeCargo); 
                                            }
                                        } catch (e) { 
                                            console.error(`Erro ao ADICIONAR cargo ${nomeCargo} para ${senderUsername}:`, e); 
                                            cargosNaoEncontradosMsgs.push(`${nomeCargo} (erro ao adicionar)`); 
                                        }
                                    } else { 
                                        cargosNaoEncontradosMsgs.push(`${nomeCargo} (não encontrado no servidor)`); 
                                    }
                                }

                                // Adiciona feedback sobre os cargos no embed de sucesso
                                if (respostaParaEnviar.addFields) {
                                    if (cargosRemovidosMsgs.length > 0) respostaParaEnviar.addFields({ name: '🚪 Cargo Removido', value: cargosRemovidosMsgs.join(', '), inline: false });
                                    if (cargosAdicionadosMsgs.length > 0) respostaParaEnviar.addFields({ name: '✅ Cargos Adicionados', value: cargosAdicionadosMsgs.join(', '), inline: false });
                                    if (cargosNaoEncontradosMsgs.length > 0) respostaParaEnviar.addFields({ name: '⚠️ Cargos Não Atribuídos/Erro', value: cargosNaoEncontradosMsgs.join(', '), inline: false });
                                }
                            }
                        } else {
                            console.warn(`[CARGOS PÓS-CRIAÇÃO] Objeto 'member' não disponível para ${senderUsername}. Cargos não gerenciados.`);
                        }
                    }
                    break;
                }
                case 'ficha': {
                    const jogadorAlvoFichaOpt = options.getUser('jogador');
                    let idAlvoFicha = senderId;
                    if (jogadorAlvoFichaOpt) {
                        if (!isOwner) { respostaParaEnviar = Arcadia.gerarEmbedErro("🚫 Acesso Negado", "Apenas administradores podem ver a ficha de outros jogadores."); }
                        else { idAlvoFicha = jogadorAlvoFichaOpt.id; }
                    }
                    if (!respostaParaEnviar) { // Só processa se não houve erro de permissão
                        respostaParaEnviar = await Arcadia.processarVerFichaEmbed(idAlvoFicha, isOwner && !!jogadorAlvoFichaOpt, senderId, senderUsername);
                    }
                    break;
                }
                case 'aprenderfeitico': {
                    const idFeitico = options.getString('feitico'); // ID do feitiço do autocomplete
                    const resultado = await Arcadia.aprenderFeitico(senderId, idFeitico);
                    respostaParaEnviar = resultado.erro 
                        ? Arcadia.gerarEmbedErro("Falha ao Aprender", resultado.erro)
                        : Arcadia.gerarEmbedSucesso("Feitiço Aprendido", resultado.sucesso);
                    break;
                }
                case 'usarfeitico': {
                    const idFeitico = options.getString('feitico'); // ID do feitiço do autocomplete
                    const alvo = options.getUser('alvo');
                    const resultado = await Arcadia.usarFeitico(senderId, idFeitico, alvo?.id);
                    respostaParaEnviar = resultado.erro ? Arcadia.gerarEmbedErro("Falha ao Usar Feitiço", resultado.erro) : { embeds: [resultado.embed] };
                    break;
                }
                case 'distribuirpontos': {
                    const atrArgsDist = {};
                    Arcadia.atributosValidos.forEach(atr => { // Usa atributosValidos importado
                        const val = options.getInteger(atr.toLowerCase().replace('base', '')); // Remove 'base' se presente
                        if (val !== null && val !== undefined) { // Garante que apenas valores fornecidos sejam processados
                            // Ajusta 'manabase' para 'manaBase' se necessário, para corresponder à ficha
                            const atrKeyNaOpcao = atr.toLowerCase().replace('base', '');
                            const atrKeyNaFicha = atrKeyNaOpcao === 'manabase' ? 'manaBase' : atrKeyNaOpcao;
                            atrArgsDist[atrKeyNaFicha] = val;
                        }
                    });
                    respostaParaEnviar = await Arcadia.processarDistribuirPontosSlash(senderId, atrArgsDist);
                    break;
                }
                 case 'jackpot':
                    respostaParaEnviar = await Arcadia.processarJackpot(senderId, [String(options.getInteger('giros') || 1)]);
                    break;
                case 'usaritem': {
                    const nomeItem = options.getString('item'); // Nome do item do autocomplete
                    const quantidade = options.getInteger('quantidade') || 1;
                    respostaParaEnviar = await Arcadia.processarUsarItem(senderId, nomeItem, quantidade); // Passa nomeItem e quantidade
                    break;
                }
                // --- Comandos de Admin ---
                case 'admincriar':
                    respostaParaEnviar = await Arcadia.processarAdminCriarFicha(client, options.getUser('jogador').id, options.getString('nome'), options.getString('raca'), options.getString('classe'), options.getString('reino'), senderUsername);
                    break;
                case 'adminaddxp':
                    respostaParaEnviar = await Arcadia.processarAdminAddXP(options.getUser('jogador').id, options.getInteger('xp'), senderUsername);
                    break;
                case 'adminsetnivel':
                    respostaParaEnviar = await Arcadia.processarAdminSetNivel(options.getUser('jogador').id, options.getInteger('nivel'), senderUsername);
                    break;
                case 'adminaddflorins':
                    respostaParaEnviar = await Arcadia.processarAdminAddMoedas(options.getUser('jogador').id, options.getInteger('quantidade'), 'florinsDeOuro', senderUsername);
                    break;
                case 'adminaddessencia':
                    respostaParaEnviar = await Arcadia.processarAdminAddMoedas(options.getUser('jogador').id, options.getInteger('quantidade'), 'essenciaDeArcadia', senderUsername);
                    break;
                case 'adminadditem':
                    respostaParaEnviar = await Arcadia.processarAdminAddItem(options.getUser('jogador').id, options.getString('item'), options.getInteger('quantidade') || 1, options.getString('tipo'), options.getString('descricao'), senderUsername);
                    break;
                case 'admindelitem':
                    respostaParaEnviar = await Arcadia.processarAdminDelItem(options.getUser('jogador').id, options.getString('item'), options.getInteger('quantidade') || 1, senderUsername);
                    break;
                case 'adminsetattr':
                    respostaParaEnviar = await Arcadia.processarAdminSetAtributo(options.getUser('jogador').id, options.getString('atributo'), options.getInteger('valor'), senderUsername);
                    break;
                case 'adminaddpontosattr':
                    respostaParaEnviar = await Arcadia.processarAdminAddPontosAtributo(options.getUser('jogador').id, options.getInteger('quantidade'), senderUsername);
                    break;
                case 'adminexcluirficha':
                    const alvoExcluir = options.getUser('jogador');
                    const membroAlvo = interaction.guild ? interaction.guild.members.cache.get(alvoExcluir.id) : null; // Pega o objeto GuildMember
                    respostaParaEnviar = await Arcadia.processarAdminExcluirFicha(alvoExcluir.id, options.getString('confirmacao'), senderUsername, membroAlvo);
                    break;
                default:
                    if (commandName) { 
                        respostaParaEnviar = Arcadia.gerarEmbedAviso("Comando Desconhecido", `O comando \`/${commandName}\` não foi reconhecido ou não está implementado no switch principal.`);
                    } else {
                        respostaParaEnviar = Arcadia.gerarEmbedErro("Erro Interno", "Nome do comando não recebido.");
                    }
                    break;
            }
        }

        // --- LÓGICA DE ENVIO DA RESPOSTA (COM LOGS DE DEBUG) ---
        if (respostaParaEnviar) {
            const payload = {};
            // console.log("[PAYLOAD_DEBUG] Iniciando tratamento de respostaParaEnviar:", JSON.stringify(respostaParaEnviar, null, 2));

            if (typeof respostaParaEnviar === 'string') {
                // console.log("[PAYLOAD_DEBUG] Condição: É string. VERDADEIRO");
                payload.content = respostaParaEnviar;
            } else {
                // console.log("[PAYLOAD_DEBUG] Condição: É string. FALSO");
                if (respostaParaEnviar.embeds && Array.isArray(respostaParaEnviar.embeds)) {
                    // console.log("[PAYLOAD_DEBUG] Condição: É objeto { embeds: [...] }. VERDADEIRO");
                    payload.embeds = respostaParaEnviar.embeds; 
                    if (respostaParaEnviar.content) { 
                        payload.content = respostaParaEnviar.content;
                    }
                } else {
                    // console.log("[PAYLOAD_DEBUG] Condição: É objeto { embeds: [...] }. FALSO");
                    const isEmbedBuilderCandidate = !!(respostaParaEnviar && typeof respostaParaEnviar.setTitle === 'function' && respostaParaEnviar.data);
                    // console.log(`[PAYLOAD_DEBUG] Verificando EmbedBuilder: é candidato? ${isEmbedBuilderCandidate}`);

                    if (isEmbedBuilderCandidate) {
                        // console.log("[PAYLOAD_DEBUG] Condição: É EmbedBuilder único. VERDADEIRO");
                        payload.embeds = [respostaParaEnviar]; 
                    } else {
                        // console.log("[PAYLOAD_DEBUG] Condição: É EmbedBuilder único. FALSO");
                        console.warn("[RESPOSTA FINAL ELSE] Formato de respostaParaEnviar não reconhecido:", JSON.stringify(respostaParaEnviar, null, 2));
                        payload.content = "Ocorreu um erro inesperado ao formatar a resposta do bot (código não conseguiu determinar o tipo)."; 
                    }
                }
            }

            // console.log("[PAYLOAD_DEBUG] Payload final antes do envio:", JSON.stringify(payload, null, 2));

            let deveSerEfêmera = false;
            if (commandName === 'adminexcluirficha' && payload.embeds && payload.embeds[0] && payload.embeds[0].data.title && payload.embeds[0].data.title.includes('Exclusão Não Confirmada')) {
                deveSerEfêmera = true;
            }

            if (deveSerEfêmera) {
                payload.ephemeral = true;
            }

            if (Object.keys(payload).length === 0) {
                console.error("[ENVIO ERRO] Payload está vazio! Não enviando nada.");
            } else if (!payload.content && (!payload.embeds || payload.embeds.length === 0)) {
                console.error("[ENVIO ERRO] Payload resultou em mensagem vazia:", JSON.stringify(payload, null, 2));
                const errorMsgPayload = { content: "Ocorreu um problema ao gerar a resposta (vazia).", embeds: [], ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply(errorMsgPayload);
                } else {
                    await interaction.reply(errorMsgPayload);
                }
            } else {
                 if (payload.content && payload.content.length > 2000 && (!payload.embeds || payload.embeds.length === 0)) {
                    const chunks = payload.content.match(/[\s\S]{1,1990}/g) || [];
                    const firstChunkPayload = { ...payload, content: chunks.shift() };
                    if (interaction.replied || interaction.deferred) { await interaction.editReply(firstChunkPayload); }
                    else { await interaction.reply(firstChunkPayload); }
                    for (const chunk of chunks) {
                        await interaction.followUp({ content: chunk, ephemeral: deveSerEfêmera }); 
                    }
                } else {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.editReply(payload);
                    } else {
                        await interaction.reply(payload);
                    }
                }
            }
        } else { 
            console.warn("[RESPOSTA] 'respostaParaEnviar' é undefined ou null. Nada para enviar.");
        } 

    } 
    catch (error) { 
        console.error(`Erro CRÍTICO ao processar comando /${commandName} por ${senderUsername}:`, error);
        let errorEmbedParaUsuario = Arcadia.gerarEmbedErro("😥 Erro Crítico", "Desculpe, ocorreu um erro crítico ao processar seu comando. O Mestre foi notificado e investigará o problema.");
        const errorReplyPayload = { embeds: [errorEmbedParaUsuario], ephemeral: true };
        try { 
            if (interaction.replied || interaction.deferred) { 
                await interaction.editReply(errorReplyPayload); 
            } else { 
                await interaction.reply(errorReplyPayload); 
            }
        } 
        catch (finalError) { 
            console.error("Erro catastrófico ao tentar responder sobre um erro anterior:", finalError);
        } 
    } 
}); 

// --- Login do Bot ---
const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error("ERRO CRÍTICO: Token do Discord (DISCORD_TOKEN) não encontrado nas variáveis de ambiente!");
    process.exit(1); 
} else {
    client.login(token).catch(err => {
        console.error("ERRO AO FAZER LOGIN NO DISCORD:", err.message);
        if (err.code === 'DisallowedIntents') {
            console.error("--> DICA: Verifique se todas as 'Privileged Gateway Intents' (ESPECIALMENTE Server Members Intent e Message Content Intent) estão ATIVADAS no Portal de Desenvolvedores do Discord para o seu bot!");
        }
    });
}
