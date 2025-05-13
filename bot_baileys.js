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
    ultimaAtualizacao: "", logMissoes: [], notacoesDM: "" 
};

// --- CONFIGURAÇÃO DO MONGODB ---
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'arcadia_rpg_db'; 
const MONGODB_FICHAS_COLLECTION = process.env.MONGODB_FICHAS_COLLECTION || 'fichas_arcadia'; 

if (!MONGODB_URI) { console.error("--- ERRO FATAL: MONGODB_URI não definida! ---"); process.exit(1); }
if (!OWNER_ID) { console.warn("--- ALERTA: OWNER_ID não definida! ---"); }
if (JOGADORES_PERMITIDOS_IDS_STRING) { console.log("Jogadores permitidos carregados:", Array.from(listaJogadoresPermitidos)); } 
else { console.log("Nenhum jogador adicional permitido."); }

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
            todasAsFichas[idJogador] = { ...fichaDB };
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
        console.log(`Ficha para ${idAlvoTrimmado} não encontrada no cache, buscando no DB...`);
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

    todasAsFichas[idAlvoTrimmado] = ficha;
    await salvarFichaNoDB(idAlvoTrimmado, ficha);
    
    let msgFinal = mensagemSucesso;
    const nomeDisplay = nomePersonagemAlvo || ficha.nomePersonagem || idAlvoTrimmado;
    if (msgFinal.includes("[NOME_PERSONAGEM_ALVO]")) {
        msgFinal = msgFinal.replace(/\[NOME_PERSONAGEM_ALVO\]/g, nomeDisplay);
    }
    msgFinal = msgFinal.replace(/\{\{ficha\.(\w+)\}\}/g, (match, p1) => {
        if (ficha[p1] !== undefined) return ficha[p1];
        if (ficha.atributos && ficha.atributos[p1] !== undefined) return ficha.atributos[p1];
        return match;
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
    console.error("FATAL_ERROR: WHAPI_API_TOKEN não definida!");
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

    // Validação simples de raça e classe (poderia ser mais robusta verificando contra as constantes)
    if (!RACAS_ARCADIA.find(r => r.nome.toLowerCase() === racaInput.toLowerCase())) {
        await enviarMensagemTextoWhapi(chatId, `Raça "${racaInput}" inválida. Use \`!listaracas\` para ver as opções.`);
        return;
    }
    if (!CLASSES_ARCADIA.find(c => c.nome.toLowerCase() === classeInput.toLowerCase())) {
        await enviarMensagemTextoWhapi(chatId, `Classe "${classeInput}" inválida. Use \`!listaclasses\` para ver as opções.`);
        return;
    }
     if (!REINOS_ARCADIA.find(r => r.nome.toLowerCase() === origemReinoInput.toLowerCase())) {
        await enviarMensagemTextoWhapi(chatId, `Reino de Origem "${origemReinoInput}" inválido. Use \`!listareinos\` para ver as opções.`);
        return;
    }


    let novaFicha = JSON.parse(JSON.stringify(fichaModeloArcadia));
    novaFicha.nomeJogadorSalvo = senderName;
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.raca = RACAS_ARCADIA.find(r => r.nome.toLowerCase() === racaInput.toLowerCase()).nome; // Garante capitalização correta
    novaFicha.classe = CLASSES_ARCADIA.find(c => c.nome.toLowerCase() === classeInput.toLowerCase()).nome; // Garante capitalização correta
    novaFicha.origemReino = REINOS_ARCADIA.find(r => r.nome.toLowerCase() === origemReinoInput.toLowerCase()).nome; // Garante capitalização correta
    
    // Atributos base e pontos para distribuir já estão no fichaModeloArcadia
    // Calcular PV/PM Max iniciais e XP próximo nível
    if (!novaFicha.atributos) novaFicha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    novaFicha.pvMax = (novaFicha.atributos.vitalidade * 5) + (novaFicha.nivel * 5) + 20;
    novaFicha.pvAtual = novaFicha.pvMax;
    novaFicha.pmMax = (novaFicha.atributos.manaBase * 5) + (novaFicha.nivel * 3) + 10;
    novaFicha.pmAtual = novaFicha.pmMax;
    novaFicha.xpProximoNivel = calcularXpProximoNivel(novaFicha.nivel);

    await atualizarFichaETransmitir(chatId, idJogador, novaFicha, `🎉 Personagem ${nomePersonagemInput} (${novaFicha.raca} ${novaFicha.classe} de ${novaFicha.origemReino}) criado para Arcádia!\nUse \`!distribuirpontos <atributo> <valor>\` para usar seus ${novaFicha.atributos.pontosParaDistribuir} pontos iniciais.\nUse \`!ficha\` para ver os detalhes.`);
}

// --- FIM DO BLOCO 1 ---
    async function handleAdminCriarFichaArcadia(chatId, senderOwner, argsAdmin) {
    const comandoCompleto = argsAdmin.join(" ");
    const partesPrincipais = comandoCompleto.split(';');
    
    if (partesPrincipais.length < 5) { // ID_ALVO;Nome Personagem;Raça;Classe;ReinoOrigem
        await enviarMensagemTextoWhapi(chatId, "Formato incorreto! Uso: `!admincriar <ID_ALVO>;<Nome Personagem>;<Raça>;<Classe>;<ReinoOrigem>`\nID_ALVO é só o número (ex: 5577...). Use `!listaracas`, etc. para opções.");
        return;
    }

    const idJogadorAlvo = partesPrincipais[0].trim();
    const nomePersonagemInput = partesPrincipais[1].trim();
    const racaInput = partesPrincipais[2].trim();
    const classeInput = partesPrincipais[3].trim();
    const origemReinoInput = partesPrincipais[4].trim();

    if (!/^\d+$/.test(idJogadorAlvo)) {
        await enviarMensagemTextoWhapi(chatId, `ID do Jogador Alvo (${idJogadorAlvo}) inválido. Deve conter apenas números.`);
        return;
    }
     // Validação de Raça, Classe e Reino
    const racaValida = RACAS_ARCADIA.find(r => r.nome.toLowerCase() === racaInput.toLowerCase());
    const classeValida = CLASSES_ARCADIA.find(c => c.nome.toLowerCase() === classeInput.toLowerCase());
    const reinoValido = REINOS_ARCADIA.find(reino => reino.nome.toLowerCase() === origemReinoInput.toLowerCase());

    if (!racaValida) {
        await enviarMensagemTextoWhapi(chatId, `Raça "${racaInput}" inválida. Use \`!listaracas\` para ver as opções.`);
        return;
    }
    if (!classeValida) {
        await enviarMensagemTextoWhapi(chatId, `Classe "${classeInput}" inválida. Use \`!listaclasses\` para ver as opções.`);
        return;
    }
    if (!reinoValido) {
        await enviarMensagemTextoWhapi(chatId, `Reino de Origem "${origemReinoInput}" inválido. Use \`!listareinos\` para ver as opções.`);
        return;
    }
    
    let novaFicha = JSON.parse(JSON.stringify(fichaModeloArcadia));
    novaFicha.nomeJogadorSalvo = `(Admin) ${idJogadorAlvo}`; // Pode ser o nome do jogador se soubermos, ou deixar para ele preencher
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.raca = racaValida.nome; // Usa o nome capitalizado corretamente
    novaFicha.classe = classeValida.nome; // Usa o nome capitalizado corretamente
    novaFicha.origemReino = reinoValido.nome; // Usa o nome capitalizado corretamente

    // Atributos base e pontosParaDistribuir já vêm do fichaModeloArcadia
    // Calcular PV/PM Max iniciais
    if (!novaFicha.atributos) novaFicha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)); // Garante que existe
    novaFicha.pvMax = (novaFicha.atributos.vitalidade * 5) + (novaFicha.nivel * 5) + 20;
    novaFicha.pvAtual = novaFicha.pvMax;
    novaFicha.pmMax = (novaFicha.atributos.manaBase * 5) + (novaFicha.nivel * 3) + 10;
    novaFicha.pmAtual = novaFicha.pmMax;
    novaFicha.xpProximoNivel = calcularXpProximoNivel(novaFicha.nivel);
    
    todasAsFichas[idJogadorAlvo] = novaFicha; // Adiciona/Atualiza no cache
    await atualizarFichaETransmitir(chatId, idJogadorAlvo, novaFicha, `🎉 [Admin] Personagem ${nomePersonagemInput} (${novaFicha.raca} ${novaFicha.classe}) CRIADO/ATUALIZADO para o ID ${idJogadorAlvo}.`);
}

