// arcadia_sistema.js - Lógica Central e Dados do RPG Arcádia (Versão Estendida)

const { MongoClient } = require('mongodb');
const { EmbedBuilder } = require('discord.js'); // Para mensagens formatadas

const atributosValidos = ["forca", "agilidade", "vitalidade", "manabase", "intelecto", "carisma"];
// --- CONFIGURAÇÃO DO MONGODB (lidas do process.env no index.js) ---
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;
const MONGODB_FICHAS_COLLECTION = process.env.MONGODB_FICHAS_COLLECTION;

// --- CONSTANTES DE CONFIGURAÇÃO DO SERVIDOR DISCORD ---
const ID_CANAL_BOAS_VINDAS_RPG = process.env.ID_CANAL_BOAS_VINDAS_RPG || "1372321260398448710"; // ID do canal de boas-vindas
const ID_CANAL_RECRUTAMENTO = process.env.ID_CANAL_RECRUTAMENTO || "1372275557252726944";      // ID DO SEU CANAL #recrutamento
const ID_CANAL_ATUALIZACAO_FICHAS = process.env.ID_CANAL_ATUALIZACAO_FICHAS || "1372551472016916531"; // ID DO SEU CANAL #atualizacao-de-fichas

const NOME_CARGO_VISITANTE = process.env.NOME_CARGO_VISITANTE || "Visitante de Arcádia"; // Nome do cargo de visitante
const NOME_CARGO_AVENTUREIRO = process.env.NOME_CARGO_AVENTUREIRO || "Aventureiro De Arcádia"; // Nome do cargo de aventureiro

// --- CONSTANTES DE ARCÁDIA (COPIADAS DO SEU CÓDIGO) ---
const RACAS_ARCADIA = [
    { nome: "Eldari", grupo: "Puros", desc: "Elfos nobres com domínio natural da magia arcana." },
    { nome: "Valtheran", grupo: "Puros", desc: "Anões de montanhas profundas, exímios forjadores." },
    { nome: "Seraphim", grupo: "Puros", desc: "Raça alada de aparência angelical, guardiões antigos." },
    { nome: "Terrano", grupo: "Humanos", desc: "Humanos comuns, adaptáveis e versáteis." },
    { nome: "Vharen", grupo: "Humanos", desc: "Humanos com sangue de antigos magos, sensíveis à magia." },
    { nome: "Drakyn", grupo: "Humanos", desc: "Humanos com linhagem de dragões, habilidades elevadas." },
    { nome: "Mei’ra", grupo: "Mistos", desc: "Meio-elfos, diplomáticos e ligados à natureza." },
    { nome: "Thornak", grupo: "Mistos", desc: "Meio-orcs, fortes e leais, caçados por seu sangue." },
    { nome: "Lunari", grupo: "Mistos", desc: "Descendentes de humanos e Seraphim, magia lunar." },
    { nome: "Sombrio", grupo: "Impuros", desc: "Criaturas deformadas por magia proibida, vivem nas sombras." },
    { nome: "Ravkar", grupo: "Impuros", desc: "Homens-besta caóticos, frutos de experimentos mágicos." },
    { nome: "Vazio", grupo: "Impuros", desc: "Entidades sem alma, criados por necromancia, frios e letais." }
];

const CLASSES_ARCADIA = [
    { nome: "Arcanista", desc: "Mestre da magia pura." }, { nome: "Guerreiro Real", desc: "Lutador disciplinado." },
    { nome: "Feiticeiro Negro", desc: "Usuário de magias proibidas." }, { nome: "Caçador Sombrio", desc: "Perito em rastrear." },
    { nome: "Guardião da Luz", desc: "Defensor divino." }, { nome: "Mestre das Bestas", desc: "Controla criaturas." },
    { nome: "Bardo Arcano", desc: "Manipula emoções com música e magia." }, { nome: "Alquimista", desc: "Cria poções e bombas." },
    { nome: "Clérigo da Ordem", desc: "Cura e invoca milagres." }, { nome: "Andarilho Rúnico", desc: "Usa runas como armas." },
    { nome: "Espadachim Etéreo", desc: "Une magia e espada." }, { nome: "Invasor Dracônico", desc: "Híbrido com traços de dragão." },
    { nome: "Lâmina da Névoa", desc: "Assassino furtivo." }, { nome: "Conjurador do Vazio", desc: "Controla magias interdimensionais." }
];
const REINOS_ARCADIA = [
    { nome: "Valdoria", desc: "Reino dos humanos." },{ nome: "Elarion", desc: "Floresta élfica." },
    { nome: "Durnholde", desc: "Reino anão." },{ nome: "Caelum", desc: "Cidade flutuante Seraphim." },
    { nome: "Ravengard", desc: "Domínio dos Sombrios." },{ nome: "Thornmere", desc: "Território livre." },
    { nome: "Isle of Morwyn", desc: "Ilha mágica proibida." }
];
const ITENS_BASE_ARCADIA = {
    "florin de ouro": { itemNome: "Florin de Ouro", tipo: "Moeda", descricao: "A moeda comum de todos os reinos.", usavel: false },
    "essência de arcádia": { itemNome: "Essência de Arcádia", tipo: "Moeda Rara", descricao: "Usada para artefatos e magias.", usavel: false },
    "poção de cura menor": { itemNome: "Poção de Cura Menor", tipo: "Consumível", descricao: "Restaura uma pequena quantidade de PV.", usavel: true, efeito: { tipoEfeito: "CURA_HP", valor: 25, mensagemAoUsar: "Você bebe a Poção de Cura Menor e sente o alívio.", cooldownSegundos: 60 }},
    "poção de mana menor": { itemNome: "Poção de Mana Menor", tipo: "Consumível", descricao: "Restaura uma pequena quantidade de PM.", usavel: true, efeito: { tipoEfeito: "CURA_PM", valor: 20, mensagemAoUsar: "Você bebe a Poção de Mana Menor e sua energia mágica é revigorada.", cooldownSegundos: 60 }},
    "poção de cura média": { itemNome: "Poção de Cura Média", tipo: "Consumível", descricao: "Restaura uma quantidade moderada de PV.", usavel: true, efeito: { tipoEfeito: "CURA_HP", valor: 50, mensagemAoUsar: "Você bebe a Poção de Cura Média e se sente muito melhor.", cooldownSegundos: 120 }},
    "poção de cura grande": { itemNome: "Poção de Cura Grande", tipo: "Consumível", descricao: "Restaura uma quantidade significativa de PV.", usavel: true, efeito: { tipoEfeito: "CURA_HP", valor: 100, mensagemAoUsar: "Você bebe a Poção de Cura Grande e se sente revitalizado!", cooldownSegundos: 180 }},
    // Outros itens existentes...
    "antídoto simples": { itemNome: "Antídoto Simples", tipo: "Consumível", descricao: "Cura venenos fracos.", usavel: true, efeito: { tipoEfeito: "REMOVE_CONDICAO", condicao: "Envenenado Leve", mensagemAoUsar: "Você toma o Antídoto e o veneno em suas veias é neutralizado.", cooldownSegundos: 120 }},
    "elixir de agilidade menor": { itemNome: "Elixir de Agilidade Menor", tipo: "Poção", descricao: "Aumenta temporariamente a Agilidade.", usavel: true, efeito: { tipoEfeito: "BUFF_ATRIBUTO_TEMP", atributo: "agilidade", valor: 2, duracaoDesc: "por 5 minutos", mensagemAoUsar: "Você bebe o Elixir e se sente mais ágil e rápido!", cooldownSegundos: 300 }},
    "rações de viagem": { itemNome: "Rações de Viagem", tipo: "Consumível", descricao: "Comida para um dia de jornada. Restaura um pouco de vitalidade.", usavel: true, efeito: { tipoEfeito: "CURA_HP", valor: 10, mensagemAoUsar: "Você consome parte de suas rações e se sente um pouco restaurado.", cooldownSegundos: 180 }},
    "adaga simples": { itemNome: "Adaga Simples", tipo: "Arma Leve", descricao: "Uma adaga básica de bronze.", usavel: false, equipavel: true, slot: "maoDireita", efeitoEquipamento: { bonusAtributos: { ataqueBase: 1 }}},
    "adaga de ferro balanceada": { itemNome: "Adaga de Ferro Balanceada", tipo: "Arma Leve", descricao: "Uma adaga bem trabalhada.", usavel: false, equipavel: true, slot: "maoDireita", efeitoEquipamento: { bonusAtributos: { ataqueBase: 2 }}},
    "amuleto da sorte desgastado": { itemNome: "Amuleto da Sorte Desgastado", tipo: "Amuleto", descricao: "Um amuleto simples.", usavel: false, equipavel: true, slot: "amuleto" },
    "pergaminho em branco": { itemNome: "Pergaminho em Branco", tipo: "Material", descricao: "Para anotações.", usavel: false },
    "tocha": { itemNome: "Tocha", tipo: "Ferramenta", descricao: "Ilumina locais escuros.", usavel: false },
    "kit de reparos simples": { itemNome: "Kit de Reparos Simples", tipo: "Ferramenta", descricao: "Reparos básicos.", usavel: false },
    "mapa do tesouro desbotado": { itemNome: "Mapa do Tesouro Desbotado", tipo: "Outro", descricao: "Um mapa antigo...", usavel: false },
    "gema bruta valiosa": { itemNome: "Gema Bruta Valiosa", tipo: "Material Precioso", descricao: "Uma gema valiosa.", usavel: false }
};
const JACKPOT_PREMIOS_NOMES_COMUNS = ["poção de cura menor", "rações de viagem", "pergaminho em branco", "tocha", "kit de reparos simples"];
const JACKPOT_PREMIOS_NOMES_INCOMUNS = ["adaga de ferro balanceada", "antídoto simples", "amuleto da sorte desgastado", "poção de mana menor"];
const JACKPOT_PREMIOS_NOMES_RAROS = ["elixir de agilidade menor", "mapa do tesouro desbotado", "gema bruta valiosa"];

