// Nome do arquivo: bot_baileys.js

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');

// --- CONFIGURAÇÃO DE AMBIENTE E IDs ---
const OWNER_ID = process.env.OWNER_ID ? process.env.OWNER_ID.trim() : "";
const JOGADORES_PERMITIDOS_IDS_STRING = process.env.JOGADORES_PERMITIDOS_IDS || "";
const listaJogadoresPermitidos = new Set(
    JOGADORES_PERMITIDOS_IDS_STRING.split(',')
        .map(id => id.trim())
        .filter(id => id) // Remove entradas vazias se houver vírgulas extras
);

// --- MODELO DA FICHA DE PERSONAGEM ---
// (fichaModelo permanece o mesmo)
const fichaModelo = {
    nomeJogadorSalvo: "",
    nomePersonagem: "N/A",
    idadePersonagem: 11,
    casa: "A Ser Definida",
    anoEmHogwarts: 1,
    carreira: "Estudante",
    ultimaAtualizacao: "",
    nivelAtual: 1,
    xpAtual: 0,
    xpProximoNivel: 100,
    pontosDeVidaMax: 100,
    pontosDeVidaAtual: 100,
    pontosDeMagiaMax: 50,
    pontosDeMagiaAtual: 50,
    atributos: {
        inteligencia: 5, forca: 5, constituicao: 5,
        destreza: 5, carisma: 5, agilidade: 5,
        pontosParaDistribuir: 0
    },
    galeoes: 50,
    habilidadesFeiticos: [],
    inventario: [
        { itemNome: "Varinha Comum", quantidade: 1, tipo: "Varinha", descricao: "Uma varinha simples, mas funcional." },
        { itemNome: "Uniforme de Hogwarts", quantidade: 1, tipo: "Vestimenta" },
        { itemNome: "Kit de Livros do Primeiro Ano", quantidade: 1, tipo: "Livro" }
    ],
    pet: null,
    aptidoesMaterias: [],
    logConquistas: [],
    notacoesDM: ""
};

// --- CONFIGURAÇÃO DO MONGODB ---
// (Configuração do MongoDB permanece a mesma)
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'rpg_harry_potter_db';
const MONGODB_FICHAS_COLLECTION = process.env.MONGODB_FICHAS_COLLECTION || 'fichas_personagens';

if (!MONGODB_URI) {
    console.error("--- ERRO FATAL: Variável de ambiente MONGODB_URI não definida! ---");
    process.exit(1);
}
if (!OWNER_ID) {
    console.warn("--- ALERTA: Variável de ambiente OWNER_ID não definida! O bot pode não ter restrição total de proprietário. ---");
}
if (JOGADORES_PERMITIDOS_IDS_STRING) {
    console.log("Jogadores permitidos carregados:", Array.from(listaJogadoresPermitidos));
} else {
    console.log("Nenhum jogador adicional permitido via JOGADORES_PERMITIDOS_IDS.");
}


let dbClient;
let fichasCollection;
let todasAsFichas = {};

// (conectarMongoDB, carregarFichasDoDB, salvarFichaNoDB permanecem os mesmos)
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
            const idJogador = fichaDB._id.toString();
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

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const WHAPI_API_TOKEN = process.env.WHAPI_API_TOKEN;
const WHAPI_BASE_URL = "https://gate.whapi.cloud";

if (!WHAPI_API_TOKEN) {
    console.error("FATAL_ERROR: Variável de ambiente WHAPI_API_TOKEN não está definida no Render!");
}

// --- FUNÇÕES AUXILIARES ---
async function getFichaOuCarregar(idAlvo) {
    // ... (getFichaOuCarregar permanece a mesma)
    const idAlvoTrimmado = String(idAlvo).trim();
    let ficha = todasAsFichas[idAlvoTrimmado];
    if (!ficha && fichasCollection) {
        console.log(`Ficha para ${idAlvoTrimmado} não encontrada no cache, buscando no DB...`);
        try {
            const fichaDB = await fichasCollection.findOne({ _id: idAlvoTrimmado });
            if (fichaDB) {
                todasAsFichas[idAlvoTrimmado] = { ...fichaDB };
                ficha = todasAsFichas[idAlvoTrimmado];
                console.log(`Ficha para ${idAlvoTrimmado} carregada do DB para o cache.`);
            }
        } catch (dbError) {
            console.error(`Erro ao buscar ficha ${idAlvoTrimmado} no DB:`, dbError);
        }
    }
    return ficha;
}

