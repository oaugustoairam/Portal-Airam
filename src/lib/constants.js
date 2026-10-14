export const CATEGORIAS = [
  { id: 'contrato', nome: 'Contrato' },
  { id: 'projeto_inicial', nome: 'Projeto inicial' },
  { id: 'render', nome: 'Renders' },
  { id: 'projeto_final', nome: 'Projeto final' },
  { id: 'outro', nome: 'Outros' },
]

export const STATUS = {
  pendente: 'A iniciar',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
}

// Fases padrão de um projeto de móveis planejados. Editáveis em cada projeto.
export const FASES_PADRAO = [
  'Briefing e medição',
  'Projeto inicial e renders',
  'Aprovação e contrato',
  'Projeto final (executivo)',
  'Produção na fábrica',
  'Entrega e montagem',
  'Vistoria final',
]

export function faseAtual(fases) {
  return (
    fases.find((f) => f.status === 'em_andamento') ||
    fases.find((f) => f.status === 'pendente') ||
    fases[fases.length - 1] ||
    null
  )
}

export function progresso(fases) {
  if (!fases.length) return 0
  const feitas = fases.filter((f) => f.status === 'concluida').length
  const meia = fases.some((f) => f.status === 'em_andamento') ? 0.5 : 0
  return Math.round(((feitas + meia) / fases.length) * 100)
}

export function diasAte(data) {
  if (!data) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(data + 'T00:00:00')
  return Math.round((alvo - hoje) / 86400000)
}

export function formatarData(data) {
  if (!data) return '—'
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function prazoTexto(data) {
  const d = diasAte(data)
  if (d === null) return 'Sem prazo definido'
  if (d === 0) return 'Vence hoje'
  if (d > 0) return d === 1 ? 'Falta 1 dia' : `Faltam ${d} dias`
  return d === -1 ? '1 dia de atraso' : `${-d} dias de atraso`
}