const fichaModeloArcadia = {
    _id: "", nomeJogadorSalvo: "", nomePersonagem: "N/A", raca: "A Ser Definida", classe: "A Ser Definida", 
    origemReino: "N/A", nivel: 1, xpAtual: 0, xpProximoNivel: 100, 
    atributos: { forca: 5, agilidade: 5, vitalidade: 5, manaBase: 5, intelecto: 5, carisma: 5, pontosParaDistribuir: 30 },
    pvMax: 0, pvAtual: 0, pmMax: 0, pmAtual: 0, ataqueBase: 0, defesaBase: 0, 
    reputacao: {}, florinsDeOuro: 50, essenciaDeArcadia: 0,
    habilidadesEspeciais: [], pericias: [], magiasConhecidas: [], 
    equipamento: { maoDireita: null, maoEsquerda: null, armaduraCorpo: null, elmo: null, amuleto: null, anel1: null, anel2: null },
    inventario: [ 
        { ...JSON.parse(JSON.stringify(ITENS_BASE_ARCADIA["adaga simples"])), quantidade: 1}, 
        { ...JSON.parse(JSON.stringify(ITENS_BASE_ARCADIA["rações de viagem"])), quantidade: 3} 
    ],
    historiaPersonagem: "", idiomas: ["Comum Arcádiano"], condicoes: [], 
    cooldownsItens: {}, ultimaAtualizacao: "", logMissoes: [], notacoesDM: "" 
};

let dbClient;
let fichasCollection;
let todasAsFichas = {};

// --- FUNÇÕES DE BANCO DE DADOS E AUXILIARES (sem grandes mudanças da versão anterior) ---
async function conectarMongoDB() { /* ...código da v. anterior ... */ 
    if (dbClient && dbClient.topology && dbClient.topology.isConnected()) {
        console.log("MongoDB já conectado."); return;
    }
    if (!MONGODB_URI) {
        console.error("--- ERRO FATAL: MONGODB_URI não definida nos Secrets! ---");
        throw new Error("MONGODB_URI não definida");
    }
    try {
        console.log("Tentando conectar ao MongoDB Atlas...");
        dbClient = new MongoClient(MONGODB_URI);
        await dbClient.connect();
        const db = dbClient.db(MONGODB_DB_NAME);
        fichasCollection = db.collection(MONGODB_FICHAS_COLLECTION);
        console.log("Conectado com sucesso ao MongoDB Atlas e à coleção:", MONGODB_FICHAS_COLLECTION);
    } catch (error) {
        console.error("ERRO CRÍTICO ao conectar ao MongoDB:", error);
        throw error;
    }
}
async function carregarFichasDoDB() { /* ...código da v. anterior ... */ 
    if (!fichasCollection) { console.error("Coleção não inicializada."); return; }
    console.log("Carregando fichas do DB para cache...");
    try {
        const fichasDoDB = await fichasCollection.find({}).toArray();
        todasAsFichas = {};
        fichasDoDB.forEach(fichaDB => {
            const idJogador = String(fichaDB._id);
            todasAsFichas[idJogador] = { 
                ...JSON.parse(JSON.stringify(fichaModeloArcadia)), 
                ...fichaDB,
                _id: idJogador, 
                atributos: { ...JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)), ...(fichaDB.atributos || {}) },
                inventario: fichaDB.inventario || [], 
                cooldownsItens: fichaDB.cooldownsItens || {} 
            };
        });
        console.log(`${Object.keys(todasAsFichas).length} fichas carregadas.`);
    } catch (error) {
        console.error("Erro ao carregar fichas do MongoDB:", error);
    }
}
async function getFichaOuCarregar(idJogadorDiscord) { /* ...código da v. anterior ... */ 
    const idNormalizado = String(idJogadorDiscord);
    let ficha = todasAsFichas[idNormalizado];
    if (!ficha && fichasCollection) {
        try {
            const fichaDB = await fichasCollection.findOne({ _id: idNormalizado });
            if (fichaDB) {
                ficha = {
                    ...JSON.parse(JSON.stringify(fichaModeloArcadia)),
                    ...fichaDB,
                    _id: idNormalizado,
                    atributos: { ...JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)), ...(fichaDB.atributos || {}) },
                    inventario: fichaDB.inventario || [],
                    cooldownsItens: fichaDB.cooldownsItens || {}
                };
                todasAsFichas[idNormalizado] = ficha;
            } else { return null; }
        } catch (dbError) {
            console.error(`Erro ao buscar ficha ${idNormalizado} no DB:`, dbError);
            return null;
        }
    }
    if (ficha) {
        if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
        if (ficha.nivel === undefined) ficha.nivel = 1;
        ficha.pvMax = (ficha.atributos.vitalidade * 5) + (ficha.nivel * 5) + 20;
        ficha.pmMax = (ficha.atributos.manaBase * 5) + (ficha.nivel * 3) + 10;
        if (ficha.pvAtual === undefined || ficha.pvAtual > ficha.pvMax) ficha.pvAtual = ficha.pvMax;
        if (ficha.pmAtual === undefined || ficha.pmAtual > ficha.pmMax) ficha.pmAtual = ficha.pmMax;
        if (ficha.pvAtual < 0) ficha.pvAtual = 0;
        if (ficha.pmAtual < 0) ficha.pmAtual = 0;
        if (ficha.xpProximoNivel === undefined) ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    }
    return ficha;
}
async function salvarFichaNoDB(idJogadorDiscord, fichaData) { /* ...código da v. anterior ... */
    if (!fichasCollection) { console.error("Coleção não inicializada."); return; }
    const idNormalizado = String(idJogadorDiscord);
    try {
        const { _id, ...dadosParaSalvar } = fichaData; 
        await fichasCollection.updateOne(
            { _id: idNormalizado },
            { $set: dadosParaSalvar },
            { upsert: true }
        );
    } catch (error) {
        console.error(`Erro ao salvar ficha ${idNormalizado}:`, error);
    }
}
async function atualizarFichaNoCacheEDb(idJogadorDiscord, ficha) { /* ...código da v. anterior ... */ 
    const idNormalizado = String(idJogadorDiscord);
    ficha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    if (ficha.nivel === undefined) ficha.nivel = 1;
    ficha.pvMax = (ficha.atributos.vitalidade * 5) + (ficha.nivel * 5) + 20;
    ficha.pmMax = (ficha.atributos.manaBase * 5) + (ficha.nivel * 3) + 10;
    if (ficha.pvAtual > ficha.pvMax) ficha.pvAtual = ficha.pvMax;
    if (ficha.pmAtual > ficha.pmMax) ficha.pmAtual = ficha.pmMax;
    if (ficha.pvAtual < 0) ficha.pvAtual = 0;
    if (ficha.pmAtual < 0) ficha.pmAtual = 0;

    todasAsFichas[idNormalizado] = ficha;
    await salvarFichaNoDB(idNormalizado, ficha);
}
function calcularXpProximoNivel(nivelAtual) { return nivelAtual * 100 + 50; }

// --- FUNÇÕES DE LÓGICA DE COMANDO (AGORA RETORNANDO EMBEDS ONDE APLICÁVEL) ---

function gerarMensagemBoasVindas(nomeUsuarioDiscord) {
    return new EmbedBuilder()
        .setColor(0x5865F2) // Cor do Discord
        .setTitle(`🌟 Saudações, ${nomeUsuarioDiscord}! Bem-vindo(a) a Arcádia! 🌟`)
        .setDescription("Um mundo medieval vibrante com magia, mas também repleto de perigos...\n\nUse `/comandos` para ver a lista de ações disponíveis.\nUse `/criar` para iniciar sua jornada!")
        .setFooter({text: "Que seus dados rolem a seu favor!"});
}

function gerarEmbedHistoria() {
    return new EmbedBuilder()
        .setColor(0x8B4513) // Um tom de marrom, como pergaminho antigo
        .setTitle("📜 ARCÁDIA — A ERA DOS REINOS 📜")
        .setDescription('*"Quando os deuses dormem... os mortos despertam."*')
        .addFields(
            { name: "Um Equilíbrio Desfeito", value: "O mundo de Arcádia já conheceu eras de ouro, onde os reinos coexistiam em equilíbrio instável, entre florestas encantadas, cidades flutuantes e fortalezas forjadas sob montanhas. Mas toda paz é uma pausa... e a escuridão sempre encontra seu caminho de volta." },
            { name: "O Despertar Sombrio", value: "Há trinta ciclos lunares, uma presença antiga rompeu os véus entre vida e morte. Sebastian Azakin, o Deus Necromante, despertou dos abismos esquecidos do mundo. Sua alma, banida pelos próprios deuses, retornou com poder sombrio suficiente para dobrar os reinos mais orgulhosos. Com um exército de vazios e mortos silenciosos, ele não quer governar — ele quer reescrever o destino." },
            { name: "A Sombra se Espalha", value: "Sob sua sombra, as fronteiras ruíram. Ravengard se ergueu em guerra, a Ilha de Morwyn sussurrou segredos antes proibidos, e os Sombrios marcharam novamente. Em Valdoria, reis hesitam. Em Elarion, as árvores choram. Em Caelum, nem os Seraphim ousam pronunciar seu nome." },
            { name: "O Chamado", value: "Mas o mundo não pertence apenas aos deuses.\n\nAgora, aventureiros de todas as raças — puros, humanos, mistos e até impuros — despertam para um chamado inevitável. Você pode ser um herói, um traidor, um explorador ou um monstro. Escolha sua raça, seu reino, sua classe... e descubra quem você será nesta nova era de trevas e possibilidades." }
        )
        .setFooter({ text: "Pois em Arcádia, até mesmo os mortos têm histórias para contar..." });
}

