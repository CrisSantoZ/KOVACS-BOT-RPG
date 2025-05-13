// Nome do arquivo: bot_baileys.js
// RPG: Arc�dia - A Era dos Reinos

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');

// --- CONFIGURA��O DE AMBIENTE E IDs ---
const OWNER_ID = process.env.OWNER_ID ? process.env.OWNER_ID.trim() : "";
const JOGADORES_PERMITIDOS_IDS_STRING = process.env.JOGADORES_PERMITIDOS_IDS || "";
const listaJogadoresPermitidos = new Set(
    JOGADORES_PERMITIDOS_IDS_STRING.split(',')
        .map(id => String(id).trim()) 
        .filter(id => id && /^\d+$/.test(id)) 
);

// --- CONSTANTES DE ARC�DIA (PARA OS COMANDOS DE LISTAGEM) ---
const RACAS_ARCADIA = [
    { nome: "Eldari", grupo: "Puros", desc: "Elfos nobres com dom�nio natural da magia arcana. Vivem em florestas encantadas." },
    { nome: "Valtheran", grupo: "Puros", desc: "An�es de montanhas profundas, ex�mios forjadores e guerreiros." },
    { nome: "Seraphim", grupo: "Puros", desc: "Ra�a alada de apar�ncia angelical, guardi�es antigos de templos m�gicos." },
    { nome: "Terrano", grupo: "Humanos", desc: "Humanos comuns, adapt�veis e vers�teis." },
    { nome: "Vharen", grupo: "Humanos", desc: "Humanos com sangue de antigos magos, sens�veis � magia." },
    { nome: "Drakyn", grupo: "Humanos", desc: "Humanos com linhagem de drag�es, com habilidades f�sicas e m�gicas elevadas." },
    { nome: "Mei'ra", grupo: "Mistos", desc: "Meio-elfos, diplom�ticos e ligados � natureza." },
    { nome: "Thornak", grupo: "Mistos", desc: "Meio-orcs, fortes e leais, muitas vezes ca�ados por seu sangue misto." },
    { nome: "Lunari", grupo: "Mistos", desc: "Descendentes de humanos e Seraphim, possuem magia ligada � lua e sonhos." }
];

const CLASSES_ARCADIA = [
    { nome: "Arcanista", desc: "Mestre da magia pura." },
    { nome: "Guerreiro Real", desc: "Lutador disciplinado com honra e estrat�gia." },
    { nome: "Feiticeiro Negro", desc: "Usu�rio de magias proibidas." },
    { nome: "Ca�ador Sombrio", desc: "Perito em rastrear criaturas e inimigos." },
    { nome: "Guardi�o da Luz", desc: "Defensor divino com escudo e feiti�os sagrados." },
    { nome: "Mestre das Bestas", desc: "Controla criaturas m�gicas e animais." },
    { nome: "Bardo Arcano", desc: "Usa m�sica e magia para manipular emo��es." },
    { nome: "Alquimista", desc: "Cria bombas, po��es e venenos �nicos." },
    { nome: "Cl�rigo da Ordem", desc: "Cura aliados e invoca milagres." },
    { nome: "Andarilho R�nico", desc: "Usa runas ancestrais como armas m�gicas." },
    { nome: "Espadachim Et�reo", desc: "Guerreiro veloz que une magia e espada." },
    { nome: "Invasor Drac�nico", desc: "Classe h�brida com tra�os de drag�o." },
    { nome: "L�mina da N�voa", desc: "Assassino furtivo, mestre em ilus�es." },
    { nome: "Conjurador do Vazio", desc: "Controla magias interdimensionais." }
];

const REINOS_ARCADIA = [
    { nome: "Valdoria", desc: "Reino dos humanos. Castelo real, vilarejos e campos f�rteis." },
    { nome: "Elarion", desc: "Floresta encantada dos elfos Eldari, lar de magia antiga." },
    { nome: "Durnholde", desc: "Reino montanhoso dos an�es Valtherans." },
    { nome: "Caelum", desc: "Cidade flutuante dos Seraphim, isolada do resto do mundo." },
    { nome: "Ravengard", desc: "Terras sombrias, dom�nio dos Sombrios e impuros." },
    { nome: "Thornmere", desc: "Territ�rio livre, habitado por Mistos e refugiados." },
    { nome: "Isle of Morwyn", desc: "Ilha m�gica proibida, ber�o de segredos antigos." }
];

// --- MODELO DA FICHA DE PERSONAGEM - ARC�DIA ---
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
        { itemNome: "Adaga Simples", quantidade: 1, tipo: "Arma Leve", descricao: "Uma adaga b�sica de bronze." },
        { itemNome: "Ra��es de Viagem", quantidade: 3, tipo: "Consum�vel", descricao: "Suficiente para 3 dias." }
    ],
    historiaPersonagem: "", idiomas: ["Comum Arc�diano"], 
    condicoes: [], 
    ultimaAtualizacao: "", logMissoes: [], notacoesDM: "" 
};

// --- CONFIGURA��O DO MONGODB ---
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'arcadia_rpg_db'; 
const MONGODB_FICHAS_COLLECTION = process.env.MONGODB_FICHAS_COLLECTION || 'fichas_arcadia'; 

if (!MONGODB_URI) { console.error("--- ERRO FATAL: MONGODB_URI n�o definida! ---"); process.exit(1); }
if (!OWNER_ID) { console.warn("--- ALERTA: OWNER_ID n�o definida! ---"); }
if (JOGADORES_PERMITIDOS_IDS_STRING) { console.log("Jogadores permitidos carregados:", Array.from(listaJogadoresPermitidos)); } 
else { console.log("Nenhum jogador adicional permitido."); }

let dbClient;
let fichasCollection;
let todasAsFichas = {};

// --- FUN��ES DE BANCO DE DADOS E AUXILIARES ---
async function conectarMongoDB() {
    try {
        console.log("Tentando conectar ao MongoDB Atlas...");
        dbClient = new MongoClient(MONGODB_URI);
        await dbClient.connect();
        const db = dbClient.db(MONGODB_DB_NAME);
        fichasCollection = db.collection(MONGODB_FICHAS_COLLECTION);
        console.log("Conectado com sucesso ao MongoDB Atlas e � cole��o:", MONGODB_FICHAS_COLLECTION);
    } catch (error) {
        console.error("ERRO CR�TICO ao conectar ao MongoDB:", error);
        process.exit(1);
    }
}

async function carregarFichasDoDB() {
    if (!fichasCollection) {
        console.error("Cole��o de fichas n�o inicializada. Carregamento abortado.");
        return;
    }
    console.log("Carregando fichas do MongoDB para a mem�ria...");
    try {
        const fichasDoDB = await fichasCollection.find({}).toArray();
        todasAsFichas = {};
        fichasDoDB.forEach(fichaDB => {
            const idJogador = String(fichaDB._id).trim();
            todasAsFichas[idJogador] = { ...fichaDB };
        });
        console.log(`${Object.keys(todasAsFichas).length} fichas carregadas do DB para a mem�ria.`);
    } catch (error) {
        console.error("Erro ao carregar fichas do MongoDB:", error);
    }
}

async function salvarFichaNoDB(idJogador, fichaData) {
    if (!fichasCollection) {
        console.error("Cole��o de fichas n�o inicializada. Salvamento abortado para jogador:", idJogador);
        return;
    }
    const idJogadorStr = String(idJogador).trim();
    console.log(`Salvando/Atualizando ficha para jogador ${idJogadorStr} no MongoDB...`);
    try {
        const fichaParaSalvar = { ...fichaData };
        await fichasCollection.updateOne(
            { _id: idJogadorStr },
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
        console.log(`Ficha para ${idAlvoTrimmado} n�o encontrada no cache, buscando no DB...`);
        try {
            const fichaDB = await fichasCollection.findOne({ _id: idAlvoTrimmado });
            if (fichaDB) {
                if (!fichaDB.atributos) fichaDB.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
                fichaDB.pvMax = (fichaDB.atributos.vitalidade * 5) + (fichaDB.nivel * 5) + 20;
                fichaDB.pmMax = (fichaDB.atributos.manaBase * 5) + (fichaDB.nivel * 3) + 10; 
                
                todasAsFichas[idAlvoTrimmado] = { ...fichaDB };
                ficha = todasAsFichas[idAlvoTrimmado];
                console.log(`Ficha para ${idAlvoTrimmado} carregada do DB para o cache.`);
            }
        } catch (dbError) {
            console.error(`Erro ao buscar ficha ${idAlvoTrimmado} no DB:`, dbError);
        }
    } else if (ficha) { 
        if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
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
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return match; 
            }
        }
        return value !== undefined ? value : match;
    });
    await enviarMensagemTextoWhapi(chatId, msgFinal);
}

