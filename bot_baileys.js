// Nome do arquivo: bot_baileys.js (ou bot_server.js, conforme seu package.json)

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
// const Canvas = require('canvas'); // Descomente quando for usar o canvas

// Exemplo de estrutura para UMA ficha de personagem
// Esta estrutura ficará dentro de um objeto maior, onde a chave é o ID do jogador.
// Ex: fichas = { "55739xxxxxxx@s.whatsapp.net": fichaDoJogador1, ... }

const fichaModelo = {
    // 🧙‍♂️ INFORMAÇÕES DE USO 🧙‍♂️
    idJogador: "", // ID do WhatsApp (ex: 55739xxxxxxx@s.whatsapp.net)
    nomeJogador: "", // Nome do perfil do WhatsApp (podemos tentar pegar)
    nomePersonagem: "N/A",
    idadePersonagem: 11, // Idade inicial padrão para alunos do primeiro ano
    casa: "Ainda não selecionado", // Ex: Grifinória, Sonserina, Corvinal, Lufa-Lufa
    anoEmHogwarts: 1, // Ano inicial padrão
    carreira: "Estudante", // Carreira atual ou pretendida
    urlFotoPersonagem: "", // Opcional, link para uma imagem 2D
    ultimaAtualizacao: "", // Data da última atualização da ficha

    // ✨ DESEMPENHO E EVOLUÇÃO ✨
    nivelAtual: 1,
    xpAtual: 0,
    xpProximoNivel: 100, // Exemplo, você definirá a progressão conforme seu PDF
    pontosDeVidaMax: 100, // Baseado em Constituição ou nível
    pontosDeVidaAtual: 100,
    pontosDeMagiaMax: 50, // Baseado em Inteligência ou nível
    pontosDeMagiaAtual: 50,
    atributos: {
        inteligencia: 5, // Valores base iniciais (exemplo)
        forca: 5,
        constituicao: 5,
        destreza: 5,
        carisma: 5,
        agilidade: 5,
        pontosParaDistribuir: 0 // Pontos ganhos ao subir de nível
    },

    // 🏰 DESEMPENHO E EVOLUÇÃO da Casa ✨
    // Os pontos da casa geralmente são um total da casa, não individual aqui,
    // mas podemos registrar contribuições se quiser.
    // pontosCasaContribuidosIndividual: 0,

    // ⚗️ MELHORIAS E DESENVOLVIMENTO ⚗️
    habilidadesFeiticos: [
        // Array de objetos: { nome: "Lumos", nivel: 1, descricao: "Cria luz..." }
    ],
    // Para "Materiais Adquiridos" e "Conquistas", podemos usar o inventário e um log de eventos/missões.

    // 📦 Inventário 🛒
    galeoes: 50, // Moeda inicial padrão
    inventario: [
        // Array de objetos: { itemNome: "Varinha Simples", quantidade: 1, tipo: "Varinha", descricao: "Varinha inicial padrão." }
        // Ou { itemNome: "Livro de Feitiços Ano 1", quantidade: 1, tipo: "Livro" }
    ],

    // 🐾 DESEMPENHO E EVOLUÇÃO DE PETS 🐾
    pet: null, // Objeto ou null se não tiver. Se puder ter mais de um, seria um array.
    // Exemplo de objeto pet:
    // pet: {
    //     nomePet: "Corujita",
    //     especieRaca: "Coruja Comum",
    //     nivelPet: 1, // Ou afeto, conforme seu PDF
    //     afetoPet: 0,
    //     personalidadePet: "Curiosa",
    //     habilidadesPet: ["Entrega de pequenas mensagens"]
    // },

    // Aptidões em Matérias (conforme seu PDF, escolhe 3 ao criar)
    aptidoesMaterias: [], // Array de strings, ex: ["Defesa Contra as Artes das Trevas", "Poções"]
    
    // Log de Missões/Eventos para "Conquistas Importantes"
    logConquistas: [
        // { data: "DD/MM/AAAA", tipo: "Missão", descricao: "Completou 'O Mistério do Diário Desaparecido'", recompensa: "50 XP, 10 Galeões"}
    ],

    // ✎ NOTAÇÕES DO DM/ADM ✎
    notacoesDM: "" // Um campo de texto livre ou um array de notas
};


