// Envia uma campanha de e-mail marketing para os clientes escolhidos pela equipe.
// Respeita quem pediu para não receber (aceita_marketing = false) e não repete e-mails.
import { cors, resposta, clienteServidor, exigirEquipe } from '../_shared/comum.ts'
import { htmlCampanha, tokenDescadastro } from '../_shared/email.ts'

const LOTE = 100 // limite do envio em lote da Resend
const MAXIMO = 2000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const equipe = await exigirEquipe(req)
  if (!equipe) return resposta({ erro: 'Acesso negado' }, 403)
  const chave = Deno.env.get('RESEND_API_KEY')
  if (!chave) return resposta({ erro: 'RESEND_API_KEY não configurada no servidor.' }, 500)
  if (!Deno.env.get('MARKETING_SECRET')) return resposta({ erro: 'MARKETING_SECRET não configurado no servidor.' }, 500)

  const { campanha_id, processo_ids } = await req.json().catch(() => ({}))
  const sb = clienteServidor()
  const { data: c } = await sb.from('campanhas').select('*').eq('id', campanha_id).maybeSingle()
  if (!c) return resposta({ erro: 'Campanha não encontrada' }, 404)
  if (c.status !== 'rascunho') return resposta({ erro: 'Esta campanha já foi enviada.' }, 409)
  if (!Array.isArray(processo_ids) || !processo_ids.length) return resposta({ erro: 'Escolha pelo menos um cliente.' }, 400)

  const { data: procs } = await sb.from('processos').select('cliente_email, cliente_nome, aceita_marketing').in('id', processo_ids)
  const unicos = new Map()
  for (const p of procs ?? []) {
    const email = p.cliente_email?.toLowerCase()
    if (email && p.aceita_marketing && !unicos.has(email)) unicos.set(email, p.cliente_nome)
  }
  // quem saiu da lista em qualquer processo não recebe
  const { data: sairam } = await sb.from('processos').select('cliente_email').eq('aceita_marketing', false)
  for (const s of sairam ?? []) unicos.delete(s.cliente_email.toLowerCase())
  const lista = [...unicos.entries()].slice(0, MAXIMO)
  if (!lista.length) return resposta({ erro: 'Nenhum dos clientes escolhidos aceita receber novidades.' }, 400)

  await sb.from('campanhas').update({ status: 'enviando', total: lista.length }).eq('id', c.id)
  await sb.from('campanha_envios').insert(lista.map(([email, nome]) => ({ campanha_id: c.id, email, nome })))

  const base = `${Deno.env.get('SUPABASE_URL')}/functions/v1/descadastrar`
  let enviados = 0, falhas = 0
  for (let i = 0; i < lista.length; i += LOTE) {
    const parte = lista.slice(i, i + LOTE)
    const mensagens = await Promise.all(parte.map(async ([email, nome]) => {
      const sair = `${base}?e=${encodeURIComponent(email)}&t=${await tokenDescadastro(email)}`
      return {
        from: Deno.env.get('EMAIL_MARKETING_REMETENTE') ?? Deno.env.get('EMAIL_REMETENTE') ?? 'Airam <novidades@airam.arq.br>',
        to: email,
        subject: c.assunto.replaceAll('{{nome}}', (nome || '').split(' ')[0]),
        html: htmlCampanha(c, nome, sair),
        headers: { 'List-Unsubscribe': `<${sair}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      }
    }))
    const r = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(mensagens),
    })
    const emails = parte.map(([e]) => e)
    if (r.ok) {
      enviados += parte.length
      await sb.from('campanha_envios').update({ status: 'enviado', enviado_em: new Date().toISOString() }).eq('campanha_id', c.id).in('email', emails)
    } else {
      falhas += parte.length
      const erro = `Resend ${r.status}: ${(await r.text()).slice(0, 200)}`
      await sb.from('campanha_envios').update({ status: 'erro', erro }).eq('campanha_id', c.id).in('email', emails)
    }
  }
  await sb.from('campanhas').update({ status: 'enviada', enviados, falhas, enviada_em: new Date().toISOString() }).eq('id', c.id)
  return resposta({ ok: true, total: lista.length, enviados, falhas })
})
