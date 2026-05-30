function smsg(sock, m) {
    if (!m) return null;

    let M = {};
    M.key = m.key;
    M.message = m.message;
    M.chat = m.key.remoteJid;
    M.sender = m.key.participant || m.key.remoteJid;
    M.fromMe = m.key.fromMe;
    M.messageTimestamp = m.messageTimestamp;
    M.id = m.key.id;
    M.isGroup = M.chat.endsWith('@g.us');

    // Extraer texto del mensaje - versión completa
    M.text = m.message?.conversation ||
             m.message?.extendedTextMessage?.text ||
             m.message?.imageMessage?.caption ||
             m.message?.videoMessage?.caption ||
             m.message?.documentWithCaptionMessage?.message?.documentMessage?.caption ||
             m.message?.buttonsResponseMessage?.selectedButtonId ||
             m.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
             m.message?.templateButtonReplyMessage?.selectedId ||
             '';

    // Info del mensaje citado - más completo
    const contextInfo = m.message?.extendedTextMessage?.contextInfo ||
                       m.message?.imageMessage?.contextInfo ||
                       m.message?.videoMessage?.contextInfo;

    M.quoted = contextInfo?.quotedMessage || null;
    M.quotedSender = contextInfo?.participant || null;
    M.quotedId = contextInfo?.stanzaId || null;

    // Detectar tipo de mensaje
    M.mtype = Object.keys(m.message || {})[0];
    M.isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(M.mtype);

    // Funciones útiles
    M.reply = (text) => sock.sendMessage(M.chat, { text }, { quoted: m });
    M.react = (emoji) => sock.sendMessage(M.chat, { react: { text: emoji, key: m.key } });

    return M;
}

module.exports = { smsg };