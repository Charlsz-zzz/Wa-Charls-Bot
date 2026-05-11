const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('baileys')
const axios = require('axios')
const qrcode = require('qrcode-terminal')
const pino = require('pino')
const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')

const pluginsDir = path.join(__dirname, 'plugins')

if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir)
}

const plugins = new Map()

function loadPlugins() {
    plugins.clear()
    const files = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'))
    
    for (let file of files) {
        try {
            delete require.cache[require.resolve(path.join(pluginsDir, file))]
            const plugin = require(path.join(pluginsDir, file))
            const name = file.replace('.js', '')
            plugins.set(name, plugin)
            console.log(`>>> Plugin cargado: ${name}`)
        } catch (err) {
            console.log(`>>> Error cargando ${file}: ${err.message}`)
        }
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    const sock = makeWASocket({
        auth: state,
        browser: Browsers.macOS('Desktop'),
        logger: pino({ level: 'silent' })
    })

    loadPlugins()

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if(qr) {
            console.log('\n>>> ESCANEA ESTE QR YA <<<\n')
            qrcode.generate(qr, {small: true})
        }
        if(connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode
            console.log('Se cerró. Código:', code)
            if(code!== DisconnectReason.loggedOut) {
                console.log('Reconectando...')
                setTimeout(() => startBot(), 3000)
            }
        }
        if(connection === 'open') console.log('>>> BOT CONECTADO <<<')
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]
        if(!m.message || m.key.fromMe) return
        const texto = m.message.conversation || m.message.extendedTextMessage?.text
        const numero = m.key.remoteJid
        if(!texto || numero.includes('@g.us') || numero === 'status@broadcast') return
        console.log(`[${numero}]: ${texto}`)

        if (texto.startsWith('.')) {
            const comando = texto.split(' ')[0].slice(1);
            const args = texto.split(' ').slice(1).join(' ');

            const NUMEROS_PERMITIDOS = [
                '5215564895343@s.whatsapp.net'
            ];

            // --- COMANDO.saveplug ---
            if (comando === 'saveplug') {
                if (false) {
                    await sock.sendMessage(numero, { text: '❌ No tienes permiso pa esto we' });
                    return;
                }

                if (!args) {
                    await sock.sendMessage(numero, {
                        text: `Usa: *.saveplug nombre_archivo*\n` +
                              `Ejemplo: *.saveplug tiktoksearch*\n\n` +
                              `*Cómo usar:* Responde al mensaje que tiene el código con *.saveplug nombre*`
                    });
                    return;
                }

                const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                if (!quotedMsg) {
                    await sock.sendMessage(numero, {
                        text: '❌ Tienes que responder al mensaje que contiene el código we'
                    });
                    return;
                }

                let codigo = quotedMsg.conversation ||
                            quotedMsg.extendedTextMessage?.text ||
                            quotedMsg.imageMessage?.caption ||
                            quotedMsg.videoMessage?.caption;

                if (!codigo) {
                    await sock.sendMessage(numero, {
                        text: '❌ El mensaje que citaste no tiene código/texto'
                    });
                    return;
                }

                codigo = codigo.replace(/^```(js|javascript)?\n?/, '').replace(/```$/, '');

                const fileName = args.endsWith('.js')? args : args + '.js';
                const filePath = path.normalize(path.join(pluginsDir, fileName));

                if (!filePath.startsWith(pluginsDir)) {
                    await sock.sendMessage(numero, { text: '❌ Nombre de archivo no válido we' });
                    return;
                }

                try {
                    fs.writeFileSync(filePath, codigo, 'utf8');
                    loadPlugins()
                    await sock.sendMessage(numero, {
                        text: `✅ Plug guardado como *${fileName}* 📄\n\n` +
                              `Ya puedes usarlo con *.${args}*`
                    });
                } catch (err) {
                    await sock.sendMessage(numero, {
                        text: `❌ Error al guardar: ${err.message}`
                    });
                }
                return;
            }

            // --- COMANDO.getplug ---
            if (comando === 'getplug') {
                if (false) {
                    await sock.sendMessage(numero, { text: '❌ No tienes permiso pa esto we' });
                    return;
                }

                if (!args) {
                    await sock.sendMessage(numero, {
                        text: `Usa: *.getplug nombre_archivo.js*\n` +
                              `Ejemplo: *.getplug tiktoksearch.js*`
                    });
                    return;
                }

                const filePath = path.normalize(path.join(pluginsDir, args));

                if (!filePath.startsWith(pluginsDir)) {
                    await sock.sendMessage(numero, { text: '❌ Ruta no permitida we' });
                    return;
                }

                if (!fs.existsSync(filePath)) {
                    await sock.sendMessage(numero, {
                        text: `❌ No encontré el archivo: *${args}*`
                    });
                    return;
                }

                try {
                    const stats = fs.statSync(filePath);
                    const sizeKB = (stats.size / 1024).toFixed(2);

                    await sock.sendMessage(numero, {
                        text: `*${args}* 📄\n\nPeso: ${sizeKB} KB\nRuta: plugins/${args}`
                    });

                    await sock.sendMessage(numero, {
                        document: fs.readFileSync(filePath),
                        fileName: args,
                        mimetype: 'text/javascript'
                    });
                } catch (err) {
                    await sock.sendMessage(numero, {
                        text: `❌ Error: ${err.message}`
                    });
                }
                return;
            }

            // --- COMANDO.reload ---
            if (comando === 'reload') {
                if (false) {
                    await sock.sendMessage(numero, { text: '❌ No tienes permiso pa esto we' });
                    return;
                }
                loadPlugins()
                await sock.sendMessage(numero, { 
                    text: `✅ Plugins recargados. Total: *${plugins.size}*` 
                });
                return;
            }

            // --- COMANDO.IA ---
            if (comando === 'IA') {
                if (!args) {
                    await sock.sendMessage(numero, {
                        text: `Usa: *.IA tu pregunta*\nEjemplo: *.IA explícame qué es un plugin*`
                    });
                    return;
                }
                try {
                    await sock.sendMessage(numero, { text: '🧠 Pensando...' });
                    const { data } = await axios.post('http://localhost:8000/charls', { mensaje: args })
                    await sock.sendMessage(numero, { text: data.respuesta })
                } catch(e) {
                    await sock.sendMessage(numero, { text: '❌ Error con Charls we, al rato le intento' })
                }
                return;
            }

            // --- EJECUTAR PLUGINS DINÁMICOS ---
            if (plugins.has(comando)) {
                try {
                    await plugins.get(comando)(sock, m, args);
                } catch (err) {
                    console.error(`Error en plugin ${comando}:`, err);
                    await sock.sendMessage(numero, { 
                        text: `❌ Error ejecutando *.${comando}*: ${err.message}` 
                    });
                }
                return;
            }

            // --- ALIAS .tt PARA TIKTOKSEARCH ---
            if (comando === 'tt') {
                if (plugins.has('tiktoksearch')) {
                    try {
                        await plugins.get('tiktoksearch')(sock, m, args);
                    } catch (err) {
                        console.error(`Error en plugin tt:`, err);
                        await sock.sendMessage(numero, { 
                            text: `❌ Error ejecutando *.tt*: ${err.message}` 
                        });
                    }
                    return;
                } else {
                    await sock.sendMessage(numero, {
                        text: '❌ El plugin tiktoksearch.js no está cargado we'
                    });
                    return;
                }
            }

            // Si el comando no existe, no hace nada
            return;
        }

        // Si no empieza con . no responde nada
        return;
    })
}
startBot()
