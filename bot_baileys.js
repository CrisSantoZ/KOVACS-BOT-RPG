// Nome do arquivo: bot_baileys.js
// RPG: Arcádia - A Era dos Reinos

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');

// --- CONFIGURAÇÃO DE AMBIENTE E IDs ---
const OWNER_ID = process.env.OWNER_ID ? process.env.OWNER_ID.trim() : "";
const JOGADORES_PERMITIDOS_IDS_STRING = process.env.JOGADORES_PERMITIDOS_IDS || "";
const listaJogadoresPermitidos = new Set(
    JOGADORES_PERMITIDOS_IDS_STRING.split(',')
        .map(id => String(id).trim()) 
        .filter(id => id && /^\d+$/.test(id)) 
);

// --- CONSTANTES DE ARCÁDIA (PARA OS COMANDOS DE LISTAGEM) ---
const RACAS_ARCADIA = [
    { nome: "Eldari", grupo: "Puros", desc: "Elfos nobres com domínio natural da magia arcana. Vivem em florestas encantadas." },
    { nome: "Valtheran", grupo: "Puros", desc: "Anões de montanhas profundas, exímios forjadores e guerreiros." },
    { nome: "Seraphim", grupo: "Puros", desc: "Raça alada de aparência angelical, guardiões antigos de templos mágicos." },
    { nome: "Terrano", grupo: "Humanos", desc: "Humanos comuns, adaptáveis e versáteis." },
    { nome: "Vharen", grupo: "Humanos", desc: "Humanos com sangue de antigos magos, sensíveis à magia." },
    { nome: "Drakyn", grupo: "Humanos", desc: "Humanos com linhagem de dragões, com habilidades físicas e mágicas elevadas." },
    { nome: "Mei’ra", grupo: "Mistos", desc: "Meio-elfos, diplomáticos e ligados à natureza." },
    { nome: "Thornak", grupo: "Mistos", desc: "Meio-orcs, fortes e leais, muitas vezes caçados por seu sangue misto." },
    { nome: "Lunari", grupo: "Mistos", desc: "Descendentes de humanos e Seraphim, possuem magia ligada à lua e sonhos." }
];

const CLASSES_ARCADIA = [
    { nome: "Arcanista", desc: "Mestre da magia pura." },
    { nome: "Guerreiro Real", desc: "Lutador disciplinado com honra e estratégia." },
    { nome: "Feiticeiro Negro", desc: "Usuário de magias proibidas." },
    { nome: "Caçador Sombrio", desc: "Perito em rastrear criaturas e inimigos." },
    { nome: "Guardião da Luz", desc: "Defensor divino com escudo e feitiços sagrados." },
    { nome: "Mestre das Bestas", desc: "Controla criaturas mágicas e animais." },
    { nome: "Bardo Arcano", desc: "Usa música e magia para manipular emoções." },
    { nome: "Alquimista", desc: "Cria bombas, poções e venenos únicos." },
    { nome: "Clérigo da Ordem", desc: "Cura aliados e invoca milagres." },
    { nome: "Andarilho Rúnico", desc: "Usa runas ancestrais como armas mágicas." },
    { nome: "Espadachim Etéreo", desc: "Guerreiro veloz que une magia e espada." },
    { nome: "Invasor Dracônico", desc: "Classe híbrida com traços de dragão." },
    { nome: "Lâmina da Névoa", desc: "Assassino furtivo, mestre em ilusões." },
    { nome: "Conjurador do Vazio", desc: "Controla magias interdimensionais." }
];

const REINOS_ARCADIA = [
    { nome: "Valdoria", desc: "Reino dos humanos. Castelo real, vilarejos e campos férteis." },
    { nome: "Elarion", desc: "Floresta encantada dos elfos Eldari, lar de magia antiga." },
    { nome: "Durnholde", desc: "Reino montanhoso dos anões Valtherans." },
    { nome: "Caelum", desc: "Cidade flutuante dos Seraphim, isolada do resto do mundo." },
    { nome: "Ravengard", desc: "Terras sombrias, domínio dos Sombrios e impuros." },
    { nome: "Thornmere", desc: "Território livre, habitado por Mistos e refugiados." },
    { nome: "Isle of Morwyn", desc: "Ilha mágica proibida, berço de segredos antigos." }
];

// --- DEFINIÇÕES DE ITENS PARA O JACKPOT E USO ---
const JACKPOT_PREMIOS_COMUNS = [
    { 
        itemNome: "Poção de Cura Menor", quantidade: 1, tipo: "Consumível", descricao: "Restaura uma pequena quantidade de PV.",
        usavel: true, 
        efeito: { tipoEfeito: "CURA_HP", valor: 25, mensagemAoUsar: "Você bebe a Poção de Cura Menor e sente o alívio.", cooldownSegundos: 60 }
    },
    { 
        itemNome: "Rações de Viagem (1 dia)", quantidade: 1, tipo: "Consumível", descricao: "Comida para um dia de jornada.",
        usavel: false // Exemplo de item não usável diretamente via comando !usar
    },
    { 
        itemNome: "Pergaminho em Branco", quantidade: 3, tipo: "Material", descricao: "Para anotações ou cópia de magias simples.",
        usavel: false
    },
    { 
        itemNome: "Tocha", quantidade: 2, tipo: "Ferramenta", descricao: "Ilumina locais escuros.",
        usavel: false // Poderia ter um efeito narrativo ou de ambiente, mas não um 'uso' simples
    },
    { 
        itemNome: "Kit de Reparos Simples", quantidade: 1, tipo: "Ferramenta", descricao: "Permite reparos básicos em equipamentos.",
        usavel: false // Uso poderia ser mais complexo ou via DM
    }
];

const JACKPOT_PREMIOS_INCOMUNS = [
    { 
        itemNome: "Adaga de Ferro Balanceada", quantidade: 1, tipo: "Arma Leve", descricao: "Uma adaga bem trabalhada, melhor que a comum.",
        usavel: false // Equipamentos são equipados, não 'usados' como consumíveis
    },
    { 
        itemNome: "Antídoto Simples", quantidade: 1, tipo: "Consumível", descricao: "Cura venenos fracos.",
        usavel: true,
        efeito: { tipoEfeito: "REMOVE_CONDICAO", condicao: "Envenenado Leve", mensagemAoUsar: "Você toma o Antídoto e o veneno em suas veias é neutralizado.", cooldownSegundos: 120 }
        // Nota: A mecânica de REMOVE_CONDICAO ainda é narrativa no handleUsarItem.
    },
    { 
        itemNome: "Amuleto da Sorte Desgastado", quantidade: 1, tipo: "Amuleto", descricao: "Um amuleto simples que parece ter visto dias melhores. Talvez traga sorte?",
        usavel: false // Equipável
    },
    {
        itemNome: "Poção de Mana Menor", quantidade: 1, tipo: "Consumível", descricao: "Restaura uma pequena quantidade de PM.",
        usavel: true,
        efeito: { tipoEfeito: "CURA_PM", valor: 20, mensagemAoUsar: "Você bebe a Poção de Mana Menor e sua energia mágica é revigorada.", cooldownSegundos: 60 }
    }
];

const JACKPOT_PREMIOS_RAROS = [
    { 
        itemNome: "Elixir de Agilidade Menor", quantidade: 1, tipo: "Poção", descricao: "Aumenta temporariamente a Agilidade.",
        usavel: true,
        efeito: { 
            tipoEfeito: "BUFF_ATRIBUTO_TEMP", atributo: "agilidade", valor: 2, duracaoDesc: "por 5 minutos", 
            mensagemAoUsar: "Você bebe o Elixir e se sente mais ágil e rápido!",
            cooldownSegundos: 300 
        }
    },
    { 
        itemNome: "Mapa do Tesouro Desbotado", quantidade: 1, tipo: "Outro", descricao: "Um mapa antigo e frágil, com marcações que podem levar a algo... ou nada.",
        usavel: false // Item de quest/narrativa
    },
    { 
        itemNome: "Gema Bruta Valiosa", quantidade: 1, tipo: "Material Precioso", descricao: "Uma gema que pode valer uma boa quantia para o joalheiro certo.",
        usavel: false // Item de venda/crafting
    }
];


// --- MODELO DA FICHA DE PERSONAGEM - ARCÁDIA ---
const fichaModeloArcadia = {
    nomeJogadorSalvo: "", 
    nomePersonagem: "N/A",
    raca: "A Ser Definida", 
    classe: "A Ser Definida", 
    origemReino: "N/A", 
    nivel: 1,
    xpAtual: 0,
    xpProximoNivel: 100, 
    atributos: {
        forca: 5, agilidade: 5, vitalidade: 5,
        manaBase: 5, intelecto: 5, carisma: 5,
        pontosParaDistribuir: 30 
    },
    pvMax: 0, pvAtual: 0, pmMax: 0, pmAtual: 0,
    ataqueBase: 0, defesaBase: 0, 
    reputacao: {}, 
    florinsDeOuro: 50, essenciaDeArcadia: 0,
    habilidadesEspeciais: [], pericias: [], magiasConhecidas: [], 
    equipamento: {
        maoDireita: null, maoEsquerda: null, armaduraCorpo: null,
        elmo: null, amuleto: null, anel1: null, anel2: null,
    },
    inventario: [ 
        { itemNome: "Adaga Simples", quantidade: 1, tipo: "Arma Leve", descricao: "Uma adaga básica de bronze." },
        { itemNome: "Rações de Viagem", quantidade: 3, tipo: "Consumível", descricao: "Suficiente para 3 dias." }
    ],
    historiaPersonagem: "", idiomas: ["Comum Arcádiano"], 
    condicoes: [], 
    cooldownsItens: {}, // ADICIONADO PARA O SISTEMA DE USO DE ITENS
    ultimaAtualizacao: "", logMissoes: [], notacoesDM: "" 
};

// --- CONFIGURAÇÃO DO MONGODB ---
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'arcadia_rpg_db'; 
const MONGODB_FICHAS_COLLECTION = process.env.MONGODB_FICHAS_COLLECTION || 'fichas_arcadia'; 

if (!MONGODB_URI) { console.error("--- ERRO FATAL: MONGODB_URI não definida! ---"); process.exit(1); }
if (!OWNER_ID) { console.warn("--- ALERTA: OWNER_ID não definida! ---"); }
if (JOGADORES_PERMITIDOS_IDS_STRING) { console.log("Jogadores permitidos carregados:", Array.from(listaJogadoresPermitidos)); } 
else { console.log("Nenhum jogador adicional permitido configurado (JOGADORES_PERMITIDOS_IDS está vazio ou não definido)."); }


let dbClient;
let fichasCollection;
let todasAsFichas = {};

