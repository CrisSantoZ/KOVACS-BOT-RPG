// Nome do arquivo: bot_baileys.js (ou bot_server.js, conforme seu package.json)

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
// const Canvas = require('canvas'); // Descomente quando for usar o canvas

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
        inteligencia: 5,
        forca: 5,
        constituicao: 5,
        destreza: 5,
        carisma: 5,
        agilidade: 5,
        pontosParaDistribuir: 0
    },
    galeoes: 50,
    habilidadesFeiticos: [], 
    inventario: [{ itemNome: "Varinha Comum", quantidade: 1, tipo: "Varinha", descricao: "Uma varinha simples, mas funcional." },{ itemNome: "Uniforme de Hogwarts", quantidade: 1, tipo: "Vestimenta" },{ itemNome: "Kit de Livros do Primeiro Ano", quantidade: 1, tipo: "Livro" }], 
    pet: null, 
    aptidoesMaterias: [], 
    logConquistas: [],
    notacoesDM: ""
};

// --- CONFIGURAÇÃO DE ARMAZENAMENTO DE DADOS (FICHAS) ---
// O Render monta o disco em /data ou em um caminho especificado por RENDER_DISK_MOUNT_PATH.
// Vamos usar 'kovacs_rpg_bot_data_final' para ter certeza que é uma nova pasta para esta versão.
const DADOS_RPG_DIR = path.join(process.env.RENDER_DISK_MOUNT_PATH || '/data', 'kovacs_rpg_bot_data_final');
const ARQUIVO_FICHAS_PATH = path.join(DADOS_RPG_DIR, 'fichas_personagens.json');

let todasAsFichas = {}; // Variável global para manter as fichas em memória

function garantirDiretorioDeDados() {
    try {
        if (!fs.existsSync(DADOS_RPG_DIR)) {
            fs.mkdirSync(DADOS_RPG_DIR, { recursive: true });
            console.log(`Diretório de dados RPG criado/verificado em: ${DADOS_RPG_DIR}`);
        }
    } catch (err) {
        console.error("Erro crítico ao verificar/criar diretório de dados RPG:", err);
    }
}

