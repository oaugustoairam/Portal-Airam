// "Fechar venda": junta os documentos da pasta do cliente em um único PDF para baixar e imprimir.
// Página 1 é o resumo da pasta; depois vêm os PDFs (todas as páginas) e as imagens, uma por página.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { DOCS_PASTA, financeira, moeda } from './vendas.js'
import { imagemParaJpeg } from './relatorio.js'

const A4 = [595.28, 841.89]
const VERMELHO = rgb(0.576, 0, 0)
const CINZA = rgb(0.43, 0.43, 0.42)
const TINTA = rgb(0.09, 0.09, 0.09)
const data = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—')

// As fontes padrão do PDF só têm o alfabeto latino básico
const limpo = (t) => String(t ?? '').replace(/[^\x20-\x7E -ÿ]/g, (c) => ({ '—': '-', '–': '-', '·': '·', '’': "'", '“': '"', '”': '"' }[c] ?? ''))

function quebrar(texto, fonte, tamanho, largura) {
  const linhas = []
  let atual = ''
  for (const palavra of limpo(texto).split(/\s+/)) {
    const teste = atual ? `${atual} ${palavra}` : palavra
    if (fonte.widthOfTextAtSize(teste, tamanho) > largura && atual) {
      linhas.push(atual)
      atual = palavra
    } else atual = teste
  }
  if (atual) linhas.push(atual)
  return linhas
}

async function paginaResumo(pdf, venda, docs, ignorados) {
  const f = await pdf.embedFont(StandardFonts.Helvetica)
  const fb = await pdf.embedFont(StandardFonts.HelveticaBold)
  const p = pdf.addPage(A4)
  const M = 48
  let y = A4[1] - M
  p.drawRectangle({ x: 0, y: A4[1] - 92, width: A4[0], height: 92, color: VERMELHO })
  p.drawText('AIRAM', { x: M, y: A4[1] - 52, size: 22, font: fb, color: rgb(1, 1, 1) })
  p.drawText('Arquitetura & Marcenaria', { x: M, y: A4[1] - 68, size: 9, font: f, color: rgb(1, 1, 1) })
  p.drawText('PASTA DO CLIENTE', { x: A4[0] - M - fb.widthOfTextAtSize('PASTA DO CLIENTE', 10), y: A4[1] - 56, size: 10, font: fb, color: rgb(1, 1, 1) })
  y = A4[1] - 130
  p.drawText(limpo(venda.cliente_nome), { x: M, y, size: 22, font: fb, color: TINTA })
  y -= 20
  p.drawText(limpo(`Código ${venda.codigo || '—'}  ·  Venda em ${data(venda.data_venda)}  ·  ${venda.loja === 'mooca' ? 'Mooca' : venda.loja === 'guarulhos' ? 'Guarulhos' : '—'}`), { x: M, y, size: 10, font: f, color: CINZA })
  y -= 34
  const dados = [
    ['Vendedor', venda.vendedor], ['Captação', venda.captacao],
    ['Financeira', financeira(venda.financeira)?.nome], ['Forma de pagamento', venda.forma_pagamento],
    ['Valor da venda', moeda(venda.valor_venda)], ['Deflacionado', moeda(venda.valor_deflacionado)],
  ]
  dados.forEach(([k, v], i) => {
    const x = M + (i % 2) * 250
    const yy = y - Math.floor(i / 2) * 36
    p.drawText(limpo(k.toUpperCase()), { x, y: yy, size: 7.5, font: fb, color: CINZA })
    p.drawText(limpo(v || '—'), { x, y: yy - 13, size: 11, font: f, color: TINTA })
  })
  y -= 3 * 36 + 18
  p.drawText('DOCUMENTOS DA PASTA', { x: M, y, size: 9, font: fb, color: VERMELHO })
  y -= 8
  p.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.8, color: TINTA })
  y -= 20
  for (const cat of DOCS_PASTA) {
    const lista = docs.filter((d) => d.categoria === cat.id)
    const ok = lista.length > 0
    p.drawCircle({ x: M + 5, y: y + 3, size: 5, color: ok ? VERMELHO : undefined, borderColor: ok ? VERMELHO : CINZA, borderWidth: 1 })
    p.drawText(limpo(cat.nome), { x: M + 18, y, size: 11, font: ok ? fb : f, color: ok ? TINTA : CINZA })
    const txt = ok ? `${lista.length} ${lista.length === 1 ? 'arquivo' : 'arquivos'}` : 'Não anexado'
    p.drawText(txt, { x: A4[0] - M - f.widthOfTextAtSize(txt, 10), y, size: 10, font: f, color: ok ? TINTA : VERMELHO })
    y -= 24
  }
  if (ignorados.length) {
    y -= 8
    for (const l of quebrar(`Não incluídos neste PDF (formato que não dá para imprimir junto): ${ignorados.map((d) => d.titulo).join(', ')}.`, f, 9, A4[0] - 2 * M)) {
      p.drawText(l, { x: M, y, size: 9, font: f, color: CINZA })
      y -= 13
    }
  }
  if (venda.observacao) {
    y -= 14
    p.drawText('OBSERVAÇÃO', { x: M, y, size: 9, font: fb, color: VERMELHO })
    y -= 16
    for (const l of quebrar(venda.observacao, f, 10, A4[0] - 2 * M).slice(0, 8)) {
      p.drawText(l, { x: M, y, size: 10, font: f, color: TINTA })
      y -= 14
    }
  }
  const rod = limpo(`Pasta fechada em ${new Date().toLocaleString('pt-BR')}  ·  Airam Guarulhos · Airam Mooca · airam.arq.br`)
  p.drawText(rod, { x: M, y: 30, size: 8, font: f, color: CINZA })
  return { f, fb }
}

