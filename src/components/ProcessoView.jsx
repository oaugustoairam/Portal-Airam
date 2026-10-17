import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import {
  linhaDoTempo,
  etapaAtual,
  progresso,
  diasAte,
  formatarData,
  ROTULO_PRAZO,
} from '../lib/constants.js'
import { FOTOS, fotoDoProcesso } from '../lib/fotos.js'
import { useContador } from '../lib/movimento.js'
import { WHATSAPP_AIRAM, linkWhatsApp } from '../lib/contato.js'
import AssinaturaModal from './AssinaturaModal.jsx'
import Jornada from './Jornada.jsx'
import AvancoEtapa from './AvancoEtapa.jsx'
import ContagemObra from './ContagemObra.jsx'
import Garantia from './Garantia.jsx'

// Baixa o arquivo de verdade (o atributo download não vale para links de outro domínio)
const EXT_MIME = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export function nomeComExtensao(doc) {
  const base = String(doc.titulo || 'arquivo').replace(/[\\/:*?"<>|]+/g, '-').trim()
  const ext = EXT_MIME[doc.tipo_mime] || (doc.arquivo_path?.startsWith('data:') ? null : doc.arquivo_path?.split('.').pop())
  return ext && !base.toLowerCase().endsWith('.' + ext.toLowerCase()) ? `${base}.${ext}` : base
}
async function blobDoDocumento(doc) {
  const r = await fetch(await api.urlDocumento(doc))
  if (!r.ok) throw new Error('Não foi possível baixar o arquivo.')
  return r.blob()
}
export async function baixarDocumento(doc) {
  const blob = await blobDoDocumento(doc)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nomeComExtensao(doc)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
async function baixarTodos(docs, nomeZip) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const usados = new Set()
  for (const d of docs) {
    let nome = nomeComExtensao(d)
    for (let n = 2; usados.has(nome); n++) nome = nomeComExtensao(d).replace(/(\.\w+)?$/, ` (${n})$1`)
    usados.add(nome)
    zip.file(nome, await blobDoDocumento(d))
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nomeZip
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

function BotaoBaixar({ doc, rotulo = 'Baixar', className = 'btn btn-contorno', docs, nomeZip }) {
  const [estado, setEstado] = useState('')
  async function baixar(e) {
    e.stopPropagation()
    setEstado('baixando')
    try {
      await (docs ? baixarTodos(docs, nomeZip) : baixarDocumento(doc))
      setEstado('')
    } catch {
      setEstado('erro')
      setTimeout(() => setEstado(''), 3000)
    }
  }
  return (
    <button type="button" className={className} onClick={baixar} disabled={estado === 'baixando'}>
      {estado === 'baixando' ? 'Baixando…' : estado === 'erro' ? 'Tente de novo' : rotulo}
    </button>
  )
}

const NOME_ASSINATURA = { contrato: 'Seu contrato', projeto_final: 'O PDF do seu projeto final' }

// O que o cliente vê. A equipe usa a mesma tela em "Ver como cliente" (visualizacao = true).
export default function ProcessoView({ processo, onAtualizar, visualizacao, secao = 'processo' }) {
  const { documentos = [], assinaturas = [] } = processo
  const etapas = linhaDoTempo(processo, assinaturas, { cliente: true })
  const pendenciaFinanceira = processo.solucao_financeira !== 'ok'
  const pendentes = assinaturas.filter((a) => a.status === 'pendente')
  const [assinando, setAssinando] = useState(null)

  const modalAssinatura = assinando && (
    <AssinaturaModal
      assinatura={assinando}
      documento={documentos.find((d) => d.id === assinando.documento_id)}
      nomeCliente={processo.cliente_nome}
      onFechar={() => setAssinando(null)}
      onAssinado={() => {
        setAssinando(null)
        onAtualizar?.()
      }}
    />
  )

  // abas de documentos: Contrato, Projeto inicial, Renders, Projeto final
  if (ABAS_DOCUMENTOS[secao]) {
    const aba = ABAS_DOCUMENTOS[secao]
    const assinar = secao === 'projeto_final' ? pendentes.filter((a) => a.tipo === 'projeto_final') : []
    return (
      <article className="processo processo-docs">
        <header className="docs-cab">
          <span className="rotulo">Código do cliente {processo.codigo}</span>
          <h1 className="titulo-grande">{aba.titulo}</h1>
          <p className="docs-cab-texto">{aba.texto}</p>
        </header>
        {assinar.map((a) => (
          <CartaoAssinar key={a.id} assinatura={a} visualizacao={visualizacao} onAssinar={() => setAssinando(a)} />
        ))}
        <DocumentosCategoria documentos={documentos} categoria={secao} />
        {/* a jornada acompanha o cliente em todas as abas, para a tela nunca ficar vazia */}
        <Jornada etapas={etapas} />
        {modalAssinatura}
      </article>
    )
  }

  return (
    <article className="processo">
      <Hero processo={processo} etapas={etapas} documentos={documentos} />
      {!visualizacao && <AvancoEtapa processoId={processo.id} etapas={etapas} />}

      {(processo.recado_cliente || pendentes.length > 0 || pendenciaFinanceira) && (
        <div className="avisos-topo">
          {pendenciaFinanceira && (
            <div className="lembrete-financeiro" role="status">
              <span className="lembrete-financeiro-icone" aria-hidden="true">
                <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M3 10h18M7 15h3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
              </span>
              <div>
                <strong>Existe uma pendência financeira</strong>
                <span>Para seguirmos com o seu projeto, falta resolver a solução financeira. Os prazos do contrato começam a contar quando não houver pendências.</span>
              </div>
              <a className="btn btn-contorno" target="_blank" rel="noreferrer"
                href={linkWhatsApp(WHATSAPP_AIRAM, `Olá! Sou ${processo.cliente_nome} (código ${processo.codigo}) e quero resolver a pendência financeira.`)}>
                Falar com a Airam
              </a>
            </div>
          )}
          {pendentes.map((a) => (
            <CartaoAssinar key={a.id} assinatura={a} visualizacao={visualizacao} onAssinar={() => setAssinando(a)} />
          ))}
          {processo.recado_cliente && (
            <figure className="recado">
              <blockquote>{processo.recado_cliente}</blockquote>
              <figcaption>Equipe Airam</figcaption>
            </figure>
          )}
        </div>
      )}

      {processo.tipo_prazo === 'futuro' && !processo.medicao_concluida && processo.data_disponivel_medicao && (
        <ContagemObra dataVenda={processo.data_venda} dataPronto={processo.data_disponivel_medicao} />
      )}

      <Jornada etapas={etapas} />

      <Garantia montagemEm={processo.entrega_concluida ? processo.montagem_concluida_em : null} />

      {modalAssinatura}
    </article>
  )
}

// ---------------------------------------------------------------- Topo com foto e progresso
function Hero({ processo, etapas, documentos }) {
  const fundos = useFundos(documentos, processo.ambientes)
  const fundoAtual = useAlternar(fundos.length, 6000)
  const pct = progresso(etapas)
  const atual = etapaAtual(etapas)
  const dias = diasAte(processo.data_entrega_prevista)
  // o tipo do contrato (normal / entrega futura) é interno: o cliente não vê
  const aguardandoImovel = processo.tipo_prazo === 'futuro' && diasAte(processo.data_disponivel_medicao) > 0 && !processo.medicao_concluida
  const [montado, setMontado] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setMontado(true))
    return () => cancelAnimationFrame(t)
  }, [])
  const pctAnimado = useContador(pct, montado)
  const diasAnimados = useContador(Math.max(0, dias ?? 0), montado, 1400)
  const C = 2 * Math.PI * 52

  return (
    <header className={`hero ${montado ? 'hero-pronto' : ''}`}>
      {fundos.map((src, i) => (
        <img key={src} className={`hero-foto ${i === fundoAtual ? 'ativa' : ''}`} src={src} alt="" aria-hidden="true"
          loading={i === 0 ? 'eager' : 'lazy'} />
      ))}
      <div className="hero-veu" />
      <div className="hero-in">
        <div className="hero-texto">
          <span className="hero-eyebrow">
            Código do cliente {processo.codigo}
            {processo.numero_contrato && <span className="hero-tag">Contrato {processo.numero_contrato}</span>}
          </span>
          <h1 className="hero-nome">{processo.cliente_nome}</h1>
          {processo.ambientes && <p className="hero-amb">{processo.ambientes}</p>}
        </div>
        <div className="hero-numeros">
          <div className="anel" role="img" aria-label={`${pct}% concluído`}>
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" className="anel-fundo" />
              <circle cx="60" cy="60" r="52" className="anel-cheio"
                style={{ strokeDasharray: C, strokeDashoffset: montado ? C * (1 - pct / 100) : C }} />
            </svg>
            <span className="anel-valor num">{pctAnimado}<small>%</small></span>
          </div>
          <dl className="hero-dados">
            <div>
              <dt>Etapa atual</dt>
              <dd>{processo.entrega_concluida ? 'Montagem concluída' : aguardandoImovel && atual.id !== 'projeto_inicial' ? 'Aguardando o imóvel ficar pronto' : atual.nome}</dd>
            </div>
            <div>
              <dt>{ROTULO_PRAZO}</dt>
              <dd className="num">{formatarData(processo.data_entrega_prevista)}</dd>
            </div>
            {!processo.entrega_concluida && dias !== null && (
              <div className={dias < 0 ? 'hero-atraso' : ''}>
                <dt>{dias < 0 ? 'Atraso' : 'Faltam'}</dt>
                <dd className="num hero-dias">{dias < 0 ? -dias : diasAnimados}<small> {Math.abs(dias) === 1 ? 'dia' : 'dias'}</small></dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </header>
  )
}

function CartaoAssinar({ assinatura: a, visualizacao, onAssinar }) {
  return (
    <div className="cartao-assinar">
      <span className="cartao-assinar-icone" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 20c3-1 4-4 6-4s1 3 3 3 3-2 4-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="m14 4 6 6-7 7-4 1 1-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
      </span>
      <div>
        <strong>{NOME_ASSINATURA[a.tipo]} está pronto para assinatura</strong>
        <span>Confira e assine aqui mesmo pelo portal. Leva menos de 2 minutos.</span>
      </div>
      <button className="btn btn-principal" disabled={visualizacao} onClick={onAssinar}
        title={visualizacao ? 'Disponível só para o cliente' : undefined}>
        Assinar agora
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- Documentos (uma aba por tipo)
export const ABAS_DOCUMENTOS = {
  contrato: { titulo: 'Contrato', texto: 'Seu contrato assinado com a Airam.', vazio: 'O contrato assinado aparece aqui assim que a Airam anexar.' },
  projeto_inicial: { titulo: 'Projeto inicial', texto: 'A representação dos seus móveis com as especificações combinadas na venda.', vazio: 'O projeto inicial aparece aqui assim que estiver pronto.' },
  render: { titulo: 'Renders', texto: 'As imagens do seu projeto. Toque em uma imagem para ampliar.', vazio: 'Os renders do seu projeto aparecem aqui.' },
  projeto_final: { titulo: 'Projeto final', texto: 'O projeto final executivo dos seus móveis. Quando estiver pronto, você assina por aqui.', vazio: 'O projeto final aparece aqui depois da conferência.' },
}

function DocumentosCategoria({ documentos, categoria }) {
  const [aberto, setAberto] = useState(null)
  const lista = documentos
    .filter((d) => d.categoria === categoria)
    .sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''))
  const imagens = lista.filter((d) => d.tipo_mime?.startsWith('image/'))
  const outros = categoria === 'contrato' ? documentos.filter((d) => d.categoria === 'outro') : []

  return (
    <section className="bloco documentos">
      {!lista.length && <p className="vazio">{ABAS_DOCUMENTOS[categoria].vazio}</p>}
      {lista.length > 0 && (categoria === 'render' ? (
        <>
          {lista.length > 1 && (
            <div className="baixar-todos">
              <span>{lista.length} renders</span>
              <BotaoBaixar docs={lista} nomeZip="renders-airam.zip" rotulo="Baixar todos (.zip)" />
            </div>
          )}
          <Carrossel itens={lista} onAbrir={(i) => setAberto(i)} />
        </>
      ) : (
        <ul className="docs">
          {lista.map((d, i) => <LinhaDoc key={d.id} doc={d} indice={i} />)}
        </ul>
      ))}
      {outros.length > 0 && (
        <>
          <h2 className="titulo-secao">Outros documentos</h2>
          <ul className="docs">{outros.map((d, i) => <LinhaDoc key={d.id} doc={d} indice={i} />)}</ul>
        </>
      )}
      {aberto !== null && imagens.length > 0 && (
        <Visualizador itens={imagens} inicio={Math.min(aberto, imagens.length - 1)} onFechar={() => setAberto(null)} />
      )}
    </section>
  )
}

function Carrossel({ itens, onAbrir }) {
  const trilho = useRef(null)
  const [pos, setPos] = useState(0)
  const rolar = (dir) => {
    const el = trilho.current
    el?.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }
  const aoRolar = () => {
    const el = trilho.current
    if (!el) return
    const largura = el.firstElementChild?.getBoundingClientRect().width || 1
    setPos(Math.round(el.scrollLeft / largura))
  }
  return (
    <div className="carrossel">
      <div className="carrossel-trilho" ref={trilho} onScroll={aoRolar}>
        {itens.map((d, i) => (
          <Slide key={d.id} doc={d} onAbrir={() => onAbrir(i)} />
        ))}
      </div>
      {itens.length > 1 && (
        <div className="carrossel-controles">
          <button className="carrossel-seta" onClick={() => rolar(-1)} aria-label="Anterior" disabled={pos <= 0}>‹</button>
          <span className="carrossel-pontos" aria-hidden="true">
            {itens.map((_, i) => <span key={i} className={i === pos ? 'ativo' : ''} />)}
          </span>
          <button className="carrossel-seta" onClick={() => rolar(1)} aria-label="Próximo" disabled={pos >= itens.length - 1}>›</button>
        </div>
      )}
    </div>
  )
}

function Slide({ doc, onAbrir }) {
  const url = useUrl(doc)
  return (
    <div className="slide">
      <button type="button" className="slide-img" onClick={onAbrir} aria-label={`Ampliar ${doc.titulo}`}>
        {url && doc.tipo_mime?.startsWith('image/') ? <img src={url} alt={doc.titulo} loading="lazy" /> : <span>{extensao(doc)}</span>}
      </button>
      <span className="slide-legenda">
        <span>
          <strong>{doc.titulo}</strong>
          <span>Toque na imagem para ampliar</span>
        </span>
        <BotaoBaixar doc={doc} className="btn btn-leve slide-baixar" />
      </span>
    </div>
  )
}

// Fundos do topo: os renders do cliente; sem render, as fotos de ambientes da loja
// (começando pela que combina com os ambientes do processo).
function useFundos(documentos, ambientes) {
  const renders = documentos.filter((d) => d.categoria === 'render' && d.tipo_mime?.startsWith('image/'))
  const chave = renders.map((d) => d.id).join(',')
  const [urls, setUrls] = useState([])
  useEffect(() => {
    let vivo = true
    setUrls([])
    Promise.all(renders.map((d) => api.urlDocumento(d).catch(() => null)))
      .then((lista) => vivo && setUrls(lista.filter(Boolean)))
    return () => (vivo = false)
  }, [chave])
  if (urls.length) return urls
  const primeira = fotoDoProcesso(ambientes || '').src
  return [primeira, ...FOTOS.map((f) => f.src).filter((src) => src !== primeira)]
}

// Índice que avança sozinho; parado para quem pede menos movimento no aparelho
function useAlternar(total, intervalo) {
  const [i, setI] = useState(0)
  useEffect(() => {
    setI(0)
    if (total < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((x) => (x + 1) % total), intervalo)
    return () => clearInterval(t)
  }, [total, intervalo])
  return i
}

function useUrlOpcional(doc) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!doc) return setUrl(null)
    let vivo = true
    api.urlDocumento(doc).then((u) => vivo && setUrl(u)).catch(() => {})
    return () => (vivo = false)
  }, [doc?.id])
  return url
}

