import { useState } from 'react'
import { api, MODO_DEMO } from '../lib/api.js'
import logoVermelho from '../assets/logo-vermelho.png'

export default function Login() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    setOcupado(true)
    try {
      const r = await api.entrar(email.trim())
      if (!r?.direto) setEnviado(true)
    } catch (err) {
      setErro('Não foi possível enviar o link. Confira o e-mail e tente de novo.')
    } finally {
      setOcupado(false)
    }
  }

  const demo = MODO_DEMO ? api.emailsDemo() : null

  return (
    <section className="login">
      <img className="login-marca" src={logoVermelho} alt="Airam Arquitetura & Marcenaria" />
      <h1 className="titulo-grande">Acompanhe seu projeto</h1>
      <p className="login-texto">
        Do projeto à montagem: veja em que fase estão seus móveis, os prazos combinados e todos os
        documentos, como contrato, projeto inicial, renders e projeto final.
      </p>

      {enviado ? (
        <div className="aviso">
          Enviamos um link de acesso para <strong>{email}</strong>. Abra o e-mail e toque no link
          para entrar.
        </div>
      ) : (
        <form className="login-form" onSubmit={enviar}>
          <label htmlFor="login-email">Seu e-mail</label>
          <input
            id="login-email"
            type="email"
            required
            placeholder="nome@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn btn-principal" disabled={ocupado}>
            {MODO_DEMO ? 'Entrar' : ocupado ? 'Enviando…' : 'Receber link de acesso'}
          </button>
          {erro && <p className="erro">{erro}</p>}
          {!MODO_DEMO && (
            <p className="dica">Sem senha: você recebe um link por e-mail a cada acesso.</p>
          )}
        </form>
      )}

      {demo && (
        <div className="demo-atalhos">
          <span className="rotulo">Entrar na demonstração como</span>
          <div className="demo-botoes">
            <button className="btn btn-contorno" onClick={() => api.entrar(demo.escritorio)}>
              Escritório
            </button>
            {demo.clientes.map((c) => (
              <button key={c} className="btn btn-contorno" onClick={() => api.entrar(c)}>
                Cliente · {c.split('@')[0]}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