async function atualizarFichaETransmitir(chatId, idAlvo, ficha, mensagemSucesso, nomePersonagemAlvo = null) {
    // ... (atualizarFichaETransmitir permanece a mesma)
    const idAlvoTrimmado = String(idAlvo).trim();
    ficha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    todasAsFichas[idAlvoTrimmado] = ficha;
    await salvarFichaNoDB(idAlvoTrimmado, ficha);
    
    let msgFinal = mensagemSucesso;
    if (nomePersonagemAlvo) { 
        msgFinal = mensagemSucesso.replace("[NOME_PERSONAGEM_ALVO]", nomePersonagemAlvo);
    } else if (ficha.nomePersonagem && msgFinal.includes("[NOME_PERSONAGEM_ALVO]")) {
        msgFinal = msgFinal.replace("[NOME_PERSONAGEM_ALVO]", ficha.nomePersonagem);
    }
    await enviarMensagemTextoWhapi(chatId, msgFinal);
}

// --- FUNÇÕES DE COMANDO DO RPG ---
// (handleCriarFicha, handleAdminCriarFicha, e os handles para XP, Nível, Galeões, Itens da ficha PRÓPRIA do OWNER_ID permanecem os mesmos)
// ... (COLE AQUI AS FUNÇÕES: handleCriarFicha, handleAdminCriarFicha, handleAddXP, handleSetNivel, handleAddGaleoes, handleAddItem, handleDelItem da versão anterior) ...
// Coloquei as funções novamente abaixo para garantir que esteja completo.

async function handleCriarFicha(chatId, sender, senderName, args) {
    const idJogador = sender; 
    if (todasAsFichas[idJogador]) {
        await enviarMensagemTextoWhapi(chatId, `Você já possui um personagem: ${todasAsFichas[idJogador].nomePersonagem}. Por enquanto, apenas um personagem por jogador.`);
        return;
    }
    // (Resto da lógica de handleCriarFicha igual)
    const dadosComando = args.join(' ');
    const partes = dadosComando.split(';').map(p => p.trim());
    if (partes.length < 3) {
        await enviarMensagemTextoWhapi(chatId, "Formato incorreto! Uso: `!criar Nome do Personagem; Casa; Idade; [Carreira]`\nExemplo: `!criar Harry Potter; Grifinória; 11; Apanhador`");
        return;
    }
    const nomePersonagemInput = partes[0];
    const casaInput = partes[1];
    const idadeInput = parseInt(partes[2]);
    const carreiraInput = partes[3] || "Estudante";
    const casasValidas = ["grifinória", "sonserina", "corvinal", "lufa-lufa"];
    if (!casasValidas.includes(casaInput.toLowerCase())) {
        await enviarMensagemTextoWhapi(chatId, `Casa "${casaInput}" inválida. As casas são: Grifinória, Sonserina, Corvinal, Lufa-Lufa.`);
        return;
    }
    if (isNaN(idadeInput) || idadeInput < 11 || idadeInput > 18) {
        await enviarMensagemTextoWhapi(chatId, `Idade "${idadeInput}" inválida. Deve ser um número entre 11 e 18 para estudantes.`);
        return;
    }
    const anoCalculado = Math.max(1, Math.min(7, idadeInput - 10));
    let novaFicha = JSON.parse(JSON.stringify(fichaModelo));
    novaFicha.nomeJogadorSalvo = senderName;
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.idadePersonagem = idadeInput;
    novaFicha.casa = casaInput.charAt(0).toUpperCase() + casaInput.slice(1).toLowerCase();
    novaFicha.anoEmHogwarts = anoCalculado;
    novaFicha.carreira = carreiraInput;
    await atualizarFichaETransmitir(chatId, idJogador, novaFicha, `🎉 Personagem ${nomePersonagemInput} da casa ${novaFicha.casa}, ano ${novaFicha.anoEmHogwarts}, foi criado para você!\nUse \`!ficha\` para ver os detalhes.`);
}

