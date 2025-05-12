// Nome do arquivo: bot_server.js

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
// const fs = require('fs'); // Não vamos mais usar 'fs' para fichas
// const path = require('path'); // Não vamos mais usar 'path' para fichas
const { MongoClient, ObjectId } = require('mongodb'); // Importa o MongoClient e ObjectId

// --- MODELO DA FICHA DE PERSONAGEM (sem alterações) ---
const fichaModelo = {
    // idJogador será o _id no MongoDB
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
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'rpg_harry_potter_db'; // Use a var de ambiente ou um padrão
const MONGODB_FICHAS_COLLECTION = process.env.MONGODB_FICHAS_COLLECTION || 'fichas_personagens';

if (!MONGODB_URI) {
    console.error("--- ERRO FATAL: Variável de ambiente MONGODB_URI não definida! ---");
    process.exit(1); // Encerra se não puder conectar ao DB
}

let dbClient;
let fichasCollection;
let todasAsFichas = {}; // Continuaremos usando uma cópia em memória para acesso rápido

// Função para conectar ao MongoDB
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
        process.exit(1); // Encerra se a conexão inicial falhar
    }
}

// Função para carregar fichas do MongoDB para a memória
async function carregarFichasDoDB() {
    if (!fichasCollection) {
        console.error("Coleção de fichas não inicializada. Carregamento abortado.");
        return;
    }
    console.log("Carregando fichas do MongoDB para a memória...");
    try {
        const fichasDoDB = await fichasCollection.find({}).toArray();
        todasAsFichas = {}; // Limpa o cache em memória
        fichasDoDB.forEach(fichaDB => {
            // O _id do MongoDB é o idJogador. Convertemos para string se for ObjectId.
            const idJogador = fichaDB._id.toString();
            todasAsFichas[idJogador] = { ...fichaDB }; // Adiciona ao cache em memória
            // Não precisamos mais do campo _id dentro do objeto da ficha em memória,
            // pois a chave do objeto 'todasAsFichas' já é o idJogador.
            // Mas não há problema em manter se não quiser remover.
            // delete todasAsFichas[idJogador]._id; // Opcional
        });
        console.log(`${Object.keys(todasAsFichas).length} fichas carregadas do DB para a memória.`);
    } catch (error) {
        console.error("Erro ao carregar fichas do MongoDB:", error);
        // Decide se o bot deve continuar rodando com fichas em memória vazias ou parar.
        // Por enquanto, continua com o que estiver em memória (que foi zerado).
    }
}

// Função para salvar/atualizar UMA ficha no MongoDB
// O idJogador será usado como o _id no MongoDB
async function salvarFichaNoDB(idJogador, fichaData) {
    if (!fichasCollection) {
        console.error("Coleção de fichas não inicializada. Salvamento abortado para jogador:", idJogador);
        return;
    }
    console.log(`Salvando/Atualizando ficha para jogador ${idJogador} no MongoDB...`);
    try {
        // Prepara os dados para o MongoDB, usando idJogador como _id
        const fichaParaSalvar = { ...fichaData };
        // Não precisamos mais do campo idJogador dentro do objeto, pois ele será o _id.
        // Mas se fichaModelo ainda tem idJogador, pode deixar ou remover.
        // delete fichaParaSalvar.idJogador; // Removido de fichaModelo

        await fichasCollection.updateOne(
            { _id: idJogador }, // Critério de busca: o _id é o idJogador
            { $set: fichaParaSalvar }, // Dados a serem atualizados/inseridos
            { upsert: true } // Opção: se não encontrar, insere um novo documento
        );
        console.log(`Ficha para ${idJogador} salva com sucesso no MongoDB.`);
    } catch (error) {
        console.error(`Erro ao salvar ficha para ${idJogador} no MongoDB:`, error);
    }
}

