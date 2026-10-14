import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import {
  CATEGORIAS,
  STATUS,
  faseAtual,
  progresso,
  diasAte,
  formatarData,
  prazoTexto,
} from '../lib/constants.js'

// Tela que o cliente vê: fase atual, prazo, linha do tempo e documentos.
export default function ProjetoView({ projeto }) {
  const { fases, documentos = [] } = projeto
  const atual = faseAtual(fases)
  const pct = progresso(fases)
  const diasFinal = diasAte(projeto.prazo_final)
  const atrasado = diasFinal !== null && diasFinal < 0

  return (
    <article className="projeto">
      <header className="projeto-cab">
        <span className="rotulo">Projeto</span>
        <h1 className="titulo-grande">{projeto.nome}</h1>
        {projeto.endereco && <p className="projeto-end">{projeto.endereco}</p>}
        {projeto.descricao && <p className="projeto-desc">{projeto.descricao}</p>}
      </header>

      <section className="resumo">
        <div className="resumo-item">
          <span className="rotulo">Fase atual</span>
          <strong className="resumo-valor">{atual ? atual.nome : 'Fases ainda não definidas'}</strong>
          {atual && (
            <span className={`chip chip-${atual.status}`}>{STATUS[atual.status]}</span>
          )}
          {atual?.data_prevista && atual.status !== 'concluida' && (
            <span className="resumo-sub">
              Conclusão prevista: {formatarData(atual.data_prevista)}
            </span>
          )}
        </div>
        <div className="resumo-item">
          <span className="rotulo">Entrega final</span>
          <strong className="resumo-valor num">{formatarData(projeto.prazo_final)}</strong>
          <span className={`chip ${atrasado ? 'chip-atraso' : 'chip-neutro'}`}>
            {prazoTexto(projeto.prazo_final)}
          </span>
        </div>
        <div className="resumo-item">
          <span className="rotulo">Andamento</span>
          <strong className="resumo-valor num">{pct}%</strong>
          <div className="barra" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
            <div className="barra-cheia" style={{ width: pct + '%' }} />
          </div>
          <span className="resumo-sub">
            {fases.filter((f) => f.status === 'concluida').length} de {fases.length} fases concluídas
          </span>
        </div>
      </section>

      <section className="bloco">
        <h2 className="titulo-secao">Etapas do projeto</h2>
        <ol className="linha-tempo">
          {fases.map((f, i) => (
            <Fase key={f.id || i} fase={f} numero={i + 1} atual={atual?.id === f.id} />
          ))}
          {!fases.length && <p className="vazio">O escritório ainda vai cadastrar as etapas.</p>}
        </ol>
      </section>

      <Documentos documentos={documentos} />
    </article>
  )
}

function Fase({ fase, numero, atual }) {
  const dias = diasAte(fase.data_prevista)
  const atrasada = fase.status !== 'concluida' && dias !== null && dias < 0
  return (
    <li className={`fase fase-${fase.status} ${atual ? 'fase-atual' : ''}`}>
      <span className="fase-marco" aria-hidden="true">
        {fase.status === 'concluida' ? '✓' : numero}
      </span>
      <div className="fase-corpo">
        <div className="fase-linha">
          <h3 className="fase-nome">{fase.nome}</h3>
          <span className={`chip chip-${atrasada ? 'atraso' : fase.status}`}>
            {atrasada ? 'Atrasada' : STATUS[fase.status]}
          </span>
        </div>
        <p className="fase-datas num">
          {fase.status === 'concluida'
            ? `Concluída em ${formatarData(fase.data_conclusao || fase.data_prevista)}`
            : `${formatarData(fase.data_inicio)} → ${formatarData(fase.data_prevista)}`}
        </p>
        {fase.observacao && <p className="fase-obs">{fase.observacao}</p>}
      </div>
    </li>
  )
}