export function useUrl(doc) {
  return useUrlOpcional(doc)
}

export function LinhaDoc({ doc, acoes, indice = 0 }) {
  const url = useUrl(doc)
  return (
    <li className="doc" style={{ '--i': indice }}>
      <span className="doc-tipo">{extensao(doc)}</span>
      <div className="doc-info">
        <span className="doc-titulo">
          {doc.titulo}
          {doc.assinado && <span className="chip chip-concluida chip-mini">Assinado</span>}
        </span>
        <span className="doc-data num">Enviado em {formatarData(doc.criado_em?.slice(0, 10))}</span>
      </div>
      <span className="doc-botoes">
        {abreNoNavegador(doc) && <a className="btn btn-leve" href={url || '#'} target="_blank" rel="noreferrer" aria-disabled={!url}>Abrir</a>}
        <BotaoBaixar doc={doc} />
      </span>
      {acoes}
    </li>
  )
}

// Ampliação das imagens: setas, teclado e arrastar com o dedo.
function Visualizador({ itens, inicio, onFechar }) {
  const [i, setI] = useState(inicio)
  const doc = itens[i]
  const url = useUrl(doc)
  const toque = useRef(null)
  const ir = (d) => setI((x) => (x + d + itens.length) % itens.length)

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'Escape') onFechar()
      if (e.key === 'ArrowRight') ir(1)
      if (e.key === 'ArrowLeft') ir(-1)
    }
    window.addEventListener('keydown', tecla)
    const corpo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = corpo
    }
  }, [])

  return (
    <div className="lightbox" role="dialog" aria-label={doc.titulo} onClick={onFechar}
      onPointerDown={(e) => (toque.current = e.clientX)}
      onPointerUp={(e) => {
        if (toque.current === null) return
        const dx = e.clientX - toque.current
        toque.current = null
        if (Math.abs(dx) > 50) ir(dx < 0 ? 1 : -1)
      }}>
      <figure className="lightbox-fig" onClick={(e) => e.stopPropagation()} key={doc.id}>
        {url && <img src={url} alt={doc.titulo} draggable="false" />}
        <figcaption>
          <span><span className="num">{i + 1}/{itens.length}</span> · {doc.titulo}</span>
          <span className="modal-acoes">
            {url && <a className="btn btn-leve" href={url} target="_blank" rel="noreferrer">Abrir original</a>}
            <BotaoBaixar doc={doc} className="btn btn-leve" />
          </span>
        </figcaption>
      </figure>
      {itens.length > 1 && (
        <>
          <button className="lightbox-seta esquerda" aria-label="Anterior" onClick={(e) => { e.stopPropagation(); ir(-1) }}>‹</button>
          <button className="lightbox-seta direita" aria-label="Próxima" onClick={(e) => { e.stopPropagation(); ir(1) }}>›</button>
        </>
      )}
      <button className="lightbox-fechar" aria-label="Fechar" onClick={onFechar}>×</button>
    </div>
  )
}

export function extensao(doc) {
  const m = doc.tipo_mime || ''
  if (m.includes('pdf')) return 'PDF'
  if (m.startsWith('image/')) return 'IMG'
  const ext = (doc.arquivo_path?.startsWith('data:') ? doc.titulo : doc.arquivo_path)?.toLowerCase().match(/\.(dwg|promob|zip|docx)$/)?.[1]
  if (ext) return ext === 'promob' ? 'PROMOB' : ext.toUpperCase()
  if (m.includes('zip')) return 'ZIP'
  if (m.includes('wordprocessingml')) return 'DOCX'
  return 'DOC'
}

// PDF e imagens abrem no navegador; Promob, DWG, ZIP e DOCX são baixados
const abreNoNavegador = (doc) => /pdf|^image\//.test(doc.tipo_mime || '')
