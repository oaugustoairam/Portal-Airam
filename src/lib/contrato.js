// Contrato de compra e venda da Airam, gerado pelo próprio portal no mesmo modelo do contrato da loja.
// Os dados ficam em comercial.contrato (só a gestão vê); o PDF sai em src/components/relatorio/PdfContrato.jsx.

export const TIPOS_PROJETO = ['Projeto Principal', 'Projeto Complementar']
export const FORNECEDORES = ['AIRAM']
export const LINHAS = [
  'Adega', 'Área de Serviço', 'Banheiros', 'Biblioteca', 'Clínicas', 'Closet', 'Cozinhas', 'Dormitório Casal',
  'Dormitório Corporativo', 'Dormitório Solteiro', 'Escritório Corporativo', 'Home Office', 'Home Theater', 'Sala de Jantar', 'Varanda',
]
export const FORMAS_PAGAMENTO = ['Boleto', 'PIX', 'Cartão de crédito', 'Cheque', 'Dinheiro', 'Financiamento', 'Transferência']
export const SEXOS = [['F', 'Feminino'], ['M', 'Masculino']]
export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

export const AMBIENTE_VAZIO = {
  tipo: 'Projeto Principal', fornecedor: 'AIRAM', linha: '', descricao: '', corpo: '', porta: '', complemento: '',
  puxador: '', modelo: 'CONFORME PROJETO', observacoes: '', qtd: 1, prazo: 45, valor: '',
}
const ENDERECO_VAZIO = { cep: '', uf: '', cidade: '', endereco: '', numero: '', complemento: '', bairro: '' }

// Contrato novo a partir do que a gestão já sabe do cliente
export function contratoInicial(g, perfil) {
  const c = g?.comercial || {}
  return {
    numero: g?.numero_contrato || '',
    data: new Date().toISOString().slice(0, 10),
    responsavel: c.vendedor_nome || perfil?.nome || '',
    loja: c.loja === 'mooca' ? 'Mooca' : 'Guarulhos',
    tipo: g?.tipo_prazo === 'futuro' ? 'Futura' : 'Normal',
    substitui: '',
    cliente: {
      nome: g?.cliente_nome || '', cpf: g?.cliente_cpf || '', rg: '', sexo: '', nascimento: g?.cliente_nascimento || '',
      mae: '', profissao: '', telefone1: g?.cliente_telefone || '', telefone2: '', email: g?.cliente_email || '',
      endereco: { ...ENDERECO_VAZIO, cep: g?.cep || '', cidade: g?.cidade || '', bairro: g?.bairro || '', endereco: g?.endereco || '' },
    },
    entregaIgual: true,
    entrega: { ...ENDERECO_VAZIO, edificio: '', referencia: '' },
    ambientes: [],
    pagamento: {
      condicao: c.forma_pagamento || '', forma: 'Boleto', primeiroVencimento: c.vencimento_primeira || '',
      entrada: c.valor_entrada || '', parcelas: [],
    },
    observacao: '',
  }
}

// AA, AB, AC… como no contrato da loja
export const letra = (i) => 'A' + String.fromCharCode(65 + (i % 26))
export const descricaoAmbiente = (a, i) => `${letra(i)}-${String(a.descricao || a.linha || '').toUpperCase()}`

export const num = (v) => {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return v
  const t = String(v).trim()
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : 0
}
export const valorBR = (v) => num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '')

export const totalContrato = (k) => k.ambientes.reduce((t, a) => t + num(a.valor) * (num(a.qtd) || 1), 0)

function somarMeses(iso, n) {
  const [a, m, d] = iso.split('-').map(Number)
  const ultimo = new Date(a, m - 1 + n + 1, 0).getDate()
  const x = new Date(a, m - 1 + n, Math.min(d, ultimo))
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

// Parcelas a partir da condição ("15 s/ entrada", "1 + 10", "10x", "À vista"), mês a mês a partir do 1º vencimento.
// Os centavos que sobram vão para a última parcela.
export function gerarParcelas(total, condicao, primeiroVencimento, entrada) {
  const t = String(condicao || '').toLowerCase()
  let n = Number(t.match(/\d+/g)?.slice(-1)[0] || 1)
  const comEntrada = /\+/.test(t)
  if (/vista/.test(t)) n = 1
  const inicio = primeiroVencimento || new Date().toISOString().slice(0, 10)
  const lista = []
  let resto = total
  if (comEntrada) {
    const e = num(entrada) || Math.round((total / (n + 1)) * 100) / 100
    lista.push({ venc: new Date().toISOString().slice(0, 10), valor: e })
    resto = total - e
  }
  const base = Math.floor((resto / n) * 100) / 100
  for (let i = 0; i < n; i++) {
    const valor = i === n - 1 ? Math.round((resto - base * (n - 1)) * 100) / 100 : base
    lista.push({ venc: somarMeses(inicio, i), valor })
  }
  return lista
}

export const condicaoTexto = (condicao) => String(condicao || '').toUpperCase().replace(/\s*S\/\s*ENTRADA/, ' S/ENTRADA')

export const enderecoLinha = (e) => [e.endereco, e.numero].filter(Boolean).join(', ') + (e.complemento ? ` - ${e.complemento}` : '')

// O que falta para o contrato poder ser criado
export function faltaNoContrato(k) {
  const f = []
  const c = k.cliente
  if (!k.numero) f.push('Número do contrato')
  if (!c.nome) f.push('Nome do cliente')
  if (!c.cpf) f.push('CPF/CNPJ')
  if (!c.endereco.endereco || !c.endereco.cidade) f.push('Endereço do cliente')
  if (!k.entregaIgual && (!k.entrega.endereco || !k.entrega.cidade)) f.push('Endereço de entrega')
  if (!k.ambientes.length) f.push('Pelo menos um ambiente')
  k.ambientes.forEach((a, i) => {
    if (!a.linha) f.push(`Ambiente ${i + 1}: linha de produção`)
    if (!num(a.valor)) f.push(`Ambiente ${i + 1}: valor`)
  })
  if (!k.pagamento.condicao) f.push('Condição de pagamento')
  if (!k.pagamento.parcelas.length) f.push('Parcelas')
  else {
    const soma = k.pagamento.parcelas.reduce((t, p) => t + num(p.valor), 0)
    if (Math.abs(soma - totalContrato(k)) > 0.05) f.push(`As parcelas somam ${valorBR(soma)}, mas o total é ${valorBR(totalContrato(k))}`)
  }
  return f
}
