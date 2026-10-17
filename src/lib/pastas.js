// Pastas da área de processos: cada uma mostra os processos que estão naquela fase,
// com as colunas e os prazos que importam para quem cuida dela.
import { somarDiasUteis, diasEntre, hojeISO, PRAZOS_CONTRATO, TIPOS_PRAZO } from './constants.js'
import { montarRelatorio, situacaoPrazo, dataCurta } from './relatorio.js'

const dia = (iso) => (iso ? String(iso).slice(0, 10) : null)
const neutro = (texto) => ({ tipo: 'neutro', texto })
const andamento = (texto) => ({ tipo: 'andamento', texto })

// r = montarRelatorio(processo, controle)
export const PASTAS = [
  {
    id: 'financeiro',
    nome: 'Financeiro',
    descricao: 'Solução financeira pendente. Prazo de 5 dias úteis após a venda.',
    noFiltro: (r) => r.p.solucao_financeira !== 'ok',
    prazo: (r) => somarDiasUteis(r.real.venda, PRAZOS_CONTRATO.aprovacaoFinanceira),
    situacao: (r, prazo) => situacaoPrazo(prazo, null),
    colunas: [
      ['Venda', (r) => dataCurta(r.real.venda)],
      ['Prazo financeiro', (r, prazo) => dataCurta(prazo)],
      ['E-mail de formalização', (r) => dataCurta(r.c.email_enviado_em)],
    ],
  },
  {
    id: 'medicao',
    nome: 'Medição',
    descricao: 'Financeiro aprovado e medição ainda não feita.',
    noFiltro: (r) => r.p.solucao_financeira === 'ok' && !r.real.medicao && !r.p.medicao_concluida,
    prazo: (r) => dia(r.p.data_medicao),
    situacao: (r, prazo) => (prazo ? situacaoPrazo(prazo, null) : neutro('Agendar medição')),
    colunas: [
      ['Disponível para medir', (r) => dataCurta(r.p.data_disponivel_medicao)],
      ['Tipo de prazo', (r) => TIPOS_PRAZO[r.p.tipo_prazo]?.nome || '—'],
      ['Medição agendada', (r, prazo) => dataCurta(prazo)],
    ],
  },
  {
    id: 'conferencia',
    nome: 'Conferência',
    descricao: 'Medição feita, aguardando conferência do liberador e o PDF do projeto final. 5 + 5 dias úteis.',
    noFiltro: (r) => (r.real.medicao || r.p.medicao_concluida) && !r.real.pdf && !r.real.assinado && !enviadoZapSign(r),
    prazo: (r) => (r.real.conferido ? r.prazoPdf : r.prazoConferencia),
    situacao: (r) => {
      if (!r.real.liberador) return neutro('Enviar ao liberador')
      if (!r.real.conferido) return r.situacaoConferencia
      if (!r.real.conferenciaEnviada) return andamento('Enviar a conferência')
      return r.situacaoPdf
    },
    colunas: [
      ['Liberador', (r) => r.c.liberador || '—'],
      ['Recebeu em', (r) => dataCurta(r.real.liberador)],
      ['Prazo conferência', (r) => dataCurta(r.prazoConferencia)],
      ['Conferido', (r) => dataCurta(r.real.conferido)],
      ['Prazo do PDF', (r) => dataCurta(r.prazoPdf)],
    ],
  },
  {
    id: 'assinatura',
    nome: 'Assinatura do projeto final',
    descricao: 'PDF do projeto final pronto, aguardando a assinatura do cliente.',
    noFiltro: (r) => (r.real.pdf || r.p.conferencia_concluida || enviadoZapSign(r)) && !r.real.assinado,
    prazo: (r) => dia(r.p.data_assinatura_projeto),
    situacao: (r, prazo) => (prazo ? situacaoPrazo(prazo, null) : neutro('Sem data prevista')),
    colunas: [
      ['PDF recebido', (r) => dataCurta(r.real.pdf)],
      ['Assinatura prevista', (r, prazo) => dataCurta(prazo)],
      ['ZapSign', (r) => (enviadoZapSign(r) ? 'Enviado ao cliente' : 'Não enviado')],
    ],
  },
  {
    id: 'entregas',
    nome: 'Entregas',
    descricao: 'Projeto final assinado, em fabricação até a entrega.',
    noFiltro: (r) => r.real.assinado && !r.real.entregue && !r.p.entrega_concluida,
    prazo: (r) => dia(r.p.data_entrega_prevista),
    situacao: (r, prazo) => situacaoPrazo(prazo, null),
    colunas: [
      ['Assinado em', (r) => dataCurta(r.real.assinado)],
      ['Em fabricação há', (r) => `${diasEntre(r.real.assinado, hojeISO())} dias`],
      ['Prazo máximo', (r, prazo) => dataCurta(prazo)],
    ],
  },
  {
    id: 'vistoria',
    nome: 'Vistoria',
    descricao: 'Entregue, com montagem em andamento ou aguardando a vistoria.',
    noFiltro: (r) => (r.real.entregue || r.p.entrega_concluida) && !r.real.vistoria,
    // montagem começa em até 7 dias úteis após a entrega
    prazo: (r) => (r.real.montagem ? null : somarDiasUteis(r.real.entregue, PRAZOS_CONTRATO.inicioMontagem)),
    situacao: (r, prazo) => (r.real.montagem ? andamento('Aguardando vistoria') : prazo ? situacaoPrazo(prazo, null) : neutro('Iniciar montagem')),
    colunas: [
      ['Entregue', (r) => dataCurta(r.real.entregue)],
      ['Montagem começou', (r) => dataCurta(r.real.montagem)],
      ['Montador', (r) => r.c.montador || '—'],
    ],
  },
  {
    id: 'assistencia',
    nome: 'Assistência técnica',
    descricao: 'Processos com ATT em aberto e o retorno máximo combinado.',
    noFiltro: (r) => r.c.tem_att === true && !r.c.assistencia_concluida_em,
    prazo: (r) => dia(r.c.assistencia_retorno_max),
    situacao: (r, prazo) => (prazo ? situacaoPrazo(prazo, null) : neutro('Definir retorno máximo')),
    colunas: [
      ['Montador', (r) => r.c.montador || '—'],
      ['Vistoria', (r) => dataCurta(r.real.vistoria)],
      ['Retorno máximo', (r, prazo) => dataCurta(prazo)],
    ],
  },
]

