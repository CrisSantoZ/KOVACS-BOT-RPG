
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    fetchLatestBaileysVersion,
    makeInMemoryStore // Para um armazenamento simples em memória, pode ajudar em alguns ambientes
} = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');

// Configuração do logger - Mude para 'trace' para o máximo de detalhes se necessário
const logger = P({ level: process.env.LOG_LEVEL || 'debug' }); // Use a variável de ambiente ou 'debug'

// Armazenamento em memória simples. O Render tem disco persistente para useMultiFileAuthState,
// mas ter um store pode ajudar em alguns cenários de conexão.
const store = makeInMemoryStore({ logger: logger.child({ level: 'silent', stream: 'store' }) });
store?.bind(sock.ev); // O 'sock' será definido abaixo

async function connectToWhatsApp() {
    console.log('Iniciando connectToWhatsApp...');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys_render');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Usando Baileys v${version.join('.')} (${isLatest ? 'é a mais recente' : 'NÃO é a mais recente'})`);

    const sock = makeWASocket({
        version,
        logger, // Use o logger configurado
        printQRInTerminal: false, // Definitivamente false para priorizar código
        browser: Browsers.ubuntu('Chrome'), // Tentar simular Chrome no Ubuntu
        auth: state,
        generateHighQualityLinkPreview: true,
        // Timeout de conexão - pode precisar ajustar
        connectTimeoutMs: 60000, // 60 segundos
        // Mantenha a conexão ativa (pode ajudar em plataformas PaaS)
        keepAliveIntervalMs: 20000, // Envia um ping a cada 20 segundos
        // Se houver um store, binde os eventos a ele
        // getMessage: async key => {
        // return (store.loadMessage(key.remoteJid, key.id) || store.loadMessage(key.remoteJid, key.id))?.message || undefined;
        // }
    });

    // Binda o store aos eventos do socket (se estiver usando)
    store?.bind(sock.ev);

    // Lógica de pareamento com código
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
                sock.ws.config.printQRInTerminal = true; // Habilita QR como fallback
            }
        } else {
            console.error('MY_PHONE_NUMBER não definida ou inválida. Habilitando QR Code como fallback.');
            sock.ws.config.printQRInTerminal = true;
        }
    }

    sock.ev.on('connection.update', async (update) => {
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
                statusCode !== DisconnectReason.connectionClosed && // Se fechada por nós ou outra instância
                statusCode !== DisconnectReason.connectionReplaced &&
                statusCode !== DisconnectReason.badSession && // Sessão inválida, não adianta reconectar
                statusCode !== DisconnectReason.timedOut; // Timeout pode precisar de nova tentativa manual

            logger.error({ error: lastDisconnect?.error, statusCode }, `Conexão fechada. Reconectar: ${shouldReconnect}`);

            if (statusCode === DisconnectReason.restartRequired) {
                logger.warn('REINÍCIO SOLICITADO, reconectando...');
                connectToWhatsApp();
            } else if (shouldReconnect) {
                logger.info('Tentando reconectar...');
                // Adicionar um pequeno delay antes de reconectar pode ajudar
                setTimeout(connectToWhatsApp, 5000); // Tenta reconectar após 5 segundos
            } else if (statusCode === DisconnectReason.loggedOut) {
                logger.fatal("DESCONECTADO PERMANENTEMENTE (loggedOut). Delete 'auth_info_baileys_render' e reinicie o deploy.");
                // No Render, você pode precisar ir em "Disks" e limpar o disco se a pasta não for recriada automaticamente.
                // Ou simplesmente fazer um novo deploy que criará uma nova instância de disco.
            } else {
                logger.warn(`Não foi possível reconectar automaticamente. Status: ${statusCode}.`);
            }
        } else if (connection === 'open') {
            console.log('************************************************');
            console.log('>>> CONEXÃO ABERTA E BEM-SUCEDIDA (Baileys) <<<');
            console.log('************************************************');
            // console.log('Meus dados de login:', sock.authState.creds.me);
            if(receivedPendingNotifications) {
                logger.info('Notificações pendentes recebidas/sincronizadas.');
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

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

    return sock; // Retorna o socket para referência se necessário
}

// Inicia a conexão
(async () => {
    try {
        await connectToWhatsApp();
    } catch (err) {
        logger.fatal(err, "ERRO CRÍTICO AO INICIAR connectToWhatsApp");
        // Em um ambiente de servidor, você pode querer que o processo saia para ser reiniciado pelo gerenciador (ex: PM2, Docker, Render)
        // process.exit(1); // Descomente se quiser que o processo morra em caso de erro fatal na inicialização
    }
})();
                
