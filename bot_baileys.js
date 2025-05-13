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
        .map(id => String(id).trim()) // Garante que é string e trim
        .filter(id => id && /^\d+$/.test(id)) // Remove vazios e garante que são só números
);

// --- MODELO DA FICHA DE PERSONAGEM - ARCÁDIA ---
const fichaModeloArcadia = {
    // Informações do Jogador/Personagem
    // idJogador será o _id no MongoDB (o número do jogador como string)
    nomeJogadorSalvo: "", 
    nomePersonagem: "N/A",
    raca: "A Ser Definida", 
    classe: "A Ser Definida", 
    origemReino: "N/A", 
    
    // Níveis e Progressão
    nivel: 1,
    xpAtual: 0,
    xpProximoNivel: 100, // Calculado por calcularXpProximoNivel(nivel)

    // Atributos Primários
    atributos: {
        forca: 5,
        agilidade: 5,
        vitalidade: 5,
        manaBase: 5, 
        intelecto: 5,
        carisma: 5,
        pontosParaDistribuir: 30 // Pontos iniciais para o jogador distribuir
    },

    // Recursos Derivados (serão calculados e atualizados)
    pvMax: 0, // Ex: vitalidade * 5 + nivel * 5
    pvAtual: 0,
    pmMax: 0, // Ex: manaBase * 5 + nivel * 3
    pmAtual: 0,

    // Combate (Sugestões)
    ataqueBase: 0, 
    defesaBase: 0, 

    // Social
    reputacao: {}, // Ex: { "Valdoria": 0, "Elarion": 0 }

    // Moedas
    florinsDeOuro: 50,
    essenciaDeArcadia: 0,

    // Habilidades e Talentos
    habilidadesEspeciais: [], // { nome: "Visão Noturna (Eldari)", tipo: "Racial", descricao: "Enxerga no escuro." }
    pericias: [], // { nome: "Furtividade", valor: 0 }
    magiasConhecidas: [], // { nome: "Bola de Fogo", nivelMinimo: 1, custoMana: 5, descricao: "..." }

    // Equipamento e Inventário
    equipamento: {
        maoDireita: null, 
        maoEsquerda: null,
        armaduraCorpo: null,
        elmo: null,
        amuleto: null,
        anel1: null,
        anel2: null,
    },
    inventario: [ 
        { itemNome: "Adaga Simples", quantidade: 1, tipo: "Arma Leve", descricao: "Uma adaga básica de bronze." },
        { itemNome: "Rações de Viagem", quantidade: 3, tipo: "Consumível", descricao: "Suficiente para 3 dias." }
    ],

    // Lore e Background
    historiaPersonagem: "",
    idiomas: ["Comum Arcádiano"], 

    // Estado e Condições
    condicoes: [], // Ex: "Envenenado", "Fadiga Leve", "Abençoado pela Lua"

    // Miscelânea
    ultimaAtualizacao: "",
    logMissoes: [], 
    notacoesDM: "" 
};

// --- CONFIGURAÇÃO DO MONGODB ---
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'arcadia_rpg_db'; // Sugestão de novo DB para Arcádia
const MONGODB_FICHAS_COLLECTION = process.env.MONGODB_FICHAS_COLLECTION || 'fichas_arcadia'; // Sugestão de nova coleção

if (!MONGODB_URI) {
    console.error("--- ERRO FATAL: Variável de ambiente MONGODB_URI não definida! ---");
    process.exit(1);
}
if (!OWNER_ID) {
    console.warn("--- ALERTA: Variável de ambiente OWNER_ID não definida! Restrição de proprietário pode falhar. ---");
}
if (JOGADORES_PERMITIDOS_IDS_STRING) {
    console.log("Jogadores permitidos carregados:", Array.from(listaJogadoresPermitidos));
} else {
    console.log("Nenhum jogador adicional permitido via JOGADORES_PERMITIDOS_IDS.");
}

let dbClient;
let fichasCollection;
let todasAsFichas = {}; // Cache em memória das fichas

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
        todasAsFichas = {}; // Limpa o cache antes de recarregar
        fichasDoDB.forEach(fichaDB => {
            const idJogador = String(fichaDB._id).trim(); // _id no DB é o ID do jogador (número como string)
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
    const idJogadorStr = String(idJogador).trim(); // Garante que é string e sem espaços
    console.log(`Salvando/Atualizando ficha para jogador ${idJogadorStr} no MongoDB...`);
    try {
        const fichaParaSalvar = { ...fichaData };
        // Não precisamos de delete fichaParaSalvar._id; pois o _id no objeto é o mesmo que usamos no filtro.
        await fichasCollection.updateOne(
            { _id: idJogadorStr }, // Critério de busca
            { $set: fichaParaSalvar }, // Dados a serem atualizados/inseridos
            { upsert: true } // Opção: se não encontrar, insere um novo documento
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
                // Calcula PV/PM Max ao carregar do DB, se não estiverem definidos ou para garantir atualização
                if (!fichaDB.atributos) fichaDB.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)); // Garante que atributos exista
                fichaDB.pvMax = (fichaDB.atributos.vitalidade * 5) + (fichaDB.nivel * 5) + 20; // Exemplo de cálculo
                fichaDB.pmMax = (fichaDB.atributos.manaBase * 5) + (fichaDB.nivel * 3) + 10; // Exemplo de cálculo
                
                todasAsFichas[idAlvoTrimmado] = { ...fichaDB };
                ficha = todasAsFichas[idAlvoTrimmado];
                console.log(`Ficha para ${idAlvoTrimmado} carregada do DB para o cache.`);
            }
        } catch (dbError) {
            console.error(`Erro ao buscar ficha ${idAlvoTrimmado} no DB:`, dbError);
        }
    } else if (ficha) { // Se já está no cache, recalcula PV/PM Max para garantir consistência após level up/mudança de atributo
        if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
        ficha.pvMax = (ficha.atributos.vitalidade * 5) + (ficha.nivel * 5) + 20;
        ficha.pmMax = (ficha.atributos.manaBase * 5) + (ficha.nivel * 3) + 10;
    }
    return ficha;
}