async function handleAdminCriarFicha(chatId, senderOwner, argsAdmin) {
    // (Lógica de handleAdminCriarFicha igual)
    const comandoCompleto = argsAdmin.join(" ");
    const partesPrincipais = comandoCompleto.split(';');
    if (partesPrincipais.length < 4) {
        await enviarMensagemTextoWhapi(chatId, "Formato incorreto! Uso: `!admincriar ID_ALVO;Nome Personagem;Casa;Idade;[Carreira]`\nO ID_ALVO é só o número de telefone (ex: 5577999939113).");
        return;
    }
    const idJogadorAlvo = partesPrincipais[0].trim();
    const nomePersonagemInput = partesPrincipais[1].trim();
    const casaInput = partesPrincipais[2].trim();
    const idadeInputStr = partesPrincipais[3].trim();
    const carreiraInput = partesPrincipais[4] ? partesPrincipais[4].trim() : "Estudante";

    if (!/^\d+$/.test(idJogadorAlvo)) {
        await enviarMensagemTextoWhapi(chatId, `ID do Jogador Alvo (${idJogadorAlvo}) inválido. Deve conter apenas números.`);
        return;
    }
    const idadeInput = parseInt(idadeInputStr);
    const casasValidas = ["grifinória", "sonserina", "corvinal", "lufa-lufa"];
    if (!casasValidas.includes(casaInput.toLowerCase())) {
        await enviarMensagemTextoWhapi(chatId, `Casa "${casaInput}" inválida para o jogador ${idJogadorAlvo}. Casas: Grifinória, Sonserina, Corvinal, Lufa-Lufa.`);
        return;
    }
    if (isNaN(idadeInput) || idadeInput < 11 || idadeInput > 100) {
        await enviarMensagemTextoWhapi(chatId, `Idade "${idadeInputStr}" inválida para o jogador ${idJogadorAlvo}. Deve ser um número (11-18 para estudantes, ou mais para outros).`);
        return;
    }
    const anoCalculado = (idadeInput >= 11 && idadeInput <= 18) ? Math.max(1, Math.min(7, idadeInput - 10)) : 0;

    let novaFicha = JSON.parse(JSON.stringify(fichaModelo));
    novaFicha.nomeJogadorSalvo = `(Admin) ${idJogadorAlvo}`;
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.idadePersonagem = idadeInput;
    novaFicha.casa = casaInput.charAt(0).toUpperCase() + casaInput.slice(1).toLowerCase();
    novaFicha.anoEmHogwarts = anoCalculado || (idadeInput < 11 ? 0 : novaFicha.anoEmHogwarts);
    novaFicha.carreira = carreiraInput;
    
    todasAsFichas[idJogadorAlvo] = novaFicha;
    await atualizarFichaETransmitir(chatId, idJogadorAlvo, novaFicha, `🎉 [Admin] Personagem ${nomePersonagemInput} da casa ${novaFicha.casa} CRIADO/ATUALIZADO para o ID ${idJogadorAlvo}.`);
}


// --- COMANDOS PARA MODIFICAR ATRIBUTOS (ADMIN) ---
async function handleAdminSetAtributo(chatId, args) {
    if (args.length < 3) { // ID_ALVO, atributo, valor
        await enviarMensagemTextoWhapi(chatId, "Uso: `!adminsetattr <ID_ALVO> <atributo> <valor>`\nAtributos: inteligencia, forca, constituicao, destreza, carisma, agilidade.");
        return;
    }
    const idAlvo = args[0].trim();
    const atributoNome = args[1].toLowerCase().trim();
    const valor = parseInt(args[2]);

    if (!/^\d+$/.test(idAlvo)) {
        await enviarMensagemTextoWhapi(chatId, `ID do Jogador Alvo (${idAlvo}) inválido.`);
        return;
    }
    const atributosValidos = ["inteligencia", "forca", "constituicao", "destreza", "carisma", "agilidade"];
    if (!atributosValidos.includes(atributoNome)) {
        await enviarMensagemTextoWhapi(chatId, `Atributo "${atributoNome}" inválido. Válidos: ${atributosValidos.join(", ")}.`);
        return;
    }
    if (isNaN(valor)) {
        await enviarMensagemTextoWhapi(chatId, `Valor para ${atributoNome} deve ser um número.`);
        return;
    }

    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) {
        await enviarMensagemTextoWhapi(chatId, `Ficha não encontrada para o ID ${idAlvo}.`);
        return;
    }

    fichaAlvo.atributos[atributoNome] = valor;
    await atualizarFichaETransmitir(chatId, idAlvo, fichaAlvo, `[Admin] Atributo ${atributoNome} de ${fichaAlvo.nomePersonagem || idAlvo} definido para ${valor}.`);
}

async function handleAdminAddPontosAtributo(chatId, args) {
    if (args.length < 2) { // ID_ALVO, quantidade
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
        await enviarMensagemTextoWhapi(chatId, `Ficha não encontrada para o ID ${idAlvo}.`);
        return;
    }
    if (!fichaAlvo.atributos) fichaAlvo.atributos = {}; // Garante que o objeto atributos exista
    fichaAlvo.atributos.pontosParaDistribuir = (fichaAlvo.atributos.pontosParaDistribuir || 0) + quantidade;
    if (fichaAlvo.atributos.pontosParaDistribuir < 0) fichaAlvo.atributos.pontosParaDistribuir = 0;

    await atualizarFichaETransmitir(chatId, idAlvo, fichaAlvo, `[Admin] Pontos para distribuir de ${fichaAlvo.nomePersonagem || idAlvo} ajustados para ${fichaAlvo.atributos.pontosParaDistribuir}.`);
}


