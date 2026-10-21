// Renders e fotos grandes ficam leves antes de subir: no máximo 2400 px no lado maior, em WebP.
// Assim abrem rápido no celular do cliente, mesmo no 4G. PDFs e arquivos do Promob não mudam.
const LADO_MAXIMO = 2400
const COMPRIMIR_ACIMA = 700 * 1024 // só mexe em imagens com mais de 700 KB

export async function prepararImagem(arquivo) {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type) || arquivo.size <= COMPRIMIR_ACIMA) return arquivo
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/webp', 0.85))
    if (!blob || blob.size >= arquivo.size) return arquivo // não ficou menor: mantém o original
    const nome = arquivo.name.replace(/\.(jpe?g|png|webp)$/i, '') + '.webp'
    return new File([blob], nome, { type: 'image/webp' })
  } catch {
    return arquivo // navegador sem suporte: envia como está
  }
}