// --- CONFIGURAÇÃO DO SERVIDOR EXPRESS (sem grandes alterações) ---
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

    // idRemetente (ex: "55119... @c.us") será o _id no MongoDB
    const idJogador = idRemetente;

    if (todasAsFichas[idJogador]) { // Verifica no cache em memória
        await enviarMensagemTextoWhapi(chatIdParaResposta, `Você já possui um personagem: ${todasAsFichas[idJogador].nomePersonagem}. Por enquanto, apenas um personagem por jogador.`);
        return;
    }
    // Poderia adicionar uma verificação no DB aqui também por segurança, mas o cache deve ser confiável
    // const fichaExistenteDB = await fichasCollection.findOne({ _id: idJogador });
    // if (fichaExistenteDB) { /* ... */ }


    const nomePersonagemInput = partes[0];
    const casaInput = partes[1];
    const idadeInput = parseInt(partes[2]);
    const carreiraInput = partes[3] || "Estudante";

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

    let novaFicha = JSON.parse(JSON.stringify(fichaModelo)); // Cria uma cópia profunda

    // Removido: novaFicha.idJogador = idJogador; // O idJogador será o _id do documento no MongoDB
    novaFicha.nomeJogadorSalvo = nomeDoRemetenteNoZap || idJogador.split('@')[0];
    novaFicha.nomePersonagem = nomePersonagemInput;
    novaFicha.idadePersonagem = idadeInput;
    novaFicha.casa = casaInput.charAt(0).toUpperCase() + casaInput.slice(1).toLowerCase();
    novaFicha.anoEmHogwarts = anoCalculado;
    novaFicha.carreira = carreiraInput;
    novaFicha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    todasAsFichas[idJogador] = novaFicha; // Adiciona ao cache em memória
    await salvarFichaNoDB(idJogador, novaFicha); // Salva no MongoDB

    await enviarMensagemTextoWhapi(chatIdParaResposta, `🎉 Personagem ${nomePersonagemInput} da casa ${novaFicha.casa}, ano ${novaFicha.anoEmHogwarts}, foi criado para você!\nUse \`!ficha\` para ver os detalhes.`);
}

async function handleVerFicha(chatIdParaResposta, idRemetente) {
    const idJogador = idRemetente;
    // Tenta pegar do cache em memória primeiro
    let ficha = todasAsFichas[idJogador];

    if (!ficha && fichasCollection) { // Se não estiver no cache, tenta carregar do DB (backup)
        console.log(`Ficha para ${idJogador} não encontrada no cache, tentando buscar no DB...`);
        try {
            const fichaDB = await fichasCollection.findOne({ _id: idJogador });
            if (fichaDB) {
                todasAsFichas[idJogador] = { ...fichaDB }; // Atualiza o cache
                ficha = todasAsFichas[idJogador];
                console.log(`Ficha para ${idJogador} carregada do DB para o cache.`);
            }
        } catch (dbError) {
            console.error(`Erro ao buscar ficha ${idJogador} no DB para handleVerFicha:`, dbError);
        }
    }


    if (!ficha) {
        await enviarMensagemTextoWhapi(chatIdParaResposta, "❌ Você ainda não tem um personagem. Use o comando `!criar Nome; Casa; Idade; [Carreira]` para criar um.");
        return;
    }

    // A lógica de formatação da resposta da ficha permanece a mesma
    let resposta = `🌟 --- Ficha de ${ficha.nomePersonagem} --- 🌟\n`;
    // ... (resto da formatação da ficha igual ao código anterior) ...
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

    await enviarMensagemTextoWhapi(chatIdParaResposta, resposta);
}

