// Todo dia às 9h (agendador do banco), avisa a equipe por WhatsApp e por e-mail quem faz aniversário hoje.
import { clienteServidor } from '../_shared/comum.ts'
import { escapar } from '../_shared/email.ts'

Deno.serve(async (req) => {
  const segredo = Deno.env.get('NOTIFICACOES_SECRET')
  if (!segredo || req.headers.get('x-airam-segredo') !== segredo) return new Response('negado', { status: 401 })

  // data de hoje no horário de Brasília
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', month: '2-digit', day: '2-digit' }).format(new Date()) // MM-DD
  const { data } = await clienteServidor().from('processos')
    .select('codigo, cliente_nome, cliente_telefone, cliente_email, cliente_nascimento').not('cliente_nascimento', 'is', null)
  const vistos = new Set()
  const hojeLista = (data ?? []).filter((p) => p.cliente_nascimento.slice(5) === hoje && !vistos.has(p.cliente_email) && vistos.add(p.cliente_email))
  if (!hojeLista.length) return new Response(JSON.stringify({ aniversariantes: 0 }), { headers: { 'Content-Type': 'application/json' } })

  // WhatsApp para o dono/equipe: modelo aprovado na Meta com 2 variáveis ({{1}} quantidade, {{2}} nomes)
  const token = Deno.env.get('WHATSAPP_TOKEN')
  const numeroId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  const destinos = (Deno.env.get('AVISOS_EQUIPE_WHATSAPP') ?? '').split(',').map((s) => s.replace(/\D/g, '')).filter(Boolean)
  const whatsapp = []
  if (token && numeroId && destinos.length) {
    const nomes = hojeLista.map((p) => `${p.cliente_nome} (${p.codigo})`).join(', ').slice(0, 900)
    for (const to of destinos) {
      const r = await fetch(`https://graph.facebook.com/v21.0/${numeroId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: Deno.env.get('WHATSAPP_TEMPLATE_ANIVERSARIOS') ?? 'aniversarios_do_dia',
            language: { code: 'pt_BR' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: String(hojeLista.length) }, { type: 'text', text: nomes }] }],
          },
        }),
      })
      whatsapp.push(r.ok ? 'enviado' : `erro ${r.status}: ${(await r.text()).slice(0, 200)}`)
    }
  }

  const para = (Deno.env.get('AVISOS_EQUIPE_EMAIL') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const chave = Deno.env.get('RESEND_API_KEY')
  if (para.length && chave) {
    const linhas = hojeLista.map((p) => `<li style="margin-bottom:8px"><b>${escapar(p.cliente_nome)}</b> (${escapar(p.codigo)}) · ${escapar(p.cliente_telefone || p.cliente_email)}</li>`).join('')
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_REMETENTE') ?? 'Airam <portal@airam.arq.br>',
        to: para,
        subject: `Aniversário de cliente hoje (${hojeLista.length})`,
        html: `<div style="font-family:Arial,sans-serif;color:#2b2727"><h2 style="color:#930000">Aniversariantes de hoje</h2><ul>${linhas}</ul>
<p>Abra o portal em Aniversários para mandar os parabéns pelo WhatsApp.</p></div>`,
      }),
    })
  }
  return new Response(JSON.stringify({ aniversariantes: hojeLista.length, whatsapp }), { headers: { 'Content-Type': 'application/json' } })
})