// --- FUNÇÕES DE BANCO DE DADOS E AUXILIARES ---
async function conectarMongoDB() {
    try {
        console.log("Tentando conectar ao MongoDB Atlas...");
        dbClient = new MongoClient(MONGODB_URI);
        await dbClient.connect();
        const db = dbClient.db(MONGODB_DB_NAME);
        fichasCollection = db.collection(MONGODB_FICHAS_COLLECTION);
        console.log("Conectado com sucesso ao MongoDB Atlas e à coleção:", MONGODB_FICHAS_COLLECTION);
    } catch (error) {
        console.error("ERRO CRÍTICO ao conectar ao MongoDB:", error);
        process.exit(1);
    }
}

async function carregarFichasDoDB() {
    if (!fichasCollection) {
        console.error("Coleção de fichas não inicializada. Carregamento abortado.");
        return;
    }
    console.log("Carregando fichas do MongoDB para a memória...");
    try {
        const fichasDoDB = await fichasCollection.find({}).toArray();
        todasAsFichas = {};
        fichasDoDB.forEach(fichaDB => {
            const idJogador = String(fichaDB._id).trim();
            // Garante que campos essenciais existam ao carregar
            const fichaCompleta = { ...JSON.parse(JSON.stringify(fichaModeloArcadia)), ...fichaDB };
            if (!fichaCompleta.atributos) fichaCompleta.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
            if (!fichaCompleta.inventario) fichaCompleta.inventario = [];
            if (!fichaCompleta.cooldownsItens) fichaCompleta.cooldownsItens = {};

            todasAsFichas[idJogador] = fichaCompleta;
        });
        console.log(`${Object.keys(todasAsFichas).length} fichas carregadas do DB para a memória.`);
    } catch (error) {
        console.error("Erro ao carregar fichas do MongoDB:", error);
    }
}

async function salvarFichaNoDB(idJogador, fichaData) {
    if (!fichasCollection) {
        console.error("Coleção de fichas não inicializada. Salvamento abortado para jogador:", idJogador);
        return;
    }
    const idJogadorStr = String(idJogador).trim();
    console.log(`Salvando/Atualizando ficha para jogador ${idJogadorStr} no MongoDB...`);
    try {
        const fichaParaSalvar = { ...fichaData };
        // Garante que _id seja string, não ObjectId se veio do cache e foi modificado
        delete fichaParaSalvar._id; 

        await fichasCollection.updateOne(
            { _id: idJogadorStr }, // Query pelo _id como string
            { $set: fichaParaSalvar },
            { upsert: true }
        );
        console.log(`Ficha para ${idJogadorStr} salva com sucesso no MongoDB.`);
    } catch (error) {
        console.error(`Erro ao salvar ficha para ${idJogadorStr} no MongoDB:`, error);
    }
}

async function getFichaOuCarregar(idAlvo) {
    const idAlvoTrimmado = String(idAlvo).trim();
    let ficha = todasAsFichas[idAlvoTrimmado];
    if (!ficha && fichasCollection) {
        console.log(`Ficha para ${idAlvoTrimmado} não encontrada no cache, buscando no DB...`);
        try {
            const fichaDB = await fichasCollection.findOne({ _id: idAlvoTrimmado });
            if (fichaDB) {
                // Merge com modelo para garantir todos os campos, especialmente os novos como cooldownsItens
                ficha = { ...JSON.parse(JSON.stringify(fichaModeloArcadia)), ...fichaDB };
                if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
                if (!ficha.inventario) ficha.inventario = [];
                if (!ficha.cooldownsItens) ficha.cooldownsItens = {};

                ficha.pvMax = (ficha.atributos.vitalidade * 5) + (ficha.nivel * 5) + 20;
                ficha.pmMax = (ficha.atributos.manaBase * 5) + (ficha.nivel * 3) + 10; 
                
                todasAsFichas[idAlvoTrimmado] = ficha; // Armazena a ficha completa/corrigida no cache
                console.log(`Ficha para ${idAlvoTrimmado} carregada do DB para o cache.`);
            }
        } catch (dbError) {
            console.error(`Erro ao buscar ficha ${idAlvoTrimmado} no DB:`, dbError);
            // Retorna null ou uma ficha vazia/modelo para evitar travar, dependendo da estratégia
            return null; 
        }
    } 
    
    // Se a ficha veio do cache ou acabou de ser carregada e populada
    if (ficha) { 
        if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
        if (!ficha.inventario) ficha.inventario = []; // Garante que existe
        if (!ficha.cooldownsItens) ficha.cooldownsItens = {}; // Garante que existe

        // Recalcula PV/PM Max para garantir consistência
        ficha.pvMax = (ficha.atributos.vitalidade * 5) + (ficha.nivel * 5) + 20;
        ficha.pmMax = (ficha.atributos.manaBase * 5) + (ficha.nivel * 3) + 10;
    }
    return ficha;
}

async function atualizarFichaETransmitir(chatId, idAlvo, ficha, mensagemSucesso, nomePersonagemAlvo = null) {
    const idAlvoTrimmado = String(idAlvo).trim();
    ficha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    ficha.pvMax = (ficha.atributos.vitalidade * 5) + (ficha.nivel * 5) + 20;
    ficha.pmMax = (ficha.atributos.manaBase * 5) + (ficha.nivel * 3) + 10;

    // Garante que PV/PM atuais não excedam os máximos e não sejam negativos
    if (ficha.pvAtual > ficha.pvMax) ficha.pvAtual = ficha.pvMax;
    if (ficha.pmAtual > ficha.pmMax) ficha.pmAtual = ficha.pmMax;
    if (ficha.pvAtual < 0) ficha.pvAtual = 0;
    if (ficha.pmAtual < 0) ficha.pmAtual = 0;

    todasAsFichas[idAlvoTrimmado] = ficha;
    await salvarFichaNoDB(idAlvoTrimmado, ficha);
    
    let msgFinal = mensagemSucesso;
    const nomeDisplay = nomePersonagemAlvo || ficha.nomePersonagem || idAlvoTrimmado;
    if (msgFinal.includes("[NOME_PERSONAGEM_ALVO]")) {
        msgFinal = msgFinal.replace(/\[NOME_PERSONAGEM_ALVO\]/g, nomeDisplay);
    }
    msgFinal = msgFinal.replace(/\{\{ficha\.([\w.]+)\}\}/g, (match, p1) => {
        const keys = p1.split('.');
        let value = ficha;
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return match; 
            }
        }
        return value !== undefined ? String(value) : match; // Garante que seja string
    });
    await enviarMensagemTextoWhapi(chatId, msgFinal);
}

function calcularXpProximoNivel(nivelAtual) {
    return nivelAtual * 100 + 50;
}

// --- CONFIGURAÇÃO DO SERVIDOR EXPRESS ---
const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const WHAPI_API_TOKEN = process.env.WHAPI_API_TOKEN;
const WHAPI_BASE_URL = "https://gate.whapi.cloud";

if (!WHAPI_API_TOKEN) {
    console.error("FATAL_ERROR: Variável de ambiente WHAPI_API_TOKEN não definida!");
    // Considerar process.exit(1) se for crítico para a operação do bot
}

// --- FUNÇÕES DE COMANDO DO RPG - ARCÁDIA ---

async function handleCriarFichaArcadia(chatId, sender, senderName, args) {
    const idJogador = sender;
    if (todasAsFichas[idJogador]) {
        await enviarMensagemTextoWhapi(chatId, `Você já possui um personagem em Arcádia: ${todasAsFichas[idJogador].nomePersonagem}. Por enquanto, apenas um personagem por jogador.`);
        return;
    }
    const dadosComando = args.join(' ');
    const partes = dadosComando.split(';').map(p => p.trim());
    if (partes.length < 4) {
        await enviarMensagemTextoWhapi(chatId, "Formato incorreto! Uso: `!criar <Nome Personagem>;<Raça>;<Classe>;<Reino Origem>`\nUse `!listaracas`, `!listaclasses`, `!listareinos` para ver as opções.");
        return;
    }
    const nomePersonagemInput = partes[0];
    const racaInput = partes[1];
    const classeInput = partes[2];
    const origemReinoInput = partes[3];

    const racaValida = RACAS_ARCADIA.find(r => r.nome.toLowerCase() === racaInput.toLowerCase());
    const classeValida = CLASSES_ARCADIA.find(c => c.nome.toLowerCase() === classeInput.toLowerCase());
    const reinoValido = REINOS_ARCADIA.find(reino => reino.nome.toLowerCase() === origemReinoInput.toLowerCase());

    if (!racaValida) { await enviarMensagemTextoWhapi(chatId, `Raça "${racaInput}" inválida. Use \`!listaracas\`.`); return; }
    if (!classeValida) { await enviarMensagemTextoWhapi(chatId, `Classe "${classeInput}" inválida. Use \`!listaclasses\`.`); return; }
    if (!reinoValido) { await enviarMensagemTextoWhapi(chatId, `Reino de Origem "${origemReinoInput}" inválido. Use \`!listareinos\`.`); return; }

    let novaFicha = JSON.parse(JSON.stringify(fichaModeloArcadia)); // Cria uma cópia profunda do modelo
    novaFicha._id = idJogador; // Define o _id para o novo jogador
    novaFicha.nomeJogadorSalvo = senderName;
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.raca = racaValida.nome;
    novaFicha.classe = classeValida.nome; 
    novaFicha.origemReino = reinoValido.nome; 
    
    // PV/PM e XP são calculados e setados por atualizarFichaETransmitir ou aqui mesmo
    novaFicha.pvMax = (novaFicha.atributos.vitalidade * 5) + (novaFicha.nivel * 5) + 20;
    novaFicha.pvAtual = novaFicha.pvMax;
    novaFicha.pmMax = (novaFicha.atributos.manaBase * 5) + (novaFicha.nivel * 3) + 10;
    novaFicha.pmAtual = novaFicha.pmMax;
    novaFicha.xpProximoNivel = calcularXpProximoNivel(novaFicha.nivel);

    // Salva no cache local antes de chamar atualizarFichaETransmitir
    todasAsFichas[idJogador] = novaFicha;

    await atualizarFichaETransmitir(chatId, idJogador, novaFicha, `🎉 Personagem ${nomePersonagemInput} (${novaFicha.raca} ${novaFicha.classe} de ${novaFicha.origemReino}) criado para Arcádia!\nUse \`!distribuirpontos <atr1> <qtd1> ...\` para usar seus ${novaFicha.atributos.pontosParaDistribuir} pontos iniciais.\nUse \`!ficha\` para ver os detalhes.`);
}

