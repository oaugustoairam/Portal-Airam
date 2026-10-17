import { useState } from 'react'
import { formatarData, diasAte, diasEntre, hojeISO } from '../lib/constants.js'
import { useRevelar } from '../lib/movimento.js'
import IconeCubo from './IconeCubo.jsx'

// O que acontece em cada etapa e o que o cliente precisa fazer, na linguagem do cliente
// (escopo do contrato Airam).
export const GUIA = {
  compra: {
    acontece: 'Você fechou o seu projeto com a Airam. A partir daqui, acompanhamos com você cada passo até a montagem.',
    voce: [],
  },
  financeiro: {
    acontece: 'Analisamos e aprovamos a sua solução financeira em até 5 dias úteis. Os prazos do contrato começam a contar quando não há pendências financeiras.',
    voce: ['Envie os documentos que a equipe financeira pedir', 'Acompanhe seu e-mail e WhatsApp'],
  },
  projeto_inicial: {
    acontece: 'Preparamos a representação dos seus móveis com as especificações combinadas na venda.',
    voce: ['Confira o projeto inicial em Documentos', 'Anote as dúvidas para a medição'],
  },
  medicao: {
    acontece: 'Nossa equipe mede cada ambiente no imóvel, em até 10 dias após o agendamento, para tudo encaixar com precisão.',
    voce: ['Garanta o acesso ao imóvel na data agendada', 'Avise a Airam se algo mudou no imóvel'],
  },
  conferencia: {
    acontece: 'Revisamos com você medidas, cores, acabamentos e ferragens do projeto final.',
    voce: ['Revise o projeto com atenção', 'Envie as medidas dos eletrodomésticos embutidos até 5 dias antes da assinatura'],
  },
  assinatura_projeto: {
    acontece: 'Você assina o PDF do projeto final aqui pelo portal. A contagem de 45 dias úteis para a entrega começa no 2º dia útil após a assinatura.',
    voce: ['Leia o PDF do projeto final', 'Assine pelo portal, com o código enviado ao seu e-mail'],
  },
  producao: {
    acontece: 'Seus móveis estão sendo fabricados exatamente como no projeto que você assinou.',
    voce: [],
  },
  entrega: {
    acontece: 'Entregamos de segunda a sexta, em horário comercial. A montagem começa em até 7 dias úteis após a entrega e termina em até 10 dias úteis.',
    voce: ['Deixe o local livre, exceto os eletrodomésticos que serão embutidos', 'No final, assine o Termo de Vistoria'],
  },
}

const tracos = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
const ICONES = {
  projeto_inicial: <><path d="M7 3h7l4 4v14H7z" {...tracos} /><path d="M14 3v4h4M10 12h5M10 16h3" {...tracos} /></>,
  financeiro: <><rect x="3" y="6" width="18" height="12" rx="2" {...tracos} /><path d="M3 10h18M7 15h3" {...tracos} /></>,
  compra: <><path d="M5 8h14l-1 12H6z" {...tracos} /><path d="M9 8V6a3 3 0 0 1 6 0v2" {...tracos} /></>,
  medicao: <><path d="m3 17 14-14 4 4L7 21z" {...tracos} /><path d="m7 13 2 2M10 10l2 2M13 7l2 2" {...tracos} /></>,
  conferencia: <><circle cx="11" cy="11" r="6" {...tracos} /><path d="m20 20-4.5-4.5M8.5 11l1.8 1.8 3.2-3.3" {...tracos} /></>,
  assinatura_projeto: <><path d="M4 20c3-1 4-4 6-4s1 3 3 3 3-2 4-2" {...tracos} /><path d="m14 4 6 6-7 7-4 1 1-4z" {...tracos} /></>,
  entrega: <><path d="M3 11 12 4l9 7v9H3z" {...tracos} /><path d="M9 20v-6h6v6" {...tracos} /></>,
}

