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

// --- CONFIGURAÇÃO DE ARMAZENAMENTO DE DADOS (FICHAS) ---
const BASE_PERSISTENT_DISK_PATH = process.env.RENDER_DISK_MOUNT_PATH || '/data/rpg_files';
const DADOS_RPG_DIR = path.join(BASE_PERSISTENT_DISK_PATH, 'kovacs_bot_rpg_data_final');
const ARQUIVO_FICHAS_PATH = path.join(DADOS_RPG_DIR, 'fichas_personagens.json');

let todasAsFichas = {}; 

function garantirDiretorioDeDados() {
    try {
        if (!fs.existsSync(DADOS_RPG_DIR)) {
            fs.mkdirSync(DADOS_RPG_DIR, { recursive: true });
            console.log(`Diretório de dados RPG criado/verificado em: ${DADOS_RPG_DIR}`);
        }
    } catch (err) {
        console.error(`Erro crítico ao verificar/criar diretório de dados RPG (${DADOS_RPG_DIR}):`, err);
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

// --- FUNÇÕES DE COMANDO DO RPG ---

// (handleCriarFicha e handleVerFicha como definidas anteriormente)
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
    if (!casasValidas.includes(casaInput.toLowerCase())) {
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
    novaFicha.casa = casaInput.charAt(0).toUpperCase() + casaInput.slice(1).toLowerCase();
    novaFicha.anoEmHogwarts = anoCalculado;
    novaFicha.carreira = carreiraInput;
    novaFicha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    
    todasAsFichas[idRemetente] = novaFicha;
    salvarFichas();

    await enviarMensagemTextoWhapi(chatIdParaResposta, `🎉 Personagem ${nomePersonagemInput} da casa ${novaFicha.casa}, ano ${novaFicha.anoEmHogwarts}, foi criado para você!\nUse \`!ficha\` para ver os detalhes.`);
}

async function handleVerFicha(chatIdParaResposta, idRemetente) {
    const ficha = todasAsFichas[idRemetente];
    if (!ficha) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Você ainda não tem um personagem. Use o comando `!criar Nome; Casa; Idade; [Carreira]` para criar um.");
        return;
    }
    // ... (código completo da função handleVerFicha que te passei, com toda a formatação)
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
        for (const [attr, valor] of Object.entries(ficha.atributos)) {
            const nomeAttr = attr.charAt(0).toUpperCase() + attr.slice(1);
            if (attr !== "pontosParaDistribuir") {
                resposta += `  ☆ ${nomeAttr}: ${valor}\n`;
            }
        }
        if (ficha.atributos.pontosParaDistribuir > 0) {
            resposta += `  ✨ Você tem ${ficha.atributos.pontosParaDistribuir} pontos para distribuir (!usaratributo).\n`;
        }
    } else { resposta += "  (Atributos não definidos)\n"; }
    resposta += "\n📜 Feitiços:\n";
    if (ficha.habilidadesFeiticos && ficha.habilidadesFeiticos.length > 0) {
        ficha.habilidadesFeiticos.forEach(f => { resposta += `  ☆ ${f.nome} (Nvl ${f.nivel || 1})\n`; });
    } else { resposta += "  (Nenhum)\n"; }
    resposta += "\n🎒 Inventário:\n";
    if (ficha.inventario && ficha.inventario.length > 0) {
        ficha.inventario.forEach(i => { resposta += `  ☆ ${i.itemNome} (Qtd: ${i.quantidade || 1}) ${i.descricao ? '- ' + i.descricao : ''}\n`; });
    } else { resposta += "  (Vazio)\n"; }
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

// --- NOVAS FUNÇÕES DE ATUALIZAÇÃO ---
async function handleAddXP(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = todasAsFichas[idRemetente];
    if (!ficha) { await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Personagem não encontrado."); return; }
    if (argsComando.length < 1) { await enviarMensagemTextoWhapi(chatIdParaResposta, "Uso: `!addxp <quantidade>`"); return; }
    const quantidadeXP = parseInt(argsComando[0]);
    if (isNaN(quantidadeXP)) { await enviarMensagemTextoWhapi(chatIdParaResposta, "Quantidade de XP inválida."); return; }

    ficha.xpAtual += quantidadeXP;
    let mensagemResposta = `✨ Você ${quantidadeXP >= 0 ? 'ganhou' : 'perdeu'} ${Math.abs(quantidadeXP)} XP! Seu XP atual é ${ficha.xpAtual}/${ficha.xpProximoNivel}.`;

    // Lógica de Subir de Nível (Exemplo Simples)
    while (ficha.xpAtual >= ficha.xpProximoNivel) {
        ficha.nivelAtual += 1;
        ficha.xpAtual -= ficha.xpProximoNivel; 
        ficha.xpProximoNivel = Math.floor(ficha.xpProximoNivel * 1.5); 
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + 3; 
        ficha.pontosDeVidaMax += 10; 
        ficha.pontosDeVidaAtual = ficha.pontosDeVidaMax; 
        ficha.pontosDeMagiaMax += 5;  
        ficha.pontosDeMagiaAtual = ficha.pontosDeMagiaMax; 
        mensagemResposta += `\n🎉 PARABÉNS! Você subiu para o Nível ${ficha.nivelAtual}! 🎉`;
        mensagemResposta += `\nXP para o próximo nível: ${ficha.xpProximoNivel}.`;
        mensagemResposta += `\nVocê ganhou 3 pontos de atributo para distribuir com \`!usaratributo\`.`;
        mensagemResposta += `\nSeu HP e MP foram restaurados e aumentados!`;
    }
    ficha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    salvarFichas();
    await enviarMensagemTextoWhapi(chatIdParaResposta, mensagemResposta);
}

async function handleUsarAtributo(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = todasAsFichas[idRemetente];
    if (!ficha) { await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Personagem não encontrado."); return; }
    if (argsComando.length < 2) { await enviarMensagemTextoWhapi(chatIdParaResposta, "Uso: `!usaratributo <nome_do_atributo> <quantidade>`"); return; }
    
    const atributoNomeInput = argsComando[0].toLowerCase();
    const quantidadePontos = parseInt(argsComando[1]);

    if (isNaN(quantidadePontos) || quantidadePontos <= 0) { await enviarMensagemTextoWhapi(chatIdParaResposta, "Quantidade de pontos inválida."); return; }
    if (!ficha.atributos.pontosParaDistribuir || ficha.atributos.pontosParaDistribuir < quantidadePontos) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, `Você não tem ${quantidadePontos} pontos para distribuir. Pontos disponíveis: ${ficha.atributos.pontosParaDistribuir || 0}.`);
        return;
    }
    const mapaAtributos = {"inteligencia": "inteligencia", "int": "inteligencia", "forca": "forca", "for": "forca", "constituicao": "constituicao", "con": "constituicao", "destreza": "destreza", "des": "destreza", "carisma": "carisma", "car": "carisma", "agilidade": "agilidade", "agi": "agilidade"};
    const atributoReal = mapaAtributos[atributoNomeInput];
    if (!atributoReal || typeof ficha.atributos[atributoReal] === 'undefined') {
        await enviarMensagemTextoWhapi(chatIdParaResposta, `Atributo "${atributoNomeInput}" inválido. Use: inteligencia, forca, constituicao, destreza, carisma, agilidade.`);
        return;
    }
    ficha.atributos[atributoReal] += quantidadePontos;
    ficha.atributos.pontosParaDistribuir -= quantidadePontos;
    // Adicionar lógica de recalcular HP/MP se necessário
    ficha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    salvarFichas();
    await enviarMensagemTextoWhapi(chatIdParaResposta, `✨ Atributo ${atributoReal.charAt(0).toUpperCase() + atributoReal.slice(1)} aumentado para ${ficha.atributos[atributoReal]}! Pontos restantes: ${ficha.atributos.pontosParaDistribuir}.`);
}

async function handleAddGaleoes(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = todasAsFichas[idRemetente];
    if (!ficha) { await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Personagem não encontrado."); return; }
    if (argsComando.length < 1) { await enviarMensagemTextoWhapi(chatIdParaResposta, "Uso: `!addgaleoes <quantidade>`"); return; }
    const quantidade = parseInt(argsComando[0]);
    if (isNaN(quantidade)) { await enviarMensagemTextoWhapi(chatIdParaResposta, "Quantidade inválida."); return; }
    ficha.galeoes = (ficha.galeoes || 0) + quantidade;
    ficha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    salvarFichas();
    await enviarMensagemTextoWhapi(chatIdParaResposta, `💰 ${quantidade > 0 ? quantidade + ' Galeões adicionados.' : Math.abs(quantidade) + ' Galeões removidos.'} Saldo atual: ${ficha.galeoes}G.`);
}

async function handleAddItem(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = todasAsFichas[idRemetente];
    if (!ficha) { await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Personagem não encontrado."); return; }
    const dadosComando = argsComando.join(' ');
    const partes = dadosComando.split(';').map(p => p.trim());
    if (partes.length < 1) { await enviarMensagemTextoWhapi(chatIdParaResposta, "Uso: `!additem <Nome do Item>; [Qtd]; [Tipo]; [Desc]`"); return; }

    const nomeItem = partes[0];
    const quantidade = parseInt(partes[1]) || 1;
    const tipoItem = partes[2] || "Item";
    const descricaoItem = partes[3] || "";
    if (isNaN(quantidade) || quantidade <= 0) { await enviarMensagemTextoWhapi(chatIdParaResposta, "Quantidade inválida."); return; }

    let itemExistente = ficha.inventario.find(item => item.itemNome.toLowerCase() === nomeItem.toLowerCase() && (item.tipo || "Item").toLowerCase() === tipoItem.toLowerCase());
    if (itemExistente) {
        itemExistente.quantidade = (itemExistente.quantidade || 0) + quantidade;
    } else {
        ficha.inventario.push({ itemNome: nomeItem, quantidade: quantidade, tipo: tipoItem, descricao: descricaoItem });
    }
    ficha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    salvarFichas();
    await enviarMensagemTextoWhapi(chatIdParaResposta, `🎒 ${quantidade}x "${nomeItem}" adicionado(s) ao inventário!`);
}

async function handleRemoverItem(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = todasAsFichas[idRemetente];
    if (!ficha) { await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Personagem não encontrado."); return; }
    const dadosComando = argsComando.join(' ');
    const partes = dadosComando.split(';').map(p => p.trim());
    if (partes.length < 1) { await enviarMensagemTextoWhapi(chatIdParaResposta, "Uso: `!removeritem <Nome do Item>; [Quantidade]`"); return; }

    const nomeItem = partes[0];
    const quantidadeRemover = parseInt(partes[1]) || 1;
    if (isNaN(quantidadeRemover) || quantidadeRemover <= 0) { await enviarMensagemTextoWhapi(chatIdParaResposta, "Quantidade inválida."); return; }

    const itemIndex = ficha.inventario.findIndex(item => item.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemIndex === -1) { await enviarMensagemTextoWhapi(chatIdParaResposta, `Item "${nomeItem}" não encontrado no inventário.`); return; }
    
    if (ficha.inventario[itemIndex].quantidade < quantidadeRemover) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, `Você não tem ${quantidadeRemover} "${nomeItem}". Você possui ${ficha.inventario[itemIndex].quantidade}.`);
        return;
    }
    ficha.inventario[itemIndex].quantidade -= quantidadeRemover;
    if (ficha.inventario[itemIndex].quantidade <= 0) {
        ficha.inventario.splice(itemIndex, 1); // Remove o item se a quantidade for zero ou menor
    }
    ficha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    salvarFichas();
    await enviarMensagemTextoWhapi(chatIdParaResposta, `🗑️ ${quantidadeRemover}x "${nomeItem}" removido(s) do inventário.`);
}

async function handleAprenderFeitico(chatIdParaResposta, idRemetente, argsComando) {
    const ficha = todasAsFichas[idRemetente];
    if (!ficha) { await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Personagem não encontrado."); return; }
    const dadosComando = argsComando.join(' ');
    const partes = dadosComando.split(';').map(p => p.trim());
    if (partes.length < 1) { await enviarMensagemTextoWhapi(chatIdParaResposta, "Uso: `!aprenderfeitico <Nome do Feitiço>; [Nível opcional]`"); return; }

    const nomeFeitico = partes[0];
    const nivelFeitico = parseInt(partes[1]) || 1;
    if (isNaN(nivelFeitico) || nivelFeitico <= 0) { await enviarMensagemTextoWhapi(chatIdParaResposta, "Nível do feitiço inválido."); return; }

    if (ficha.habilidadesFeiticos.find(f => f.nome.toLowerCase() === nomeFeitico.toLowerCase())) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, `Você já conhece o feitiço "${nomeFeitico}".`);
        return;
    }
    ficha.habilidadesFeiticos.push({ nome: nomeFeitico, nivel: nivelFeitico });
    ficha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    salvarFichas();
    await enviarMensagemTextoWhapi(chatIdParaResposta, `📜 Feitiço "${nomeFeitico}" (Nível ${nivelFeitico}) aprendido!`);
}

async function handleComandos(chatIdParaResposta) {
    let msg = "📜 --- Lista de Comandos Disponíveis --- 📜\n\n";
    msg += "👤 *Personagem:*\n";
    msg += "`!criar <Nome>;<Casa>;<Idade>;[Carreira]` - Cria sua ficha.\n";
    msg += "`!ficha` ou `!minhaficha` - Mostra sua ficha.\n";
    msg += "\n✨ *Evolução:*\n";
    msg += "`!addxp <quantidade>` - Adiciona XP a você.\n";
    msg += "`!usaratributo <atributo> <pontos>` - Distribui pontos de atributo.\n";
    msg += "\n💰 *Finanças:*\n";
    msg += "`!addgaleoes <quantidade>` - Adiciona Galeões.\n";
    msg += "`!removergaleoes <quantidade>` - Remove Galeões.\n";
    msg += "\n🎒 *Inventário:*\n";
    msg += "`!additem <Nome>;[Qtd];[Tipo];[Desc]` - Adiciona item.\n";
    msg += "`!removeritem <Nome>;[Qtd]` - Remove item.\n";
    msg += "\n🪄 *Magia:*\n";
    msg += "`!aprenderfeitico <Nome>;[Nível]` - Aprende feitiço.\n";
    // Adicionar mais comandos à medida que são implementados
    msg += "\nℹ️ *Outros:*\n";
    msg += "`!ping` - Testa se o bot está online.\n";
    msg += "`!comandos` - Mostra esta lista.\n\n";
    msg += "_Obs: Para comandos com múltiplos parâmetros, use ';' para separar as partes (ex: !criar Nome Completo; Casa; Idade)._";
    await enviarMensagemTextoWhapi(chatIdParaResposta, msg);
}


// --- FUNÇÃO PARA ENVIAR