// PDF do projeto final já enviado para o cliente assinar
const enviadoZapSign = (r) => r.p.assinaturas?.some((a) => a.tipo === 'projeto_final' && a.status === 'pendente')

const PESO = { atraso: 0, andamento: 1, neutro: 2, ok: 3 }

// Linhas de uma pasta, das mais urgentes para as menos
export function linhasDaPasta(pasta, processos, controles) {
  return processos
    .filter((p) => !p.entrega_concluida || pasta.id === 'vistoria' || pasta.id === 'assistencia')
    .map((p) => montarRelatorio(p, controles[p.id] || {}))
    .filter((r) => pasta.noFiltro(r))
    .map((r) => {
      const prazo = pasta.prazo(r)
      return { r, prazo, situacao: pasta.situacao(r, prazo) }
    })
    .sort((a, b) => PESO[a.situacao.tipo] - PESO[b.situacao.tipo] || (a.prazo || '9999').localeCompare(b.prazo || '9999'))
}

export function resumoDaPasta(linhas) {
  const hoje = hojeISO()
  return {
    total: linhas.length,
    atrasados: linhas.filter((l) => l.situacao.vencido).length,
    em7dias: linhas.filter((l) => l.prazo && !l.situacao.vencido && diasEntre(hoje, l.prazo) <= 7).length,
  }
}
