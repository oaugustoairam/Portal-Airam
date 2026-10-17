// Preenche um modelo .xlsx da Airam sem mudar o desenho: abre o arquivo, troca só o conteúdo
// das células e gera um novo arquivo. Estilos, logos, fórmulas e validações ficam intactos.
import JSZip from 'jszip'

const escapar = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Data AAAA-MM-DD → número de série do Excel
export function serialExcel(iso) {
  if (!iso) return null
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000)
}

export function definirCelula(xml, ref, valor) {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`)
  const m = xml.match(re)
  if (!m) throw new Error(`Célula ${ref} não encontrada no modelo`)
  const estilo = (m[1].match(/ s="\d+"/) || [''])[0]
  let celula
  if (valor === null || valor === undefined || valor === '') celula = `<c r="${ref}"${estilo}/>`
  else if (typeof valor === 'number') celula = `<c r="${ref}"${estilo}><v>${valor}</v></c>`
  else celula = `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`
  return xml.replace(re, celula)
}

// modelo: endereço do arquivo ou data URI em base64.
// celulas: { 'xl/worksheets/sheet1.xml': { A1: 'texto', B2: 12 } }; trocas: [[arquivo, de, para]]
export async function preencherModelo(modelo, celulas, trocas = []) {
  const zip = modelo.startsWith('data:')
    ? await JSZip.loadAsync(modelo.slice(modelo.indexOf(',') + 1), { base64: true })
    : await JSZip.loadAsync(await (await fetch(modelo)).arrayBuffer())
  for (const [arquivo, valores] of Object.entries(celulas)) {
    let xml = await zip.file(arquivo).async('string')
    for (const [ref, valor] of Object.entries(valores)) xml = definirCelula(xml, ref, valor)
    zip.file(arquivo, xml)
  }
  for (const [arquivo, de, para] of trocas) {
    const xml = await zip.file(arquivo).async('string')
    zip.file(arquivo, xml.split(de).join(para))
  }
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// Lê uma aba de um .xlsx enviado pelo usuário: { linha: { A: valor, B: valor } }.
// Usa o valor já calculado das fórmulas (o Excel salva junto). nomeAba: parte do nome da aba.
export async function lerPlanilha(arquivo, nomeAba) {
  const zip = await JSZip.loadAsync(await arquivo.arrayBuffer())
  const texto = (x) => x.replace(/<rPh[\s\S]*?<\/rPh>/g, '').replace(/<[^>]+>/g, '')
  const desfazer = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  const ss = zip.file('xl/sharedStrings.xml') ? await zip.file('xl/sharedStrings.xml').async('string') : ''
  const strings = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => desfazer(texto(m[1])))
  const wb = await zip.file('xl/workbook.xml').async('string')
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string')
  const abas = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((m) => ({ nome: desfazer(m[1]), rid: m[2] }))
  const alvo = abas.find((a) => a.nome.toUpperCase().includes(String(nomeAba).toUpperCase())) || abas[0]
  if (!alvo) throw new Error('A planilha não tem abas.')
  const rel = rels.match(new RegExp(`<Relationship [^>]*Id="${alvo.rid}"[^>]*/>`))?.[0] || ''
  const caminho = 'xl/' + (rel.match(/Target="([^"]+)"/)?.[1] || '').replace(/^\/?xl\//, '')
  const xml = await zip.file(caminho).async('string')
  const linhas = {}
  for (const m of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, col, lin, attrs, corpo = ''] = m
    const t = (attrs.match(/ t="(\w+)"/) || [])[1]
    let v
    if (t === 'inlineStr') v = desfazer(texto(corpo))
    else {
      const bruto = (corpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1]
      if (bruto === undefined) continue
      v = t === 's' ? strings[Number(bruto)] : t === 'str' || t === 'e' ? desfazer(bruto) : t === 'b' ? bruto === '1' : Number(bruto)
    }
    if (v === '' || v === undefined) continue
    ;(linhas[lin] ||= {})[col] = v
  }
  return { aba: alvo.nome, linhas }
}

// Número de série do Excel → AAAA-MM-DD (aceita também texto dd/mm/aaaa)
export function dataDoExcel(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10)
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : null
}