const app = express();
// Aumenta o limite do corpo da requisição para o caso de webhooks com muitos dados ou mídias
app.use(bodyParser.json({ limit: '50mb' })); 
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3000; // Render define a porta, ou usamos 3000 localmente
const WHAPI_API_TOKEN = process.env.WHAPI_API_TOKEN; // Sua variável de ambiente no Render
const WHAPI_BASE_URL = "https://gate.whapi.cloud";   // URL base do Whapi

if (!WHAPI_API_TOKEN) {
    console.error("FATAL_ERROR: Variável de ambiente WHAPI_API_TOKEN não está definida no Render!");
    // Em um ambiente de produção real, você poderia fazer process.exit(1) aqui.
    // Por enquanto, apenas logamos para não quebrar o deploy se a var não estiver lá durante testes iniciais.
}

// ----- INÍCIO DA LÓGICA DO SEU RPG (Exemplos) -----
// (Mantenha a definição de 'let todasAsFichas = {};' aqui em cima)

// ADICIONE AS FUNÇÕES COMPLETAS handleCriarFicha e handleVerFicha AQUI
// (Vou omitir as definições delas aqui para não repetir o código imenso,
// mas elas devem estar definidas no seu arquivo, como na minha resposta anterior)
async function handleCriarFicha(chatIdParaResposta, idRemetente, nomeDoRemetenteNoZap, argsComando) {
    // ... (código completo da função handleCriarFicha que te passei)
}

async function handleVerFicha(chatIdParaResposta, idRemetente) {
    // ... (código completo da função handleVerFicha que te passei)
}


// ESTA É A FUNÇÃO QUE VOCÊ PRECISA ATUALIZAR:
function processarComandoRPG(chatId, remetente, nomeDoRemetenteNoZap, comandoCompleto) { // Adicionei nomeDoRemetenteNoZap
    const argsComandoOriginal = comandoCompleto.slice(1).trim(); // Pega tudo depois do '!'
    const comandoArgsArray = argsComandoOriginal.split(/ +/g);
    const comandoBase = comandoArgsArray.shift().toLowerCase();
    // 'args' para handleCriarFicha deve ser o array de strings após o comando, que a função vai juntar e splitar por ';'
    // Para outros comandos, pode ser argsComandoOriginal ou argsComandoArray dependendo do que a função espera

    console.log(`Processando Comando RPG: '!${comandoBase}', De: ${nomeDoRemetenteNoZap} (${remetente}) no Chat: ${chatId}, Args originais: "${argsComandoOriginal}"`);

    if (comandoBase === 'criar' || comandoBase === 'novaficha' || comandoBase === 'criarpersonagem') {
        // Passa o array de argumentos que foi splitado por espaço.
        // A função handleCriarFicha vai juntar e re-splitar por ';'.
        handleCriarFicha(chatId, remetente, nomeDoRemetenteNoZap, comandoArgsArray); // CHAMANDO A FUNÇÃO REAL
    } else if (comandoBase === 'ficha' || comandoBase === 'minhaficha') {
        handleVerFicha(chatId, remetente); // CHAMANDO A FUNÇÃO REAL
    }
    // Adicione outros 'else if' para mais comandos aqui
    // else if (comandoBase === 'testeimagem') {
    //    enviarMensagemTextoWhapi(chatId, `Comando !testeimagem recebido. Lógica do canvas a ser implementada.`);
    // }
    else {
        enviarMensagemTextoWhapi(chatId, `Comando de RPG "!${comandoBase}" ainda não implementado, ${nomeDoRemetenteNoZap}.`);
    }
}

// ----- FIM DA LÓGICA DO SEU RPG (Exemplos) -----

// DENTRO DO SEU WEBHOOK app.post('/webhook/whatsapp', ...)
// A chamada para processarComandoRPG deve ser assim:
// else if (textContent && textContent.startsWith('!')) {
//     // 'sender' é o ID do remetente (ex: numero@s.whatsapp.net)
//     // 'nomeRemetenteNoZap' é o nome do perfil do WhatsApp do remetente (que pegamos de messageData.from_name)
//     processarComandoRPG(chatId, sender, nomeRemetenteNoZap, textContent); // Passa textContent inteiro
// }

