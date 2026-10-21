import { useEffect, useState } from 'react'
import { api, MODO_DEMO } from '../../lib/api.js'
import { prepararImagem } from '../../lib/imagem.js'
import { Confirmar, Campo } from '../comercial/comum.jsx'

const OBJETIVOS = [['vender', 'Vender'], ['inspirar', 'Inspirar'], ['entregue', 'Projeto entregue'], ['bastidores', 'Bastidores'], ['depoimento', 'Depoimento']]
const TONS = [['sofisticado', 'Sofisticado'], ['proximo', 'Próximo'], ['tecnico', 'Técnico']]
const TAMANHOS = [['curto', 'Curto'], ['medio', 'Médio'], ['longo', 'Longo']]
const montarTexto = (v) => `${v.legenda}\n\n${v.cta}\n\n${v.hashtags.join(' ')}`.trim()
const paraBase64 = (f) => new Promise((ok, erro) => {
  const r = new FileReader()
  r.onload = () => ok(String(r.result).split(',')[1])
  r.onerror = erro
  r.readAsDataURL(f)
})
async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    const t = document.createElement('textarea')
    t.value = texto
    document.body.appendChild(t)
    t.select()
    const ok = document.execCommand('copy')
    t.remove()
    return ok
  }
}

function Opcoes({ id, rotulo, opcoes, valor, onChange }) {
  return (
    <div className="campo">
      <span className="rotulo-campo" id={id}>{rotulo}</span>
      <div className="segmentado" role="radiogroup" aria-labelledby={id}>
        {opcoes.map(([k, t]) => <button key={k} type="button" role="radio" aria-checked={valor === k} className={valor === k ? 'ativo' : ''} onClick={() => onChange(k)}>{t}</button>)}
      </div>
    </div>
  )
}

