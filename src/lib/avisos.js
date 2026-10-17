// Mesmas regras dos gatilhos do banco (supabase/schema.sql, seção 9). Usado só no modo
// demonstração, para simular os avisos que o servidor enviaria.
const br = (d) => (d ? d.split('-').reverse().join('/') : '')

export function avisosDaMudanca(a, n) {
  const ev = []
  const add = (evento, titulo, mensagem) => ev.push({ evento, titulo, mensagem })
  if (n.solucao_financeira === 'ok' && a.solucao_financeira !== 'ok')
    add('financeiro_aprovado', 'Solução financeira aprovada', 'Sua solução financeira foi aprovada. Seguimos para a próxima etapa do seu processo.')
  if (n.data_medicao && n.data_medicao !== a.data_medicao && !n.medicao_concluida)
    add('medicao_agendada', 'Medição agendada', `Sua medição está agendada para ${br(n.data_medicao)}. Nossa equipe vai até o local nessa data.`)
  if (n.medicao_concluida && !a.medicao_concluida)
    add('medicao_realizada', 'Medição concluída', 'A medição dos seus ambientes foi concluída. Agora preparamos o seu projeto final.')
  if (n.data_conferencia && n.data_conferencia !== a.data_conferencia && !n.conferencia_concluida)
    add('conferencia_agendada', 'Conferência do projeto final', `A conferência do seu projeto final está marcada para ${br(n.data_conferencia)}.`)
  if (n.conferencia_concluida && !a.conferencia_concluida)
    add('conferencia_realizada', 'Conferência concluída', 'A conferência do seu projeto final foi concluída. Em breve ele estará pronto para assinatura.')
  if (n.projeto_assinado_manual && !a.projeto_assinado_manual)
    add('producao_iniciada', 'Seus móveis entraram em produção', 'Projeto final assinado! Seus móveis entraram em produção na fábrica.')
  if (n.data_entrega_prevista !== a.data_entrega_prevista && !n.entrega_concluida)
    add('entrega_reagendada', 'Nova data de entrega', `A entrega prevista dos seus móveis agora é ${br(n.data_entrega_prevista)}.`)
  if (n.entrega_concluida && !a.entrega_concluida)
    add('entrega_concluida', 'Entrega concluída', 'Entrega e montagem concluídas! Obrigado por confiar na Airam. Seus móveis têm 10 anos de garantia.')
  return ev
}

export function avisoAssinatura(tipo, status) {
  const doc = tipo === 'contrato' ? 'contrato' : 'projeto final'
  if (status === 'pendente')
    return { evento: `${tipo}_disponivel`, titulo: 'Documento para assinar', mensagem: `Seu ${doc} está pronto para assinatura. Entre no Portal Airam e assine em poucos minutos.` }
  if (tipo === 'contrato')
    return { evento: 'contrato_assinado', titulo: 'Contrato assinado', mensagem: 'Recebemos seu contrato assinado. Obrigado por escolher a Airam! A cópia assinada está no portal.' }
  return { evento: 'producao_iniciada', titulo: 'Seus móveis entraram em produção', mensagem: 'Projeto final assinado! Seus móveis entraram em produção na fábrica.' }
}

export function telefoneWhatsApp(t) {
  const n = String(t || '').replace(/\D/g, '')
  if (n.length === 10 || n.length === 11) return '55' + n
  if (/^55\d{10,11}$/.test(n)) return n
  return null
}

export const ROTULO_STATUS_AVISO = {
  pendente: 'Na fila',
  enviado: 'Enviado',
  erro: 'Falhou',
  ignorado: 'Não enviado',
  simulado: 'Simulado',
}