// (handleVerFicha, handleAddXP, etc. para a própria ficha do OWNER permanecem os mesmos, mas usando await getFichaOuCarregar)
// --- As funções de manipulação da própria ficha do OWNER agora também usam getFichaOuCarregar ---
async function handleVerFicha(chatId, sender, args) {
    let idAlvoConsulta = sender;
    let adminConsultandoOutro = false;
    let nomeAlvoDisplay = "Você";

    if (args.length > 0 && sender === OWNER_ID) {
        const idPotencial = args[0].trim();
        if (/^\d+$/.test(idPotencial)) {
            idAlvoConsulta = idPotencial;
            adminConsultandoOutro = true;
            nomeAlvoDisplay = `o jogador ${idAlvoConsulta}`;
            console.log(`[Admin] ${sender} está consultando a ficha do ID_ALVO: ${idAlvoConsulta}`);
        } else {
            await enviarMensagemTextoWhapi(chatId, "ID do jogador alvo inválido. Forneça apenas números para o ID.");
            return;
        }
    }
    
    const ficha = await getFichaOuCarregar(idAlvoConsulta);

    if (!ficha) {
        const msgErro = adminConsultandoOutro 
            ? `❌ Ficha não encontrada para o ID ${idAlvoConsulta}. Use \`!admincriar\` para criar uma.`
            : "❌ Você ainda não tem um personagem. Use o comando `!criar` para criar um.";
        await enviarMensagemTextoWhapi(chatId, msgErro);
        return;
    }
    // (Resto da formatação da ficha igual ao código anterior)
    let resposta = `🌟 --- Ficha de ${ficha.nomePersonagem} (@${idAlvoConsulta}) --- 🌟\n`;
    if (ficha.nomeJogadorSalvo) resposta += `🧙‍♂️ Jogador: ${ficha.nomeJogadorSalvo}\n`;
    resposta += `📜 Nome Personagem: ${ficha.nomePersonagem}\n`;
    resposta += `🎂 Idade: ${ficha.idadePersonagem} (Ano: ${ficha.anoEmHogwarts})\n`;
    resposta += `🏰 Casa: ${ficha.casa}\n`;
    resposta += `🧑‍🏫 Carreira: ${ficha.carreira}\n`;
    resposta += `✨ Nível: ${ficha.nivelAtual} (XP: ${ficha.xpAtual}/${ficha.xpProximoNivel})\n`;
    resposta += `❤️ HP: ${ficha.pontosDeVidaAtual}/${ficha.pontosDeVidaMax}\n`;
    resposta += `🔮 MP: ${ficha.pontosDeMagiaAtual}/${ficha.pontosDeMagiaMax}\n`;
    resposta += `💰 Galeões: ${ficha.galeoes}G\n`;
    resposta += "\n🧠 Atributos:\n";
    if (ficha.atributos) {
        for (const [attr, valor] of Object.entries(ficha.atributos)) {
            const nomeAttrCapitalized = attr.charAt(0).toUpperCase() + attr.slice(1);
            if (attr !== "pontosParaDistribuir") {
                resposta += `  ☆ ${nomeAttrCapitalized}: ${valor}\n`;
            }
        }
        if (ficha.atributos.pontosParaDistribuir > 0) {
            resposta += `  ✨ ${adminConsultandoOutro ? `O jogador tem` : `Você tem`} ${ficha.atributos.pontosParaDistribuir} pontos para distribuir${adminConsultandoOutro ? '.' : ' (`!distribuiratributo`).'}\n`;
        }
    } else {
        resposta += "  (Atributos não definidos)\n";
    }
    resposta += "\n📜 Feitiços:\n";
    if (ficha.habilidadesFeiticos && ficha.habilidadesFeiticos.length > 0) {
        ficha.habilidadesFeiticos.forEach(f => {
            resposta += `  ☆ ${f.nome} (Nvl ${f.nivel || 1})\n`;
        });
    } else {
        resposta += "  (Nenhum)\n";
    }
    resposta += "\n🎒 Inventário:\n";
    if (ficha.inventario && ficha.inventario.length > 0) {
        ficha.inventario.forEach(i => {
            resposta += `  ☆ ${i.itemNome} (Qtd: ${i.quantidade || 1}) ${i.descricao ? '- ' + i.descricao : ''}\n`;
        });
    } else {
        resposta += "  (Vazio)\n";
    }
    if (ficha.pet) {
        resposta += "\n🐾 Pet:\n";
        resposta += `  ☆ Nome: ${ficha.pet.nomePet || 'N/A'}\n`;
        resposta += `  ☆ Espécie: ${ficha.pet.especieRaca || 'N/A'}\n`;
        resposta += `  ☆ Afeto/Nível: ${ficha.pet.afetoPet || 0}\n`;
        if(ficha.pet.habilidadesPet && ficha.pet.habilidadesPet.length > 0){
            resposta += `  ☆ Habilidades: ${ficha.pet.habilidadesPet.join(', ')}\n`;
        }
    }
    resposta += `\n🕒 Última atualização: ${ficha.ultimaAtualizacao || 'N/A'}\n`;
    await enviarMensagemTextoWhapi(chatId, resposta);
}