async function atualizarFichaETransmitir(chatId, idAlvo, ficha, mensagemSucesso, nomePersonagemAlvo = null) {
    const idAlvoTrimmado = String(idAlvo).trim();
    ficha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    
    // Recalcula PV/PM Max antes de salvar, caso atributos ou nível tenham mudado
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    ficha.pvMax = (ficha.atributos.vitalidade * 5) + (ficha.nivel * 5) + 20;
    ficha.pmMax = (ficha.atributos.manaBase * 5) + (ficha.nivel * 3) + 10;
    // Garante que PV/PM atuais não excedam os máximos
    if (ficha.pvAtual > ficha.pvMax) ficha.pvAtual = ficha.pvMax;
    if (ficha.pmAtual > ficha.pmMax) ficha.pmAtual = ficha.pmMax;

    todasAsFichas[idAlvoTrimmado] = ficha;
    await salvarFichaNoDB(idAlvoTrimmado, ficha);
    
    let msgFinal = mensagemSucesso;
    const nomeDisplay = nomePersonagemAlvo || ficha.nomePersonagem || idAlvoTrimmado;
    if (msgFinal.includes("[NOME_PERSONAGEM_ALVO]")) {
        msgFinal = msgFinal.replace(/\[NOME_PERSONAGEM_ALVO\]/g, nomeDisplay);
    }
    // Substitui placeholders como {{ficha.xpAtual}} na mensagem de sucesso
    msgFinal = msgFinal.replace(/\{\{ficha\.(\w+)\}\}/g, (match, p1) => {
        return ficha[p1] !== undefined ? ficha[p1] : (ficha.atributos[p1] !== undefined ? ficha.atributos[p1] : match);
    });
    
    await enviarMensagemTextoWhapi(chatId, msgFinal);
}

function calcularXpProximoNivel(nivelAtual) {
    // Fórmula de exemplo: Nível 1 -> 100 XP, Nível 2 -> 200 XP, etc.
    // Pode ser mais complexa: ex, 100, 250, 500, 1000...
    return nivelAtual * 100 + 50; // Ajustado para ser um pouco mais que nivel*100
}

// --- CONFIGURAÇÃO DO SERVIDOR EXPRESS ---
const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const WHAPI_API_TOKEN = process.env.WHAPI_API_TOKEN;
const WHAPI_BASE_URL = "https://gate.whapi.cloud";

if (!WHAPI_API_TOKEN) {
    console.error("FATAL_ERROR: Variável de ambiente WHAPI_API_TOKEN não está definida no Render!");
}

// --- FUNÇÕES DE COMANDO DO RPG - ARCÁDIA ---

async function handleCriarFichaArcadia(chatId, sender, senderName, args) {
    const idJogador = sender; // sender já vem "trimado"
    if (todasAsFichas[idJogador]) {
        await enviarMensagemTextoWhapi(chatId, `Você já possui um personagem em Arcádia: ${todasAsFichas[idJogador].nomePersonagem}. Por enquanto, apenas um personagem por jogador.`);
        return;
    }

    // Formato: !criar <nome_personagem>;<raça>;<classe>;<reino_origem>
    const dadosComando = args.join(' ');
    const partes = dadosComando.split(';').map(p => p.trim());

    if (partes.length < 4) {
        await enviarMensagemTextoWhapi(chatId, "Formato incorreto! Uso: `!criar <Nome do Personagem>;<Raça>;<Classe>;<Reino de Origem>`\nUse `!listaracas` ou `!listaclasses` para ver as opções.");
        return;
    }

    const nomePersonagemInput = partes[0];
    const racaInput = partes[1];
    const classeInput = partes[2];
    const origemReinoInput = partes[3];

    // TODO: Validar Raça, Classe, Reino de Origem com listas predefinidas se necessário
    // Ex: const racasValidas = ["eldari", "valtheran", ...]; if (!racasValidas.includes(racaInput.toLowerCase())) { ... }

    let novaFicha = JSON.parse(JSON.stringify(fichaModeloArcadia));
    novaFicha.nomeJogadorSalvo = senderName;
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.raca = racaInput;
    novaFicha.classe = classeInput;
    novaFicha.origemReino = origemReinoInput;
    
    // Atributos base já estão em 5, pontosParaDistribuir em 30.
    // Calcular PV/PM Max iniciais
    novaFicha.pvMax = (novaFicha.atributos.vitalidade * 5) + (novaFicha.nivel * 5) + 20;
    novaFicha.pvAtual = novaFicha.pvMax;
    novaFicha.pmMax = (novaFicha.atributos.manaBase * 5) + (novaFicha.nivel * 3) + 10;
    novaFicha.pmAtual = novaFicha.pmMax;
    novaFicha.xpProximoNivel = calcularXpProximoNivel(novaFicha.nivel);

    await atualizarFichaETransmitir(chatId, idJogador, novaFicha, `🎉 Personagem ${nomePersonagemInput} (${racaInput} ${classeInput} de ${origemReinoInput}) criado para Arcádia!\nUse \`!distribuirpontos <atributo> <valor>\` para usar seus ${novaFicha.atributos.pontosParaDistribuir} pontos iniciais.\nUse \`!ficha\` para ver os detalhes.`);
}

