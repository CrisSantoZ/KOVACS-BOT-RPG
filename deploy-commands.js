// deploy-commands.js - Script para registrar os Slash Commands no Discord (V4 Final)

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config(); // Carrega variáveis de ambiente

// Importa os dados necessários do seu sistema de RPG
const {
    RACAS_ARCADIA,
    CLASSES_ARCADIA,
    REINOS_ARCADIA,
    // FEITICOS_BASE_ARCADIA, // Não mais usado diretamente para choices aqui, autocomplete no index.js
    // ITENS_BASE_ARCADIA,   // Não mais usado diretamente para choices aqui, autocomplete no index.js
    atributosValidos
} = require('./arcadia_sistema.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID; // Opcional, para registrar em um servidor específico

if (!token || !clientId) {
    console.error("ERRO CRÍTICO: DISCORD_TOKEN ou DISCORD_CLIENT_ID não encontrados nas variáveis de ambiente!");
    process.exit(1);
}

// Função para truncar nomes longos para choices (limite de 100 caracteres da API)
function truncateName(name, maxLength = 95) { // 95 para dar margem
    if (name.length > maxLength) {
        return name.substring(0, maxLength - 3) + "...";
    }
    return name;
}

// Função auxiliar para formatar arrays de objetos para o formato de 'choices'
// O valor será o nome exato, pois o sistema Arcadia compara em lowercase.
function formatChoicesFromArray(arrayDeObjetos, limite = 25) {
    if (!Array.isArray(arrayDeObjetos)) return [];
    return arrayDeObjetos.slice(0, limite).map(obj => ({
        name: truncateName(obj.nome), // Nome exibido para o usuário (truncado)
        value: obj.nome // Valor é o nome exato
    }));
}


const commands = [
    // --- Comandos de Jogador ---
    new SlashCommandBuilder().setName('ping').setDescription('Testa a latência do bot.'),
    new SlashCommandBuilder().setName('oi').setDescription('Receba uma saudação de Arcádia!'),
    new SlashCommandBuilder().setName('arcadia').setDescription('Mensagem de boas-vindas a Arcádia.'),
    new SlashCommandBuilder().setName('comandos').setDescription('Lista todos os comandos disponíveis.'),
    new SlashCommandBuilder().setName('historia').setDescription('Revela os anais da história de Arcádia.'),
    new SlashCommandBuilder().setName('listaracas').setDescription('Lista as raças jogáveis de Arcádia.'),
    new SlashCommandBuilder().setName('listaclasses').setDescription('Lista as classes jogáveis de Arcádia.'),
    new SlashCommandBuilder().setName('listareinos').setDescription('Lista os reinos de origem em Arcádia.'),

    new SlashCommandBuilder().setName('criar')
        .setDescription('Cria seu personagem em Arcádia.')
        .addStringOption(o => o.setName('nome').setDescription('O nome do seu personagem (3-25 caracteres).').setRequired(true).setMinLength(3).setMaxLength(25))
        .addStringOption(o => o.setName('raca').setDescription('A raça do seu personagem.').setRequired(true)
            .addChoices(...formatChoicesFromArray(RACAS_ARCADIA))
        )
        .addStringOption(o => o.setName('classe').setDescription('A classe do seu personagem.').setRequired(true)
            .addChoices(...formatChoicesFromArray(CLASSES_ARCADIA))
        )
        .addStringOption(o => o.setName('reino').setDescription('O reino de origem do seu personagem.').setRequired(true)
            .addChoices(...formatChoicesFromArray(REINOS_ARCADIA))
        ),

    new SlashCommandBuilder().setName('ficha')
        .setDescription('Exibe a ficha do seu personagem ou de outro jogador (admin).')
        .addUserOption(o => o.setName('jogador').setDescription('O jogador (opcional, apenas para admins).').setRequired(false)),

    new SlashCommandBuilder().setName('distribuirpontos')
        .setDescription('Distribui seus pontos de atributo disponíveis.')
        .addIntegerOption(o => o.setName('forca').setDescription('Pontos para Força.').setMinValue(0).setRequired(false))
        .addIntegerOption(o => o.setName('agilidade').setDescription('Pontos para Agilidade.').setMinValue(0).setRequired(false))
        .addIntegerOption(o => o.setName('vitalidade').setDescription('Pontos para Vitalidade.').setMinValue(0).setRequired(false))
        .addIntegerOption(o => o.setName('manabase').setDescription('Pontos para Mana Base.').setMinValue(0).setRequired(false))
        .addIntegerOption(o => o.setName('intelecto').setDescription('Pontos para Intelecto.').setMinValue(0).setRequired(false))
        .addIntegerOption(o => o.setName('carisma').setDescription('Pontos para Carisma.').setMinValue(0).setRequired(false)),

    new SlashCommandBuilder().setName('aprenderfeitico')
        .setDescription('Aprende um feitiço disponível para sua raça, classe ou reino.')
        .addStringOption(option =>
            option.setName('feitico')
                .setDescription('Escolha um feitiço para aprender (comece a digitar).')
                .setRequired(true)
                .setAutocomplete(true) // Alterado para autocomplete
        ),

    new SlashCommandBuilder().setName('usarfeitico')
        .setDescription('Usa um feitiço conhecido.')
        .addStringOption(option =>
            option.setName('feitico')
                .setDescription('Feitiço a ser usado (comece a digitar para ver sugestões).')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addUserOption(option =>
            option.setName('alvo')
                .setDescription('Alvo do feitiço (opcional, dependendo do feitiço).')
                .setRequired(false)
        ),

    new SlashCommandBuilder().setName('jackpot')
        .setDescription('Tente sua sorte no Jackpot! (Custo: 25 FO)')
        .addIntegerOption(o => o.setName('giros').setDescription('Número de giros (1-10). Padrão: 1.').setMinValue(1).setMaxValue(10).setRequired(false)),

    new SlashCommandBuilder().setName('usaritem')
        .setDescription('Usa um item do seu inventário.')
        .addStringOption(o => o.setName('item').setDescription('O nome exato do item a ser usado (comece a digitar).').setRequired(true).setAutocomplete(true))
        .addIntegerOption(o => o.setName('quantidade').setDescription('Quantos usar (Padrão: 1).').setMinValue(1).setRequired(false)),


    // --- Comandos de Admin ---
    new SlashCommandBuilder().setName('admincriar')
        .setDescription('[Admin] Cria ou atualiza uma ficha para um jogador.')
        .addUserOption(o => o.setName('jogador').setDescription('O jogador alvo.').setRequired(true))
        .addStringOption(o => o.setName('nome').setDescription('Nome do personagem (3-32 chars).').setRequired(true).setMinLength(3).setMaxLength(32))
        .addStringOption(o => o.setName('raca').setDescription('Raça do personagem.').setRequired(true)
            .addChoices(...formatChoicesFromArray(RACAS_ARCADIA))
        )
        .addStringOption(o => o.setName('classe').setDescription('Classe do personagem.').setRequired(true)
            .addChoices(...formatChoicesFromArray(CLASSES_ARCADIA))
        )
        .addStringOption(o => o.setName('reino').setDescription('Reino de origem.').setRequired(true)
            .addChoices(...formatChoicesFromArray(REINOS_ARCADIA))
        ),

    new SlashCommandBuilder().setName('adminaddxp')
        .setDescription('[Admin] Adiciona XP a um jogador.')
        .addUserOption(o => o.setName('jogador').setDescription('O jogador alvo.').setRequired(true))
        .addIntegerOption(o => o.setName('xp').setDescription('Quantidade de XP (pode ser negativo).').setRequired(true)),

    new SlashCommandBuilder().setName('adminsetnivel')
        .setDescription('[Admin] Define o nível de um jogador.')
        .addUserOption(o => o.setName('jogador').setDescription('O jogador alvo.').setRequired(true))
        .addIntegerOption(o => o.setName('nivel').setDescription('O novo nível (mínimo 1).').setRequired(true).setMinValue(1)),

    new SlashCommandBuilder().setName('adminaddflorins')
        .setDescription('[Admin] Adiciona/remove Florins de Ouro.')
        .addUserOption(o => o.setName('jogador').setDescription('O jogador alvo.').setRequired(true))
        .addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade (pode ser negativo).').setRequired(true)),

    new SlashCommandBuilder().setName('adminaddessencia')
        .setDescription('[Admin] Adiciona/remove Essência de Arcádia.')
        .addUserOption(o => o.setName('jogador').setDescription('O jogador alvo.').setRequired(true))
        .addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade (pode ser negativo).').setRequired(true)),

    new SlashCommandBuilder().setName('adminadditem')
        .setDescription('[Admin] Adiciona um item (da base ou custom) ao inventário de um jogador.')
        .addUserOption(o => o.setName('jogador').setDescription('O jogador alvo.').setRequired(true))
        .addStringOption(o => o.setName('item')
            .setDescription('Nome do item (comece a digitar para ver itens base).')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade a adicionar (Padrão: 1).').setRequired(false).setMinValue(1))
        .addStringOption(o => o.setName('tipo').setDescription('Tipo customizado (opcional, sobrescreve o da base).').setRequired(false))
        .addStringOption(o => o.setName('descricao').setDescription('Descrição customizada (opcional, sobrescreve a da base).').setRequired(false)),

    new SlashCommandBuilder().setName('admindelitem')
        .setDescription('[Admin] Remove um item do inventário de um jogador.')
        .addUserOption(o => o.setName('jogador').setDescription('O jogador alvo.').setRequired(true))
        .addStringOption(o => o.setName('item')
            .setDescription('Nome do item a remover (comece a digitar para ver itens do jogador).')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade a remover (Padrão: 1).').setRequired(false).setMinValue(1)),

    new SlashCommandBuilder().setName('adminsetattr')
        .setDescription('[Admin] Define o valor de um atributo para um jogador.')
        .addUserOption(o => o.setName('jogador').setDescription('O jogador alvo.').setRequired(true))
        .addStringOption(o => o.setName('atributo').setDescription('Nome do atributo.').setRequired(true)
            .addChoices(...atributosValidos.map(attr => ({
                name: truncateName(attr.charAt(0).toUpperCase() + attr.slice(1).replace('base', ' Base')),
                value: attr // Envia o valor em minúsculas
            })))
        )
        .addIntegerOption(o => o.setName('valor').setDescription('Novo valor para o atributo (mínimo 0).').setRequired(true).setMinValue(0)),

    new SlashCommandBuilder().setName('adminaddpontosattr')
        .setDescription('[Admin] Adiciona/remove pontos de atributo para distribuir.')
        .addUserOption(o => o.setName('jogador').setDescription('O jogador alvo.').setRequired(true))
        .addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade de pontos (pode ser negativo).').setRequired(true)),

    new SlashCommandBuilder().setName('adminexcluirficha')
        .setDescription('[Admin] EXCLUI PERMANENTEMENTE a ficha de um jogador.')
        .addUserOption(o => o.setName('jogador').setDescription('O jogador cuja ficha será excluída.').setRequired(true))
        .addStringOption(o => o.setName('confirmacao').setDescription('Digite "CONFIRMAR EXCLUSAO" para prosseguir.').setRequired(true))

].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`Iniciando o refresh de ${commands.length} (/) slash commands.`);
        const route = guildId
            ? Routes.applicationGuildCommands(clientId, guildId)
            : Routes.applicationCommands(clientId);
        await rest.put(route, { body: commands });
        console.log(`Slash commands (/) recarregados com sucesso ${guildId ? `para o servidor ${guildId}` : 'globalmente'}.`);
    } catch (error) {
        console.error("Erro ao registrar slash commands:", error);
        if (error.rawError && error.rawError.errors) {
            console.error("Detalhes do erro da API:", JSON.stringify(error.rawError.errors, null, 2));
        }
    }
})();
