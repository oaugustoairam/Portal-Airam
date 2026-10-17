import { useEffect, useMemo, useState } from 'react'
import { api, MODO_DEMO } from '../lib/api.js'
import { htmlCampanha } from '../lib/emailModelo.js'
import { linhaDoTempo, etapaAtual, TIPOS_PRAZO } from '../lib/constants.js'
import { proximoAniversario } from '../lib/aniversarios.js'

const VAZIA = { assunto: '', titulo: '', conteudo: 'Olá, {{nome}}!\n\n', imagem_url: '', botao_texto: '', botao_link: '' }
const SEGMENTOS = [
  ['todos', 'Todos os clientes'],
  ['andamento', 'Processo em andamento'],
  ['concluidos', 'Montagem concluída'],
  ['normal', 'Prazo normal'],
  ['futuro', 'Projeto futuro'],
  ['aniversario', 'Aniversariantes do mês'],
]

function dataHora(iso) {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

export default function EmailMarketing({ processos }) {
  const [c, setC] = useState(VAZIA)
  const [campanhas, setCampanhas] = useState([])
  const [segmento, setSegmento] = useState('todos')
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState(new Set())
  const [confirmar, setConfirmar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')

  const carregar = () => api.listarCampanhas().then(setCampanhas)
  useEffect(() => {
    carregar()
  }, [])

  // um cliente por e-mail
  const clientes = useMemo(() => {
    const m = new Map()
    for (const p of processos) {
      const k = p.cliente_email.toLowerCase()
      if (!m.has(k)) m.set(k, { ...p, saiu: p.aceita_marketing === false })
      else if (p.aceita_marketing === false) m.get(k).saiu = true
    }
    return [...m.values()].sort((a, b) => a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR'))
  }, [processos])

  const mesAtual = new Date().getMonth() + 1
  const termo = busca.trim().toLowerCase()
  const visiveis = clientes.filter((p) => {
    if (segmento === 'andamento' && p.entrega_concluida) return false
    if (segmento === 'concluidos' && !p.entrega_concluida) return false
    if ((segmento === 'normal' || segmento === 'futuro') && p.tipo_prazo !== segmento) return false
    if (segmento === 'aniversario' && (!p.cliente_nascimento || Number(p.cliente_nascimento.slice(5, 7)) !== mesAtual)) return false
    if (termo && !`${p.cliente_nome} ${p.codigo} ${p.cliente_email}`.toLowerCase().includes(termo)) return false
    return true
  })
  const selecionaveis = visiveis.filter((p) => !p.saiu)
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every((p) => sel.has(p.id))

  const set = (k) => (e) => setC({ ...c, [k]: e.target.value })
  const alternar = (id) => {
    const n = new Set(sel)
    n.has(id) ? n.delete(id) : n.add(id)
    setSel(n)
  }
  const marcarTodos = () => {
    const n = new Set(sel)
    selecionaveis.forEach((p) => (todosMarcados ? n.delete(p.id) : n.add(p.id)))
    setSel(n)
  }

  const valida = c.assunto.trim() && c.titulo.trim() && c.conteudo.trim().length > 10
  const linkInvalido = (c.botao_link && !/^https:\/\//.test(c.botao_link)) || (c.imagem_url && !/^https:\/\//.test(c.imagem_url))

  async function salvarRascunho() {
    setErro('')
    try {
      const salva = await api.salvarCampanha(c)
      setC(salva)
      setMsg('Rascunho salvo.')
      carregar()
    } catch (e) {
      setErro(e.message)
    }
  }

  async function enviar() {
    setErro('')
    setOcupado(true)
    try {
      const salva = await api.salvarCampanha(c)
      const r = await api.enviarCampanha(salva.id, [...sel])
      setMsg(`E-mail enviado para ${r.enviados} ${r.enviados === 1 ? 'cliente' : 'clientes'}${r.falhas ? ` (${r.falhas} falharam)` : ''}.`)
      setC(VAZIA)
      setSel(new Set())
      setConfirmar(false)
      carregar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="mkt">
      <div className="cab-linha">
        <h1 className="titulo-grande">E-mail marketing</h1>
        {msg && <span className="toast" role="status">{msg}</span>}
      </div>

      <div className="mkt-grade">
        <div className="form mkt-editor">
          <fieldset className="grupo">
            <legend>1. Conteúdo</legend>
            <div className="campo">
              <label htmlFor="m-assunto">Assunto do e-mail</label>
              <input id="m-assunto" value={c.assunto} onChange={set('assunto')} placeholder="{{nome}}, novidades da Airam para você" />
            </div>
            <div className="campo">
              <label htmlFor="m-titulo">Título</label>
              <input id="m-titulo" value={c.titulo} onChange={set('titulo')} placeholder="Nova linha de closets" />
            </div>
            <div className="campo">
              <label htmlFor="m-texto">Texto</label>
              <textarea id="m-texto" rows={8} value={c.conteudo} onChange={set('conteudo')} />
              <span className="ajuda">Deixe uma linha em branco entre os parágrafos. {'{{nome}}'} vira o primeiro nome de cada cliente.</span>
            </div>
            <div className="campo">
              <label htmlFor="m-img">Imagem (link https, opcional)</label>
              <input id="m-img" type="url" inputMode="url" autoCapitalize="none" value={c.imagem_url || ''} onChange={set('imagem_url')} placeholder="https://airam.arq.br/…/foto.jpg" />
            </div>
            <div className="grade">
              <div className="campo">
                <label htmlFor="m-btn">Texto do botão (opcional)</label>
                <input id="m-btn" value={c.botao_texto || ''} onChange={set('botao_texto')} placeholder="Agende uma visita" />
              </div>
              <div className="campo">
                <label htmlFor="m-link">Link do botão</label>
                <input id="m-link" type="url" inputMode="url" autoCapitalize="none" value={c.botao_link || ''} onChange={set('botao_link')} placeholder="https://wa.me/55…" />
              </div>
            </div>
            {linkInvalido && <p className="erro">Use links completos começando com https://</p>}
          </fieldset>

          <fieldset className="grupo">
            <legend>2. Para quem</legend>
            <div className="mkt-filtros">
              <select id="m-seg" aria-label="Grupo de clientes" value={segmento} onChange={(e) => setSegmento(e.target.value)}>
                {SEGMENTOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
              <input type="search" aria-label="Buscar cliente" placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <label className="check mkt-todos">
              <input type="checkbox" checked={todosMarcados} onChange={marcarTodos} disabled={!selecionaveis.length} />
              Selecionar todos deste grupo ({selecionaveis.length})
            </label>
            <ul className="mkt-lista">
              {visiveis.map((p) => (
                <li key={p.id}>
                  <label className={`mkt-cliente ${p.saiu ? 'mkt-saiu' : ''}`}>
                    <input type="checkbox" disabled={p.saiu} checked={sel.has(p.id)} onChange={() => alternar(p.id)} />
                    <span className="mkt-cliente-info">
                      <strong>{p.cliente_nome}</strong>
                      <span>{p.codigo} · {p.cliente_email}</span>
                    </span>
                    <span className="mkt-cliente-tag">
                      {p.saiu ? 'Saiu da lista' : p.entrega_concluida ? 'Concluído' : etapaAtual(linhaDoTempo(p, p.assinaturas)).nome}
                    </span>
                  </label>
                </li>
              ))}
              {!visiveis.length && <li className="vazio">Nenhum cliente neste grupo.</li>}
            </ul>
          </fieldset>

          {erro && <p className="erro" role="alert">{erro}</p>}
          <div className="acoes">
            <button type="button" className="btn btn-contorno" onClick={salvarRascunho} disabled={!valida}>Salvar rascunho</button>
            {!confirmar ? (
              <button type="button" className="btn btn-principal" disabled={!valida || !sel.size || linkInvalido} onClick={() => setConfirmar(true)}>
                Enviar para {sel.size} {sel.size === 1 ? 'cliente' : 'clientes'}
              </button>
            ) : (
              <span className="confirmar">
                Enviar agora para {sel.size} {sel.size === 1 ? 'cliente' : 'clientes'}?
                <button type="button" className="btn btn-principal" disabled={ocupado} onClick={enviar}>{ocupado ? 'Enviando…' : 'Sim, enviar'}</button>
                <button type="button" className="btn btn-leve" onClick={() => setConfirmar(false)}>Cancelar</button>
              </span>
            )}
          </div>
          {MODO_DEMO && <p className="dica">Na demonstração o envio é simulado: nenhum e-mail sai de verdade.</p>}
        </div>

        <div className="mkt-previa">
          <span className="rotulo">Prévia (como o cliente recebe)</span>
          <div className="mkt-previa-assunto"><strong>{(c.assunto || 'Assunto do e-mail').replaceAll('{{nome}}', 'Marina')}</strong><span>Airam &lt;novidades@airam.arq.br&gt;</span></div>
          <iframe title="Prévia do e-mail" className="mkt-frame" sandbox="" srcDoc={htmlCampanha(c, 'Marina Duarte')} />
        </div>
      </div>

      <section className="bloco">
        <h2 className="titulo-secao">Campanhas</h2>
        {!campanhas.length && <p className="vazio">Nenhuma campanha ainda.</p>}
        <ul className="docs">
          {campanhas.map((x) => (
            <li key={x.id} className="doc">
              <span className="doc-tipo">{x.status === 'enviada' ? 'OK' : 'RASC'}</span>
              <div className="doc-info">
                <span className="doc-titulo">{x.assunto}</span>
                <span className="doc-data num">
                  {x.status === 'enviada'
                    ? `Enviada em ${dataHora(x.enviada_em)} · ${x.enviados} de ${x.total} entregues ao provedor${x.falhas ? ` · ${x.falhas} falhas` : ''}${x.simulada ? ' · simulada' : ''}`
                    : `Rascunho de ${dataHora(x.criado_em)}`}
                </span>
              </div>
              {x.status === 'rascunho' && <button className="btn btn-contorno" onClick={() => setC(x)}>Editar</button>}
              {x.status === 'enviada' && <button className="btn btn-leve" onClick={() => setC({ ...VAZIA, ...x, id: undefined, status: undefined })}>Reutilizar</button>}
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}
