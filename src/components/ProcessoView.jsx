import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import {
  CATEGORIAS_CLIENTE,
  TIPOS_PRAZO,
  linhaDoTempo,
  etapaAtual,
  progresso,
  diasAte,
  formatarData,
  prazoTexto,
} from '../lib/constants.js'
import IconeCubo from './IconeCubo.jsx'
import AssinaturaModal from './AssinaturaModal.jsx'

const NOME_ASSINATURA = { contrato: 'Seu contrato', projeto_final: 'Seu projeto final' }

// O que o cliente vê. A equipe usa a mesma tela em "Ver como cliente" (visualizacao = true).
export default function ProcessoView({ processo, onAtualizar, visualizacao }) {
  const { documentos = [], assinaturas = [] } = processo
  const etapas = linhaDoTempo(processo, assinaturas)
  const atual = etapaAtual(etapas)
  const pct = progresso(etapas)
  const diasEntrega = diasAte(processo.data_entrega_prevista)
  const pendentes = assinaturas.filter((a) => a.status === 'pendente')
  const [assinando, setAssinando] = useState(null)
  const tipo = TIPOS_PRAZO[processo.tipo_prazo]

  return (
    <article className="projeto">
      <header className="projeto-cab">
        <div className="projeto-cab-linha">
          <span className="rotulo">Processo {processo.codigo}</span>
          {tipo && <span className="chip chip-sobre-marca">{tipo.nome}</span>}
        </div>
        <h1 className="titulo-grande">{processo.cliente_nome}</h1>
        {processo.ambientes && <p className="projeto-desc">{processo.ambientes}</p>}
        {processo.endereco && <p className="projeto-end">{processo.endereco}</p>}
      </header>

      {processo.recado_cliente && (
        <p className="recado"><strong>Recado da Airam:</strong> {processo.recado_cliente}</p>
      )}

      {pendentes.map((a) => (
        <div key={a.id} className="cartao-assinar">
          <div>
            <strong>{NOME_ASSINATURA[a.tipo]} está pronto para assinatura</strong>
            <span>Leva menos de 2 minutos e é feito aqui mesmo, pelo portal.</span>
          </div>
          <button className="btn btn-principal" disabled={visualizacao} onClick={() => setAssinando(a)}
            title={visualizacao ? 'Disponível só para o cliente' : undefined}>
            Assinar agora
          </button>
        </div>
      ))}

      <section className="resumo">
        <div className="resumo-item">
          <span className="rotulo">Etapa atual</span>
          <strong className="resumo-valor">{atual.nome}</strong>
          {atual.data && atual.status !== 'concluida' && (
            <span className="resumo-sub">Data prevista: {formatarData(atual.data)}</span>
          )}
        </div>
        <div className="resumo-item">
          <span className="rotulo">Entrega prevista</span>
          <strong className="resumo-valor num">{formatarData(processo.data_entrega_prevista)}</strong>
          <span className={`chip ${!processo.entrega_concluida && diasEntrega < 0 ? 'chip-atraso' : 'chip-neutro'}`}>
            {processo.entrega_concluida ? 'Entregue' : prazoTexto(processo.data_entrega_prevista)}
          </span>
        </div>
        <div className="resumo-item">
          <span className="rotulo">Andamento</span>
          <strong className="resumo-valor num">{pct}%</strong>
          <div className="barra" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
            <div className="barra-cheia" style={{ width: pct + '%' }} />
          </div>
          <span className="resumo-sub">
            {etapas.filter((e) => e.status === 'concluida').length} de {etapas.length} etapas concluídas
          </span>
        </div>
      </section>

      <section className="bloco">
        <h2 className="titulo-secao">Cronograma</h2>
        <ol className="linha-tempo">
          {etapas.map((e, i) => (
            <Etapa key={e.id} etapa={e} numero={i + 1} />
          ))}
        </ol>
      </section>

      <Documentos documentos={documentos} />

      {assinando && (
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
      )}
    </article>
  )
}

