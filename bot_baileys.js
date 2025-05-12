// Nome do arquivo: bot_baileys.js (ou bot_server.js, conforme seu package.json)

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
// const Canvas = require('canvas'); // Descomente quando for usar o canvas

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
// Você vai expandir isso MUITO!
let personagens = {}; // Em um bot real, isso viria de um arquivo JSON ou banco de dados

function processarComandoRPG(chatId, remetente, comandoCompleto) {
    const args = comandoCompleto.split(' ');
    const comandoBase = args[0].toLowerCase();

    console.log(`Comando RPG recebido de ${remetente} no chat ${chatId}: ${comandoBase} com args: ${args.slice(1)}`);

    if (comandoBase === '!ficha') {
        // Lógica para buscar e mostrar a ficha do personagem 'remetente'
        // Exemplo: const ficha = personagens[remetente];
        // if (ficha) { enviarMensagemTextoWhapi(chatId, `Ficha de ${ficha.nome}: ...`); }
        // else { enviarMensagemTextoWhapi(chatId, `Personagem não encontrado.`); }
        enviarMensagemTextoWhapi(chatId, `Comando !ficha recebido para ${remetente}. Lógica da ficha a ser implementada.`);
        return;
    }

    if (comandoBase === '!testeimagem') {
        // Exemplo de como você poderia gerar e enviar uma imagem com canvas no futuro
        /*
        const canvas = Canvas.createCanvas(200, 100);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'blue';
        ctx.fillRect(0, 0, 200, 100);
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('Teste Canvas!', 100, 55);
        const buffer = canvas.toBuffer('image/png');
        enviarImagemWhapi(chatId, buffer, 'Teste de Imagem do Bot'); // Você precisará criar enviarImagemWhapi
        */
        enviarMensagemTextoWhapi(chatId, `Comando !testeimagem recebido. Lógica do canvas a ser implementada.`);
        return;
    }

    // Adicione outros comandos do RPG aqui
    // enviarMensagemTextoWhapi(chatId, `Comando RPG "${comandoBase}" ainda não implementado.`);
}

// ----- FIM DA LÓGICA DO SEU RPG (Exemplos) -----


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
