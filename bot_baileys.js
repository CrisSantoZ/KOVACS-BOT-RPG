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

// --- CONSTANTES DE ARCÁDIA ---
const RACAS_ARCADIA = [
    { nome: "Eldari", grupo: "Puros", desc: "Elfos nobres com domínio natural da magia arcana." },
    { nome: "Valtheran", grupo: "Puros", desc: "Anões de montanhas profundas, exímios forjadores." },
    { nome: "Seraphim", grupo: "Puros", desc: "Raça alada de aparência angelical, guardiões antigos." },
    { nome: "Terrano", grupo: "Humanos", desc: "Humanos comuns, adaptáveis e versáteis." },
    { nome: "Vharen", grupo: "Humanos", desc: "Humanos com sangue de antigos magos, sensíveis à magia." },
    { nome: "Drakyn", grupo: "Humanos", desc: "Humanos com linhagem de dragões, habilidades elevadas." },
    { nome: "Mei’ra", grupo: "Mistos", desc: "Meio-elfos, diplomáticos e ligados à natureza." },
    { nome: "Thornak", grupo: "Mistos", desc: "Meio-orcs, fortes e leais, caçados por seu sangue." },
    { nome: "Lunari", grupo: "Mistos", desc: "Descendentes de humanos e Seraphim, magia lunar." }
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

// --- BASE DE DADOS DE ITENS DE ARCÁDIA ---
const ITENS_BASE_ARCADIA = {
    "florin de ouro": { itemNome: "Florin de Ouro", tipo: "Moeda", descricao: "A moeda comum de todos os reinos.", usavel: false },
    "essência de arcádia": { itemNome: "Essência de Arcádia", tipo: "Moeda Rara", descricao: "Usada para artefatos e magias.", usavel: false },
    "poção de cura menor": { 
        itemNome: "Poção de Cura Menor", tipo: "Consumível", 
        descricao: "Restaura uma pequena quantidade de PV.", usavel: true, 
        efeito: { tipoEfeito: "CURA_HP", valor: 25, mensagemAoUsar: "Você bebe a Poção de Cura Menor e sente o alívio.", cooldownSegundos: 60 }
    },
    "poção de mana menor": {
        itemNome: "Poção de Mana Menor", tipo: "Consumível",
        descricao: "Restaura uma pequena quantidade de PM.", usavel: true,
        efeito: { tipoEfeito: "CURA_PM", valor: 20, mensagemAoUsar: "Você bebe a Poção de Mana Menor e sua energia mágica é revigorada.", cooldownSegundos: 60 }
    },
    "antídoto simples": { 
        itemNome: "Antídoto Simples", tipo: "Consumível", 
        descricao: "Cura venenos fracos.", usavel: true,
        efeito: { tipoEfeito: "REMOVE_CONDICAO", condicao: "Envenenado Leve", mensagemAoUsar: "Você toma o Antídoto e o veneno em suas veias é neutralizado.", cooldownSegundos: 120 }
    },
    "elixir de agilidade menor": { 
        itemNome: "Elixir de Agilidade Menor", tipo: "Poção",
        descricao: "Aumenta temporariamente a Agilidade.", usavel: true,
        efeito: { 
            tipoEfeito: "BUFF_ATRIBUTO_TEMP", atributo: "agilidade", valor: 2, duracaoDesc: "por 5 minutos", 
            mensagemAoUsar: "Você bebe o Elixir e se sente mais ágil e rápido!", cooldownSegundos: 300 
        }
    },
    "rações de viagem": { 
        itemNome: "Rações de Viagem", tipo: "Consumível",
        descricao: "Comida para um dia de jornada. Restaura um pouco de vitalidade.", usavel: true,
        efeito: { tipoEfeito: "CURA_HP", valor: 10, mensagemAoUsar: "Você consome parte de suas rações e se sente um pouco restaurado.", cooldownSegundos: 180 }
    },
    "adaga simples": { itemNome: "Adaga Simples", tipo: "Arma Leve", descricao: "Uma adaga básica de bronze.", usavel: false },
    "adaga de ferro balanceada": { itemNome: "Adaga de Ferro Balanceada", tipo: "Arma Leve", descricao: "Uma adaga bem trabalhada.", usavel: false },
    "amuleto da sorte desgastado": { itemNome: "Amuleto da Sorte Desgastado", tipo: "Amuleto", descricao: "Um amuleto simples.", usavel: false },
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
    cooldownsItens: {},
    ultimaAtualizacao: "", logMissoes: [], notacoesDM: "" 
};

// --- CONFIGURAÇÃO DO MONGODB ---
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'arcadia_rpg_db'; 
const MONGODB_FICHAS_COLLECTION = process.env.MONGODB_FICHAS_COLLECTION || 'fichas_arcadia'; 

if (!MONGODB_URI) { console.error("--- ERRO FATAL: MONGODB_URI não definida! ---"); process.exit(1); }
if (!OWNER_ID) { console.warn("--- ALERTA: OWNER_ID não definida! ---"); }
if (JOGADORES_PERMITIDOS_IDS_STRING && listaJogadoresPermitidos.size > 0) { 
    console.log("Jogadores permitidos carregados:", Array.from(listaJogadoresPermitidos)); 
} else if (JOGADORES_PERMITIDOS_IDS_STRING){
    console.log("JOGADORES_PERMITIDOS_IDS definido mas vazio. Apenas OWNER terá acesso a comandos restritos.");
} else { 
    console.log("JOGADORES_PERMITIDOS_IDS não definido. Comandos de jogador abertos a todos, admin restrito ao OWNER."); 
}

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
            const fichaCompleta = { 
                ...JSON.parse(JSON.stringify(fichaModeloArcadia)), 
                ...fichaDB,
                atributos: { ...JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)), ...(fichaDB.atributos || {}) },
                inventario: fichaDB.inventario || [], 
                cooldownsItens: fichaDB.cooldownsItens || {} 
            };
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
    try {
        const fichaParaSalvar = { ...fichaData };
        delete fichaParaSalvar._id; 

        await fichasCollection.updateOne(
            { _id: idJogadorStr },
            { $set: fichaParaSalvar },
            { upsert: true }
        );
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
                ficha = { 
                    ...JSON.parse(JSON.stringify(fichaModeloArcadia)), 
                    ...fichaDB,
                    atributos: { ...JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)), ...(fichaDB.atributos || {}) },
                    inventario: fichaDB.inventario || [],
                    cooldownsItens: fichaDB.cooldownsItens || {}
                };
                todasAsFichas[idAlvoTrimmado] = ficha;
                console.log(`Ficha para ${idAlvoTrimmado} carregada do DB e mesclada com modelo.`);
            } else {
                return null; 
            }
        } catch (dbError) {
            console.error(`Erro ao buscar ficha ${idAlvoTrimmado} no DB:`, dbError);
            return null; 
        }
    }
    
    if (ficha) { 
        if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
        if (!ficha.inventario) ficha.inventario = [];
        if (!ficha.cooldownsItens) ficha.cooldownsItens = {};
        if (ficha._id && typeof ficha._id === 'object') ficha._id = String(ficha._id);

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
            if (value && typeof value === 'object' && key in value) { value = value[key]; } 
            else { return match; }
        }
        return value !== undefined ? String(value) : match;
    });
    await enviarMensagemTextoWhapi(chatId, msgFinal);
}

function calcularXpProximoNivel(nivelAtual) { return nivelAtual * 100 + 50; }

