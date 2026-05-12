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
    
    // Extraer texto del mensaje
    if (m.message?.conversation) {
        M.text = m.message.conversation;
    } else if (m.message?.extendedTextMessage?.text) {
        M.text = m.message.extendedTextMessage.text;
    } else if (m.message?.imageMessage?.caption) {
        M.text = m.message.imageMessage.caption;
    } else if (m.message?.videoMessage?.caption) {
        M.text = m.message.videoMessage.caption;
    } else {
        M.text = '';
    }
    
    // Mensaje citado
    M.quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
    M.quotedSender = m.message?.extendedTextMessage?.contextInfo?.participant || null;
    
    // Función reply fácil
    M.reply = (text) => sock.sendMessage(M.chat, { text }, { quoted: m });
    
    return M;
}

module.exports = { smsg };