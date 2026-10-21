// E-mail pela conta do próprio usuário (Hostinger): SMTP com SSL (465) para enviar e IMAP com SSL (993)
// para guardar a cópia na pasta "Enviados". Também a cifra da senha (AES-GCM, chave CAIXAS_CHAVE do servidor).

export const SMTP = { host: Deno.env.get('SMTP_HOST') ?? 'smtp.hostinger.com', porta: Number(Deno.env.get('SMTP_PORTA') ?? 465) }
export const IMAP = { host: Deno.env.get('IMAP_HOST') ?? 'imap.hostinger.com', porta: Number(Deno.env.get('IMAP_PORTA') ?? 993) }
const TEMPO = 20000
const cod = new TextEncoder()
const dec = new TextDecoder()

// ---------------------------------------------------------------- cifra da senha
async function chave() {
  const b64 = Deno.env.get('CAIXAS_CHAVE')
  if (!b64) throw new Error('Falta o segredo CAIXAS_CHAVE no servidor.')
  const bruto = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', bruto, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
export async function cifrar(texto: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chave(), cod.encode(texto)))
  return `${b64(iv)}.${b64(c)}`
}
export async function decifrar(guardado: string) {
  const [iv, c] = guardado.split('.').map((x) => Uint8Array.from(atob(x), (ch) => ch.charCodeAt(0)))
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await chave(), c))
}

// ---------------------------------------------------------------- conexão de texto (linhas)
class Conexao {
  conn: Deno.TlsConn
  buffer = ''
  constructor(conn: Deno.TlsConn) {
    this.conn = conn
  }
  static async abrir(host: string, porta: number, caCerts?: string[]) {
    const conn = await Promise.race([
      Deno.connectTls({ hostname: host, port: porta, caCerts }),
      new Promise<never>((_, falha) => setTimeout(() => falha(new Error(`Sem resposta de ${host}:${porta}.`)), TEMPO)),
    ])
    return new Conexao(conn)
  }
  async linha(): Promise<string> {
    const fim = Date.now() + TEMPO
    for (;;) {
      const i = this.buffer.indexOf('\r\n')
      if (i >= 0) {
        const l = this.buffer.slice(0, i)
        this.buffer = this.buffer.slice(i + 2)
        return l
      }
      if (Date.now() > fim) throw new Error('O servidor de e-mail demorou demais para responder.')
      const p = new Uint8Array(16384)
      const n = await Promise.race([this.conn.read(p), new Promise<null>((ok) => setTimeout(() => ok(null), TEMPO))])
      if (n === null) throw new Error('A conexão com o servidor de e-mail caiu.')
      this.buffer += dec.decode(p.subarray(0, n))
    }
  }
  async escrever(t: string | Uint8Array) {
    const dados = typeof t === 'string' ? cod.encode(t) : t
    let enviado = 0
    while (enviado < dados.length) enviado += await this.conn.write(dados.subarray(enviado))
  }
  fechar() {
    try {
      this.conn.close()
    } catch { /* já fechada */ }
  }
}