function calcularXpProximoNivel(nivelAtual) {
    return nivelAtual * 100 + 50;
}

// --- CONFIGURA��O DO SERVIDOR EXPRESS ---
const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const WHAPI_API_TOKEN = process.env.WHAPI_API_TOKEN;
const WHAPI_BASE_URL = "https://gate.whapi.cloud";

if (!WHAPI_API_TOKEN) {
    console.error("FATAL_ERROR: Vari�vel de ambiente WHAPI_API_TOKEN n�o definida!");
}

// --- FUN��ES DE COMANDO DO RPG - ARC�DIA ---

async function handleCriarFichaArcadia(chatId, sender, senderName, args) {
    const idJogador = sender;
    if (todasAsFichas[idJogador]) {
        await enviarMensagemTextoWhapi(chatId, `Voc� j� possui um personagem em Arc�dia: ${todasAsFichas[idJogador].nomePersonagem}. Por enquanto, apenas um personagem por jogador.`);
        return;
    }
    const dadosComando = args.join(' ');
    const partes = dadosComando.split(';').map(p => p.trim());
    if (partes.length < 4) {
        await enviarMensagemTextoWhapi(chatId, "Formato incorreto! Uso: `!criar <Nome Personagem>;<Ra�a>;<Classe>;<Reino Origem>`\nUse `!listaracas`, `!listaclasses`, `!listareinos` para ver as op��es.");
        return;
    }
    const nomePersonagemInput = partes[0];
    const racaInput = partes[1];
    const classeInput = partes[2];
    const origemReinoInput = partes[3];

    const racaValida = RACAS_ARCADIA.find(r => r.nome.toLowerCase() === racaInput.toLowerCase());
    const classeValida = CLASSES_ARCADIA.find(c => c.nome.toLowerCase() === classeInput.toLowerCase());
    const reinoValido = REINOS_ARCADIA.find(reino => reino.nome.toLowerCase() === origemReinoInput.toLowerCase());

    if (!racaValida) {
        await enviarMensagemTextoWhapi(chatId, `Ra�a "${racaInput}" inv�lida. Use \`!listaracas\` para ver as op��es.`);
        return;
    }
    if (!classeValida) {
        await enviarMensagemTextoWhapi(chatId, `Classe "${classeInput}" inv�lida. Use \`!listaclasses\` para ver as op��es.`);
        return;
    }
     if (!reinoValido) {
        await enviarMensagemTextoWhapi(chatId, `Reino de Origem "${origemReinoInput}" inv�lido. Use \`!listareinos\` para ver as op��es.`);
        return;
    }

    let novaFicha = JSON.parse(JSON.stringify(fichaModeloArcadia));
    novaFicha.nomeJogadorSalvo = senderName;
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.raca = racaValida.nome;
    novaFicha.classe = classeValida.nome; 
    novaFicha.origemReino = reinoValido.nome; 
    
    if (!novaFicha.atributos) novaFicha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    novaFicha.pvMax = (novaFicha.atributos.vitalidade * 5) + (novaFicha.nivel * 5) + 20;
    novaFicha.pvAtual = novaFicha.pvMax;
    novaFicha.pmMax = (novaFicha.atributos.manaBase * 5) + (novaFicha.nivel * 3) + 10;
    novaFicha.pmAtual = novaFicha.pmMax;
    novaFicha.xpProximoNivel = calcularXpProximoNivel(novaFicha.nivel);
    await atualizarFichaETransmitir(chatId, idJogador, novaFicha, `?? Personagem ${nomePersonagemInput} (${novaFicha.raca} ${novaFicha.classe} de ${novaFicha.origemReino}) criado para Arc�dia!\nUse \`!distribuirpontos <atributo> <valor>\` para usar seus ${novaFicha.atributos.pontosParaDistribuir} pontos iniciais.\nUse \`!ficha\` para ver os detalhes.`);
}

async function handleAdminCriarFichaArcadia(chatId, senderOwner, argsAdmin) {
    const comandoCompleto = argsAdmin.join(" ");
    const partesPrincipais = comandoCompleto.split(';');
    if (partesPrincipais.length < 5) { 
        await enviarMensagemTextoWhapi(chatId, "Formato incorreto! Uso: `!admincriar <ID_ALVO>;<Nome Personagem>;<Ra�a>;<Classe>;<ReinoOrigem>`\nID_ALVO � s� o n�mero (ex: 5577...). Use `!listaracas`, etc. para op��es.");
        return;
    }

    const idJogadorAlvo = partesPrincipais[0].trim();
    const nomePersonagemInput = partesPrincipais[1].trim();
    const racaInput = partesPrincipais[2].trim();
    const classeInput = partesPrincipais[3].trim();
    const origemReinoInput = partesPrincipais[4].trim();

    if (!/^\d+$/.test(idJogadorAlvo)) {
        await enviarMensagemTextoWhapi(chatId, `ID do Jogador Alvo (${idJogadorAlvo}) inv�lido. Deve conter apenas n�meros.`);
        return;
    }
    
    const racaValida = RACAS_ARCADIA.find(r => r.nome.toLowerCase() === racaInput.toLowerCase());
    const classeValida = CLASSES_ARCADIA.find(c => c.nome.toLowerCase() === classeInput.toLowerCase());
    const reinoValido = REINOS_ARCADIA.find(reino => reino.nome.toLowerCase() === origemReinoInput.toLowerCase());

    if (!racaValida) {
        await enviarMensagemTextoWhapi(chatId, `Ra�a "${racaInput}" inv�lida para o ID ${idJogadorAlvo}. Use \`!listaracas\` para ver as op��es.`);
        return;
    }
    if (!classeValida) {
        await enviarMensagemTextoWhapi(chatId, `Classe "${classeInput}" inv�lida para o ID ${idJogadorAlvo}. Use \`!listaclasses\` para ver as op��es.`);
        return;
    }
    if (!reinoValido) {
        await enviarMensagemTextoWhapi(chatId, `Reino de Origem "${origemReinoInput}" inv�lido para o ID ${idJogadorAlvo}. Use \`!listareinos\` para ver as op��es.`);
        return;
    }
    
    let novaFicha = JSON.parse(JSON.stringify(fichaModeloArcadia));
    novaFicha.nomeJogadorSalvo = `(Admin) ${idJogadorAlvo}`; 
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.raca = racaValida.nome; 
    novaFicha.classe = classeValida.nome; 
    novaFicha.origemReino = reinoValido.nome; 

    if (!novaFicha.atributos) novaFicha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    novaFicha.pvMax = (novaFicha.atributos.vitalidade * 5) + (novaFicha.nivel * 5) + 20;
    novaFicha.pvAtual = novaFicha.pvMax;
    novaFicha.pmMax = (novaFicha.atributos.manaBase * 5) + (novaFicha.nivel * 3) + 10;
    novaFicha.pmAtual = novaFicha.pmMax;
    novaFicha.xpProximoNivel = calcularXpProximoNivel(novaFicha.nivel);
    
    todasAsFichas[idJogadorAlvo] = novaFicha;
    await atualizarFichaETransmitir(chatId, idJogadorAlvo, novaFicha, `?? [Admin] Personagem ${nomePersonagemInput} (${novaFicha.raca} ${novaFicha.classe}) CRIADO/ATUALIZADO para o ID ${idJogadorAlvo}.`);
}

