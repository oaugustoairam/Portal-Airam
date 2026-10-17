// "Esqueci minha senha": envia um código de 6 dígitos por e-mail ou SMS para o cliente
// redefinir a senha sozinho. A resposta é sempre a mesma, exista ou não o cadastro.
import { cors, resposta, clienteServidor, acharCliente, hashCodigo, telefoneE164 } from '../_shared/comum.ts'

const VALIDADE_MIN = 10
const MAX_CODIGOS_15MIN = 3
const OK = { ok: true, mensagem: 'Se o cadastro existir, enviamos um código de 6 dígitos. Ele vale por 10 minutos.' }

async function enviarEmail(para, nome, codigo) {
  const chave = Deno.env.get('RESEND_API_KEY')
  if (!chave) return false
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_REMETENTE') ?? 'Airam <portal@airam.arq.br>',
      to: para,
      subject: `${codigo} é o seu código do Portal Airam`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#2b2727">
<div style="background:#930000;color:#fff;padding:16px 20px;font-weight:bold;letter-spacing:2px">AIRAM</div>
<p style="font-size:16px">Olá, ${nome.split(' ')[0]}! Use o código abaixo para criar uma nova senha no Portal Airam:</p>
<p style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#930000;margin:24px 0">${codigo}</p>
<p style="font-size:14px;color:#6b6363">O código vale por ${VALIDADE_MIN} minutos. Se você não pediu, ignore este e-mail: sua senha continua a mesma.</p></div>`,
      text: `Seu código do Portal Airam: ${codigo}. Vale por ${VALIDADE_MIN} minutos.`,
    }),
  })
  return r.ok
}

// SMS pela Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)
async function enviarSms(para, codigo) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const de = Deno.env.get('TWILIO_FROM')
  if (!sid || !token || !de || !para) return false
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${sid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: para, From: de, Body: `Airam: seu código para redefinir a senha é ${codigo}. Vale por ${VALIDADE_MIN} min.` }),
  })
  return r.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const { identificador, canal } = await req.json().catch(() => ({}))
  const sb = clienteServidor()
  const cliente = await acharCliente(sb, identificador)
  if (!cliente) return resposta(OK)

  // limite: até 3 códigos a cada 15 minutos por cliente
  const desde = new Date(Date.now() - 15 * 60000).toISOString()
  const { count } = await sb.from('codigos_verificacao').select('id', { count: 'exact', head: true })
    .eq('user_id', cliente.userId).gte('criado_em', desde)
  if ((count ?? 0) >= MAX_CODIGOS_15MIN) return resposta({ erro: 'Muitos pedidos seguidos. Aguarde 15 minutos e tente de novo.' }, 429)

  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000
  const codigo = String(n).padStart(6, '0')
  const usarSms = canal === 'sms' && telefoneE164(cliente.telefone)

  // invalida códigos anteriores e guarda só o hash do novo
  await sb.from('codigos_verificacao').update({ usado_em: new Date().toISOString() }).eq('user_id', cliente.userId).is('usado_em', null)
  await sb.from('codigos_verificacao').insert({
    user_id: cliente.userId,
    canal: usarSms ? 'sms' : 'email',
    codigo_hash: await hashCodigo(codigo, cliente.userId),
    expira_em: new Date(Date.now() + VALIDADE_MIN * 60000).toISOString(),
  })

  const enviado = usarSms ? await enviarSms(telefoneE164(cliente.telefone), codigo) : await enviarEmail(cliente.email, cliente.nome, codigo)
  if (!enviado) console.error('Falha ao enviar código', usarSms ? 'sms' : 'email')
  return resposta(OK)
})
