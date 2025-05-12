// bot_server.js

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
// const Canvas = require('canvas'); // Descomente quando for usar

const app = express();
app.use(bodyParser.json({ limit: '10mb' })); // Aumenta o limite para o caso de webhooks com muitos dados
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

const PORT = process.env.PORT || 3000; // Render define a porta, ou usamos 3000 localmente
const WHAPI_API_TOKEN = process.env.WHAPI_API_TOKEN;
const WHAPI_SEND_URL = process.env.WHAPI_SEND_URL; // Ex: https://gate.whapi.cloud/messages/text ou similar
// Verifique na documentação do Whapi se eles usam um ID de instância/canal na URL ou no corpo
const WHAPI_CHANNEL_ID = process.env.WHAPI_CHANNEL_ID; // Pode ser necessário para algumas APIs

if (!WHAPI_API_TOKEN || !WHAPI_SEND_URL) {
    console.error("ERRO: Variáveis de ambiente WHAPI_API_TOKEN ou WHAPI_SEND_URL não estão definidas!");
    // process.exit(1); // Pode ser drástico, mas impede o bot de rodar sem config
}

// ----- LÓGICA DO SEU RPG VAI AQUI (Funções, etc.) -----
// Exemplo:
// let personagens = {}; // Carregar de um JSON ou banco de dados
// function criarPersonagem(sender, nome, casa) { ... }
// function verFicha(sender) { ... }
// function gerarImagemFicha(personagem) { /* usa Canvas */ return bufferDaImagem; }


// Endpoint de Webhook: O Whapi.Cloud enviará as mensagens recebidas para cá
app.post('/webhook/whatsapp', async (req, res) => {
    console.log('Webhook do Whapi recebido!');
    console.log('Corpo da requisição:', JSON.stringify(req.body, null, 2));

    // A estrutura do 'req.body' dependerá EXATAMENTE de como o Whapi.Cloud envia os dados.
    // Você PRECISARÁ inspecionar um webhook real para ver como pegar 'sender', 'text', etc.
    // Abaixo é uma SUPOSTIÇÃO genérica - CONSULTE A DOCUMENTAÇÃO DO WHAPI!
    try {
        if (req.body.messages && req.body.messages.length > 0) {
            for (const message of req.body.messages) {
                if (message.from_me) { // Ignora mensagens enviadas pelo próprio bot
                    console.log("Ignorando mensagem própria.");
                    continue;
                }

                const sender = message.chat_id || message.from; // ou o campo correto para o número do remetente
                const text = message.text?.body || message.body || ""; // ou o campo correto para o texto

                if (!sender || !text) {
                    console.log("Webhook não continha sender ou texto válido:", message);
                    continue;
                }

                const senderNumero = sender.split('@')[0]; // Pega só o número
                console.log(`Mensagem de ${senderNumero}: ${text}`);

                // Exemplo de resposta simples
                if (text.toLowerCase() === '!ping whapi') {
                    await enviarMensagemWhapi(sender, 'Pong! Whapi Conectado! 🧙‍♂️');
                }
                // --- AQUI VOCÊ CHAMA AS FUNÇÕES DO SEU RPG ---
                // else if (text.toLowerCase().startsWith('!criarpersonagem')) {
                //     // ... parsear comando, chamar criarPersonagem(sender, ...), enviar resposta ...
                // }
            }
        } else {
            console.log("Webhook recebido sem o array 'messages' esperado ou vazio.");
        }
    } catch (error) {
        console.error("Erro ao processar webhook do Whapi:", error);
    }

    res.status(200).send('OK'); // É importante responder OK para o Whapi
});

// Função para ENVIAR mensagens usando a API do Whapi.Cloud
async function enviarMensagemWhapi(para, mensagem) {
    console.log(`Tentando enviar para ${para}: ${mensagem}`);
    // A estrutura do corpo e os headers dependerão da documentação do Whapi.Cloud
    // Este é um exemplo genérico, CONSULTE A DOCUMENTAÇÃO DO WHAPI!
    const payload = {
        // "token": WHAPI_API_TOKEN, // Alguns APIs colocam token no corpo
        // "instance_id": WHAPI_INSTANCE_ID, // Se necessário
        "to": para, // Ou "chat_id" ou "number"
        "body": mensagem, // Ou "text" ou "message"
        // "priority": "high", // Opcional
        // "typing_time": 0 // Opcional
    };

    // Adicione o token no header se for o método de autenticação deles
    const headers = {
        'Authorization': `Bearer ${WHAPI_API_TOKEN}`, // Método comum
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    try {
        const response = await axios.post(WHAPI_SEND_URL, payload, { headers: headers });
        console.log('Resposta do Whapi ao enviar mensagem:', response.data);
    } catch (error) {
        console.error('Erro ao enviar mensagem pelo Whapi:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
}

/*
// Função para ENVIAR IMAGEM (exemplo conceitual, adapte para o Whapi)
async function enviarImagemWhapi(para, bufferOuUrlImagem, legenda = "", nomeArquivo = "imagem.png") {
    console.log(`Tentando enviar imagem para ${para}`);
    // Whapi pode aceitar a imagem como multipart/form-data ou um link para a imagem.
    // CONSULTE A DOCUMENTAÇÃO DELES PARA ENVIO DE MÍDIA!

    // Exemplo se for multipart/form-data (requer 'form-data' npm package)
    // const FormData = require('form-data');
    // const form = new FormData();
    // form.append('to', para);
    // form.append('caption', legenda);
    // form.append('file', bufferOuUrlImagem, nomeArquivo); // Se for buffer
    // // form.append('url', bufferOuUrlImagem); // Se for URL

    // const headers = {
    //     ...form.getHeaders(),
    //     'Authorization': `Bearer ${WHAPI_API_TOKEN}`,
    // };
    // try {
    //     await axios.post(URL_DE_ENVIO_DE_IMAGEM_DO_WHAPI, form, { headers });
    //     console.log("Imagem enviada com sucesso pelo Whapi.");
    // } catch (error) {
    //     console.error('Erro ao enviar imagem:', error.response ? error.response.data : error.message);
    // }
}
*/

// Rota de teste para ver se o servidor está no ar
app.get('/', (req, res) => {
    res.send('Servidor do Bot de RPG está rodando!');
});

app.listen(PORT, () => {
    console.log(`Servidor do bot de RPG escutando na porta ${PORT}`);
    console.log(`Configure o webhook do Whapi.Cloud para: https://<SEU_DOMINIO_DO_RENDER>.onrender.com/webhook/whatsapp`);
    console.log(`Lembre-se de substituir <SEU_DOMINIO_DO_RENDER> pela URL real do seu serviço no Render.`);
});

