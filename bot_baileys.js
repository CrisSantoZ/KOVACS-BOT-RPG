// Nome do arquivo: bot_baileys.js (ou bot_server.js, conforme seu package.json)

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
// const Canvas = require('canvas'); // Descomente e instale (npm install canvas) quando for usar

// --- MODELO DA FICHA DE PERSONAGEM ---
const fichaModelo = {
    idJogador: "",
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
        pontosParaDistribuir: 5 // Começa com 5 pontos para distribuir
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

// --- LISTA DE COMANDOS PARA O COMANDO !comandos ---
const listaDeComandos = [
    { nome: "!ping", desc: "Verifica se o bot está online." },
    { nome: "!criar", desc: "`!criar Nome;Casa;Idade;[Carreira]` - Cria um novo personagem." },
    { nome: "!ficha", desc: "Mostra sua ficha de personagem atual." },
    { nome: "!comandos", desc: "Mostra esta lista de comandos." },
    // Comandos de Atualização
    { nome: "!setnome", desc: "`!setnome <novo nome>` - Altera o nome do seu personagem." },
    { nome: "!setidade", desc: "`!setidade <nova idade>` - Altera a idade do seu personagem (11-18)." },
    { nome: "!setcasa", desc: "`!setcasa <nova casa>` - Altera a casa (Grifinória, Sonserina, Corvinal, Lufa-Lufa)." },
    { nome: "!setcarreira", desc: "`!setcarreira <nova carreira>` - Altera a carreira do seu personagem." },
    { nome: "!setatributo", desc: "`!setatributo <atributo> <valor>` - Define um atributo (ex: !setatributo inteligencia 10)." },
    { nome: "!additem", desc: "`!additem Nome;[Qtd];[Tipo];[Desc]` - Adiciona item ao inventário (separado por ';')." },
    { nome: "!addfeitico", desc: "`!addfeitico Nome;[Nivel]` - Adiciona feitiço/habilidade (separado por ';')." },
    { nome: "!setxp", desc: "`!setxp <valor>` - Define seu XP atual." },
    { nome: "!sethp", desc: "`!sethp <atual>;[max]` - Define seus Pontos de Vida (separado por ';')." },
    { nome: "!setmp", desc: "`!setmp <atual>;[max]` - Define seus Pontos de Magia (separado por ';')." },
    { nome: "!setgaleoes", desc: "`!setgaleoes <valor>` - Define sua quantidade de Galeões." },
    // Adicionar mais comandos aqui conforme necessário
];


// --- CONFIGURAÇÃO DE ARMAZENAMENTO DE DADOS (FICHAS) ---
const BASE_PERSISTENT_DISK_PATH = process.env.RENDER_DISK_MOUNT_PATH || './kovacs_bot_data'; // Alterado fallback para local
const DADOS_RPG_DIR = path.join(BASE_PERSISTENT_DISK_PATH); // Simplificado, usar o mount path diretamente se fornecido
const ARQUIVO_FICHAS_PATH = path.join(DADOS_RPG_DIR, 'fichas_personagens.json');

let todasAsFichas = {};

function garantirDiretorioDeDados() {
    try {
        // Verifica se o diretório base (ou o fallback local) existe. Não tenta criar /data/rpg_files se não for montado.
        const dirParaVerificar = path.dirname(ARQUIVO_FICHAS_PATH);
        if (!fs.existsSync(dirParaVerificar)) {
            fs.mkdirSync(dirParaVerificar, { recursive: true });
            console.log(`Diretório de dados RPG criado/verificado em: ${dirParaVerificar}`);
        } else {
            console.log(`Diretório de dados RPG já existe em: ${dirParaVerificar}`);
        }
    } catch (err) {
        console.error(`Erro crítico ao verificar/criar diretório de dados RPG (${path.dirname(ARQUIVO_FICHAS_PATH)}):`, err);
    }
}

function carregarFichas() {
    garantirDiretorioDeDados();
    try {
        if (fs.existsSync(ARQUIVO_FICHAS_PATH)) {
            const data = fs.readFileSync(ARQUIVO_FICHAS_PATH, 'utf8');
            if (data && data.trim() !== "") {
                todasAsFichas = JSON.parse(data);
                console.log(`Fichas carregadas de ${ARQUIVO_FICHAS_PATH}. ${Object.keys(todasAsFichas).length} fichas encontradas.`);
            } else {
                todasAsFichas = {};
                console.log(`Arquivo de fichas (${ARQUIVO_FICHAS_PATH}) encontrado, mas vazio ou inválido. Iniciando sem fichas.`);
            }
        } else {
            console.log(`Arquivo de fichas (${ARQUIVO_FICHAS_PATH}) não encontrado. Iniciando sem fichas. Será criado ao salvar.`);
            todasAsFichas = {};
        }
    } catch (error) {
        console.error(`Erro ao carregar/parsear fichas de ${ARQUIVO_FICHAS_PATH}:`, error);
        todasAsFichas = {};
    }
}

function salvarFichas() {
    garantirDiretorioDeDados();
    try {
        const data = JSON.stringify(todasAsFichas, null, 2);
        fs.writeFileSync(ARQUIVO_FICHAS_PATH, data, 'utf8');
        console.log("Fichas salvas com sucesso em:", ARQUIVO_FICHAS_PATH);
    } catch (error) {
        console.error("Erro ao salvar fichas em", ARQUIVO_FICHAS_PATH, ":", error);
    }
}

// --- FUNÇÕES AUXILIARES ---
function getFichaOuAvisa(chatIdParaResposta, idRemetente) {
    const ficha = todasAsFichas[idRemetente];
    if (!ficha) {
        enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Você ainda não tem um personagem. Use o comando `!criar` primeiro.");
        return null;
    }
    return ficha;
}

function atualizarTimestampESalvar(ficha) {
    ficha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    salvarFichas();
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
    // Considerar encerrar o processo se o token for essencial: process.exit(1);
}

// --- FUNÇÕES DE COMANDO DO RPG ---

async function handleCriarFicha(chatIdParaResposta, idRemetente, nomeDoRemetenteNoZap, argsComando) {
    const dadosComando = argsComando.join(' ');
    const partes = dadosComando.split(';').map(p => p.trim());

    if (partes.length < 3) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, "Formato incorreto! Uso: `!criar Nome do Personagem; Casa; Idade; [Carreira]`\nExemplo: `!criar Harry Potter; Grifinória; 11; Apanhador`");
        return;
    }

    const nomePersonagemInput = partes[0];
    const casaInput = partes[1];
    const idadeInput = parseInt(partes[2]);
    const carreiraInput = partes[3] || "Estudante";

    if (todasAsFichas[idRemetente]) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, `Você já possui um personagem: ${todasAsFichas[idRemetente].nomePersonagem}. Por enquanto, apenas um personagem por jogador.`);
        return;
    }

    const casasValidas = ["grifinória", "sonserina", "corvinal", "lufa-lufa"];
    const casaNormalizada = casaInput.toLowerCase();
    if (!casasValidas.includes(casaNormalizada)) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, `Casa "${casaInput}" inválida. As casas são: Grifinória, Sonserina, Corvinal, Lufa-Lufa.`);
        return;
    }

    if (isNaN(idadeInput) || idadeInput < 11 || idadeInput > 18) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, `Idade "${idadeInput}" inválida. Deve ser um número entre 11 e 18 para estudantes.`);
        return;
    }
    const anoCalculado = Math.max(1, Math.min(7, idadeInput - 10));

    let novaFicha = JSON.parse(JSON.stringify(fichaModelo));

    novaFicha.idJogador = idRemetente;
    novaFicha.nomeJogadorSalvo = nomeDoRemetenteNoZap || idRemetente.split('@')[0];
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.idadePersonagem = idadeInput;
    novaFicha.casa = casaInput.charAt(0).toUpperCase() + casaInput.slice(1).toLowerCase(); // Mantem a capitalização
    novaFicha.anoEmHogwarts = anoCalculado;
    novaFicha.carreira = carreiraInput;
    novaFicha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    // Garante que a estrutura de atributos existe
    novaFicha.atributos = { ...fichaModelo.atributos };
    novaFicha.atributos.pontosParaDistribuir = 5; // Adiciona pontos iniciais

    todasAsFichas[idRemetente] = novaFicha;
    salvarFichas(); // Salva a ficha recém-criada

    await enviarMensagemTextoWhapi(chatIdParaResposta, `🎉 Personagem ${nomePersonagemInput} da casa ${novaFicha.casa}, ano ${novaFicha.anoEmHogwarts}, foi criado para você!\nVocê tem ${novaFicha.atributos.pontosParaDistribuir} pontos de atributo para distribuir.\nUse \`!ficha\` para ver os detalhes.`);
}