function gerarListaRacasEmbed() { /* ...código da v. anterior, já retorna Embed ... */ 
    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("📜 Raças de Arcádia 📜")
        .setDescription("Escolha uma raça para seu personagem. Use o nome exato no comando `/criar`.");
    RACAS_ARCADIA.forEach(raca => {
        embed.addFields({ name: `${raca.nome} (${raca.grupo})`, value: `*${raca.desc}*`, inline: false });
    });
    return embed;
}
function gerarListaClassesEmbed() { /* ...código da v. anterior, já retorna Embed ... */ 
    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle("⚔️ Classes de Arcádia ⚔️")
        .setDescription("Escolha uma classe. Use o nome exato no comando `/criar`.");
    CLASSES_ARCADIA.forEach(classe => {
        embed.addFields({ name: classe.nome, value: `*${classe.desc}*`, inline: true });
    });
    return embed;
}
function gerarListaReinosEmbed() { /* ...código da v. anterior, já retorna Embed ... */
    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle("🏰 Reinos de Arcádia 🏰")
        .setDescription("Escolha um reino de origem. Use o nome exato no comando `/criar`.");
    REINOS_ARCADIA.forEach(reino => {
        embed.addFields({ name: reino.nome, value: `*${reino.desc}*`, inline: false });
    });
    return embed;
}

const MAPA_CARGOS_RACAS = {
    "Eldari": "Eldari",
    "Valtheran": "Valtheran",
    "Seraphim": "Seraphim",
    "Terrano": "Terrano",
    "Vharen": "Vharen",
    "Drakyn": "Drakyn",
    "Mei'ra": "Mei'ra",
    "Thornak": "Thornak",
    "Lunari": "Lunari",
    "Sombrio": "Sombrio",
    "Ravkar": "Ravkar",
    "Vazio": "Vazio"
};

async function processarCriarFichaSlash(idJogadorDiscord, nomeJogadorDiscord, nomePersonagem, racaNome, classeNome, reinoNome) { /* ...código da v. anterior, já retorna Embed ... */
    const fichaExistente = await getFichaOuCarregar(idJogadorDiscord);
    if (fichaExistente && fichaExistente.nomePersonagem !== "N/A") {
        const embed = new EmbedBuilder().setColor(0xFFCC00).setTitle("⚠️ Personagem Já Existente").setDescription(`Você já tem: **${fichaExistente.nomePersonagem}**. Use \`/ficha\`.`);
        return embed;
    }
    const racaValida = RACAS_ARCADIA.find(r => r.nome.toLowerCase() === racaNome.toLowerCase());
    const classeValida = CLASSES_ARCADIA.find(c => c.nome.toLowerCase() === classeNome.toLowerCase());
    const reinoValido = REINOS_ARCADIA.find(reino => reino.nome.toLowerCase() === reinoNome.toLowerCase());
    let errorMessages = [];
    if (!nomePersonagem || nomePersonagem.length < 3 || nomePersonagem.length > 25) { errorMessages.push("Nome (3-25 chars)."); }
    if (!racaValida) { errorMessages.push(`Raça "${racaNome}" inválida. Use \`/listaracas\`.`); }
    if (!classeValida) { errorMessages.push(`Classe "${classeNome}" inválida. Use \`/listaclasses\`.`); }
    if (!reinoValido) { errorMessages.push(`Reino "${reinoNome}" inválido. Use \`/listareinos\`.`); }

    if (errorMessages.length > 0) {
        return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro na Criação").setDescription(errorMessages.join("\n"));
    }
    let novaFicha = JSON.parse(JSON.stringify(fichaModeloArcadia));
    novaFicha._id = idJogadorDiscord; novaFicha.nomeJogadorSalvo = nomeJogadorDiscord;
    novaFicha.nomePersonagem = nomePersonagem; novaFicha.raca = racaValida.nome;
    novaFicha.classe = classeValida.nome; novaFicha.origemReino = reinoValido.nome;
    novaFicha.atributos.pontosParaDistribuir = 30; novaFicha.nivel = 1;
    novaFicha.xpAtual = 0; novaFicha.xpProximoNivel = calcularXpProximoNivel(novaFicha.nivel);
    novaFicha.florinsDeOuro = 50; novaFicha.essenciaDeArcadia = 0;
    novaFicha.inventario = fichaModeloArcadia.inventario.map(itemModelo => JSON.parse(JSON.stringify(itemModelo)));
    novaFicha.pvMax = (novaFicha.atributos.vitalidade * 5) + (novaFicha.nivel * 5) + 20; novaFicha.pvAtual = novaFicha.pvMax;
    novaFicha.pmMax = (novaFicha.atributos.manaBase * 5) + (novaFicha.nivel * 3) + 10; novaFicha.pmAtual = novaFicha.pmMax;
    await atualizarFichaNoCacheEDb(idJogadorDiscord, novaFicha);
    return new EmbedBuilder().setColor(0x00FF00).setTitle(`🎉 Personagem Criado! 🎉`)
        .setDescription(`**${nomePersonagem}** (${novaFicha.raca} ${novaFicha.classe} de ${novaFicha.origemReino}) foi criado para ${nomeJogadorDiscord}!`)
        .addFields({ name: 'Próximos Passos:', value: "Use `/distribuirpontos` para gastar seus 30 pontos e depois `/ficha`." }).setTimestamp();
}

async function processarVerFichaEmbed(idAlvoDiscord, isAdminConsultandoOutro, idInvocadorOriginal, nomeInvocadorOriginal) { /* ...código da v. anterior, já retorna Embed ... */ 
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    const nomeAlvoDisplay = (ficha && ficha.nomeJogadorSalvo) ? ficha.nomeJogadorSalvo : ((ficha && ficha.nomePersonagem !== "N/A") ? ficha.nomePersonagem : "Desconhecido");

    if (!ficha) {
        let desc = "Ficha não encontrada.";
        if (idAlvoDiscord === idInvocadorOriginal) { desc = "Sua ficha não foi encontrada. Use `/criar`."; }
        else if (isAdminConsultandoOutro) { desc = `Ficha para ID ${idAlvoDiscord} (Jogador: ${nomeAlvoDisplay}) não encontrada.`;}
        return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Ficha não Encontrada").setDescription(desc);
    }
    const embed = new EmbedBuilder().setColor(0x0099FF).setTitle(`🌟 Ficha de: ${ficha.nomePersonagem || 'N/A'} 🌟`)
        .setDescription(`*${ficha.raca || 'N/A'} ${ficha.classe || 'N/A'} de ${ficha.origemReino || 'N/A'}*`)
        .addFields(
            { name: 'Jogador Discord', value: ficha.nomeJogadorSalvo || 'N/A', inline: true },
            { name: 'Nível', value: `${ficha.nivel || 1} (XP: ${ficha.xpAtual || 0}/${ficha.xpProximoNivel || calcularXpProximoNivel(ficha.nivel || 1)})`, inline: true },
            { name: '\u200B', value: '\u200B' },
            { name: '❤️ PV (Vida)', value: `${ficha.pvAtual || 0} / ${ficha.pvMax || 0}`, inline: true },
            { name: '💧 PM (Mana)', value: `${ficha.pmAtual || 0} / ${ficha.pmMax || 0}`, inline: true },
            { name: '\u200B', value: '\u200B' },
            { name: '💰 Moedas', value: `${ficha.florinsDeOuro || 0} FO | ${ficha.essenciaDeArcadia || 0} EA`, inline: false }
        );
    let atributosStr = "";
    if (ficha.atributos) {
        for (const [attr, valor] of Object.entries(ficha.atributos)) {
            if (attr !== "pontosParaDistribuir") {
                atributosStr += `**${attr.charAt(0).toUpperCase() + attr.slice(1).replace('Base',' Base')}**: ${valor || 0}\n`;
            }
        }
        if ((ficha.atributos.pontosParaDistribuir || 0) > 0) {
            const msgPontos = (idAlvoDiscord === idInvocadorOriginal) ? "Você tem" : `O personagem tem`;
            atributosStr += `✨ ${msgPontos} **${ficha.atributos.pontosParaDistribuir}** pontos para distribuir${(idAlvoDiscord === idInvocadorOriginal) ? " (Use `/distribuirpontos`)" : "."}\n`;
        }
        embed.addFields({ name: '🧠 Atributos', value: atributosStr || 'N/A', inline: false });
    }
    let inventarioStr = "Vazio";
    if (ficha.inventario && ficha.inventario.length > 0) {
        inventarioStr = ficha.inventario.slice(0, 7).map(i => `• ${i.itemNome} (x${i.quantidade})`).join('\n');
        if (ficha.inventario.length > 7) inventarioStr += `\n*...e mais ${ficha.inventario.length - 7} item(s).*`;
    }
    embed.addFields({ name: '🎒 Inventário', value: inventarioStr, inline: true });
    let equipamentoStr = "Nenhum item equipado";
    if (ficha.equipamento) {
        let tempEqStr = "";
        for (const slot in ficha.equipamento) {
            if (ficha.equipamento[slot]) {
                const nomeSlotFormatado = slot.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                const nomeItemEquipado = (typeof ficha.equipamento[slot] === 'object' && ficha.equipamento[slot].itemNome) ? ficha.equipamento[slot].itemNome : String(ficha.equipamento[slot]);
                tempEqStr += `**${nomeSlotFormatado}**: ${nomeItemEquipado}\n`;
            }
        }
        if (tempEqStr) equipamentoStr = tempEqStr;
    }
    embed.addFields({ name: '⚙️ Equipamento', value: equipamentoStr, inline: true });
    embed.setFooter({ text: `Consultada por ${nomeInvocadorOriginal} | Arcádia RPG • Atualizada: ${ficha.ultimaAtualizacao || 'N/A'}` });
    return embed;
}