async function handleVerFichaArcadia(chatId, sender, args) {
    let idAlvoConsulta = sender; // Por padrão, consulta a ficha do próprio remetente (que já foi "trimado")
    let adminConsultandoOutro = false;
    // sender já é o ID "trimado" do remetente. OWNER_ID também é "trimado" na inicialização.

    if (args.length > 0 && sender === OWNER_ID) { // Se houver argumento E for o OWNER_ID usando
        const idPotencial = String(args[0]).trim();
        if (/^\d+$/.test(idPotencial)) { // Verifica se é um ID numérico
            idAlvoConsulta = idPotencial;
            adminConsultandoOutro = true;
            console.log(`[Admin] ${sender} está consultando a ficha do ID_ALVO: ${idAlvoConsulta}`);
        } else {
            await enviarMensagemTextoWhapi(chatId, "ID do jogador alvo inválido para `!ficha`. Forneça apenas números.");
            return;
        }
    }
    
    const ficha = await getFichaOuCarregar(idAlvoConsulta);

    if (!ficha) {
        const msgErro = adminConsultandoOutro 
            ? `❌ Ficha não encontrada para o ID ${idAlvoConsulta} em Arcádia. Use \`!admincriar\` para criar uma.`
            : "❌ Você ainda não tem um personagem em Arcádia. Use o comando `!criar` para criar um.";
        await enviarMensagemTextoWhapi(chatId, msgErro);
        return;
    }

    // Formatação da ficha de Arcádia
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
            const msgPontos = adminConsultandoOutro ? `O jogador tem` : `Você tem`;
            const cmdDistribuir = adminConsultandoOutro ? "" : " (`!distribuirpontos`)";
            resposta += `  ✨ ${msgPontos} ${ficha.atributos.pontosParaDistribuir} pontos para distribuir${cmdDistribuir}.\n`;
        }
    } else {
        resposta += "  (Atributos não definidos)\n";
    }
    
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
    } else {
        resposta += "  (Nenhuma magia conhecida)\n";
    }

    resposta += "\n🎒 Inventário:\n";
    if (ficha.inventario && ficha.inventario.length > 0) {
        ficha.inventario.forEach(i => {
            resposta += `  ☆ ${i.itemNome} (Qtd: ${i.quantidade || 1}) ${i.tipo ? '['+i.tipo+']' : ''} ${i.descricao ? '- ' + i.descricao : ''}\n`;
        });
    } else {
        resposta += "  (Vazio)\n";
    }
    
    resposta += "\n⚙️ Equipamento:\n";
    let temEquip = false;
    if (ficha.equipamento) {
        for(const slot in ficha.equipamento) {
            if (ficha.equipamento[slot]) {
                // Converte camelCase para Título Formatado (ex: maoDireita -> Mao Direita)
                const nomeSlot = slot.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); 
                resposta += `  ☆ ${nomeSlot}: ${typeof ficha.equipamento[slot] === 'object' ? ficha.equipamento[slot].itemNome : ficha.equipamento[slot]}\n`;
                temEquip = true;
            }
        }
    }
    if (!temEquip) {
        resposta += "  (Nenhum item equipado)\n";
    }
    
    resposta += `\n🕒 Última atualização: ${ficha.ultimaAtualizacao || 'N/A'}\n`;
    await enviarMensagemTextoWhapi(chatId, resposta);
}

