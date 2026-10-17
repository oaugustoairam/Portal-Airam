// Gestão de clientes: financeiras, captações, documentos da pasta, resumo e ranking das vendas.
// Informações internas da loja: o cliente não vê nada disto.

const semEntrada = (ate) => Array.from({ length: ate }, (_, i) => `${i + 1} s/ entrada`)
const comEntrada = (ate) => Array.from({ length: ate }, (_, i) => `1 + ${i + 1}`)

// Financeiras e formas de pagamento aceitas pela Airam
export const FINANCEIRAS = [
  { id: 'avista', nome: 'À vista', planilha: 'Avista', formas: ['À vista', ...semEntrada(3), ...comEntrada(3)] },
  { id: 'dubai', nome: 'Dubai', planilha: 'Dubai', formas: [...semEntrada(21), ...comEntrada(21)] },
  { id: 'airam', nome: 'Airam / Especiais', planilha: 'Airam Especial', formas: [...semEntrada(36), ...comEntrada(42)] },
  { id: 'santander', nome: 'Santander', planilha: 'Santander', formas: [...semEntrada(24), ...comEntrada(24)] },
  { id: 'financeira_santander', nome: 'Financeira Santander', planilha: 'Financeira Santander', formas: [...semEntrada(24), ...comEntrada(24)] },
  { id: 'cartao', nome: 'Cartão de crédito', planilha: 'Cartão de credito', formas: Array.from({ length: 12 }, (_, i) => `${i + 1}x`) },
  { id: 'casa', nome: 'Casa', planilha: 'Casa', formas: [...semEntrada(24), ...comEntrada(24)] },
  { id: 'flex', nome: 'Flex / Intermediária', planilha: 'Flex / Intermediária', formas: [...semEntrada(24), ...comEntrada(24)] },
  { id: 'losango', nome: 'Losango', planilha: 'Losango', formas: [...semEntrada(24), ...comEntrada(24)] },
]
// nome usado na planilha de gestão -> id
export function financeiraPorNome(t) {
  const n = String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (!n) return null
  if (n.includes('vista')) return 'avista'
  if (n.includes('financeira') && n.includes('santander')) return 'financeira_santander'
  if (n.includes('santander')) return 'santander'
  if (n.includes('airam') || n.includes('especia')) return 'airam'
  if (n.includes('cart')) return 'cartao'
  for (const id of ['dubai', 'casa', 'flex', 'losango']) if (n.includes(id)) return id
  return null
}
export const financeira = (id) => FINANCEIRAS.find((f) => f.id === id)

export const MEIOS = [
  ['dinheiro', 'Dinheiro'], ['pix', 'PIX'], ['boletos', 'Boletos'], ['boletos_casa', 'Boletos Casa'], ['cartao', 'Cartão de crédito'], ['cheques', 'Cheques'],
]
// fontes de captação (iguais à planilha de gestão)
export const CAPTACOES = [
  'AMIGOS PESSOAIS', 'ARQUITETURA', 'CARLOS EDUARDO', 'CLIENTE LOJA', 'CORRETORES', 'INDICAÇÕES', 'LINK DA BIO',
  'METROCASA', 'PARCERIAS', 'PORTA DE LOJA', 'RUBIA', 'TELEFONE DE LOJA',
]
export const LIBERADORES = ['Madalena', 'Leandro']
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

export const moeda = (v) =>
  v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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
