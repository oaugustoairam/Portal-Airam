// Todo dia de manhã (agendador do banco), avisa a equipe por e-mail quem faz aniversário hoje.
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
  return new Response(JSON.stringify({ aniversariantes: hojeLista.length }), { headers: { 'Content-Type': 'application/json' } })
})