async function handleAdminCriarFichaArcadia(chatId, senderOwner, argsAdmin) {
    const comandoCompleto = argsAdmin.join(" ");
    const partesPrincipais = comandoCompleto.split(';');
    if (partesPrincipais.length < 5) { 
        await enviarMensagemTextoWhapi(chatId, "Formato incorreto! Uso: `!admincriar <ID_ALVO>;<Nome Personagem>;<Raça>;<Classe>;<ReinoOrigem>`");
        return;
    }
    const idJogadorAlvo = partesPrincipais[0].trim();
    const nomePersonagemInput = partesPrincipais[1].trim();
    const racaInput = partesPrincipais[2].trim();
    const classeInput = partesPrincipais[3].trim();
    const origemReinoInput = partesPrincipais[4].trim();

    if (!/^\d+$/.test(idJogadorAlvo)) { await enviarMensagemTextoWhapi(chatId, `ID do Jogador Alvo (${idJogadorAlvo}) inválido.`); return; }
    
    const racaValida = RACAS_ARCADIA.find(r => r.nome.toLowerCase() === racaInput.toLowerCase());
    const classeValida = CLASSES_ARCADIA.find(c => c.nome.toLowerCase() === classeInput.toLowerCase());
    const reinoValido = REINOS_ARCADIA.find(reino => reino.nome.toLowerCase() === origemReinoInput.toLowerCase());

    if (!racaValida) { await enviarMensagemTextoWhapi(chatId, `Raça "${racaInput}" inválida para ${idJogadorAlvo}.`); return; }
    if (!classeValida) { await enviarMensagemTextoWhapi(chatId, `Classe "${classeInput}" inválida para ${idJogadorAlvo}.`); return; }
    if (!reinoValido) { await enviarMensagemTextoWhapi(chatId, `Reino "${origemReinoInput}" inválido para ${idJogadorAlvo}.`); return; }
    
    let novaFicha = JSON.parse(JSON.stringify(fichaModeloArcadia));
    novaFicha._id = idJogadorAlvo;
    novaFicha.nomeJogadorSalvo = `(Criado por Admin para ID: ${idJogadorAlvo})`; 
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.raca = racaValida.nome; 
    novaFicha.classe = classeValida.nome; 
    novaFicha.origemReino = reinoValido.nome; 

    novaFicha.pvMax = (novaFicha.atributos.vitalidade * 5) + (novaFicha.nivel * 5) + 20;
    novaFicha.pvAtual = novaFicha.pvMax;
    novaFicha.pmMax = (novaFicha.atributos.manaBase * 5) + (novaFicha.nivel * 3) + 10;
    novaFicha.pmAtual = novaFicha.pmMax;
    novaFicha.xpProximoNivel = calcularXpProximoNivel(novaFicha.nivel);
    
    todasAsFichas[idJogadorAlvo] = novaFicha;
    await atualizarFichaETransmitir(chatId, idJogadorAlvo, novaFicha, `🎉 [Admin] Personagem ${nomePersonagemInput} (${novaFicha.raca} ${novaFicha.classe}) CRIADO/ATUALIZADO para o ID ${idJogadorAlvo}.`);
}

async function handleVerFichaArcadia(chatId, sender, args) {
    let idAlvoConsulta = sender;
    let adminConsultandoOutro = false;
    
    if (args.length > 0 && sender === OWNER_ID) { 
        const idPotencial = String(args[0]).trim();
        if (/^\d+$/.test(idPotencial)) { 
            idAlvoConsulta = idPotencial;
            adminConsultandoOutro = true;
            console.log(`[Admin] ${sender} está consultando a ficha do ID_ALVO: ${idAlvoConsulta}`);
        } else {
            await enviarMensagemTextoWhapi(chatId, "ID do jogador alvo inválido para `!ficha`. Forneça apenas números."); return;
        }
    }
    
    const ficha = await getFichaOuCarregar(idAlvoConsulta);
    if (!ficha) {
        const msgErro = adminConsultandoOutro 
            ? `❌ Ficha não encontrada para o ID ${idAlvoConsulta} em Arcádia.\nUse \`!admincriar\` para criar uma.`
            : "❌ Você ainda não tem um personagem em Arcádia. Use o comando `!criar` para criar um.";
        await enviarMensagemTextoWhapi(chatId, msgErro);
        return;
    }

    let resposta = `🌟 --- Ficha de Arcádia: ${ficha.nomePersonagem || 'Personagem Sem Nome'} (@${idAlvoConsulta}) --- 🌟\n`;
    if (ficha.nomeJogadorSalvo) resposta += `🧙 Jogador: ${ficha.nomeJogadorSalvo}\n`;
    resposta += `Raça: ${ficha.raca || 'N/A'} | Classe: ${ficha.classe || 'N/A'}\n`;
    resposta += `Origem: ${ficha.origemReino || 'N/A'}\n`;
    resposta += `Lvl: ${ficha.nivel || 1} (XP: ${ficha.xpAtual || 0}/${ficha.xpProximoNivel || calcularXpProximoNivel(ficha.nivel || 1)})\n`;
    resposta += `HP: ${ficha.pvAtual || 0}/${ficha.pvMax || 0}\n`;
    resposta += `MP: ${ficha.pmAtual || 0}/${ficha.pmMax || 0}\n`;
    resposta += `Florins: ${ficha.florinsDeOuro || 0} FO | Essência: ${ficha.essenciaDeArcadia || 0} EA\n`;

    resposta += "\n🧠 Atributos:\n";
    if (ficha.atributos) {
        for (const [attr, valor] of Object.entries(ficha.atributos)) {
            const nomeAttrCapitalized = attr.charAt(0).toUpperCase() + attr.slice(1);
            if (attr !== "pontosParaDistribuir") {
                resposta += `  ☆ ${nomeAttrCapitalized}: ${valor || 0}\n`;
            }
        }
        if ((ficha.atributos.pontosParaDistribuir || 0) > 0) {
            const msgPontos = adminConsultandoOutro ? "O jogador tem" : "Você tem";
            const cmdDistribuir = adminConsultandoOutro ? "" : " (`!distribuirpontos`)";
            resposta += `  ✨ ${msgPontos} ${ficha.atributos.pontosParaDistribuir} pontos para distribuir${cmdDistribuir}.\n`;
        }
    } else { resposta += "  (Atributos não definidos)\n"; }
    
    resposta += "\n📜 Habilidades Especiais / Perícias:\n";
    let habilidadesTexto = "";
    if (ficha.habilidadesEspeciais && ficha.habilidadesEspeciais.length > 0) {
        ficha.habilidadesEspeciais.forEach(h => habilidadesTexto += `  ☆ ${h.nome} (${h.tipo || 'Habilidade'}): ${h.descricao || ''}\n`);
    }
    if (ficha.pericias && ficha.pericias.length > 0) {
        ficha.pericias.forEach(p => habilidadesTexto += `  ☆ Perícia em ${p.nome}: ${p.valor}\n`);
    }
    resposta += habilidadesTexto || "  (Nenhuma listada)\n";

    resposta += "\n🔮 Magias Conhecidas:\n";
    if (ficha.magiasConhecidas && ficha.magiasConhecidas.length > 0) {
        ficha.magiasConhecidas.forEach(m => resposta += `  ☆ ${m.nome} (Custo: ${m.custoMana || 'N/A'} PM): ${m.descricao || ''}\n`);
    } else { resposta += "  (Nenhuma magia conhecida)\n"; }

    resposta += "\n🎒 Inventário:\n";
    if (ficha.inventario && ficha.inventario.length > 0) {
        ficha.inventario.forEach(i => {
            resposta += `  ☆ ${i.itemNome} (Qtd: ${i.quantidade || 1}) ${i.tipo ? '['+i.tipo+']' : ''} ${i.descricao ? '- ' + i.descricao : ''}\n`;
        });
    } else { resposta += "  (Vazio)\n"; }
    
    resposta += "\n⚙️ Equipamento:\n";
    let temEquip = false;
    if (ficha.equipamento) {
        for(const slot in ficha.equipamento) {
            if (ficha.equipamento[slot]) {
                const nomeSlot = slot.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                const nomeItemEquipado = typeof ficha.equipamento[slot] === 'object' ? (ficha.equipamento[slot].itemNome || 'Item Desconhecido') : ficha.equipamento[slot];
                resposta += `  ☆ ${nomeSlot}: ${nomeItemEquipado}\n`;
                temEquip = true;
            }
        }
    }
    if (!temEquip) { resposta += "  (Nenhum item equipado)\n"; }
    
    resposta += `\n🕒 Última atualização: ${ficha.ultimaAtualizacao || 'N/A'}\n`;
    await enviarMensagemTextoWhapi(chatId, resposta);
}

async function handleAddXPArcadia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada."); return; }
    if (args.length === 0 || isNaN(parseInt(args[0]))) { await enviarMensagemTextoWhapi(chatId, "Uso: `!addxp <valor>`"); return; }
    const valorXP = parseInt(args[0]);
    ficha.xpAtual = (ficha.xpAtual || 0) + valorXP;
    let mensagensLevelUp = [];
    let subiuDeNivel = false;
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    
    while (ficha.xpAtual >= ficha.xpProximoNivel) {
        subiuDeNivel = true;
        ficha.xpAtual -= ficha.xpProximoNivel;
        const nivelAntigo = ficha.nivel || 0;
        ficha.nivel = nivelAntigo + 1;
        
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + 2;
        const pvGanho = Math.floor((ficha.atributos.vitalidade || 5) / 2) + 5;
        const pmGanho = Math.floor((ficha.atributos.manaBase || 5) / 2) + 3;
        
        // Usa valores atuais de pvMax/pmMax para calcular o incremento
        const pvMaxAntesDoLevelUp = ficha.pvMax || ((ficha.atributos.vitalidade * 5) + (nivelAntigo * 5) + 20);
        const pmMaxAntesDoLevelUp = ficha.pmMax || ((ficha.atributos.manaBase * 5) + (nivelAntigo * 3) + 10);

        ficha.pvMax = pvMaxAntesDoLevelUp + pvGanho;
        ficha.pmMax = pmMaxAntesDoLevelUp + pmGanho;
        
        ficha.pvAtual = ficha.pvMax; 
        ficha.pmAtual = ficha.pmMax;

        mensagensLevelUp.push(`🎉 PARABÉNS! Você alcançou o Nível ${ficha.nivel}! Ganhou ${pvGanho} PV, ${pmGanho} PM e 2 pontos de atributo!`);
        ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    }
    let mensagemFinal = `XP de ${ficha.nomePersonagem || sender} atualizado para ${ficha.xpAtual}/${ficha.xpProximoNivel}.`;
    if (subiuDeNivel) { mensagemFinal = mensagensLevelUp.join("\n") + "\n" + mensagemFinal; }
    await atualizarFichaETransmitir(chatId, sender, ficha, mensagemFinal);
}

async function handleSetNivelArcadia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada."); return; }
    if (args.length === 0 || isNaN(parseInt(args[0])) || parseInt(args[0]) < 1) { await enviarMensagemTextoWhapi(chatId, "Uso: `!setnivel <nível>`"); return; }
    const novoNivel = parseInt(args[0]); 
    const nivelAntigo = ficha.nivel || 1;
    ficha.nivel = novoNivel; 
    ficha.xpAtual = 0;
    ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    const diffNivel = novoNivel - nivelAntigo;
    if (diffNivel > 0) { 
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + (diffNivel * 2);
    } else if (diffNivel < 0) { // Se o nível diminuiu, remove pontos proporcionalmente (ou zera, ou define um mínimo)
        ficha.atributos.pontosParaDistribuir = Math.max(0, (ficha.atributos.pontosParaDistribuir || 0) + (diffNivel * 2)); 
    }
    // PV/PM Max e Atuais são recalculados por atualizarFichaETransmitir
    await atualizarFichaETransmitir(chatId, sender, ficha, `Nível de ${ficha.nomePersonagem || sender} atualizado para ${ficha.nivel}. XP zerado. Pontos p/ distribuir: ${ficha.atributos.pontosParaDistribuir || 0}.`);
}