async function handleVerFichaArcadia(chatId, sender, args) {
    let idAlvoConsulta = sender;
    let adminConsultandoOutro = false;
    
    if (args.length > 0 && sender === OWNER_ID) { 
        const idPotencial = String(args[0]).trim();
        if (/^\d+$/.test(idPotencial)) { 
            idAlvoConsulta = idPotencial;
            adminConsultandoOutro = true;
            console.log(`[Admin] ${sender} est� consultando a ficha do ID_ALVO: ${idAlvoConsulta}`);
        } else {
            await enviarMensagemTextoWhapi(chatId, "ID do jogador alvo inv�lido para `!ficha`. Forne�a apenas n�meros.");
            return;
        }
    }
    
    const ficha = await getFichaOuCarregar(idAlvoConsulta);
    if (!ficha) {
        const msgErro = adminConsultandoOutro 
            ? `? Ficha n�o encontrada para o ID ${idAlvoConsulta} em Arc�dia.\nUse \`!admincriar\` para criar uma.`
            : "? Voc� ainda n�o tem um personagem em Arc�dia. Use o comando `!criar` para criar um.";
        await enviarMensagemTextoWhapi(chatId, msgErro);
        return;
    }

    let resposta = `?? --- Ficha de Arc�dia: ${ficha.nomePersonagem || 'Personagem Sem Nome'} (@${idAlvoConsulta}) --- ??\n`;
    if (ficha.nomeJogadorSalvo) resposta += `?? Jogador: ${ficha.nomeJogadorSalvo}\n`;
    resposta += `Ra�a: ${ficha.raca || 'N/A'} | Classe: ${ficha.classe || 'N/A'}\n`;
    resposta += `Origem: ${ficha.origemReino || 'N/A'}\n`;
    resposta += `Lvl: ${ficha.nivel || 1} (XP: ${ficha.xpAtual || 0}/${ficha.xpProximoNivel || calcularXpProximoNivel(ficha.nivel || 1)})\n`;
    resposta += `HP: ${ficha.pvAtual || 0}/${ficha.pvMax || 0}\n`;
    resposta += `MP: ${ficha.pmAtual || 0}/${ficha.pmMax || 0}\n`;
    resposta += `Florins: ${ficha.florinsDeOuro || 0} FO | Ess�ncia: ${ficha.essenciaDeArcadia || 0} EA\n`;

    resposta += "\n?? Atributos:\n";
    if (ficha.atributos) {
        for (const [attr, valor] of Object.entries(ficha.atributos)) {
            const nomeAttrCapitalized = attr.charAt(0).toUpperCase() + attr.slice(1);
            if (attr !== "pontosParaDistribuir") {
                resposta += `  ? ${nomeAttrCapitalized}: ${valor || 0}\n`;
            }
        }
        if ((ficha.atributos.pontosParaDistribuir || 0) > 0) {
            const msgPontos = adminConsultandoOutro ? "O jogador tem" : "Voc� tem";
            const cmdDistribuir = adminConsultandoOutro ? "" : " (`!distribuirpontos`)";
            resposta += `  ? ${msgPontos} ${ficha.atributos.pontosParaDistribuir} pontos para distribuir${cmdDistribuir}.\n`;
        }
    } else {
        resposta += "  (Atributos n�o definidos)\n";
    }
    
    resposta += "\n?? Habilidades Especiais / Per�cias:\n";
    let habilidadesTexto = "";
    if (ficha.habilidadesEspeciais && ficha.habilidadesEspeciais.length > 0) {
        ficha.habilidadesEspeciais.forEach(h => habilidadesTexto += `  ? ${h.nome} (${h.tipo || 'Habilidade'}): ${h.descricao || ''}\n`);
    }
    if (ficha.pericias && ficha.pericias.length > 0) {
        ficha.pericias.forEach(p => habilidadesTexto += `  ? Per�cia em ${p.nome}: ${p.valor}\n`);
    }
    resposta += habilidadesTexto || "  (Nenhuma listada)\n";

    resposta += "\n?? Magias Conhecidas:\n";
    if (ficha.magiasConhecidas && ficha.magiasConhecidas.length > 0) {
        ficha.magiasConhecidas.forEach(m => resposta += `  ? ${m.nome} (Custo: ${m.custoMana || 'N/A'} PM): ${m.descricao || ''}\n`);
    } else {
        resposta += "  (Nenhuma magia conhecida)\n";
    }

    resposta += "\n?? Invent�rio:\n";
    if (ficha.inventario && ficha.inventario.length > 0) {
        ficha.inventario.forEach(i => {
            resposta += `  ? ${i.itemNome} (Qtd: ${i.quantidade || 1}) ${i.tipo ? '['+i.tipo+']' : ''} ${i.descricao ? '- ' + i.descricao : ''}\n`;
        });
    } else {
        resposta += "  (Vazio)\n";
    }
    
    resposta += "\n?? Equipamento:\n";
    let temEquip = false;
    if (ficha.equipamento) {
        for(const slot in ficha.equipamento) {
            if (ficha.equipamento[slot]) {
                const nomeSlot = slot.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                resposta += `  ? ${nomeSlot}: ${typeof ficha.equipamento[slot] === 'object' ? ficha.equipamento[slot].itemNome : ficha.equipamento[slot]}\n`;
                temEquip = true;
            }
        }
    }
    if (!temEquip) {
        resposta += "  (Nenhum item equipado)\n";
    }
    
    resposta += `\n?? �ltima atualiza��o: ${ficha.ultimaAtualizacao || 'N/A'}\n`;
    await enviarMensagemTextoWhapi(chatId, resposta);
}

async function handleAddXPArcadia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) {
        await enviarMensagemTextoWhapi(chatId, "Sua ficha de Arc�dia n�o foi encontrada. Crie uma com `!criar`.");
        return;
    }
    if (args.length === 0 || isNaN(parseInt(args[0]))) {
        await enviarMensagemTextoWhapi(chatId, "Uso: `!addxp <valor_numerico>`.\nExemplo: `!addxp 50` ou `!addxp -10`");
        return;
    }
    const valorXP = parseInt(args[0]);
    ficha.xpAtual = (ficha.xpAtual || 0) + valorXP;

    let mensagensLevelUp = [];
    let subiuDeNivel = false;
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    while (ficha.xpAtual >= ficha.xpProximoNivel) {
        subiuDeNivel = true;
        ficha.xpAtual -= ficha.xpProximoNivel;
        ficha.nivel = (ficha.nivel || 0) + 1;
        
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + 2;
        const pvGanho = Math.floor((ficha.atributos.vitalidade || 5) / 2) + 5;
        const pmGanho = Math.floor((ficha.atributos.manaBase || 5) / 2) + 3;
        const pvMaxAnterior = ficha.pvMax || ((ficha.atributos.vitalidade * 5) + ((ficha.nivel-1) * 5) + 20);
        const pmMaxAnterior = ficha.pmMax || ((ficha.atributos.manaBase * 5) + ((ficha.nivel-1) * 3) + 10);
        ficha.pvMax = pvMaxAnterior + pvGanho;
        ficha.pmMax = pmMaxAnterior + pmGanho;
        ficha.pvAtual = ficha.pvMax; 
        ficha.pmAtual = ficha.pmMax;

        mensagensLevelUp.push(`?? PARAB�NS! Voc� alcan�ou o N�vel ${ficha.nivel} em Arc�dia! Ganhou ${pvGanho} PV, ${pmGanho} PM e 2 pontos de atributo!`);
        ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    }

    let mensagemFinal = `XP atualizado para ${ficha.xpAtual}/${ficha.xpProximoNivel}.`;
    if (subiuDeNivel) {
        mensagemFinal = mensagensLevelUp.join("\n") + "\n" + mensagemFinal;
    }
    
    await atualizarFichaETransmitir(chatId, sender, ficha, mensagemFinal);
}