async function handleAdminCriarFichaArcadia(chatId, senderOwner, argsAdmin) {
    const comandoCompleto = argsAdmin.join(" ");
    const partesPrincipais = comandoCompleto.split(';');
    
    // ID_ALVO;Nome Personagem;Raça;Classe;ReinoOrigem
    if (partesPrincipais.length < 5) {
        await enviarMensagemTextoWhapi(chatId, "Formato incorreto! Uso: `!admincriar <ID_ALVO>;<Nome Personagem>;<Raça>;<Classe>;<ReinoOrigem>`\nID_ALVO é só o número (ex: 5577...).");
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
    
    // TODO: Adicionar validações para Raça, Classe, Reino aqui também se necessário.

    let novaFicha = JSON.parse(JSON.stringify(fichaModeloArcadia));
    novaFicha.nomeJogadorSalvo = `(Admin) ${idJogadorAlvo}`;
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.raca = racaInput;
    novaFicha.classe = classeInput;
    novaFicha.origemReino = origemReinoInput;

    novaFicha.pvMax = (novaFicha.atributos.vitalidade * 5) + (novaFicha.nivel * 5) + 20;
    novaFicha.pvAtual = novaFicha.pvMax;
    novaFicha.pmMax = (novaFicha.atributos.manaBase * 5) + (novaFicha.nivel * 3) + 10;
    novaFicha.pmAtual = novaFicha.pmMax;
    novaFicha.xpProximoNivel = calcularXpProximoNivel(novaFicha.nivel);
    
    todasAsFichas[idJogadorAlvo] = novaFicha; // Adiciona/Atualiza no cache
    await atualizarFichaETransmitir(chatId, idJogadorAlvo, novaFicha, `🎉 [Admin] Personagem ${nomePersonagemInput} (${racaInput} ${classeInput}) CRIADO/ATUALIZADO para o ID ${idJogadorAlvo}.`);
}

async function handleVerFichaArcadia(chatId, sender, args) {
    // (A lógica de handleVerFicha para decidir o alvo e formatar a resposta será adaptada aqui)
    // ... (COLE AQUI A FUNÇÃO handleVerFicha COMPLETA DA VERSÃO ANTERIOR, E DEPOIS VAMOS ADAPTÁ-LA PARA ARCÁDIA) ...
    // Por enquanto, vou colocar uma versão simplificada e depois a gente formata bonito.
    let idAlvoConsulta = sender;
    let adminConsultandoOutro = false;

    if (args.length > 0 && sender === OWNER_ID) {
        const idPotencial = args[0].trim();
        if (/^\d+$/.test(idPotencial)) {
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
    let resposta = `🌟 --- Ficha de Arcádia: ${ficha.nomePersonagem} (@${idAlvoConsulta}) --- 🌟\n`;
    if (ficha.nomeJogadorSalvo) resposta += `🧙 Jogador: ${ficha.nomeJogadorSalvo}\n`;
    resposta += `Race: ${ficha.raca}\n`;
    resposta += `Class: ${ficha.classe}\n`;
    resposta += `Realm: ${ficha.origemReino}\n`;
    resposta += `Lvl: ${ficha.nivel} (XP: ${ficha.xpAtual}/${ficha.xpProximoNivel})\n`;
    resposta += `HP: ${ficha.pvAtual}/${ficha.pvMax}\n`;
    resposta += `MP: ${ficha.pmAtual}/${ficha.pmMax}\n`;
    resposta += `Gold Florins: ${ficha.florinsDeOuro} FO\n`;
    resposta += `Arcadia Essence: ${ficha.essenciaDeArcadia} EA\n`;

    resposta += "\n🧠 Attributes:\n";
    if (ficha.atributos) {
        for (const [attr, valor] of Object.entries(ficha.atributos)) {
            const nomeAttrCapitalized = attr.charAt(0).toUpperCase() + attr.slice(1);
            if (attr !== "pontosParaDistribuir") {
                resposta += `  ☆ ${nomeAttrCapitalized}: ${valor}\n`;
            }
        }
        if (ficha.atributos.pontosParaDistribuir > 0) {
            const msgPontos = adminConsultandoOutro ? `O jogador tem` : `Você tem`;
            const cmdDistribuir = adminConsultandoOutro ? "" : " (`!distribuirpontos`)";
            resposta += `  ✨ ${msgPontos} ${ficha.atributos.pontosParaDistribuir} pontos para distribuir${cmdDistribuir}.\n`;
        }
    } else {
        resposta += "  (Atributos não definidos)\n";
    }
    
    resposta += "\n📜 Special Abilities & Skills:\n";
    if (ficha.habilidadesEspeciais && ficha.habilidadesEspeciais.length > 0) {
        ficha.habilidadesEspeciais.forEach(h => resposta += `  ☆ ${h.nome} (${h.tipo || 'Habilidade'}): ${h.descricao || ''}\n`);
    } else {
        resposta += "  (Nenhuma habilidade especial listada)\n";
    }
    if (ficha.pericias && ficha.pericias.length > 0) {
        ficha.pericias.forEach(p => resposta += `  ☆ Perícia em ${p.nome}: ${p.valor}\n`);
    } else {
        // resposta += "  (Nenhuma perícia listada)\n"; // Pode omitir se for ficar muito grande
    }

    resposta += "\n🔮 Known Spells:\n";
    if (ficha.magiasConhecidas && ficha.magiasConhecidas.length > 0) {
        ficha.magiasConhecidas.forEach(m => resposta += `  ☆ ${m.nome} (Custo: ${m.custoMana || 'N/A'} PM): ${m.descricao || ''}\n`);
    } else {
        resposta += "  (Nenhuma magia conhecida)\n";
    }

    resposta += "\n🎒 Inventory:\n";
    if (ficha.inventario && ficha.inventario.length > 0) {
        ficha.inventario.forEach(i => {
            resposta += `  ☆ ${i.itemNome} (Qtd: ${i.quantidade || 1}) ${i.tipo ? '['+i.tipo+']' : ''} ${i.descricao ? '- ' + i.descricao : ''}\n`;
        });
    } else {
        resposta += "  (Vazio)\n";
    }
    
    resposta += "\n⚙️ Equipment:\n";
    let temEquip = false;
    if (ficha.equipamento) {
        for(const slot in ficha.equipamento) {
            if (ficha.equipamento[slot]) {
                const nomeSlot = slot.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); // Converte maoDireita para Mao Direita
                resposta += `  ☆ ${nomeSlot}: ${typeof ficha.equipamento[slot] === 'object' ? ficha.equipamento[slot].itemNome : ficha.equipamento[slot]}\n`;
                temEquip = true;
            }
        }
    }
    if (!temEquip) {
        resposta += "  (Nenhum item equipado)\n";
    }
    
    resposta += `\n🕒 Last Updated: ${ficha.ultimaAtualizacao || 'N/A'}\n`;
    await enviarMensagemTextoWhapi(chatId, resposta);
}


// --- BLOCO 1 TERMINA AQUI (APROXIMADAMENTE) ---
// O próximo bloco começará com a função "handleAdminAddXP_Arcadia"
        // Continuação do Bloco 1...

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
    ficha.xpAtual += valorXP;

    let mensagensLevelUp = [];
    let subiuDeNivel = false;
    while (ficha.xpAtual >= ficha.xpProximoNivel) {
        subiuDeNivel = true;
        ficha.xpAtual -= ficha.xpProximoNivel;
        ficha.nivel++;
        
        // Bônus por subir de nível (exemplo)
        ficha.atributos.pontosParaDistribuir += 2; // Ganha 2 pontos de atributo por nível
        const pvGanho = Math.floor(ficha.atributos.vitalidade / 2) + 5; // Exemplo de ganho de PV
        const pmGanho = Math.floor(ficha.atributos.manaBase / 2) + 3; // Exemplo de ganho de PM
        ficha.pvMax += pvGanho;
        ficha.pmMax += pmGanho;
        ficha.pvAtual = ficha.pvMax; // Recupera todo PV ao subir de nível
        ficha.pmAtual = ficha.pmMax; // Recupera todo PM ao subir de nível

        mensagensLevelUp.push(`🎉 PARABÉNS! Você alcançou o Nível ${ficha.nivel} em Arcádia! Ganhou ${pvGanho} PV, ${pmGanho} PM e 2 pontos de atributo para distribuir!`);
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
    if (!ficha) {
        await enviarMensagemTextoWhapi(chatId, "Sua ficha de Arcádia não foi encontrada.");
        return;
    }
    if (args.length === 0 || isNaN(parseInt(args[0])) || parseInt(args[0]) < 1) {
        await enviarMensagemTextoWhapi(chatId, "Uso: `!setnivel <novo_nivel_numerico_maior_que_0>`.\nExemplo: `!setnivel 3`");
        return;
    }
    const novoNivel = parseInt(args[0]);
    const nivelAntigo = ficha.nivel;
    
    ficha.nivel = novoNivel;
    ficha.xpAtual = 0;
    ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);

    // Recalcular PV/PM Max para o novo nível, como se tivesse subido naturalmente
    // Essa é uma forma simples, pode ser mais elaborada
    const diffNivel = novoNivel - nivelAntigo;
    if (diffNivel > 0) {
        ficha.atributos.pontosParaDistribuir += diffNivel * 2; // Ex: 2 pontos por nível de diferença
        // Ajustar PV/PM Max. Para simplificar, vamos apenas definir para o novo nível.
        // Uma lógica mais complexa somaria os ganhos por nível.
    }
    // A função atualizarFichaETransmitir já recalcula PV/PM Max e enche os atuais.

    await atualizarFichaETransmitir(chatId, sender, ficha, `Nível atualizado para ${ficha.nivel}. XP zerado. Próximo nível requer ${ficha.xpProximoNivel} XP. Você tem ${ficha.atributos.pontosParaDistribuir} pontos de atributo para distribuir.`);
}

async function handleAddFlorins(chatId, sender, args) { // Renomeado de addgaleoes
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) {
        await enviarMensagemTextoWhapi(chatId, "Sua ficha de Arcádia não foi encontrada.");
        return;
    }
    if (args.length === 0 || isNaN(parseInt(args[0]))) {
        await enviarMensagemTextoWhapi(chatId, "Uso: `!addflorins <valor_numerico>`.\nExemplo: `!addflorins 100` ou `!addflorins -20`");
        return;
    }
    const valorFlorins = parseInt(args[0]);
    ficha.florinsDeOuro = (ficha.florinsDeOuro || 0) + valorFlorins;
    if (ficha.florinsDeOuro < 0) ficha.florinsDeOuro = 0;
    await atualizarFichaETransmitir(chatId, sender, ficha, `Florins de Ouro atualizados! Você agora tem ${ficha.florinsDeOuro} FO.`);
}
async function handleAddEssencia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) {
        await enviarMensagemTextoWhapi(chatId, "Sua ficha de Arcádia não foi encontrada.");
        return;
    }
    if (args.length === 0 || isNaN(parseInt(args[0]))) {
        await enviarMensagemTextoWhapi(chatId, "Uso: `!addessencia <valor_numerico>`.\nExemplo: `!addessencia 10` ou `!addessencia -2`");
        return;
    }
    const valorEssencia = parseInt(args[0]);
    ficha.essenciaDeArcadia = (ficha.essenciaDeArcadia || 0) + valorEssencia;
    if (ficha.essenciaDeArcadia < 0) ficha.essenciaDeArcadia = 0;
    await atualizarFichaETransmitir(chatId, sender, ficha, `Essência de Arcádia atualizada! Você agora tem ${ficha.essenciaDeArcadia} EA.`);
}