// --- CONFIGURAÇÃO DO SERVIDOR EXPRESS ---
const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
const PORT = process.env.PORT || 3000;
const WHAPI_API_TOKEN = process.env.WHAPI_API_TOKEN;
const WHAPI_BASE_URL = "https://gate.whapi.cloud";
if (!WHAPI_API_TOKEN) { console.error("FATAL_ERROR: Variável de ambiente WHAPI_API_TOKEN não definida!"); }

// --- FUNÇÕES DE COMANDO DO RPG - ARCÁDIA ---
async function handleCriarFichaArcadia(chatId, sender, senderName, args) {
    const idJogador = sender;
    const fichaExistente = await getFichaOuCarregar(idJogador);
    if (fichaExistente) {
        await enviarMensagemTextoWhapi(chatId, `Você já tem um personagem: ${fichaExistente.nomePersonagem}.`);
        return;
    }
    const dadosComando = args.join(' ');
    const partes = dadosComando.split(';').map(p => p.trim());
    if (partes.length < 4) { await enviarMensagemTextoWhapi(chatId, "Uso: `!criar <Nome>;<Raça>;<Classe>;<Reino>`"); return; }
    const [nomePersonagemInput, racaInput, classeInput, origemReinoInput] = partes;

    const racaValida = RACAS_ARCADIA.find(r => r.nome.toLowerCase() === racaInput.toLowerCase());
    const classeValida = CLASSES_ARCADIA.find(c => c.nome.toLowerCase() === classeInput.toLowerCase());
    const reinoValido = REINOS_ARCADIA.find(reino => reino.nome.toLowerCase() === origemReinoInput.toLowerCase());

    if (!racaValida) { await enviarMensagemTextoWhapi(chatId, `Raça "${racaInput}" inválida.`); return; }
    if (!classeValida) { await enviarMensagemTextoWhapi(chatId, `Classe "${classeInput}" inválida.`); return; }
    if (!reinoValido) { await enviarMensagemTextoWhapi(chatId, `Reino "${origemReinoInput}" inválido.`); return; }

    let novaFicha = JSON.parse(JSON.stringify(fichaModeloArcadia));
    novaFicha._id = idJogador; 
    novaFicha.nomeJogadorSalvo = senderName;
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.raca = racaValida.nome;
    novaFicha.classe = classeValida.nome; 
    novaFicha.origemReino = reinoValido.nome; 
    novaFicha.inventario = fichaModeloArcadia.inventario.map(itemModelo => JSON.parse(JSON.stringify(itemModelo)));
    
    novaFicha.pvMax = (novaFicha.atributos.vitalidade * 5) + (novaFicha.nivel * 5) + 20;
    novaFicha.pvAtual = novaFicha.pvMax;
    novaFicha.pmMax = (novaFicha.atributos.manaBase * 5) + (novaFicha.nivel * 3) + 10;
    novaFicha.pmAtual = novaFicha.pmMax;
    novaFicha.xpProximoNivel = calcularXpProximoNivel(novaFicha.nivel);

    todasAsFichas[idJogador] = novaFicha;
    await atualizarFichaETransmitir(chatId, idJogador, novaFicha, `🎉 Personagem ${nomePersonagemInput} (${novaFicha.raca} ${novaFicha.classe}) criado!\nUse \`!distribuirpontos\` e \`!ficha\`.`);
}

async function handleAdminCriarFichaArcadia(chatId, senderOwner, argsAdmin) {
    const comandoCompleto = argsAdmin.join(" ");
    const partesPrincipais = comandoCompleto.split(';');
    if (partesPrincipais.length < 5) { await enviarMensagemTextoWhapi(chatId, "Uso: `!admincriar <ID_ALVO>;<Nome>;<Raça>;<Classe>;<Reino>`"); return; }
    const [idJogadorAlvo, nomePersonagemInput, racaInput, classeInput, origemReinoInput] = partesPrincipais.map(p => p.trim());

    if (!/^\d+$/.test(idJogadorAlvo)) { await enviarMensagemTextoWhapi(chatId, `ID Alvo (${idJogadorAlvo}) inválido.`); return; }
    
    const racaValida = RACAS_ARCADIA.find(r => r.nome.toLowerCase() === racaInput.toLowerCase());
    const classeValida = CLASSES_ARCADIA.find(c => c.nome.toLowerCase() === classeInput.toLowerCase());
    const reinoValido = REINOS_ARCADIA.find(reino => reino.nome.toLowerCase() === origemReinoInput.toLowerCase());

    if (!racaValida) { await enviarMensagemTextoWhapi(chatId, `Raça "${racaInput}" inválida.`); return; }
    if (!classeValida) { await enviarMensagemTextoWhapi(chatId, `Classe "${classeInput}" inválida.`); return; }
    if (!reinoValido) { await enviarMensagemTextoWhapi(chatId, `Reino "${origemReinoInput}" inválido.`); return; }
    
    let novaFicha = JSON.parse(JSON.stringify(fichaModeloArcadia));
    novaFicha._id = idJogadorAlvo;
    novaFicha.nomeJogadorSalvo = `(Admin ID: ${idJogadorAlvo})`; 
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.raca = racaValida.nome; 
    novaFicha.classe = classeValida.nome; 
    novaFicha.origemReino = reinoValido.nome; 
    novaFicha.inventario = fichaModeloArcadia.inventario.map(itemModelo => JSON.parse(JSON.stringify(itemModelo)));

    novaFicha.pvMax = (novaFicha.atributos.vitalidade * 5) + (novaFicha.nivel * 5) + 20;
    novaFicha.pvAtual = novaFicha.pvMax;
    novaFicha.pmMax = (novaFicha.atributos.manaBase * 5) + (novaFicha.nivel * 3) + 10;
    novaFicha.pmAtual = novaFicha.pmMax;
    novaFicha.xpProximoNivel = calcularXpProximoNivel(novaFicha.nivel);
    
    todasAsFichas[idJogadorAlvo] = novaFicha;
    await atualizarFichaETransmitir(chatId, idJogadorAlvo, novaFicha, `🎉 [Admin] Personagem ${nomePersonagemInput} CRIADO/ATUALIZADO para ID ${idJogadorAlvo}.`);
}