async function handleAddFlorins(chatId, sender, args) { 
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada."); return; }
    if (args.length === 0 || isNaN(parseInt(args[0]))) { await enviarMensagemTextoWhapi(chatId, "Uso: `!addflorins <valor>`"); return; }
    const valorFlorins = parseInt(args[0]);
    ficha.florinsDeOuro = (ficha.florinsDeOuro || 0) + valorFlorins;
    if (ficha.florinsDeOuro < 0) ficha.florinsDeOuro = 0;
    await atualizarFichaETransmitir(chatId, sender, ficha, `Florins de Ouro atualizados! ${ficha.nomePersonagem || sender} agora tem ${ficha.florinsDeOuro} FO.`);
}

async function handleAddEssencia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada."); return; }
    if (args.length === 0 || isNaN(parseInt(args[0]))) { await enviarMensagemTextoWhapi(chatId, "Uso: `!addessencia <valor>`"); return; }
    const valorEssencia = parseInt(args[0]);
    ficha.essenciaDeArcadia = (ficha.essenciaDeArcadia || 0) + valorEssencia;
    if (ficha.essenciaDeArcadia < 0) ficha.essenciaDeArcadia = 0;
    await atualizarFichaETransmitir(chatId, sender, ficha, `Essência de Arcádia atualizada! ${ficha.nomePersonagem || sender} agora tem ${ficha.essenciaDeArcadia} EA.`);
}

async function handleAddItemArcadia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada."); return; }
    const inputCompleto = args.join(" "); 
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) { await enviarMensagemTextoWhapi(chatId, "Uso: `!additem <nome do item>[;quantidade;tipo;descricao]`"); return; }
    const nomeItem = partesItem[0]; 
    const quantidade = partesItem[1] ? parseInt(partesItem[1]) : 1;
    const tipoItem = partesItem[2] || "Item"; 
    const descricaoItem = partesItem[3] || "Um item misterioso...";
    // Adiciona usavel e efeito como padrão (ou nulo) para itens adicionados manualmente, se necessário
    const usavel = partesItem[4] ? (partesItem[4].toLowerCase() === 'true') : false;
    // Efeito seria um JSON stringificado? ex: '{ "tipoEfeito": "CURA_HP", "valor": 10 }'
    // Por simplicidade, não vamos adicionar efeito complexo via additem aqui, a menos que seja muito necessário
    // O foco do 'efeito' está nos itens do jackpot/definidos no código.

    if (isNaN(quantidade) || quantidade < 1) { await enviarMensagemTextoWhapi(chatId, "Quantidade inválida."); return; }
    if (!ficha.inventario) ficha.inventario = []; 
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase() && i.tipo === tipoItem);
    
    let itemParaAdicionarOuAtualizar = { 
        itemNome: nomeItem, 
        quantidade: quantidade, 
        tipo: tipoItem, 
        descricao: descricaoItem,
        // Para itens adicionados via !additem, 'usavel' e 'efeito' não são definidos aqui
        // a menos que você adicione mais parâmetros ao comando.
        // Itens usáveis com efeitos complexos são melhor definidos no código (como os do jackpot).
    };

    if (itemExistenteIndex > -1) {
        ficha.inventario[itemExistenteIndex].quantidade = (ficha.inventario[itemExistenteIndex].quantidade || 0) + quantidade;
        if (descricaoItem !== "Um item misterioso...") ficha.inventario[itemExistenteIndex].descricao = descricaoItem; // Atualiza descrição se fornecida
        await atualizarFichaETransmitir(chatId, sender, ficha, `Quantidade de "${nomeItem}" aumentada para ${ficha.inventario[itemExistenteIndex].quantidade} para ${ficha.nomePersonagem || sender}.`);
    } else {
        ficha.inventario.push(itemParaAdicionarOuAtualizar);
        await atualizarFichaETransmitir(chatId, sender, ficha, `"${nomeItem}" (x${quantidade}) adicionado ao inventário de ${ficha.nomePersonagem || sender}.`);
    }
}

async function handleDelItemArcadia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha || !ficha.inventario) { await enviarMensagemTextoWhapi(chatId, "Sua ficha ou inventário não foi encontrado."); return; }
    const inputCompleto = args.join(" "); 
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) { await enviarMensagemTextoWhapi(chatId, "Uso: `!delitem <nome do item>[;quantidade]`"); return; }
    const nomeItem = partesItem[0]; 
    const quantidadeRemover = partesItem[1] ? parseInt(partesItem[1]) : 1;
    if (isNaN(quantidadeRemover) || quantidadeRemover < 1) { await enviarMensagemTextoWhapi(chatId, "Quantidade a remover inválida."); return; }
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemExistenteIndex === -1) { await enviarMensagemTextoWhapi(chatId, `Item "${nomeItem}" não encontrado no seu inventário.`); return; }
    
    const nomeItemOriginal = ficha.inventario[itemExistenteIndex].itemNome;
    if (ficha.inventario[itemExistenteIndex].quantidade < quantidadeRemover) {
        await enviarMensagemTextoWhapi(chatId, `Você não tem ${quantidadeRemover} de "${nomeItemOriginal}". Você possui ${ficha.inventario[itemExistenteIndex].quantidade}.`); return;
    }
    ficha.inventario[itemExistenteIndex].quantidade -= quantidadeRemover;
    if (ficha.inventario[itemExistenteIndex].quantidade <= 0) {
        ficha.inventario.splice(itemExistenteIndex, 1);
        await atualizarFichaETransmitir(chatId, sender, ficha, `"${nomeItemOriginal}" removido completamente do inventário de ${ficha.nomePersonagem || sender}.`);
    } else {
        await atualizarFichaETransmitir(chatId, sender, ficha, `${quantidadeRemover}x "${nomeItemOriginal}" removido(s). Restam ${ficha.inventario[itemExistenteIndex].quantidade} para ${ficha.nomePersonagem || sender}.`);
    }
}

// --- FUNÇÕES DE ADMIN ---
async function handleAdminComandoFichaArcadia(chatId, args, tipoComando, callbackModificacao, mensagemSucessoPadrao, mensagemErroUso) {
    if (args.length < 2 && tipoComando !== 'adminsetattr' && tipoComando !== 'adminaddpontosattr') { // Exceções para comandos com mais args
        if (args.length < 1 && (tipoComando === 'adminsetattr' || tipoComando === 'adminaddpontosattr')) {
             await enviarMensagemTextoWhapi(chatId, mensagemErroUso); return;
        } else if (args.length < 2 && !(tipoComando === 'adminsetattr' || tipoComando === 'adminaddpontosattr')) {
             await enviarMensagemTextoWhapi(chatId, mensagemErroUso); return;
        }
    }
    if (tipoComando === 'adminsetattr' && args.length < 3) { await enviarMensagemTextoWhapi(chatId, mensagemErroUso); return; }
    if (tipoComando === 'adminaddpontosattr' && args.length < 2) { await enviarMensagemTextoWhapi(chatId, mensagemErroUso); return; }


    const idAlvo = args[0].trim();
    if (!/^\d+$/.test(idAlvo)) { await enviarMensagemTextoWhapi(chatId, `ID Alvo (${idAlvo}) inválido.`); return; }
    
    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) { await enviarMensagemTextoWhapi(chatId, `Ficha não encontrada para ID ${idAlvo}.`); return; }
    
    let fichaModificada = JSON.parse(JSON.stringify(fichaAlvo));
    const resultadoCallback = callbackModificacao(fichaModificada, args.slice(1)); // Passa apenas os args relevantes

    if (typeof resultadoCallback === 'string' && resultadoCallback.startsWith("ERRO:")) {
        await enviarMensagemTextoWhapi(chatId, resultadoCallback.substring(5)); return;
    }
    if (resultadoCallback === false ) { await enviarMensagemTextoWhapi(chatId, mensagemErroUso); return; }
    
    const mensagemSucessoFinal = (typeof resultadoCallback === 'string') ? resultadoCallback : mensagemSucessoPadrao;
    await atualizarFichaETransmitir(chatId, idAlvo, fichaModificada, mensagemSucessoFinal, fichaModificada.nomePersonagem || idAlvo);
}

function modificarXPArcadia(ficha, argsValor) {
    const valorXP = parseInt(argsValor[0]);
    if (isNaN(valorXP)) { return "ERRO: Valor de XP inválido."; }
    ficha.xpAtual = (ficha.xpAtual || 0) + valorXP;
    let mensagensLevelUp = []; 
    let subiuDeNivelAdmin = false;
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    
    while (ficha.xpAtual >= ficha.xpProximoNivel) {
        subiuDeNivelAdmin = true;
        ficha.xpAtual -= ficha.xpProximoNivel; 
        const nivelAntigoAdmin = ficha.nivel || 0;
        ficha.nivel = nivelAntigoAdmin + 1;
        
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + 2;
        const pvGanhoAdmin = Math.floor((ficha.atributos.vitalidade || 5) / 2) + 5;
        const pmGanhoAdmin = Math.floor((ficha.atributos.manaBase || 5) / 2) + 3;

        const pvMaxAnteriorAdmin = ficha.pvMax || ((ficha.atributos.vitalidade * 5) + (nivelAntigoAdmin * 5) + 20);
        const pmMaxAnteriorAdmin = ficha.pmMax || ((ficha.atributos.manaBase * 5) + (nivelAntigoAdmin * 3) + 10);
        ficha.pvMax = pvMaxAnteriorAdmin + pvGanhoAdmin;
        ficha.pmMax = pmMaxAnteriorAdmin + pmGanhoAdmin;
        
        ficha.pvAtual = ficha.pvMax; 
        ficha.pmAtual = ficha.pmMax;
        mensagensLevelUp.push(`🎉 [Admin] ${ficha.nomePersonagem || '[NOME_PERSONAGEM_ALVO]'} alcançou o Nível ${ficha.nivel}!`);
        ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    }
    let msgRetorno = `XP de [NOME_PERSONAGEM_ALVO] atualizado para ${ficha.xpAtual}/${ficha.xpProximoNivel}.`;
    if (subiuDeNivelAdmin) { msgRetorno = mensagensLevelUp.join("\n") + "\n" + msgRetorno; }
    return msgRetorno;
}