async function handleAddItemArcadia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) {
        await enviarMensagemTextoWhapi(chatId, "Sua ficha de Arcádia não foi encontrada.");
        return;
    }
    const inputCompleto = args.join(" ");
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) {
        await enviarMensagemTextoWhapi(chatId, "Uso: `!additem <nome do item>[;quantidade;tipo;descricao]`\nExemplo: `!additem Espada Longa;1;Arma Média;Lâmina de aço comum`");
        return;
    }
    const nomeItem = partesItem[0];
    const quantidade = partesItem[1] ? parseInt(partesItem[1]) : 1;
    const tipoItem = partesItem[2] || "Item";
    const descricaoItem = partesItem[3] || "";

    if (isNaN(quantidade) || quantidade < 1) {
        await enviarMensagemTextoWhapi(chatId, "Quantidade inválida. Deve ser um número maior que 0.");
        return;
    }
    if (!ficha.inventario) ficha.inventario = []; // Garante que o inventário exista
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());

    if (itemExistenteIndex > -1) {
        ficha.inventario[itemExistenteIndex].quantidade = (ficha.inventario[itemExistenteIndex].quantidade || 0) + quantidade;
        // Atualiza tipo e descrição se não existiam ou se foram fornecidos explicitamente para overwrite (poderia ser uma lógica mais complexa)
        if (descricaoItem) ficha.inventario[itemExistenteIndex].descricao = descricaoItem;
        if (tipoItem !== "Item") ficha.inventario[itemExistenteIndex].tipo = tipoItem;
         await atualizarFichaETransmitir(chatId, sender, ficha, `Quantidade de "${nomeItem}" aumentada para ${ficha.inventario[itemExistenteIndex].quantidade}.`);
    } else {
        ficha.inventario.push({ itemNome: nomeItem, quantidade: quantidade, tipo: tipoItem, descricao: descricaoItem });
        await atualizarFichaETransmitir(chatId, sender, ficha, `"${nomeItem}" (x${quantidade}) adicionado ao seu inventário.`);
    }
}