async function handleVerFicha(chatIdParaResposta, idRemetente) {
    const ficha = getFichaOuAvisa(chatIdParaResposta, idRemetente);
    if (!ficha) return;

    let resposta = `🌟 --- Ficha de ${ficha.nomePersonagem} --- 🌟\n`;
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
        const ordemAtributos = ["inteligencia", "forca", "constituicao", "destreza", "carisma", "agilidade"];
        ordemAtributos.forEach(attr => {
            if (ficha.atributos.hasOwnProperty(attr)) {
                 const nomeAttr = attr.charAt(0).toUpperCase() + attr.slice(1);
                 resposta += `  ☆ ${nomeAttr}: ${ficha.atributos[attr]}\n`;
            }
        });
        if (ficha.atributos.pontosParaDistribuir > 0) {
            resposta += `  ✨ Você tem ${ficha.atributos.pontosParaDistribuir} pontos para distribuir (!usaratributo - *ainda não implementado*).\n`;
        }
    } else {
        resposta += "  (Atributos não definidos)\n";
    }

    resposta += "\n📜 Feitiços:\n";
    if (ficha.habilidadesFeiticos && ficha.habilidadesFeiticos.length > 0) {
        ficha.habilidadesFeiticos.forEach(f => {
            resposta += `  ☆ ${f.nome} ${f.nivel ? '(Nvl ' + f.nivel + ')' : ''}\n`;
        });
    } else {
        resposta += "  (Nenhum)\n";
    }

    resposta += "\n🎒 Inventário:\n";
    if (ficha.inventario && ficha.inventario.length > 0) {
        ficha.inventario.forEach(i => {
            resposta += `  ☆ ${i.itemNome} (Qtd: ${i.quantidade || 1}) ${i.tipo ? '[' + i.tipo + ']': ''} ${i.descricao ? '- ' + i.descricao : ''}\n`;
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

    await enviarMensagemTextoWhapi(chatIdParaResposta, resposta);
}

async function handleListarComandos(chatIdParaResposta) {
    let resposta = "📜 --- Comandos Disponíveis --- 📜\n\n";
    listaDeComandos.forEach(cmd => {
        resposta += `🔹 ${cmd.nome}: ${cmd.desc}\n`;
    });
    await enviarMensagemTextoWhapi(chatIdParaResposta, resposta);
}

// --- FUNÇÕES HANDLER PARA NOVOS COMANDOS DE ATUALIZAÇÃO ---

async function handleSetNome(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = getFichaOuAvisa(chatIdParaResposta, idRemetente);
    if (!ficha) return;

    const novoNome = argsComando.join(' ');
    if (!novoNome) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Nome inválido. Uso: `!setnome <novo nome do personagem>`");
        return;
    }

    const nomeAntigo = ficha.nomePersonagem;
    ficha.nomePersonagem = novoNome;
    atualizarTimestampESalvar(ficha);
    await enviarMensagemTextoWhapi(chatIdParaResposta, `✅ Nome do personagem alterado de "${nomeAntigo}" para "${novoNome}".`);
}

async function handleSetIdade(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = getFichaOuAvisa(chatIdParaResposta, idRemetente);
    if (!ficha) return;

    const novaIdade = parseInt(argsComando[0]);
    if (isNaN(novaIdade) || novaIdade < 11 || novaIdade > 18) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, `❌ Idade inválida (${argsComando[0]}). Deve ser um número entre 11 e 18.`);
        return;
    }

    const idadeAntiga = ficha.idadePersonagem;
    const anoAntigo = ficha.anoEmHogwarts;
    ficha.idadePersonagem = novaIdade;
    ficha.anoEmHogwarts = Math.max(1, Math.min(7, novaIdade - 10)); // Recalcula ano
    atualizarTimestampESalvar(ficha);
    await enviarMensagemTextoWhapi(chatIdParaResposta, `✅ Idade alterada de ${idadeAntiga} para ${novaIdade}. Ano em Hogwarts atualizado para ${ficha.anoEmHogwarts} (era ${anoAntigo}).`);
}

