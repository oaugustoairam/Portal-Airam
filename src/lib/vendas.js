// Gestão de clientes (vendedores): controle mensal das vendas, capa do envelope e controle de pastas.
// Informações internas da loja: o cliente não vê nada disto.

const semEntrada = (ate) => Array.from({ length: ate }, (_, i) => `${i + 1} s/ entrada`)
const comEntrada = (ate) => Array.from({ length: ate }, (_, i) => `1 + ${i + 1}`)

// Financeiras e formas de pagamento aceitas pela Airam
export const FINANCEIRAS = [
  { id: 'avista', nome: 'À vista', planilha: 'Avista', formas: ['À vista', ...semEntrada(3), ...comEntrada(3)] },
  { id: 'dubai', nome: 'Dubai', planilha: 'Dubai', formas: [...semEntrada(21), ...comEntrada(21)] },
  { id: 'airam', nome: 'Airam / Especiais', planilha: 'Airam Especial', formas: [...semEntrada(36), ...comEntrada(42)] },
  { id: 'santander', nome: 'Santander', planilha: 'Santander', formas: [...semEntrada(24), ...comEntrada(24)] },
  { id: 'cartao', nome: 'Cartão de crédito', planilha: 'Cartão de credito', formas: Array.from({ length: 12 }, (_, i) => `${i + 1}x`) },
]
export const financeira = (id) => FINANCEIRAS.find((f) => f.id === id)

export const MEIOS = [
  ['dinheiro', 'Dinheiro'], ['pix', 'PIX'], ['boletos', 'Boletos'], ['cartao', 'Cartão de crédito'], ['cheques', 'Cheques'],
]
export const CAPTACOES = ['Cliente loja', 'Rubia', 'Indicação', 'Amigos pessoais', 'Arquitetura', 'Porta de loja']
export const VENDEDORES = ['Augusto Moraes', 'Moises Alves', 'Agatha Moraes', 'Felipe Foiadell', 'Ramon Arias']
export const LOJAS_VENDA = [['guarulhos', 'Guarulhos'], ['mooca', 'Mooca']]
export const SITUACOES = [['pendente', 'Pendente'], ['resolvido', 'Resolvido'], ['cancelado', 'Cancelado']]

// Documentos da pasta do cliente (Controle de pastas)
export const DOCS_PASTA = [
  { id: 'comprovante_pix', nome: 'Comprovantes de PIX', varios: true },
  { id: 'financeira_aprovada', nome: 'Print da financeira aprovada' },
  { id: 'projeto_inicial', nome: 'Projeto inicial' },
  { id: 'contrato_assinado', nome: 'Contrato assinado' },
  { id: 'documento_foto', nome: 'Documento com foto' },
]

export const mesDe = (iso) => (iso ? String(iso).slice(0, 7) : null)
export function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export function somarMes(mes, n) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export function nomeMes(mes, curto = false) {
  const [a, m] = mes.split('-').map(Number)
  return curto ? `${MESES[m - 1].slice(0, 3).toUpperCase()} ${String(a).slice(2)}` : `${MESES[m - 1]} de ${a}`
}

export const moeda = (v) =>
  v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// O que ainda falta para a venda ficar completa (dados e pasta)
export function oQueFalta(v, docs = null) {
  const falta = []
  if (!v.financeira) falta.push('Financeira')
  else if (!v.forma_pagamento) falta.push('Forma de pagamento')
  if (!v.valor_venda) falta.push('Valor da venda')
  if (!v.valor_deflacionado) falta.push('Deflacionado')
  if (!v.loja) falta.push('Loja')
  if (!v.codigo) falta.push('Código')
  if (docs) {
    for (const d of DOCS_PASTA) {
      if (d.id === 'comprovante_pix' && !(v.meios || []).includes('pix')) continue
      if (d.id === 'financeira_aprovada' && v.financeira === 'avista') continue
      if (!docs.some((x) => x.categoria === d.id)) falta.push(d.nome)
    }
  }
  return falta
}

// Resumo do mês, como a aba "Resumo e Ranking" da planilha (valores pelo deflacionado)
export function resumoVendas(vendas) {
  const por = (sit) => vendas.filter((v) => v.situacao === sit)
  const soma = (l) => l.reduce((t, v) => t + Number(v.valor_deflacionado || 0), 0)
  const r = Object.fromEntries(SITUACOES.map(([k]) => [k, { qtd: por(k).length, valor: soma(por(k)) }]))
  const validas = vendas.filter((v) => v.situacao !== 'cancelado')
  return { ...r, total: { qtd: vendas.length, valor: soma(vendas) }, validas: { qtd: validas.length, valor: soma(validas), bruto: validas.reduce((t, v) => t + Number(v.valor_venda || 0), 0) } }
}

// Ranking por vendedor ou captação (sem cancelados), do maior para o menor
export function ranking(vendas, campo) {
  const m = new Map()
  for (const v of vendas) {
    if (v.situacao === 'cancelado') continue
    const k = v[campo] || 'Sem informação'
    const x = m.get(k) || { nome: k, qtd: 0, valor: 0 }
    x.qtd += 1
    x.valor += Number(v.valor_deflacionado || 0)
    m.set(k, x)
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor)
}

export const VENDA_VAZIA = {
  codigo: '', cliente_nome: '', vendedor: '', captacao: '', loja: '', data_venda: '', mes: '',
  financeira: '', forma_pagamento: '', valor_venda: '', valor_deflacionado: '', valor_entrada: '', valor_parcela: '',
  vencimento_primeira: '', meios: [], prazo_tipo: '45_dias', previsao_imovel: '', envio_email: '', assinatura_inicial: '',
  avaliacao_google: null, bruto_promob: '', pedido_fabrica: '', assinatura_projeto_final: '', prazo_limite_entrega: '',
  medicao_realizada: '', limite_projeto_final: '', observacao: '', situacao: 'pendente',
}