async function handleSetNivelArcadia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { await enviarMensagemTextoWhapi(chatId, "Sua ficha de Arc�dia n�o foi encontrada."); return; }
    if (args.length === 0 || isNaN(parseInt(args[0])) || parseInt(args[0]) < 1) { await enviarMensagemTextoWhapi(chatId, "Uso: `!setnivel <novo_nivel_numerico_maior_que_0>`.\nExemplo: `!setnivel 3`"); return; }
    const novoNivel = parseInt(args[0]); 
    const nivelAntigo = ficha.nivel || 1;
    
    ficha.nivel = novoNivel; 
    ficha.xpAtual = 0;
    ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);

    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    const diffNivel = novoNivel - nivelAntigo;
    if (diffNivel > 0) { 
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + (diffNivel * 2);
    }
    await atualizarFichaETransmitir(chatId, sender, ficha, `N�vel atualizado para ${ficha.nivel}. XP zerado. Pr�ximo n�vel: ${ficha.xpProximoNivel} XP. Pontos p/ distribuir: ${ficha.atributos.pontosParaDistribuir || 0}.`);
}

async function handleAddFlorins(chatId, sender, args) { 
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { await enviarMensagemTextoWhapi(chatId, "Sua ficha de Arc�dia n�o foi encontrada."); return; }
    if (args.length === 0 || isNaN(parseInt(args[0]))) { await enviarMensagemTextoWhapi(chatId, "Uso: `!addflorins <valor_numerico>`.\nExemplo: `!addflorins 100` ou `!addflorins -20`"); return; }
    const valorFlorins = parseInt(args[0]);
    ficha.florinsDeOuro = (ficha.florinsDeOuro || 0) + valorFlorins;
    if (ficha.florinsDeOuro < 0) ficha.florinsDeOuro = 0;
    await atualizarFichaETransmitir(chatId, sender, ficha, `Florins de Ouro atualizados! Voc� agora tem ${ficha.florinsDeOuro} FO.`);
}

async function handleAddEssencia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { await enviarMensagemTextoWhapi(chatId, "Sua ficha de Arc�dia n�o foi encontrada."); return; }
    if (args.length === 0 || isNaN(parseInt(args[0]))) { await enviarMensagemTextoWhapi(chatId, "Uso: `!addessencia <valor_numerico>`.\nExemplo: `!addessencia 10` ou `!addessencia -2`"); return; }
    const valorEssencia = parseInt(args[0]);
    ficha.essenciaDeArcadia = (ficha.essenciaDeArcadia || 0) + valorEssencia;
    if (ficha.essenciaDeArcadia < 0) ficha.essenciaDeArcadia = 0;
    await atualizarFichaETransmitir(chatId, sender, ficha, `Ess�ncia de Arc�dia atualizada! Voc� agora tem ${ficha.essenciaDeArcadia} EA.`);
}

async function handleAddItemArcadia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { await enviarMensagemTextoWhapi(chatId, "Sua ficha de Arc�dia n�o foi encontrada."); return; }
    const inputCompleto = args.join(" "); 
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) { await enviarMensagemTextoWhapi(chatId, "Uso: `!additem <nome do item>[;quantidade;tipo;descricao]`\nExemplo: `!additem Espada Longa;1;Arma M�dia;L�mina de a�o comum`"); return; }
    const nomeItem = partesItem[0]; 
    const quantidade = partesItem[1] ? parseInt(partesItem[1]) : 1;
    const tipoItem = partesItem[2] || "Item"; 
    const descricaoItem = partesItem[3] || "";
    if (isNaN(quantidade) || quantidade < 1) { await enviarMensagemTextoWhapi(chatId, "Quantidade inv�lida. Deve ser um n�mero maior que 0."); return; }
    if (!ficha.inventario) ficha.inventario = []; 
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemExistenteIndex > -1) {
        ficha.inventario[itemExistenteIndex].quantidade = (ficha.inventario[itemExistenteIndex].quantidade || 0) + quantidade;
        if (descricaoItem) ficha.inventario[itemExistenteIndex].descricao = descricaoItem;
        if (tipoItem !== "Item") ficha.inventario[itemExistenteIndex].tipo = tipoItem;
        await atualizarFichaETransmitir(chatId, sender, ficha, `Quantidade de "${nomeItem}" aumentada para ${ficha.inventario[itemExistenteIndex].quantidade}.`);
    } else {
        ficha.inventario.push({ itemNome: nomeItem, quantidade: quantidade, tipo: tipoItem, descricao: descricaoItem });
        await atualizarFichaETransmitir(chatId, sender, ficha, `"${nomeItem}" (x${quantidade}) adicionado ao seu invent�rio.`);
    }
}

async function handleDelItemArcadia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha || !ficha.inventario) { await enviarMensagemTextoWhapi(chatId, "Sua ficha ou invent�rio n�o foi encontrado."); return; }
    const inputCompleto = args.join(" "); 
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) { await enviarMensagemTextoWhapi(chatId, "Uso: `!delitem <nome do item>[;quantidade]`\nExemplo: `!delitem Adaga Simples;1`"); return; }
    const nomeItem = partesItem[0]; 
    const quantidadeRemover = partesItem[1] ? parseInt(partesItem[1]) : 1;
    if (isNaN(quantidadeRemover) || quantidadeRemover < 1) { await enviarMensagemTextoWhapi(chatId, "Quantidade a remover inv�lida. Deve ser um n�mero maior que 0."); return; }
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemExistenteIndex === -1) { await enviarMensagemTextoWhapi(chatId, `Item "${nomeItem}" n�o encontrado no seu invent�rio.`); return; }
    
    const nomeItemOriginal = ficha.inventario[itemExistenteIndex].itemNome;
    ficha.inventario[itemExistenteIndex].quantidade -= quantidadeRemover;
    if (ficha.inventario[itemExistenteIndex].quantidade <= 0) {
        ficha.inventario.splice(itemExistenteIndex, 1);
        await atualizarFichaETransmitir(chatId, sender, ficha, `"${nomeItemOriginal}" removido completamente do seu invent�rio.`);
    } else {
        await atualizarFichaETransmitir(chatId, sender, ficha, `${quantidadeRemover} unidade(s) de "${nomeItemOriginal}" removida(s). Restam ${ficha.inventario[itemExistenteIndex].quantidade}.`);
    }
}

async function handleAdminComandoFichaArcadia(chatId, args, tipoComando, callbackModificacao, mensagemSucessoPadrao, mensagemErroUso) {
    if (args.length < 2) { 
        await enviarMensagemTextoWhapi(chatId, mensagemErroUso);
        return;
    }
    const idAlvo = args[0].trim();
    if (!/^\d+$/.test(idAlvo)) {
        await enviarMensagemTextoWhapi(chatId, `ID do Jogador Alvo (${idAlvo}) inv�lido. Deve conter apenas n�meros.`);
        return;
    }
    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) {
        await enviarMensagemTextoWhapi(chatId, `Ficha n�o encontrada para o ID ${idAlvo} em Arc�dia. Use \`!admincriar\` primeiro.`);
        return;
    }
    
    let fichaModificada = JSON.parse(JSON.stringify(fichaAlvo));
    const resultadoCallback = callbackModificacao(fichaModificada, args.slice(1));

    if (typeof resultadoCallback === 'string' && resultadoCallback.startsWith("ERRO:")) {
        await enviarMensagemTextoWhapi(chatId, resultadoCallback.substring(5));
        return;
    }
    if (resultadoCallback === false ) {
         await enviarMensagemTextoWhapi(chatId, mensagemErroUso);
        return;
    }
    
    const mensagemSucessoFinal = (typeof resultadoCallback === 'string') ? resultadoCallback : mensagemSucessoPadrao;
    await atualizarFichaETransmitir(chatId, idAlvo, fichaModificada, mensagemSucessoFinal, fichaModificada.nomePersonagem || idAlvo);
}