// --- FUNÇÃO PARA ENVIAR MENSAGENS (sem alterações) ---
async function enviarMensagemTextoWhapi(para, mensagem) {
    if (!WHAPI_API_TOKEN) {
        console.error("Token do Whapi não configurado para envio.");
        return;
    }
    // console.log(`Enviando mensagem de texto via Whapi para ${para}: "${mensagem}"`); // Log pode ser verboso
    const endpoint = "/messages/text";
    const urlDeEnvio = `${WHAPI_BASE_URL}${endpoint}`;
    const payload = { "to": para, "body": mensagem };
    const headers = {
        'Authorization': `Bearer ${WHAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    try {
        // console.log(`Enviando POST para ${urlDeEnvio} com payload: ${JSON.stringify(payload)}`);
        const response = await axios.post(urlDeEnvio, payload, { headers: headers });
        // console.log('Resposta do Whapi ao enviar mensagem TEXTO:', JSON.stringify(response.data, null, 2));
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

// --- ROTA DE WEBHOOK (sem grandes alterações na lógica de comandos) ---
app.post('/webhook/whatsapp', async (req, res) => {
    console.log('----------------------------------------------------');
    console.log('>>> Webhook do Whapi Recebido! <<<');
    // ... (lógica do webhook igual ao código anterior, mas agora handleCriarFicha usa MongoDB)
    try {
        if (req.body.messages && Array.isArray(req.body.messages) && req.body.messages.length > 0) {
            for (const messageData of req.body.messages) {
                const fromMe = messageData.from_me;
                const chatId = messageData.chat_id;
                const sender = messageData.from;
                const nomeRemetenteNoZap = messageData.from_name || (sender ? sender.split('@')[0] : 'Desconhecido');
                const messageType = messageData.type;
                let textContent = "";

                if (messageType === 'text' && messageData.text && typeof messageData.text.body === 'string') {
                    textContent = messageData.text.body;
                } else if (messageData.caption && typeof messageData.caption === 'string') {
                    textContent = messageData.caption;
                }

                if (fromMe === true) {
                    continue;
                }
                if (!chatId) {
                    continue;
                }

                if (textContent && textContent.startsWith('!')) {
                    const args = textContent.slice(1).trim().split(/ +/g);
                    const comando = args.shift().toLowerCase();
                    console.log(`Comando RPG: '!${comando}', Args: [${args.join(', ')}], De: ${nomeRemetenteNoZap} (${sender}) no Chat: ${chatId}`);

                    if (comando === 'ping') {
                        await enviarMensagemTextoWhapi(chatId, `Pong do RPG MongoDB! Olá, ${nomeRemetenteNoZap}! 🧙✨`);
                    } else if (comando === 'criar' || comando === 'novaficha' || comando === 'criarpersonagem') {
                        await handleCriarFicha(chatId, sender, nomeRemetenteNoZap, args);
                    } else if (comando === 'ficha' || comando === 'minhaficha') {
                        await handleVerFicha(chatId, sender);
                    } else {
                        await enviarMensagemTextoWhapi(chatId, `Comando de RPG "!${comando}" não reconhecido, ${nomeRemetenteNoZap}.`);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Erro CRÍTICO ao processar webhook do Whapi:", error.message, error.stack);
    }
    res.status(200).send('OK');
});

// --- ROTA DE TESTE E INICIALIZAÇÃO DO SERVIDOR ---
app.get('/', (req, res) => {
    res.send('Servidor do Bot de RPG (Whapi no Render com MongoDB) está operacional!');
});

// Função principal para iniciar o servidor e conectar ao DB
async function iniciarServidor() {
    await conectarMongoDB(); // Conecta ao DB primeiro
    await carregarFichasDoDB(); // Carrega as fichas para a memória

    app.listen(PORT, () => {
        console.log("----------------------------------------------------");
        console.log("INICIANDO SERVIDOR DO BOT DE RPG com MongoDB...");
        const publicUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
        console.log(`Servidor do bot de RPG escutando na porta ${PORT}`);
        if (process.env.RENDER_EXTERNAL_URL) {
            console.log(`Webhook URL para configurar no Whapi.Cloud: ${publicUrl}/webhook/whatsapp`);
        } else {
            console.log(`Webhook local para testes (ex: com ngrok): http://localhost:${PORT}/webhook/whatsapp`);
        }
        console.log(`Conectado ao DB: ${MONGODB_DB_NAME}, Coleção: ${MONGODB_FICHAS_COLLECTION}`);
        console.log("----------------------------------------------------");
    });
}

iniciarServidor().catch(err => {
    console.error("Falha ao iniciar o servidor:", err);
    process.exit(1);
});

// --- Tratamento para desligamento gracioso (opcional, mas bom) ---
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
process.on('SIGINT', () => desligamentoGracioso('SIGINT')); // Ctrl+C
        