async function handleVerFichaArcadia(chatId, sender, args) {
    let idAlvoConsulta = sender;
    let adminConsultandoOutro = false;
    if (args.length > 0 && sender === OWNER_ID) { 
        const idPotencial = String(args[0]).trim();
        if (/^\d+$/.test(idPotencial)) { idAlvoConsulta = idPotencial; adminConsultandoOutro = true; } 
        else { await enviarMensagemTextoWhapi(chatId, "ID alvo inválido."); return; }
    }
    const ficha = await getFichaOuCarregar(idAlvoConsulta);
    if (!ficha) { 
        await enviarMensagemTextoWhapi(chatId, adminConsultandoOutro ? `Ficha ID ${idAlvoConsulta} não encontrada.` : "Sua ficha não foi encontrada. Use `!criar`.");
        return;
    }
    let resposta = `🌟 --- Ficha: ${ficha.nomePersonagem || 'N/A'} (@${idAlvoConsulta}) --- 🌟\n`;
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
            const nomeAttrCap = attr.charAt(0).toUpperCase() + attr.slice(1);
            if (attr !== "pontosParaDistribuir") { resposta += `  ☆ ${nomeAttrCap.replace('Base', ' Base')}: ${valor || 0}\n`; }
        }
        if ((ficha.atributos.pontosParaDistribuir || 0) > 0) {
            const msg = adminConsultandoOutro ? `O jogador ${ficha.nomePersonagem || idAlvoConsulta} tem` : "Você tem";
            resposta += `  ✨ ${msg} ${ficha.atributos.pontosParaDistribuir} pontos para distribuir${adminConsultandoOutro ? "." : " (`!distribuirpontos`)"}\n`;
        }
    }
    resposta += "\n📜 Habilidades/Perícias:\n";
    let habText = "";
    if (ficha.habilidadesEspeciais && ficha.habilidadesEspeciais.length > 0) { ficha.habilidadesEspeciais.forEach(h => habText += `  ☆ ${h.nome || 'Habilidade'}: ${h.descricao || ''}\n`); }
    if (ficha.pericias && ficha.pericias.length > 0) { ficha.pericias.forEach(p => habText += `  ☆ Perícia ${p.nome || ''}: ${p.valor || ''}\n`); }
    resposta += habText || "  (Nenhuma listada)\n";
    resposta += "\n🔮 Magias:\n";
    if (ficha.magiasConhecidas && ficha.magiasConhecidas.length > 0) { ficha.magiasConhecidas.forEach(m => resposta += `  ☆ ${m.nome || 'Magia'} (Custo: ${m.custoMana || 'N/A'} PM): ${m.descricao || ''}\n`); }
    else { resposta += "  (Nenhuma magia conhecida)\n"; }
    resposta += "\n🎒 Inventário:\n";
    if (ficha.inventario && ficha.inventario.length > 0) { ficha.inventario.forEach(i => { resposta += `  ☆ ${i.itemNome || 'Item'} (Qtd: ${i.quantidade || 1}) ${i.tipo ? '['+i.tipo+']' : ''} ${i.descricao ? '- ' + i.descricao : ''}\n`; }); }
    else { resposta += "  (Vazio)\n"; }
    resposta += "\n⚙️ Equipamento:\n";
    let eqText = "";
    if (ficha.equipamento) {
        for(const slot in ficha.equipamento) {
            if (ficha.equipamento[slot]) {
                const nomeSlot = slot.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                const nomeItemEq = typeof ficha.equipamento[slot] === 'object' ? (ficha.equipamento[slot].itemNome || 'Item Desconhecido') : String(ficha.equipamento[slot]);
                eqText += `  ☆ ${nomeSlot}: ${nomeItemEq}\n`;
            }
        }
    }
    resposta += eqText || "  (Nenhum item equipado)\n";
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
        
        const pvMaxAntesDoLevelUp = ficha.pvMax || ((ficha.atributos.vitalidade * 5) + (nivelAntigo * 5) + 20);
        const pmMaxAntesDoLevelUp = ficha.pmMax || ((ficha.atributos.manaBase * 5) + (nivelAntigo * 3) + 10);

        ficha.pvMax = pvMaxAntesDoLevelUp + pvGanho;
        ficha.pmMax = pmMaxAntesDoLevelUp + pmGanho;
        
        ficha.pvAtual = ficha.pvMax; 
        ficha.pmAtual = ficha.pmMax;

        mensagensLevelUp.push(`🎉 PARABÉNS! ${ficha.nomePersonagem || sender} alcançou o Nível ${ficha.nivel}! Ganhou ${pvGanho} PV, ${pmGanho} PM e 2 pontos de atributo!`);
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
    } else if (diffNivel < 0) { 
        ficha.atributos.pontosParaDistribuir = Math.max(0, (ficha.atributos.pontosParaDistribuir || 0) + (diffNivel * 2)); 
    }
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

async function handleAddItemArcadia(chatId, sender, args) { // Jogador adicionando item
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada."); return; }
    const inputCompleto = args.join(" "); 
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) { await enviarMensagemTextoWhapi(chatId, "Uso: `!additem <nome do item>[;quantidade;tipo;descricao]`"); return; }
    const nomeItemInput = partesItem[0]; 
    const quantidade = partesItem[1] ? parseInt(partesItem[1]) : 1;
    const tipoInput = partesItem[2] || null; 
    const descricaoInput = partesItem[3] || null;

    if (isNaN(quantidade) || quantidade < 1) { await enviarMensagemTextoWhapi(chatId, "Quantidade inválida."); return; }
    if (!ficha.inventario) ficha.inventario = []; 

    const itemBaseDef = ITENS_BASE_ARCADIA[nomeItemInput.toLowerCase()];
    let itemFinal;

    if(itemBaseDef) { 
        itemFinal = JSON.parse(JSON.stringify(itemBaseDef));
        itemFinal.quantidade = quantidade;
        if (tipoInput) itemFinal.tipo = tipoInput; 
        if (descricaoInput) itemFinal.descricao = descricaoInput; 
        delete itemFinal.quantidadeBase;
    } else { 
        console.warn(`[PlayerAddItem] Item "${nomeItemInput}" não encontrado em ITENS_BASE_ARCADIA. Adicionando como custom.`);
        itemFinal = { 
            itemNome: nomeItemInput, quantidade: quantidade, 
            tipo: tipoInput || "Desconhecido", descricao: descricaoInput || "Item adicionado pelo jogador.",
            usavel: false 
        };
    }
    
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === itemFinal.itemNome.toLowerCase() && i.tipo === itemFinal.tipo);
    if (itemExistenteIndex > -1) {
        ficha.inventario[itemExistenteIndex].quantidade = (ficha.inventario[itemExistenteIndex].quantidade || 0) + itemFinal.quantidade;
        if (descricaoInput) ficha.inventario[itemExistenteIndex].descricao = descricaoInput;
        await atualizarFichaETransmitir(chatId, sender, ficha, `Quantidade de "${itemFinal.itemNome}" aumentada para ${ficha.inventario[itemExistenteIndex].quantidade}.`);
    } else {
        ficha.inventario.push(itemFinal);
        await atualizarFichaETransmitir(chatId, sender, ficha, `"${itemFinal.itemNome}" (x${itemFinal.quantidade}) adicionado ao seu inventário.`);
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
    if (itemExistenteIndex === -1) { await enviarMensagemTextoWhapi(chatId, `Item "${nomeItem}" não encontrado.`); return; }
    const nomeItemOriginal = ficha.inventario[itemExistenteIndex].itemNome;
    if (ficha.inventario[itemExistenteIndex].quantidade < quantidadeRemover) {
        await enviarMensagemTextoWhapi(chatId, `Você não tem ${quantidadeRemover} de "${nomeItemOriginal}".`); return;
    }
    ficha.inventario[itemExistenteIndex].quantidade -= quantidadeRemover;
    if (ficha.inventario[itemExistenteIndex].quantidade <= 0) {
        ficha.inventario.splice(itemExistenteIndex, 1);
        await atualizarFichaETransmitir(chatId, sender, ficha, `"${nomeItemOriginal}" removido completamente.`);
    } else {
        await atualizarFichaETransmitir(chatId, sender, ficha, `${quantidadeRemover}x "${nomeItemOriginal}" removido(s). Restam ${ficha.inventario[itemExistenteIndex].quantidade}.`);
    }
}

