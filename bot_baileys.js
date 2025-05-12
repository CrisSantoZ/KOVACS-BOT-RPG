// bot_server.js (FINALMENTE AJUSTADO PARA O WEBHOOK REAL DO WHAPI.CLOUD!)

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
// const Canvas = require('canvas'); // Descomente quando for usar

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const WHAPI_API_TOKEN = process.env.WHAPI_API_TOKEN;
const WHAPI_BASE_URL = "https://gate.whapi.cloud";

if (!WHAPI_API_TOKEN) {
    console.error("FATAL_ERROR: Variável de ambiente WHAPI_API_TOKEN não está definida no Render!");
    process.exit(1); 
}

// ----- LÓGICA DO SEU RPG VAI AQUI -----


// Endpoint de Webhook: O Whapi.Cloud enviará as mensagens recebidas para cá
app.post('/webhook/whatsapp', async (req, res) => {
    console.log('----------------------------------------------------');
    console.log('>>> Webhook do Whapi Recebido! <<<');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Corpo da requisição (RAW):', JSON.stringify(req.body, null, 2)); 

    try {
        // Whapi.Cloud envia um objeto que contém um array chamado 'messages'
        if (req.body.messages && Array.isArray(req.body.messages) && req.body.messages.length > 0) {
            console.log(`Encontrado array 'messages' com ${req.body.messages.length} entrada(s).`);

            for (const messageData of req.body.messages) {
                console.log("Processando messageData:", JSON.stringify(messageData, null, 2));

                // Extração de dados CONFORME A DOCUMENTAÇÃO QUE VOCÊ ENVIOU:
                const fromMe = messageData.from_me;         // boolean
                const chatId = messageData.chat_id;         // string (ID da conversa para responder)
                const messageType = messageData.type;       // string (ex: "text", "image")
                let textContent = "";

                if (messageType === 'text' && messageData.text && typeof messageData.text.body === 'string') {
                    textContent = messageData.text.body;
                } else if (messageData.caption && typeof messageData.caption === 'string') { 
                    // Se for uma mídia com legenda, o Whapi pode colocar o texto em 'caption'
                    // (Verifique na documentação de webhook para mensagens de imagem/vídeo)
                    textContent = messageData.caption;
                }
                // Adicione mais 'else if' para outros tipos de mensagem se precisar pegar texto de outros lugares

                if (fromMe === true) {
                    console.log(`Ignorando mensagem própria (from_me = true) para o chat ${chatId}.`);
                    continue; 
                }

                if (!chatId) {
                    console.warn("Entrada de mensagem no webhook sem 'chat_id' válido:", messageData);
                    continue; 
                }
                
                const idParaLog = typeof chatId === 'string' ? chatId.split('@')[0] : chatId.toString();
                console.log(`Chat ID: ${idParaLog}, Tipo: ${messageType}, Conteúdo: "${textContent}"`);

                // Lógica do seu bot
                if (textContent && textContent.toLowerCase() === '!ping whapi') {
                    await enviarMensagemTextoWhapi(chatId, 'Pong do Whapi! 🧙‍♂️ Webhook conectado e dados corretos!');
                }
                // --- AQUI VOCÊ CHAMA AS FUNÇÕES DO SEU RPG ---
                // Ex: if (textContent && textContent.toLowerCase().startsWith('!ficha')) { /* ... */ }
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
// (Esta função já estava correta com base na sua imagem anterior da documentação de envio)
async function enviarMensagemTextoWhapi(para, mensagem) {
    if
        