function modificarNivelArcadia(ficha, argsValor) {
    const novoNivel = parseInt(argsValor[0]);
    if (isNaN(novoNivel) || novoNivel < 1) return "ERRO: Nível inválido.";
    const nivelAntigo = ficha.nivel || 1; 
    ficha.nivel = novoNivel;
    ficha.xpAtual = 0;
    ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    const diffNivel = novoNivel - nivelAntigo;
    if (diffNivel > 0) { 
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + (diffNivel * 2);
    } else if (diffNivel < 0) {
        ficha.atributos.pontosParaDistribuir = Math.max(0, (ficha.atributos.pontosParaDistribuir || 0) + (diffNivel * 2));
    }
    return `Nível de [NOME_PERSONAGEM_ALVO] definido para ${ficha.nivel}. XP zerado. Pontos p/ distribuir: ${ficha.atributos.pontosParaDistribuir || 0}.`;
}

function modificarFlorins(ficha, argsValor) { 
    const valorFlorins = parseInt(argsValor[0]);
    if (isNaN(valorFlorins)) return "ERRO: Valor de Florins inválido.";
    ficha.florinsDeOuro = (ficha.florinsDeOuro || 0) + valorFlorins;
    if (ficha.florinsDeOuro < 0) ficha.florinsDeOuro = 0;
    return `Florins de Ouro de [NOME_PERSONAGEM_ALVO] atualizados para ${ficha.florinsDeOuro} FO.`;
}

function modificarEssencia(ficha, argsValor) {
    const valorEssencia = parseInt(argsValor[0]);
    if (isNaN(valorEssencia)) return "ERRO: Valor de Essência inválido.";
    ficha.essenciaDeArcadia = (ficha.essenciaDeArcadia || 0) + valorEssencia;
    if (ficha.essenciaDeArcadia < 0) ficha.essenciaDeArcadia = 0;
    return `Essência de Arcádia de [NOME_PERSONAGEM_ALVO] atualizada para ${ficha.essenciaDeArcadia} EA.`;
}

function modificarAddItemArcadia(ficha, argsItem) {
    const inputCompleto = argsItem.join(" "); 
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) return "ERRO: Nome do item obrigatório.";
    const nomeItem = partesItem[0];
    const quantidade = partesItem[1] ? parseInt(partesItem[1]) : 1;
    const tipoItem = partesItem[2] || "Item Genérico"; 
    const descricaoItem = partesItem[3] || "";
    if (isNaN(quantidade) || quantidade < 1) return "ERRO: Quantidade inválida.";
    if (!ficha.inventario) ficha.inventario = [];
    
    // Para itens adicionados via admin, tentamos buscar uma definição base se o nome coincidir com algo do jackpot
    // Isso é opcional e pode ser expandido para uma base de dados de itens mais completa.
    let itemBaseDef = [...JACKPOT_PREMIOS_COMUNS, ...JACKPOT_PREMIOS_INCOMUNS, ...JACKPOT_PREMIOS_RAROS].find(
        def => def.itemNome.toLowerCase() === nomeItem.toLowerCase()
    );

    let itemParaAdicionar = {
        itemNome: nomeItem,
        quantidade: quantidade,
        tipo: tipoItem || (itemBaseDef ? itemBaseDef.tipo : "Item"),
        descricao: descricaoItem || (itemBaseDef ? itemBaseDef.descricao : "Item adicionado por admin."),
        usavel: itemBaseDef ? itemBaseDef.usavel : false, // Assume não usável se não tiver def base
        efeito: itemBaseDef ? itemBaseDef.efeito : undefined
    };

    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase() && i.tipo === itemParaAdicionar.tipo);
    if (itemExistenteIndex > -1) {
        ficha.inventario[itemExistenteIndex].quantidade = (ficha.inventario[itemExistenteIndex].quantidade || 0) + quantidade;
        if (descricaoItem) ficha.inventario[itemExistenteIndex].descricao = descricaoItem; // Atualiza descrição se fornecida explicitamente
        return `Quantidade de "${nomeItem}" aumentada para ${ficha.inventario[itemExistenteIndex].quantidade} para [NOME_PERSONAGEM_ALVO].`;
    } else {
        ficha.inventario.push(itemParaAdicionar);
        return `"${nomeItem}" (x${quantidade}) adicionado ao inventário de [NOME_PERSONAGEM_ALVO].`;
    }
}

function modificarDelItemArcadia(ficha, argsItem) {
    const inputCompleto = argsItem.join(" ");
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) return "ERRO: Nome do item obrigatório.";
    const nomeItem = partesItem[0]; 
    const quantidadeRemover = partesItem[1] ? parseInt(partesItem[1]) : 1;
    if (isNaN(quantidadeRemover) || quantidadeRemover < 1) return "ERRO: Quantidade a remover inválida.";
    if (!ficha.inventario) { ficha.inventario = []; return `ERRO: Inventário de [NOME_PERSONAGEM_ALVO] está vazio.`;}
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemExistenteIndex === -1) return `ERRO: Item "${nomeItem}" não encontrado no inventário de [NOME_PERSONAGEM_ALVO].`;
    
    if (ficha.inventario[itemExistenteIndex].quantidade < quantidadeRemover) {
        return `ERRO: [NOME_PERSONAGEM_ALVO] não tem ${quantidadeRemover} de "${nomeItem}". Possui ${ficha.inventario[itemExistenteIndex].quantidade}.`;
    }
    const nomeItemOriginal = ficha.inventario[itemExistenteIndex].itemNome;
    ficha.inventario[itemExistenteIndex].quantidade -= quantidadeRemover;
    if (ficha.inventario[itemExistenteIndex].quantidade <= 0) {
        ficha.inventario.splice(itemExistenteIndex, 1);
        return `"${nomeItemOriginal}" removido completamente do inventário de [NOME_PERSONAGEM_ALVO].`;
    } else {
        return `${quantidadeRemover}x "${nomeItemOriginal}" removido(s) de [NOME_PERSONAGEM_ALVO]. Restam ${ficha.inventario[itemExistenteIndex].quantidade}.`;
    }
}

async function handleAdminSetAtributoArcadia(chatId, args) {
    if (args.length < 3) { 
        await enviarMensagemTextoWhapi(chatId, "Uso: `!adminsetattr <ID_ALVO> <atributo> <valor>`\nAtributos: forca, agilidade, vitalidade, manaBase, intelecto, carisma.");
        return;
    }
    const idAlvo = args[0].trim(); 
    const atributoNomeInput = args[1].trim(); 
    const valor = parseInt(args[2]);

    if (!/^\d+$/.test(idAlvo)) { await enviarMensagemTextoWhapi(chatId, `ID Alvo (${idAlvo}) inválido.`); return; }

    const atributosValidos = ["forca", "agilidade", "vitalidade", "manaBase", "intelecto", "carisma"];
    const atributoCanonical = atributosValidos.find(valido => valido.toLowerCase() === atributoNomeInput.toLowerCase());

    if (!atributoCanonical) { 
        await enviarMensagemTextoWhapi(chatId, `Atributo "${atributoNomeInput}" inválido. Válidos: ${atributosValidos.join(", ")}.`);
        return;
    }
    if (isNaN(valor) || valor < 0) { 
        await enviarMensagemTextoWhapi(chatId, `Valor para ${atributoCanonical} deve ser um número positivo ou zero.`); return;
    }

    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) { await enviarMensagemTextoWhapi(chatId, `Ficha não encontrada para ID ${idAlvo}.`); return; }
    if (!fichaAlvo.atributos) fichaAlvo.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)); 
    fichaAlvo.atributos[atributoCanonical] = valor; 
    await atualizarFichaETransmitir(chatId, idAlvo, fichaAlvo, `[Admin] Atributo ${atributoCanonical} de [NOME_PERSONAGEM_ALVO] definido para ${valor}. PV/PM recalculados.`, fichaAlvo.nomePersonagem || idAlvo);
}

async function handleAdminAddPontosAtributoArcadia(chatId, args) {
    if (args.length < 2) { 
        await enviarMensagemTextoWhapi(chatId, "Uso: `!adminaddpontosattr <ID_ALVO> <quantidade>`"); return;
    }
    const idAlvo = args[0].trim(); 
    const quantidade = parseInt(args[1]);
    if (!/^\d+$/.test(idAlvo)) { await enviarMensagemTextoWhapi(chatId, `ID Alvo (${idAlvo}) inválido.`); return; }
    if (isNaN(quantidade)) { await enviarMensagemTextoWhapi(chatId, "Quantidade de pontos deve ser um número."); return; }

    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) { await enviarMensagemTextoWhapi(chatId, `Ficha não encontrada para ID ${idAlvo}.`); return; }
    if (!fichaAlvo.atributos) fichaAlvo.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)); 
    fichaAlvo.atributos.pontosParaDistribuir = (fichaAlvo.atributos.pontosParaDistribuir || 0) + quantidade;
    if (fichaAlvo.atributos.pontosParaDistribuir < 0) fichaAlvo.atributos.pontosParaDistribuir = 0;
    await atualizarFichaETransmitir(chatId, idAlvo, fichaAlvo, `[Admin] Pontos para distribuir de [NOME_PERSONAGEM_ALVO] ajustados para ${fichaAlvo.atributos.pontosParaDistribuir}.`, fichaAlvo.nomePersonagem || idAlvo);
}

async function handleBoasVindasArcadia(chatId, senderName) {
    let mensagem = `🌟 Saudações, ${senderName}!\nBem-vindo(a) a Arcádia! 🌟\n\n`;
    mensagem += "Um mundo medieval vibrante com magia, mas também repleto de perigos. Criaturas ancestrais despertam, impuros espreitam nas sombras e antigos conflitos ameaçam reacender as chamas da guerra entre os reinos.\n\n";
    mensagem += "Prepare-se para explorar terras vastas, escolher sua classe, aprimore seus atributos e habilidades, e forje seu destino neste mundo instável.\n\n";
    mensagem += "Use `!comandos` para ver a lista de ações disponíveis.\n";
    mensagem += "Use `!criar <Nome>;<Raça>;<Classe>;<ReinoOrigem>` para iniciar sua jornada!";
    await enviarMensagemTextoWhapi(chatId, mensagem);
}