async function handleAddXP(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender); // Usa a nova função
    if (!ficha) { /* ... (mesma lógica de antes) ... */ 
        await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada. Crie uma com `!criar`.");
        return;
    }
    if (args.length === 0 || isNaN(parseInt(args[0]))) {
        await enviarMensagemTextoWhapi(chatId, "Uso: `!addxp <valor_numerico>`.\nExemplo: `!addxp 50` ou `!addxp -10`");
        return;
    }
    const valorXP = parseInt(args[0]);
    ficha.xpAtual += valorXP;
    await atualizarFichaETransmitir(chatId, sender, ficha, `XP atualizado! Você agora tem ${ficha.xpAtual} XP. (Próximo nível: ${ficha.xpProximoNivel} XP)`);
}

async function handleSetNivel(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { /* ... */ 
        await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada.");
        return;
    }
    if (args.length === 0 || isNaN(parseInt(args[0])) || parseInt(args[0]) < 1) {
        await enviarMensagemTextoWhapi(chatId, "Uso: `!setnivel <novo_nivel_numerico_maior_que_0>`.\nExemplo: `!setnivel 3`");
        return;
    }
    const novoNivel = parseInt(args[0]);
    ficha.nivelAtual = novoNivel;
    ficha.xpAtual = 0;
    ficha.xpProximoNivel = novoNivel * 100;
        await atualizarFichaETransmitir(chatId, sender, ficha, `Nível atualizado para ${ficha.nivelAtual}. XP zerado. Próximo nível requer ${ficha.xpProximoNivel} XP.`);
} // Fim da função handleSetNivel

async function handleAddGaleoes(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { 
        await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada.");
        return;
    }
    if (args.length === 0 || isNaN(parseInt(args[0]))) {
        await enviarMensagemTextoWhapi(chatId, "Uso: `!addgaleoes <valor_numerico>`.\nExemplo: `!addgaleoes 100` ou `!addgaleoes -20`");
        return;
    }
    const valorGaleoes = parseInt(args[0]);
    ficha.galeoes += valorGaleoes;
    if (ficha.galeoes < 0) ficha.galeoes = 0;
    await atualizarFichaETransmitir(chatId, sender, ficha, `Galeões atualizados! Você agora tem ${ficha.galeoes}G.`);
}

async function handleAddItem(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { 
        await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada.");
        return;
    }
    const inputCompleto = args.join(" ");
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) {
        await enviarMensagemTextoWhapi(chatId, "Uso: `!additem <nome do item>[;quantidade;tipo;descricao]`\nExemplo: `!additem Poção Wiggenweld;2;Poção;Cura ferimentos leves`");
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
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemExistenteIndex > -1) {
        ficha.inventario[itemExistenteIndex].quantidade = (ficha.inventario[itemExistenteIndex].quantidade || 0) + quantidade;
        if (descricaoItem && !ficha.inventario[itemExistenteIndex].descricao) ficha.inventario[itemExistenteIndex].descricao = descricaoItem;
        if (tipoItem !== "Item" && !ficha.inventario[itemExistenteIndex].tipo) ficha.inventario[itemExistenteIndex].tipo = tipoItem;
         await atualizarFichaETransmitir(chatId, sender, ficha, `Quantidade de "${nomeItem}" aumentada para ${ficha.inventario[itemExistenteIndex].quantidade}.`);
    } else {
        ficha.inventario.push({ itemNome: nomeItem, quantidade: quantidade, tipo: tipoItem, descricao: descricaoItem });
        await atualizarFichaETransmitir(chatId, sender, ficha, `"${nomeItem}" (x${quantidade}) adicionado ao seu inventário.`);
    }
}

async function handleDelItem(chatId, sender, args) {
    const ficha = await getFichaOuCarregar(sender);
    if (!ficha) { 
        await enviarMensagemTextoWhapi(chatId, "Sua ficha não foi encontrada.");
        return;
    }
    const inputCompleto = args.join(" ");
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) {
        await enviarMensagemTextoWhapi(chatId, "Uso: `!delitem <nome do item>[;quantidade]`\nExemplo: `!delitem Varinha Quebrada;1`");
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

async function handleAdminComandoFicha(chatId, args, tipoComando, callbackModificacao, mensagemSucessoPadrao, mensagemErroUso) {
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
        await enviarMensagemTextoWhapi(chatId, `Ficha não encontrada para o ID ${idAlvo}. Use \`!admincriar\` primeiro.`);
        return;
    }
    
    let fichaModificada = JSON.parse(JSON.stringify(fichaAlvo));
    const resultadoCallback = callbackModificacao(fichaModificada, args.slice(1)); 

    if (resultadoCallback === false) { 
        await enviarMensagemTextoWhapi(chatId, mensagemErroUso);
        return;
    }
    if (typeof resultadoCallback === 'string' && resultadoCallback.startsWith("ERRO:")) {
        await enviarMensagemTextoWhapi(chatId, resultadoCallback.substring(5)); // Remove "ERRO:"
        return;
    }
    
    const mensagemSucessoFinal = (typeof resultadoCallback === 'string') ? resultadoCallback : mensagemSucessoPadrao;

    await atualizarFichaETransmitir(chatId, idAlvo, fichaModificada, mensagemSucessoFinal, fichaModificada.nomePersonagem || idAlvo);
}