async function processarDistribuirPontosSlash(idJogadorDiscord, atributosOpcoes) { /* ...código da v. anterior, já retorna Embed ... */
    const ficha = await getFichaOuCarregar(idJogadorDiscord);
    if (!ficha) { return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro").setDescription("Sua ficha não foi encontrada."); }
    const pontosDisponiveis = ficha.atributos.pontosParaDistribuir || 0;
    if (pontosDisponiveis <= 0) {
        return new EmbedBuilder().setColor(0xFFCC00).setTitle("ℹ️ Informação").setDescription("Você não tem pontos de atributo para distribuir.");
    }
    let totalPontosSolicitados = 0; let mudancas = {}; let errosParse = [];
    const atributosValidos = ["forca", "agilidade", "vitalidade", "manabase", "intelecto", "carisma"];
    for (const atrInput in atributosOpcoes) {
        const atrKey = atrInput.toLowerCase();
        if (atributosValidos.includes(atrKey)) {
            const valorStr = atributosOpcoes[atrInput]; const valorInt = parseInt(valorStr);
            if (isNaN(valorInt) || valorInt <= 0) { errosParse.push(`Valor para '${atrKey}' (${valorStr}) deve ser positivo.`); }
            else { mudancas[atrKey] = (mudancas[atrKey] || 0) + valorInt; totalPontosSolicitados += valorInt; }
        }
    }
    if (errosParse.length > 0) { return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro na Distribuição").setDescription("Valores inválidos:\n- " + errosParse.join("\n- ")); }
    if (totalPontosSolicitados === 0) { return new EmbedBuilder().setColor(0xFFCC00).setTitle("ℹ️ Distribuição").setDescription(`Nenhum ponto especificado. Você tem ${pontosDisponiveis} pontos.`); }
    if (totalPontosSolicitados > pontosDisponiveis) { return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Pontos Insuficientes").setDescription(`Tentou usar ${totalPontosSolicitados} pts, mas só tem ${pontosDisponiveis}.`); }
    let feedbackMudancasTexto = [];
    for (const atributo in mudancas) {
        const valorAntigo = ficha.atributos[atributo] || 0;
        ficha.atributos[atributo] = valorAntigo + mudancas[atributo];
        feedbackMudancasTexto.push(`**${atributo.charAt(0).toUpperCase() + atributo.slice(1)}**: ${valorAntigo} + ${mudancas[atributo]} → ${ficha.atributos[atributo]}`);
    }
    ficha.atributos.pontosParaDistribuir -= totalPontosSolicitados;
    await atualizarFichaNoCacheEDb(idJogadorDiscord, ficha);
    return new EmbedBuilder().setColor(0x00FF00).setTitle(`✅ Pontos Distribuídos para ${ficha.nomePersonagem || ficha.nomeJogadorSalvo}!`)
        .setDescription(feedbackMudancasTexto.join("\n")).addFields({ name: '✨ Pontos Restantes', value: `**${ficha.atributos.pontosParaDistribuir}**` }).setTimestamp();
}

// ATUALIZADO: processarJackpot para retornar Embed
async function processarJackpot(idJogadorDiscord, args) { // args aqui seria [String(numeroDeGiros)]
    const ficha = await getFichaOuCarregar(idJogadorDiscord);
    if (!ficha) { return new EmbedBuilder().setColor(0xFF0000).setTitle("🎰 Jackpot Arcádia").setDescription("Sua ficha não foi encontrada para tentar a sorte."); }

    let numeroDeGiros = (args && args[0] && /^\d+$/.test(args[0])) ? parseInt(args[0]) : 1;
    if (numeroDeGiros <= 0) numeroDeGiros = 1;
    const limiteGiros = 10;
    let avisoLimite = "";
    if (numeroDeGiros > limiteGiros) {
        avisoLimite = `\n*(Você pediu ${numeroDeGiros} giros, mas o máximo é ${limiteGiros} por vez.)*`;
        numeroDeGiros = limiteGiros;
    }

    const custoPorGiro = 25;
    const custoTotal = custoPorGiro * numeroDeGiros;

    if ((ficha.florinsDeOuro || 0) < custoTotal) {
        return new EmbedBuilder().setColor(0xFFCC00).setTitle("🎰 Jackpot Arcádia")
            .setDescription(`Você precisa de **${custoTotal} FO** para ${numeroDeGiros} giro(s).\nVocê tem: ${ficha.florinsDeOuro || 0} FO.`);
    }
    ficha.florinsDeOuro -= custoTotal;

    let embedFields = [];
    let florinsGanhosTotal = 0;
    let essenciaGanhaTotal = 0;
    let itensGanhosLista = [];

    for (let i = 0; i < numeroDeGiros; i++) {
        const sorte = Math.random();
        let premioMsgGiro = ""; let itemGanhoGiroObj = null;
        // Lógica do sorteio (igual à anterior)
        if (sorte < 0.01) { const e = 5; essenciaGanhaTotal+=e; const f=100; florinsGanhosTotal+=f; premioMsgGiro = `🌟✨ JACKPOT LENDÁRIO!!! +${e} EA e +${f} FO!`; }
        else if (sorte < 0.04) { const n=JACKPOT_PREMIOS_NOMES_RAROS[Math.floor(Math.random()*JACKPOT_PREMIOS_NOMES_RAROS.length)]; const it=ITENS_BASE_ARCADIA[n]; if(it){itemGanhoGiroObj=JSON.parse(JSON.stringify(it));itemGanhoGiroObj.quantidade=1;} premioMsgGiro = `💎 RARO: Ganhou **${itemGanhoGiroObj?itemGanhoGiroObj.itemNome:"Algo especial"}**!`; }
        else if (sorte < 0.10) { const n=JACKPOT_PREMIOS_NOMES_INCOMUNS[Math.floor(Math.random()*JACKPOT_PREMIOS_NOMES_INCOMUNS.length)]; const it=ITENS_BASE_ARCADIA[n]; if(it){itemGanhoGiroObj=JSON.parse(JSON.stringify(it));itemGanhoGiroObj.quantidade=1;} premioMsgGiro = `🎁 INCOMUM: Ganhou **${itemGanhoGiroObj?itemGanhoGiroObj.itemNome:"Algo útil"}**!`; }
        else if (sorte < 0.20) { const n=JACKPOT_PREMIOS_NOMES_COMUNS[Math.floor(Math.random()*JACKPOT_PREMIOS_NOMES_COMUNS.length)]; const it=ITENS_BASE_ARCADIA[n]; if(it){itemGanhoGiroObj=JSON.parse(JSON.stringify(it));itemGanhoGiroObj.quantidade=1;} premioMsgGiro = `👍 COMUM: Ganhou *${itemGanhoGiroObj?itemGanhoGiroObj.itemNome:"Algo simples"}*.`; }
        else if (sorte < 0.35) { const f=Math.floor(Math.random()*100)+50; florinsGanhosTotal+=f; premioMsgGiro = `💰 Sorte Grande! +${f} Florins!`; }
        else if (sorte < 0.55) { const f=Math.floor(Math.random()*40)+10; florinsGanhosTotal+=f; premioMsgGiro = `🍀 Bom prêmio! +${f} Florins!`; }
        else if (sorte < 0.75) { premioMsgGiro = `💨 Quase! Nada desta vez...`; }
        else { const p=["Uma meia velha!", "Biscoito: 'Tente de novo'.", "Abraço imaginário!", "5 Florins.", "O Jackpot piscou."]; premioMsgGiro=p[Math.floor(Math.random()*p.length)]; if(premioMsgGiro.includes("5 Florins"))florinsGanhosTotal+=5; }

        embedFields.push({ name: `${i + 1}º Giro:`, value: premioMsgGiro, inline: false });
        if (itemGanhoGiroObj) itensGanhosLista.push(itemGanhoGiroObj);
    }

    ficha.florinsDeOuro += florinsGanhosTotal;
    ficha.essenciaDeArcadia = (ficha.essenciaDeArcadia || 0) + essenciaGanhaTotal;
    if (itensGanhosLista.length > 0) {
        if (!ficha.inventario) ficha.inventario = [];
        itensGanhosLista.forEach(itemNovo => {
            const itemExistenteIdx = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === itemNovo.itemNome.toLowerCase());
            if (itemExistenteIdx > -1) { ficha.inventario[itemExistenteIdx].quantidade += (itemNovo.quantidade || 1); }
            else { ficha.inventario.push(itemNovo); }
        });
    }
    await atualizarFichaNoCacheEDb(idJogadorDiscord, ficha);

    const embed = new EmbedBuilder()
        .setColor(0xFFD700) // Dourado para jackpot
        .setTitle(`🎰 Jackpot de ${ficha.nomePersonagem || ficha.nomeJogadorSalvo}!`)
        .setDescription(`Gastou ${custoTotal} FO em ${numeroDeGiros} giro(s)!${avisoLimite}`)
        .addFields(embedFields.slice(0, 25)); // Limite de 25 fields por Embed

    let sumario = "";
    if (florinsGanhosTotal > 0) sumario += `\n**Total Florins Ganhos:** +${florinsGanhosTotal} FO`;
    if (essenciaGanhaTotal > 0) sumario += `\n**Total Essência Ganhos:** +${essenciaGanhaTotal} EA`;
    if (itensGanhosLista.length > 0) sumario += `\n**Itens Adquiridos:** ${itensGanhosLista.map(it => it.itemNome).join(', ')}`;
    sumario += `\n\n💰 **Saldo Atual:** ${ficha.florinsDeOuro} FO | ✨ **Essência Atual:** ${ficha.essenciaDeArcadia || 0} EA.`;

    if(sumario) embed.addFields({name: "Resumo dos Prêmios", value: sumario});

    return embed;
}

// ATUALIZADO: processarUsarItem para retornar Embed
async function processarUsarItem(idJogadorDiscord, args) { // args aqui é [nomeItem, String(quantidade)]
    const nomeItemParaUsar = args[0];
    const quantidadeAUsar = (args[1] && /^\d+$/.test(args[1])) ? parseInt(args[1]) : 1;

    if (!nomeItemParaUsar) { return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro ao Usar Item").setDescription("Especifique o nome do item. Uso: `/usaritem <nome do item> [quantidade]`"); }
    if (quantidadeAUsar <= 0) { return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro ao Usar Item").setDescription("Quantidade deve ser positiva.");}

    const ficha = await getFichaOuCarregar(idJogadorDiscord);
    if (!ficha) { return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro ao Usar Item").setDescription("Sua ficha não foi encontrada."); }
    if (!ficha.inventario || ficha.inventario.length === 0) { return new EmbedBuilder().setColor(0xFFCC00).setTitle("🎒 Inventário Vazio").setDescription("Você não tem itens para usar."); }

    let embedFields = [];
    let itensConsumidosContador = 0;
    let nomeItemRealParaCooldown = ""; 
    let cooldownAplicadoSegundos = 0;
    let itemFoiUsadoPeloMenosUmaVez = false;

    for (let i = 0; i < quantidadeAUsar; i++) {
        const itemIndexNoInventario = ficha.inventario.findIndex(itemInv => itemInv.itemNome.toLowerCase() === nomeItemParaUsar.toLowerCase());
        if (itemIndexNoInventario === -1) {
            embedFields.push({name: `Tentativa ${i+1}/${quantidadeAUsar}`, value: `Você não possui mais "${nomeItemParaUsar}".`, inline:false});
            break; 
        }
        const itemNoInventario = ficha.inventario[itemIndexNoInventario];
        nomeItemRealParaCooldown = itemNoInventario.itemNome;

        const itemBaseDef = ITENS_BASE_ARCADIA[itemNoInventario.itemNome.toLowerCase()];
        if (!itemBaseDef || !itemBaseDef.usavel || !itemBaseDef.efeito) {
            embedFields.push({name: `Tentativa ${i+1}/${quantidadeAUsar}`, value: `O item "${nomeItemRealParaCooldown}" não pode ser usado.`, inline:false});
            break; 
        }

        const efeitoBase = itemBaseDef.efeito;
        cooldownAplicadoSegundos = efeitoBase.cooldownSegundos || 0;

        if (efeitoBase.cooldownSegundos > 0) {
            const nomeItemKeyCooldown = nomeItemRealParaCooldown.toLowerCase();
            const proximoUsoPermitido = (ficha.cooldownsItens || {})[nomeItemKeyCooldown];
            if (proximoUsoPermitido && Date.now() < proximoUsoPermitido) {
                const tempoRestante = Math.ceil((proximoUsoPermitido - Date.now()) / 1000);
                embedFields.push({name: `Tentativa ${i+1}/${quantidadeAUsar}`, value: `"${nomeItemRealParaCooldown}" em cooldown. Aguarde ${tempoRestante}s.`, inline:false});
                continue; 
            }
        }
        let msgEfeitoIndividual = ""; let efeitoRealizadoComSucesso = false;
        // Lógica de switch para efeitos (igual à anterior)
        switch (efeitoBase.tipoEfeito) {
            case "CURA_HP": const cHP=parseInt(efeitoBase.valor)||0; if(ficha.pvAtual>=ficha.pvMax){msgEfeitoIndividual=`PV já no máximo (${ficha.pvAtual}/${ficha.pvMax}).`;} else{const pvA=ficha.pvAtual; ficha.pvAtual=Math.min(ficha.pvMax,(ficha.pvAtual||0)+cHP); msgEfeitoIndividual=`❤️ +${ficha.pvAtual-pvA} PV! (Agora: ${ficha.pvAtual}/${ficha.pvMax})`; efeitoRealizadoComSucesso=true;} break;
            case "CURA_PM": const cPM=parseInt(efeitoBase.valor)||0; if(ficha.pmAtual>=ficha.pmMax){msgEfeitoIndividual=`PM já no máximo (${ficha.pmAtual}/${ficha.pmMax}).`;} else{const pmA=ficha.pmAtual; ficha.pmAtual=Math.min(ficha.pmMax,(ficha.pmAtual||0)+cPM); msgEfeitoIndividual=`💧 +${ficha.pmAtual-pmA} PM! (Agora: ${ficha.pmAtual}/${ficha.pmMax})`; efeitoRealizadoComSucesso=true;} break;
            case "BUFF_ATRIBUTO_TEMP": msgEfeitoIndividual=efeitoBase.mensagemAoUsar||`Efeito de ${nomeItemRealParaCooldown} ativado!`; if(efeitoBase.atributo&&efeitoBase.valor&&efeitoBase.duracaoDesc){msgEfeitoIndividual+=` (${efeitoBase.atributo} +${efeitoBase.valor}, ${efeitoBase.duracaoDesc} - narrativo).`;} efeitoRealizadoComSucesso=true; break;
            case "REMOVE_CONDICAO": msgEfeitoIndividual=efeitoBase.mensagemAoUsar||`Condição "${efeitoBase.condicao}" removida (narrativo).`; efeitoRealizadoComSucesso=true; break;
            default: msgEfeitoIndividual=`Efeito de "${nomeItemRealParaCooldown}" não implementado.`;
        }
        embedFields.push({name: `Usando ${nomeItemRealParaCooldown} (${i+1}/${quantidadeAUsar})`, value: msgEfeitoIndividual, inline:false});
        if (efeitoRealizadoComSucesso) {
            itemFoiUsadoPeloMenosUmaVez = true;
            itemNoInventario.quantidade--; itensConsumidosContador++;
            if (efeitoBase.cooldownSegundos > 0) {
                if (!ficha.cooldownsItens) ficha.cooldownsItens = {};
                ficha.cooldownsItens[nomeItemRealParaCooldown.toLowerCase()] = Date.now() + (efeitoBase.cooldownSegundos * 1000);
            }
            if (itemNoInventario.quantidade <= 0) { ficha.inventario.splice(itemIndexNoInventario, 1); }
        }
    }

    if (!itemFoiUsadoPeloMenosUmaVez && embedFields.length === 0) { // Se nenhuma tentativa foi feita ou todas falharam antes do switch
        return new EmbedBuilder().setColor(0xFFCC00).setTitle("❓ Uso de Item")
            .setDescription(`Não foi possível usar "${nomeItemParaUsar}". Verifique o nome ou se possui o item.`);
    }
    if (itemFoiUsadoPeloMenosUmaVez) { // Salva a ficha apenas se um item foi efetivamente consumido/usado
        await atualizarFichaNoCacheEDb(idJogadorDiscord, ficha);
    }

    const embed = new EmbedBuilder()
        .setColor(0x2ECC71) // Verde para sucesso/info
        .setTitle(`🧪 Uso de Item por ${ficha.nomePersonagem || ficha.nomeJogadorSalvo}`)
        .addFields(embedFields.slice(0,25)); // Limite de fields

    if (itensConsumidosContador > 0 && cooldownAplicadoSegundos > 0) {
         embed.addFields({name: "⏳ Cooldown Ativado", value: `O item **${nomeItemRealParaCooldown}** entrou em cooldown por ${cooldownAplicadoSegundos} segundos.`});
    }
    if (embedFields.length === 0) { // Se o loop rodou mas nenhum campo foi adicionado (ex: tudo em cooldown)
        return new EmbedBuilder().setColor(0xFFCC00).setTitle("Flask of Utility")
            .setDescription("Não foi possível usar os itens solicitados (talvez todos em cooldown ou quantidade insuficiente após as primeiras tentativas).");
    }
    return embed;
}


// Versões SIMPLIFICADAS para jogador adicionar/remover item (para testes, não como sistema de loja)
async function processarJogadorAddItem(idJogadorDiscord, args) { // args é [nomeItem, String(quantidade)]
    const nomeItemInput = args[0];
    const quantidade = (args[1] && /^\d+$/.test(args[1])) ? parseInt(args[1]) : 1;

    if (!nomeItemInput) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro").setDescription("Qual item você quer adicionar? Uso: `/additem <nome do item> [quantidade]`");
    if (isNaN(quantidade) || quantidade < 1) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro").setDescription("Quantidade inválida.");

    const ficha = await getFichaOuCarregar(idJogadorDiscord);
    if (!ficha) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro").setDescription("Sua ficha não foi encontrada.");
    if (!ficha.inventario) ficha.inventario = [];

    const itemBaseDef = ITENS_BASE_ARCADIA[nomeItemInput.toLowerCase()];
    let itemFinal;
    let msgTipoItem = "";

    if (itemBaseDef) {
        itemFinal = JSON.parse(JSON.stringify(itemBaseDef));
        itemFinal.quantidade = quantidade;
        msgTipoItem = "Item da base de dados adicionado.";
    } else { 
        itemFinal = { itemNome: nomeItemInput, quantidade: quantidade, tipo: "Diversos", descricao: "Item customizado adicionado.", usavel: false };
        msgTipoItem = "Item customizado (não existente na base) foi adicionado.";
    }

    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === itemFinal.itemNome.toLowerCase());
    if (itemExistenteIndex > -1) {
        ficha.inventario[itemExistenteIndex].quantidade += itemFinal.quantidade;
    } else {
        ficha.inventario.push(itemFinal);
    }
    await atualizarFichaNoCacheEDb(idJogadorDiscord, ficha);
    return new EmbedBuilder().setColor(0x00FF00).setTitle("✅ Item Adicionado")
        .setDescription(`**${itemFinal.itemNome}** (x${quantidade}) adicionado ao inventário de ${ficha.nomePersonagem || ficha.nomeJogadorSalvo}.\n*${msgTipoItem}*`);
}

async function processarJogadorDelItem(idJogadorDiscord, args) { // args é [nomeItem, String(quantidade)]
    const nomeItemInput = args[0];
    const quantidadeRemover = (args[1] && /^\d+$/.test(args[1])) ? parseInt(args[1]) : 1;

    if (!nomeItemInput) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro").setDescription("Qual item você quer remover? Uso: `/delitem <nome do item> [quantidade]`");
    if (isNaN(quantidadeRemover) || quantidadeRemover < 1) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro").setDescription("Quantidade inválida.");

    const ficha = await getFichaOuCarregar(idJogadorDiscord);
    if (!ficha || !ficha.inventario) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro").setDescription("Sua ficha ou inventário não foi encontrado.");

    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItemInput.toLowerCase());
    if (itemExistenteIndex === -1) return new EmbedBuilder().setColor(0xFFCC00).setTitle("🔎 Item Não Encontrado").setDescription(`Item "${nomeItemInput}" não encontrado no seu inventário.`);

    const itemOriginal = ficha.inventario[itemExistenteIndex];
    if (itemOriginal.quantidade < quantidadeRemover) {
        return new EmbedBuilder().setColor(0xFFCC00).setTitle("⚠️ Quantidade Insuficiente")
            .setDescription(`Você não tem ${quantidadeRemover} de "${itemOriginal.itemNome}". Você possui ${itemOriginal.quantidade}.`);
    }

    itemOriginal.quantidade -= quantidadeRemover;
    let msgRetorno = "";
    if (itemOriginal.quantidade <= 0) {
        ficha.inventario.splice(itemExistenteIndex, 1);
        msgRetorno = `"${itemOriginal.itemNome}" foi removido completamente do seu inventário.`;
    } else {
        msgRetorno = `${quantidadeRemover}x "${itemOriginal.itemNome}" removido(s). Restam ${itemOriginal.quantidade}.`;
    }
    await atualizarFichaNoCacheEDb(idJogadorDiscord, ficha);
    return new EmbedBuilder().setColor(0x00FF00).setTitle("🗑️ Item Removido").setDescription(msgRetorno);
}


// Funções de geração de embeds de erro e aviso
function gerarEmbedErro(titulo, descricao) {
    return new EmbedBuilder().setColor(0xFF0000).setTitle(`❌ ${titulo}`).setDescription(descricao);
}

function gerarEmbedAviso(titulo, descricao) {
    return new EmbedBuilder().setColor(0xFFCC00).setTitle(`⚠️ ${titulo}`).setDescription(descricao);
}

// Funções Admin (lógica portada, retornando string ou Embed simples. Precisa definir Slash Command e handler no index.js)

// Em arcadia_sistema.js, SUBSTITUA a função processarAdminAddXP existente por esta:
async function processarAdminAddXP(idAlvoDiscord, valorXP, adminNome) { // Parâmetros corrigidos
    // idAlvoDiscord já é o ID string do usuário.
    // valorXP já é um número.

    // A verificação de idAlvo já deve ser feita no index.js ao pegar options.getUser('jogador').id
    // Mas uma verificação adicional não faz mal, ou podemos assumir que já é um ID válido.
    // Para manter a segurança, vamos verificar.
    if (!idAlvoDiscord || !/^\d{17,19}$/.test(idAlvoDiscord)) { 
        return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin")
            .setDescription(`ID do jogador alvo fornecido (${idAlvoDiscord || 'Nenhum'}) é inválido.`);
    }
    if (isNaN(valorXP)) { // valorXP já é um número, mas uma checagem de segurança
        return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin").setDescription("Valor de XP inválido.");
    }

    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha) {
        return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin")
            .setDescription(`Ficha não encontrada para o jogador com ID ${idAlvoDiscord}.`);
    }

    const xpAntes = ficha.xpAtual || 0;
    ficha.xpAtual = xpAntes + valorXP;
    let msgsLevelUp = []; 
    let subiuNivel = false;
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));

    // Loop de level up (garantir que xpProximoNivel seja > 0 para evitar loop infinito se algo der errado)
    while (ficha.xpAtual >= ficha.xpProximoNivel && (ficha.xpProximoNivel || 0) > 0) {
        subiuNivel = true; 
        ficha.xpAtual -= ficha.xpProximoNivel;
        const nivelAntigo = ficha.nivel || 0; 
        ficha.nivel = nivelAntigo + 1;
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + 2;
        // A atualização de PV/PM Max e cura para o máximo será feita por atualizarFichaNoCacheEDb
        msgsLevelUp.push(`🎉 **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** alcançou o Nível ${ficha.nivel}!`);
        ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    }

    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);

    let desc = `XP de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** (ID: ${idAlvoDiscord}) alterado de ${xpAntes} para ${ficha.xpAtual}/${ficha.xpProximoNivel} por ${adminNome}.`;
    if(subiuNivel) {
        desc = msgsLevelUp.join("\n") + "\n\n" + desc;
    }

    return new EmbedBuilder().setColor(0x7289DA).setTitle("✨ XP Adicionado (Admin)").setDescription(desc).setTimestamp();
}

