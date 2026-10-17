// Gestão de clientes: cada cliente é um só cadastro (processo do portal + dados comerciais + controle interno).
// As abas seguem a planilha 001 GESTÃO DE CLIENTES: base, futuros, conferências, entrega e montagem,
// assistência técnica e montados.
import { montarRelatorio } from './relatorio.js'
import { financeira, moeda, SITUACOES, CAPTACOES, FINANCEIRAS, DOCS_PASTA } from './vendas.js'
import { hojeISO } from './constants.js'

const dia = (iso) => (iso ? String(iso).slice(0, 10) : null)
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

// Zona / região pelos 2 primeiros dígitos do CEP (aba AUX da planilha)
const ZONAS = {
  '01': 'SP - Centro', '02': 'Zona Norte', '03': 'Zona Leste', '04': 'Zona Sul', '05': 'Zona Oeste',
  '06': 'Grande SP - Oeste', '07': 'Guarulhos e Região', '08': 'Extremo Leste / Alto Tietê', '09': 'ABC',
  '11': 'Baixada Santista', '12': 'Vale do Paraíba', '13': 'Campinas',
}
export function zonaDoCep(cep) {
  const n = String(cep || '').replace(/\D/g, '')
  if (n.length < 2) return null
  const p = n.slice(0, 2)
  return ZONAS[p] || (Number(p) >= 14 && Number(p) <= 19 ? 'Interior' : 'Outra região')
}

export const STATUS = {
  cancelado: 'CANCELADO',
  montado: 'MONTADO',
  assinado: 'ASSINADO - aguarda montagem',
  conferido: 'CONFERIDO - aguarda assinatura',
  medido: 'MEDIDO - aguarda conferência',
  aguarda: 'AGUARDA MEDIÇÃO',
}
export const STATUS_ENTREGA = { aguardando: 'Aguardando entrega', montando: 'Montando', montado: 'Montado' }
export const POS_VISTORIA = [['aguardando', 'Aguardando'], ['em_andamento', 'Em andamento'], ['concluido', 'Concluído']]

// Uma linha da planilha a partir do cadastro único
export function linhaGestao(g) {
  const c = g.comercial || {}
  const ci = g.controle || {}
  const r = montarRelatorio(g, ci)
  const montado = !!g.entrega_concluida
  const medido = !!(r.real.medicao || g.medicao_concluida)
  const conferido = !!(r.real.conferido || g.conferencia_concluida)
  const assinado = !!(r.real.assinado || g.projeto_assinado_manual)
  const entregue = !!(ci.entregue || r.real.entregue)
  const cancelado = c.situacao === 'cancelado'
  const status = cancelado ? 'cancelado' : montado ? 'montado' : assinado ? 'assinado' : conferido ? 'conferido' : medido ? 'medido' : 'aguarda'
  const valor = num(c.valor_venda)
  const defl = num(c.valor_deflacionado)
  const hoje = hojeISO()
  const prazoMax = dia(g.data_entrega_prevista)
  return {
    id: g.id,
    g,
    codigo: g.codigo,
    cliente_nome: g.cliente_nome,
    vendedor: c.vendedor_nome || null,
    captacao: c.captacao || null,
    data_venda: dia(g.data_venda),
    contrato: g.numero_contrato || null,
    prazo: g.tipo_prazo === 'futuro' ? 'Futura' : 'Normal',
    financeira: c.financeira || null,
    forma_pagamento: c.forma_pagamento || null,
    valor_venda: valor,
    valor_deflacionado: defl,
    diferenca: valor !== null && defl !== null ? valor - defl : null,
    deflacao: valor && defl !== null ? (valor - defl) / valor : null,
    situacao: c.situacao || 'pendente',
    observacao: c.observacao || null,
    loja: c.loja || null,
    cidade: g.cidade || null,
    bairro: g.bairro || null,
    cep: g.cep || null,
    zona: zonaDoCep(g.cep),
    cliente_meu: c.cliente_meu === false ? 'Não' : c.cliente_meu ? 'Sim' : null,
    status,
    montado, medido, conferido, assinado, entregue, cancelado,
    data_medicao: r.real.medicao,
    data_conferencia: r.real.conferido,
    data_assinatura: r.real.assinado,
    liberador: ci.liberador || null,
    previsao_entrega: dia(ci.previsao_entrega),
    prazo_maximo: prazoMax,
    prazo_vencido: !!prazoMax && !montado && prazoMax < hoje,
    status_entrega: montado ? 'montado' : r.real.montagem ? 'montando' : 'aguardando',
    data_entrega: r.real.entregue,
    montagem_inicio: r.real.montagem,
    montador: ci.montador || null,
    assistencia: ci.tem_att ? 'Sim' : ci.tem_att === false ? 'Não' : null,
    assistencia_aberta: !!ci.tem_att && !ci.assistencia_concluida_em,
    data_vistoria: dia(ci.vistoria_em),
    vistoria_obs: ci.vistoria_obs || null,
    prazo_pos_vistoria: dia(ci.assistencia_retorno_max),
    pos_vistoria: ci.pos_vistoria || null,
    acesso: g.cliente_email ? 'Com e-mail' : 'Sem e-mail',
    pasta: (g.pasta || []).length,
    pasta_fechada: !!c.pasta_fechada_em,
  }
}

