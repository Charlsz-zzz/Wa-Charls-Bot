let handler = async (m, { conn }) => {
  conn.reply(m.chat, 'Hola we, aquí está el menú del bot', m)
}
handler.command = /^(menu|help)$/i
export default handler