function carregarFichas() {
    garantirDiretorioDeDados(); 
    try {
        if (fs.existsSync(ARQUIVO_FICHAS_PATH)) {
            const data = fs.readFileSync(ARQUIVO_FICHAS_PATH, 'utf8');
            if (data && data.trim() !== "") { // Verifica se há conteúdo antes do parse
                todasAsFichas = JSON.parse(data);
                console.log(`Fichas carregadas de ${ARQUIVO_FICHAS_PATH}. ${Object.keys(todasAsFichas).length} fichas encontradas.`);
            } else {
                todasAsFichas = {};
                console.log(`Arquivo de fichas (${ARQUIVO_FICHAS_PATH}) encontrado, mas vazio ou inválido. Iniciando sem fichas carregadas.`);
            }
        } else {
            console.log(`Arquivo de fichas (${ARQUIVO_FICHAS_PATH}) não encontrado. Iniciando sem fichas. Será criado ao salvar a primeira ficha.`);
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

    let novaFicha = JSON.parse(JSON.stringify(fichaModelo)); // Cria cópia profunda
    
    novaFicha.idJogador = idRemetente;
    novaFicha.nomeJogadorSalvo = nomeDoRemetenteNoZap || idRemetente.split('@')[0];
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.idadePersonagem = idadeInput;
    novaFicha.casa = casaInput.charAt(0).toUpperCase() + casaInput.slice(1).toLowerCase();
    novaFicha.anoEmHogwarts = anoCalculado;
    novaFicha.carreira = carreiraInput;
    novaFicha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    // Itens iniciais já estão no fichaModelo ou podem ser adicionados aqui se preferir

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
    } else {
        resposta += "  (Atributos não definidos)\n";
    }

    resposta += "\n📜 Feitiços:\n";
    if (ficha.habilidadesFeiticos && ficha.habilidadesFeiticos.length > 0) {
        ficha.habilidadesFeiticos.forEach(f => {
            resposta += `  ☆ ${f.nome} (Nvl ${f.nivel || 1})\n`; // Assume Nvl 1 se não especificado
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

    await enviarMensagemTextoWhapi(chatIdParaResposta, resposta);
}

// --- FUNÇÃO PARA ENVIAR MENSAGENS (JÁ ESTAVA CORRETA) ---
async function enviarMensagemTextoWhapi(para, mensagem) {
    if (!WHAPI_API_TOKEN) {
        console.error("Token do Whapi não configurado para envio.");
        return;
    }
    console.log(`Enviando mensagem de texto via Whapi para ${para}: "${mensagem}"`);
    const endpoint = "/messages/text";
    const urlDeEnvio = `${WHAPI_BASE_URL}${endpoint}`;
    const payload = { "to": para, "body": mensagem };
    const headers = {
        'Authorization': `Bearer ${WHAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    try {
        console.log(`Enviando POST para ${urlDeEnvio}`);
        console.log(`Payload de envio:`, JSON.stringify(payload));
        const response = await axios.post(urlDeEnvio, payload, { headers: headers });
        console.log('Resposta do Whapi ao enviar mensagem TEXTO:', JSON.stringify(response.data, null, 2));
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

// --- ROTA DE WEBHOOK (PRINCIPAL LÓGICA DO BOT) ---
app.post('/webhook/whatsapp', async (req, res) => {
    console.log('----------------------------------------------------');
    console.log('>>> Webhook do Whapi Recebido! <<<');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Corpo da requisição (RAW):', JSON.stringify(req.body, null, 2)); 

    try {
        if (req.body.messages && Array.isArray(req.body.messages) && req.body.messages.length > 0) {
            console.log(`Encontrado array 'messages' com ${req.body.messages.length} entrada(s).`);

            for (const messageData of req.body.messages) {
                console.log("Processando messageData:", JSON.stringify(messageData, null, 2));

                const fromMe = messageData.from_me;
                const chatId = messageData.chat_id;
                const sender = messageData.from; // Quem enviou a mensagem
                const nomeRemetenteNoZap = messageData.from_name || (sender ? sender.split('@')[0] : 'Desconhecido'); // Nome do perfil do WhatsApp
                const messageType = messageData.type;
                let textContent = "";

                if (messageType === 'text' && messageData.text && typeof messageData.text.body === 'string') {
                    textContent = messageData.text.body;
                } else if (messageData.caption && typeof messageData.caption === 'string') { 
                    textContent = messageData.caption;
                }
                
                if (fromMe === true) {
                    console.log(`Ignorando mensagem própria (from_me = true) do chat ${chatId}.`);
                    continue; 
                }

                if (!chatId) {
                    console.warn("Entrada de mensagem no webhook sem 'chat_id' válido:", messageData);
                    continue; 
                }
                
                const idParaLog = typeof chatId === 'string' ? chatId.split('@')[0] : chatId.toString();
                const senderParaLog = sender ? (typeof sender === 'string' ? sender.split('@')[0] : sender.toString()) : 'Desconhecido';
                
                console.log(`Chat ID: ${idParaLog}, Remetente: ${senderParaLog} (Nome: ${nomeRemetenteNoZap}), Tipo: ${messageType}, Conteúdo: "${textContent}"`);

                // Processamento de Comandos
                if (textContent && textContent.startsWith('!')) {
                    const args = textContent.slice(1).trim().split(/ +/g);
                    const comando = args.shift().toLowerCase();
                    
                    console.log(`Comando RPG: '!${comando}', Args: [${args.join(', ')}]`);

                    if (comando === 'ping') {
                        await enviarMensagemTextoWhapi(chatId, `Pong do RPG! Olá, ${nomeRemetenteNoZap}! Estou pronto para a aventura! 🧙✨`);
                    } else if (comando === 'criar' || comando === 'novaficha' || comando === 'criarpersonagem') {
                        await handleCriarFicha(chatId, sender, nomeRemetenteNoZap, args);
                    } else if (comando === 'ficha' || comando === 'minhaficha') {
                        await handleVerFicha(chatId, sender);
                    }
                    // --- ADICIONE OUTROS COMANDOS AQUI ---
                    else {
                        await enviarMensagemTextoWhapi(chatId, `Comando de RPG "!${comando}" não reconhecido, ${nomeRemetenteNoZap}.`);
                    }
                }
            }
        } else {
            console.log("Estrutura do webhook não continha array 'messages' ou estava vazio. Corpo:", req.body);
        }
    } catch (error) {
        console.error("Erro CRÍTICO ao processar webhook do Whapi:", error.message, error.stack);
    }

    res.status(200).send('OK'); 
});

// --- ROTA DE TESTE E INICIALIZAÇÃO DO SERVIDOR ---
app.get('/', (req, res) => {
    res.send('Servidor do Bot de RPG (Whapi no Render) está operacional!');
});

app.listen(PORT, () => {
    carregarFichas(); // Carrega as fichas quando o servidor inicia
    const publicUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    console.log(`Servidor do bot de RPG escutando na porta ${PORT}`);
    if (process.env.RENDER_EXTERNAL_URL) {
        console.log(`Webhook URL para configurar no Whapi.Cloud: ${publicUrl}/webhook/whatsapp`);
    } else {
        console.log(`Webhook local para testes (ex: com ngrok): http://localhost:${PORT}/webhook/whatsapp`);
    }
});
    