// --- FUNÇÕES DE ADMIN ---
async function handleAdminComandoFichaArcadia(chatId, args, tipoComando, callbackModificacao, mensagemSucessoPadrao, mensagemErroUso) {
    let minArgs = 2;
    if (tipoComando === 'adminsetattr') minArgs = 3;
    else if (tipoComando === 'adminadditem' || tipoComando === 'admindelitem') minArgs = 2;

    if (args.length < minArgs && !(args.length >=1 && (tipoComando === 'adminadditem' || tipoComando === 'admindelitem'))) {
         if (args.length < 1 && (tipoComando === 'adminadditem' || tipoComando === 'admindelitem')) { await enviarMensagemTextoWhapi(chatId, mensagemErroUso); return; }
         else if (args.length < minArgs && tipoComando !== 'adminadditem' && tipoComando !== 'admindelitem') { await enviarMensagemTextoWhapi(chatId, mensagemErroUso); return; }
    }

    const idAlvo = args[0].trim();
    if (!/^\d+$/.test(idAlvo)) { await enviarMensagemTextoWhapi(chatId, `ID Alvo (${idAlvo}) inválido.`); return; }
    
    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) { await enviarMensagemTextoWhapi(chatId, `Ficha não encontrada para ID ${idAlvo}.`); return; }
    
    let fichaModificada = JSON.parse(JSON.stringify(fichaAlvo));
    const resultadoCallback = callbackModificacao(fichaModificada, args.slice(1)); 

    if (typeof resultadoCallback === 'string' && resultadoCallback.startsWith("ERRO:")) { await enviarMensagemTextoWhapi(chatId, resultadoCallback.substring(5)); return; }
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

function modificarAddItemArcadia(ficha, argsItemAdmin) {
    const inputCompleto = argsItemAdmin.join(" "); 
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) return "ERRO: Nome do item obrigatório.";
    
    const nomeItemInputAdmin = partesItem[0];
    const quantidadeAdmin = partesItem[1] ? parseInt(partesItem[1]) : 1;
    const tipoAdmin = partesItem[2] || null; 
    const descricaoAdmin = partesItem[3] || null;

    if (isNaN(quantidadeAdmin) || quantidadeAdmin < 1) return "ERRO: Quantidade inválida.";
    if (!ficha.inventario) ficha.inventario = [];

    const itemBaseDef = ITENS_BASE_ARCADIA[nomeItemInputAdmin.toLowerCase()];
    let itemParaAdicionar;

    if (itemBaseDef) {
        itemParaAdicionar = JSON.parse(JSON.stringify(itemBaseDef));
        itemParaAdicionar.quantidade = quantidadeAdmin;
        if (tipoAdmin) itemParaAdicionar.tipo = tipoAdmin;
        if (descricaoAdmin) itemParaAdicionar.descricao = descricaoAdmin;
        delete itemParaAdicionar.quantidadeBase;
    } else {
        console.warn(`[AdminAddItem] Item "${nomeItemInputAdmin}" não na base. Adicionando como genérico.`);
        itemParaAdicionar = { 
            itemNome: nomeItemInputAdmin, quantidade: quantidadeAdmin, 
            tipo: tipoAdmin || "Item Genérico", descricao: descricaoAdmin || "Adicionado por admin.",
            usavel: false 
        };
    }
    
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === itemParaAdicionar.itemNome.toLowerCase() && i.tipo === itemParaAdicionar.tipo);
    if (itemExistenteIndex > -1) {
        ficha.inventario[itemExistenteIndex].quantidade = (ficha.inventario[itemExistenteIndex].quantidade || 0) + itemParaAdicionar.quantidade;
        if (tipoAdmin) ficha.inventario[itemExistenteIndex].tipo = tipoAdmin;
        if (descricaoAdmin) ficha.inventario[itemExistenteIndex].descricao = descricaoAdmin;
        if (itemBaseDef) {
             ficha.inventario[itemExistenteIndex].usavel = itemBaseDef.usavel;
             ficha.inventario[itemExistenteIndex].efeito = itemBaseDef.efeito ? JSON.parse(JSON.stringify(itemBaseDef.efeito)) : undefined;
        }
        return `Qtd de "${itemParaAdicionar.itemNome}" aumentada para ${ficha.inventario[itemExistenteIndex].quantidade} para [NOME_PERSONAGEM_ALVO]. Detalhes atualizados.`;
    } else {
        ficha.inventario.push(itemParaAdicionar);
        return `"${itemParaAdicionar.itemNome}" (x${itemParaAdicionar.quantidade}) adicionado ao inventário de [NOME_PERSONAGEM_ALVO].`;
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
    if (args.length < 3) { await enviarMensagemTextoWhapi(chatId, "Uso: `!adminsetattr <ID> <atr> <valor>`"); return; }
    const idAlvo = args[0].trim(); 
    const atributoNomeInput = args[1].trim(); 
    const valor = parseInt(args[2]);
    if (!/^\d+$/.test(idAlvo)) { await enviarMensagemTextoWhapi(chatId, `ID Alvo (${idAlvo}) inválido.`); return; }
    const atributosValidos = ["forca", "agilidade", "vitalidade", "manaBase", "intelecto", "carisma"];
    const atributoCanonical = atributosValidos.find(valido => valido.toLowerCase() === atributoNomeInput.toLowerCase());
    if (!atributoCanonical) { await enviarMensagemTextoWhapi(chatId, `Atributo "${atributoNomeInput}" inválido.`); return; }
    if (isNaN(valor) || valor < 0) { await enviarMensagemTextoWhapi(chatId, `Valor para ${atributoCanonical} inválido.`); return; }
    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) { await enviarMensagemTextoWhapi(chatId, `Ficha ID ${idAlvo} não encontrada.`); return; }
    if (!fichaAlvo.atributos) fichaAlvo.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)); 
    fichaAlvo.atributos[atributoCanonical] = valor; 
    await atualizarFichaETransmitir(chatId, idAlvo, fichaAlvo, `[Admin] Atributo ${atributoCanonical} de [NOME_PERSONAGEM_ALVO] definido para ${valor}.`, fichaAlvo.nomePersonagem || idAlvo);
}

async function handleAdminAddPontosAtributoArcadia(chatId, args) {
    if (args.length < 2) { await enviarMensagemTextoWhapi(chatId, "Uso: `!adminaddpontosattr <ID> <qtd>`"); return; }
    const idAlvo = args[0].trim(); 
    const quantidade = parseInt(args[1]);
    if (!/^\d+$/.test(idAlvo)) { await enviarMensagemTextoWhapi(chatId, `ID Alvo (${idAlvo}) inválido.`); return; }
    if (isNaN(quantidade)) { await enviarMensagemTextoWhapi(chatId, "Quantidade inválida."); return; }
    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) { await enviarMensagemTextoWhapi(chatId, `Ficha ID ${idAlvo} não encontrada.`); return; }
    if (!fichaAlvo.atributos) fichaAlvo.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)); 
    fichaAlvo.atributos.pontosParaDistribuir = (fichaAlvo.atributos.pontosParaDistribuir || 0) + quantidade;
    if (fichaAlvo.atributos.pontosParaDistribuir < 0) fichaAlvo.atributos.pontosParaDistribuir = 0;
    await atualizarFichaETransmitir(chatId, idAlvo, fichaAlvo, `[Admin] Pontos para distribuir de [NOME_PERSONAGEM_ALVO] ajustados para ${fichaAlvo.atributos.pontosParaDistribuir}.`, fichaAlvo.nomePersonagem || idAlvo);
}

async function handleBoasVindasArcadia(chatId, senderName) {
    let mensagem = `🌟 Saudações, ${senderName}!\nBem-vindo(a) a Arcádia! 🌟\n\n`;
    mensagem += "Um mundo medieval vibrante com magia, mas também repleto de perigos...\n\n";
    mensagem += "Use `!comandos` para ver a lista de ações disponíveis.\n";
    mensagem += "Use `!criar <Nome>;<Raça>;<Classe>;<ReinoOrigem>` para iniciar sua jornada!";
    await enviarMensagemTextoWhapi(chatId, mensagem);
}

