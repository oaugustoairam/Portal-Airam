// Regras do processo Airam: categorias de anexos, prazo Normal/Futuro e linha do tempo.

export const CATEGORIAS = [
  { id: 'contrato', nome: 'Contrato assinado' },
  { id: 'medicao', nome: 'Medição', interno: true },
  { id: 'projeto_inicial', nome: 'Projeto inicial' },
  { id: 'render', nome: 'Renders' },
  { id: 'projeto_final', nome: 'Projeto final' },
  { id: 'outro', nome: 'Outros' },
]

export const ROTULO_PRAZO = 'Prazo máximo para entrega'
export const CATEGORIAS_CLIENTE = CATEGORIAS.filter((c) => !c.interno)

export const LIMITE_PRAZO_NORMAL = 90 // dias entre a venda e a disponibilidade para medição

// Tipo do contrato (uso interno: o cliente não vê essa classificação)
export const TIPOS_PRAZO = {
  normal: { nome: 'Prazo normal', desc: 'Imóvel pronto para os móveis em até 90 dias' },
  futuro: { nome: 'Entrega futura', desc: 'Imóvel pronto para os móveis acima de 90 dias' },
}

// Prazos do contrato Airam (em dias úteis)
export const PRAZOS_CONTRATO = {
  aprovacaoFinanceira: 5, // aprovação de crédito
  medicaoEProjetoFinal: 10, // medição + assinatura do projeto final executivo
  entrega: 45, // a partir do 2º dia útil após a assinatura do projeto final
  inicioMontagem: 7, // após a entrega
  conclusaoMontagem: 10,
}

// Feriados nacionais (fixos + Sexta-feira Santa). Feriados municipais não entram.
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}
const FIXOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25']
function ehFeriado(d) {
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (FIXOS.includes(md)) return true
  const sexta = pascoa(d.getFullYear())
  sexta.setDate(sexta.getDate() - 2)
  return d.getMonth() === sexta.getMonth() && d.getDate() === sexta.getDate()
}
const paraISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Soma dias úteis (seg a sex, sem feriados nacionais) a uma data AAAA-MM-DD
export function somarDiasUteis(dataISO, dias) {
  if (!dataISO) return null
  const d = new Date(dataISO.slice(0, 10) + 'T00:00:00')
  let n = 0
  while (n < dias) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6 && !ehFeriado(d)) n++
  }
  return paraISO(d)
}

// Datas sugeridas pelo contrato, a partir do que já aconteceu no processo
export function prazosContratuais(p, assinaturaProjeto) {
  const inicio = p.tipo_prazo === 'futuro' ? p.data_disponivel_medicao : p.financeiro_ok_em?.slice(0, 10)
  const assinado = assinaturaProjeto?.slice(0, 10) || (p.projeto_assinado_manual ? p.projeto_assinado_em?.slice(0, 10) : null)
  const baseEntrega = assinado || p.data_assinatura_projeto
  return {
    assinaturaProjeto: inicio ? somarDiasUteis(inicio, PRAZOS_CONTRATO.medicaoEProjetoFinal) : null,
    baseAssinatura: inicio ? (p.tipo_prazo === 'futuro' ? 'imóvel pronto' : 'solução financeira') : null,
    // contagem começa no 2º dia útil após a assinatura: 1 dia útil de carência + 45
    entrega: baseEntrega ? somarDiasUteis(baseEntrega, PRAZOS_CONTRATO.entrega + 1) : null,
    entregaReal: !!assinado,
  }
}

export function hojeISO() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export function diasEntre(de, ate) {
  if (!de || !ate) return null
  return Math.round((new Date(ate + 'T00:00:00') - new Date(de + 'T00:00:00')) / 86400000)
}

export function diasAte(data) {
  return diasEntre(hojeISO(), data)
}