// --- NOVAS FUNÇÕES DE LÓGICA PARA COMANDOS DE ADMIN ---

// (Certifique-se de que 'client' do discord.js está acessível se for usar client.users.fetch,
// ou passe 'client' como parâmetro para processarAdminCriarFicha se o index.js o tiver)
// Por ora, para simplificar, assumirei que o nome do jogador alvo virá do admin ou será o ID.
async function processarAdminCriarFicha(client, idAlvoDiscord, nomePersonagem, racaNome, classeNome, reinoNome, adminNome) {
    // Tenta buscar o nome de usuário do Discord do alvo.
    // Se o bot não estiver no mesmo servidor que o usuário alvo ou houver algum problema,
    // o nome pode não ser encontrado, então usamos o ID como fallback.
    let nomeJogadorAlvoDisplay = `ID:${idAlvoDiscord}`;
    try {
        const targetUser = await client.users.fetch(idAlvoDiscord);
        if (targetUser) {
            nomeJogadorAlvoDisplay = targetUser.username;
        }
    } catch (fetchError) {
        console.warn(`[AdminCriarFicha] Não foi possível buscar o nome de usuário para ID ${idAlvoDiscord}: ${fetchError.message}`);
    }


    const racaValida = RACAS_ARCADIA.find(r => r.nome.toLowerCase() === racaNome.toLowerCase());
    const classeValida = CLASSES_ARCADIA.find(c => c.nome.toLowerCase() === classeNome.toLowerCase());
    const reinoValido = REINOS_ARCADIA.find(reino => reino.nome.toLowerCase() === reinoNome.toLowerCase());

    let errorMessages = [];
    if (!nomePersonagem || nomePersonagem.length < 3 || nomePersonagem.length > 32) errorMessages.push("Nome do personagem deve ter entre 3 e 32 caracteres.");
    if (!racaValida) errorMessages.push(`Raça "${racaNome}" inválida. Use \`/listaracas\`.`);
    if (!classeValida) errorMessages.push(`Classe "${classeNome}" inválida. Use \`/listaclasses\`.`);
    if (!reinoValido) errorMessages.push(`Reino "${reinoNome}" inválido. Use \`/listareinos\`.`);

    if (errorMessages.length > 0) {
        return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro ao Criar Ficha (Admin)").setDescription(errorMessages.join("\n"));
    }

    let ficha = JSON.parse(JSON.stringify(fichaModeloArcadia));
    ficha._id = idAlvoDiscord;
    ficha.nomeJogadorSalvo = nomeJogadorAlvoDisplay; 
    ficha.nomePersonagem = nomePersonagem;
    ficha.raca = racaValida.nome;
    ficha.classe = classeValida.nome;
    ficha.origemReino = reinoValido.nome;

    ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)); 
    ficha.nivel = 1;
    ficha.xpAtual = 0;
    ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    ficha.florinsDeOuro = fichaModeloArcadia.florinsDeOuro;
    ficha.essenciaDeArcadia = fichaModeloArcadia.essenciaDeArcadia;
    ficha.inventario = fichaModeloArcadia.inventario.map(itemModelo => JSON.parse(JSON.stringify(itemModelo)));

    // PV/PM são calculados e definidos em atualizarFichaNoCacheEDb
    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha); 
    return new EmbedBuilder().setColor(0x00FF00).setTitle("🔧 Ficha Criada/Sobrescrita (Admin)")
        .setDescription(`Personagem **${nomePersonagem}** (${ficha.raca} ${ficha.classe}) para ${ficha.nomeJogadorSalvo} foi criado/sobrescrito por ${adminNome}.`)
        .setTimestamp();
}