async function handleDelItemArcadia(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha || !ficha.inventario) {
        await enviarMensagemTextoWhapi(chatId, "Sua ficha ou inventário não foi encontrado.");
        return;
    }
    const inputCompleto = args.join(" ");
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) {
        await enviarMensagemTextoWhapi(chatId, "Uso: `!delitem <nome do item>[;quantidade]`\nExemplo: `!delitem Adaga Simples;1`");
        return;
    }
    const nomeItem = partesItem[0];
    const quantidadeRemover = partesItem[1] ? parseInt(partesItem[1]) : 1;

    if (isNaN(quantidadeRemover) || quantidadeRemover < 1) {
        await enviarMensagemTextoWhapi(chatId, "Quantidade a remover inválida. Deve ser um número maior que 0.");
        return;
    }
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());

    if (itemExistenteIndex === -1) {
        await enviarMensagemTextoWhapi(chatId, `Item "${nomeItem}" não encontrado no seu inventário.`);
        return;
    }
    
    const nomeItemOriginal = ficha.inventario[itemExistenteIndex].itemNome;
    ficha.inventario[itemExistenteIndex].quantidade -= quantidadeRemover;

    if (ficha.inventario[itemExistenteIndex].quantidade <= 0) {
        ficha.inventario.splice(itemExistenteIndex, 1);
        await atualizarFichaETransmitir(chatId, sender, ficha, `"${nomeItemOriginal}" removido completamente do seu inventário.`);
    } else {
        await atualizarFichaETransmitir(chatId, sender, ficha, `${quantidadeRemover} unidade(s) de "${nomeItemOriginal}" removida(s). Restam ${ficha.inventario[itemExistenteIndex].quantidade}.`);
    }
}

// --- FUNÇÕES DE ADMIN PARA MODIFICAR FICHAS DE OUTROS (ADAPTADAS PARA ARCÁDIA) ---
async function handleAdminComandoFichaArcadia(chatId, args, tipoComando, callbackModificacao, mensagemSucessoPadrao, mensagemErroUso) {
    if (args.length < 2) { 
        await enviarMensagemTextoWhapi(chatId, mensagemErroUso);
        return;
    }
    const idAlvo = args[0].trim();
    if (!/^\d+$/.test(idAlvo)) {
        await enviarMensagemTextoWhapi(chatId, `ID do Jogador Alvo (${idAlvo}) inválido. Deve conter apenas números.`);
        return;
    }
    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) {
        await enviarMensagemTextoWhapi(chatId, `Ficha não encontrada para o ID ${idAlvo} em Arcádia. Use \`!admincriar\` primeiro.`);
        return;
    }
    
    let fichaModificada = JSON.parse(JSON.stringify(fichaAlvo));
    const resultadoCallback = callbackModificacao(fichaModificada, args.slice(1)); 

    if (typeof resultadoCallback === 'string' && resultadoCallback.startsWith("ERRO:")) {
        await enviarMensagemTextoWhapi(chatId, resultadoCallback.substring(5)); // Remove "ERRO:"
        return;
    }
    if (resultadoCallback === false ) { // Erro de validação genérico no callback
         await enviarMensagemTextoWhapi(chatId, mensagemErroUso);
        return;
    }
    
    const mensagemSucessoFinal = (typeof resultadoCallback === 'string') ? resultadoCallback : mensagemSucessoPadrao;

    await atualizarFichaETransmitir(chatId, idAlvo, fichaModificada, mensagemSucessoFinal, fichaModificada.nomePersonagem || idAlvo);
}

// Callbacks para modificações de Admin (Arcádia)
function modificarXPArcadia(ficha, argsValor) {
    const valorXP = parseInt(argsValor[0]);
    if (isNaN(valorXP)) { return "ERRO: Valor de XP inválido.";  }
    ficha.xpAtual += valorXP;

    let mensagensLevelUp = [];
    let subiuDeNivelAdmin = false;
    while (ficha.xpAtual >= ficha.xpProximoNivel) {
        subiuDeNivelAdmin = true;
        ficha.xpAtual -= ficha.xpProximoNivel;
        ficha.nivel++;
        if(!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)); // Garante
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + 2;
        
        const pvGanhoAdmin = Math.floor(ficha.atributos.vitalidade / 2) + 5;
        const pmGanhoAdmin = Math.floor(ficha.atributos.manaBase / 2) + 3;
        ficha.pvMax = (ficha.pvMax || ((ficha.atributos.vitalidade * 5) + (ficha.nivel-1 * 5) + 20)) + pvGanhoAdmin; // Evita NaN se pvMax não existir
        ficha.pmMax = (ficha.pmMax || ((ficha.atributos.manaBase * 5) + (ficha.nivel-1 * 3) + 10)) + pmGanhoAdmin; // Evita NaN
        ficha.pvAtual = ficha.pvMax; 
        ficha.pmAtual = ficha.pmMax;

        mensagensLevelUp.push(`🎉 [Admin] ${ficha.nomePersonagem || '[NOME_PERSONAGEM_ALVO]'} alcançou o Nível ${ficha.nivel}!`);
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
    if (isNaN(novoNivel) || novoNivel < 1) return "ERRO: Nível inválido.";
    const nivelAntigo = ficha.nivel;
    ficha.nivel = novoNivel;
    ficha.xpAtual = 0;
    ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);

    const diffNivel = novoNivel - nivelAntigo;
    if (diffNivel > 0 && ficha.atributos) {
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + (diffNivel * 2);
    }
    // PV/PM Max e Atuais serão recalculados e preenchidos por atualizarFichaETransmitir
    return `Nível de [NOME_PERSONAGEM_ALVO] definido para ${ficha.nivel}. XP zerado. Próximo nível: ${ficha.xpProximoNivel} XP. Pontos de atributo para distribuir: ${ficha.atributos.pontosParaDistribuir || 0}.`;
}