const OP = (pares) => pares.map(([v, t]) => ({ v, t }))
const OP_FIN = OP(FINANCEIRAS.map((f) => [f.id, f.nome]))
const OP_SIM = OP([['Sim', 'Sim'], ['Não', 'Não']])

// Colunas possíveis. tipo: texto | opcao | moeda | numero | data | pct
export const COLUNAS = {
  codigo: { t: 'Código', tipo: 'texto', fixa: true },
  cliente_nome: { t: 'Cliente', tipo: 'texto', fixa: true, larga: true },
  vendedor: { t: 'Vendedor', tipo: 'opcao' },
  captacao: { t: 'Captação', tipo: 'opcao', opcoes: OP(CAPTACOES.map((c) => [c, c])) },
  data_venda: { t: 'Data da venda', tipo: 'data' },
  contrato: { t: 'Nº contrato', tipo: 'texto' },
  prazo: { t: 'Prazo', tipo: 'opcao', opcoes: OP([['Normal', 'Normal'], ['Futura', 'Futura']]) },
  financeira: { t: 'Financeira', tipo: 'opcao', opcoes: OP_FIN, fmt: (v) => financeira(v)?.nome },
  valor_venda: { t: 'Valor', tipo: 'moeda', soma: true },
  valor_deflacionado: { t: 'Deflacionado', tipo: 'moeda', soma: true },
  diferenca: { t: 'Diferença', tipo: 'moeda', soma: true },
  deflacao: { t: '% deflação', tipo: 'pct' },
  situacao: { t: 'Situação', tipo: 'opcao', opcoes: OP(SITUACOES) },
  status: { t: 'Status do cliente', tipo: 'opcao', opcoes: OP(Object.entries(STATUS)), fmt: (v) => STATUS[v] },
  observacao: { t: 'Observação', tipo: 'texto', larga: true },
  cidade: { t: 'Cidade', tipo: 'opcao' },
  bairro: { t: 'Bairro', tipo: 'texto' },
  cep: { t: 'CEP', tipo: 'texto' },
  zona: { t: 'Zona / região', tipo: 'opcao' },
  cliente_meu: { t: 'Cliente meu?', tipo: 'opcao', opcoes: OP_SIM },
  data_medicao: { t: 'Medição', tipo: 'data' },
  data_conferencia: { t: 'Conferência', tipo: 'data' },
  data_assinatura: { t: 'Assinatura', tipo: 'data' },
  liberador: { t: 'Liberador', tipo: 'opcao' },
  previsao_entrega: { t: 'Previsão de entrega', tipo: 'data' },
  prazo_maximo: { t: 'Prazo máximo', tipo: 'data' },
  status_entrega: { t: 'Status da entrega', tipo: 'opcao', opcoes: OP(Object.entries(STATUS_ENTREGA)), fmt: (v) => STATUS_ENTREGA[v] },
  data_entrega: { t: 'Data da entrega', tipo: 'data' },
  montagem_inicio: { t: 'Início da montagem', tipo: 'data' },
  montador: { t: 'Montador', tipo: 'opcao' },
  assistencia: { t: 'Assistência?', tipo: 'opcao', opcoes: OP_SIM },
  data_vistoria: { t: 'Vistoria', tipo: 'data' },
  vistoria_obs: { t: 'Obs. vistoria', tipo: 'texto', larga: true },
  prazo_pos_vistoria: { t: 'Prazo pós vistoria', tipo: 'data' },
  pos_vistoria: { t: 'Pós vistoria', tipo: 'opcao', opcoes: OP(POS_VISTORIA), fmt: (v) => POS_VISTORIA.find(([k]) => k === v)?.[1] },
  acesso: { t: 'Portal', tipo: 'opcao', opcoes: OP([['Com e-mail', 'Com e-mail'], ['Sem e-mail', 'Sem e-mail']]) },
}