async function processarAdminSetNivel(idAlvoDiscord, novoNivel, adminNome) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin").setDescription(`Ficha não encontrada para ID ${idAlvoDiscord}.`);
    if (isNaN(novoNivel) || novoNivel < 1) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin").setDescription("Nível inválido. Deve ser um número maior ou igual a 1.");

    const nivelAntigo = ficha.nivel || 1;
    ficha.nivel = novoNivel;
    ficha.xpAtual = 0; 
    ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));

    const diffNivel = novoNivel - nivelAntigo;
    if (diffNivel !== 0) {
      ficha.atributos.pontosParaDistribuir = Math.max(0, (ficha.atributos.pontosParaDistribuir || 0) + (diffNivel * 2));
    }

    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);
    return new EmbedBuilder().setColor(0x7289DA).setTitle("🔧 Nível Definido (Admin)")
        .setDescription(`Nível de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** (ID: ${idAlvoDiscord}) definido para **${ficha.nivel}** por ${adminNome}.\nXP zerado. Pontos para distribuir: **${ficha.atributos.pontosParaDistribuir || 0}**.`);
}

async function processarAdminAddMoedas(idAlvoDiscord, quantidade, tipoMoeda, adminNome) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin").setDescription(`Ficha não encontrada para o jogador com ID ${idAlvoDiscord}.`);
    if (isNaN(quantidade)) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin").setDescription("Quantidade de moeda inválida.");

    const nomeMoedaDisplay = tipoMoeda === 'florinsDeOuro' ? "Florins de Ouro (FO)" : "Essências de Arcádia (EA)";
    const saldoAnterior = ficha[tipoMoeda] || 0;
    ficha[tipoMoeda] = saldoAnterior + quantidade;
    if (ficha[tipoMoeda] < 0) ficha[tipoMoeda] = 0;

    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);
    return new EmbedBuilder().setColor(0x7289DA).setTitle(`💰 ${nomeMoedaDisplay} Ajustados (Admin)`)
        .setDescription(`${nomeMoedaDisplay} de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** (ID: ${idAlvoDiscord}) ${quantidade >= 0 ? 'aumentados' : 'diminuídos'} em **${Math.abs(quantidade)}** por ${adminNome}.\nSaldo Anterior: ${saldoAnterior}\nNovo Saldo: **${ficha[tipoMoeda]}**.`);
}