// --- FUNÇÃO handleDistribuirPontos ATUALIZADA ---
async function handleDistribuirPontos(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) {
        await enviarMensagemTextoWhapi(chatId, "Sua ficha de Arcádia não foi encontrada. Crie uma com `!criar`.");
        return;
    }
    if (!ficha.atributos || ficha.atributos.pontosParaDistribuir === undefined || ficha.atributos.pontosParaDistribuir <= 0) {
        await enviarMensagemTextoWhapi(chatId, "Você não tem pontos de atributo para distribuir no momento.");
        return;
    }

    if (args.length === 0 || args.length % 2 !== 0) {
        await enviarMensagemTextoWhapi(chatId, "Uso incorreto. Formato: `!distribuirpontos <atr1> <qtd1> [<atr2> <qtd2> ...]`\nExemplo: `!distribuirpontos forca 5 agilidade 3`\nAtributos válidos: forca, agilidade, vitalidade, manaBase, intelecto, carisma.");
        return;
    }

    const atributosValidos = ["forca", "agilidade", "vitalidade", "manaBase", "intelecto", "carisma"];
    let mudancasPlanejadas = [];
    let totalPontosSolicitados = 0;
    let mensagensErroParse = [];

    for (let i = 0; i < args.length; i += 2) {
        const atributoNomeInput = args[i].trim();
        const pontosStr = args[i + 1];
        const atributoCanonical = atributosValidos.find(valido => valido.toLowerCase() === atributoNomeInput.toLowerCase());
        
        if (!atributoCanonical) {
            mensagensErroParse.push(`Atributo "${atributoNomeInput}" é inválido.`);
            continue; 
        }
        const pontosParaEsteAtributo = parseInt(pontosStr);
        if (isNaN(pontosParaEsteAtributo) || pontosParaEsteAtributo <= 0) {
            mensagensErroParse.push(`A quantidade "${pontosStr}" para o atributo ${atributoCanonical} deve ser um número positivo.`);
            continue; 
        }
        mudancasPlanejadas.push({ atributo: atributoCanonical, valor: pontosParaEsteAtributo });
        totalPontosSolicitados += pontosParaEsteAtributo;
    }

    if (mensagensErroParse.length > 0) {
        await enviarMensagemTextoWhapi(chatId, "Foram encontrados os seguintes erros na sua solicitação:\n- " + mensagensErroParse.join("\n- ") + "\n\nNenhum ponto foi distribuído. Tente novamente.\nAtributos válidos: " + atributosValidos.join(", "));
        return;
    }
    if (mudancasPlanejadas.length === 0) {
        await enviarMensagemTextoWhapi(chatId, "Nenhuma distribuição válida foi especificada. Verifique os atributos e valores.");
        return;
    }
    if (totalPontosSolicitados > ficha.atributos.pontosParaDistribuir) {
        await enviarMensagemTextoWhapi(chatId, `Você tentou distribuir ${totalPontosSolicitados} pontos no total, mas possui apenas ${ficha.atributos.pontosParaDistribuir} disponíveis.`);
        return;
    }

    let feedbackMudancasTexto = [];
    for (const mudanca of mudancasPlanejadas) {
        const valorAntigo = ficha.atributos[mudanca.atributo] || 0;
        ficha.atributos[mudanca.atributo] = valorAntigo + mudanca.valor;
        feedbackMudancasTexto.push(`${mudanca.atributo}: ${valorAntigo} + ${mudanca.valor} → ${ficha.atributos[mudanca.atributo]}`);
    }
    ficha.atributos.pontosParaDistribuir -= totalPontosSolicitados;

    await atualizarFichaETransmitir(chatId, sender, ficha, 
        `✅ Pontos distribuídos com sucesso!\n\n*Resumo das Alterações (${ficha.nomePersonagem || sender}):*\n${feedbackMudancasTexto.join("\n")}\n\n✨ Você ainda tem ${ficha.atributos.pontosParaDistribuir} pontos para distribuir.`
    );
}

// --- FUNÇÃO handleJackpotArcadia ATUALIZADA ---
async function handleJackpotArcadia(chatId, sender) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) {
        await enviarMensagemTextoWhapi(chatId, "Você precisa de uma ficha em Arcádia para tentar a sorte no Jackpot!");
        return;
    }

    const custoJackpot = 25; 
    if ((ficha.florinsDeOuro || 0) < custoJackpot) {
        await enviarMensagemTextoWhapi(chatId, `Você precisa de ${custoJackpot} Florins de Ouro para girar o Jackpot. Você tem ${ficha.florinsDeOuro || 0} FO.`);
        return;
    }

    ficha.florinsDeOuro -= custoJackpot;
    let premioMsg = "";
    const sorte = Math.random();
    let itemGanho = null; 

    if (sorte < 0.01) { // 1% - Jackpot Lendário
        const essenciaGanha = 5;
        ficha.essenciaDeArcadia = (ficha.essenciaDeArcadia || 0) + essenciaGanha;
        const florinsGanhosLendario = 100;
        ficha.florinsDeOuro += florinsGanhosLendario;
        premioMsg = `🌟✨ JACKPOT LENDÁRIO!!! ✨🌟\nVocê ganhou ${essenciaGanha} Essências de Arcádia e ${florinsGanhosLendario} Florins de Ouro! Que sorte incrível!`;
    } else if (sorte < 0.04) { // 3% - Item Raro
        itemGanho = JACKPOT_PREMIOS_RAROS[Math.floor(Math.random() * JACKPOT_PREMIOS_RAROS.length)];
        premioMsg = `💎 Uau! Você descolou um item RARO: *${itemGanho.itemNome}*!`;
    } else if (sorte < 0.10) { // 6% - Item Incomum
        itemGanho = JACKPOT_PREMIOS_INCOMUNS[Math.floor(Math.random() * JACKPOT_PREMIOS_INCOMUNS.length)];
        premioMsg = `🎁 Que sorte! Você ganhou um item INCOMUM: *${itemGanho.itemNome}*!`;
    } else if (sorte < 0.20) { // 10% - Item Comum
        itemGanho = JACKPOT_PREMIOS_COMUNS[Math.floor(Math.random() * JACKPOT_PREMIOS_COMUNS.length)];
        premioMsg = `👍 Bom achado! Você ganhou um item COMUM: *${itemGanho.itemNome}*.`;
    } else if (sorte < 0.35) { // 15% - Sorte Grande (Florins)
        const florinsGanhos = Math.floor(Math.random() * 100) + 50; 
        ficha.florinsDeOuro += florinsGanhos;
        premioMsg = `💰 Sorte Grande! Você ganhou ${florinsGanhos} Florins de Ouro!`;
    } else if (sorte < 0.55) { // 20% - Bom Prêmio (Florins)
        const florinsGanhos = Math.floor(Math.random() * 40) + 10; 
        ficha.florinsDeOuro += florinsGanhos;
        premioMsg = `🍀 Um bom prêmio! Você ganhou ${florinsGanhos} Florins de Ouro!`;
    } else if (sorte < 0.75) { // 20% - Nada
        premioMsg = `💨 Quase! O Jackpot não te deu nada desta vez... apenas o vento e a esperança.`;
    } else { // 25% - Pegadinhas
        const pegadinhas = [
            "Você puxa a alavanca e... uma meia velha e fedorenta cai do Jackpot! Que azar!",
            "O Jackpot solta uma fumaça colorida e te entrega um biscoito da sorte. Dentro dele está escrito: 'Tente novamente amanhã'.",
            "Você ganhou... um abraço imaginário do Mestre do Jackpot! 🤗 (Ele garante que vale muito em Arcádia)",
            "Uma pequena quantia de 5 Florins de Ouro é sua! Melhor que nada, certo?",
            "O Jackpot te encara e diz: 'Você é especial!'... mas não te dá nada além disso."
        ];
        premioMsg = pegadinhas[Math.floor(Math.random() * pegadinhas.length)];
        if (premioMsg.includes("5 Florins de Ouro")) {
            ficha.florinsDeOuro = (ficha.florinsDeOuro || 0) + 5;
        }
    }

    if (itemGanho) {
        if (!ficha.inventario) ficha.inventario = [];
        const itemParaAdicionarAoInventario = { ...itemGanho }; // Cria uma cópia para não modificar a constante original
        
        const itemExistenteIndex = ficha.inventario.findIndex(
            i => i.itemNome.toLowerCase() === itemParaAdicionarAoInventario.itemNome.toLowerCase() && i.tipo === itemParaAdicionarAoInventario.tipo
        );
        if (itemExistenteIndex > -1) {
            ficha.inventario[itemExistenteIndex].quantidade = (ficha.inventario[itemExistenteIndex].quantidade || 0) + (itemParaAdicionarAoInventario.quantidade || 1);
        } else {
            ficha.inventario.push(itemParaAdicionarAoInventario); 
        }
        premioMsg += `\n📜 _${itemParaAdicionarAoInventario.descricao || '(Sem descrição)'}_ (Tipo: ${itemParaAdicionarAoInventario.tipo || 'Item'})`;
    }

    await atualizarFichaETransmitir(chatId, sender, ficha, 
        `🎰 ${ficha.nomePersonagem || sender} gastou ${custoJackpot} FO no Jackpot...\n\n${premioMsg}\n\n💰 Seu saldo: ${ficha.florinsDeOuro} FO | ✨ Essência: ${ficha.essenciaDeArcadia || 0} EA.`
    );
}