// Mesma regra calculada no banco (coluna tipo_prazo)
export function calcularTipoPrazo(dataVenda, dataDisponivel) {
  const d = diasEntre(dataVenda, dataDisponivel)
  if (d === null) return null
  return d <= LIMITE_PRAZO_NORMAL ? 'normal' : 'futuro'
}

export function formatarData(data) {
  if (!data) return 'A definir'
  return new Date(data.slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function prazoTexto(data) {
  const d = diasAte(data)
  if (d === null) return 'Sem data'
  if (d === 0) return 'É hoje'
  if (d > 0) return d === 1 ? 'Falta 1 dia' : `Faltam ${d} dias`
  return d === -1 ? '1 dia de atraso' : `${-d} dias de atraso`
}

export function formatarCpf(v) {
  const n = String(v || '').replace(/\D/g, '').slice(0, 11)
  return n
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function cpfValido(v) {
  const n = String(v || '').replace(/\D/g, '')
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false
  const dig = (len) => {
    let s = 0
    for (let i = 0; i < len; i++) s += Number(n[i]) * (len + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dig(9) === Number(n[9]) && dig(10) === Number(n[10])
}

// Linha do tempo do processo, calculada a partir das datas e marcações da equipe.
// O contrato já chega assinado (na loja) e fica só nos anexos; a jornada começa na solução financeira.
// Cada etapa: { id, nome, data, status: 'concluida' | 'atual' | 'futura', atrasada, detalhe }
export function linhaDoTempo(p, assinaturas = []) {
  const projeto = assinaturas.find((a) => a.tipo === 'projeto_final' && a.status === 'assinado')
  const projetoPendente = assinaturas.some((a) => a.tipo === 'projeto_final' && a.status === 'pendente')

  const etapas = [
    {
      id: 'financeiro',
      nome: 'Solução financeira',
      data: p.financeiro_ok_em?.slice(0, 10) || null,
      semData: true,
      feito: p.solucao_financeira === 'ok',
      detalhe: p.solucao_financeira === 'ok' ? 'Aprovada' : 'Em andamento',
    },
    {
      id: 'projeto_inicial',
      nome: 'Projeto inicial',
      data: p.projeto_inicial_em?.slice(0, 10) || p.data_projeto_inicial,
      feito: !!p.projeto_inicial_enviado,
      detalhe: p.projeto_inicial_enviado ? 'Disponível em Documentos' : null,
    },
    { id: 'medicao', nome: 'Medição', data: p.data_medicao, feito: p.medicao_concluida },
    { id: 'conferencia', nome: 'Projeto final · Conferência', data: p.data_conferencia, feito: p.conferencia_concluida },
    {
      id: 'assinatura_projeto',
      nome: 'Projeto final · Assinatura',
      data: projeto?.assinado_em?.slice(0, 10) || p.data_assinatura_projeto,
      feito: !!projeto || p.projeto_assinado_manual,
      detalhe: !projeto && projetoPendente ? 'PDF pronto para você assinar' : null,
    },
    { id: 'producao', nome: 'Fabricação', data: null, feito: p.entrega_concluida, producao: true },
    { id: 'entrega', nome: 'Montagem', data: p.data_entrega_prevista, feito: p.entrega_concluida },
  ]

  let atualDefinida = false
  return etapas.map((e) => {
    let status = 'futura'
    if (e.feito) status = 'concluida'
    else if (!atualDefinida) {
      status = 'atual'
      atualDefinida = true
    }
    // a fabricação começa depois do projeto final assinado
    if (e.producao && status === 'futura' && etapas[4].feito) status = 'atual'
    const d = diasAte(e.data)
    return { ...e, status, atrasada: !e.feito && !e.producao && d !== null && d < 0 }
  })
}

export function etapaAtual(etapas) {
  return etapas.find((e) => e.status === 'atual') || etapas[etapas.length - 1]
}

export function progresso(etapas) {
  const feitas = etapas.filter((e) => e.status === 'concluida').length
  return Math.round((feitas / etapas.length) * 100)
}