function modificarFlorins(ficha, argsValor) { // Renomeado de modificarGaleoes
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
    // (Lógica de modificarAddItem igual à anterior, mas opera na ficha fornecida)
    const inputCompleto = argsItem.join(" ");
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) return "ERRO: Nome do item obrigatório.";
    const nomeItem = partesItem[0];
    const quantidade = partesItem[1] ? parseInt(partesItem[1]) : 1;
    const tipoItem = partesItem[2] || "Item Genérico";
    const descricaoItem = partesItem[3] || "";
    if (isNaN(quantidade) || quantidade < 1) return "ERRO: Quantidade inválida.";
    if (!ficha.inventario) ficha.inventario = [];
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemExistenteIndex > -1) {
        ficha.inventario[itemExistenteIndex].quantidade = (ficha.inventario[itemExistenteIndex].quantidade || 0) + quantidade;
        if (descricaoItem) ficha.inventario[itemExistenteIndex].descricao = descricaoItem;
        if (tipoItem !== "Item Genérico") ficha.inventario[itemExistenteIndex].tipo = tipoItem;
        return `Quantidade de "${nomeItem}" aumentada para ${ficha.inventario[itemExistenteIndex].quantidade} para [NOME_PERSONAGEM_ALVO].`;
    } else {
        ficha.inventario.push({ itemNome: nomeItem, quantidade: quantidade, tipo: tipoItem, descricao: descricaoItem });
        return `"${nomeItem}" (x${quantidade}) adicionado ao inventário de [NOME_PERSONAGEM_ALVO].`;
    }
}

function modificarDelItemArcadia(ficha, argsItem) {
    // (Lógica de modificarDelItem igual à anterior, mas opera na ficha fornecida)
    const inputCompleto = argsItem.join(" ");
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) return "ERRO: Nome do item obrigatório.";
    const nomeItem = partesItem[0];
    const quantidadeRemover = partesItem[1] ? parseInt(partesItem[1]) : 1;
    if (isNaN(quantidadeRemover) || quantidadeRemover < 1) return "ERRO: Quantidade a remover inválida.";
    if (!ficha.inventario) ficha.inventario = [];
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemExistenteIndex === -1) return `ERRO: Item "${nomeItem}" não encontrado no inventário de [NOME_PERSONAGEM_ALVO].`;
    
    const nomeItemOriginal = ficha.inventario[itemExistenteIndex].itemNome;
    ficha.inventario[itemExistenteIndex].quantidade -= quantidadeRemover;

    if (ficha.inventario[itemExistenteIndex].quantidade <= 0) {
        ficha.inventario.splice(itemExistenteIndex, 1);
        return `"${nomeItemOriginal}" removido completamente do inventário de [NOME_PERSONAGEM_ALVO].`;
    } else {
        return `${quantidadeRemover} unidade(s) de "${nomeItemOriginal}" removida(s) do inventário de [NOME_PERSONAGEM_ALVO]. Restam ${ficha.inventario[itemExistenteIndex].quantidade}.`;
    }
}

async function handleAdminSetAtributoArcadia(chatId, args) {
    if (args.length < 3) { 
        await enviarMensagemTextoWhapi(chatId, "Uso: `!adminsetattr <ID_ALVO> <atributo> <valor>`\nAtributos: forca, agilidade, vitalidade, manaBase, intelecto, carisma.");
        return;
    }
    const idAlvo = args[0].trim();
    const atributoNome = args[1].toLowerCase().trim();
    const valor = parseInt(args[2]);

    if (!/^\d+$/.test(idAlvo)) {
        await enviarMensagemTextoWhapi(chatId, `ID do Jogador Alvo (${idAlvo}) inválido.`);
        return;
    }
    const atributosValidos = ["forca", "agilidade", "vitalidade", "manaBase", "intelecto", "carisma"];
    if (!atributosValidos.includes(atributoNome)) {
        await enviarMensagemTextoWhapi(chatId, `Atributo "${atributoNome}" inválido. Válidos: ${atributosValidos.join(", ")}.`);
        return;
    }
    if (isNaN(valor) || valor < 0) { // Atributos não devem ser negativos normalmente
        await enviarMensagemTextoWhapi(chatId, `Valor para ${atributoNome} deve ser um número positivo ou zero.`);
        return;
    }

    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) {
        await enviarMensagemTextoWhapi(chatId, `Ficha não encontrada para o ID ${idAlvo} em Arcádia.`);
        return;
    }
    if (!fichaAlvo.atributos) fichaAlvo.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    fichaAlvo.atributos[atributoNome] = valor;
    
    // Recalcular PV/PM Max ao mudar atributos base
    fichaAlvo.pvMax = (fichaAlvo.atributos.vitalidade * 5) + (fichaAlvo.nivel * 5) + 20;
    fichaAlvo.pmMax = (fichaAlvo.atributos.manaBase * 5) + (fichaAlvo.nivel * 3) + 10;
    if (fichaAlvo.pvAtual > fichaAlvo.pvMax) fichaAlvo.pvAtual = fichaAlvo.pvMax; // Ajusta PV atual se necessário
    if (fichaAlvo.pmAtual > fichaAlvo.pmMax) fichaAlvo.pmAtual = fichaAlvo.pmMax; // Ajusta PM atual

    await atualizarFichaETransmitir(chatId, idAlvo, fichaAlvo, `[Admin] Atributo ${atributoNome} de [NOME_PERSONAGEM_ALVO] definido para ${valor}. PV/PM recalculados.`, fichaAlvo.nomePersonagem || idAlvo);
}