async function handleDistribuirPontos(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada."); return; }
    if (!ficha.atributos || ficha.atributos.pontosParaDistribuir === undefined || ficha.atributos.pontosParaDistribuir <= 0) {
        await enviarMensagemTextoWhapi(chatId, "Você não tem pontos de atributo para distribuir."); return;
    }
    if (args.length === 0 || args.length % 2 !== 0) {
        await enviarMensagemTextoWhapi(chatId, "Uso: `!distribuirpontos <atr1> <qtd1> [<atr2> <qtd2> ...]`\nEx: `!distribuirpontos forca 5 agilidade 3`"); return;
    }
    const atributosValidos = ["forca", "agilidade", "vitalidade", "manaBase", "intelecto", "carisma"];
    let mudancasPlanejadas = [];
    let totalPontosSolicitados = 0;
    let mensagensErroParse = [];
    for (let i = 0; i < args.length; i += 2) {
        const atributoNomeInput = args[i].trim();
        const pontosStr = args[i + 1];
        const atributoCanonical = atributosValidos.find(valido => valido.toLowerCase() === atributoNomeInput.toLowerCase());
        if (!atributoCanonical) { mensagensErroParse.push(`Atributo "${atributoNomeInput}" inválido.`); continue; }
        const pontosParaEsteAtributo = parseInt(pontosStr);
        if (isNaN(pontosParaEsteAtributo) || pontosParaEsteAtributo <= 0) { mensagensErroParse.push(`Qtd "${pontosStr}" para ${atributoCanonical} deve ser positiva.`); continue; }
        mudancasPlanejadas.push({ atributo: atributoCanonical, valor: pontosParaEsteAtributo });
        totalPontosSolicitados += pontosParaEsteAtributo;
    }
    if (mensagensErroParse.length > 0) {
        await enviarMensagemTextoWhapi(chatId, "Erros:\n- " + mensagensErroParse.join("\n- ") + `\n\nVálidos: ${atributosValidos.join(", ")}`); return;
    }
    if (mudancasPlanejadas.length === 0) { await enviarMensagemTextoWhapi(chatId, "Nenhuma distribuição válida."); return; }
    if (totalPontosSolicitados > ficha.atributos.pontosParaDistribuir) {
        await enviarMensagemTextoWhapi(chatId, `Tentou distribuir ${totalPontosSolicitados} pts, mas só tem ${ficha.atributos.pontosParaDistribuir}.`); return;
    }
    let feedbackMudancasTexto = [];
    for (const mudanca of mudancasPlanejadas) {
        const valorAntigo = ficha.atributos[mudanca.atributo] || 0;
        ficha.atributos[mudanca.atributo] = valorAntigo + mudanca.valor;
        feedbackMudancasTexto.push(`${mudanca.atributo}: ${valorAntigo} + ${mudanca.valor} → ${ficha.atributos[mudanca.atributo]}`);
    }
    ficha.atributos.pontosParaDistribuir -= totalPontosSolicitados;
    await atualizarFichaETransmitir(chatId, sender, ficha, 
        `✅ Pontos distribuídos (${ficha.nomePersonagem || sender}):\n${feedbackMudancasTexto.join("\n")}\n✨ Pontos restantes: ${ficha.atributos.pontosParaDistribuir}.`
    );
}

async function handleJackpotArcadia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada."); return; }

    let numeroDeGiros = 1;
    if (args.length > 0 && /^\d+$/.test(args[0])) {
        numeroDeGiros = parseInt(args[0]);
        if (numeroDeGiros <= 0) numeroDeGiros = 1;
        if (numeroDeGiros > 10) { numeroDeGiros = 10; await enviarMensagemTextoWhapi(chatId, "Limite de 10 giros por comando."); }
    }
    const custoPorGiro = 25;
    const custoTotal = custoPorGiro * numeroDeGiros;
    if ((ficha.florinsDeOuro || 0) < custoTotal) {
        await enviarMensagemTextoWhapi(chatId, `Precisa de ${custoTotal} FO para ${numeroDeGiros} giro(s). Você tem ${ficha.florinsDeOuro || 0} FO.`); return;
    }
    ficha.florinsDeOuro -= custoTotal;
    let mensagensDePremios = [];
    let florinsGanhosTotal = 0;
    let essenciaGanhaTotal = 0;
    let itensGanhosLista = [];

    for (let i = 0; i < numeroDeGiros; i++) {
        const sorte = Math.random();
        let premioMsgGiro = "";
        let itemGanhoGiroObj = null;

        if (sorte < 0.01) { 
            const essenciaGanha = 5; essenciaGanhaTotal += essenciaGanha;
            const florinsGanhosLendario = 100; florinsGanhosTotal += florinsGanhosLendario;
            premioMsgGiro = `🌟✨ JACKPOT LENDÁRIO!!! +${essenciaGanha} Essências e +${florinsGanhosLendario} Florins!`;
        } else if (sorte < 0.04) { 
            const nomeItemSorteado = JACKPOT_PREMIOS_NOMES_RAROS[Math.floor(Math.random() * JACKPOT_PREMIOS_NOMES_RAROS.length)];
            const itemBase = ITENS_BASE_ARCADIA[nomeItemSorteado];
            if(itemBase) { itemGanhoGiroObj = JSON.parse(JSON.stringify(itemBase)); itemGanhoGiroObj.quantidade = 1; delete itemGanhoGiroObj.quantidadeBase; }
            premioMsgGiro = `💎 RARO: *${itemGanhoGiroObj ? itemGanhoGiroObj.itemNome : "Algo especial"}*!`;
        } else if (sorte < 0.10) { 
            const nomeItemSorteado = JACKPOT_PREMIOS_NOMES_INCOMUNS[Math.floor(Math.random() * JACKPOT_PREMIOS_NOMES_INCOMUNS.length)];
            const itemBase = ITENS_BASE_ARCADIA[nomeItemSorteado];
            if(itemBase) { itemGanhoGiroObj = JSON.parse(JSON.stringify(itemBase)); itemGanhoGiroObj.quantidade = 1; delete itemGanhoGiroObj.quantidadeBase; }
            premioMsgGiro = `🎁 INCOMUM: *${itemGanhoGiroObj ? itemGanhoGiroObj.itemNome : "Algo útil"}*!`;
        } else if (sorte < 0.20) { 
            const nomeItemSorteado = JACKPOT_PREMIOS_NOMES_COMUNS[Math.floor(Math.random() * JACKPOT_PREMIOS_NOMES_COMUNS.length)];
            const itemBase = ITENS_BASE_ARCADIA[nomeItemSorteado];
            if(itemBase) { itemGanhoGiroObj = JSON.parse(JSON.stringify(itemBase)); itemGanhoGiroObj.quantidade = 1; delete itemGanhoGiroObj.quantidadeBase; }
            premioMsgGiro = `👍 COMUM: *${itemGanhoGiroObj ? itemGanhoGiroObj.itemNome : "Algo simples"}*.`;
        } else if (sorte < 0.35) { 
            const florinsGanhos = Math.floor(Math.random() * 100) + 50; florinsGanhosTotal += florinsGanhos;
            premioMsgGiro = `💰 Sorte Grande! +${florinsGanhos} Florins!`;
        } else if (sorte < 0.55) { 
            const florinsGanhos = Math.floor(Math.random() * 40) + 10; florinsGanhosTotal += florinsGanhos;
            premioMsgGiro = `🍀 Bom prêmio! +${florinsGanhos} Florins!`;
        } else if (sorte < 0.75) { 
            premioMsgGiro = `💨 Quase! Nada desta vez...`;
        } else { 
            const pegadinhas = ["Uma meia velha!", "Biscoito: 'Tente de novo'.", "Abraço imaginário!", "5 Florins.", "O Jackpot piscou."];
            premioMsgGiro = pegadinhas[Math.floor(Math.random() * pegadinhas.length)];
            if (premioMsgGiro.includes("5 Florins")) florinsGanhosTotal += 5;
        }
        mensagensDePremios.push(premioMsgGiro);
        if (itemGanhoGiroObj) itensGanhosLista.push(itemGanhoGiroObj);
    }
    ficha.florinsDeOuro += florinsGanhosTotal;
    ficha.essenciaDeArcadia = (ficha.essenciaDeArcadia || 0) + essenciaGanhaTotal;
    if (itensGanhosLista.length > 0) {
        if (!ficha.inventario) ficha.inventario = [];
        itensGanhosLista.forEach(itemNovo => {
            const itemExistenteIdx = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === itemNovo.itemNome.toLowerCase() && i.tipo === itemNovo.tipo);
            if (itemExistenteIdx > -1) {
                ficha.inventario[itemExistenteIdx].quantidade = (ficha.inventario[itemExistenteIdx].quantidade || 0) + (itemNovo.quantidade || 1);
            } else { ficha.inventario.push(itemNovo); }
        });
    }
    let mensagemFinal = `🎰 ${ficha.nomePersonagem || sender} gastou ${custoTotal} FO em ${numeroDeGiros} giro(s)!\n*Resultados:*`;
    mensagensDePremios.forEach((msg, idx) => { mensagemFinal += `\n${idx + 1}º: ${msg}`; });
    if (florinsGanhosTotal > 0) mensagemFinal += `\n\nTotal Florins: +${florinsGanhosTotal} FO`;
    if (essenciaGanhaTotal > 0) mensagemFinal += `\nTotal Essência: +${essenciaGanhaTotal} EA`;
    if (itensGanhosLista.length > 0) mensagemFinal += `\nItens: ${itensGanhosLista.map(it => it.itemNome).join(', ')}`;
    mensagemFinal += `\n\n💰 Saldo: ${ficha.florinsDeOuro} FO | ✨ Essência: ${ficha.essenciaDeArcadia || 0} EA.`;
    await atualizarFichaETransmitir(chatId, sender, ficha, mensagemFinal);
}