// --- FUNÇÕES DE COMANDO PARA A PRÓPRIA FICHA (ADAPTADAS PARA ARCÁDIA) ---

async function handleAddXPArcadia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) {
        await enviarMensagemTextoWhapi(chatId, "Sua ficha de Arcádia não foi encontrada. Crie uma com `!criar`.");
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
    while (ficha.xpAtual >= ficha.xpProximoNivel) {
        subiuDeNivel = true;
        ficha.xpAtual -= ficha.xpProximoNivel;
        ficha.nivel = (ficha.nivel || 0) + 1;
        
        if(!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + 2; 
        
        const pvGanho = Math.floor((ficha.atributos.vitalidade || 5) / 2) + 5;
        const pmGanho = Math.floor((ficha.atributos.manaBase || 5) / 2) + 3;
        
        ficha.pvMax = (ficha.pvMax || ((ficha.atributos.vitalidade * 5) + ((ficha.nivel-1) * 5) + 20)) + pvGanho;
        ficha.pmMax = (ficha.pmMax || ((ficha.atributos.manaBase * 5) + ((ficha.nivel-1) * 3) + 10)) + pmGanho;
        ficha.pvAtual = ficha.pvMax; 
        ficha.pmAtual = ficha.pmMax;

        mensagensLevelUp.push(`🎉 PARABÉNS! Você alcançou o Nível ${ficha.nivel} em Arcádia! Ganhou ${pvGanho} PV, ${pmGanho} PM e 2 pontos de atributo!`);
        ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    }

    let mensagemFinal = `XP atualizado para ${ficha.xpAtual}/${ficha.xpProximoNivel}.`;
    if (subiuDeNivel) {
        mensagemFinal = mensagensLevelUp.join("\n") + "\n" + mensagemFinal;
    }
    
    await atualizarFichaETransmitir(chatId, sender, ficha, mensagemFinal);
}
// --- FIM DO BLOCO 2 ---
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

                const sender = String(senderRaw).trim(); // ID do remetente já "trimado"
                const ownerIdVerificado = OWNER_ID; 
                
                let isOwner = (ownerIdVerificado && sender === ownerIdVerificado);
                let isJogadorPermitido = listaJogadoresPermitidos.has(sender);

                if (!isOwner && !isJogadorPermitido) {
                    console.log(`[Webhook] Usuário ${senderName} (${sender}) não é proprietário nem jogador permitido. Comando ignorado.`);
                    continue; // Ignora se não for owner nem jogador permitido
                }

                if (textContent && textContent.startsWith('!')) {
                    const args = textContent.slice(1).trim().split(/ +/g);
                    const comando = args.shift().toLowerCase();
                    
                    let preLog = isOwner ? "[Proprietário]" : (isJogadorPermitido ? "[Jogador Permitido]" : "[NÃO AUTORIZADO]");
                    console.log(`[Webhook] ${preLog} COMANDO: '!${comando}' | Args: [${args.join(', ')}] | De: ${senderName} (${sender}) | Chat: ${chatId}`);

                    // Comandos Comuns para Owner e Jogadores Permitidos
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
                    } else if (comando === 'criar') { // Agora é !criar para Arcádia
                        await handleCriarFichaArcadia(chatId, sender, senderName, args);
                    } else if (comando === 'ficha' || comando === 'minhaficha' || comando === 'verficha') {
                        if (isOwner && args.length > 0 && comando !== 'minhaficha') {
                            await handleVerFichaArcadia(chatId, sender, args); // Owner vendo ficha de outro
                        } else {
                            await handleVerFichaArcadia(chatId, sender, []); // Jogador vendo a própria ficha (ou owner vendo a própria)
                        }
                    } else if (comando === 'distribuirpontos') {
                         await handleDistribuirPontos(chatId, sender, args);
                    } else if (comando === 'jackpot') {
                        await handleJackpotArcadia(chatId, sender);
                    } else if ((comando === 'comandos' || comando === 'help')) {
                        await handleComandosArcadia(chatId, isOwner);
                    }
                    // Comandos EXCLUSIVOS DO OWNER (e para o owner editar A PRÓPRIA ficha com comandos curtos)
                    else if (isOwner) {
                        switch (comando) {
                            // Comandos de admin para gerenciar fichas de outros
                            case 'admincriar': // Admin criando para Arcádia
                                await handleAdminCriarFichaArcadia(chatId, sender, args);
                                break;
                            case 'adminaddxp':
                                await handleAdminComandoFichaArcadia(chatId, args, 'addxp', modificarXPArcadia, 
                                    `XP de [NOME_PERSONAGEM_ALVO] atualizado.`, 
                                    "Uso: `!adminaddxp <ID_ALVO> <valor>`");
                                break;
                            case 'adminsetnivel':
                                await handleAdminComandoFichaArcadia(chatId, args, 'setnivel', modificarNivelArcadia,
                                    `Nível de [NOME_PERSONAGEM_ALVO] atualizado.`,
                                    "Uso: `!adminsetnivel <ID_ALVO> <nível>`");
                                break;
                            case 'adminaddflorins':
                                await handleAdminComandoFichaArcadia(chatId, args, 'addflorins', modificarFlorins,
                                    `Florins de [NOME_PERSONAGEM_ALVO] atualizados.`,
                                    "Uso: `!adminaddflorins <ID_ALVO> <valor>`");
                                break;
                            case 'adminaddessencia':
                                await handleAdminComandoFichaArcadia(chatId, args, 'addessencia', modificarEssencia,
                                    `Essência de Arcádia de [NOME_PERSONAGEM_ALVO] atualizada.`,
                                    "Uso: `!adminaddessencia <ID_ALVO> <valor>`");
                                break;
                            case 'adminadditem':
                                await handleAdminComandoFichaArcadia(chatId, args, 'additem', modificarAddItemArcadia,
                                    `Inventário de [NOME_PERSONAGEM_ALVO] atualizado.`, 
                                    "Uso: `!adminadditem <ID_ALVO> <nome>[;qtd;tipo;desc]`");
                                break;
                            case 'admindelitem':
                                await handleAdminComandoFichaArcadia(chatId, args, 'delitem', modificarDelItemArcadia,
                                    `Inventário de [NOME_PERSONAGEM_ALVO] atualizado.`, 
                                    "Uso: `!admindelitem <ID_ALVO> <nome>[;qtd]`");
                                break;
                            case 'adminsetattr':
                                await handleAdminSetAtributoArcadia(chatId, args);
                                break;
                            case 'adminaddpontosattr':
                                await handleAdminAddPontosAtributoArcadia(chatId, args);
                                break;
                            // Comandos para o OWNER modificar A PRÓPRIA FICHA (nomes adaptados para Arcádia)
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
                                await enviarMensagemTextoWhapi(chatId, `Comando "!${comando}" (possivelmente de Admin) não reconhecido.`);
                                break;
                        }
                    } else {
                        // Jogador Permitido tentou um comando que não é um dos listados acima para ele
                        await enviarMensagemTextoWhapi(chatId, `Comando "!${comando}" não reconhecido ou você não tem permissão para usá-lo, ${senderName}.`);
                    }
                } else if (textContent) {
                    // Mensagens normais
                    if (isOwner) {
                         console.log(`[Webhook] Texto normal recebido do Proprietário ${senderName}: "${textContent}"`);
                    } else if (isJogadorPermitido) {
                         console.log(`[Webhook] Texto normal recebido do Jogador Permitido ${senderName}: "${textContent}"`);
                    }
                }
            } // Fim do loop for
        } else {
            console.log("[Webhook] Estrutura inesperada ou sem mensagens:", req.body);
        }
    } catch (error) {
        console.error("Erro CRÍTICO ao processar webhook do Whapi:", error.message, error.stack);
    }
    res.status(200).send('OK');
}); // Fim do app.post
// --- BLOCO 3 (REVISADO) TERMINA AQUI ---
// O próximo bloco (Bloco 4 - Final) começará com a rota app.get('/', ...)
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
        console.log(`Servidor do bot de RPG escutando na porta ${PORT}`);
        if (publicUrl) {
            console.log(`Webhook URL para configurar no Whapi.Cloud: ${publicUrl}/webhook/whatsapp`);
        } else {
            console.log(`Webhook local (para testes): http://localhost:${PORT}/webhook/whatsapp`);
        }
        console.log(`Conectado ao DB: ${MONGODB_DB_NAME}, Coleção: ${MONGODB_FICHAS_COLLECTION}`);
        if (OWNER_ID) {
            console.log(`>>> ATENÇÃO: Bot configurado para aceitar comandos apenas do proprietário: ${OWNER_ID} <<<`);
        } else {
            console.warn(">>> ALERTA: OWNER_ID não definido. O bot pode estar aberto a todos os comandos (verifique a lógica de segurança)! <<<");
        }
        if (listaJogadoresPermitidos.size > 0) {
            console.log(`>>> Jogadores Permitidos Adicionais: ${Array.from(listaJogadoresPermitidos).join(', ')} <<<`);
        } else {
            console.log(">>> Nenhum jogador adicional permitido configurado (JOGADORES_PERMITIDOS_IDS está vazio ou não definido).")
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
    process.exit(0);
}
process.on('SIGTERM', () => desligamentoGracioso('SIGTERM'));
process.on('SIGINT', () => desligamentoGracioso('SIGINT'));