// --- NOVA FUNÇÃO handleUsarItem ---
async function handleUsarItem(chatId, sender, args) {
    if (args.length === 0) {
        await enviarMensagemTextoWhapi(chatId, "Uso: `!usar <nome completo do item>`\nExemplo: `!usar Poção de Cura Menor`");
        return;
    }
    const nomeItemParaUsar = args.join(" ").trim();
    const ficha = await getFichaOuCarregar(sender);

    if (!ficha) { 
        await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada. Use `!criar` primeiro.");
        return;
    }
    if (!ficha.inventario || ficha.inventario.length === 0) {
        await enviarMensagemTextoWhapi(chatId, `Seu inventário está vazio, ${ficha.nomePersonagem || sender}.`);
        return;
    }

    const itemIndex = ficha.inventario.findIndex(
        itemInv => itemInv.itemNome.toLowerCase() === nomeItemParaUsar.toLowerCase()
    );

    if (itemIndex === -1) {
        await enviarMensagemTextoWhapi(chatId, `Você não possui o item "${nomeItemParaUsar}", ${ficha.nomePersonagem || sender}.`);
        return;
    }

    const itemNoInventario = ficha.inventario[itemIndex];
    
    if (!itemNoInventario.usavel || !itemNoInventario.efeito) {
        await enviarMensagemTextoWhapi(chatId, `O item "${itemNoInventario.itemNome}" não pode ser usado dessa forma ou não tem um efeito definido.`);
        return;
    }
    
    const efeitoBase = itemNoInventario.efeito;

    if (efeitoBase.cooldownSegundos && efeitoBase.cooldownSegundos > 0) {
        if (!ficha.cooldownsItens) ficha.cooldownsItens = {}; 
        const nomeItemKey = itemNoInventario.itemNome.toLowerCase();
        const proximoUsoPermitido = ficha.cooldownsItens[nomeItemKey];

        if (proximoUsoPermitido && Date.now() < proximoUsoPermitido) {
            const tempoRestante = Math.ceil((proximoUsoPermitido - Date.now()) / 1000);
            const minutos = Math.floor(tempoRestante / 60);
            const segundos = tempoRestante % 60;
            let tempoRestanteMsg = "";
            if (minutos > 0) tempoRestanteMsg += `${minutos}m `;
            if (segundos > 0 || minutos === 0) tempoRestanteMsg += `${segundos}s`;
            
            await enviarMensagemTextoWhapi(chatId, `Aguarde! Você precisa esperar mais ${tempoRestanteMsg.trim()} para usar "${itemNoInventario.itemNome}" novamente.`);
            return;
        }
    }

    let mensagemEfeitoAplicado = ""; 
    let efeitoRealizado = false;

    switch (efeitoBase.tipoEfeito) {
        case "CURA_HP":
            const curaHP = parseInt(efeitoBase.valor) || 0;
            if (ficha.pvAtual >= ficha.pvMax) {
                mensagemEfeitoAplicado = `${ficha.nomePersonagem || sender} usou ${itemNoInventario.itemNome}, mas seu HP já está no máximo! (HP: ${ficha.pvAtual}/${ficha.pvMax})`;
            } else {
                const pvAntes = ficha.pvAtual;
                ficha.pvAtual = Math.min(ficha.pvMax, (ficha.pvAtual || 0) + curaHP);
                const pvCurado = ficha.pvAtual - pvAntes;
                mensagemEfeitoAplicado = efeitoBase.mensagemAoUsar || `${ficha.nomePersonagem || sender} usou ${itemNoInventario.itemNome}.`;
                mensagemEfeitoAplicado += `\n❤️ Recuperou ${pvCurado} PV. (HP atual: ${ficha.pvAtual}/${ficha.pvMax})`;
                efeitoRealizado = true;
            }
            break;
        case "CURA_PM":
            const curaPM = parseInt(efeitoBase.valor) || 0;
            if (ficha.pmAtual >= ficha.pmMax) {
                mensagemEfeitoAplicado = `${ficha.nomePersonagem || sender} usou ${itemNoInventario.itemNome}, mas seu PM já está no máximo! (MP: ${ficha.pmAtual}/${ficha.pmMax})`;
            } else {
                const pmAntes = ficha.pmAtual;
                ficha.pmAtual = Math.min(ficha.pmMax, (ficha.pmAtual || 0) + curaPM);
                const pmCurado = ficha.pmAtual - pmAntes;
                mensagemEfeitoAplicado = efeitoBase.mensagemAoUsar || `${ficha.nomePersonagem || sender} usou ${itemNoInventario.itemNome}.`;
                mensagemEfeitoAplicado += `\n💧 Recuperou ${pmCurado} PM. (MP atual: ${ficha.pmAtual}/${ficha.pmMax})`;
                efeitoRealizado = true;
            }
            break;
        case "BUFF_ATRIBUTO_TEMP": 
             mensagemEfeitoAplicado = efeitoBase.mensagemAoUsar || `${ficha.nomePersonagem || sender} usou ${itemNoInventario.itemNome} e sente um efeito poderoso!`;
             if(efeitoBase.atributo && efeitoBase.valor && efeitoBase.duracaoDesc) {
                mensagemEfeitoAplicado += `\n✨ (Efeito: ${efeitoBase.atributo} +${efeitoBase.valor}, ${efeitoBase.duracaoDesc} - A mecânica de tempo ativo será implementada futuramente).`;
             }
             efeitoRealizado = true; // Mesmo sendo narrativo, o item é consumido e entra em cooldown
            break;
        case "REMOVE_CONDICAO": // Narrativo por enquanto
            mensagemEfeitoAplicado = efeitoBase.mensagemAoUsar || `${ficha.nomePersonagem || sender} usou ${itemNoInventario.itemNome} e se sente melhor!`;
            mensagemEfeitoAplicado += `\n(Condição "${efeitoBase.condicao || 'desconhecida'}" removida - efeito narrativo).`;
            efeitoRealizado = true;
            break;
        default:
            await enviarMensagemTextoWhapi(chatId, `O efeito do item "${itemNoInventario.itemNome}" (${efeitoBase.tipoEfeito}) é desconhecido ou ainda não foi implementado.`);
            return; 
    }

    if (efeitoRealizado) {
        itemNoInventario.quantidade = (itemNoInventario.quantidade || 1) - 1;
        if (itemNoInventario.quantidade <= 0) {
            ficha.inventario.splice(itemIndex, 1); 
            mensagemEfeitoAplicado += `\n(O último "${itemNoInventario.itemNome}" foi consumido.)`;
        } else {
            mensagemEfeitoAplicado += `\n(Restam ${itemNoInventario.quantidade} "${itemNoInventario.itemNome}".)`;
        }

        if (efeitoBase.cooldownSegundos && efeitoBase.cooldownSegundos > 0) {
            if (!ficha.cooldownsItens) ficha.cooldownsItens = {};
            const nomeItemKey = itemNoInventario.itemNome.toLowerCase();
            ficha.cooldownsItens[nomeItemKey] = Date.now() + (efeitoBase.cooldownSegundos * 1000);
            
            const minutosCD = Math.floor(efeitoBase.cooldownSegundos / 60);
            const segundosCD = efeitoBase.cooldownSegundos % 60;
            let cooldownMsg = "";
            if (minutosCD > 0) cooldownMsg += `${minutosCD}m `;
            if (segundosCD > 0 || minutosCD === 0) cooldownMsg += `${segundosCD}s`;
            mensagemEfeitoAplicado += `\n⏳ Este item entrará em cooldown por ${cooldownMsg.trim()}.`;
        }
        await atualizarFichaETransmitir(chatId, sender, ficha, mensagemEfeitoAplicado);
    } else {
        // Se o efeito não foi realizado (ex: HP/PM já no máximo e não houve outra mensagem)
        // A mensagemEfeitoAplicado já terá sido definida, então apenas a enviamos sem consumir/cooldown
        await enviarMensagemTextoWhapi(chatId, mensagemEfeitoAplicado);
    }
}


async function handleListarRacas(chatId) {
    let mensagem = "--- 📜 Raças Jogáveis de Arcádia 📜 ---\n\n";
    RACAS_ARCADIA.forEach(raca => { mensagem += `*${raca.nome}* (${raca.grupo})\n_${raca.desc}_\n\n`; });
    mensagem += "Use estes nomes ao criar seu personagem com `!criar`.";
    await enviarMensagemTextoWhapi(chatId, mensagem);
}

async function handleListarClasses(chatId) {
    let mensagem = "--- ⚔️ Classes Jogáveis de Arcádia ⚔️ ---\n\n";
    CLASSES_ARCADIA.forEach(classe => { mensagem += `*${classe.nome}* - ${classe.desc}\n`; });
    mensagem += "\nUse estes nomes ao criar seu personagem com `!criar`.";
    await enviarMensagemTextoWhapi(chatId, mensagem);
}

async function handleListarReinos(chatId) {
    let mensagem = "--- 🏰 Reinos Principais de Arcádia 🏰 ---\n\n";
    REINOS_ARCADIA.forEach(reino => { mensagem += `*${reino.nome}* - ${reino.desc}\n\n`; });
    mensagem += "Use estes nomes como seu Reino de Origem ao criar seu personagem com `!criar`.";
    await enviarMensagemTextoWhapi(chatId, mensagem);
}

async function handleComandosArcadia(chatId, senderIsOwner) {
    let resposta = "📜 --- Comandos de Arcádia --- 📜\n\n";
    resposta += "`!arcadia` ou `!bemvindo` - Mensagem de boas-vindas.\n";
    resposta += "`!ping` - Testa a conexão.\n";
    resposta += "`!criar <nome>;<raça>;<classe>;<reino>` - Cria sua ficha.\n";
    resposta += "`!ficha` - Mostra sua ficha atual.\n";
    // ATUALIZADO: Descrição do !distribuirpontos
    resposta += "`!distribuirpontos <atr1> <qtd1> [<atr2> <qtd2> ...]` - Distribui pontos em um ou mais atributos.\n   (Ex: `!distribuirpontos forca 5 agilidade 3`)\n   (Atributos: forca, agilidade, vitalidade, manaBase, intelecto, carisma)\n";
    resposta += "`!jackpot` - Tente sua sorte! (Custa 25 Florins)\n";
    // ADICIONADO: Comando !usar
    resposta += "`!usar <nome do item>` - Usa um item do seu inventário.\n";
    resposta += "\n--- Comandos Informativos ---\n";
    resposta += "`!listaracas`\n`!listaclasses`\n`!listareinos`\n";
    if (senderIsOwner) {
        resposta += "\n--- Comandos de Admin (Proprietário) ---\n";
        resposta += "`!ficha <ID_ALVO>` - Mostra a ficha do ID_ALVO.\n";
        resposta += "`!admincriar <ID_ALVO>;<nome>;<raça>;<classe>;<reino>`\n";
        resposta += "`!adminaddxp <ID_ALVO> <valor>`\n";
        resposta += "`!adminsetnivel <ID_ALVO> <nível>`\n";
        resposta += "`!adminaddflorins <ID_ALVO> <valor>`\n";
        resposta += "`!adminaddessencia <ID_ALVO> <valor>`\n";
        resposta += "`!adminadditem <ID_ALVO> <item>[;qtd;tipo;desc]\n";
        resposta += "`!admindelitem <ID_ALVO> <item>[;qtd]`\n";
        resposta += "`!adminsetattr <ID_ALVO> <atributo> <valor>`\n"; 
        resposta += "`!adminaddpontosattr <ID_ALVO> <quantidade>`\n";
    }
    resposta += "\n`!comandos` ou `!help` - Mostra esta lista.\n";
    await enviarMensagemTextoWhapi(chatId, resposta);
}