// Ícone da etapa; "simbolo" mostra o desenho da etapa mesmo quando ela está concluída
export function Icone({ etapa, simbolo = false }) {
  if (etapa.producao) return <IconeCubo carregando={etapa.status === 'atual'} />
  if (etapa.status === 'concluida' && !simbolo) return <svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" {...tracos} strokeWidth="2.4" /></svg>
  return <svg viewBox="0 0 24 24">{ICONES[etapa.id]}</svg>
}

const Marca = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" {...tracos} strokeWidth="2.2" /></svg>

function textoStatus(e) {
  if (e.producao && e.status === 'atual') return 'Em fabricação'
  if (e.atrasada) return 'Atrasada'
  return { concluida: 'Concluída', atual: 'Etapa atual', futura: 'Próxima' }[e.status]
}

export function quandoEtapa(etapa) {
  const d = diasAte(etapa.data)
  if (etapa.producao) return null
  if (etapa.id === 'compra') return etapa.data ? `Compra em ${formatarData(etapa.data)}` : null
  if (etapa.status === 'concluida' && etapa.data) return `Concluída em ${formatarData(etapa.data)}`
  if (etapa.data) return d > 0 ? `${formatarData(etapa.data)} · em ${d} ${d === 1 ? 'dia' : 'dias'}` : d === 0 ? `Hoje, ${formatarData(etapa.data)}` : `Previsto para ${formatarData(etapa.data)}`
  if (!etapa.semData && etapa.status !== 'concluida') return 'Data a definir'
  return null
}

// Quanto do caminho até a data prevista já passou (só para a etapa atual)
function andamento(etapas, i) {
  const e = etapas[i]
  if (e.status !== 'atual' || !e.data) return null
  const inicio = [...etapas.slice(0, i)].reverse().find((x) => x.status === 'concluida' && x.data)?.data
  if (!inicio) return null
  const total = diasEntre(inicio, e.data)
  if (!total || total <= 0) return null
  const passou = Math.min(total, Math.max(0, diasEntre(inicio, hojeISO())))
  return { pct: Math.round((passou / total) * 100), passou, total }
}

function Detalhe({ etapas, i, onIr }) {
  const etapa = etapas[i]
  const guia = GUIA[etapa.id] || { acontece: '', voce: [] }
  const quando = quandoEtapa(etapa)
  const passo = andamento(etapas, i)
  const anterior = etapas[i - 1]
  const proxima = etapas[i + 1]
  const feito = etapa.status === 'concluida'

  return (
    <div className={`jd jd-${etapa.status} ${etapa.atrasada ? 'jd-atrasada' : ''}`}>
      <span className="jd-numero num">{String(i + 1).padStart(2, '0')}<small>/{String(etapas.length).padStart(2, '0')}</small></span>
      <div className="jd-texto">
        <span className="jd-status">{textoStatus(etapa)}</span>
        <h3>{etapa.nome}</h3>
        {quando && <p className="jd-quando num">{quando}</p>}
        {etapa.detalhe && !feito && <p className="jd-quando">{etapa.detalhe}</p>}

        {passo && (
          <div className="jd-andamento" role="img" aria-label={`${passo.passou} de ${passo.total} dias até a data prevista`}>
            <span className="jd-andamento-barra"><span style={{ '--pct': `${passo.pct}%` }} /></span>
            <span className="jd-andamento-texto num">Dia {passo.passou} de {passo.total} até a data prevista</span>
          </div>
        )}
        {etapa.producao && etapa.status === 'atual' && <div className="producao-barra"><span /></div>}

        <div className="jd-blocos">
          <div className="jd-bloco">
            <span className="jd-bloco-titulo">{feito ? 'O que foi feito' : 'Nesta etapa'}</span>
            <p className="jd-sobre">{guia.acontece}</p>
          </div>
          {!feito && (
            <div className="jd-bloco">
              <span className="jd-bloco-titulo">Com você</span>
              {guia.voce.length ? (
                <ul className="jd-lista">
                  {guia.voce.map((t) => <li key={t}><Marca />{t}</li>)}
                </ul>
              ) : (
                <p className="jd-sobre">Nada a fazer agora. Avisamos você por e-mail e WhatsApp quando a entrega for agendada.</p>
              )}
            </div>
          )}
        </div>

        <nav className="jd-nav" aria-label="Navegar entre as etapas">
          <button type="button" className="jd-nav-btn" onClick={() => onIr(i - 1)} disabled={!anterior}>
            <span aria-hidden="true">←</span><span className="jd-nav-txt"><small>Anterior</small>{anterior?.nome || '—'}</span>
          </button>
          <button type="button" className="jd-nav-btn jd-nav-prox" onClick={() => onIr(i + 1)} disabled={!proxima}>
            <span className="jd-nav-txt"><small>Próxima</small>{proxima?.nome || '—'}</span><span aria-hidden="true">→</span>
          </button>
        </nav>
      </div>
    </div>
  )
}