async function handleAdminAddPontosAtributoArcadia(chatId, args) {
    if (args.length < 2) { 
        await enviarMensagemTextoWhapi(chatId, "Uso: `!adminaddpontosattr <ID_ALVO> <quantidade>` (pode ser negativo).");
        return;
    }
    const idAlvo = args[0].trim();
    const quantidade = parseInt(args[1]);

    if (!/^\d+$/.test(idAlvo)) {
        await enviarMensagemTextoWhapi(chatId, `ID do Jogador Alvo (${idAlvo}) inválido.`);
        return;
    }
    if (isNaN(quantidade)) {
        await enviarMensagemTextoWhapi(chatId, "Quantidade de pontos deve ser um número.");
        return;
    }

    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) {
        await enviarMensagemTextoWhapi(chatId, `Ficha não encontrada para o ID ${idAlvo} em Arcádia.`);
        return;
    }
    if (!fichaAlvo.atributos) fichaAlvo.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)); 
    fichaAlvo.atributos.pontosParaDistribuir = (fichaAlvo.atributos.pontosParaDistribuir || 0) + quantidade;
        if (fichaAlvo.atributos.pontosParaDistribuir < 0) fichaAlvo.atributos.pontosParaDistribuir = 0;

    await atualizarFichaETransmitir(chatId, idAlvo, fichaAlvo, `[Admin] Pontos para distribuir de [NOME_PERSONAGEM_ALVO] ajustados para ${fichaAlvo.atributos.pontosParaDistribuir}.`, fichaAlvo.nomePersonagem || idAlvo);
} // Fim de handleAdminAddPontosAtributoArcadia

// --- NOVO COMANDO: Boas Vindas Arcádia ---
async function handleBoasVindasArcadia(chatId, senderName) {
    let mensagem = `🌟 Saudações, ${senderName}! Bem-vindo(a) a Arcádia! 🌟\n\n`;
    mensagem += "Um mundo medieval vibrante com magia, mas também repleto de perigos. Criaturas ancestrais despertam, impuros espreitam nas sombras e antigos conflitos ameaçam reacender as chamas da guerra entre os reinos.\n\n";
    mensagem += "Dos nobres Eldari nas florestas encantadas de Elarion, passando pelos mestres forjadores Valtherans em Durnholde, até os versáteis Humanos de Valdoria e os enigmáticos Seraphim na cidade flutuante de Caelum – cada raça e reino possui sua história e seus desafios.\n\n";
    mensagem += "Prepare-se para explorar terras vastas, desde os campos férteis de Valdoria até as sombrias Ravengard e a misteriosa Ilha de Morwyn. Escolha sua classe, aprimore seus atributos e habilidades, e forje seu destino neste mundo instável.\n\n";
    mensagem += "Que suas aventuras sejam épicas!\n\n";
    mensagem += "Use `!comandos` para ver a lista de ações disponíveis.\n";
    mensagem += "Use `!criar <Nome>;<Raça>;<Classe>;<ReinoOrigem>` para iniciar sua jornada!";
    await enviarMensagemTextoWhapi(chatId, mensagem);
}


// --- NOVO COMANDO: Distribuir Pontos de Atributo (Jogador) ---
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
    if (args.length < 2) { // atributo, quantidade
        await enviarMensagemTextoWhapi(chatId, "Uso: `!distribuirpontos <atributo> <quantidade>`\nAtributos: forca, agilidade, vitalidade, manaBase, intelecto, carisma.\nExemplo: `!distribuirpontos forca 2`");
        return;
    }
    const atributoNome = args[0].toLowerCase().trim();
    const pontosADistribuir = parseInt(args[1]);

    const atributosValidos = ["forca", "agilidade", "vitalidade", "manaBase", "intelecto", "carisma"];
    if (!atributosValidos.includes(atributoNome)) {
        await enviarMensagemTextoWhapi(chatId, `Atributo "${atributoNome}" inválido. Válidos: ${atributosValidos.join(", ")}.`);
        return;
    }
    if (isNaN(pontosADistribuir) || pontosADistribuir <= 0) {
        await enviarMensagemTextoWhapi(chatId, "A quantidade de pontos a distribuir deve ser um número maior que zero.");
        return;
    }
    if (pontosADistribuir > ficha.atributos.pontosParaDistribuir) {
        await enviarMensagemTextoWhapi(chatId, `Você só tem ${ficha.atributos.pontosParaDistribuir} pontos para distribuir. Não pode usar ${pontosADistribuir}.`);
        return;
    }

    ficha.atributos[atributoNome] = (ficha.atributos[atributoNome] || 0) + pontosADistribuir;
    ficha.atributos.pontosParaDistribuir -= pontosADistribuir;

    // Recalcular PV/PM Max ao mudar atributos base que os afetam
    // A função atualizarFichaETransmitir já faz isso
    
    await atualizarFichaETransmitir(chatId, sender, ficha, `Atributo ${atributoNome} aumentado em ${pontosADistribuir}! Novo valor: ${ficha.atributos[atributoNome]}.\nVocê ainda tem ${ficha.atributos.pontosParaDistribuir} pontos para distribuir.`);
}