async function handleSetCasa(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = getFichaOuAvisa(chatIdParaResposta, idRemetente);
    if (!ficha) return;

    const novaCasaInput = argsComando.join(' ');
    if (!novaCasaInput) {
         await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Nenhuma casa fornecida. Uso: `!setcasa <nome da casa>`");
         return;
    }

    const casasValidas = ["grifinória", "sonserina", "corvinal", "lufa-lufa"];
    const casaNormalizada = novaCasaInput.toLowerCase();

    if (!casasValidas.includes(casaNormalizada)) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, `❌ Casa "${novaCasaInput}" inválida. Casas permitidas: Grifinória, Sonserina, Corvinal, Lufa-Lufa.`);
        return;
    }

    const casaAntiga = ficha.casa;
    ficha.casa = novaCasaInput.charAt(0).toUpperCase() + novaCasaInput.slice(1).toLowerCase(); // Capitaliza
    atualizarTimestampESalvar(ficha);
    await enviarMensagemTextoWhapi(chatIdParaResposta, `✅ Casa alterada de "${casaAntiga}" para "${ficha.casa}".`);
}

async function handleSetCarreira(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = getFichaOuAvisa(chatIdParaResposta, idRemetente);
    if (!ficha) return;

    const novaCarreira = argsComando.join(' ');
    if (!novaCarreira) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Carreira inválida. Uso: `!setcarreira <nova carreira>`");
        return;
    }

    const carreiraAntiga = ficha.carreira;
    ficha.carreira = novaCarreira;
    atualizarTimestampESalvar(ficha);
    await enviarMensagemTextoWhapi(chatIdParaResposta, `✅ Carreira alterada de "${carreiraAntiga}" para "${novaCarreira}".`);
}

