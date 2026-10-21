import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { errosTipo } from '../../lib/apiFerramentas.js'
import { CAMPOS_FORMALIZACAO, MARCADORES, montarFormalizacao } from '../../lib/formalizacao.js'
import { Janela, Campo, Confirmar } from '../comercial/comum.jsx'

const idDe = (nome) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)
const NOVO = { nome: '', titulo_modelo: '{codigo} - {cliente}', texto_modelo: '{codigo} - {cliente}\n\n', campos: [], anexos: [{ id: 'capa', nome: 'Capa do pedido do contrato', multiplo: false, obrigatorio: true }], checklist: [], bloco_checklist: '', ativo: true }
const EXEMPLO = { codigo: '100002200', cliente: 'Cliente Exemplo', previsao: 'março de 2027', codigo_origem: '100002100', nome_origem: 'Cliente Exemplo' }

// Configurações > Formalização: modelos de texto e tipos (o master cria tipos novos)
export default function TiposFormalizacaoConfig() {
  const [tipos, setTipos] = useState(null)
  const [erro, setErro] = useState('')
  const [editando, setEditando] = useState(null)
  const [msg, setMsg] = useState('')
  const [alternar, setAlternar] = useState(null)
  const carregar = () => api.tiposFormalizacao().then(setTipos).catch((e) => setErro(e.message))
  useEffect(() => {
    carregar()
  }, [])
  const avisar = (m) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 3000)
  }
  if (!tipos) return erro ? <p className="erro">{erro}</p> : <div className="carregando">Carregando…</div>
  return (
    <div className="tipos-formalizacao">
      <div className="secao-cab">
        <p className="dica">O texto usa os marcadores {MARCADORES.join(' ')}. O bloco do checklist só entra quando todos os itens estão marcados.</p>
        <button type="button" className="btn btn-principal" onClick={() => setEditando({ ...NOVO, ordem: tipos.length + 1 })}>+ Novo tipo</button>
      </div>
      {msg && <span className="toast" role="status">{msg}</span>}
      <ul className="lista-lembretes">
        {tipos.map((t) => (
          <li key={t.id} className={t.ativo ? '' : 'lb-concluido'}>
            <span className="lb-info"><strong>{t.nome}{t.ativo ? '' : ' (desativado)'}</strong>
              <span className="celula-sub">Anexos: {t.anexos.map((a) => a.nome).join(', ') || 'nenhum'}{t.checklist.length ? ` · checklist com ${t.checklist.length} itens` : ''}{t.campos.length ? ` · campos: ${t.campos.map((c) => CAMPOS_FORMALIZACAO.find(([k]) => k === c)?.[1]).join(', ')}` : ''}</span></span>
            <span className="acoes-linha">
              <button type="button" className="btn btn-leve" onClick={() => setEditando(t)}>Editar</button>
              <button type="button" className={`btn btn-leve ${t.ativo ? 'texto-atraso' : ''}`} onClick={() => setAlternar(t)}>{t.ativo ? 'Desativar' : 'Reativar'}</button>
            </span>
          </li>
        ))}
      </ul>
      {editando && <TipoForm tipo={editando} novo={!editando.id} existentes={tipos} onFechar={() => setEditando(null)} onSalvo={async (m) => { setEditando(null); await carregar(); avisar(m) }} />}
      {alternar && <Confirmar titulo={`${alternar.ativo ? 'Desativar' : 'Reativar'} ${alternar.nome}?`} botao={alternar.ativo ? 'Desativar' : 'Reativar'}
        texto={alternar.ativo ? 'Some da lista de tipos ao criar uma formalização. As já enviadas continuam no histórico.' : 'Volta a aparecer na lista de tipos.'}
        onCancelar={() => setAlternar(null)} onConfirmar={async () => { await api.salvarTipoFormalizacao({ ...alternar, ativo: !alternar.ativo }); setAlternar(null); await carregar(); avisar('Salvo') }} />}
    </div>
  )
}