function Documentos({ documentos }) {
  const presentes = CATEGORIAS.filter((c) => documentos.some((d) => d.categoria === c.id))
  const [aba, setAba] = useState(presentes[0]?.id)
  const [aberto, setAberto] = useState(null)

  useEffect(() => {
    if (!presentes.some((c) => c.id === aba)) setAba(presentes[0]?.id)
  }, [documentos])

  const lista = documentos
    .filter((d) => d.categoria === aba)
    .sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''))

  return (
    <section className="bloco">
      <h2 className="titulo-secao">Documentos</h2>
      {!presentes.length && <p className="vazio">Nenhum documento disponível ainda.</p>}
      {presentes.length > 0 && (
        <>
          <div className="abas" role="tablist">
            {presentes.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={aba === c.id}
                className={`aba ${aba === c.id ? 'aba-ativa' : ''}`}
                onClick={() => setAba(c.id)}
              >
                {c.nome}
                <span className="aba-qtd">{documentos.filter((d) => d.categoria === c.id).length}</span>
              </button>
            ))}
          </div>
          {aba === 'render' ? (
            <div className="galeria">
              {lista.map((d) => (
                <Miniatura key={d.id} doc={d} onAbrir={() => setAberto(d)} />
              ))}
            </div>
          ) : (
            <ul className="docs">
              {lista.map((d) => (
                <LinhaDoc key={d.id} doc={d} />
              ))}
            </ul>
          )}
        </>
      )}
      {aberto && <Visualizador doc={aberto} onFechar={() => setAberto(null)} />}
    </section>
  )
}

function useUrl(doc) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let vivo = true
    api.urlDocumento(doc).then((u) => vivo && setUrl(u)).catch(() => {})
    return () => (vivo = false)
  }, [doc.id])
  return url
}

function Miniatura({ doc, onAbrir }) {
  const url = useUrl(doc)
  const ehImagem = doc.tipo_mime?.startsWith('image/')
  return (
    <button className="mini" onClick={onAbrir}>
      <div className="mini-img">
        {ehImagem && url ? <img src={url} alt={doc.titulo} loading="lazy" /> : <span>{extensao(doc)}</span>}
      </div>
      <span className="mini-titulo">{doc.titulo}</span>
    </button>
  )
}

function LinhaDoc({ doc }) {
  const url = useUrl(doc)
  return (
    <li className="doc">
      <span className="doc-tipo">{extensao(doc)}</span>
      <div className="doc-info">
        <span className="doc-titulo">{doc.titulo}</span>
        <span className="doc-data num">Enviado em {formatarData(doc.criado_em?.slice(0, 10))}</span>
      </div>
      <a className="btn btn-contorno" href={url || '#'} target="_blank" rel="noreferrer" aria-disabled={!url}>
        Abrir
      </a>
    </li>
  )
}

function Visualizador({ doc, onFechar }) {
  const url = useUrl(doc)
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])
  return (
    <div className="modal" onClick={onFechar} role="dialog" aria-label={doc.titulo}>
      <figure className="modal-fig" onClick={(e) => e.stopPropagation()}>
        {url && doc.tipo_mime?.startsWith('image/') ? (
          <img src={url} alt={doc.titulo} />
        ) : (
          <p>Pré-visualização indisponível.</p>
        )}
        <figcaption>
          <span>{doc.titulo}</span>
          <span className="modal-acoes">
            {url && (
              <a className="btn btn-leve" href={url} target="_blank" rel="noreferrer">
                Abrir original
              </a>
            )}
            <button className="btn btn-leve" onClick={onFechar}>
              Fechar
            </button>
          </span>
        </figcaption>
      </figure>
    </div>
  )
}

function extensao(doc) {
  const m = doc.tipo_mime || ''
  if (m.includes('pdf')) return 'PDF'
  if (m.startsWith('image/')) return 'IMG'
  if (m.includes('dwg') || doc.arquivo_path?.endsWith('.dwg')) return 'DWG'
  return 'DOC'
}