// Linha do tempo interativa: no computador, trilha horizontal com painel de detalhes;
// no celular, trilha vertical e o detalhe abre embaixo da etapa tocada.
export default function Jornada({ etapas }) {
  const iAtual = Math.max(0, etapas.findIndex((e) => e.status === 'atual'))
  const tudoFeito = etapas.every((e) => e.status === 'concluida')
  const [sel, setSel] = useState(tudoFeito ? etapas.length - 1 : iAtual)
  const [dir, setDir] = useState(0)
  const [ref, visivel] = useRevelar()
  const fim = tudoFeito ? etapas.length - 1 : iAtual
  const progresso = etapas.length > 1 ? fim / (etapas.length - 1) : 0

  function ir(n, focar = false) {
    if (n < 0 || n >= etapas.length || n === sel) return
    setDir(n > sel ? 1 : -1)
    setSel(n)
    if (focar) document.getElementById(`etapa-${etapas[n].id}`)?.focus()
    // no celular, leva a etapa escolhida para a tela
    if (window.matchMedia?.('(max-width: 760px)').matches)
      requestAnimationFrame(() => document.getElementById(`etapa-${etapas[n].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function teclado(e) {
    const mov = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!mov || !e.target.closest('.jn-botao')) return
    e.preventDefault()
    ir(Math.min(etapas.length - 1, Math.max(0, sel + mov)), true)
  }

  const classeDir = dir > 0 ? 'dir-avanca' : dir < 0 ? 'dir-volta' : ''

  return (
    <section className={`jornada ${visivel ? 'visivel' : ''}`} ref={ref} style={{ '--progresso': progresso, '--n': etapas.length }} id="jornada">
      <div className="jornada-cab">
        <h2 className="titulo-secao">Sua jornada</h2>
        <span className="jornada-dica">Toque em uma etapa para ver os detalhes</span>
      </div>
      <ol className="jornada-trilha" role="tablist" aria-label="Etapas do processo" onKeyDown={teclado}>
        <span className="jornada-linha" aria-hidden="true"><span className="jornada-linha-cheia" /></span>
        {etapas.map((e, i) => (
          <li key={e.id} className={`jn jn-${e.status} ${e.atrasada ? 'jn-atrasada' : ''} ${e.producao && e.status === 'atual' ? 'jn-producao' : ''} ${sel === i ? 'jn-sel' : ''}`}
            style={{ '--i': i }}>
            <button id={`etapa-${e.id}`} role="tab" aria-selected={sel === i} aria-controls="jornada-painel"
              tabIndex={sel === i ? 0 : -1} onClick={() => ir(i)} className="jn-botao">
              <span className="jn-icone"><Icone etapa={e} /></span>
              <span className="jn-nome">{e.nome}</span>
              <span className="jn-data num">{e.producao ? textoStatus(e) : e.data ? formatarData(e.data) : textoStatus(e)}</span>
            </button>
            {sel === i && (
              <div className={`jn-detalhe-mobile ${classeDir}`}>
                <Detalhe etapas={etapas} i={i} onIr={(n) => ir(n)} />
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className={`jornada-painel ${classeDir}`} id="jornada-painel" role="tabpanel" key={sel}>
        <Detalhe etapas={etapas} i={sel} onIr={(n) => ir(n)} />
      </div>
    </section>
  )
}
