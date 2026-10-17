// Monta os dados dos relatórios (PDF de um cliente e lista de vários) a partir do processo
// e do controle interno da loja.
import { linhaDoTempo, etapaAtual, progresso, somarDiasUteis, diasEntre, hojeISO, TIPOS_PRAZO, CATEGORIAS } from './constants.js'

export const PRAZOS_INTERNOS = {
  conferencia: 5, // liberador manda a conferência do projeto final após receber a medição
  pdf: 5, // PDF do projeto final após o envio da conferência
}

const dia = (iso) => (iso ? String(iso).slice(0, 10) : null)

export function dataMini(iso) {
  if (!iso) return '—'
  const [a, m, d] = dia(iso).split('-')
  return `${d}/${m}/${a.slice(2)}`
}

export function dataCurta(iso) {
  if (!iso) return '—'
  const [a, m, d] = dia(iso).split('-')
  return `${d}/${m}/${a}`
}

export function dataExtenso(iso) {
  if (!iso) return '—'
  return new Date(dia(iso) + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Situação de um prazo: cumprido, fora do prazo, atrasado ou quanto falta
export function situacaoPrazo(prazo, feito) {
  if (!prazo) return { tipo: 'neutro', texto: 'Sem prazo ainda' }
  if (feito) {
    const atraso = diasEntre(prazo, dia(feito))
    return atraso > 0
      ? { tipo: 'atraso', texto: `Feito ${atraso} ${atraso === 1 ? 'dia' : 'dias'} após o prazo` }
      : { tipo: 'ok', texto: 'Dentro do prazo' }
  }
  const d = diasEntre(hojeISO(), prazo)
  if (d < 0) return { tipo: 'atraso', vencido: true, texto: `${-d} ${d === -1 ? 'dia' : 'dias'} de atraso` }
  return { tipo: 'andamento', texto: d === 0 ? 'Vence hoje' : d === 1 ? 'Falta 1 dia' : `Faltam ${d} dias` }
}

export function montarRelatorio(p, c = {}) {
  const etapas = linhaDoTempo(p, p.assinaturas || [])
  const atual = etapaAtual(etapas)
  const assinadoZapSign = p.assinaturas?.find((a) => a.tipo === 'projeto_final' && a.status === 'assinado')?.assinado_em
  const hoje = hojeISO()

  // Datas reais: o controle interno vale mais; senão, o que o sistema registrou sozinho
  const real = {
    venda: dia(p.data_venda),
    pendencia: dia(c.pendencia_resolvida_em || p.financeiro_ok_em),
    email: dia(c.email_enviado_em),
    inicial: dia(c.inicial_assinado_em || p.projeto_inicial_em),
    medicao: dia(c.medido_em || p.medicao_concluida_em),
    liberador: dia(c.liberador_recebeu_em),
    conferido: dia(c.conferido_em || p.conferencia_concluida_em),
    conferenciaEnviada: dia(c.conferencia_enviada_em),
    pdf: dia(c.pdf_recebido_em),
    assinado: dia(c.projeto_final_assinado_em || assinadoZapSign || (p.projeto_assinado_manual ? p.projeto_assinado_em : null)),
    entregue: dia(c.entregue_em),
    montagem: dia(c.montagem_inicio_em),
    concluido: dia(p.montagem_concluida_em),
    vistoria: dia(c.vistoria_em),
  }
  const prazoConferencia = somarDiasUteis(real.liberador, PRAZOS_INTERNOS.conferencia)
  const prazoPdf = somarDiasUteis(real.conferenciaEnviada, PRAZOS_INTERNOS.pdf)

  const marcos = [
    { id: 'venda', nome: 'Venda', real: real.venda },
    { id: 'pendencia', nome: 'Pendência resolvida', real: real.pendencia },
    { id: 'email', nome: 'E-mail enviado', real: real.email },
    { id: 'inicial', nome: 'Projeto inicial assinado', real: real.inicial, previsto: dia(p.data_projeto_inicial) },
    { id: 'medicao', nome: 'Medição', real: real.medicao, previsto: dia(p.data_medicao) },
    { id: 'liberador', nome: 'Liberador recebeu a medição', real: real.liberador, extra: c.liberador },
    { id: 'conferido', nome: 'Projeto conferido', real: real.conferido, previsto: prazoConferencia || dia(p.data_conferencia) },
    { id: 'conferenciaEnviada', nome: 'Conferência enviada', real: real.conferenciaEnviada },
    { id: 'pdf', nome: 'PDF do projeto final recebido', real: real.pdf, previsto: prazoPdf },
    { id: 'assinado', nome: 'Projeto final assinado', real: real.assinado, previsto: dia(p.data_assinatura_projeto) },
    { id: 'entregue', nome: 'Entrega', real: real.entregue, previsto: dia(p.data_entrega_prevista) },
    { id: 'montagem', nome: 'Início da montagem', real: real.montagem, extra: c.montador },
    { id: 'vistoria', nome: 'Vistoria', real: real.vistoria },
  ]

  // Barras do cronograma: início e fim reais de cada fase; a fase em curso vai até hoje
  const fases = [
    ['Solução financeira', real.venda, real.pendencia],
    ['Projeto inicial', real.pendencia, real.inicial],
    ['Medição', real.inicial || real.pendencia, real.medicao],
    ['Conferência (liberador)', real.liberador || real.medicao, real.conferido, prazoConferencia],
    ['PDF do projeto final', real.conferenciaEnviada || real.conferido, real.pdf, prazoPdf],
    ['Assinatura do projeto', real.pdf || real.conferido, real.assinado, dia(p.data_assinatura_projeto)],
    ['Fabricação e entrega', real.assinado, real.entregue, dia(p.data_entrega_prevista)],
    ['Montagem', real.entregue, real.vistoria || real.concluido || (p.entrega_concluida ? real.montagem : null)],
  ].map(([nome, inicio, fim, prazo]) => ({
    nome,
    inicio,
    fim: fim || (inicio ? hoje : null),
    emCurso: !!inicio && !fim,
    prazo: prazo || null,
    dias: inicio ? diasEntre(inicio, fim || hoje) : null,
  }))

  const fimPrevisto = dia(p.data_entrega_prevista)
  const datas = [real.venda, hoje, fimPrevisto, ...fases.flatMap((f) => [f.inicio, f.fim, f.prazo])].filter(Boolean).sort()
  const diasAtePrazo = fimPrevisto ? diasEntre(hoje, fimPrevisto) : null

  return {
    p,
    c,
    etapas,
    atual,
    proxima: etapas.find((e) => e.status === 'futura'),
    concluido: !!p.entrega_concluida,
    progresso: progresso(etapas),
    feitas: etapas.filter((e) => e.status === 'concluida').length,
    tipoPrazo: TIPOS_PRAZO[p.tipo_prazo]?.nome,
    real,
    marcos,
    fases,
    escala: { inicio: datas[0], fim: datas[datas.length - 1] },
    hoje,
    prazoConferencia,
    prazoPdf,
    situacaoConferencia: situacaoPrazo(prazoConferencia, real.conferido),
    situacaoPdf: situacaoPrazo(prazoPdf, real.pdf),
    situacaoEntrega: p.entrega_concluida ? { tipo: 'ok', texto: 'Montagem concluída' } : situacaoPrazo(fimPrevisto, real.entregue),
    situacaoAssistencia: c.tem_att && c.assistencia_retorno_max ? situacaoPrazo(dia(c.assistencia_retorno_max), dia(c.assistencia_concluida_em)) : null,
    diasDesdeVenda: real.venda ? diasEntre(real.venda, p.entrega_concluida ? real.concluido || hoje : hoje) : null,
    diasAtePrazo,
    documentos: (p.documentos || []).map((d) => ({ ...d, categoriaNome: CATEGORIAS.find((x) => x.id === d.categoria)?.nome || 'Outros' })),
  }
}

// Linha da lista de vários clientes
export function linhaLista(p, c = {}) {
  const r = montarRelatorio(p, c)
  const atraso = [r.situacaoConferencia, r.situacaoPdf, r.situacaoEntrega].some((s) => s.vencido)
  return {
    id: p.id,
    codigo: p.codigo,
    cliente: p.cliente_nome,
    ambientes: p.ambientes,
    etapa: r.concluido ? 'Montagem concluída' : r.atual.nome,
    progresso: r.progresso,
    venda: r.real.venda,
    medicao: r.real.medicao,
    liberador: c.liberador || '',
    prazoConferencia: r.prazoConferencia,
    conferido: r.real.conferido,
    prazoPdf: r.prazoPdf,
    pdf: r.real.pdf,
    assinado: r.real.assinado,
    entregue: r.real.entregue,
    montador: c.montador || '',
    prazoMaximo: p.data_entrega_prevista,
    situacao: r.situacaoEntrega,
    atraso,
  }
}

export const COLUNAS_LISTA = [
  ['codigo', 'Código'], ['cliente', 'Cliente'], ['etapa', 'Etapa atual'], ['progresso', 'Progresso'], ['venda', 'Venda', 'data'],
  ['medicao', 'Medição', 'data'], ['liberador', 'Liberador'], ['prazoConferencia', 'Prazo conferência', 'data'], ['conferido', 'Conferido', 'data'],
  ['prazoPdf', 'Prazo PDF', 'data'], ['pdf', 'PDF recebido', 'data'], ['assinado', 'Proj. final assinado', 'data'],
  ['entregue', 'Entregue', 'data'], ['montador', 'Montador'], ['prazoMaximo', 'Prazo máximo', 'data'], ['situacao', 'Situação'],
]

export function valorColuna(l, [k, , tipo], formatoData = dataCurta) {
  if (k === 'progresso') return `${l.progresso}%`
  if (k === 'situacao') return l.situacao.texto
  return tipo === 'data' ? formatoData(l[k]) : l[k] || '—'
}

// Planilha (CSV com ; para abrir direto no Excel em português)
export function csvLista(linhas) {
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const cab = COLUNAS_LISTA.map(([, t]) => esc(t)).join(';')
  const corpo = linhas.map((l) => COLUNAS_LISTA.map((col) => esc(valorColuna(l, col).replace(/^—$/, ''))).join(';'))
  return '﻿' + [cab, ...corpo].join('\r\n')
}

export function baixarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export const nomeArquivo = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase()

// O PDF só aceita JPG/PNG: converte qualquer imagem (webp, svg…) em JPEG pelo canvas
// Desenhos vetoriais (SVG) são ampliados até o tamanho máximo para sair nítidos.
export function imagemParaJpeg(src, max = 1600, vetor = /^data:image\/svg|\.svg(\?|$)/i.test(src)) {
  return new Promise((ok) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const k = Math.min(vetor ? Infinity : 1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max))
        const w = Math.round((img.naturalWidth || max) * k)
        const h = Math.round((img.naturalHeight || max * 0.66) * k)
        const cv = document.createElement('canvas')
        cv.width = w
        cv.height = h
        const ctx = cv.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        ok({ src: cv.toDataURL('image/jpeg', 0.86), w, h })
      } catch {
        ok(null)
      }
    }
    img.onerror = () => ok(null)
    img.src = src
  })
}
