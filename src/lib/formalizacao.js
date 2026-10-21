// Formalização: monta título e texto a partir do modelo do tipo e confere o que falta antes do envio.
// (o servidor confere de novo em supabase/functions/formalizacao-enviar)

export const LIMITE_ANEXOS = 18 * 1024 * 1024 // ~25 MB depois de codificado no e-mail (limite da Hostinger por mensagem)
export const CAMPOS_FORMALIZACAO = [['previsao', 'Previsão do imóvel'], ['origem', 'Pedido de origem (complemento)']]
export const MARCADORES = ['{codigo}', '{cliente}', '{previsao}', '{codigo_origem}', '{nome_origem}', '{checklist}']
const emailOk = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)

// checklist: o bloco ("Solicito medição." + itens) só entra quando todos os itens estão marcados
export function itensPendentes(tipo, marcados = []) {
  return (tipo.checklist || []).filter((_, i) => !marcados[i])
}
export function blocoChecklist(tipo, marcados = []) {
  const itens = tipo.checklist || []
  if (!itens.length || itensPendentes(tipo, marcados).length) return ''
  return [tipo.bloco_checklist, ...itens.map((x) => `✔ ${x.texto}`)].filter(Boolean).join('\n')
}

function preencher(modelo, v) {
  return modelo
    .replace(/\{codigo\}/g, v.codigo || '')
    .replace(/\{cliente\}/g, v.cliente || '')
    .replace(/\{previsao\}/g, v.previsao || '')
    .replace(/\{codigo_origem\}/g, v.codigo_origem || '')
    .replace(/\{nome_origem\}/g, v.nome_origem || '')
    .replace(/\{checklist\}/g, v.checklist || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
export function montarFormalizacao(tipo, dados) {
  const v = { ...dados, checklist: blocoChecklist(tipo, dados.marcados) }
  return { titulo: preencher(tipo.titulo_modelo || '{codigo} - {cliente}', v), texto: preencher(tipo.texto_modelo || '', v) }
}

export function separarEmails(texto) {
  return String(texto || '').split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)
}

// tudo que impede o envio (o botão "Enviar e-mail" só liga com a lista vazia)
export function faltasFormalizacao(tipo, f) {
  const faltas = []
  if (!f.lead_id) faltas.push('Escolha o cliente.')
  if (!String(f.codigo || '').trim()) faltas.push('Informe o código do pedido.')
  if (!tipo) return [...faltas, 'Escolha o tipo de formalização.']
  if ((tipo.campos || []).includes('previsao') && !String(f.previsao || '').trim()) faltas.push('Informe a previsão do imóvel.')
  if ((tipo.campos || []).includes('origem') && (!String(f.codigo_origem || '').trim() || !String(f.nome_origem || '').trim())) faltas.push('Informe o código e o nome do pedido de origem.')
  for (const a of tipo.anexos || []) if (a.obrigatorio && !(f.anexos?.[a.id] || []).length) faltas.push(`Anexe: ${a.nome}.`)
  const total = Object.values(f.anexos || {}).flat().reduce((s, x) => s + (x.size || x.tamanho || 0), 0)
  if (total > LIMITE_ANEXOS) faltas.push(`Os anexos somam ${(total / 1048576).toFixed(1)} MB; o limite é ${LIMITE_ANEXOS / 1048576} MB.`)
  if (!String(f.titulo || '').trim()) faltas.push('O título está vazio.')
  if (!String(f.texto || '').trim()) faltas.push('O texto está vazio.')
  const para = f.para || []
  if (!para.length) faltas.push('Informe pelo menos um destinatário em "Para".')
  const invalidos = [...para, ...(f.cc || []), ...(f.cco || [])].filter((e) => !emailOk(e))
  if (invalidos.length) faltas.push(`E-mail inválido: ${invalidos.join(', ')}.`)
  return faltas
}