async function processarAdminAddItem(idAlvoDiscord, nomeItem, quantidade = 1, tipoCustom, descricaoCustom, adminNome) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin").setDescription(`Ficha não encontrada para o jogador com ID ${idAlvoDiscord}.`);
    if (!ficha.inventario) ficha.inventario = [];
    if (quantidade < 1) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin").setDescription("Quantidade do item deve ser ao menos 1.");

    const itemBaseDef = ITENS_BASE_ARCADIA[nomeItem.toLowerCase()];
    let itemFinal;
    let origemItemMsg = "";

    if (itemBaseDef) {
        itemFinal = JSON.parse(JSON.stringify(itemBaseDef)); // Cópia profunda
        itemFinal.quantidade = quantidade;
        if (tipoCustom) itemFinal.tipo = tipoCustom; 
        if (descricaoCustom) itemFinal.descricao = descricaoCustom;
        origemItemMsg = "Item da base de dados.";
    } else {
        itemFinal = { 
            itemNome: nomeItem, 
            quantidade: quantidade, 
            tipo: tipoCustom || "Item Especial (Admin)", 
            descricao: descricaoCustom || "Adicionado por um administrador.", 
            usavel: false 
        };
        origemItemMsg = "Item customizado criado.";
    }

    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === itemFinal.itemNome.toLowerCase());
    if (itemExistenteIndex > -1) {
        ficha.inventario[itemExistenteIndex].quantidade = (ficha.inventario[itemExistenteIndex].quantidade || 0) + itemFinal.quantidade;
        if (tipoCustom) ficha.inventario[itemExistenteIndex].tipo = tipoCustom;
        if (descricaoCustom) ficha.inventario[itemExistenteIndex].descricao = descricaoCustom;
    } else {
        ficha.inventario.push(itemFinal);
    }
    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);
    return new EmbedBuilder().setColor(0x7289DA).setTitle("➕ Item Adicionado ao Inventário (Admin)")
        .setDescription(`**${itemFinal.itemNome}** (x${quantidade}) adicionado ao inventário de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** (ID: ${idAlvoDiscord}) por ${adminNome}.\n*${origemItemMsg}*`);
}

async function processarAdminDelItem(idAlvoDiscord, nomeItem, quantidadeRemover = 1, adminNome) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha || !ficha.inventario) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin").setDescription(`Ficha ou inventário não encontrado para ID ${idAlvoDiscord}.`);
    if (quantidadeRemover < 1) return new EmbedBuilder().setColor(0xFF000).setTitle("❌ Erro Admin").setDescription("Quantidade a remover deve ser ao menos 1.");

    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemExistenteIndex === -1) return new EmbedBuilder().setColor(0xFFCC00).setTitle("🔎 Item Não Encontrado (Admin)").setDescription(`Item "${nomeItem}" não encontrado no inventário de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}**.`);

    const itemOriginal = ficha.inventario[itemExistenteIndex];
    let msgRetorno = "";
    if (itemOriginal.quantidade < quantidadeRemover) {
        return new EmbedBuilder().setColor(0xFFCC00).setTitle("⚠️ Quantidade Insuficiente (Admin)")
            .setDescription(`**${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** não tem ${quantidadeRemover} de "${itemOriginal.itemNome}". Possui ${itemOriginal.quantidade}.`);
    }

    itemOriginal.quantidade -= quantidadeRemover;
    if (itemOriginal.quantidade <= 0) {
        ficha.inventario.splice(itemExistenteIndex, 1);
        msgRetorno = `**${itemOriginal.itemNome}** foi removido completamente do inventário de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** por ${adminNome}.`;
    } else {
        msgRetorno = `${quantidadeRemover}x **${itemOriginal.itemNome}** removido(s). Restam ${itemOriginal.quantidade} no inventário de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}**. (Admin: ${adminNome})`;
    }
    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);
    return new EmbedBuilder().setColor(0x7289DA).setTitle("🗑️ Item Removido do Inventário (Admin)").setDescription(msgRetorno);
}

async function processarAdminSetAtributo(idAlvoDiscord, nomeAtributo, novoValor, adminNome) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin").setDescription(`Ficha não encontrada para ID ${idAlvoDiscord}.`);

    const attrKey = nomeAtributo.toLowerCase();
    if (!atributosValidos.includes(attrKey)) { // atributosValidos precisa estar definido no escopo
        return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin").setDescription(`Atributo "${nomeAtributo}" inválido. Válidos: ${atributosValidos.join(', ')}.`);
    }
    if (isNaN(novoValor) || novoValor < 0) {
        return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin").setDescription(`Valor "${novoValor}" para ${attrKey} inválido. Deve ser um número não negativo.`);
    }

    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    const valorAntigo = ficha.atributos[attrKey] || 0;
    ficha.atributos[attrKey] = novoValor;

    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);
    const nomeAtributoDisplay = attrKey.charAt(0).toUpperCase() + attrKey.slice(1).replace('base', ' Base');
    return new EmbedBuilder().setColor(0x7289DA).setTitle("📊 Atributo Definido (Admin)")
        .setDescription(`Atributo **${nomeAtributoDisplay}** de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** (ID: ${idAlvoDiscord}) foi alterado de ${valorAntigo} para **${novoValor}** por ${adminNome}.`);
}

async function processarAdminAddPontosAtributo(idAlvoDiscord, quantidade, adminNome) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin").setDescription(`Ficha não encontrada para ID ${idAlvoDiscord}.`);
    if (isNaN(quantidade)) return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin").setDescription("Quantidade de pontos inválida.");

    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    const pontosAntes = ficha.atributos.pontosParaDistribuir || 0;
    ficha.atributos.pontosParaDistribuir = pontosAntes + quantidade;
    if (ficha.atributos.pontosParaDistribuir < 0) ficha.atributos.pontosParaDistribuir = 0;

    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);
    return new EmbedBuilder().setColor(0x7289DA).setTitle("✨ Pontos de Atributo Ajustados (Admin)")
        .setDescription(`Pontos para distribuir de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** (ID: ${idAlvoDiscord}) ajustados em ${quantidade} por ${adminNome}.\nDe ${pontosAntes} para **${ficha.atributos.pontosParaDistribuir}**.`);
}

