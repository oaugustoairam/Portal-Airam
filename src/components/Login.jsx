import { useState } from 'react'
import { api, MODO_DEMO } from '../lib/api.js'
import { formatarIdentificador } from '../lib/constants.js'
import logoVermelho from '../assets/logo-vermelho.png'
import RecuperarSenha from './RecuperarSenha.jsx'

export default function Login() {
  const [id, setId] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [recuperando, setRecuperando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setErro('')
    setOcupado(true)
    try {
      await api.entrar(id, senha)
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  // formata como CPF ou telefone quando o número fica completo
  const mudarId = (v) => setId(formatarIdentificador(v))

  const demo = MODO_DEMO ? api.contasDemo() : null
  if (recuperando) return <RecuperarSenha inicial={id} onVoltar={() => setRecuperando(false)} />

  return (
    <section className="login">
      <img className="login-marca" src={logoVermelho} alt="Airam Arquitetura & Marcenaria" />
      <span className="rotulo login-eyebrow">Portal do cliente</span>
      <h1 className="titulo-entrada">Acompanhe <em>seus móveis</em> do projeto à montagem</h1>
      <p className="login-texto">
        Prazos, contrato e projetos em um só lugar. Entre com o e-mail, o CPF ou o telefone cadastrado na Airam.
      </p>

      <form className="login-form" onSubmit={entrar}>
        <div className="campo">
          <label htmlFor="login-id">E-mail, CPF ou telefone</label>
          <input id="login-id" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={id}
            onChange={(e) => mudarId(e.target.value)} placeholder="E-mail, CPF ou celular" />
        </div>
        <div className="campo">
          <label htmlFor="login-senha">Senha</label>
          <input id="login-senha" type="password" required autoComplete="current-password"
            value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        <button className="btn btn-principal" disabled={ocupado}>
          {ocupado ? 'Entrando…' : 'Entrar'}
        </button>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="button" className="link-esqueci" onClick={() => setRecuperando(true)}>Esqueci minha senha</button>
      </form>

      {demo && (
        <div className="demo-atalhos">
          <span className="rotulo">Contas da demonstração (senha {demo.senha})</span>
          <div className="demo-botoes">
            {demo.contas.map((c) => (
              <button key={c.email} type="button" className="btn btn-contorno"
                onClick={() => api.entrar(c.email, c.senha).catch((e) => setErro(e.message))}>
                {c.papel === 'cliente' ? `Cliente · ${c.nome.split(' ')[0]}` : 'Equipe Airam'}
                {c.precisa_trocar_senha ? ' (1º acesso)' : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
