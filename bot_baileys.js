// bot_baileys.js

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    fetchLatestBaileysVersion // Para buscar a versão mais recente do Baileys
} = require('@whiskeysockets/baileys');
const P = require('pino'); // Logger usado pelo Baileys
const qrcode = require('qrcode-terminal'); // Para exibir QR code como fallback
const readline = require('readline'); // Para ler input do usuário (número de telefone)

// Função para perguntar o número de telefone ao usuário no terminal
const askForPhoneNumber = (query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans.trim()); // Remove espaços extras
    }));
};

async function connectToWhatsApp() {
    console.log('Iniciando conexão com Baileys...');

    // useMultiFileAuthState salva os dados da sessão em uma pasta (ex: 'auth_info_baileys')
    // para que você não precise se autenticar toda vez.
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    // Busca a versão mais recente do Baileys para melhor compatibilidade
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Usando Baileys v${version.join('.')}, é a mais recente: ${isLatest}`);

    const sock = makeWASocket({
        version, // Usa a versão mais recente do WhatsApp Web
        logger: P({ level: 'silent' }), // Nível de log: 'trace', 'debug', 'info', 'warn', 'error', 'fatal' ou 'silent'
        printQRInTerminal: true, // Por padrão, permite imprimir QR no terminal (como fallback)
        browser: Browsers.macOS('Desktop'), // Simula um navegador de Desktop (ex: Chrome no macOS)
        auth: state, // Passa o estado da autenticação (sessão salva)
        generateHighQualityLinkPreview: true, // Gera pré-visualizações de links de alta qualidade
    });

    // Lógica para pareamento com código se não houver sessão salva
    // sock.ev.on('connection.update', async (update) => { ... }) é onde o QR também é tratado.
    // Tentaremos obter o código de pareamento ANTES do loop de eventos se não houver 'me' (dados do usuário)
    if (!sock.authState.creds.me && !sock.authState.creds.registered) {
        console.log('Nenhuma sessão encontrada. Vamos tentar o pareamento com código.');
        const phoneNumber = await askForPhoneNumber('Digite seu número de WhatsApp no formato internacional (ex: 55119XXXXXXXX): ');

        if (phoneNumber && /^\d+$/.test(phoneNumber.replace(/[+()\s-]/g, ''))) { // Validação básica
            console.log(`Solicitando código de pareamento para o número: ${phoneNumber}...`);
            try {
                // Suprime a impressão de QR temporariamente se estivermos tentando o código
                sock.ws.config.printQRInTerminal = false;
                const code = await sock.requestPairingCode(phoneNumber.replace(/[+()\s-]/g, '')); // Remove caracteres não numéricos
                console.log('***********************************************************************');
                console.log(`   Seu CÓDIGO DE PAREAMENTO é: ${code}   `);
                console.log('   Instruções:');
                console.log('   1. No seu WhatsApp (neste celular), vá em: Menu (três pontinhos ou Configurações) > Aparelhos Conectados.');
                console.log('   2. Toque em "Conectar um aparelho".');
                console.log('   3. Escolha a opção "Conectar com número de telefone em vez disso".');
                console.log('   4. Digite o código acima no seu WhatsApp.');
                console.log('***********************************************************************');
            } catch (error) {
                console.error('Falha ao solicitar código de pareamento. O bot pode tentar usar QR Code.', error);
                // Se falhar, reabilita a impressão de QR para o evento 'connection.update'
                sock.ws.config.printQRInTerminal = true;
            }
        } else {
            console.log('Número de telefone inválido ou não fornecido. O bot pode tentar usar QR Code.');
            sock.ws.config.printQRInTerminal = true; // Garante que o QR será impresso se não houver número
        }
    }

    // Manipulador de eventos da conexão
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && sock.ws.config.printQRInTerminal) {
            console.log('--------------------------------------------------------------------------------');
            console.log('QR CODE RECEBIDO (Baileys)! Escaneie com seu WhatsApp.');
            qrcode.generate(qr, { small: true });
            console.log('Se um código de pareamento foi exibido antes, use-o preferencialmente.');
            console.log('--------------------------------------------------------------------------------');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`Conexão fechada! Status: ${statusCode}, Erro: ${lastDisconnect?.error}, Reconectar: ${shouldReconnect}`);
            if (shouldReconnect) {
                console.log("Tentando reconectar...");
                connectToWhatsApp(); // Tenta reconectar
            } else {
                console.log("Desconectado permanentemente (loggedOut). Delete a pasta 'auth_info_baileys' e reinicie para tentar um novo login.");
            }
        } else if (connection === 'open') {
            console.log('*********************************************');
            console.log('CONECTADO COM SUCESSO ao WhatsApp (Baileys)!');
            console.log('Bot de RPG Harry Potter (Baileys) está online.');
            console.log('*********************************************');
            // console.log('Meus dados de login:', sock.authState.creds.me); // Mostra seus dados de login
        }
    });

    // Salva as credenciais (sessão) sempre que forem atualizadas
    sock.ev.on('creds.update', saveCreds);

    // Manipulador de novas mensagens
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') { // Ignora mensagens próprias e notificações de status
            const sender = msg.key.remoteJid; // Quem enviou (ex: 55DDDNUMERO@s.whatsapp.net)
            const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

            if (messageText) { // Processa apenas se houver texto
                console.log(`[${sender?.split('@')[0]}]: ${messageText}`);

                // Comando de teste
                if (messageText.toLowerCase() === '!ping baileys') {
                    await sock.sendMessage(sender, { text: 'Pong! (Baileys) 🧙‍♂️' });
                    console.log(`Respondido para ${sender?.split('@')[0]} com Pong!`);
                }

                // --- AQUI ENTRARÁ A LÓGICA DO SEU RPG ---
                // Ex: if (messageText.startsWith('!criarpersonagem')) { /* ... */ }
            }
        }
    });
}

// Inicia a conexão
connectToWhatsApp().catch(err => {
    console.error("ERRO INESPERADO AO INICIAR A CONEXÃO COM BAILEYS:", err);
});