async function handleUsarItem(chatId, sender, args) {
    if (args.length === 0) { await enviarMensagemTextoWhapi(chatId, "Uso: `!usar <nome do item> [quantidade]`"); return; }
    let quantidadeAUsar = 1;
    let nomeItemParaUsar;
    if (args.length > 1 && /^\d+$/.test(args[args.length - 1])) {
        quantidadeAUsar = parseInt(args[args.length - 1]);
        if (quantidadeAUsar <= 0) { await enviarMensagemTextoWhapi(chatId, "Quantidade deve ser positiva."); return; }
        nomeItemParaUsar = args.slice(0, -1).join(" ").trim();
    } else { nomeItemParaUsar = args.join(" ").trim(); }
    if (!nomeItemParaUsar) { await enviarMensagemTextoWhapi(chatId, "Especifique o item."); return; }

    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { await enviarMensagemTextoWhapi(chatId, "Sua ficha não encontrada."); return; }
    if (!ficha.inventario || ficha.inventario.length === 0) { await enviarMensagemTextoWhapi(chatId, "Inventário vazio."); return; }

    let mensagensDeUso = [];
    let itensConsumidosNoTotal = 0;
    let itemRealNomeParaCooldown = ""; 
    let cooldownFinalSegundos = 0;

    for (let i = 0; i < quantidadeAUsar; i++) {
        const itemIndex = ficha.inventario.findIndex(itemInv => itemInv.itemNome.toLowerCase() === nomeItemParaUsar.toLowerCase());
        if (itemIndex === -1) {
            mensagensDeUso.push(`(${i+1}/${quantidadeAUsar}) Você não possui mais "${nomeItemParaUsar}".`);
            break; 
        }
        const itemNoInventario = ficha.inventario[itemIndex];
        itemRealNomeParaCooldown = itemNoInventario.itemNome; // Para a mensagem final de cooldown
        const itemBase = ITENS_BASE_ARCADIA[itemNoInventario.itemNome.toLowerCase()];

        if (!itemBase || !itemBase.usavel || !itemBase.efeito) {
            mensagensDeUso.push(`(${i+1}/${quantidadeAUsar}) Item "${itemRealNomeParaCooldown}" não é usável.`);
            break; 
        }
        const efeitoBase = itemBase.efeito;
        cooldownFinalSegundos = efeitoBase.cooldownSegundos || 0; // Guarda o cooldown do item

        if (efeitoBase.cooldownSegundos && efeitoBase.cooldownSegundos > 0) {
            if (!ficha.cooldownsItens) ficha.cooldownsItens = {};
            const nomeItemKey = itemRealNomeParaCooldown.toLowerCase();
            const proximoUsoPermitido = ficha.cooldownsItens[nomeItemKey];
            if (proximoUsoPermitido && Date.now() < proximoUsoPermitido) {
                const tempoRestante = Math.ceil((proximoUsoPermitido - Date.now()) / 1000);
                mensagensDeUso.push(`(${i+1}/${quantidadeAUsar}) "${itemRealNomeParaCooldown}" em cooldown. Espere ${tempoRestante}s.`);
                continue; 
            }
        }
        let msgEfeitoIndividual = "";
        let efeitoRealizadoNestaTentativa = false;
        switch (efeitoBase.tipoEfeito) {
            case "CURA_HP":
                const curaHP = parseInt(efeitoBase.valor) || 0;
                if (ficha.pvAtual >= ficha.pvMax) { msgEfeitoIndividual = `HP já no máximo.`; }
                else { const pvAntes = ficha.pvAtual; ficha.pvAtual = Math.min(ficha.pvMax, (ficha.pvAtual || 0) + curaHP); msgEfeitoIndividual = `❤️ +${ficha.pvAtual - pvAntes} PV (Total: ${ficha.pvAtual}/${ficha.pvMax})`; efeitoRealizadoNestaTentativa = true; }
                break;
            case "CURA_PM":
                const curaPM = parseInt(efeitoBase.valor) || 0;
                if (ficha.pmAtual >= ficha.pmMax) { msgEfeitoIndividual = `PM já no máximo.`; }
                else { const pmAntes = ficha.pmAtual; ficha.pmAtual = Math.min(ficha.pmMax, (ficha.pmAtual || 0) + curaPM); msgEfeitoIndividual = `💧 +${ficha.pmAtual - pmAntes} PM (Total: ${ficha.pmAtual}/${ficha.pmMax})`; efeitoRealizadoNestaTentativa = true; }
                break;
            case "BUFF_ATRIBUTO_TEMP":
                 msgEfeitoIndividual = efeitoBase.mensagemAoUsar || `Efeito de ${itemRealNomeParaCooldown} ativado!`;
                 if(efeitoBase.atributo && efeitoBase.valor && efeitoBase.duracaoDesc) { msgEfeitoIndividual += ` (${efeitoBase.atributo} +${efeitoBase.valor}, ${efeitoBase.duracaoDesc} - narrativo).`; }
                 efeitoRealizadoNestaTentativa = true;
                break;
            case "REMOVE_CONDICAO":
                msgEfeitoIndividual = efeitoBase.mensagemAoUsar || `Condição "${efeitoBase.condicao}" removida (narrativo).`;
                efeitoRealizadoNestaTentativa = true;
                break;
            default: msgEfeitoIndividual = `Efeito desconhecido para "${itemRealNomeParaCooldown}".`;
        }
        mensagensDeUso.push(`(${i+1}/${quantidadeAUsar}) Usou "${itemRealNomeParaCooldown}": ${msgEfeitoIndividual}`);
        if (efeitoRealizadoNestaTentativa) {
            itemNoInventario.quantidade = (itemNoInventario.quantidade || 1) - 1;
            itensConsumidosNoTotal++;
            if (efeitoBase.cooldownSegundos && efeitoBase.cooldownSegundos > 0) {
                if (!ficha.cooldownsItens) ficha.cooldownsItens = {};
                ficha.cooldownsItens[itemRealNomeParaCooldown.toLowerCase()] = Date.now() + (efeitoBase.cooldownSegundos * 1000);
            }
            if (itemNoInventario.quantidade <= 0) { ficha.inventario.splice(itemIndex, 1); }
        }
    }
    if (mensagensDeUso.length === 0) { await enviarMensagemTextoWhapi(chatId, "Nenhum item foi usado."); return; }
    let mensagemFinalConsumo = `${ficha.nomePersonagem || sender} usou itens:\n` + mensagensDeUso.join("\n");
    if (itensConsumidosNoTotal > 0 && cooldownFinalSegundos > 0) {
         mensagemFinalConsumo += `\n⏳ "${itemRealNomeParaCooldown}" entrou em cooldown por ${cooldownFinalSegundos}s.`;
    }
    await atualizarFichaETransmitir(chatId, sender, ficha, mensagemFinalConsumo);
}