const soma = (l, k) => l.reduce((t, x) => t + (x[k] || 0), 0)
const ticket = (l) => (l.length ? soma(l, 'valor_deflacionado') / l.length : 0)
const kpiValores = (l, rotuloQtd) => [
  [rotuloQtd, l.length],
  ['Valor à vista', moeda(soma(l, 'valor_venda'))],
  ['Deflacionado', moeda(soma(l, 'valor_deflacionado'))],
  ['Diferença', moeda(soma(l, 'diferenca'))],
  ['Ticket médio', moeda(ticket(l))],
]

// Base de clientes: todos os clientes em lista (o status filtra futuros, conferências, montados etc.)
export const ABAS_GESTAO = [
  {
    id: 'clientes', nome: 'Clientes', titulo: 'Base de clientes',
    descricao: 'Todos os clientes. Cadastre aqui: o mesmo cadastro vira o acesso do cliente ao portal.',
    filtro: () => true,
    colunas: ['codigo', 'cliente_nome', 'vendedor', 'captacao', 'data_venda', 'financeira', 'valor_venda', 'valor_deflacionado', 'situacao', 'status', 'observacao',
      'contrato', 'prazo', 'diferenca', 'deflacao', 'cidade', 'bairro', 'cep', 'zona', 'cliente_meu', 'acesso',
      'data_medicao', 'liberador', 'data_conferencia', 'data_assinatura', 'previsao_entrega', 'prazo_maximo', 'status_entrega',
      'data_entrega', 'montador', 'assistencia', 'data_vistoria', 'pos_vistoria'],
    visiveis: 11,
    kpis: (l) => kpiValores(l, 'Clientes'),
  },
]

// ---------------- filtros por coluna
export const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function filtroAtivo(f) {
  if (!f) return false
  if (f.texto) return true
  if (f.opcoes?.length) return true
  return f.min !== undefined && f.min !== '' ? true : f.max !== undefined && f.max !== ''
}

export function passaFiltro(valor, col, f) {
  if (!filtroAtivo(f)) return true
  if (col.tipo === 'texto') return semAcento(valor).includes(semAcento(f.texto))
  if (col.tipo === 'opcao') return f.opcoes.includes(valor ?? '')
  const tem = (x) => x !== undefined && x !== ''
  if (valor === null || valor === undefined) return false
  if (col.tipo === 'data') return (!tem(f.min) || valor >= f.min) && (!tem(f.max) || valor <= f.max)
  const v = col.tipo === 'pct' ? valor * 100 : valor
  return (!tem(f.min) || v >= Number(f.min)) && (!tem(f.max) || v <= Number(f.max))
}

