// Envia os avisos pendentes da fila `notificacoes` por e-mail (Resend) e WhatsApp (API oficial da Meta).
// Chamado a cada minuto pelo agendador do banco (header x-airam-segredo) ou pela equipe
// no painel, para reenviar um aviso específico (login de funcionário).
import { cors, resposta, clienteServidor, exigirEquipe } from '../_shared/comum.ts'

const MAX_TENTATIVAS = 3

function escapar(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

function htmlEmail(nome, codigo, titulo, mensagem, portal) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;color:#2b2727">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:6px;overflow:hidden">
<tr><td style="background:#930000;color:#ffffff;padding:20px 24px;font-size:20px;font-weight:bold;letter-spacing:2px">AIRAM
<div style="font-size:12px;font-weight:normal;letter-spacing:0;opacity:.85">Arquitetura &amp; Marcenaria</div></td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 6px;font-size:12px;color:#6b6363;letter-spacing:1px;text-transform:uppercase">Processo ${escapar(codigo)}</p>
<h1 style="margin:0 0 16px;font-size:22px;color:#930000">${escapar(titulo)}</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5">Olá, ${escapar(nome)}!</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5">${escapar(mensagem)}</p>
${portal ? `<a href="${escapar(portal)}" style="display:inline-block;background:#930000;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:4px;font-weight:bold">Abrir o Portal Airam</a>` : ''}
</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#6b6363;border-top:1px solid #e3dddd">Você recebe estes avisos porque tem um processo com a Airam. Dúvidas? Responda pelo nosso WhatsApp.</td></tr>
</table></td></tr></table></body></html>`
}

async function enviarEmail(n, proc, portal) {
  const chave = Deno.env.get('RESEND_API_KEY')
  if (!chave) return { ignorado: 'RESEND_API_KEY não configurada' }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_REMETENTE') ?? 'Airam <portal@airam.arq.br>',
      to: n.destino,
      subject: `${n.titulo} · Processo ${proc.codigo}`,
      html: htmlEmail(proc.cliente_nome.split(' ')[0], proc.codigo, n.titulo, n.mensagem, portal),
      text: `Olá, ${proc.cliente_nome.split(' ')[0]}!\n\n${n.mensagem}\n\n${portal}`,
    }),
  })
  if (!r.ok) return { erro: `Resend ${r.status}: ${(await r.text()).slice(0, 300)}` }
  return {}
}

// Mensagem iniciada pela empresa no WhatsApp exige um modelo (template) aprovado pela Meta.
// Modelo usado (categoria Utilidade, idioma pt_BR), com 4 variáveis:
//   "Olá, {{1}}! Atualização do seu processo Airam {{2}}: {{3}} Acompanhe pelo portal: {{4}}"
async function enviarWhatsApp(n, proc, portal) {
  const token = Deno.env.get('WHATSAPP_TOKEN')
  const numeroId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  if (!token || !numeroId) return { ignorado: 'WhatsApp não configurado' }
  const texto = (v) => ({ type: 'text', text: String(v).replace(/\s+/g, ' ').trim() }) // a Meta não aceita quebras de linha
  const r = await fetch(`https://graph.facebook.com/v21.0/${numeroId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: n.destino,
      type: 'template',
      template: {
        name: Deno.env.get('WHATSAPP_TEMPLATE') ?? 'atualizacao_processo',
        language: { code: 'pt_BR' },
        components: [{
          type: 'body',
          parameters: [texto(proc.cliente_nome.split(' ')[0]), texto(proc.codigo), texto(n.mensagem), texto(portal || 'portal.airam.arq.br')],
        }],
      },
    }),
  })
  if (!r.ok) return { erro: `WhatsApp ${r.status}: ${(await r.text()).slice(0, 300)}` }
  return {}
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const segredo = Deno.env.get('NOTIFICACOES_SECRET')
  const peloAgendador = segredo && req.headers.get('x-airam-segredo') === segredo
  const equipe = peloAgendador ? null : await exigirEquipe(req)
  if (!peloAgendador && !equipe) return resposta({ erro: 'Acesso negado' }, 403)

  const { id } = await req.json().catch(() => ({}))
  const sb = clienteServidor()

  // reenvio manual: volta o aviso para a fila
  if (id && equipe) await sb.from('notificacoes').update({ status: 'pendente', tentativas: 0, erro: null }).eq('id', id)

  let consulta = sb.from('notificacoes').select('*, processos(codigo, cliente_nome, notificar)')
    .in('status', ['pendente', 'erro']).lt('tentativas', MAX_TENTATIVAS).order('criado_em').limit(25)
  if (id) consulta = consulta.eq('id', id)
  const { data: fila, error } = await consulta
  if (error) return resposta({ erro: error.message }, 500)

  const portal = Deno.env.get('PORTAL_URL') ?? ''
  const resultado = { enviados: 0, erros: 0, ignorados: 0 }

  for (const n of fila) {
    // trava simples: só processa se ainda estiver como estava (evita envio duplo em execuções simultâneas)
    const { data: travado } = await sb.from('notificacoes')
      .update({ tentativas: n.tentativas + 1 }).eq('id', n.id).eq('tentativas', n.tentativas).select('id')
    if (!travado?.length) continue

    const proc = n.processos
    let r
    try {
      r = !proc?.notificar ? { ignorado: 'Avisos desligados neste processo' }
        : n.canal === 'email' ? await enviarEmail(n, proc, portal)
        : await enviarWhatsApp(n, proc, portal)
    } catch (e) {
      r = { erro: String(e?.message ?? e).slice(0, 300) }
    }
    if (r.ignorado) {
      resultado.ignorados++
      await sb.from('notificacoes').update({ status: 'ignorado', erro: r.ignorado }).eq('id', n.id)
    } else if (r.erro) {
      resultado.erros++
      await sb.from('notificacoes').update({ status: 'erro', erro: r.erro }).eq('id', n.id)
    } else {
      resultado.enviados++
      await sb.from('notificacoes').update({ status: 'enviado', erro: null, enviado_em: new Date().toISOString() }).eq('id', n.id)
    }
  }
  return resposta(resultado)
})