async function handleListarRacas(chatId) {
    let mensagem = "--- 📜 Raças de Arcádia 📜 ---\n\n";
    RACAS_ARCADIA.forEach(raca => { mensagem += `*${raca.nome}* (${raca.grupo})\n_${raca.desc}_\n\n`; });
    await enviarMensagemTextoWhapi(chatId, mensagem + "Use estes nomes ao criar personagem.");
}
async function handleListarClasses(chatId) {
    let mensagem = "--- ⚔️ Classes de Arcádia ⚔️ ---\n\n";
    CLASSES_ARCADIA.forEach(classe => { mensagem += `*${classe.nome}* - ${classe.desc}\n`; });
    await enviarMensagemTextoWhapi(chatId, mensagem + "\nUse estes nomes ao criar personagem.");
}
async function handleListarReinos(chatId) {
    let mensagem = "--- 🏰 Reinos de Arcádia 🏰 ---\n\n";
    REINOS_ARCADIA.forEach(reino => { mensagem += `*${reino.nome}* - ${reino.desc}\n\n`; });
    await enviarMensagemTextoWhapi(chatId, mensagem + "Use estes nomes como Reino de Origem.");
}

async function handleComandosArcadia(chatId, senderIsOwner) {
    let resposta = "📜 --- Comandos de Arcádia --- 📜\n\n";
    resposta += "`!arcadia` ou `!bemvindo`\n";
    resposta += "`!ping`\n";
    resposta += "`!criar <nome>;<raça>;<classe>;<reino>`\n";
    resposta += "`!ficha`\n";
    resposta += "`!distribuirpontos <atr1> <qtd1> [<atr2> <qtd2> ...]`\n   (Ex: `!distribuirpontos forca 5 agilidade 3`)\n";
    resposta += "`!jackpot [numero_de_giros]`\n   (Ex: `!jackpot 3`)\n";
    resposta += "`!usar <nome do item> [quantidade]`\n   (Ex: `!usar Poção de Cura Menor 2`)\n";
    resposta += "\n--- Informativos ---\n";
    resposta += "`!listaracas`, `!listaclasses`, `!listareinos`\n";
    if (senderIsOwner) {
        resposta += "\n--- Comandos de Admin ---\n";
        resposta += "`!ficha <ID_ALVO>`\n";
        resposta += "`!admincriar <ID_ALVO>;<nome>;<raça>;<classe>;<reino>`\n";
        resposta += "`!adminaddxp <ID_ALVO> <valor>`\n`!adminsetnivel <ID_ALVO> <nível>`\n";
        resposta += "`!adminaddflorins <ID_ALVO> <valor>`\n`!adminaddessencia <ID_ALVO> <valor>`\n";
        resposta += "`!adminadditem <ID_ALVO> <item>[;qtd;tipo;desc]\n";
        resposta += "`!admindelitem <ID_ALVO> <item>[;qtd]`\n";
        resposta += "`!adminsetattr <ID_ALVO> <atr> <valor>`\n"; 
        resposta += "`!adminaddpontosattr <ID_ALVO> <qtd>`\n";
    }
    resposta += "\n`!comandos` ou `!help` - Mostra esta lista.\n";
    await enviarMensagemTextoWhapi(chatId, resposta);
}

async function enviarMensagemTextoWhapi(para, mensagem) {
    if (!WHAPI_API_TOKEN) { console.error("Token Whapi não configurado."); return; }
    const endpoint = "/messages/text";
    const urlDeEnvio = `${WHAPI_BASE_URL}${endpoint}`;
    const payload = { "to": para, "body": mensagem };
    const headers = { 'Authorization': `Bearer ${WHAPI_API_TOKEN}`, 'Content-Type': 'application/json', 'Accept': 'application/json' };
    try { await axios.post(urlDeEnvio, payload, { headers: headers }); }
    catch (error) {
        console.error('Erro Whapi:', error.response ? `${error.response.status} ${JSON.stringify(error.response.data)}` : error.message);
    }
}

