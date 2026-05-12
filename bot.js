const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { smsg } = require('./lib/simple.js');

const __dirname = path.resolve();
const pluginsDir = path.join(__dirname, 'plugins');

if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
}

const plugins = new Map();

function loadPlugins() {
    plugins.clear();
    if (!fs.existsSync(pluginsDir)) return;

    const files = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));

    for (let file of files) {
        try {
            delete require.cache[require.resolve(path.join(pluginsDir, file))];
            const plugin = require(path.join(pluginsDir, file));
            const name = file.replace('.js', '');
            plugins.set(name, plugin);
            console.log(chalk.green(`>>> Plugin cargado: ${name}`));
        } catch (err) {
            console.log(chalk.red(`>>> Error cargando ${file}: ${err.message}`));
        }
    }
    console.log(chalk.yellow(`>>> Total plugins: ${plugins.size}`));
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        auth: state,
        browser: Browsers.macOS('Desktop'),
        logger: pino({ level: 'silent' })
    });

    loadPlugins();

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log(chalk.yellow('\n>>> ESCANEA ESTE QR YA <<<\n'));
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            console.log(chalk.red('Se cerró. Código:'), code);
            if (code!== DisconnectReason.loggedOut) {
                console.log(chalk.cyan('Reconectando en 3s...'));
                setTimeout(() => startBot(), 3000);
            }
        }
        if (connection === 'open') {
            console.log(chalk.green('>>> BOT CONECTADO <<<'));
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m?.message || m.key.fromMe) return;

        const msg = smsg(sock, m);
        if (!msg) return;

        const texto = msg.text || '';
        if (!texto.startsWith('.')) return;

        const args = texto.slice(1).trim().split(/ +/);
        const comando = args.shift().toLowerCase();

        console.log(chalk.cyan(`[CMD] ${msg.sender.split('@')[0]}: ${comando}`));

        // --- EJECUTAR PLUGINS DINÁMICOS ---
        if (plugins.has(comando)) {
            try {
                await plugins.get(comando)(sock, msg, args.join(' '));
            } catch (err) {
                console.error(chalk.red(`Error en plugin ${comando}:`), err);
                await sock.sendMessage(msg.chat, {
                    text: `❌ Error ejecutando *.${comando}*: ${err.message}`
                });
            }
            return;
        }

        // Si el comando no existe, no hace nada
    });
}

startBot();