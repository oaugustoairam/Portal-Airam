// Métricas de Vendas: tudo sai dos dados que o banco já liberou para quem está logado
// (o vendedor só recebe os próprios leads pela RLS, então só vê os próprios números).
import { diaLocal, canalDoLead } from './comercial.js'

const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const DIA = 86400000
const noPeriodo = (iso, de, ate) => {
  if (!iso) return false
  const d = iso.length === 10 ? iso : diaLocal(iso)
  return (!de || d >= de) && (!ate || d <= ate)
}

// filtros: { de, ate, vendedor, origem, canal }
export function calcularMetricas({ leads, agendamentos, lembretes, listas, pessoas, lojas }, f, agora = new Date()) {
  const colunas = listas.crm_colunas
  const tipoCol = Object.fromEntries(colunas.map((c) => [c.id, c.tipo]))
  const nome = (id) => {
    const p = pessoas.find((x) => x.id === id)
    return p ? p.nome || p.email : 'Sem nome'
  }
  const nomeOrigem = (id) => listas.origens_lead.find((o) => o.id === id)?.nome || 'Sem origem'
  const nomeCanal = (c) => (c === 'online' ? 'Online' : c ? lojas.find((l) => l.id === c)?.nome || c : 'Sem agendamento')
  const canal = Object.fromEntries(leads.map((l) => [l.id, canalDoLead(agendamentos, l.id)]))

  // leads que passam nos filtros de vendedor / origem / canal (sem o período)
  const base = leads.filter((l) => (!f.vendedor || l.vendedor_id === f.vendedor) && (!f.origem || l.origem_id === f.origem)
    && (!f.canal || (f.canal === 'online' ? canal[l.id] === 'online' : canal[l.id] === f.canal)))
  const ids = new Set(base.map((l) => l.id))
  const agBase = agendamentos.filter((a) => ids.has(a.lead_id))

  const novos = base.filter((l) => noPeriodo(l.criado_em, f.de, f.ate))
  const vendas = base.filter((l) => tipoCol[l.coluna_id] === 'ganho' && noPeriodo(l.venda_data, f.de, f.ate))
  const perdas = base.filter((l) => tipoCol[l.coluna_id] === 'perdido' && noPeriodo(l.movido_em, f.de, f.ate))
  const agPeriodo = agBase.filter((a) => a.situacao !== 'cancelado' && noPeriodo(a.inicio, f.de, f.ate))
  const compareceu = agPeriodo.filter((a) => a.situacao === 'compareceu')
  const faturamento = vendas.reduce((s, l) => s + Number(l.venda_valor || 0), 0)
  const conv = (v, l) => (l ? v / l : null)

  const resumo = {
    leads: novos.length,
    agendamentos: agPeriodo.length,
    comparecimentos: compareceu.length,
    vendas: vendas.length,
    faturamento,
    ticket: vendas.length ? faturamento / vendas.length : null,
    conversao: conv(vendas.length, novos.length),
    perdas: perdas.length,
  }

  // agrupamentos
  function agrupar(chave, rotulo) {
    const g = new Map()
    const pegar = (k) => {
      if (!g.has(k)) g.set(k, { id: k, nome: rotulo(k), leads: 0, vendas: 0, faturamento: 0, agendados: 0, compareceu: 0 })
      return g.get(k)
    }
    novos.forEach((l) => pegar(chave(l)).leads++)
    vendas.forEach((l) => {
      const x = pegar(chave(l))
      x.vendas++
      x.faturamento += Number(l.venda_valor || 0)
    })
    const leadPorId = Object.fromEntries(base.map((l) => [l.id, l]))
    agPeriodo.forEach((a) => {
      const l = leadPorId[a.lead_id]
      if (!l) return
      const x = pegar(chave(l))
      x.agendados++
      if (a.situacao === 'compareceu') x.compareceu++
    })
    return [...g.values()].map((x) => ({ ...x, conversao: conv(x.vendas, x.leads), ticket: x.vendas ? x.faturamento / x.vendas : null }))
  }
  const porVendedor = agrupar((l) => l.vendedor_id, nome).sort((a, b) => b.faturamento - a.faturamento || b.leads - a.leads)
  const porOrigem = agrupar((l) => l.origem_id || null, nomeOrigem).sort((a, b) => b.leads - a.leads)
  const porCanal = agrupar((l) => canal[l.id] || null, nomeCanal).sort((a, b) => b.leads - a.leads)
  const porCaptador = agrupar((l) => l.captador_id || null, (id) => (id ? nome(id) : 'Sem captador')).sort((a, b) => b.leads - a.leads)

  // evolução mensal (meses do período; sem período, os últimos 12)
  const meses = []
  const fim = f.ate ? new Date(`${f.ate}T12:00:00`) : agora
  let ini = f.de ? new Date(`${f.de}T12:00:00`) : new Date(fim.getFullYear(), fim.getMonth() - 11, 1)
  ini = new Date(ini.getFullYear(), ini.getMonth(), 1)
  for (let d = ini; d <= fim && meses.length < 36; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    meses.push({ mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, leads: 0, vendas: 0, faturamento: 0 })
  }
  const mesDe = (iso) => meses.find((m) => m.mes === (iso.length === 10 ? iso : diaLocal(iso)).slice(0, 7))
  novos.forEach((l) => { const m = mesDe(l.criado_em); if (m) m.leads++ })
  vendas.forEach((l) => { const m = mesDe(l.venda_data); if (m) { m.vendas++; m.faturamento += Number(l.venda_valor || 0) } })

  // funil: leads do período → agendados → compareceram → vendidos
  const comAgenda = new Set(agBase.filter((a) => a.situacao !== 'cancelado').map((a) => a.lead_id))
  const comPresenca = new Set(agBase.filter((a) => a.situacao === 'compareceu').map((a) => a.lead_id))
  const funil = [
    ['Leads', novos.length],
    ['Agendados', novos.filter((l) => comAgenda.has(l.id)).length],
    ['Compareceram', novos.filter((l) => comPresenca.has(l.id)).length],
    ['Vendidos', novos.filter((l) => tipoCol[l.coluna_id] === 'ganho').length],
  ].map(([etapa, n]) => ({ etapa, n, taxa: novos.length ? n / novos.length : null }))

  const motivos = new Map()
  perdas.forEach((l) => {
    const n = listas.motivos_perda.find((m) => m.id === l.perda_motivo_id)?.nome || 'Sem motivo'
    motivos.set(n, (motivos.get(n) || 0) + 1)
  })
  const motivosPerda = [...motivos].map(([motivo, n]) => ({ motivo, n })).sort((a, b) => b.n - a.n)

  // tempos (em dias / horas) por vendedor
  const porV = (lista, valor) => {
    const g = new Map()
    lista.forEach((l) => {
      const v = valor(l)
      if (v == null || v < 0) return
      if (!g.has(l.vendedor_id)) g.set(l.vendedor_id, [])
      g.get(l.vendedor_id).push(v)
    })
    return [...g].map(([id, xs]) => ({ id, nome: nome(id), media: media(xs), n: xs.length })).sort((a, b) => a.media - b.media)
  }
  const fechamento = porV(vendas, (l) => (new Date(`${l.venda_data}T12:00:00`) - new Date(l.criado_em)) / DIA)
  const primeiroContato = porV(novos, (l) => (l.primeiro_contato_em ? (new Date(l.primeiro_contato_em) - new Date(l.criado_em)) / 3600000 : null))
  const semContato = novos.filter((l) => !l.primeiro_contato_em).length

  // "Não responde" agora: quantidade e tempo parado
  const colNaoResponde = colunas.find((c) => c.id === 'nao_responde') || colunas.find((c) => /n[aã]o responde/i.test(c.nome))
  const parados = base.filter((l) => colNaoResponde && l.coluna_id === colNaoResponde.id)
  const naoResponde = {
    total: parados.length,
    mediaDias: media(parados.map((l) => (agora - new Date(l.movido_em)) / DIA)),
    porVendedor: porV(parados, (l) => (agora - new Date(l.movido_em)) / DIA).map((x) => ({ ...x, quantidade: x.n })),
  }

  // lembretes atrasados agora, por vendedor
  const atrasados = new Map()
  lembretes.filter((l) => ids.has(l.lead_id) && !l.concluido_em && new Date(l.quando) < agora)
    .forEach((l) => atrasados.set(l.vendedor_id, (atrasados.get(l.vendedor_id) || 0) + 1))
  const lembretesAtrasados = [...atrasados].map(([id, n]) => ({ id, nome: nome(id), n })).sort((a, b) => b.n - a.n)

  return { resumo, porVendedor, porOrigem, porCanal, porCaptador, meses, funil, motivosPerda, fechamento, primeiroContato, semContato, naoResponde, lembretesAtrasados, vendas, novos }
}

export const pct = (x) => (x == null ? '—' : `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
export const numero = (x, casas = 1) => (x == null ? '—' : x.toLocaleString('pt-BR', { maximumFractionDigits: casas }))
export const rotuloMes = (m) => {
  const [a, n] = m.split('-')
  return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(n) - 1]}/${a.slice(2)}`
}
