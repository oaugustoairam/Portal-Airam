import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import {
  CATEGORIAS,
  FASES_PADRAO,
  STATUS,
  faseAtual,
  progresso,
  formatarData,
  prazoTexto,
  diasAte,
} from '../lib/constants.js'
import ProjetoView from './ProjetoView.jsx'

export default function AdminHome() {
  const [projetos, setProjetos] = useState(null)
  const [editando, setEditando] = useState(null) // id do projeto ou 'novo'

  const recarregar = () => api.listarProjetos().then(setProjetos)
  useEffect(() => {
    recarregar()
  }, [])

  if (editando)
    return (
      <EditorProjeto
        id={editando === 'novo' ? null : editando}
        onFechar={() => {
          setEditando(null)
          recarregar()
        }}
        onCriado={(id) => setEditando(id)}
      />
    )

  return (
    <section>
      <div className="cab-linha">
        <h1 className="titulo-grande">Projetos</h1>
        <button className="btn btn-principal" onClick={() => setEditando('novo')}>
          Novo projeto
        </button>
      </div>
      {!projetos && <div className="carregando">Carregando…</div>}
      {projetos?.length === 0 && <p className="vazio">Nenhum projeto ainda. Crie o primeiro.</p>}
      {projetos?.length > 0 && (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>Projeto</th>
                <th>Cliente</th>
                <th>Fase atual</th>
                <th>Andamento</th>
                <th>Entrega</th>
              </tr>
            </thead>
            <tbody>
              {projetos.map((p) => {
                const atual = faseAtual(p.fases)
                const atraso = diasAte(p.prazo_final) < 0
                return (
                  <tr key={p.id} onClick={() => setEditando(p.id)} tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setEditando(p.id)}>
                    <td><strong>{p.nome}</strong></td>
                    <td>
                      {p.cliente_nome || '—'}
                      <span className="celula-sub">{p.cliente_email}</span>
                    </td>
                    <td>{atual?.nome || '—'}</td>
                    <td className="num">{progresso(p.fases)}%</td>
                    <td className="num">
                      {formatarData(p.prazo_final)}
                      <span className={`celula-sub ${atraso ? 'texto-atraso' : ''}`}>
                        {prazoTexto(p.prazo_final)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const VAZIO = {
  nome: '',
  cliente_nome: '',
  cliente_email: '',
  endereco: '',
  descricao: '',
  data_inicio: '',
  prazo_final: '',
}

function EditorProjeto({ id, onFechar, onCriado }) {
  const [projeto, setProjeto] = useState(id ? null : { ...VAZIO, fases: [], documentos: [] })
  const [aba, setAba] = useState('dados')
  const [msg, setMsg] = useState('')

  const recarregar = () => api.projeto(id).then(setProjeto)
  useEffect(() => {
    if (id) recarregar()
  }, [id])

  if (!projeto) return <div className="carregando">Carregando…</div>

  const avisar = (t) => {
    setMsg(t)
    setTimeout(() => setMsg(''), 2500)
  }

  return (
    <section>
      <button className="btn btn-leve voltar" onClick={onFechar}>
        ← Todos os projetos
      </button>
      <div className="cab-linha">
        <h1 className="titulo-grande">{id ? projeto.nome : 'Novo projeto'}</h1>
        {msg && <span className="toast" role="status">{msg}</span>}
      </div>

      {id && (
        <div className="abas">
          {[
            ['dados', 'Dados'],
            ['fases', 'Etapas e prazos'],
            ['docs', 'Documentos'],
            ['cliente', 'Ver como cliente'],
          ].map(([k, t]) => (
            <button key={k} className={`aba ${aba === k ? 'aba-ativa' : ''}`} onClick={() => setAba(k)}>
              {t}
            </button>
          ))}
        </div>
      )}

      {aba === 'dados' && (
        <FormDados
          projeto={projeto}
          onSalvo={async (salvo) => {
            if (!id) {
              await api.salvarFases(
                salvo.id,
                FASES_PADRAO.map((nome) => ({ nome, status: 'pendente', observacao: '' }))
              )
              onCriado(salvo.id)
            } else {
              await recarregar()
            }
            avisar('Dados salvos')
          }}
          onExcluido={onFechar}
        />
      )}
      {aba === 'fases' && (
        <FormFases projeto={projeto} onSalvo={async () => { await recarregar(); avisar('Etapas salvas') }} />
      )}
      {aba === 'docs' && (
        <FormDocs projeto={projeto} onMudou={async (t) => { await recarregar(); avisar(t) }} />
      )}
      {aba === 'cliente' && (
        <div className="preview-cliente">
          <ProjetoView projeto={projeto} />
        </div>
      )}
    </section>
  )
}

function Campo({ id, rotulo, children }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      {children}
    </div>
  )
}

function FormDados({ projeto, onSalvo, onExcluido }) {
  const [f, setF] = useState(() => {
    const { fases, documentos, ...resto } = projeto
    return resto
  })
  const [confirmar, setConfirmar] = useState(false)
  const [erro, setErro] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    try {
      const limpo = { ...f, data_inicio: f.data_inicio || null, prazo_final: f.prazo_final || null }
      const salvo = await api.salvarProjeto(limpo)
      await onSalvo(salvo)
    } catch (err) {
      setErro('Não foi possível salvar: ' + err.message)
    }
  }

  return (
    <form className="form" onSubmit={salvar}>
      <div className="grade">
        <Campo id="p-nome" rotulo="Nome do projeto">
          <input id="p-nome" required value={f.nome} onChange={set('nome')} placeholder="Apartamento Jardins" />
        </Campo>
        <Campo id="p-endereco" rotulo="Endereço da obra">
          <input id="p-endereco" value={f.endereco || ''} onChange={set('endereco')} />
        </Campo>
        <Campo id="p-cnome" rotulo="Nome do cliente">
          <input id="p-cnome" value={f.cliente_nome || ''} onChange={set('cliente_nome')} />
        </Campo>
        <Campo id="p-cemail" rotulo="E-mail do cliente (usado para o acesso)">
          <input id="p-cemail" type="email" required value={f.cliente_email} onChange={set('cliente_email')} />
        </Campo>
        <Campo id="p-inicio" rotulo="Início">
          <input id="p-inicio" type="date" value={f.data_inicio || ''} onChange={set('data_inicio')} />
        </Campo>
        <Campo id="p-prazo" rotulo="Prazo de entrega final">
          <input id="p-prazo" type="date" value={f.prazo_final || ''} onChange={set('prazo_final')} />
        </Campo>
      </div>
      <Campo id="p-desc" rotulo="Descrição (o cliente vê)">
        <textarea id="p-desc" rows={3} value={f.descricao || ''} onChange={set('descricao')} />
      </Campo>
      {erro && <p className="erro">{erro}</p>}
      <div className="acoes">
        <button className="btn btn-principal">{f.id ? 'Salvar dados' : 'Criar projeto'}</button>
        {f.id && !confirmar && (
          <button type="button" className="btn btn-perigo-leve" onClick={() => setConfirmar(true)}>
            Excluir projeto
          </button>
        )}
        {confirmar && (
          <span className="confirmar">
            Excluir o projeto e todos os documentos?
            <button type="button" className="btn btn-perigo"
              onClick={async () => { await api.excluirProjeto(f.id); onExcluido() }}>
              Sim, excluir
            </button>
            <button type="button" className="btn btn-leve" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
          </span>
        )}
      </div>
      {!f.id && (
        <p className="dica">
          O projeto começa com as etapas padrão ({FASES_PADRAO.join(', ')}). Você ajusta depois.
        </p>
      )}
    </form>
  )
}

function FormFases({ projeto, onSalvo }) {
  const [fases, setFases] = useState(projeto.fases.map((f) => ({ ...f })))
  const [salvando, setSalvando] = useState(false)

  const mudar = (i, k, v) => {
    const nova = fases.map((f, j) => (j === i ? { ...f, [k]: v } : f))
    // ao concluir uma fase, registra a data de hoje se estiver vazia
    if (k === 'status' && v === 'concluida' && !nova[i].data_conclusao)
      nova[i].data_conclusao = new Date().toISOString().slice(0, 10)
    setFases(nova)
  }
  const mover = (i, d) => {
    const j = i + d
    if (j < 0 || j >= fases.length) return
    const nova = [...fases]
    ;[nova[i], nova[j]] = [nova[j], nova[i]]
    setFases(nova)
  }

  async function salvar() {
    setSalvando(true)
    const limpas = fases.map(({ id, nome, status, data_inicio, data_prevista, data_conclusao, observacao }) => ({
      ...(id ? { id } : {}),
      nome,
      status,
      data_inicio: data_inicio || null,
      data_prevista: data_prevista || null,
      data_conclusao: status === 'concluida' ? data_conclusao || null : null,
      observacao: observacao || '',
    }))
    await api.salvarFases(projeto.id, limpas)
    setSalvando(false)
    onSalvo()
  }

  return (
    <div className="form">
      <ol className="editor-fases">
        {fases.map((f, i) => (
          <li key={f.id || 'n' + i} className="editor-fase">
            <div className="editor-fase-topo">
              <span className="num editor-fase-n">{String(i + 1).padStart(2, '0')}</span>
              <input aria-label="Nome da etapa" className="editor-fase-nome" value={f.nome}
                onChange={(e) => mudar(i, 'nome', e.target.value)} />
              <div className="editor-fase-mov">
                <button type="button" className="btn btn-icone" aria-label="Subir" onClick={() => mover(i, -1)}>↑</button>
                <button type="button" className="btn btn-icone" aria-label="Descer" onClick={() => mover(i, 1)}>↓</button>
                <button type="button" className="btn btn-icone" aria-label="Remover etapa"
                  onClick={() => setFases(fases.filter((_, j) => j !== i))}>×</button>
              </div>
            </div>
            <div className="grade grade-4">
              <Campo id={`f${i}-status`} rotulo="Situação">
                <select id={`f${i}-status`} value={f.status} onChange={(e) => mudar(i, 'status', e.target.value)}>
                  {Object.entries(STATUS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
              </Campo>
              <Campo id={`f${i}-ini`} rotulo="Início">
                <input id={`f${i}-ini`} type="date" value={f.data_inicio || ''} onChange={(e) => mudar(i, 'data_inicio', e.target.value)} />
              </Campo>
              <Campo id={`f${i}-prev`} rotulo="Prazo da etapa">
                <input id={`f${i}-prev`} type="date" value={f.data_prevista || ''} onChange={(e) => mudar(i, 'data_prevista', e.target.value)} />
              </Campo>
              <Campo id={`f${i}-concl`} rotulo="Concluída em">
                <input id={`f${i}-concl`} type="date" disabled={f.status !== 'concluida'}
                  value={f.data_conclusao || ''} onChange={(e) => mudar(i, 'data_conclusao', e.target.value)} />
              </Campo>
            </div>
            <Campo id={`f${i}-obs`} rotulo="Recado para o cliente nesta etapa">
              <input id={`f${i}-obs`} value={f.observacao || ''} placeholder="Ex.: aguardando aprovação do layout"
                onChange={(e) => mudar(i, 'observacao', e.target.value)} />
            </Campo>
          </li>
        ))}
      </ol>
      <div className="acoes">
        <button type="button" className="btn btn-contorno"
          onClick={() => setFases([...fases, { nome: 'Nova etapa', status: 'pendente', observacao: '' }])}>
          Adicionar etapa
        </button>
        <button type="button" className="btn btn-principal" disabled={salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar etapas'}
        </button>
      </div>
    </div>
  )
}

function FormDocs({ projeto, onMudou }) {
  const [categoria, setCategoria] = useState('contrato')
  const [titulo, setTitulo] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [excluir, setExcluir] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    if (!arquivo) return
    setErro('')
    setEnviando(true)
    try {
      await api.enviarDocumento(projeto.id, { categoria, titulo: titulo || arquivo.name }, arquivo)
      setTitulo('')
      setArquivo(null)
      e.target.reset()
      await onMudou('Documento enviado')
    } catch (err) {
      setErro('Falha no envio: ' + err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="form">
      <form className="envio" onSubmit={enviar}>
        <div className="grade grade-3">
          <Campo id="d-cat" rotulo="Tipo">
            <select id="d-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo id="d-titulo" rotulo="Título (o cliente vê)">
            <input id="d-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Planta de layout — rev. 2" />
          </Campo>
          <Campo id="d-arq" rotulo="Arquivo (PDF, imagem, DWG…)">
            <input id="d-arq" type="file" required onChange={(e) => setArquivo(e.target.files[0] || null)} />
          </Campo>
        </div>
        {erro && <p className="erro">{erro}</p>}
        <div className="acoes">
          <button className="btn btn-principal" disabled={enviando || !arquivo}>
            {enviando ? 'Enviando…' : 'Enviar documento'}
          </button>
        </div>
      </form>

      {CATEGORIAS.map((c) => {
        const docs = projeto.documentos.filter((d) => d.categoria === c.id)
        if (!docs.length) return null
        return (
          <div key={c.id} className="grupo-docs">
            <h3 className="rotulo">{c.nome}</h3>
            <ul className="docs">
              {docs.map((d) => (
                <li key={d.id} className="doc">
                  <div className="doc-info">
                    <span className="doc-titulo">{d.titulo}</span>
                    <span className="doc-data num">{formatarData(d.criado_em?.slice(0, 10))}</span>
                  </div>
                  {excluir === d.id ? (
                    <span className="confirmar">
                      <button className="btn btn-perigo"
                        onClick={async () => { await api.excluirDocumento(d); setExcluir(null); onMudou('Documento excluído') }}>
                        Excluir
                      </button>
                      <button className="btn btn-leve" onClick={() => setExcluir(null)}>Cancelar</button>
                    </span>
                  ) : (
                    <button className="btn btn-perigo-leve" onClick={() => setExcluir(d.id)}>Remover</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
