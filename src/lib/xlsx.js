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

// celulas: { 'xl/worksheets/sheet1.xml': { A1: 'texto', B2: 12 } }; trocas: [[arquivo, de, para]]
export async function preencherModelo(url, celulas, trocas = []) {
  const zip = await JSZip.loadAsync(await (await fetch(url)).arrayBuffer())
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
