const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal'); // Ainda como fallback

async function connectToWhatsApp() {
    console.log('Iniciando conexão com Baileys para Render.com...');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys_render'); // Nova pasta de auth para teste limpo
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Usando Baileys v${version.join('.')}, é a mais recente: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger: P({ level: 'info' }), // Mude para 'info' ou 'debug' para mais logs no Render
        printQRInTerminal: false, // INICIE COM FALSE para priorizar o código
        browser: Browsers.macOS('Desktop'),
        auth: state,
        generateHighQualityLinkPreview: true,
    });

    // Lógica para pareamento com código
    if (!sock.authState.creds.me && !sock.authState.creds.registered) {
        const phoneNumber = process.env.MY_PHONE_NUMBER;

        if (phoneNumber && /^\d+$/.test(phoneNumber.replace(/[+()\s-]/g, ''))) {
            console.log(`Número de telefone da variável de ambiente: ${phoneNumber}`);
            console.log(`Tentando solicitar código de pareamento para: ${phoneNumber}...`);
            try {
                const code = await sock.requestPairingCode(phoneNumber.replace(/[+()\s-]/g, ''));
                console.log('***********************************************************************');
                console.log(`   Seu CÓDIGO DE PAREAMENTO é: ${code}   `);
                console.log('   Digite este código no seu WhatsApp em: Aparelhos Conectados > Conectar com número de telefone.');
                console.log('***********************************************************************');
            } catch (error) {
                console.error('FALHA AO SOLICITAR CÓDIGO DE PAREAMENTO:', error);
                console.log('Tentando fallback para QR Code...');
                sock.ws.config.printQRInTerminal = true; // Habilita o QR se o código falhar
                // Pode ser necessário re-emitir o evento de conexão ou algo para o QR aparecer se a conexão já estiver 'update'
            }
        } else {
            console.error('MY_PHONE_NUMBER não definida ou inválida nas variáveis de ambiente.');
            console.log('Tentando fallback para QR Code...');
            sock.ws.config.printQRInTerminal = true; // Habilita o QR
        }
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && sock.ws.config.printQRInTerminal) { // Só imprime se estiver habilitado
            console.log('--------------------------------------------------------------------------------');
            console.log('QR CODE RECEBIDO (Baileys)! Escaneie com seu WhatsApp.');
            qrcode.generate(qr, { small: true });
            console.log('--------------------------------------------------------------------------------');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            // Se foi desconectado por logout, ou se não há erro (pode ser uma parada normal), não reconecta.
            // Se for erro de ' ersetzt', ou ' Verbindung getrennt', tenta reconectar.
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== DisconnectReason.connectionClosed && statusCode !== DisconnectReason.connectionReplaced;
            console.log(`Conexão fechada! Status: ${statusCode}, Erro: ${lastDisconnect?.error}, Reconectar: ${shouldReconnect}`);
            
            if (statusCode === DisconnectReason.restartRequired) {
                console.log('Reinício solicitado pelo servidor, reconectando...');
                connectToWhatsApp();
            } else if (shouldReconnect) {
                console.log("Tentando reconectar...");
                connectToWhatsApp();
            } else if (statusCode === DisconnectReason.loggedOut) {
                console.log("Desconectado permanentemente (loggedOut). Delete a pasta 'auth_info_baileys_render' no Render (se possível) e no seu código, e reinicie para tentar um novo login.");
                // No Render, você pode precisar limpar o disco persistente ou fazer um novo deploy limpo.
            }
        } else if (connection === 'open') {
            console.log('*********************************************');
            console.log('CONECTADO COM SUCESSO ao WhatsApp (Baileys)!');
            console.log('*********************************************');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        // ... (seu código de tratamento de mensagens) ...
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
            const sender = msg.key.remoteJid;
            const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
            if (messageText) {
                console.log(`[${sender?.split('@')[0]}]: ${messageText}`);
                if (messageText.toLowerCase() === '!ping baileys') {
                    await sock.sendMessage(sender, { text: 'Pong! (Baileys) 🧙‍♂️ Render' });
                }
            }
        }
    });
}

connectToWhatsApp().catch(err => {
    console.error("ERRO INESPERADO AO INICIAR A CONEXÃO COM BAILEYS:", err);
});
        
