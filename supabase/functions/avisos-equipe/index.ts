// Avisos para a equipe do Comercial (novo lead e lembretes) por WhatsApp (API oficial da Meta) e e-mail (Resend).
// - Agendador do banco, a cada minuto (cabeçalho x-airam-segredo): põe na fila os lembretes que venceram e envia a fila.
// - Portal (usuário logado): { acao: 'processar' } envia na hora o que acabou de entrar na fila.
// - Master: { acao: 'status' | 'salvar' | 'teste' } para as credenciais da tela Configurações.
// As credenciais ficam na tabela integracoes (sem acesso pelo app) ou nos segredos do Supabase.
import { cors, resposta, clienteServidor, exigirEquipe } from '../_shared/comum.ts'
import { escapar } from '../_shared/email.ts'

const CHAVES = {
  whatsapp_token: 'WHATSAPP_TOKEN',
  whatsapp_phone_number_id: 'WHATSAPP_PHONE_NUMBER_ID',
  whatsapp_template_lead: 'WHATSAPP_TEMPLATE_LEAD',
  whatsapp_template_lembrete: 'WHATSAPP_TEMPLATE_LEMBRETE',
  resend_api_key: 'RESEND_API_KEY',
  email_remetente: 'EMAIL_REMETENTE',
}
const SECRETAS = ['whatsapp_token', 'resend_api_key']
const PADRAO = { whatsapp_template_lead: 'novo_lead_vendedor', whatsapp_template_lembrete: 'lembrete_vendedor', email_remetente: 'Airam <portal@airam.arq.br>' }

async function credenciais(sb) {
  const { data } = await sb.from('integracoes').select('chave, valor')
  const banco = Object.fromEntries((data ?? []).filter((x) => x.valor).map((x) => [x.chave, x.valor]))
  const out = {}
  for (const [k, env] of Object.entries(CHAVES)) out[k] = banco[k] || Deno.env.get(env) || PADRAO[k] || ''
  out.origem = Object.fromEntries(Object.keys(CHAVES).map((k) => [k, banco[k] ? 'portal' : Deno.env.get(CHAVES[k]) ? 'segredo' : PADRAO[k] ? 'padrao' : null]))
  return out
}

const fuso = { timeZone: 'America/Sao_Paulo' }
const dataHora = (iso) => {
  const d = new Date(iso)
  return {
    dia: d.toLocaleDateString('pt-BR', { ...fuso, day: '2-digit', month: '2-digit' }),
    hora: d.toLocaleTimeString('pt-BR', { ...fuso, hour: '2-digit', minute: '2-digit' }),
  }
}
const fone = (t) => {
  const n = String(t ?? '').replace(/\D/g, '')
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : n
}
const zap = (t) => {
  const n = String(t ?? '').replace(/\D/g, '')
  return n.length === 10 || n.length === 11 ? '55' + n : n
}