function modificarXPArcadia(ficha, argsValor) {
    const valorXP = parseInt(argsValor[0]);
    if (isNaN(valorXP)) { return "ERRO: Valor de XP inv�lido.";  }
    ficha.xpAtual = (ficha.xpAtual || 0) + valorXP;
    let mensagensLevelUp = []; 
    let subiuDeNivelAdmin = false;
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    
    while (ficha.xpAtual >= ficha.xpProximoNivel) {
        subiuDeNivelAdmin = true;
        ficha.xpAtual -= ficha.xpProximoNivel; 
        ficha.nivel = (ficha.nivel || 0) + 1;
        
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + 2;
        const pvGanhoAdmin = Math.floor((ficha.atributos.vitalidade || 5) / 2) + 5;
        const pmGanhoAdmin = Math.floor((ficha.atributos.manaBase || 5) / 2) + 3;
        const pvMaxAnterior = ficha.pvMax || ((ficha.atributos.vitalidade * 5) + ((ficha.nivel-1) * 5) + 20);
        const pmMaxAnterior = ficha.pmMax || ((ficha.atributos.manaBase * 5) + ((ficha.nivel-1) * 3) + 10);
        ficha.pvMax = pvMaxAnterior + pvGanhoAdmin;
        ficha.pmMax = pmMaxAnterior + pmGanhoAdmin;
        ficha.pvAtual = ficha.pvMax; 
        ficha.pmAtual = ficha.pmMax;

        mensagensLevelUp.push(`?? [Admin] ${ficha.nomePersonagem || '[NOME_PERSONAGEM_ALVO]'} alcan�ou o N�vel ${ficha.nivel}!`);
        ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    }
    let msgRetorno = `XP de [NOME_PERSONAGEM_ALVO] atualizado para ${ficha.xpAtual}/${ficha.xpProximoNivel}.`;
    if (subiuDeNivelAdmin) { 
        msgRetorno = mensagensLevelUp.join("\n") + "\n" + msgRetorno;
    }
    return msgRetorno;
}

function modificarNivelArcadia(ficha, argsValor) {
    const novoNivel = parseInt(argsValor[0]);
    if (isNaN(novoNivel) || novoNivel < 1) return "ERRO: N�vel inv�lido.";
    const nivelAntigo = ficha.nivel || 1; 
    ficha.nivel = novoNivel;
    ficha.xpAtual = 0;
    ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    const diffNivel = novoNivel - nivelAntigo;
    if (diffNivel > 0) { 
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + (diffNivel * 2);
    }
    return `N�vel de [NOME_PERSONAGEM_ALVO] definido para ${ficha.nivel}.\nXP zerado. Pr�ximo n�vel: ${ficha.xpProximoNivel} XP. Pontos p/ distribuir: ${ficha.atributos.pontosParaDistribuir || 0}.`;
}

function modificarFlorins(ficha, argsValor) { 
    const valorFlorins = parseInt(argsValor[0]);
    if (isNaN(valorFlorins)) return "ERRO: Valor de Florins inv�lido.";
    ficha.florinsDeOuro = (ficha.florinsDeOuro || 0) + valorFlorins;
    if (ficha.florinsDeOuro < 0) ficha.florinsDeOuro = 0;
    return `Florins de Ouro de [NOME_PERSONAGEM_ALVO] atualizados para ${ficha.florinsDeOuro} FO.`;
}

function modificarEssencia(ficha, argsValor) {
    const valorEssencia = parseInt(argsValor[0]);
    if (isNaN(valorEssencia)) return "ERRO: Valor de Ess�ncia inv�lido.";
    ficha.essenciaDeArcadia = (ficha.essenciaDeArcadia || 0) + valorEssencia;
    if (ficha.essenciaDeArcadia < 0) ficha.essenciaDeArcadia = 0;
    return `Ess�ncia de Arc�dia de [NOME_PERSONAGEM_ALVO] atualizada para ${ficha.essenciaDeArcadia} EA.`;
}

function modificarAddItemArcadia(ficha, argsItem) {
    const inputCompleto = argsItem.join(" "); 
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) return "ERRO: Nome do item obrigat�rio.";
    const nomeItem = partesItem[0];
    const quantidade = partesItem[1] ? parseInt(partesItem[1]) : 1;
    const tipoItem = partesItem[2] || "Item Gen�rico"; 
    const descricaoItem = partesItem[3] || "";
    if (isNaN(quantidade) || quantidade < 1) return "ERRO: Quantidade inv�lida.";
    if (!ficha.inventario) ficha.inventario = [];
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemExistenteIndex > -1) {
        ficha.inventario[itemExistenteIndex].quantidade = (ficha.inventario[itemExistenteIndex].quantidade || 0) + quantidade;
        if (descricaoItem) ficha.inventario[itemExistenteIndex].descricao = descricaoItem;
        if (tipoItem !== "Item Gen�rico") ficha.inventario[itemExistenteIndex].tipo = tipoItem;
        return `Quantidade de "${nomeItem}" aumentada para ${ficha.inventario[itemExistenteIndex].quantidade} para [NOME_PERSONAGEM_ALVO].`;
    } else {
        ficha.inventario.push({ itemNome: nomeItem, quantidade: quantidade, tipo: tipoItem, descricao: descricaoItem });
        return `"${nomeItem}" (x${quantidade}) adicionado ao invent�rio de [NOME_PERSONAGEM_ALVO].`;
    }
}

function modificarDelItemArcadia(ficha, argsItem) {
    const inputCompleto = argsItem.join(" ");
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) return "ERRO: Nome do item obrigat�rio.";
    const nomeItem = partesItem[0]; 
    const quantidadeRemover = partesItem[1] ? parseInt(partesItem[1]) : 1;
    if (isNaN(quantidadeRemover) || quantidadeRemover < 1) return "ERRO: Quantidade a remover inv�lida.";
    if (!ficha.inventario) ficha.inventario = [];
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemExistenteIndex === -1) return `ERRO: Item "${nomeItem}" n�o encontrado no invent�rio de [NOME_PERSONAGEM_ALVO].`;
    const nomeItemOriginal = ficha.inventario[itemExistenteIndex].itemNome;
    ficha.inventario[itemExistenteIndex].quantidade -= quantidadeRemover;

    if (ficha.inventario[itemExistenteIndex].quantidade <= 0) {
        ficha.inventario.splice(itemExistenteIndex, 1);
        return `"${nomeItemOriginal}" removido completamente do invent�rio de [NOME_PERSONAGEM_ALVO].`;
    } else {
        return `${quantidadeRemover} unidade(s) de "${nomeItemOriginal}" removida(s) do invent�rio de [NOME_PERSONAGEM_ALVO]. Restam ${ficha.inventario[itemExistenteIndex].quantidade}.`;
    }
}

// --- FUN��O handleAdminSetAtributoArcadia CORRIGIDA ---
async function handleAdminSetAtributoArcadia(chatId, args) {
    if (args.length < 3) { 
        await enviarMensagemTextoWhapi(chatId, "Uso: `!adminsetattr <ID_ALVO> <atributo> <valor>`\nAtributos: forca, agilidade, vitalidade, manaBase, intelecto, carisma.");
        return;
    }
    const idAlvo = args[0].trim(); 
    const atributoNomeInput = args[1].trim(); // Alterado: Pega o input original
    const valor = parseInt(args[2]);

    if (!/^\d+$/.test(idAlvo)) {
        await enviarMensagemTextoWhapi(chatId, `ID do Jogador Alvo (${idAlvo}) inv�lido.`);
        return;
    }

    const atributosValidos = ["forca", "agilidade", "vitalidade", "manaBase", "intelecto", "carisma"];
    // Alterado: Encontra o nome can�nico do atributo
    const atributoCanonical = atributosValidos.find(valido => valido.toLowerCase() === atributoNomeInput.toLowerCase());

    if (!atributoCanonical) { // Alterado: Usa o nome can�nico para valida��o
        await enviarMensagemTextoWhapi(chatId, `Atributo "${atributoNomeInput}" inv�lido. V�lidos: ${atributosValidos.join(", ")}.`);
        return;
    }

    if (isNaN(valor) || valor < 0) { 
        await enviarMensagemTextoWhapi(chatId, `Valor para ${atributoCanonical} deve ser um n�mero positivo ou zero.`); // Usa atributoCanonical na msg
        return;
    }

    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) {
        await enviarMensagemTextoWhapi(chatId, `Ficha n�o encontrada para o ID ${idAlvo} em Arc�dia.`);
        return;
    }
    if (!fichaAlvo.atributos) fichaAlvo.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)); 
    
    fichaAlvo.atributos[atributoCanonical] = valor; // Alterado: Usa o nome can�nico para definir o valor
    
    await atualizarFichaETransmitir(chatId, idAlvo, fichaAlvo, `[Admin] Atributo ${atributoCanonical} de [NOME_PERSONAGEM_ALVO] definido para ${valor}. PV/PM recalculados.`, fichaAlvo.nomePersonagem || idAlvo);
}
// --- FIM DA CORRE��O handleAdminSetAtributoArcadia ---