// ---------------------------------------------------------------- SMTP
async function respostaSmtp(c: Conexao) {
  let l = await c.linha()
  const linhas = [l]
  while (/^\d{3}-/.test(l)) linhas.push((l = await c.linha()))
  return { codigo: Number(l.slice(0, 3)), texto: linhas.join(' ') }
}
async function comando(c: Conexao, cmd: string, esperado: number[], erro: string) {
  if (cmd) await c.escrever(cmd + '\r\n')
  const r = await respostaSmtp(c)
  if (!esperado.includes(r.codigo)) throw new Error(`${erro} (${r.texto.slice(0, 160)})`)
  return r
}
export async function smtpEntrar(usuario: string, senha: string, caCerts?: string[]) {
  const c = await Conexao.abrir(SMTP.host, SMTP.porta, caCerts)
  try {
    await comando(c, '', [220], 'O servidor SMTP recusou a conexão')
    await comando(c, 'EHLO portal.airam.arq.br', [250], 'O servidor SMTP não aceitou o EHLO')
    await comando(c, 'AUTH LOGIN', [334], 'O servidor SMTP não aceitou o login')
    await comando(c, btoa(usuario), [334], 'O servidor SMTP não aceitou o usuário')
    await comando(c, btoa(senha), [235], 'E-mail ou senha incorretos no SMTP')
    return c
  } catch (e) {
    c.fechar()
    throw e
  }
}
export async function smtpEnviar(c: Conexao, de: string, destinos: string[], mensagem: string) {
  await comando(c, `MAIL FROM:<${de}>`, [250], 'O servidor recusou o remetente')
  for (const d of destinos) await comando(c, `RCPT TO:<${d}>`, [250, 251], `O servidor recusou o destinatário ${d}`)
  await comando(c, 'DATA', [354], 'O servidor não aceitou a mensagem')
  // linhas que começam com ponto ganham outro ponto (regra do SMTP)
  await c.escrever(mensagem.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..') + '\r\n.\r\n')
  await comando(c, '', [250], 'O servidor não confirmou o envio')
  await c.escrever('QUIT\r\n')
  c.fechar()
}

// ---------------------------------------------------------------- IMAP
const aspas = (t: string) => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
class Imap {
  c: Conexao
  n = 0
  constructor(c: Conexao) {
    this.c = c
  }
  async cmd(t: string, literal?: Uint8Array) {
    const tag = `a${++this.n}`
    const linhas: string[] = []
    if (literal) {
      await this.c.escrever(`${tag} ${t} {${literal.length}}\r\n`)
      const l = await this.c.linha()
      if (!l.startsWith('+')) throw new Error(`IMAP recusou o envio da cópia (${l.slice(0, 120)})`)
      await this.c.escrever(literal)
      await this.c.escrever('\r\n')
    } else await this.c.escrever(`${tag} ${t}\r\n`)
    for (;;) {
      const l = await this.c.linha()
      if (l.startsWith(`${tag} `)) {
        if (!/^\S+ OK/i.test(l)) throw new Error(l.replace(/^\S+ (NO|BAD) /i, '').slice(0, 160))
        return linhas
      }
      linhas.push(l)
    }
  }
}
export async function imapEntrar(usuario: string, senha: string, caCerts?: string[]) {
  const c = await Conexao.abrir(IMAP.host, IMAP.porta, caCerts)
  const s = await c.linha()
  if (!/^\* OK/i.test(s)) {
    c.fechar()
    throw new Error('O servidor IMAP recusou a conexão.')
  }
  const i = new Imap(c)
  try {
    await i.cmd(`LOGIN ${aspas(usuario)} ${aspas(senha)}`)
  } catch {
    c.fechar()
    throw new Error('E-mail ou senha incorretos no IMAP.')
  }
  return i
}
// pasta de enviados: a marcada como \Sent, ou a que tem "Sent"/"Enviados" no nome
export async function pastaEnviados(i: Imap) {
  const linhas = await i.cmd('LIST "" "*"')
  const pastas = linhas.map((l) => {
    const m = l.match(/^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (.+)$/i)
    return m ? { flags: m[1], nome: m[2].replace(/^"(.*)"$/, '$1') } : null
  }).filter(Boolean) as { flags: string; nome: string }[]
  return (pastas.find((p) => /\\Sent/i.test(p.flags)) || pastas.find((p) => /(^|[./])(sent|enviad[ao]s?)( items| messages)?$/i.test(p.nome)))?.nome || 'INBOX.Sent'
}
export async function imapGuardarEnviado(usuario: string, senha: string, mensagem: string, caCerts?: string[]) {
  const i = await imapEntrar(usuario, senha, caCerts)
  try {
    const pasta = await pastaEnviados(i)
    await i.cmd(`APPEND ${aspas(pasta)} (\\Seen)`, cod.encode(mensagem.replace(/\r?\n/g, '\r\n')))
    await i.cmd('LOGOUT').catch(() => {})
    return pasta
  } finally {
    i.c.fechar()
  }
}

// ---------------------------------------------------------------- mensagem (MIME)
const b64Utf8 = (t: string) => btoa(String.fromCharCode(...cod.encode(t)))
export const cabecalho = (t: string) => (/^[\x20-\x7e]*$/.test(t) ? t : `=?UTF-8?B?${b64Utf8(t)}?=`)
const quebrar = (s: string) => s.replace(/.{1,76}/g, '$&\r\n')
function base64(bytes: Uint8Array) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768))
  return btoa(s)
}
export function montarMensagem(o: { de: string; nomeDe: string; para: string[]; cc: string[]; assunto: string; texto: string;
  anexos: { nome: string; mime: string; dados: Uint8Array }[] }) {
  const lim = `airam-${crypto.randomUUID()}`
  const dominio = o.de.split('@')[1] || 'airam.arq.br'
  const linhas = [
    `From: ${cabecalho(o.nomeDe)} <${o.de}>`,
    `To: ${o.para.join(', ')}`,
    ...(o.cc.length ? [`Cc: ${o.cc.join(', ')}`] : []),
    `Subject: ${cabecalho(o.assunto)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@${dominio}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${lim}"`,
    '',
    `--${lim}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    quebrar(b64Utf8(o.texto)),
  ]
  for (const a of o.anexos) {
    const nome = a.nome.replace(/["\r\n]/g, '')
    linhas.push(`--${lim}`, `Content-Type: ${a.mime || 'application/octet-stream'}; name="${cabecalho(nome)}"`, 'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${cabecalho(nome)}"; filename*=UTF-8''${encodeURIComponent(nome)}`, '', quebrar(base64(a.dados)))
  }
  linhas.push(`--${lim}--`, '')
  return linhas.join('\r\n')
}