// Marketing > Criador de conteúdo: legendas de Instagram com IA (a chave fica só no servidor)
export default function CriadorConteudo() {
  const [modo, setModo] = useState('texto')
  const [f, setF] = useState({ descricao: '', contexto: '', objetivo: 'inspirar', tom: 'sofisticado', tamanho: 'medio' })
  const [fotos, setFotos] = useState([])
  const [variacoes, setVariacoes] = useState([])
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [historico, setHistorico] = useState([])
  const [busca, setBusca] = useState('')
  const [excluir, setExcluir] = useState(null)
  const [msg, setMsg] = useState('')
  const carregar = () => api.conteudosIA().then(setHistorico).catch((e) => setErro(e.message))
  useEffect(() => {
    carregar()
  }, [])
  const avisar = (m) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 2500)
  }
  const muda = (k, v) => setF((x) => ({ ...x, [k]: v }))

  async function escolherFotos(lista) {
    setErro('')
    const novas = []
    for (const a of lista.slice(0, 4 - fotos.length)) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(a.type)) {
        setErro(`${a.name}: envie JPG, PNG ou WEBP.`)
        continue
      }
      const pronta = await prepararImagem(a) // reduz fotos grandes para 2400 px
      if (pronta.size > 5 * 1024 * 1024) {
        setErro(`${a.name}: a foto passa de 5 MB.`)
        continue
      }
      novas.push({ nome: a.name, arquivo: pronta, url: URL.createObjectURL(pronta) })
    }
    setFotos((x) => [...x, ...novas].slice(0, 4))
  }
  async function gerar(denovo = false) {
    setErro('')
    setOcupado(true)
    try {
      const imagens = modo === 'imagem' ? await Promise.all(fotos.map(async (x) => ({ tipo: x.arquivo.type || 'image/jpeg', data: await paraBase64(x.arquivo) }))) : []
      const v = await api.gerarConteudo({ modo, ...f, imagens, anterior: denovo ? variacoes.map((x) => x.legenda).join(' | ') : '' })
      setVariacoes(v.map((x) => ({ ...x, texto: montarTexto(x), editando: false })))
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado(false)
    }
  }
  async function salvar(v) {
    setErro('')
    try {
      await api.salvarConteudo({ modo, pedido: { ...f, fotos: fotos.map((x) => x.nome) }, variacoes: variacoes.map(({ legenda, hashtags, cta }) => ({ legenda, hashtags, cta })), texto_final: v.texto })
      await carregar()
      avisar('Salvo no histórico')
    } catch (e) {
      setErro(e.message)
    }
  }
  const t = busca.trim().toLowerCase()
  const filtrado = historico.filter((h) => !t || h.texto_final.toLowerCase().includes(t) || JSON.stringify(h.pedido).toLowerCase().includes(t))

  return (
    <section className="gestao criador-conteudo">
      <div className="titulo-processo">
        <span className="rotulo">Marketing</span>
        <h1 className="titulo-grande">Criador de conteúdo</h1>
        <p className="dica">Legendas de Instagram no tom da Airam: legenda, hashtags e chamada para ação, em 3 variações.</p>
      </div>
      {MODO_DEMO && <div className="aviso-config">Demonstração: sem IA conectada. Gerar texto mostra o aviso; histórico, cópia e edição funcionam com textos salvos.</div>}
      <div className="segmentado" role="tablist" aria-label="Modo">
        {[['texto', 'Descrever a publicação'], ['imagem', 'Enviar uma imagem']].map(([k, tt]) => <button key={k} type="button" role="tab" aria-selected={modo === k} className={modo === k ? 'ativo' : ''} onClick={() => setModo(k)}>{tt}</button>)}
      </div>
      <form className="grupo" onSubmit={(e) => { e.preventDefault(); gerar() }}>
        {modo === 'texto' ? (
          <Campo id="cc-desc" rotulo="Descreva o post que você quer fazer">
            <textarea id="cc-desc" rows={4} maxLength={3000} placeholder="Ex.: cozinha entregue na Mooca, laca off-white com ripado de freijó e bancada em quartzo; cliente queria uma cozinha para receber a família" value={f.descricao} onChange={(e) => muda('descricao', e.target.value)} />
          </Campo>
        ) : (
          <>
            <div className="campo">
              <span className="rotulo-campo">Fotos (até 4)</span>
              <label className={`btn btn-contorno ${fotos.length >= 4 ? 'desabilitado' : ''}`}>+ Adicionar fotos
                <input type="file" hidden multiple accept="image/jpeg,image/png,image/webp" aria-label="Fotos" onChange={(e) => { escolherFotos([...e.target.files]); e.target.value = '' }} /></label>
              {fotos.length > 0 && (
                <ul className="fotos-conteudo">
                  {fotos.map((x, i) => <li key={x.url}><img src={x.url} alt={x.nome} /><button type="button" className="btn btn-leve" onClick={() => setFotos((l) => l.filter((_, j) => j !== i))}>Tirar</button></li>)}
                </ul>
              )}
            </div>
            <Campo id="cc-ctx" rotulo="Contexto (opcional)"><input id="cc-ctx" maxLength={1500} placeholder="Ambiente, cliente, material usado…" value={f.contexto} onChange={(e) => muda('contexto', e.target.value)} /></Campo>
          </>
        )}
        <div className="grade grade-3">
          <Opcoes id="cc-obj" rotulo="Objetivo" opcoes={OBJETIVOS} valor={f.objetivo} onChange={(v) => muda('objetivo', v)} />
          <Opcoes id="cc-tom" rotulo="Tom" opcoes={TONS} valor={f.tom} onChange={(v) => muda('tom', v)} />
          <Opcoes id="cc-tam" rotulo="Tamanho" opcoes={TAMANHOS} valor={f.tamanho} onChange={(v) => muda('tamanho', v)} />
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes">
          <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Gerando… (pode levar alguns segundos)' : 'Gerar texto'}</button>
          {variacoes.length > 0 && <button type="button" className="btn btn-contorno" onClick={() => gerar(true)} disabled={ocupado}>Gerar novamente</button>}
          {msg && <span className="toast" role="status">{msg}</span>}
        </div>
      </form>

      {variacoes.length > 0 && (
        <div className="variacoes">
          {variacoes.map((v, i) => (
            <article key={i} className="grupo variacao">
              <span className="rotulo">Variação {i + 1}</span>
              {v.editando ? (
                <textarea aria-label={`Editar variação ${i + 1}`} rows={10} value={v.texto} onChange={(e) => setVariacoes((l) => l.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))} />
              ) : <pre className="variacao-texto">{v.texto}</pre>}
              <div className="acoes-linha">
                <button type="button" className="btn btn-contorno" onClick={async () => avisar((await copiar(v.texto)) ? 'Copiado' : 'Não foi possível copiar')}>Copiar</button>
                <button type="button" className="btn btn-leve" onClick={() => setVariacoes((l) => l.map((x, j) => (j === i ? { ...x, editando: !x.editando } : x)))}>{v.editando ? 'Pronto' : 'Editar'}</button>
                <button type="button" className="btn btn-leve" onClick={() => salvar(v)}>Salvar no histórico</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <fieldset className="grupo">
        <legend>Histórico</legend>
        <input type="search" placeholder="Buscar no histórico" aria-label="Buscar no histórico" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {filtrado.length === 0 ? <p className="vazio-mini">{historico.length ? 'Nada encontrado.' : 'Nenhum conteúdo salvo ainda.'}</p> : (
          <ul className="lista-lembretes">
            {filtrado.map((h) => (
              <li key={h.id}>
                <span className="lb-info">
                  <span className="celula-sub">{new Date(h.criado_em).toLocaleString('pt-BR')} · {h.modo === 'imagem' ? 'a partir de foto' : 'a partir de descrição'} · {OBJETIVOS.find(([k]) => k === h.pedido?.objetivo)?.[1] || ''}</span>
                  <span className="historico-texto">{h.texto_final}</span>
                </span>
                <span className="acoes-linha">
                  <button type="button" className="btn btn-leve" onClick={async () => avisar((await copiar(h.texto_final)) ? 'Copiado' : 'Não foi possível copiar')}>Copiar</button>
                  <button type="button" className="btn btn-leve texto-atraso" onClick={() => setExcluir(h)}>Excluir</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      {excluir && <Confirmar titulo="Excluir este conteúdo do histórico?" onCancelar={() => setExcluir(null)}
        onConfirmar={async () => { await api.excluirConteudo(excluir.id); setExcluir(null); await carregar(); avisar('Excluído') }} />}
    </section>
  )
}
