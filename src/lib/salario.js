// Salário do dia 10 (mesma regra das funções salario_mes / vendas_do_mes do banco).
// Base: soma do valor deflacionado das vendas válidas do mês; a faixa é definida pelo total e o
// percentual incide sobre todo o valor (não é escalonado). Salário = fixo da faixa + total × %.

export const REGUA_PADRAO = [
  { de: 0, pct: 0, fixo: 2000 }, { de: 20000, pct: 3, fixo: 2000 }, { de: 50000, pct: 4, fixo: 2000 },
  { de: 100000, pct: 5, fixo: 2500 }, { de: 150000, pct: 6, fixo: 3000 }, { de: 200000, pct: 7, fixo: 3500 },
]
export const ITENS_CHECKLIST = [
  ['contrato', 'Contrato feito e assinado'], ['documento', 'Documento do cliente'], ['formalizacao', 'E-mail de formalização enviado'],
  ['financeiro', 'Solução financeira 100% resolvida'], ['pasta', 'Pasta do cliente feita'],
]
const centavos = (v) => Math.round(v * 100) / 100

export function faixaDe(total, faixas) {
  return [...faixas].sort((a, b) => b.de - a.de).find((f) => f.de <= (total || 0)) || faixas[0]
}
export function proximaFaixa(total, faixas) {
  return [...faixas].sort((a, b) => a.de - b.de).find((f) => f.de > (total || 0)) || null
}
export function calcularSalario(total, faixas) {
  const f = faixaDe(total, faixas)
  const comissao = centavos((total || 0) * f.pct / 100)
  return { total_deflacionado: total || 0, faixa: f, comissao, fixo: f.fixo, total: centavos(f.fixo + comissao) }
}
// régua que vale para o mês (a de vigência mais recente até ele)
export function reguaDoMes(reguas, mes) {
  return [...reguas].sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde)).find((r) => r.vigente_desde <= mes) || { faixas: REGUA_PADRAO }
}
export const primeiroDia = (iso) => `${iso.slice(0, 7)}-01`
export const mesSeguinte = (mes) => {
  const [a, m] = mes.split('-').map(Number)
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`
}
export const nomeMes = (mes) => {
  const t = new Date(`${mes.slice(0, 7)}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// competência: o mês mais tarde entre a venda, o checklist completo e o "pulo" desfeito
export function competencia(venda, checklist, pulos) {
  const datas = [venda.venda_data]
  if (checklist?.completa_em) datas.push(diaSP(checklist.completa_em))
  const desfeitos = pulos.filter((p) => p.lead_id === venda.id && p.desfeito_em).map((p) => diaSP(p.desfeito_em))
  if (desfeitos.length) datas.push(desfeitos.sort().pop())
  return primeiroDia(datas.filter(Boolean).sort().pop())
}
// dia no horário de Brasília
export const diaSP = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ts))

export function faltandoChecklist(ck) {
  return ITENS_CHECKLIST.filter(([k]) => !ck?.[`${k}_em`]).map(([, t]) => t)
}
