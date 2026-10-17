import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { PERMISSOES, PAPEIS, temPermissao } from '../lib/permissoes.js'

// Tela do master: quem tem acesso à área interna e o que cada pessoa pode fazer.
export default function Usuarios({ perfil }) {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [editando, setEditando] = useState(null) // usuário ou 'novo'

  const carregar = () => api.listarUsuarios().then(setLista).catch((e) => setErro(e.message))
  useEffect(() => {
    carregar()
  }, [])

  if (erro) return <p className="erro">{erro}</p>
  if (!lista) return <div className="carregando">Carregando…</div>

  return (
    <section className="gestao usuarios">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Master</span>
          <h1 className="titulo-grande">Usuários e permissões</h1>
          <p className="dica">Só o master vê esta tela. Cada pessoa entra com o próprio e-mail e senha.</p>
        </div>
        <button className="btn btn-principal" onClick={() => setEditando('novo')}>Novo usuário</button>
      </div>

      <ul className="usuarios-lista">
        {lista.map((u) => (
          <li key={u.id}>
            <button type="button" className="usuario-cartao" onClick={() => setEditando(u)}>
              <span className="usuario-topo">
                <strong>{u.nome || u.email}</strong>
                <span className={`chip chip-mini ${u.papel === 'admin' ? 'chip-sit-ok' : 'chip-sit-neutro'}`}>{PAPEIS.find(([k]) => k === u.papel)?.[1]}</span>
              </span>
              <span className="celula-sub">{u.email}{u.id === perfil.id ? ' · você' : ''}</span>
              <span className="usuario-perms">
                {PERMISSOES.filter(([k]) => temPermissao(u, k)).map(([k, t]) => <span key={k}>{t}</span>)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {editando && (
        <EditarUsuario u={editando === 'novo' ? null : editando} eu={perfil}
          onFechar={(mudou) => { setEditando(null); if (mudou) carregar() }} />
      )}
    </section>
  )
}

function EditarUsuario({ u, eu, onFechar }) {
  const [f, setF] = useState(() => ({ email: u?.email || '', nome: u?.nome || '', papel: u?.papel || 'vendedor', permissoes: { ...(u?.permissoes || {}) } }))
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [senha, setSenha] = useState(null)
  const souEu = u && u.id === eu.id
  const atual = { papel: f.papel, permissoes: f.permissoes }

  const marcar = (k, v) => setF((x) => ({ ...x, permissoes: { ...x.permissoes, [k]: v } }))
  const mudarPapel = (papel) => setF((x) => ({ ...x, papel, permissoes: {} })) // volta ao padrão do papel

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    setOcupado(true)
    try {
      if (u) {
        await api.definirAcesso(u.id, f.papel, f.permissoes, f.nome)
        onFechar(true)
      } else {
        const r = await api.criarUsuario({ email: f.email, nome: f.nome, papel: f.papel, permissoes: f.permissoes })
        setSenha(r.senha)
      }
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="modal" role="presentation">
      <form className="confirmar-exclusao usuario-form" role="dialog" aria-modal="true" aria-labelledby="usr-t" onSubmit={salvar}>
        <span className="rotulo">{u ? 'Editar acesso' : 'Novo usuário interno'}</span>
        <h2 id="usr-t">{u ? u.nome || u.email : 'Dar acesso a uma pessoa da loja'}</h2>
        {senha ? (
          <>
            <div className="senha-gerada">
              <span className="rotulo">Senha provisória de {f.email}</span>
              <strong className="senha-valor">{senha}</strong>
              <span className="dica">Envie para a pessoa. No primeiro acesso ela cria a própria senha. A senha não fica salva: copie agora.</span>
            </div>
            <div className="acoes"><button type="button" className="btn btn-principal" onClick={() => onFechar(true)}>Pronto</button></div>
          </>
        ) : (
          <>
            <div className="grade grade-2">
              <div className="campo">
                <label htmlFor="usr-nome">Nome</label>
                <input id="usr-nome" value={f.nome} onChange={(e) => setF((x) => ({ ...x, nome: e.target.value }))} required />
              </div>
              <div className="campo">
                <label htmlFor="usr-email">E-mail</label>
                <input id="usr-email" type="email" value={f.email} disabled={!!u} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} required />
              </div>
            </div>
            <div className="campo">
              <span className="rotulo-campo" id="usr-papel">Papel</span>
              <div className="segmentado" role="radiogroup" aria-labelledby="usr-papel">
                {PAPEIS.map(([k, t]) => (
                  <button key={k} type="button" role="radio" aria-checked={f.papel === k} className={f.papel === k ? 'ativo' : ''}
                    disabled={souEu && k !== 'admin'} onClick={() => mudarPapel(k)}>{t}</button>
                ))}
              </div>
              <span className="ajuda">{PAPEIS.find(([k]) => k === f.papel)?.[2]}{souEu ? ' · você não pode tirar o seu próprio acesso de master' : ''}</span>
            </div>
            {f.papel !== 'admin' && (
              <fieldset className="grupo usuario-permissoes">
                <legend>Permissões</legend>
                {PERMISSOES.map(([k, t, d]) => (
                  <label key={k} className="permissao">
                    <input type="checkbox" checked={temPermissao(atual, k)} onChange={(e) => marcar(k, e.target.checked)} />
                    <span><strong>{t}</strong><small>{d}</small></span>
                  </label>
                ))}
              </fieldset>
            )}
            {erro && <p className="erro" role="alert">{erro}</p>}
            <div className="acoes">
              <button type="button" className="btn btn-leve" onClick={() => onFechar(false)} disabled={ocupado}>Cancelar</button>
              <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : u ? 'Salvar acesso' : 'Criar e gerar senha'}</button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
