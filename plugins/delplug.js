const fs = require('fs');
const path = require('path');

const handler = async (sock, msg, args) => {
  const numero = msg.key.remoteJid;
  const pluginName = args;

  if (!pluginName) {
    return sock.sendMessage(numero, {
      text: `❌ Debes poner el nombre del plugin.\n\n📌 *Ejemplo:* .delplug tiktoksearch.js`
    });
  }

  const pluginPath = path.join(__dirname, '..', 'plugins', pluginName);

  if (!fs.existsSync(pluginPath)) {
    return sock.sendMessage(numero, {
      text: `⚠️ El plugin *${pluginName}* no existe en la carpeta plugins.`
    });
  }

  try {
    fs.unlinkSync(pluginPath);
    sock.sendMessage(numero, {
      text: `🗑️ Plugin *${pluginName}* eliminado correctamente.\nReinicia el bot para que se quite de la memoria.`
    });
  } catch (e) {
    sock.sendMessage(numero, {
      text: `❌ Error al borrar: ${e.message}`
    });
  }
};

module.exports = handler;