async function processarAdminExcluirFicha(idAlvoDiscord, confirmacao, adminNome, membroAlvo) {
    if (confirmacao !== "CONFIRMAR EXCLUSAO") {
        return new EmbedBuilder().setColor(0xFFCC00).setTitle("⚠️ Exclusão Não Confirmada")
            .setDescription("A frase de confirmação para excluir a ficha é inválida ou não foi fornecida corretamente. A ficha **NÃO** foi excluída.\nPara confirmar, na opção `confirmacao` do comando, digite a frase exata: `CONFIRMAR EXCLUSAO`");
    }

    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha) {
        return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Admin")
            .setDescription(`Nenhuma ficha encontrada para o ID ${idAlvoDiscord}. Nada foi excluído.`);
    }

    const nomePersonagemExcluido = ficha.nomePersonagem || "Nome Desconhecido";
    const nomeJogadorExcluido = ficha.nomeJogadorSalvo || `ID: ${idAlvoDiscord}`;

    if (!fichasCollection) {
        console.error("Coleção de fichas não inicializada. Exclusão abortada para jogador:", idAlvoDiscord);
        return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro Crítico no DB")
            .setDescription("Não foi possível conectar à base de dados para excluir a ficha. Contate o desenvolvedor do bot.");
    }

    try {
        const resultado = await fichasCollection.deleteOne({ _id: String(idAlvoDiscord) });
        if (resultado.deletedCount === 1) {
            delete todasAsFichas[String(idAlvoDiscord)];
            
            // Remover cargos se o membro ainda estiver no servidor
            let cargosRemovidosMsg = "";
            if (membroAlvo) {
                try {
                    // Remover cargo da raça
                    const cargoRaca = membroAlvo.guild.roles.cache.find(role => 
                        role.name === MAPA_CARGOS_RACAS[ficha.raca]
                    );
                    if (cargoRaca && membroAlvo.roles.cache.has(cargoRaca.id)) {
                        await membroAlvo.roles.remove(cargoRaca);
                    }

                    // Remover cargo de Aventureiro
                    const cargoAventureiro = membroAlvo.guild.roles.cache.find(role => 
                        role.name === NOME_CARGO_AVENTUREIRO
                    );
                    if (cargoAventureiro && membroAlvo.roles.cache.has(cargoAventureiro.id)) {
                        await membroAlvo.roles.remove(cargoAventureiro);
                    }

                    // Adicionar cargo de Visitante
                    const cargoVisitante = membroAlvo.guild.roles.cache.find(role => 
                        role.name === NOME_CARGO_VISITANTE
                    );
                    if (cargoVisitante && !membroAlvo.roles.cache.has(cargoVisitante.id)) {
                        await membroAlvo.roles.add(cargoVisitante);
                    }

                    cargosRemovidosMsg = "\n\n🎭 Cargos relacionados à ficha foram removidos e cargo de Visitante restaurado.";
                } catch (roleError) {
                    console.error(`Erro ao gerenciar cargos para ${idAlvoDiscord}:`, roleError);
                    cargosRemovidosMsg = "\n\n⚠️ Houve um erro ao tentar remover alguns cargos.";
                }
            }

            console.log(`[ADMIN] Ficha para ${nomeJogadorExcluido} (Personagem: ${nomePersonagemExcluido}, ID: ${idAlvoDiscord}) excluída por ${adminNome}.`);
            return new EmbedBuilder().setColor(0xFF0000).setTitle("🗑️ Ficha Excluída Permanentemente (Admin)")
                .setDescription(`A ficha de **${nomePersonagemExcluido}** (Jogador: ${nomeJogadorExcluido}) foi **EXCLUÍDA PERMANENTEMENTE** do banco de dados por ${adminNome}.${cargosRemovidosMsg}`);
        } else {
            console.log(`[ADMIN] Tentativa de excluir ficha para ID ${idAlvoDiscord} por ${adminNome}, mas a ficha não foi encontrada no DB para exclusão (deletedCount: 0).`);
            return new EmbedBuilder().setColor(0xFFCC00).setTitle("⚠️ Atenção (Admin)")
                .setDescription(`A ficha para ID ${idAlvoDiscord} não foi encontrada no banco de dados para ser excluída (ou já havia sido removida).`);
        }
    } catch (error) {
        console.error(`Erro ao excluir ficha para ${idAlvoDiscord} no MongoDB:`, error);
        return new EmbedBuilder().setColor(0xFF0000).setTitle("❌ Erro ao Excluir Ficha (Admin)")
            .setDescription("Ocorreu um erro no servidor ao tentar excluir a ficha. Verifique os logs do bot.");
    }
}
// Adicionar mais funções admin aqui (processarAdminSetNivel, processarAdminAddMoedas, etc.)
// Elas seguiriam um padrão similar: receber args (já processados pelo index.js a partir das options do Slash Command),
// buscar a ficha, modificar, salvar, e retornar um Embed ou string de confirmação.

function gerarListaComandos(isOwner) { /* ...código da v. anterior, já retorna Embed ... */
    let embed = new EmbedBuilder().setColor(0x4A90E2).setTitle("📜 Comandos de Arcádia (Discord)")
        .setDescription("Use os comandos abaixo para interagir com o mundo de Arcádia!");
    embed.addFields(
        { name: '👋 Boas-vindas', value: "`/arcadia`, `/bemvindo`, `/oi`\n*Mensagem inicial.*", inline: false },
        { name: '🏓 Teste', value: "`/ping`\n*Verifica se o bot está responsivo.*", inline: false },
        { name: '✨ Personagem', value: "`/criar nome:<Nome> raca:<Raça> classe:<Classe> reino:<Reino>`\n*Cria seu personagem.*\n\n`/ficha [@jogador]` (opcional)\n*Exibe sua ficha ou de outro jogador (admin).*\n\n`/distribuirpontos [forca:val] [agilidade:val] ...`\n*Distribui seus pontos de atributo.*", inline: false },
        { name: '🎒 Itens & Ações', value: "`/usaritem item:<nome> [quantidade:val]`\n*Usa um item.*\n\n`/jackpot [giros:val]` (Custo: 25 FO)\n*Tente sua sorte!*\n\n(Teste) `/additem nome:<nome> [quantidade:val]`\n(Teste) `/delitem nome:<nome> [quantidade:val]`", inline: false },
        { name: '📚 Informativos', value: "`/listaracas`, `/listaclasses`, `/listareinos`", inline: false }
    );
if (isOwner) {
    let adminCommandsDescription = "";
    adminCommandsDescription += "`/admincriar jogador:<@jogador> nome:<nome> raca:<raça> classe:<classe> reino:<reino>`\n*Cria/sobrescreve uma ficha.*\n\n";
    adminCommandsDescription += "`/adminaddxp jogador:<@jogador> xp:<quantidade>`\n*Adiciona XP a um jogador.*\n\n";
    adminCommandsDescription += "`/adminsetnivel jogador:<@jogador> nivel:<novo_nivel>`\n*Define o nível de um jogador.*\n\n";
    adminCommandsDescription += "`/adminaddflorins jogador:<@jogador> quantidade:<valor>`\n*Adiciona/remove Florins.*\n\n";
    adminCommandsDescription += "`/adminaddessencia jogador:<@jogador> quantidade:<valor>`\n*Adiciona/remove Essência.*\n\n";
    adminCommandsDescription += "`/adminadditem jogador:<@jogador> item:<nome> [quantidade:val] [tipo:val] [descricao:val]`\n*Adiciona item ao inventário.*\n\n";
    adminCommandsDescription += "`/admindelitem jogador:<@jogador> item:<nome> [quantidade:val]`\n*Remove item do inventário.*\n\n";
    adminCommandsDescription += "`/adminsetattr jogador:<@jogador> atributo:<atr> valor:<val>`\n*Define um atributo.*\n\n";
    adminCommandsDescription += "`/adminaddpontosattr jogador:<@jogador> quantidade:<val>`\n*Adiciona/remove pontos para distribuir.*\n\n";
    adminCommandsDescription += "`/adminexcluirficha jogador:<@jogador> confirmacao:CONFIRMAR EXCLUSAO`\n*EXCLUI PERMANENTEMENTE uma ficha.*";

    embed.addFields(
        { 
            name: '👑 Comandos de Admin (Visível Apenas para Você)', 
            value: adminCommandsDescription, 
            inline: false 
        }
    );
}
embed.setFooter({ text: "Use /comandos para ver esta lista."});
return embed;
}

// --- EXPORTS ---
// No final do seu arcadia_sistema.js, ATUALIZE o module.exports:
module.exports = {
    // Dados
    RACAS_ARCADIA, CLASSES_ARCADIA, REINOS_ARCADIA, ITENS_BASE_ARCADIA, fichaModeloArcadia,
    gerarEmbedErro, gerarEmbedAviso,
    gerarEmbedHistoria,
    JACKPOT_PREMIOS_NOMES_COMUNS, JACKPOT_PREMIOS_NOMES_INCOMUNS, JACKPOT_PREMIOS_NOMES_RAROS,
    atributosValidos, 
    MAPA_CARGOS_RACAS,
 NOME_CARGO_AVENTUREIRO,
    NOME_CARGO_VISITANTE,
    ID_CANAL_BOAS_VINDAS_RPG,
    ID_CANAL_RECRUTAMENTO,          // ADICIONADO
    ID_CANAL_ATUALIZACAO_FICHAS,    // ADICIONADO

    // Certifique-se que esta constante está definida no topo do arquivo
    // Funções DB
    conectarMongoDB, carregarFichasDoDB, getFichaOuCarregar, 
    atualizarFichaNoCacheEDb, calcularXpProximoNivel,
    // Funções Lógica Jogador (as que você já tinha e funcionavam)
    gerarMensagemBoasVindas, gerarListaRacasEmbed, gerarListaClassesEmbed, gerarListaReinosEmbed,
    processarCriarFichaSlash, processarVerFichaEmbed, processarDistribuirPontosSlash,
    processarJackpot, processarUsarItem, processarJogadorAddItem, processarJogadorDelItem,
    gerarListaComandos, // Sua função de listar comandos

    // ADICIONE ESTAS NOVAS FUNÇÕES DE ADMIN (ou substitua se já tinha alguma com nome parecido):
    processarAdminCriarFicha,
    processarAdminAddXP, // Garanta que está usando a versão que retorna Embed
    processarAdminSetNivel,
    processarAdminAddMoedas,
    processarAdminAddItem,
    processarAdminDelItem,
    processarAdminSetAtributo,
    processarAdminAddPontosAtributo,
    processarAdminExcluirFicha
};