// --- ROTA DE WEBHOOK ---
app.post('/webhook/whatsapp', async (req, res) => {
    console.log('------------------ WHAPI WEBHOOK ------------------');
    try {
        if (req.body.messages && Array.isArray(req.body.messages) && req.body.messages.length > 0) {
            for (const messageData of req.body.messages) {
                const fromMe = messageData.from_me;
                const chatId = messageData.chat_id;
                const senderRaw = messageData.from;
                const senderName = messageData.from_name || (senderRaw ? String(senderRaw).split('@')[0] : 'Desconhecido');
                let textContent = "";
                if (messageData.type === 'text' && messageData.text && typeof messageData.text.body === 'string') {
                    textContent = messageData.text.body.trim();
                } else if (messageData.caption && typeof messageData.caption === 'string') {
                    textContent = messageData.caption.trim();
                }

                if (fromMe === true) { console.log(`[Webhook] Mensagem própria ignorada (${chatId}).`); continue; }
                if (!chatId || !senderRaw) { console.warn("[Webhook] Msg sem chat_id/sender:", messageData); continue; }

                const sender = String(senderRaw).trim();
                const ownerIdVerificado = OWNER_ID;
                let isOwner = (ownerIdVerificado && sender === ownerIdVerificado);
                let isJogadorPermitido = listaJogadoresPermitidos.has(sender);

                if (!isOwner && !isJogadorPermitido && JOGADORES_PERMITIDOS_IDS_STRING !== "") { 
                    console.log(`[Webhook] Usuário ${senderName} (${sender}) não permitido. Ignorado.`);
                    continue; 
                }

                if (textContent && textContent.startsWith('!')) {
                    const args = textContent.slice(1).trim().split(/ +/g);
                    const comando = args.shift().toLowerCase();
                    
                    let preLog = isOwner ? "[Proprietário]" : (isJogadorPermitido ? "[Jogador Permitido]" : (JOGADORES_PERMITIDOS_IDS_STRING === "" ? "[Qualquer Jogador]" : "[NÃO AUTORIZADO]"));
                    console.log(`[Webhook] ${preLog} CMD: '!${comando}' | Args: [${args.join(', ')}] | De: ${senderName} (${sender})`);
                    
                    if (comando === 'ping') { await enviarMensagemTextoWhapi(chatId, `Pong de Arcádia! Olá, ${senderName}!`); }
                    else if (comando === 'arcadia' || comando === 'bemvindo') { await handleBoasVindasArcadia(chatId, senderName); }
                    else if (comando === 'listaracas') { await handleListarRacas(chatId); }
                    else if (comando === 'listaclasses') { await handleListarClasses(chatId); }
                    else if (comando === 'listareinos') { await handleListarReinos(chatId); }
                    else if (comando === 'criar') { await handleCriarFichaArcadia(chatId, sender, senderName, args); }
                    else if (comando === 'ficha' || comando === 'minhaficha' || comando === 'verficha') {
                        if (isOwner && args.length > 0 && comando !== 'minhaficha') { await handleVerFichaArcadia(chatId, sender, args); }
                        else { await handleVerFichaArcadia(chatId, sender, []); }
                    } 
                    else if (comando === 'distribuirpontos') { await handleDistribuirPontos(chatId, sender, args); }
                    else if (comando === 'jackpot') { await handleJackpotArcadia(chatId, sender, args); }
                    else if (comando === 'usar' || comando === 'usaritem') { await handleUsarItem(chatId, sender, args); }
                    else if ((comando === 'comandos' || comando === 'help')) { await handleComandosArcadia(chatId, isOwner); }
                    else if (isOwner) {
                        switch (comando) {
                            case 'admincriar': await handleAdminCriarFichaArcadia(chatId, sender, args); break;
                            case 'adminaddxp': await handleAdminComandoFichaArcadia(chatId, args, 'addxp', modificarXPArcadia, `XP atualizado.`, "Uso: `!adminaddxp <ID> <valor>`"); break;
                            case 'adminsetnivel': await handleAdminComandoFichaArcadia(chatId, args, 'setnivel', modificarNivelArcadia, `Nível atualizado.`, "Uso: `!adminsetnivel <ID> <nível>`"); break;
                            case 'adminaddflorins': await handleAdminComandoFichaArcadia(chatId, args, 'addflorins', modificarFlorins, `Florins atualizados.`, "Uso: `!adminaddflorins <ID> <valor>`"); break;
                            case 'adminaddessencia': await handleAdminComandoFichaArcadia(chatId, args, 'addessencia', modificarEssencia, `Essência atualizada.`, "Uso: `!adminaddessencia <ID> <valor>`"); break;
                            case 'adminadditem': await handleAdminComandoFichaArcadia(chatId, args, 'additem', modificarAddItemArcadia, `Inventário atualizado.`, "Uso: `!adminadditem <ID> <item>[;qtd;tipo;desc]`"); break;
                            case 'admindelitem': await handleAdminComandoFichaArcadia(chatId, args, 'delitem', modificarDelItemArcadia, `Inventário atualizado.`, "Uso: `!admindelitem <ID> <item>[;qtd]`"); break;
                            case 'adminsetattr': await handleAdminSetAtributoArcadia(chatId, args); break;
                            case 'adminaddpontosattr': await handleAdminAddPontosAtributoArcadia(chatId, args); break;
                            case 'addxp': await handleAddXPArcadia(chatId, sender, args); break;
                            case 'setnivel': await handleSetNivelArcadia(chatId, sender, args); break;
                            case 'addflorins': await handleAddFlorins(chatId, sender, args); break;
                            case 'addessencia': await handleAddEssencia(chatId, sender, args); break;
                            case 'additem': await handleAddItemArcadia(chatId, sender, args); break;
                            case 'delitem': await handleDelItemArcadia(chatId, sender, args); break;
                            default: await enviarMensagemTextoWhapi(chatId, `Comando Admin "!${comando}" não reconhecido.`); break;
                        }
                    } else { 
                        if (JOGADORES_PERMITIDOS_IDS_STRING !== "" || 
                           (JOGADORES_PERMITIDOS_IDS_STRING === "" && 
                               (comando !== 'ping' && comando !== 'arcadia' && comando !== 'bemvindo' &&
                                comando !== 'listaracas' && comando !== 'listaclasses' && comando !== 'listareinos' &&
                                comando !== 'criar' && comando !== 'ficha' && comando !== 'minhaficha' && comando !== 'verficha' &&
                                comando !== 'distribuirpontos' && comando !== 'jackpot' && 
                                comando !== 'usar' && comando !== 'usaritem' && 
                                comando !== 'comandos' && comando !== 'help'))) {
                            await enviarMensagemTextoWhapi(chatId, `Comando "!${comando}" não reconhecido ou não permitido, ${senderName}.`);
                        }
                    }
                } else if (textContent) { /* ... log de texto normal ... */ }
            } 
        } else { console.log("[Webhook] Estrutura inesperada:", req.body); }
    } catch (error) {
        console.error("Erro CRÍTICO no webhook:", error.message, error.stack);
    }
    res.status(200).send('OK');
});

// --- ROTA DE TESTE E INICIALIZAÇÃO DO SERVIDOR ---
app.get('/', (req, res) => {
    res.send('Servidor do Bot de RPG Arcádia (Whapi no Render com MongoDB) está operacional!');
});

async function iniciarServidor() {
    await conectarMongoDB();
    await carregarFichasDoDB(); 
    app.listen(PORT, () => {
        console.log("****************************************************");
        console.log("*** INICIANDO SERVIDOR DO BOT DE RPG ARCÁDIA - WHAPI ***");
        console.log(`*** Data/Hora Início: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} ***`);
        console.log("****************************************************");
        const publicUrl = process.env.RENDER_EXTERNAL_URL;
        console.log(`Servidor escutando na porta ${PORT}`);
        if (publicUrl) { console.log(`Webhook URL para Whapi.Cloud: ${publicUrl}/webhook/whatsapp`); }
        else { console.log(`Webhook local: http://localhost:${PORT}/webhook/whatsapp`); }
        console.log(`Conectado ao DB: ${MONGODB_DB_NAME}, Coleção: ${MONGODB_FICHAS_COLLECTION}`);
        if (OWNER_ID) { console.log(`>>> PROPRIETÁRIO DO BOT: ${OWNER_ID} <<<`); }
        else { console.warn(">>> ALERTA: OWNER_ID não definido! Comandos admin não funcionarão. <<<"); }
        if (JOGADORES_PERMITIDOS_IDS_STRING && listaJogadoresPermitidos.size > 0) {
            console.log(`>>> Jogadores Permitidos: ${Array.from(listaJogadoresPermitidos).join(', ')} <<<`);
        } else if (JOGADORES_PERMITIDOS_IDS_STRING) { 
            console.log(">>> JOGADORES_PERMITIDOS_IDS definido mas vazio. Apenas OWNER (se definido) terá acesso a comandos restritos. <<<");
        } else { 
            console.log(">>> JOGADORES_PERMITIDOS_IDS não definido/vazio. Comandos de jogador abertos. Admin restrito ao OWNER (se definido). <<<");
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

async function desligamentoGracioso(signal) {
    console.log(`${signal} recebido. Desligando o bot...`);
    if (dbClient) {
        try { await dbClient.close(); console.log("Conexão MongoDB fechada."); }
        catch (err) { console.error("Erro ao fechar conexão MongoDB:", err); }
    }
    process.exit(0);
}
process.on('SIGTERM', () => desligamentoGracioso('SIGTERM'));
process.on('SIGINT', () => desligamentoGracioso('SIGINT'));