async function handleSetAtributo(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = getFichaOuAvisa(chatIdParaResposta, idRemetente);
    if (!ficha) return;

    if (argsComando.length < 2) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Uso incorreto. Formato: `!setatributo <nome_atributo> <valor>`\nAtributos: inteligencia, forca, constituicao, destreza, carisma, agilidade");
        return;
    }

    const atributoNome = argsComando[0].toLowerCase();
    const valorInput = parseInt(argsComando[1]);

    if (!ficha.atributos || !ficha.atributos.hasOwnProperty(atributoNome) || atributoNome === "pontosparadistribuir") {
        await enviarMensagemTextoWhapi(chatIdParaResposta, `❌ Atributo "${atributoNome}" inválido ou não pode ser definido diretamente.`);
        return;
    }

    if (isNaN(valorInput) || valorInput < 0) {
         await enviarMensagemTextoWhapi(chatIdParaResposta, `❌ Valor "${argsComando[1]}" inválido. Deve ser um número positivo.`);
        return;
    }

    const valorAntigo = ficha.atributos[atributoNome];
    ficha.atributos[atributoNome] = valorInput;
    atualizarTimestampESalvar(ficha);
    await enviarMensagemTextoWhapi(chatIdParaResposta, `✅ Atributo ${atributoNome.charAt(0).toUpperCase() + atributoNome.slice(1)} definido para ${valorInput} (era ${valorAntigo}).`);
}

async function handleAddItem(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = getFichaOuAvisa(chatIdParaResposta, idRemetente);
    if (!ficha) return;

    const inputCompleto = argsComando.join(' ');
    const partes = inputCompleto.split(';').map(p => p.trim());

    const nomeItem = partes[0];
    if (!nomeItem) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Nome do item é obrigatório. Uso: `!additem NomeItem;[Qtd];[Tipo];[Desc]`");
        return;
    }

    const quantidade = parseInt(partes[1]) || 1;
    const tipo = partes[2] || "Item";
    const descricao = partes[3] || "";

    if (!ficha.inventario) ficha.inventario = []; // Garante que o inventário exista

    // Opcional: verificar se item já existe e somar quantidade? Por ora, adiciona como novo.
    const novoItem = {
        itemNome: nomeItem,
        quantidade: quantidade,
        tipo: tipo,
        descricao: descricao
    };

    ficha.inventario.push(novoItem);
    atualizarTimestampESalvar(ficha);
    await enviarMensagemTextoWhapi(chatIdParaResposta, `✅ Item "${nomeItem}" (Qtd: ${quantidade}) adicionado ao inventário.`);
}

async function handleAddFeitico(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = getFichaOuAvisa(chatIdParaResposta, idRemetente);
    if (!ficha) return;

    const inputCompleto = argsComando.join(' ');
    const partes = inputCompleto.split(';').map(p => p.trim());

    const nomeFeitico = partes[0];
    if (!nomeFeitico) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Nome do feitiço é obrigatório. Uso: `!addfeitico NomeFeitico;[Nivel]`");
        return;
    }

    const nivel = parseInt(partes[1]) || 1;

    if (!ficha.habilidadesFeiticos) ficha.habilidadesFeiticos = []; // Garante que a lista exista

    const novoFeitico = {
        nome: nomeFeitico,
        nivel: nivel
    };

    ficha.habilidadesFeiticos.push(novoFeitico);
    atualizarTimestampESalvar(ficha);
    await enviarMensagemTextoWhapi(chatIdParaResposta, `✅ Feitiço "${nomeFeitico}" (Nível ${nivel}) adicionado.`);
}

async function handleSetXP(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = getFichaOuAvisa(chatIdParaResposta, idRemetente);
    if (!ficha) return;

    const novoXP = parseInt(argsComando[0]);
    if (isNaN(novoXP) || novoXP < 0) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, `❌ Valor de XP "${argsComando[0]}" inválido. Deve ser um número positivo.`);
        return;
    }

    const xpAntigo = ficha.xpAtual;
    ficha.xpAtual = novoXP;
    // Adicionar lógica de Level Up aqui se desejar
    atualizarTimestampESalvar(ficha);
    await enviarMensagemTextoWhapi(chatIdParaResposta, `✅ XP atual definido para ${novoXP} (era ${xpAntigo}).`);
}

async function handleSetHP(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = getFichaOuAvisa(chatIdPara