// --- NOVO COMANDO: Jackpot (Arcádia) ---
async function handleJackpotArcadia(chatId, sender) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) {
        await enviarMensagemTextoWhapi(chatId, "Você precisa de uma ficha em Arcádia para tentar a sorte no Jackpot!");
        return;
    }

    const custoJackpot = 25; // Custo em Florins de Ouro
    if ((ficha.florinsDeOuro || 0) < custoJackpot) {
        await enviarMensagemTextoWhapi(chatId, `Você precisa de ${custoJackpot} Florins de Ouro para girar o Jackpot. Você tem ${ficha.florinsDeOuro || 0} FO.`);
        return;
    }

    ficha.florinsDeOuro -= custoJackpot;
    let premioMsg = "";
    const sorte = Math.random(); 

    if (sorte < 0.01) { 
        const essenciaGanha = 5;
        ficha.essenciaDeArcadia = (ficha.essenciaDeArcadia || 0) + essenciaGanha;
        premioMsg = `🌟✨ JACKPOT LENDÁRIO!!! ✨🌟\nVocê ganhou ${essenciaGanha} Essências de Arcádia e 100 Florins de Ouro! Que sorte incrível!`;
        ficha.florinsDeOuro += 100;
    } else if (sorte < 0.10) { 
        const florinsGanhos = Math.floor(Math.random() * 100) + 50; 
        ficha.florinsDeOuro += florinsGanhos;
        premioMsg = `💰 Sorte Grande! Você ganhou ${florinsGanhos} Florins de Ouro!`;
    } else if (sorte < 0.30) { 
        const florinsGanhos = Math.floor(Math.random() * 40) + 10; 
        ficha.florinsDeOuro += florinsGanhos;
        premioMsg = `🍀 Um bom prêmio! Você ganhou ${florinsGanhos} Florins de Ouro!`;
    } else if (sorte < 0.60) { 
        premioMsg = `💨 Quase! O Jackpot não te deu nada desta vez... apenas o vento.`;
    } else { 
        const pegadinhas = [
            "Você puxa a alavanca e... uma meia velha e fedorenta cai do Jackpot! Que azar!",
            "O Jackpot solta uma fumaça colorida e te entrega um biscoito da sorte. Dentro dele está escrito: 'Tente novamente'.",
            "Você ganhou... um abraço imaginário do Mestre do Jackpot! 🤗",
            "Uma pequena quantia de 5 Florins de Ouro é sua! Melhor que nada, certo?"
        ];
        premioMsg = pegadinhas[Math.floor(Math.random() * pegadinhas.length)];
        if (premioMsg.includes("5 Florins")) ficha.florinsDeOuro += 5;
    }

    await atualizarFichaETransmitir(chatId, sender, ficha, `Você gastou ${custoJackpot} FO no Jackpot...\n${premioMsg}\nSeu saldo: ${ficha.florinsDeOuro} FO, ${ficha.essenciaDeArcadia || 0} EA.`);
}


async function handleComandosArcadia(chatId, senderIsOwner) {
    let resposta = "📜 --- Comandos de Arcádia --- 📜\n\n";
    resposta += "`!arcadia` ou `!bemvindo` - Mensagem de boas-vindas.\n";
    resposta += "`!ping` - Testa a conexão.\n";
    resposta += "`!criar <nome>;<raça>;<classe>;<reino>` - Cria sua ficha em Arcádia.\n";
    resposta += "`!ficha` - Mostra sua ficha atual.\n";
    resposta += "`!distribuirpontos <atributo> <qtd>` - Distribui seus pontos de atributo.\n   (Atributos: forca, agilidade, vitalidade, manaBase, intelecto, carisma)\n";
    resposta += "`!jackpot` - Tente sua sorte! Custa 25 Florins.\n";
    
    if (senderIsOwner) {
        resposta += "\n--- Comandos de Admin (Proprietário) ---\n";
        resposta += "`!ficha <ID_ALVO>` - Mostra a ficha do ID_ALVO (só números).\n";
        resposta += "`!admincriar <ID_ALVO>;<nome>;<raça>;<classe>;<reino>`\n   Cria/sobrescreve ficha para ID_ALVO.\n";
        resposta += "`!adminaddxp <ID_ALVO> <valor>` - Adiciona XP e calcula level up.\n";
        resposta += "`!adminsetnivel <ID_ALVO> <nível>` - Define nível e XP.\n";
        resposta += "`!adminaddflorins <ID_ALVO> <valor>`\n";
        resposta += "`!adminaddessencia <ID_ALVO> <valor>`\n";
        resposta += "`!adminadditem <ID_ALVO> <item>[;qtd;tipo;desc]`\n";
        resposta += "`!admindelitem <ID_ALVO> <item>[;qtd]`\n";
        resposta += "`!adminsetattr <ID_ALVO> <atributo> <valor>`\n";
        resposta += "`!adminaddpontosattr <ID_ALVO> <quantidade>`\n";
    }
        
    // Comandos de edição da própria ficha não precisam ser listados separadamente se o admin já tem os comandos admin.*
    // Mas se quiser deixar explícito para o admin usar os comandos curtos para si:
    // if (senderIsOwner) {
    //     resposta += "\n--- Comandos para Sua Ficha (Admin) ---\n";
    //     resposta += "`!addxp <valor>`\n";
    //     // ... e os outros ...
    // }
    
    resposta += "\n`!comandos` ou `!help` - Mostra esta lista.\n";
    await enviarMensagemTextoWhapi(chatId, resposta);
}

// --- FUNÇÃO PARA ENVIAR MENSAGENS (sem alterações) ---
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
// --- BLOCO 2 (REVISADO) TERMINA AQUI ---
// O próximo bloco começará com a rota app.post('/webhook/whatsapp', ...)
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
                                    `XP de [NOME_PERSONAGEM_ALVO] atualizado.`, // Mensagem mais específica virá do callback
                                    "Uso: `!adminaddxp <ID_ALVO> <valor>`");
                                break;
                            case 'adminsetnivel':
                                await handleAdminComandoFichaArcadia(chatId, args, 'setnivel', modificarNivelArcadia,
                                    `Nível de [NOME_PERSONAGEM_ALVO] atualizado.`,
                                    "Uso: `!adminsetnivel <ID_ALVO> <nível>`");
                                break;
                            case 'adminaddflorins': // Nome do comando mudou
                                await handleAdminComandoFichaArcadia(chatId, args, 'addflorins', modificarFlorins,
                                    `Florins de [NOME_PERSONAGEM_ALVO] atualizados.`,
                                    "Uso: `!adminaddflorins <ID_ALVO> <valor>`");
                                break;
                            case 'adminaddessencia': // Novo comando para Essência
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
                            case 'addxp': // Owner usando para si mesmo
                                await handleAddXPArcadia(chatId, sender, args);
                                break;
                            case 'setnivel':
                                await handleSetNivelArcadia(chatId, sender, args);
                                break;
                            case 'addflorins': // Owner usando para si mesmo
                                await handleAddFlorins(chatId, sender, args);
                                break;
                            case 'addessencia': // Owner usando para si mesmo
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
                        // Jogador Permitido tentou um comando que não é 'ping', 'criar', 'ficha', 'distribuirpontos', 'jackpot' ou 'comandos'
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
    
    
