import { useState } from 'react'
import { formatarData, diasAte } from '../lib/constants.js'
import { useRevelar } from '../lib/movimento.js'
import IconeCubo from './IconeCubo.jsx'

// O que cada etapa significa, na linguagem do cliente.
const SOBRE = {
  financeiro: 'Análise e aprovação do crédito, em até 5 dias úteis. Os prazos começam a contar quando não há pendências financeiras.',
  projeto_inicial: 'A representação dos seus móveis com as especificações combinadas. O PDF fica em Documentos.',
  medicao: 'Nossa equipe mede cada ambiente no imóvel, em até 10 dias após o agendamento, para tudo encaixar com precisão.',
  conferencia: 'Revisamos com você medidas, cores, acabamentos e ferragens. Envie as medidas dos eletrodomésticos que serão embutidos até 5 dias antes da assinatura.',
  assinatura_projeto: 'Você assina o PDF do projeto final aqui pelo portal. A contagem de 45 dias úteis para a entrega começa no 2º dia útil após a assinatura.',
  producao: 'Seus móveis estão sendo fabricados.',
  entrega: 'Entregamos de segunda a sexta, em horário comercial. A montagem começa em até 7 dias úteis após a entrega e termina em até 10 dias úteis. Deixe o local livre, exceto os eletrodomésticos que serão embutidos. No final, você assina o Termo de Vistoria.',
}

const tracos = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
const ICONES = {
  projeto_inicial: <><path d="M7 3h7l4 4v14H7z" {...tracos} /><path d="M14 3v4h4M10 12h5M10 16h3" {...tracos} /></>,
  financeiro: <><rect x="3" y="6" width="18" height="12" rx="2" {...tracos} /><path d="M3 10h18M7 15h3" {...tracos} /></>,
  medicao: <><path d="m3 17 14-14 4 4L7 21z" {...tracos} /><path d="m7 13 2 2M10 10l2 2M13 7l2 2" {...tracos} /></>,
  conferencia: <><circle cx="11" cy="11" r="6" {...tracos} /><path d="m20 20-4.5-4.5M8.5 11l1.8 1.8 3.2-3.3" {...tracos} /></>,
  assinatura_projeto: <><path d="M4 20c3-1 4-4 6-4s1 3 3 3 3-2 4-2" {...tracos} /><path d="m14 4 6 6-7 7-4 1 1-4z" {...tracos} /></>,
  entrega: <><path d="M3 11 12 4l9 7v9H3z" {...tracos} /><path d="M9 20v-6h6v6" {...tracos} /></>,
}

function Icone({ etapa }) {
  if (etapa.producao) return <IconeCubo carregando={etapa.status === 'atual'} />
  if (etapa.status === 'concluida') return <svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" {...tracos} strokeWidth="2.4" /></svg>
  return <svg viewBox="0 0 24 24">{ICONES[etapa.id]}</svg>
}

function textoStatus(e) {
  if (e.producao && e.status === 'atual') return 'Em fabricação'
  if (e.atrasada) return 'Atrasada'
  return { concluida: 'Concluída', atual: 'Etapa atual', futura: 'Próxima' }[e.status]
}

function Detalhe({ etapa, numero, total }) {
  const d = diasAte(etapa.data)
  let quando = null
  if (etapa.producao) quando = null
  else if (etapa.status === 'concluida' && etapa.data) quando = `Concluída em ${formatarData(etapa.data)}`
  else if (etapa.data) quando = d > 0 ? `${formatarData(etapa.data)} · em ${d} ${d === 1 ? 'dia' : 'dias'}` : d === 0 ? `Hoje, ${formatarData(etapa.data)}` : `Previsto para ${formatarData(etapa.data)}`
  else if (!etapa.semData && etapa.status !== 'concluida') quando = 'Data a definir'
  return (
    <div className={`jd jd-${etapa.status} ${etapa.atrasada ? 'jd-atrasada' : ''}`}>
      <span className="jd-numero num">{String(numero).padStart(2, '0')}<small>/{String(total).padStart(2, '0')}</small></span>
      <div className="jd-texto">
        <span className={`jd-status`}>{textoStatus(etapa)}</span>
        <h3>{etapa.nome}</h3>
        {quando && <p className="jd-quando num">{quando}</p>}
        {etapa.detalhe && etapa.status !== 'concluida' && <p className="jd-quando">{etapa.detalhe}</p>}
        <p className="jd-sobre">{SOBRE[etapa.id]}</p>
        {etapa.producao && etapa.status === 'atual' && <div className="producao-barra"><span /></div>}
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
  const [ref, visivel] = useRevelar()
  const fim = tudoFeito ? etapas.length - 1 : iAtual
  const progresso = etapas.length > 1 ? fim / (etapas.length - 1) : 0

  function teclado(e) {
    const mov = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!mov) return
    e.preventDefault()
    const n = Math.min(etapas.length - 1, Math.max(0, sel + mov))
    setSel(n)
    document.getElementById(`etapa-${etapas[n].id}`)?.focus()
  }

  return (
    <section className={`jornada ${visivel ? 'visivel' : ''}`} ref={ref} style={{ '--progresso': progresso, '--n': etapas.length }}>
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
              tabIndex={sel === i ? 0 : -1} onClick={() => setSel(i)} className="jn-botao">
              <span className="jn-icone"><Icone etapa={e} /></span>
              <span className="jn-nome">{e.nome}</span>
              <span className="jn-data num">{e.producao ? textoStatus(e) : e.data ? formatarData(e.data) : textoStatus(e)}</span>
            </button>
            {sel === i && (
              <div className="jn-detalhe-mobile">
                <Detalhe etapa={e} numero={i + 1} total={etapas.length} />
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="jornada-painel" id="jornada-painel" role="tabpanel" key={sel}>
        <Detalhe etapa={etapas[sel]} numero={sel + 1} total={etapas.length} />
      </div>
    </section>
  )
}
