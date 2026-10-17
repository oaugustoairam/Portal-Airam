import { hojeISO } from './constants.js'

// Um cliente por e-mail (o mesmo cliente pode ter mais de um processo), com data de nascimento.
export function clientesComNascimento(processos) {
  const vistos = new Map()
  for (const p of processos) {
    const chave = (p.cliente_email || p.id).toLowerCase()
    if (p.cliente_nascimento && !vistos.has(chave)) vistos.set(chave, p)
  }
  return [...vistos.values()]
}

// Dias até o próximo aniversário (0 = hoje) e a idade que a pessoa completa.
export function proximoAniversario(nascimento, hoje = hojeISO()) {
  const [ano, mes, dia] = nascimento.split('-').map(Number)
  const [ah, mh, dh] = hoje.split('-').map(Number)
  const base = new Date(ah, mh - 1, dh)
  let alvo = new Date(ah, mes - 1, dia)
  if (alvo < base) alvo = new Date(ah + 1, mes - 1, dia)
  const dias = Math.round((alvo - base) / 86400000)
  return { dias, idade: alvo.getFullYear() - ano, data: alvo }
}

export function aniversariantesDoDia(processos) {
  return clientesComNascimento(processos).filter((p) => proximoAniversario(p.cliente_nascimento).dias === 0)
}
