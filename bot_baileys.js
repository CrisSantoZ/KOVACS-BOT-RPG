
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    fetchLatestBaileysVersion,
    makeInMemoryStore
} = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');

const logger = P({ level: process.env.LOG_LEVEL || 'debug' });

// CRIE O STORE AQUI FORA
const store = makeInMemoryStore({ logger: logger.child({ level: 'silent', stream: 'store' }) });
// MAS NÃO FAÇA O BIND AINDA

async function connectToWhatsApp() {
    console.log('Iniciando connectToWhatsApp...');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys_render');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Usando Baileys v${version.join('.')} (${isLatest ? 'é a mais recente' : 'NÃO é a mais recente'})`);

    const sock = makeWASocket({ // <--- sock é definido AQUI
        version,
        logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        auth: state,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 20000,
        // getMessage: async key => { // Descomente e ajuste se for usar o store para mensagens
        //    return (store.get ବା Message(key.remoteJid, key.id))?.message;
        // }
    });

    // FAÇA O BIND DO STORE AO SOCKET AQUI, DEPOIS QUE 'sock' EXISTE
    store?.bind(sock.ev);

    // Lógica de pareamento com código (continua como antes)
    if (!sock.authState.creds.me && !sock.authState.creds.registered) {
        const phoneNumber = process.env.MY_PHONE_NUMBER;
        if (phoneNumber && /^\d+$/.test(phoneNumber.replace(/[+()\s-]/g, ''))) {
            console.log(`Número de telefone da env: ${phoneNumber}. Solicitando código de pareamento...`);
            try {
                const code = await sock.requestPairingCode(phoneNumber.replace(/[+()\s-]/g, ''));
                console.log('***********************************************************************');
                console.log(`   CÓDIGO DE PAREAMENTO: ${code}   `);
                console.log('   Use este código no seu WhatsApp: Aparelhos Conectados > Conectar com número de telefone.');
                console.log('***********************************************************************');
            } catch (error) {
                console.error('ERRO AO SOLICITAR CÓDIGO DE PAREAMENTO:', error);
                console.log('Verifique os logs detalhados. Tentando fallback para QR Code (se habilitado)...');
                sock.ws.config.printQRInTerminal = true;
            }
        } else {
            console.error('MY_PHONE_NUMBER não definida ou inválida nas variáveis de ambiente.');
            console.log('Tentando fallback para QR Code...');
            sock.ws.config.printQRInTerminal = true;
        }
    }

    // Evento connection.update (continua como antes)
    sock.ev.on('connection.update', async (update) => {
        // ... (código do connection.update como na versão anterior)
        const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;
        logger.info({ update }, 'Evento connection.update recebido');

        if (qr && sock.ws.config.printQRInTerminal) {
            console.log('--- QR CODE (Fallback) ---');
            qrcode.generate(qr, { small: true });
            console.log('--- Escaneie acima ---');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = 
                statusCode !== DisconnectReason.loggedOut &&
                statusCode !== DisconnectReason.connectionClosed &&
                statusCode !== DisconnectReason.connectionReplaced &&
                statusCode !== DisconnectReason.badSession &&
                statusCode !== DisconnectReason.timedOut; 

            logger.error({ error: lastDisconnect?.error, statusCode }, `Conexão fechada. Reconectar: ${shouldReconnect}`);

            if (statusCode === DisconnectReason.restartRequired) {
                logger.warn('REINÍCIO SOLICITADO, reconectando...');
                connectToWhatsApp();
            } else if (shouldReconnect) {
                logger.info('Tentando reconectar...');
                setTimeout(connectToWhatsApp, 5000); 
            } else if (statusCode === DisconnectReason.loggedOut) {
                logger.fatal("DESCONECTADO PERMANENTEMENTE (loggedOut). Delete 'auth_info_baileys_render' e reinicie o deploy.");
            } else {
                logger.warn(`Não foi possível reconectar automaticamente. Status: ${statusCode}.`);
            }
        } else if (connection === 'open') {
            console.log('************************************************');
            console.log('>>> CONEXÃO ABERTA E BEM-SUCEDIDA (Baileys) <<<');
            console.log('************************************************');
            if(receivedPendingNotifications) {
                logger.info('Notificações pendentes recebidas/sincronizadas.');
            }
        }
    });

    // Evento creds.update (continua como antes)
    sock.ev.on('creds.update', saveCreds);

    // Evento messages.upsert (continua como antes, com seu !ping baileys etc.)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
            const sender = msg.key.remoteJid;
            const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
            if (messageText) {
                logger.info({ sender: sender?.split('@')[0], message: messageText }, 'Mensagem recebida');
                if (messageText.toLowerCase() === '!ping baileys') {
                    try {
                        await sock.sendMessage(sender, { text: 'Pong! (Baileys no Render) 🧙‍♂️' });
                        logger.info({ to: sender?.split('@')[0] }, 'Respondido com Pong!');
                    } catch (e) {
                        logger.error(e, 'Erro ao enviar pong');
                    }
                }
            }
        }
    });

    return sock;
}

// Inicia a conexão (continua como antes)
(async () => {
    try {
        await connectToWhatsApp();
    } catch (err) {
        logger.fatal(err, "ERRO CRÍTICO AO INICIAR connectToWhatsApp");
    }
})();
