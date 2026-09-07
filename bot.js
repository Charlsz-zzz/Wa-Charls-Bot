const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const { smsg } = require('./lib/simple.js');

const pluginsDir = path.join(__dirname, 'plugins');

if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
}

const plugins = new Map();

function loadPlugins() {
    plugins.clear();
    const files = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
    for (let file of files) {
        try {
            delete require.cache[require.resolve(path.join(pluginsDir, file))];
            const plugin = require(path.join(pluginsDir, file));
            const fn = plugin.default || plugin;
            if(typeof fn!== 'function') throw new Error('El plugin no exporta una función');
            const name = file.replace('.js', '').toLowerCase();
            plugins.set(name, fn);
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

    fs.watch(pluginsDir, () => loadPlugins());

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log(chalk.yellow('\n>>> ESCANEA ESTE QR YA <<<\n'));
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red('Se cerró. Código:'), code);
            if (code!== DisconnectReason.loggedOut) {
                console.log(chalk.cyan('Reconectando en 3s...'));
                setTimeout(() => startBot(), 3000);
            } else {
                console.log(chalk.red('Sesión cerrada. Borra auth_info y escanea de nuevo.'));
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

        console.log(chalk.cyan(`[CMD] ${msg.sender.split('@')[0]}:.${comando}`));

        if (plugins.has(comando)) {
            try {
                await plugins.get(comando)(sock, msg, args.join(' '), { plugins });
            } catch (err) {
                console.error(chalk.red(`Error en plugin ${comando}:`), err);
                await sock.sendMessage(msg.chat, { text: `❌ Error en *.${comando}*: ${err.message}` });
            }
        }
    });
}

startBot();