// Endpoint de Webhook: O Whapi.Cloud enviará as mensagens recebidas para cá
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

                // Extração de dados CONFORME A DOCUMENTAÇÃO DO WHAPI QUE VOCÊ MOSTROU:
                const fromMe = messageData.from_me;      // boolean
                const chatId = messageData.chat_id;      // string (ID da conversa para responder)
                const sender = messageData.from;         // string (Quem enviou. Em grupos, é o participante)
                const messageType = messageData.type;    // string (ex: "text", "image")
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
                
                console.log(`Chat ID: ${idParaLog}, Remetente: ${senderParaLog}, Tipo: ${messageType}, Conteúdo: "${textContent}"`);

                // Comando de teste simples
                if (textContent && textContent.toLowerCase() === '!ping whapi') {
                    await enviarMensagemTextoWhapi(chatId, 'Pong do Whapi! 🧙‍♂️ Servidor no Render está no ar e recebendo!');
                } 
                // Chamada para processar comandos do RPG
                else if (textContent && textContent.startsWith('!')) { // Assumindo que comandos RPG começam com '!'
                    processarComandoRPG(chatId, sender, textContent);
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

// Função para ENVIAR MENSAGENS DE TEXTO usando a API do Whapi.Cloud
async function enviarMensagemTextoWhapi(para, mensagem) {
    if (!WHAPI_API_TOKEN) {
        console.error("Token do Whapi não configurado para envio.");
        return;
    }
    console.log(`Enviando mensagem de texto via Whapi para ${para}: "${mensagem}"`);

    const endpoint = "/messages/text"; // Confirmado pela sua imagem da documentação
    const urlDeEnvio = `${WHAPI_BASE_URL}${endpoint}`;

    const payload = {
        "to": para,
        "body": mensagem
    };

    const headers = {
        'Authorization': `Bearer ${WHAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    try {
        console.log(`Enviando POST para ${urlDeEnvio}`);
        // console.log(`Headers para envio:`, JSON.stringify(headers)); // Descomente para depurar o token se necessário
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

// Função para ENVIAR IMAGEM (Você precisará ver o schema "Message image send parameters" do Whapi)
// async function enviarImagemWhapi(para, bufferImagemOuUrl, legenda = "") {
//     if (!WHAPI_API_TOKEN) {
//         console.error("Token do Whapi não configurado para envio de imagem.");
//         return;
//     }
//     console.log(`Enviando imagem via Whapi para ${para} com legenda "${legenda}"`);

//     // DESCUBRA O ENDPOINT CORRETO NA DOCUMENTAÇÃO DO WHAPI PARA "Message image send"
//     const endpoint = "/messages/image"; // <<< CHUTE! VERIFIQUE A DOCUMENTAÇÃO!
//     const urlDeEnvio = `${WHAPI_BASE_URL}${endpoint}`;

//     // O Whapi pode esperar a imagem como multipart/form-data ou um link.
//     // Se for multipart/form-data, você precisará do 'form-data' package.
//     // Se for um link, o payload será diferente.
//     // Exemplo conceitual para um link (VERIFIQUE A DOCUMENTAÇÃO DO WHAPI!):
//     // const payload = {
//     //     "to": para,
//     //     "caption": legenda,
//     //     "image": { // Ou "media", "file", "url" etc.
//     //         "url": bufferImagemOuUrl // Se for um buffer, precisará ser base64 ou enviado como arquivo
//     //     }
//     // };

//     // const headers = {
//     //     'Authorization': `Bearer ${WHAPI_API_TOKEN}`,
//     //     'Content-Type': 'application/json', // Ou 'multipart/form-data'
//     // };

//     try {
//         // const response = await axios.post(urlDeEnvio, payload, { headers: headers });
//         // console.log('Resposta do Whapi ao enviar IMAGEM:', JSON.stringify(response.data, null, 2));
//         console.log("Função enviarImagemWhapi precisa ser implementada conforme doc do Whapi.");
//     } catch (error) {
//         console.error('Erro ao enviar IMAGEM pelo Whapi:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
//     }
// }


// Rota de teste para verificar se o servidor está no ar
app.get('/', (req, res) => {
    res.send('Servidor do Bot de RPG (Whapi no Render) está operacional!');
});

app.listen(PORT, () => {
    const publicUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    console.log(`Servidor do bot de RPG escutando na porta ${PORT}`);
    if (process.env.RENDER_EXTERNAL_URL) {
        console.log(`Webhook URL para configurar no Whapi.Cloud: ${publicUrl}/webhook/whatsapp`);
    } else {
        console.log(`Webhook local para testes (ex: com ngrok): http://localhost:${PORT}/webhook/whatsapp`);
    }
});