function modificarXP(ficha, argsValor) {
    const valorXP = parseInt(argsValor[0]);
    if (isNaN(valorXP)) { return "ERRO: Valor de XP inválido.";  }
    ficha.xpAtual += valorXP;
    return `XP de [NOME_PERSONAGEM_ALVO] atualizado para ${ficha.xpAtual}.`;
}
function modificarNivel(ficha, argsValor) {
    const novoNivel = parseInt(argsValor[0]);
    if (isNaN(novoNivel) || novoNivel < 1) return "ERRO: Nível inválido.";
    ficha.nivelAtual = novoNivel;
    ficha.xpAtual = 0;
    ficha.xpProximoNivel = novoNivel * 100;
    return `Nível de [NOME_PERSONAGEM_ALVO] atualizado para ${ficha.nivelAtual}. XP zerado.`;
}
function modificarGaleoes(ficha, argsValor) {
    const valorGaleoes = parseInt(argsValor[0]);
    if (isNaN(valorGaleoes)) return "ERRO: Valor de Galeões inválido.";
    ficha.galeoes += valorGaleoes;
    if (ficha.galeoes < 0) ficha.galeoes = 0;
    return `Galeões de [NOME_PERSONAGEM_ALVO] atualizados para ${ficha.galeoes}G.`;
}
function modificarAddItem(ficha, argsItem) {
    const inputCompleto = argsItem.join(" ");
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) return "ERRO: Nome do item obrigatório.";
    const nomeItem = partesItem[0];
    const quantidade = partesItem[1] ? parseInt(partesItem[1]) : 1;
    const tipoItem = partesItem[2] || "Item";
    const descricaoItem = partesItem[3] || "";
    if (isNaN(quantidade) || quantidade < 1) return "ERRO: Quantidade inválida.";
    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemExistenteIndex > -1) {
        ficha.inventario[itemExistenteIndex].quantidade = (ficha.inventario[itemExistenteIndex].quantidade || 0) + quantidade;
        if (descricaoItem && !ficha.inventario[itemExistenteIndex].descricao) ficha.inventario[itemExistenteIndex].descricao = descricaoItem;
        if (tipoItem !== "Item" && !ficha.inventario[itemExistenteIndex].tipo) ficha.inventario[itemExistenteIndex].tipo = tipoItem;
        return `Quantidade de "${nomeItem}" aumentada para ${ficha.inventario[itemExistenteIndex].quantidade} para [NOME_PERSONAGEM_ALVO].`;
    } else {
        ficha.inventario.push({ itemNome: nomeItem, quantidade: quantidade, tipo: tipoItem, descricao: descricaoItem });
        return `"${nomeItem}" (x${quantidade}) adicionado ao inventário de [NOME_PERSONAGEM_ALVO].`;
    }
}
function modificarDelItem(ficha, argsItem) {
    const inputCompleto = argsItem.join(" ");
    const partesItem = inputCompleto.split(';').map(p => p.trim());
    if (partesItem.length === 0 || !partesItem[0]) return "ERRO: Nome do item obrigatório.";
    const nomeItem = partesItem[0];
    const quantidadeRemover = partesItem[1] ? parseInt(partesItem[1]) : 1;
    if (isNaN(quantidadeRemover) || quantidadeRemover < 1) return "ERRO: Quantidade a remover inválida.";
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

async function handleAdminSetAtributo(chatId, args) {
    if (args.length < 3) { 
        await enviarMensagemTextoWhapi(chatId, "Uso: `!adminsetattr <ID_ALVO> <atributo> <valor>`\nAtributos: inteligencia, forca, constituicao, destreza, carisma, agilidade.");
        return;
    }
    const idAlvo = args[0].trim();
    const atributoNome = args[1].toLowerCase().trim();
    const valor = parseInt(args[2]);

    if (!/^\d+$/.test(idAlvo)) {
        await enviarMensagemTextoWhapi(chatId, `ID do Jogador Alvo (${idAlvo}) inválido.`);
        return;
    }
    const atributosValidos = ["inteligencia", "forca", "constituicao", "destreza", "carisma", "agilidade"];
    if (!atributosValidos.includes(atributoNome)) {
        await enviarMensagemTextoWhapi(chatId, `Atributo "${atributoNome}" inválido. Válidos: ${atributosValidos.join(", ")}.`);
        return;
    }
    if (isNaN(valor)) {
        await enviarMensagemTextoWhapi(chatId, `Valor para ${atributoNome} deve ser um número.`);
        return;
    }

    const fichaAlvo = await getFichaOuCarregar(idAlvo);
    if (!fichaAlvo) {
        await enviarMensagemTextoWhapi(chatId, `Ficha não encontrada para o ID ${idAlvo}.`);
        return;
    }
    if (!fichaAlvo.atributos) fichaAlvo.atributos = JSON.parse(JSON.stringify(fichaModelo.atributos)); // Garante que o objeto atributos exista e tenha a estrutura padrão
    fichaAlvo.atributos[atributoNome] = valor;
    await atualizarFichaETransmitir(chatId, idAlvo, fichaAlvo, `[Admin] Atributo ${atributoNome} de [NOME_PERSONAGEM_ALVO] definido para ${valor}.`, fichaAlvo.nomePersonagem || idAlvo);
}

async function handleAdminAddPontosAtributo(chatId, args) {
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
        await enviarMensagemTextoWhapi(chatId, `Ficha não encontrada para o ID ${idAlvo}.`);
        return;
    }
    if (!fichaAlvo.atributos) fichaAlvo.atributos = JSON.parse(JSON.stringify(fichaModelo.atributos)); 
    fichaAlvo.atributos.pontosParaDistribuir = (fichaAlvo.atributos.pontosParaDistribuir || 0) + quantidade;
    if (fichaAlvo.atributos.pontosParaDistribuir < 0) fichaAlvo.atributos.pontosParaDistribuir = 0;

    await atualizarFichaETransmitir(chatId, idAlvo, fichaAlvo, `[Admin] Pontos para distribuir de [NOME_PERSONAGEM_ALVO] ajustados para ${fichaAlvo.atributos.pontosParaDistribuir}.`, fichaAlvo.nomePersonagem || idAlvo);
}