async function handleAdminAddPontosAtributoArcadia(chatId, args) {
    if (args.length < 2) { 
        await enviarMensagemTextoWhapi(chatId, "Uso: `!adminaddpontosattr <ID_ALVO> <quantidade>` (pode ser negativo).");
        return;
    }
    const idAlvo = args[0].trim(); 
    const quantidade = parseInt(args[1]);
    if (!/^\d+$/.test(idAlvo)) {
        await enviarMensagemTextoWhapi(chatId, `ID do Jogador Alvo (${idAlvo}) inv�lido.`);
        return;
    }
    if (isNaN(quantidade)) {
        await enviarMensagemTextoWhapi(chatId, "Quantidade de pontos deve ser um n�mero.");
        return;
    }

    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) {
        await enviarMensagemTextoWhapi(chatId, `Ficha n�o encontrada para o ID ${idAlvo} em Arc�dia.`);
        return;
    }
    if (!fichaAlvo.atributos) fichaAlvo.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)); 
    fichaAlvo.atributos.pontosParaDistribuir = (fichaAlvo.atributos.pontosParaDistribuir || 0) + quantidade;
    if (fichaAlvo.atributos.pontosParaDistribuir < 0) fichaAlvo.atributos.pontosParaDistribuir = 0;

    await atualizarFichaETransmitir(chatId, idAlvo, fichaAlvo, `[Admin] Pontos para distribuir de [NOME_PERSONAGEM_ALVO] ajustados para ${fichaAlvo.atributos.pontosParaDistribuir}.`, fichaAlvo.nomePersonagem || idAlvo);
}

async function handleBoasVindasArcadia(chatId, senderName) {
    let mensagem = `?? Sauda��es, ${senderName}!\nBem-vindo(a) a Arc�dia! ??\n\n`;
    mensagem += "Um mundo medieval vibrante com magia, mas tamb�m repleto de perigos. Criaturas ancestrais despertam, impuros espreitam nas sombras e antigos conflitos amea�am reacender as chamas da guerra entre os reinos.\n\n";
    mensagem += "Dos nobres Eldari nas florestas encantadas de Elarion, passando pelos mestres forjadores Valtherans em Durnholde, at� os vers�teis Humanos de Valdoria e os enigm�ticos Seraphim na cidade flutuante de Caelum - cada ra�a e reino possui sua hist�ria e seus desafios.\n\n";
    mensagem += "Prepare-se para explorar terras vastas, desde os campos f�rteis de Valdoria at� as sombrias Ravengard e a misteriosa Ilha de Morwyn. Escolha sua classe, aprimore seus atributos e habilidades, e forje seu destino neste mundo inst�vel.\n\n";
    mensagem += "Que suas aventuras sejam �picas!\n\n";
    mensagem += "Use `!comandos` para ver a lista de a��es dispon�veis.\n";
    mensagem += "Use `!criar <Nome>;<Ra�a>;<Classe>;<ReinoOrigem>` para iniciar sua jornada!";
    await enviarMensagemTextoWhapi(chatId, mensagem);
}

// --- FUN��O handleDistribuirPontos CORRIGIDA ---
async function handleDistribuirPontos(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) {
        await enviarMensagemTextoWhapi(chatId, "Sua ficha de Arc�dia n�o foi encontrada. Crie uma com `!criar`.");
        return;
    }
    if (!ficha.atributos || ficha.atributos.pontosParaDistribuir === undefined || ficha.atributos.pontosParaDistribuir <= 0) {
        await enviarMensagemTextoWhapi(chatId, "Voc� n�o tem pontos de atributo para distribuir no momento.");
        return;
    }
    if (args.length < 2) { // atributo, quantidade
        await enviarMensagemTextoWhapi(chatId, "Uso: `!distribuirpontos <atributo> <quantidade>`\nAtributos: forca, agilidade, vitalidade, manaBase, intelecto, carisma.\nExemplo: `!distribuirpontos forca 2`");
        return;
    }

    const atributoNomeInput = args[0].trim(); 
    const pontosADistribuir = parseInt(args[1]);
    
    const atributosValidos = ["forca", "agilidade", "vitalidade", "manaBase", "intelecto", "carisma"];
    // Alterado: Encontra o nome can�nico do atributo
    const atributoCanonical = atributosValidos.find(valido => valido.toLowerCase() === atributoNomeInput.toLowerCase());

    if (!atributoCanonical) { // Alterado: Usa o nome can�nico para valida��o
        await enviarMensagemTextoWhapi(chatId, `Atributo "${atributoNomeInput}" inv�lido. V�lidos: ${atributosValidos.join(", ")}.`);
        return; 
    }
    
    if (isNaN(pontosADistribuir) || pontosADistribuir <= 0) { 
        await enviarMensagemTextoWhapi(chatId, "A quantidade de pontos a distribuir deve ser um n�mero maior que zero.");
        return; 
    }
    if (pontosADistribuir > ficha.atributos.pontosParaDistribuir) { 
        await enviarMensagemTextoWhapi(chatId, `Voc� s� tem ${ficha.atributos.pontosParaDistribuir} pontos para distribuir. N�o pode usar ${pontosADistribuir}.`);
        return; 
    }

    // Alterado: Usa o nome can�nico para modificar a ficha
    ficha.atributos[atributoCanonical] = (ficha.atributos[atributoCanonical] || 0) + pontosADistribuir;
    ficha.atributos.pontosParaDistribuir -= pontosADistribuir;
    
    await atualizarFichaETransmitir(chatId, sender, ficha, `Atributo ${atributoCanonical} aumentado em ${pontosADistribuir}! Novo valor: ${ficha.atributos[atributoCanonical]}.\nVoc� ainda tem ${ficha.atributos.pontosParaDistribuir} pontos para distribuir.`);
}
// --- FIM DA CORRE��O handleDistribuirPontos ---