// obterArquivo(doc) → ArrayBuffer do arquivo
export async function gerarPdfPasta(venda, docs, obterArquivo, urlArquivo) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(limpo(`Pasta ${venda.codigo || ''} - ${venda.cliente_nome}`))
  pdf.setAuthor('Airam Arquitetura & Marcenaria')
  const ordem = DOCS_PASTA.flatMap((c) => docs.filter((d) => d.categoria === c.id))
  const imprimiveis = ordem.filter((d) => /pdf|^image\//.test(d.tipo_mime || ''))
  const ignorados = ordem.filter((d) => !imprimiveis.includes(d))
  const { f } = await paginaResumo(pdf, venda, docs, ignorados)

  for (const d of imprimiveis) {
    const nomeCat = DOCS_PASTA.find((c) => c.id === d.categoria)?.nome || ''
    if ((d.tipo_mime || '').includes('pdf')) {
      try {
        const origem = await PDFDocument.load(await obterArquivo(d), { ignoreEncryption: true })
        const paginas = await pdf.copyPages(origem, origem.getPageIndices())
        paginas.forEach((pg) => pdf.addPage(pg))
      } catch {
        ignorados.push(d)
      }
      continue
    }
    // imagem: convertida para JPEG e centralizada na página A4, com legenda
    const img = await imagemParaJpeg(await urlArquivo(d), 2000)
    if (!img) {
      ignorados.push(d)
      continue
    }
    const jpg = await pdf.embedJpg(img.src)
    const p = pdf.addPage(A4)
    const M = 36
    const maxL = A4[0] - 2 * M
    const maxA = A4[1] - 2 * M - 24
    const k = Math.min(maxL / jpg.width, maxA / jpg.height)
    const w = jpg.width * k
    const h = jpg.height * k
    p.drawImage(jpg, { x: (A4[0] - w) / 2, y: M + 24 + (maxA - h) / 2, width: w, height: h })
    p.drawText(limpo(`${nomeCat} · ${d.titulo}`).slice(0, 110), { x: M, y: M - 4, size: 9, font: f, color: CINZA })
  }
  return new Blob([await pdf.save()], { type: 'application/pdf' })
}
