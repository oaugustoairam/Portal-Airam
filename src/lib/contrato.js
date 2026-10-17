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
  tipo: 'Projeto Principal', fornecedor: 'AIRAM', linha: '', nome: '', corpo: '', porta: '', complemento: '',
  puxador: '', modelo: 'CONFORME PROJETO', observacoes: '', qtd: 1, prazo: 45, valor_bruto: '', valor: '',
}
export const PAGAMENTO_VAZIO = { condicao: '', forma: 'Boleto', primeiroVencimento: '', entrada: '', parcelas: [] }

// Monta os dados do PDF a partir do que está salvo (contrato, cliente, ambientes e comercial)
export function montarContratoPdf({ g, cliente, ambientes, lojaNome }) {
  const k0 = g.comercial?.contrato || {}
  const c = cliente || {}
  return {
    numero: g.codigo,
    codigo: '',
    data: k0.data || g.data_venda,
    responsavel: g.comercial?.vendedor_nome || '',
    loja: lojaNome || '',
    tipo: g.tipo_prazo === 'futuro' ? 'Futura' : 'Normal',
    substitui: k0.substitui || '',
    substituiData: k0.substituiData || '',
    cliente: {
      nome: c.nome || g.cliente_nome || '', cpf: formatarDocumento(c.cpf || g.cliente_cpf || ''), rg: c.rg || '', sexo: c.sexo || '',
      nascimento: c.nascimento || g.cliente_nascimento || '', mae: c.mae || '', profissao: c.profissao || '',
      telefone1: c.telefone || g.cliente_telefone || '', telefone2: c.telefone2 || '', email: c.email || g.cliente_email || '',
      endereco: { endereco: c.logradouro || '', numero: c.numero || '', complemento: c.complemento || '', bairro: c.bairro || '', cidade: c.cidade || '', uf: c.uf || '', cep: c.cep || '' },
    },
    entregaIgual: k0.entregaIgual !== false,
    entrega: { endereco: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '', edificio: '', referencia: '', ...(k0.entrega || {}) },
    ambientes: (ambientes || []).map((a) => ({ ...a, descricao: a.nome, valor: a.valor ?? a.valor_bruto })),
    pagamento: { ...PAGAMENTO_VAZIO, ...(k0.pagamento || {}) },
    observacao: k0.observacao || '',
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

// CPF 000.000.000-00 ou CNPJ 00.000.000/0000-00
export function formatarDocumento(v) {
  const n = String(v || '').replace(/\D/g, '')
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return n
}
