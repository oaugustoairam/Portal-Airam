import { useState } from 'react'
import { api } from '../lib/api.js'

// Primeiro acesso: o cliente troca a senha provisória por uma senha dele.
export default function TrocarSenha({ perfil }) {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const regras = [
    [senha.length >= 8, 'Pelo menos 8 caracteres'],
    [/[A-Za-z]/.test(senha) && /\d/.test(senha), 'Letras e números'],
    [senha.length > 0 && senha === confirma, 'As duas senhas são iguais'],
  ]
  const valida = regras.every(([ok]) => ok)

  async function salvar(e) {
    e.preventDefault()
    if (!valida) return
    setErro('')
    setOcupado(true)
    try {
      await api.trocarSenha(senha)
    } catch (err) {
      setErro(err.message)
      setOcupado(false)
    }
  }

  return (
    <section className="login">
      <span className="rotulo">Primeiro acesso</span>
      <h1 className="titulo-grande">Crie sua senha</h1>
      <p className="login-texto">
        Olá{perfil.nome ? `, ${perfil.nome.split(' ')[0]}` : ''}! A senha que você recebeu é provisória.
        Escolha uma senha só sua para acessar o Portal Airam.
      </p>
      <form className="login-form" onSubmit={salvar}>
        <div className="campo">
          <label htmlFor="nova-senha">Nova senha</label>
          <input id="nova-senha" type="password" autoComplete="new-password" passwordrules="minlength: 8; required: lower; required: upper; required: digit;" value={senha}
            onChange={(e) => setSenha(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="confirma-senha">Repita a nova senha</label>
          <input id="confirma-senha" type="password" autoComplete="new-password" value={confirma}
            onChange={(e) => setConfirma(e.target.value)} />
        </div>
        <ul className="regras">
          {regras.map(([ok, texto]) => (
            <li key={texto} className={ok ? 'regra-ok' : ''}>{ok ? '✓' : '·'} {texto}</li>
          ))}
        </ul>
        <button className="btn btn-principal" disabled={!valida || ocupado}>
          {ocupado ? 'Salvando…' : 'Salvar e entrar'}
        </button>
        {erro && <p className="erro" role="alert">{erro}</p>}
      </form>
    </section>
  )
}