function TipoForm({ tipo, novo, existentes, onFechar, onSalvo }) {
  const [t, setT] = useState(() => JSON.parse(JSON.stringify({ ...tipo, bloco_checklist: tipo.bloco_checklist || '' })))
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const muda = (k, v) => setT((x) => ({ ...x, [k]: v }))
  const mudaLista = (lista, i, k, v) => setT((x) => ({ ...x, [lista]: x[lista].map((y, j) => (j === i ? { ...y, [k]: v } : y)) }))
  const previa = montarFormalizacao(t, { ...EXEMPLO, marcados: t.checklist.map(() => true) })
  async function salvar() {
    setErro('')
    const e = errosTipo(t)
    if (e) return setErro(e)
    const id = novo ? idDe(t.nome) : t.id
    if (novo && (id.length < 2 || existentes.some((x) => x.id === id))) return setErro('Já existe um tipo com esse nome.')
    const anexos = t.anexos.map((a) => ({ ...a, id: a.id || idDe(a.nome) || `anexo_${Math.random().toString(36).slice(2, 7)}` }))
    setOcupado(true)
    try {
      await api.salvarTipoFormalizacao({ ...t, id, anexos })
      onSalvo(novo ? 'Tipo criado' : 'Modelo salvo')
    } catch (err) {
      setErro(err.message)
      setOcupado(false)
    }
  }
  return (
    <Janela titulo={novo ? 'Novo tipo de formalização' : t.nome} rotulo="Configurações · Formalização" largura="grande" ocupado={ocupado} onFechar={onFechar} onSubmit={salvar}
      rodape={<>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="button" className="btn btn-leve" onClick={onFechar} disabled={ocupado}>Cancelar</button>
        <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
      </>}>
      <div className="grade grade-2">
        <Campo id="tf-nome" rotulo="Nome do tipo" obrigatorio><input id="tf-nome" value={t.nome} onChange={(e) => muda('nome', e.target.value)} /></Campo>
        <Campo id="tf-titulo" rotulo="Modelo do título" obrigatorio><input id="tf-titulo" value={t.titulo_modelo} onChange={(e) => muda('titulo_modelo', e.target.value)} /></Campo>
      </div>
      <Campo id="tf-texto" rotulo="Modelo do texto" obrigatorio ajuda={`Marcadores: ${MARCADORES.join(' ')}`}>
        <textarea id="tf-texto" rows={7} value={t.texto_modelo} onChange={(e) => muda('texto_modelo', e.target.value)} />
      </Campo>
      <div className="campo">
        <span className="rotulo-campo">Campos que o vendedor preenche</span>
        {CAMPOS_FORMALIZACAO.map(([k, rot]) => (
          <label key={k} className="check"><input type="checkbox" checked={t.campos.includes(k)} onChange={(e) => muda('campos', e.target.checked ? [...t.campos, k] : t.campos.filter((x) => x !== k))} /> {rot}</label>
        ))}
      </div>
      <fieldset className="grupo">
        <legend>Anexos</legend>
        {t.anexos.map((a, i) => (
          <div key={i} className="linha-editor">
            <input aria-label={`Nome do anexo ${i + 1}`} value={a.nome} onChange={(e) => mudaLista('anexos', i, 'nome', e.target.value)} placeholder="Ex.: Promob(s) vendido(s)" />
            <label className="check"><input type="checkbox" checked={a.multiplo} onChange={(e) => mudaLista('anexos', i, 'multiplo', e.target.checked)} /> Vários arquivos</label>
            <label className="check"><input type="checkbox" checked={a.obrigatorio} onChange={(e) => mudaLista('anexos', i, 'obrigatorio', e.target.checked)} /> Obrigatório</label>
            <button type="button" className="btn btn-leve texto-atraso" onClick={() => muda('anexos', t.anexos.filter((_, j) => j !== i))}>Remover</button>
          </div>
        ))}
        <button type="button" className="btn btn-contorno" onClick={() => muda('anexos', [...t.anexos, { id: '', nome: '', multiplo: false, obrigatorio: true }])}>+ Anexo</button>
      </fieldset>
      <fieldset className="grupo">
        <legend>Checklist</legend>
        <Campo id="tf-bloco" rotulo="Frase do bloco (entra antes dos itens)"><input id="tf-bloco" placeholder="Ex.: Solicito medição." value={t.bloco_checklist} onChange={(e) => muda('bloco_checklist', e.target.value)} /></Campo>
        {t.checklist.map((c, i) => (
          <div key={i} className="linha-editor">
            <input aria-label={`Pergunta ${i + 1}`} value={c.pergunta} placeholder="Pergunta na tela" onChange={(e) => mudaLista('checklist', i, 'pergunta', e.target.value)} />
            <input aria-label={`Texto ${i + 1}`} value={c.texto} placeholder="Texto no e-mail (✔ …)" onChange={(e) => mudaLista('checklist', i, 'texto', e.target.value)} />
            <button type="button" className="btn btn-leve texto-atraso" onClick={() => muda('checklist', t.checklist.filter((_, j) => j !== i))}>Remover</button>
          </div>
        ))}
        <button type="button" className="btn btn-contorno" onClick={() => muda('checklist', [...t.checklist, { pergunta: '', texto: '' }])}>+ Item</button>
      </fieldset>
      <div className="campo"><span className="rotulo-campo">Prévia (com dados de exemplo e checklist completo)</span>
        <pre className="conversa-texto"><strong>{previa.titulo}</strong>{'\n\n'}{previa.texto}</pre></div>
    </Janela>
  )
}