async function enviarWhatsApp(c, to, template, variaveis) {
  if (!c.whatsapp_token || !c.whatsapp_phone_number_id) throw new Error('WhatsApp não configurado (token e ID do número).')
  const corpo = {
    messaging_product: 'whatsapp', to, type: 'template',
    template: template === 'hello_world'
      ? { name: 'hello_world', language: { code: 'en_US' } }
      : { name: template, language: { code: 'pt_BR' }, components: [{ type: 'body', parameters: variaveis.map((v) => ({ type: 'text', text: String(v || '-').slice(0, 900) })) }] },
  }
  const r = await fetch(`https://graph.facebook.com/v21.0/${c.whatsapp_phone_number_id}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${c.whatsapp_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  })
  if (!r.ok) {
    let msg = `Meta ${r.status}`
    try { msg += ': ' + ((await r.json()).error?.message ?? '') } catch { /* sem corpo */ }
    throw new Error(msg.slice(0, 300))
  }
}
async function enviarEmail(c, para, assunto, texto) {
  if (!c.resend_api_key) throw new Error('E-mail não configurado (chave da Resend).')
  const html = `<div style="font-family:Arial,sans-serif;color:#2b2727;font-size:15px;line-height:1.5"><h2 style="color:#930000;margin:0 0 12px">${escapar(assunto)}</h2><p>${escapar(texto).replace(/\n/g, '<br>')}</p></div>`
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${c.resend_api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: c.email_remetente, to: [para], subject: assunto, html, text: texto }),
  })
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

// monta a mensagem com os dados atuais do lead (inclui o agendamento cadastrado junto)
async function montar(sb, a) {
  let link = Deno.env.get('PORTAL_URL') ?? 'https://portal.airam.arq.br'
  const [{ data: lead }, { data: pessoa }] = await Promise.all([
    sb.from('leads').select('id, nome, telefone, email').eq('id', a.lead_id).maybeSingle(),
    sb.from('perfis').select('nome, email').eq('id', a.usuario_id).maybeSingle(),
  ])
  if (!lead) return null
  link = `${link.replace(/\/$/, '')}/?lead=${lead.id}` // abre direto o cartão do cliente
  const vendedor = (pessoa?.nome || pessoa?.email || '').split(' ')[0]
  const contato = fone(lead.telefone) + (lead.email ? ` / ${lead.email}` : '')
  if (a.evento === 'lembrete') {
    const { data: l } = await sb.from('lembretes').select('quando, tipo, descricao').eq('id', a.lembrete_id).maybeSingle()
    const q = l ? dataHora(l.quando) : { dia: '', hora: '' }
    const tipos = { retornar_contato: 'Retornar contato', enviar_orcamento: 'Enviar orçamento', confirmar_agendamento: 'Confirmar agendamento', outro: 'Lembrete' }
    const oque = [tipos[l?.tipo] || 'Lembrete', l?.descricao].filter(Boolean).join(': ')
    return {
      assunto: `Lembrete: ${lead.nome}`,
      texto: `Olá ${vendedor}, lembrete para ${q.dia} às ${q.hora}: ${oque} — ${lead.nome} (${contato}). Acesse o portal: ${link}`,
      variaveis: [vendedor, lead.nome, oque, `${q.dia} às ${q.hora}`, link],
      template: 'whatsapp_template_lembrete',
    }
  }
  const { data: ag } = await sb.from('agendamentos').select('inicio, modalidade, lojas(nome)').eq('lead_id', lead.id)
    .eq('situacao', 'marcado').order('inicio').limit(1).maybeSingle()
  let agenda = 'Ainda sem agendamento.'
  if (ag) {
    const q = dataHora(ag.inicio)
    agenda = `Agendado para ${q.dia} às ${q.hora} – ${ag.modalidade === 'online' ? 'Online' : ag.lojas?.nome || 'Loja'}.`
  }
  return {
    assunto: `Novo lead: ${lead.nome}`,
    texto: `Olá ${vendedor}, você recebeu um novo lead: ${lead.nome} – ${contato}. ${agenda} Acesse o portal: ${link}`,
    variaveis: [vendedor, lead.nome, contato, agenda, link],
    template: 'whatsapp_template_lead',
  }
}

async function processarFila(sb) {
  await sb.rpc('enfileirar_lembretes')
  const { data: fila, error } = await sb.rpc('pegar_avisos_equipe', { limite: 30 })
  if (error) throw error
  const c = await credenciais(sb)
  let enviados = 0
  let falhas = 0
  for (const a of fila ?? []) {
    let situacao = 'enviado'
    let erro = null
    let mensagem = a.mensagem
    try {
      const m = await montar(sb, a)
      if (!m) throw new Error('Lead não encontrado.')
      mensagem = m.texto
      if (!a.destino) throw new Error(a.canal === 'whatsapp' ? 'Usuário sem WhatsApp cadastrado.' : 'Usuário sem e-mail.')
      if (a.canal === 'whatsapp') await enviarWhatsApp(c, zap(a.destino), c[m.template], m.variaveis)
      else await enviarEmail(c, a.destino, m.assunto, m.texto)
      enviados++
    } catch (e) {
      situacao = 'falhou'
      erro = String(e.message ?? e).slice(0, 400)
      falhas++
    }
    await sb.from('avisos_equipe').update({ situacao, erro, mensagem, processando_em: null, enviado_em: situacao === 'enviado' ? new Date().toISOString() : null }).eq('id', a.id)
  }
  return { enviados, falhas }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const sb = clienteServidor()
  const segredo = Deno.env.get('NOTIFICACOES_SECRET')
  if (segredo && req.headers.get('x-airam-segredo') === segredo) {
    return resposta(await processarFila(sb))
  }
  const quem = await exigirEquipe(req)
  if (!quem || quem.ativo === false) return resposta({ erro: 'Acesso negado.' }, 403)
  const corpo = await req.json().catch(() => ({}))
  const acao = corpo.acao ?? 'processar'

  if (acao === 'processar') {
    try {
      return resposta(await processarFila(sb))
    } catch (e) {
      return resposta({ erro: String(e.message ?? e) }, 500)
    }
  }

  if (quem.papel !== 'admin') return resposta({ erro: 'Somente o master mexe nas integrações.' }, 403)
  if (acao === 'status') {
    const c = await credenciais(sb)
    const campos = Object.fromEntries(Object.keys(CHAVES).map((k) => [k, {
      origem: c.origem[k],
      // segredos nunca voltam para o navegador: só os 4 últimos caracteres
      valor: SECRETAS.includes(k) ? (c[k] ? '••••' + c[k].slice(-4) : '') : c[k],
    }]))
    const { data: ultimos } = await sb.from('avisos_equipe').select('canal, situacao, erro, criado_em').order('criado_em', { ascending: false }).limit(10)
    return resposta({ campos, ultimos: ultimos ?? [] })
  }
  if (acao === 'salvar') {
    const novos = corpo.credenciais ?? {}
    for (const k of Object.keys(CHAVES)) {
      if (!(k in novos)) continue
      const v = novos[k] === null ? null : String(novos[k]).trim()
      if (v === '') continue // vazio = manter o que já existe
      const { error } = await sb.from('integracoes').upsert({ chave: k, valor: v, atualizado_em: new Date().toISOString(), atualizado_por: quem.id })
      if (error) return resposta({ erro: error.message }, 500)
    }
    return resposta({ ok: true })
  }
  if (acao === 'teste') {
    const c = await credenciais(sb)
    const destino = String(corpo.destino ?? '').trim()
    try {
      if (corpo.canal === 'whatsapp') {
        const n = zap(destino)
        if (n.length < 12) throw new Error('Informe o WhatsApp com DDD.')
        // modelo de teste que a Meta cria em toda conta; os modelos do portal precisam estar aprovados
        await enviarWhatsApp(c, n, corpo.modelo || 'hello_world', corpo.modelo ? ['Teste', 'Cliente de teste', '(11) 90000-0000', 'Teste do portal', 'https://portal.airam.arq.br'] : [])
      } else {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) throw new Error('Informe um e-mail válido.')
        await enviarEmail(c, destino, 'Teste do portal Airam', 'Se você recebeu este e-mail, o envio de avisos do Comercial está funcionando.')
      }
      return resposta({ ok: true })
    } catch (e) {
      return resposta({ erro: String(e.message ?? e) }, 400)
    }
  }
  return resposta({ erro: 'Ação inválida.' }, 400)
})
