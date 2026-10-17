// Leitura da listagem de peças de um XML exportado pelo Promob.
// Os XMLs variam conforme a versão e o tipo de exportação, então não supomos uma estrutura fixa:
// procuramos o elemento que se repete e que tem cara de peça (descrição + medidas ou quantidade)
// e guardamos os campos que realmente existem no arquivo. Se não reconhecer, o arquivo original
// fica guardado do mesmo jeito e o motivo aparece para o usuário.

export const LIMITE_XML = 20 * 1024 * 1024 // 20 MB
const MAX_PECAS = 5000

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// nome do campo no XML -> coluna padrão
const MAPA = [
  ['ref', /^(id|ref|reference|referencia|codigo|code|cod|item|uniqueid|partnumber)$/],
  ['descricao', /^(description|descricao|desc|name|nome|descricaopeca|partname)$/],
  ['qtd', /^(quantity|quantidade|qtd|qtde|qty|amount)$/],
  ['largura', /^(width|largura|larg|w|dimx|x)$/],
  ['altura', /^(height|altura|alt|h|dimy|y)$/],
  ['profundidade', /^(depth|profundidade|prof|d|dimz|z|espessura|thickness)$/],
  ['comprimento', /^(length|comprimento|comp)$/],
  ['material', /^(material|materia|acabamento|finish|finishing|cor|color|textura|chapa)$/],
  ['modulo', /^(module|modulo|grupo|group|parent|ambiente|environment|category|categoria)$/],
]
export const COLUNAS_PADRAO = {
  ref: 'Ref.', descricao: 'Descrição', qtd: 'Qtd', largura: 'Largura', altura: 'Altura', profundidade: 'Profund./Esp.',
  comprimento: 'Comprimento', material: 'Material', modulo: 'Módulo',
}

function padrao(nome) {
  const n = semAcento(nome).replace(/[^a-z]/g, '')
  return MAPA.find(([, re]) => re.test(n))?.[0] || null
}

// campos de um elemento: atributos + filhos simples (só texto)
function camposDe(el) {
  const out = {}
  for (const a of el.attributes) out[a.name] = a.value
  for (const f of el.children) if (!f.children.length && f.textContent.trim()) out[f.tagName] = f.textContent.trim()
  return out
}

function pontuar(campos) {
  const tipos = new Set(Object.keys(campos).map(padrao).filter(Boolean))
  const temDesc = tipos.has('descricao') || tipos.has('ref')
  const temMedida = ['largura', 'altura', 'profundidade', 'comprimento', 'qtd'].filter((t) => tipos.has(t)).length
  return temDesc && temMedida ? 2 + temMedida : 0
}

export function lerXmlPromob(texto) {
  if (!texto || !texto.trim()) throw new Error('O arquivo está vazio.')
  const doc = new DOMParser().parseFromString(texto, 'application/xml')
  const erro = doc.querySelector('parsererror')
  if (erro) throw new Error('O arquivo não é um XML válido (está corrompido ou incompleto).')

  // agrupa elementos pelo nome e pontua quem parece peça
  const grupos = new Map()
  for (const el of doc.getElementsByTagName('*')) {
    const g = grupos.get(el.tagName) || { qtd: 0, pontos: 0, amostras: 0 }
    g.qtd++
    if (g.amostras < 30) {
      g.pontos += pontuar(camposDe(el))
      g.amostras++
    }
    grupos.set(el.tagName, g)
  }
  const candidatos = [...grupos.entries()]
    .filter(([, g]) => g.qtd >= 1 && g.pontos > 0)
    .sort((a, b) => b[1].pontos / b[1].amostras * Math.log2(b[1].qtd + 1) - a[1].pontos / a[1].amostras * Math.log2(a[1].qtd + 1))
  if (!candidatos.length) {
    const raiz = doc.documentElement?.tagName
    throw new Error(`Não reconheci uma lista de peças neste XML (raiz <${raiz}>, sem itens com descrição e medidas). O arquivo original foi guardado; envie um exemplo para ajustarmos o leitor.`)
  }
  const [tag] = candidatos[0]

  const elementos = [...doc.getElementsByTagName(tag)]
  const colunasRaw = new Set()
  const itens = []
  for (const el of elementos.slice(0, MAX_PECAS)) {
    const c = camposDe(el)
    if (!pontuar(c)) continue
    const item = {}
    for (const [k, v] of Object.entries(c)) {
      const p = padrao(k)
      if (p && !(p in item)) item[p] = v
      else if (!p) colunasRaw.add(k)
    }
    // guarda também os campos que não têm coluna padrão (até 12), para não perder informação técnica
    const extras = Object.fromEntries(Object.entries(c).filter(([k]) => !padrao(k)).slice(0, 12))
    if (Object.keys(extras).length) item.extras = extras
    itens.push(item)
  }
  if (!itens.length) throw new Error('O XML não tem peças com descrição e medidas.')
  const colunas = Object.keys(COLUNAS_PADRAO).filter((k) => itens.some((i) => i[k] !== undefined && i[k] !== ''))
  return {
    formato: `<${tag}>`,
    total: itens.length,
    cortado: elementos.length > MAX_PECAS,
    colunas,
    extras: [...colunasRaw].slice(0, 30),
    itens,
  }
}