async function handleJackpotArcadia(chatId, sender) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) {
        await enviarMensagemTextoWhapi(chatId, "Voc� precisa de uma ficha em Arc�dia para tentar a sorte no Jackpot!");
        return;
    }

    const custoJackpot = 25; 
    if ((ficha.florinsDeOuro || 0) < custoJackpot) {
        await enviarMensagemTextoWhapi(chatId, `Voc� precisa de ${custoJackpot} Florins de Ouro para girar o Jackpot. Voc� tem ${ficha.florinsDeOuro || 0} FO.`);
        return;
    }

    ficha.florinsDeOuro -= custoJackpot;
    let premioMsg = "";
    const sorte = Math.random();
    if (sorte < 0.01) { 
        const essenciaGanha = 5;
        ficha.essenciaDeArcadia = (ficha.essenciaDeArcadia || 0) + essenciaGanha;
        premioMsg = `??? JACKPOT LEND�RIO!!! ???\nVoc� ganhou ${essenciaGanha} Ess�ncias de Arc�dia e 100 Florins de Ouro! Que sorte incr�vel!`;
        ficha.florinsDeOuro += 100;
    } else if (sorte < 0.10) { 
        const florinsGanhos = Math.floor(Math.random() * 100) + 50;
        ficha.florinsDeOuro += florinsGanhos;
        premioMsg = `?? Sorte Grande! Voc� ganhou ${florinsGanhos} Florins de Ouro!`;
    } else if (sorte < 0.30) { 
        const florinsGanhos = Math.floor(Math.random() * 40) + 10;
        ficha.florinsDeOuro += florinsGanhos;
        premioMsg = `?? Um bom pr�mio! Voc� ganhou ${florinsGanhos} Florins de Ouro!`;
    } else if (sorte < 0.60) { 
        premioMsg = `?? Quase! O Jackpot n�o te deu nada desta vez... apenas o vento.`;
    } else { 
        const pegadinhas = [
            "Voc� puxa a alavanca e... uma meia velha e fedorenta cai do Jackpot! Que azar!",
            "O Jackpot solta uma fuma�a colorida e te entrega um biscoito da sorte. Dentro dele est� escrito: 'Tente novamente'.",
            "Voc� ganhou... um abra�o imagin�rio do Mestre do Jackpot! ??",
            "Uma pequena quantia de 5 Florins de Ouro � sua! Melhor que nada, certo?"
        ];
        premioMsg = pegadinhas[Math.floor(Math.random() * pegadinhas.length)];
        if (premioMsg.includes("5 Florins")) ficha.florinsDeOuro += 5;
    }

    await atualizarFichaETransmitir(chatId, sender, ficha, `Voc� gastou ${custoJackpot} FO no Jackpot...\n${premioMsg}\nSeu saldo: ${ficha.florinsDeOuro} FO, ${ficha.essenciaDeArcadia || 0} EA.`);
}

async function handleListarRacas(chatId) {
    let mensagem = "--- ?? Ra�as Jog�veis de Arc�dia ?? ---\n\n";
    RACAS_ARCADIA.forEach(raca => {
        mensagem += `*${raca.nome}* (${raca.grupo})\n_${raca.desc}_\n\n`;
    });
    mensagem += "Use estes nomes ao criar seu personagem com `!criar`.";
    await enviarMensagemTextoWhapi(chatId, mensagem);
}

async function handleListarClasses(chatId) {
    let mensagem = "--- ?? Classes Jog�veis de Arc�dia ?? ---\n\n";
    CLASSES_ARCADIA.forEach(classe => {
        mensagem += `*${classe.nome}* - ${classe.desc}\n`;
    });
    mensagem += "\nUse estes nomes ao criar seu personagem com `!criar`.";
    await enviarMensagemTextoWhapi(chatId, mensagem);
}

async function handleListarReinos(chatId) {
    let mensagem = "--- ?? Reinos Principais de Arc�dia ?? ---\n\n";
    REINOS_ARCADIA.forEach(reino => {
        mensagem += `*${reino.nome}* - ${reino.desc}\n\n`;
    });
    mensagem += "Use estes nomes como seu Reino de Origem ao criar seu personagem com `!criar`.";
    await enviarMensagemTextoWhapi(chatId, mensagem);
}

async function handleComandosArcadia(chatId, senderIsOwner) {
    let resposta = "?? --- Comandos de Arc�dia --- ??\n\n";
    resposta += "`!arcadia` ou `!bemvindo` - Mensagem de boas-vindas.\n";
    resposta += "`!ping` - Testa a conex�o.\n";
    resposta += "`!criar <nome>;<ra�a>;<classe>;<reino>` - Cria sua ficha.\n   (Use `!listaracas`, `!listaclasses`, `!listareinos` para ajuda)\n";
    resposta += "`!ficha` - Mostra sua ficha atual.\n";
    resposta += "`!distribuirpontos <atr> <qtd>` - Distribui seus pontos de atributo.\n   (Atributos: forca, agilidade, vitalidade, manaBase, intelecto, carisma)\n";
    resposta += "`!jackpot` - Tente sua sorte! (Custa 25 Florins)\n";
    resposta += "\n--- Comandos Informativos ---\n";
    resposta += "`!listaracas`\n`!listaclasses`\n`!listareinos`\n";
    if (senderIsOwner) {
        resposta += "\n--- Comandos de Admin (Propriet�rio) ---\n";
        resposta += "`!ficha <ID_ALVO>` - Mostra a ficha do ID_ALVO (s� n�meros).\n";
        resposta += "`!admincriar <ID_ALVO>;<nome>;<ra�a>;<classe>;<reino>`\n   Cria/sobrescreve ficha para ID_ALVO.\n";
        resposta += "`!adminaddxp <ID_ALVO> <valor>` - Adiciona XP e calcula level up.\n";
        resposta += "`!adminsetnivel <ID_ALVO> <n�vel>` - Define n�vel e XP.\n";
        resposta += "`!adminaddflorins <ID_ALVO> <valor>`\n";
        resposta += "`!adminaddessencia <ID_ALVO> <valor>`\n";
        resposta += "`!adminadditem <ID_ALVO> <item>[;qtd;tipo;desc]`\n";
        resposta += "`!admindelitem <ID_ALVO> <item>[;qtd]`\n";
        resposta += "`!adminsetattr <ID_ALVO> <atributo> <valor>`\n"; // Corrigido aqui tamb�m
        resposta += "`!adminaddpontosattr <ID_ALVO> <quantidade>`\n";
    }
    
    resposta += "\n`!comandos` ou `!help` - Mostra esta lista.\n";
    await enviarMensagemTextoWhapi(chatId, resposta);
}