function Etapa({ etapa, numero }) {
  const { status, atrasada, producao } = etapa
  const emProducao = producao && status === 'atual'
  let chip = { concluida: 'Concluída', atual: 'Em andamento', futura: 'Próxima' }[status]
  if (atrasada) chip = 'Atrasada'
  if (emProducao) chip = 'Em produção'

  let quando = null
  if (!producao && !(etapa.semData && !etapa.data)) {
    if (status === 'concluida') quando = etapa.data ? `Concluída em ${formatarData(etapa.data)}` : 'Concluída'
    else quando = etapa.data ? `Previsto para ${formatarData(etapa.data)}` : 'Data a definir'
  }

  return (
    <li className={`fase fase-${status} ${emProducao ? 'fase-producao' : ''}`}>
      <span className="fase-marco" aria-hidden="true">
        {producao ? <IconeCubo carregando={emProducao} /> : status === 'concluida' ? '✓' : numero}
      </span>
      <div className="fase-corpo">
        <div className="fase-linha">
          <h3 className="fase-nome">{etapa.nome}</h3>
          <span className={`chip chip-${atrasada ? 'atraso' : emProducao ? 'em_andamento' : status}`}>{chip}</span>
        </div>
        {quando && <p className="fase-datas num">{quando}</p>}
        {etapa.detalhe && (status !== 'concluida' || etapa.semData) && <p className="fase-datas">{etapa.detalhe}</p>}
        {emProducao && (
          <div className="producao-barra" aria-label="Em produção">
            <span />
          </div>
        )}
      </div>
    </li>
  )
}

function Documentos({ documentos }) {
  const presentes = CATEGORIAS_CLIENTE.filter((c) => documentos.some((d) => d.categoria === c.id))
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
      <h2 className="titulo-secao">Documentos e projetos</h2>
      {!presentes.length && <p className="vazio">Os documentos aparecem aqui conforme o processo avança.</p>}
      {presentes.length > 0 && (
        <>
          <div className="abas" role="tablist">
            {presentes.map((c) => (
              <button key={c.id} role="tab" aria-selected={aba === c.id}
                className={`aba ${aba === c.id ? 'aba-ativa' : ''}`} onClick={() => setAba(c.id)}>
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

export function useUrl(doc) {
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
  return (
    <button className="mini" onClick={onAbrir}>
      <div className="mini-img">
        {doc.tipo_mime?.startsWith('image/') && url ? <img src={url} alt={doc.titulo} loading="lazy" /> : <span>{extensao(doc)}</span>}
      </div>
      <span className="mini-titulo">{doc.titulo}</span>
    </button>
  )
}

export function LinhaDoc({ doc, acoes }) {
  const url = useUrl(doc)
  return (
    <li className="doc">
      <span className="doc-tipo">{extensao(doc)}</span>
      <div className="doc-info">
        <span className="doc-titulo">
          {doc.titulo}
          {doc.assinado && <span className="chip chip-concluida chip-mini">Assinado</span>}
        </span>
        <span className="doc-data num">Enviado em {formatarData(doc.criado_em?.slice(0, 10))}</span>
      </div>
      <a className="btn btn-contorno" href={url || '#'} target="_blank" rel="noreferrer" aria-disabled={!url}>
        Abrir
      </a>
      {acoes}
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
        {url && <img src={url} alt={doc.titulo} />}
        <figcaption>
          <span>{doc.titulo}</span>
          <span className="modal-acoes">
            {url && <a className="btn btn-leve" href={url} target="_blank" rel="noreferrer">Abrir original</a>}
            <button className="btn btn-leve" onClick={onFechar}>Fechar</button>
          </span>
        </figcaption>
      </figure>
    </div>
  )
}

export function extensao(doc) {
  const m = doc.tipo_mime || ''
  if (m.includes('pdf')) return 'PDF'
  if (m.startsWith('image/')) return 'IMG'
  if (doc.arquivo_path?.toLowerCase().endsWith('.dwg')) return 'DWG'
  return 'DOC'
}