async function enviarMensagemTextoWhapi(para, mensagem) {
    if (!WHAPI_API_TOKEN) {
        console.error("Token do Whapi não configurado para envio.");
        return;
    }
    const endpoint = "/messages/text";
    const urlDeEnvio = `${WHAPI_BASE_URL}${endpoint}`;
    const payload = { "to": para, "body": mensagem };
    const headers = {
        'Authorization': `Bearer ${WHAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    try {
        await axios.post(urlDeEnvio, payload, { headers: headers });
    } catch (error) {
        console.error('Erro ao enviar mensagem TEXTO pelo Whapi:');
        if (error.response) {
            console.error('Status do Erro:', error.response.status);
            console.error('Dados do Erro:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Mensagem de Erro:', error.message);
        }
    }
}

// --- ROTA DE WEBHOOK ---
app.post('/webhook/whatsapp', async (req, res) => {
    console.log('----------------------------------------------------');
    console.log('>>> Webhook do Whapi Recebido! <<<');
    try {
        if (req.body.messages && Array.isArray(req.body.messages) && req.body.messages.length > 0) {
            for (const messageData of req.body.messages) {
                const fromMe = messageData.from_me;
                const chatId = messageData.chat_id;
                const senderRaw = messageData.from;
                const senderName = messageData.from_name || (senderRaw ? String(senderRaw).split('@')[0] : 'Desconhecido');
                const messageType = messageData.type;
                let textContent = "";

                if (messageType === 'text' && messageData.text && typeof messageData.text.body === 'string') {
                    textContent = messageData.text.body.trim();
                } else if (messageData.caption && typeof messageData.caption === 'string') {
                    textContent = messageData.caption.trim();
                }

                if (fromMe === true) {
                    console.log(`[Webhook] Mensagem própria ignorada do chat ${chatId}.`);
                    continue;
                }
                if (!chatId || !senderRaw) {
                    console.warn("[Webhook] Mensagem sem 'chat_id' ou 'sender' válido:", messageData);
                    continue;
                }

                const sender = String(senderRaw).trim();
                const ownerIdVerificado = OWNER_ID;
                let isOwner = (ownerIdVerificado && sender === ownerIdVerificado);
                let isJogadorPermitido = listaJogadoresPermitidos.has(sender);

                // Lógica de permissão ajustada
                if (!isOwner && !isJogadorPermitido && JOGADORES_PERMITIDOS_IDS_STRING !== "") { 
                    console.log(`[Webhook] Usuário ${senderName} (${sender}) não é proprietário nem jogador permitido (lista de permissão ativa). Comando ignorado.`);
                    continue; 
                }

                if (textContent && textContent.startsWith('!')) {
                    const args = textContent.slice(1).trim().split(/ +/g);
                    const comando = args.shift().toLowerCase();
                    
                    let preLog = isOwner ? "[Proprietário]" : (isJogadorPermitido ? "[Jogador Permitido]" : (JOGADORES_PERMITIDOS_IDS_STRING === "" ? "[Qualquer Jogador]" : "[NÃO AUTORIZADO]"));
                    console.log(`[Webhook] ${preLog} COMANDO: '!${comando}' | Args: [${args.join(', ')}] | De: ${senderName} (${sender}) | Chat: ${chatId}`);
                    
                    if (comando === 'ping') {
                        await enviarMensagemTextoWhapi(chatId, `Pong de Arcádia! Olá, ${senderName}! Estou pronto para a aventura! ⚔️`);
                    } else if (comando === 'arcadia' || comando === 'bemvindo') {
                        await handleBoasVindasArcadia(chatId, senderName);
                    } else if (comando === 'listaracas') {
                        await handleListarRacas(chatId);
                    } else if (comando === 'listaclasses') {
                        await handleListarClasses(chatId);
                    } else if (comando === 'listareinos') {
                        await handleListarReinos(chatId);
                    } else if (comando === 'criar') { 
                        await handleCriarFichaArcadia(chatId, sender, senderName, args);
                    } else if (comando === 'ficha' || comando === 'minhaficha' || comando === 'verficha') {
                        if (isOwner && args.length > 0 && comando !== 'minhaficha') {
                            await handleVerFichaArcadia(chatId, sender, args);
                        } else {
                            await handleVerFichaArcadia(chatId, sender, []);
                        }
                    } else if (comando === 'distribuirpontos') {
                         await handleDistribuirPontos(chatId, sender, args); 
                    } else if (comando === 'jackpot') {
                        await handleJackpotArcadia(chatId, sender);
                    } else if (comando === 'usar' || comando === 'usaritem') { // ADICIONADO AO WEBHOOK
                        await handleUsarItem(chatId, sender, args);
                    } else if ((comando === 'comandos' || comando === 'help')) {
                        await handleComandosArcadia(chatId, isOwner);
                    }
                    else if (isOwner) { // Comandos de Admin
                        switch (comando) {
                            case 'admincriar': await handleAdminCriarFichaArcadia(chatId, sender, args); break;
                            case 'adminaddxp': await handleAdminComandoFichaArcadia(chatId, args, 'addxp', modificarXPArcadia, `XP de [NOME_PERSONAGEM_ALVO] atualizado.`, "Uso: `!adminaddxp <ID_ALVO> <valor>`"); break;
                            case 'adminsetnivel': await handleAdminComandoFichaArcadia(chatId, args, 'setnivel', modificarNivelArcadia, `Nível de [NOME_PERSONAGEM_ALVO] atualizado.`, "Uso: `!adminsetnivel <ID_ALVO> <nível>`"); break;
                            case 'adminaddflorins': await handleAdminComandoFichaArcadia(chatId, args, 'addflorins', modificarFlorins, `Florins de [NOME_PERSONAGEM_ALVO] atualizados.`, "Uso: `!adminaddflorins <ID_ALVO> <valor>`"); break;
                            case 'adminaddessencia': await handleAdminComandoFichaArcadia(chatId, args, 'addessencia', modificarEssencia, `Essência de [NOME_PERSONAGEM_ALVO] atualizada.`, "Uso: `!adminaddessencia <ID_ALVO> <valor>`"); break;
                            case 'adminadditem': await handleAdminComandoFichaArcadia(chatId, args, 'additem', modificarAddItemArcadia, `Inventário de [NOME_PERSONAGEM_ALVO] atualizado.`, "Uso: `!adminadditem <ID_ALVO> <nome>[;qtd;tipo;desc]`"); break;
                            case 'admindelitem': await handleAdminComandoFichaArcadia(chatId, args, 'delitem', modificarDelItemArcadia, `Inventário de [NOME_PERSONAGEM_ALVO] atualizado.`, "Uso: `!admindelitem <ID_ALVO> <nome>[;qtd]`"); break;
                            case 'adminsetattr': await handleAdminSetAtributoArcadia(chatId, args); break;
                            case 'adminaddpontosattr': await handleAdminAddPontosAtributoArcadia(chatId, args); break;
                            // Comandos para o OWNER modificar A PRÓPRIA FICHA (nomes mais curtos)
                            case 'addxp': await handleAddXPArcadia(chatId, sender, args); break;
                            case 'setnivel': await handleSetNivelArcadia(chatId, sender, args); break;
                            case 'addflorins': await handleAddFlorins(chatId, sender, args); break;
                            case 'addessencia': await handleAddEssencia(chatId, sender, args); break;
                            case 'additem': await handleAddItemArcadia(chatId, sender, args); break;
                            case 'delitem': await handleDelItemArcadia(chatId, sender, args); break;
                            default: await enviarMensagemTextoWhapi(chatId, `Comando "!${comando}" (Admin) não reconhecido.`); break;
                        }
                    } else { // Se não for Owner e o comando não for um dos públicos gerais
                        // Apenas envia msg de erro se a lista de permitidos estiver ativa e o jogador não estiver nela,
                        // OU se a lista estiver desativada (aberto a todos) mas o comando for desconhecido.
                        if (JOGADORES_PERMITIDOS_IDS_STRING !== "" || 
                           (comando !== 'ping' && comando !== 'arcadia' && comando !== 'bemvindo' &&
                            comando !== 'listaracas' && comando !== 'listaclasses' && comando !== 'listareinos' &&
                            comando !== 'criar' && comando !== 'ficha' && comando !== 'minhaficha' && comando !== 'verficha' &&
                            comando !== 'distribuirpontos' && comando !== 'jackpot' && comando !== 'usar' && comando !== 'usaritem' &&
                            comando !== 'comandos' && comando !== 'help')) {
                            await enviarMensagemTextoWhapi(chatId, `Comando "!${comando}" não reconhecido ou você não tem permissão para usá-lo, ${senderName}.`);
                        }
                    }
                } else if (textContent) { // Mensagens normais (não comandos)
                    if (isOwner) {
                         console.log(`[Webhook] Texto normal recebido do Proprietário ${senderName} (${sender}): "${textContent}"`);
                    } else if (isJogadorPermitido || JOGADORES_PERMITIDOS_IDS_STRING === "") {
                         console.log(`[Webhook] Texto normal recebido do Jogador ${senderName} (${sender}): "${textContent}"`);
                    }
                }
            } 
        } else {
            console.log("[Webhook] Estrutura inesperada ou sem mensagens:", req.body);
        }
    } catch (error) {
        console.error("Erro CRÍTICO ao processar webhook do Whapi:", error.message, error.stack);
        // Enviar resposta 500 pode ser útil para o Whapi saber que falhou, mas não para o usuário final.
        // res.status(500).send('Internal Server Error'); // Descomente se precisar sinalizar falha ao Whapi
    }
    res.status(200).send('OK'); // Sempre envia OK para o Whapi para evitar retentativas desnecessárias por erros de lógica interna
});

// --- ROTA DE TESTE E INICIALIZAÇÃO DO SERVIDOR ---
app.get('/', (req, res) => {
    res.send('Servidor do Bot de RPG Arcádia (Whapi no Render com MongoDB) está operacional!');
});

async function iniciarServidor() {
    await conectarMongoDB();
    await carregarFichasDoDB(); // Carrega fichas após conectar ao DB
    app.listen(PORT, () => {
        console.log("****************************************************");
        console.log("*** INICIANDO SERVIDOR DO BOT DE RPG ARCÁDIA - WHAPI ***");
        console.log(`*** Data/Hora Início: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} ***`);
        console.log("****************************************************");
        const publicUrl = process.env.RENDER_EXTERNAL_URL;
        console.log(`Servidor do bot de RPG escutando na porta ${PORT}`);
        if (publicUrl) {
            console.log(`Webhook URL para configurar no Whapi.Cloud: ${publicUrl}/webhook/whatsapp`);
        } else {
            console.log(`Webhook local (para testes): http://localhost:${PORT}/webhook/whatsapp`);
        }
        console.log(`Conectado ao DB: ${MONGODB_DB_NAME}, Coleção: ${MONGODB_FICHAS_COLLECTION}`);
        
        if (OWNER_ID) {
            console.log(`>>> PROPRIETÁRIO DO BOT DEFINIDO: ${OWNER_ID} <<<`);
        } else {
            console.warn(">>> ALERTA: OWNER_ID não definido! Comandos de admin não funcionarão como esperado. <<<");
        }

        if (JOGADORES_PERMITIDOS_IDS_STRING && listaJogadoresPermitidos.size > 0) {
            console.log(`>>> Jogadores Permitidos Adicionais: ${Array.from(listaJogadoresPermitidos).join(', ')} <<<`);
        } else if (JOGADORES_PERMITIDOS_IDS_STRING) { 
            console.log(">>> Lista de IDs de jogadores permitidos está configurada mas vazia (JOGADORES_PERMITIDOS_IDS). Apenas o proprietário pode usar comandos restritos (se OWNER_ID estiver definido). <<<");
        } else { 
            console.log(">>> JOGADORES_PERMITIDOS_IDS não definido ou vazio. Comandos de jogador estão abertos a todos. Comandos de admin restritos ao OWNER_ID (se definido). <<<");
        }
        console.log("****************************************************");
        console.log("*** SERVIDOR PRONTO E RODANDO           ***");
        console.log("****************************************************");
    });
}

iniciarServidor().catch(err => {
    console.error("Falha crítica ao iniciar o servidor:", err);
    process.exit(1);
});

// --- Tratamento para desligamento gracioso ---
async function desligamentoGracioso(signal) {
    console.log(`${signal} recebido. Desligando o bot...`);
    if (dbClient) {
        try {
            await dbClient.close();
            console.log("Conexão com MongoDB fechada.");
        } catch (err) {
            console.error("Erro ao fechar conexão com MongoDB:", err);
        }
    }
    process.exit(0); // Encerra o processo
}
process.on('SIGTERM', () => desligamentoGracioso('SIGTERM'));
process.on('SIGINT', () => desligamentoGracioso('SIGINT'));