export function textoCelula(valor, col) {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (col.fmt) return col.fmt(valor) || '—'
  if (col.tipo === 'moeda') return moeda(valor)
  if (col.tipo === 'pct') return `${(valor * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  if (col.tipo === 'data') return valor.split('-').reverse().join('/')
  return String(valor)
}

// opções de uma coluna "opcao": as fixas ou as que aparecem nos dados
export function opcoesDaColuna(k, col, linhas) {
  const usadas = new Set(linhas.map((l) => l[k] ?? ''))
  const base = col.opcoes || [...usadas].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')).map((v) => ({ v, t: v }))
  const lista = col.opcoes ? base.filter((o) => usadas.has(o.v)) : base
  return usadas.has('') ? [...lista, { v: '', t: '(vazio)' }] : lista
}

export function ordenar(linhas, ordem) {
  if (!ordem) return linhas
  const { k, dir } = ordem
  return [...linhas].sort((a, b) => {
    const x = a[k]
    const y = b[k]
    if (x === y) return 0
    if (x === null || x === undefined || x === '') return 1
    if (y === null || y === undefined || y === '') return -1
    const r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', { numeric: true })
    return dir === 'desc' ? -r : r
  })
}

// ---------------- formato "venda" usado pela capa do envelope, planilha de feedback e PDF da pasta
export function paraVenda(g) {
  const c = g.comercial || {}
  const ci = g.controle || {}
  const r = montarRelatorio(g, ci)
  return {
    ...c,
    id: g.id,
    codigo: g.codigo,
    cliente_nome: g.cliente_nome,
    vendedor: c.vendedor_nome,
    data_venda: dia(g.data_venda),
    meios: c.meios || [],
    situacao: c.situacao || 'pendente',
    prazo_tipo: g.tipo_prazo === 'futuro' ? 'futura' : '45_dias',
    previsao_imovel: g.tipo_prazo === 'futuro' ? dia(g.data_disponivel_medicao) : null,
    envio_email: dia(c.envio_email || ci.email_enviado_em),
    assinatura_inicial: dia(c.assinatura_inicial || ci.inicial_assinado_em),
    assinatura_projeto_final: r.real.assinado,
    prazo_limite_entrega: dia(g.data_entrega_prevista),
    medicao_realizada: r.real.medicao,
    limite_projeto_final: dia(g.data_assinatura_projeto),
    pasta_fechada_em: c.pasta_fechada_em,
  }
}

// O que ainda falta para a venda ficar completa (dados e pasta)
export function oQueFalta(g, docs = g.pasta) {
  const c = g.comercial || {}
  const falta = []
  if (!c.vendedor_nome) falta.push('Vendedor')
  if (!c.financeira) falta.push('Financeira')
  else if (!c.forma_pagamento) falta.push('Forma de pagamento')
  if (!c.valor_venda) falta.push('Valor da venda')
  if (!c.valor_deflacionado) falta.push('Deflacionado')
  if (!c.loja) falta.push('Loja')
  if (!g.cliente_email) falta.push('E-mail do cliente (acesso ao portal)')
  if (docs) {
    for (const d of DOCS_PASTA) {
      if (d.id === 'comprovante_pix' && !(c.meios || []).includes('pix')) continue
      if (d.id === 'financeira_aprovada' && c.financeira === 'avista') continue
      if (!docs.some((x) => x.categoria === d.id)) falta.push(d.nome)
    }
  }
  return falta
}

// Próximo código livre, no formato da planilha (CLI-0001)
export function proximoCodigo(lista) {
  const nums = lista.map((g) => String(g.codigo || '').match(/^CLI-(\d+)$/i)?.[1]).filter(Boolean).map(Number)
  return `CLI-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`
}

// ---------------- importação da planilha 001 GESTÃO DE CLIENTES (aba 01 CLIENTES, cabeçalho na linha 5)
const sim = (v) => /^s/i.test(String(v || '').trim())
const txt = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim())
export function registrosDaPlanilha(linhas, { dataDoExcel, financeiraPorNome, somarDias }) {
  const cab = linhas['5'] || {}
  if (!/C[OÓ]DIGO/i.test(cab.A || '') || !/NOME/i.test(cab.B || '')) throw new Error('Não achei o cabeçalho da aba 01 CLIENTES (linha 5: CÓDIGO, NOME…).')
  const out = []
  for (const [n, l] of Object.entries(linhas)) {
    if (Number(n) < 6 || !txt(l.B)) continue
    const venda = dataDoExcel(l.D)
    if (!venda) continue
    const futura = /fut/i.test(l.F || '')
    const previsao = dataDoExcel(l.AA)
    const montado = sim(l.Q) || /montado/i.test(l.X || '')
    const assinado = sim(l.V) || !!dataDoExcel(l.W)
    const status = String(l.AC || '')
    out.push({
      processo: {
        codigo: txt(l.A) || txt(l.E), numero_contrato: txt(l.E), cliente_nome: txt(l.B), data_venda: venda,
        data_disponivel_medicao: futura ? (previsao && previsao > somarDias(venda, 90) ? previsao : somarDias(venda, 91)) : venda,
        data_entrega_prevista: dataDoExcel(l.AB), cidade: txt(l.L), bairro: txt(l.M), cep: txt(l.N),
        solucao_financeira: sim(l.R) || assinado || montado ? 'ok' : 'pendente',
        medicao_concluida: sim(l.R), conferencia_concluida: sim(l.T), projeto_assinado_manual: assinado && !dataDoExcel(l.W),
        entrega_concluida: montado,
      },
      comercial: {
        captacao: txt(l.C), financeira: financeiraPorNome(l.G), valor_venda: typeof l.H === 'number' ? l.H : null,
        valor_deflacionado: typeof l.I === 'number' ? l.I : null, observacao: txt(l.Y), cliente_meu: l.P === undefined ? null : sim(l.P),
        situacao: 'resolvido', meios: [],
      },
      controle: {
        medido_em: dataDoExcel(l.S), conferido_em: dataDoExcel(l.U), projeto_final_assinado_em: dataDoExcel(l.W), liberador: txt(l.Z),
        previsao_entrega: previsao, entregue: l.AD === undefined ? null : sim(l.AD), entregue_em: dataDoExcel(l.AE),
        montagem_inicio_em: dataDoExcel(l.AF) || (/montando/i.test(status) ? dataDoExcel(l.AE) : null), montador: txt(l.AG),
        tem_att: l.AH === undefined ? null : sim(l.AH), vistoria_em: dataDoExcel(l.AI), vistoria_obs: txt(l.AJ),
        assistencia_retorno_max: dataDoExcel(l.AK),
        pos_vistoria: /conclu/i.test(l.AL || '') ? 'concluido' : /andamento/i.test(l.AL || '') ? 'em_andamento' : /aguard/i.test(l.AL || '') ? 'aguardando' : null,
      },
    })
  }
  return out
}

// Períodos rápidos para o filtro de datas
export function periodoRapido(tipo) {
  const d = new Date()
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const a = d.getFullYear()
  const m = d.getMonth()
  if (tipo === 'mes') return { de: iso(new Date(a, m, 1)), ate: iso(new Date(a, m + 1, 0)) }
  if (tipo === 'passado') return { de: iso(new Date(a, m - 1, 1)), ate: iso(new Date(a, m, 0)) }
  if (tipo === '30') return { de: iso(new Date(a, m, d.getDate() - 29)), ate: iso(d) }
  if (tipo === 'ano') return { de: `${a}-01-01`, ate: `${a}-12-31` }
  return { de: '', ate: '' }
}