async function handleComandos(chatId, senderIsOwner) {
    let resposta = "📜 --- Lista de Comandos --- 📜\n\n";
    resposta += "`!ping` - Testa a conexão.\n";
    resposta += "`!criar <nome>;<casa>;<idade>[;carreira]` - Cria sua ficha (limite 1 por jogador).\n";
    resposta += "`!ficha` - Mostra sua ficha atual.\n";
    
    if (senderIsOwner) {
        resposta += "\n--- Comandos de Admin (Proprietário) ---\n";
        resposta += "`!ficha <ID_ALVO>` - Mostra a ficha do ID_ALVO (só números).\n";
        resposta += "`!admincriar <ID_ALVO>;<nome>;<casa>;<idade>[;carreira]`\n   Cria/sobrescreve ficha para ID_ALVO.\n";
        resposta += "`!adminaddxp <ID_ALVO> <valor>`\n";
        resposta += "`!adminsetnivel <ID_ALVO> <nível>`\n";
        resposta += "`!adminaddgaleoes <ID_ALVO> <valor>`\n";
        resposta += "`!adminadditem <ID_ALVO> <item>[;qtd;tipo;desc]`\n";
        resposta += "`!admindelitem <ID_ALVO> <item>[;qtd]`\n";
        resposta += "`!adminsetattr <ID_ALVO> <atributo> <valor>`\n   (Atributos: inteligencia, forca, etc.)\n";
        resposta += "`!adminaddpontosattr <ID_ALVO> <quantidade>`\n";
    }
    
    resposta += "\n--- Comandos para Sua Ficha (se você for o proprietário ou um jogador permitido) ---\n";
    resposta += "`!addxp <valor>`\n";
    resposta += "`!setnivel <nível>`\n";
    resposta += "`!addgaleoes <valor>`\n";
    resposta += "`!additem <nome>[;qtd;tipo;desc]`\n";
    resposta += "`!delitem <nome>[;qtd]`\n";
    
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

                if (!isOwner && !isJogadorPermitido) {
                    console.log(`[Webhook] Usuário ${senderName} (${sender}) não é proprietário nem jogador permitido. Comando ignorado.`);
                    continue;
                }

                if (textContent && textContent.startsWith('!')) {
                    const args = textContent.slice(1).trim().split(/ +/g);
                    const comando = args.shift().toLowerCase();
                    
                    let preLog = isOwner ? "[Proprietário]" : (isJogadorPermitido ? "[Jogador Permitido]" : "[NÃO AUTORIZADO]");
                    console.log(`[Webhook] ${preLog} COMANDO: '!${comando}' | Args: [${args.join(', ')}] | De: ${senderName} (${sender}) | Chat: ${chatId}`);

                    // Comandos permitidos para TODOS (Owner E Jogadores Permitidos)
                    if (comando === 'ping') { // Removido && (isOwner || isJogadorPermitido) pois a checagem geral já foi feita
                        await enviarMensagemTextoWhapi(chatId, `Pong! Olá, ${senderName}! Estou funcionando! 🧙✨`);
                    } else if (comando === 'criar') { // Removido && (isOwner || isJogadorPermitido)
                        await handleCriarFicha(chatId, sender, senderName, args);
                    } else if (comando === 'ficha' || comando === 'minhaficha' || comando === 'verficha') { // Removido && (isOwner || isJogadorPermitido)
                        if (isOwner && args.length > 0 && comando !== 'minhaficha') {
                            await handleVerFicha(chatId, sender, args); // Owner vendo ficha de outro
                        } else {
                            await handleVerFicha(chatId, sender, []); // Jogador vendo a própria ficha (ou owner vendo a própria)
                        }
                    } else if (comando === 'comandos' || comando === 'help') { // Removido && (isOwner || isJogadorPermitido)
                        await handleComandos(chatId, isOwner); // Mostra comandos de acordo com o nível de acesso
                    }
                    // Comandos EXCLUSIVOS DO OWNER ou para o OWNER editar A PRÓPRIA FICHA
                    else if (isOwner) {
                        switch (comando) {
                            // Comandos de admin para gerenciar fichas de outros
                            case 'admincriar':
                                await handleAdminCriarFicha(chatId, sender, args);
                                break;
                            case 'adminaddxp':
                                await handleAdminComandoFicha(chatId, args, 'addxp', modificarXP, 
                                    `XP de [NOME_PERSONAGEM_ALVO] atualizado.`, 
                                    "Uso: `!adminaddxp <ID_ALVO> <valor>`");
                                break;
                            case 'adminsetnivel':
                                await handleAdminComandoFicha(chatId, args, 'setnivel', modificarNivel,
                                    `Nível de [NOME_PERSONAGEM_ALVO] atualizado.`,
                                    "Uso: `!adminsetnivel <ID_ALVO> <nível>`");
                                break;
                            case 'adminaddgaleoes':
                                await handleAdminComandoFicha(chatId, args, 'addgaleoes', modificarGaleoes,
                                    `Galeões de [NOME_PERSONAGEM_ALVO] atualizados.`,
                                    "Uso: `!adminaddgaleoes <ID_ALVO> <valor>`");
                                break;
                            case 'adminadditem':
                                await handleAdminComandoFicha(chatId, args, 'additem', modificarAddItem,
                                    `Inventário de [NOME_PERSONAGEM_ALVO] atualizado.`, 
                                    "Uso: `!adminadditem <ID_ALVO> <nome>[;qtd;tipo;desc]`");
                                break;
                            case 'admindelitem':
                                await handleAdminComandoFicha(chatId, args, 'delitem', modificarDelItem,
                                    `Inventário de [NOME_PERSONAGEM_ALVO] atualizado.`, 
                                    "Uso: `!admindelitem <ID_ALVO> <nome>[;qtd]`");
                                break;
                            case 'adminsetattr':
                                await handleAdminSetAtributo(chatId, args);
                                break;
                            case 'adminaddpontosattr':
                                await handleAdminAddPontosAtributo(chatId, args);
                                break;
                            // Comandos para o OWNER modificar A PRÓPRIA FICHA
                            case 'addxp':
                                await handleAddXP(chatId, sender, args);
                                break;
                            case 'setnivel':
                                await handleSetNivel(chatId, sender, args);
                                break;
                            case 'addgaleoes':
                                await handleAddGaleoes(chatId, sender, args);
                                break;
                            case 'additem':
                                await handleAddItem(chatId, sender, args);
                                break;
                            case 'delitem':
                                await handleDelItem(chatId, sender, args);
                                break;
                            default:
                                await enviarMensagemTextoWhapi(chatId, `Comando "!${comando}" (possivelmente de Admin) não reconhecido.`);
                                break;
                        }
                    } else {
                        // Se chegou aqui, é um Jogador Permitido tentando um comando que não é 'ping', 'criar', 'ficha', ou 'comandos'
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
            } // Fim do loop for (const messageData of req.body.messages)
        } else {
            console.log("[Webhook] Estrutura inesperada ou sem mensagens:", req.body);
        }
    } catch (error) {
        console.error("Erro CRÍTICO ao processar webhook do Whapi:", error.message, error.stack);
    }
    res.status(200).send('OK');
}); // Fim do app.post('/webhook/whatsapp')

// --- ROTA DE TESTE E INICIALIZAÇÃO DO SERVIDOR ---
app.get('/', (req, res) => {
    res.send('Servidor do Bot de RPG (Whapi no Render com MongoDB - Multiuser Prep V1 - Final Fix) está operacional!');
});

async function iniciarServidor() {
    await conectarMongoDB();
    await carregarFichasDoDB();
    app.listen(PORT, () => {
        console.log("****************************************************");
        console.log("*** INICIANDO SERVIDOR DO BOT DE RPG HP - WHAPI ***");
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
