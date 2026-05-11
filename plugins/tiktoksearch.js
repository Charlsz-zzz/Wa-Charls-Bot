const fg = require('api-dylux');

const handler = async (sock, msg, args) => {
  const numero = msg.key.remoteJid;
  const text = args;
  
  try {
    if (!args) {
      return sock.sendMessage(numero, { 
        text: `🥷 Debes ingresar un enlace de TikTok.\n\n📌 *Ejemplo:* .tt https://vm.tiktok.com/ZMreHF2dC/` 
      });
    }

    if (!/(?:https:?\/{2})?(?:w{3}|vm|vt|t)?\.?tiktok\.com\/([^\s&]+)/gi.test(args)) {
      return sock.sendMessage(numero, { 
        text: `❎ Enlace de TikTok inválido.` 
      });
    }

    await sock.sendMessage(numero, { 
      text: `⌛ Descargando video...` 
    });

    let data = await fg.tiktok(args);
    let { title, play, duration } = data.result;
    let { nickname } = data.result.author;

    let caption = `
⚔️ *Descargador de TikTok*

◦ 👤 *Autor:* ${nickname}
◦ 📌 *Título:* ${title}
◦ ⏱️ *Duración:* ${duration}
`.trim();

    await sock.sendMessage(numero, {
      video: { url: play },
      caption: caption
    });

  } catch (e) {
    console.error(e);
    return sock.sendMessage(numero, { 
      text: `❌ *Error:* ${e.message}` 
    });
  }
};

module.exports = handler;