async function enviarMensagemTextoWhapi(para, mensagem) {
    if (!WHAPI_API_TOKEN) {
        console.error("Token do Whapi n�o configurado para envio.");
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
                    console.log(`[Webhook] Mensagem pr�pria ignorada do chat ${chatId}.`);
                    continue;
                }
                if (!chatId || !senderRaw) {
                    console.warn("[Webhook] Mensagem sem 'chat_id' ou 'sender' v�lido:", messageData);
                    continue;
                }

                const sender = String(senderRaw).trim();
                const ownerIdVerificado = OWNER_ID;
                let isOwner = (ownerIdVerificado && sender === ownerIdVerificado);
                let isJogadorPermitido = listaJogadoresPermitidos.has(sender);

                if (!isOwner && !isJogadorPermitido && JOGADORES_PERMITIDOS_IDS_STRING !== "") { // Adicionada verifica��o para permitir todos se JOGADORES_PERMITIDOS_IDS_STRING for vazio
                    console.log(`[Webhook] Usu�rio ${senderName} (${sender}) n�o � propriet�rio nem jogador permitido. Comando ignorado.`);
                    continue; 
                }


                if (textContent && textContent.startsWith('!')) {
                    const args = textContent.slice(1).trim().split(/ +/g);
                    const comando = args.shift().toLowerCase();
                    
                    let preLog = isOwner ? "[Propriet�rio]" : (isJogadorPermitido ? "[Jogador Permitido]" : (JOGADORES_PERMITIDOS_IDS_STRING === "" ? "[Qualquer Jogador]" : "[N�O AUTORIZADO]"));
                    console.log(`[Webhook] ${preLog} COMANDO: '!${comando}' | Args: [${args.join(', ')}] | De: ${senderName} (${sender}) | Chat: ${chatId}`);
                    
                    if (comando === 'ping') {
                        await enviarMensagemTextoWhapi(chatId, `Pong de Arc�dia! Ol�, ${senderName}! Estou pronto para a aventura! ??`);
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
                         await handleDistribuirPontos(chatId, sender, args); // Corrigido
                    } else if (comando === 'jackpot') {
                        await handleJackpotArcadia(chatId, sender);
                    } else if ((comando === 'comandos' || comando === 'help')) {
                        await handleComandosArcadia(chatId, isOwner);
                    }
                    else if (isOwner) {
                        switch (comando) {
                            case 'admincriar': 
                                await handleAdminCriarFichaArcadia(chatId, sender, args);
                                break;
                            case 'adminaddxp':
                                await handleAdminComandoFichaArcadia(chatId, args, 'addxp', modificarXPArcadia, 
                                    `XP de [NOME_PERSONAGEM_ALVO] atualizado.`, 
                                    "Uso: `!adminaddxp <ID_ALVO> <valor>`");
                                break;
                            case 'adminsetnivel':
                                await handleAdminComandoFichaArcadia(chatId, args, 'setnivel', modificarNivelArcadia,
                                    `N�vel de [NOME_PERSONAGEM_ALVO] atualizado.`,
                                    "Uso: `!adminsetnivel <ID_ALVO> <n�vel>`");
                                break;
                            case 'adminaddflorins':
                                await handleAdminComandoFichaArcadia(chatId, args, 'addflorins', modificarFlorins,
                                    `Florins de [NOME_PERSONAGEM_ALVO] atualizados.`,
                                    "Uso: `!adminaddflorins <ID_ALVO> <valor>`");
                                break;
                            case 'adminaddessencia':
                                await handleAdminComandoFichaArcadia(chatId, args, 'addessencia', modificarEssencia,
                                    `Ess�ncia de Arc�dia de [NOME_PERSONAGEM_ALVO] atualizada.`,
                                    "Uso: `!adminaddessencia <ID_ALVO> <valor>`");
                                break;
                            case 'adminadditem':
                                await handleAdminComandoFichaArcadia(chatId, args, 'additem', modificarAddItemArcadia,
                                    `Invent�rio de [NOME_PERSONAGEM_ALVO] atualizado.`, 
                                    "Uso: `!adminadditem <ID_ALVO> <nome>[;qtd;tipo;desc]`");
                                break;
                            case 'admindelitem':
                                await handleAdminComandoFichaArcadia(chatId, args, 'delitem', modificarDelItemArcadia,
                                    `Invent�rio de [NOME_PERSONAGEM_ALVO] atualizado.`, 
                                    "Uso: `!admindelitem <ID_ALVO> <nome>[;qtd]`");
                                break;
                            case 'adminsetattr': // Corrigido
                                await handleAdminSetAtributoArcadia(chatId, args);
                                break;
                            case 'adminaddpontosattr':
                                await handleAdminAddPontosAtributoArcadia(chatId, args);
                                break;
                            case 'addxp': 
                                await handleAddXPArcadia(chatId, sender, args);
                                break;
                            case 'setnivel':
                                await handleSetNivelArcadia(chatId, sender, args);
                                break;
                            case 'addflorins': 
                                await handleAddFlorins(chatId, sender, args);
                                break;
                            case 'addessencia': 
                                await handleAddEssencia(chatId, sender, args);
                                break;
                            case 'additem':
                                await handleAddItemArcadia(chatId, sender, args);
                                break;
                            case 'delitem':
                                await handleDelItemArcadia(chatId, sender, args);
                                break;
                            default:
                                await enviarMensagemTextoWhapi(chatId, `Comando "!${comando}" (possivelmente de Admin) n�o reconhecido.`);
                                break;
                        }
                    } else {
                        // Adicionado para o caso de JOGADORES_PERMITIDOS_IDS_STRING ser vazio
                        if (JOGADORES_PERMITIDOS_IDS_STRING !== "" || 
                           (comando !== 'ping' && comando !== 'arcadia' && comando !== 'bemvindo' &&
                            comando !== 'listaracas' && comando !== 'listaclasses' && comando !== 'listareinos' &&
                            comando !== 'criar' && comando !== 'ficha' && comando !== 'minhaficha' && comando !== 'verficha' &&
                            comando !== 'distribuirpontos' && comando !== 'jackpot' && comando !== 'comandos' && comando !== 'help')) {
                            await enviarMensagemTextoWhapi(chatId, `Comando "!${comando}" n�o reconhecido ou voc� n�o tem permiss�o para us�-lo, ${senderName}.`);
                        }
                    }
                } else if (textContent) {
                    if (isOwner) {
                         console.log(`[Webhook] Texto normal recebido do Propriet�rio ${senderName}: "${textContent}"`);
                    } else if (isJogadorPermitido || JOGADORES_PERMITIDOS_IDS_STRING === "") {
                         console.log(`[Webhook] Texto normal recebido do Jogador ${senderName}: "${textContent}"`);
                    }
                }
            } 
        } else {
            console.log("[Webhook] Estrutura inesperada ou sem mensagens:", req.body);
        }
    } catch (error) {
        console.error("Erro CR�TICO ao processar webhook do Whapi:", error.message, error.stack);
    }
    res.status(200).send('OK');
});

app.get('/', (req, res) => {
    res.send('Servidor do Bot de RPG Arc�dia (Whapi no Render com MongoDB) est� operacional!');
});

async function iniciarServidor() {
    await conectarMongoDB();
    await carregarFichasDoDB();
    app.listen(PORT, () => {
        console.log("****************************************************");
        console.log("*** INICIANDO SERVIDOR DO BOT DE RPG ARC�DIA - WHAPI ***");
        console.log(`*** Data/Hora In�cio: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} ***`);
        console.log("****************************************************");
        const publicUrl = process.env.RENDER_EXTERNAL_URL;
        console.log(`Servidor do bot de RPG escutando na porta ${PORT}`);
        if (publicUrl) {
            console.log(`Webhook URL para configurar no Whapi.Cloud: ${publicUrl}/webhook/whatsapp`);
        } else {
            console.log(`Webhook local (para testes): http://localhost:${PORT}/webhook/whatsapp`);
        }
        console.log(`Conectado ao DB: ${MONGODB_DB_NAME}, Cole��o: ${MONGODB_FICHAS_COLLECTION}`);
        if (OWNER_ID) {
            console.log(`>>> ATEN��O: Bot configurado para aceitar comandos apenas do propriet�rio: ${OWNER_ID} <<<`);
        } else {
            console.warn(">>> ALERTA: OWNER_ID n�o definido. O bot pode estar aberto a todos os comandos (verifique a l�gica de seguran�a)! <<<");
        }
        if (JOGADORES_PERMITIDOS_IDS_STRING && listaJogadoresPermitidos.size > 0) { // Modificado para verificar JOGADORES_PERMITIDOS_IDS_STRING tamb�m
            console.log(`>>> Jogadores Permitidos Adicionais: ${Array.from(listaJogadoresPermitidos).join(', ')} <<<`);
        } else if (JOGADORES_PERMITIDOS_IDS_STRING) { // Se a string existe mas est� vazia e resultou em size 0
             console.log(">>> Lista de IDs de jogadores permitidos est� configurada mas vazia. Apenas o propriet�rio pode usar comandos restritos.");
        }
         else { // Se JOGADORES_PERMITIDOS_IDS_STRING n�o est� definida/vazia, e OWNER_ID tamb�m n�o est�, todos podem usar
            console.log(">>> JOGADORES_PERMITIDOS_IDS n�o definido. Se OWNER_ID tamb�m n�o estiver, o bot pode estar aberto. Verifique a l�gica de seguran�a. <<<")
        }
        console.log("****************************************************");
        console.log("*** SERVIDOR PRONTO E RODANDO           ***");
        console.log("****************************************************");
    });
}

iniciarServidor().catch(err => {
    console.error("Falha cr�tica ao iniciar o servidor:", err);
    process.exit(1);
});

async function desligamentoGracioso(signal) {
    console.log(`${signal} recebido. Desligando o bot...`);
    if (dbClient) {
        try {
            await dbClient.close();
            console.log("Conex�o com MongoDB fechada.");
        } catch (err) {
            console.error("Erro ao fechar conex�o com MongoDB:", err);
        }
    }
    process.exit(0);
}
process.on('SIGTERM', () => desligamentoGracioso('SIGTERM'));
process.on('SIGINT', () => desligamentoGracioso('SIGINT'));

