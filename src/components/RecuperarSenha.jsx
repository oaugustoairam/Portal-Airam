import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { formatarCpf } from '../lib/constants.js'

// "Esqueci minha senha": o cliente recebe um código por SMS ou e-mail e cria a nova senha sozinho.
export default function RecuperarSenha({ onVoltar, inicial = '' }) {
  const [passo, setPasso] = useState(1)
  const [id, setId] = useState(inicial)
  const [canal, setCanal] = useState('email')
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [passo])

  const regras = [
    [senha.length >= 8, 'Pelo menos 8 caracteres'],
    [/[A-Za-z]/.test(senha) && /\d/.test(senha), 'Letras e números'],
    [senha.length > 0 && senha === confirma, 'As duas senhas são iguais'],
  ]

  async function pedirCodigo(e) {
    e?.preventDefault()
    setErro('')
    setOcupado(true)
    try {
      setMsg(await api.recuperarSenha(id, canal))
      setPasso(2)
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  async function redefinir(e) {
    e.preventDefault()
    if (!regras.every(([ok]) => ok)) return
    setErro('')
    setOcupado(true)
    try {
      await api.redefinirSenha(id, codigo, senha)
    } catch (err) {
      setErro(err.message)
      setOcupado(false)
    }
  }

  return (
    <section className="login">
      <span className="rotulo login-eyebrow">Recuperar acesso</span>
      <h1 className="titulo-entrada">Crie uma <em>nova senha</em></h1>

      {passo === 1 ? (
        <form className="login-form" onSubmit={pedirCodigo}>
          <p className="login-texto">Enviamos um código de verificação para o contato do seu cadastro na Airam.</p>
          <div className="campo">
            <label htmlFor="rec-id">E-mail ou CPF</label>
            <input id="rec-id" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              value={id} placeholder="nome@email.com ou 000.000.000-00"
              onChange={(e) => {
                const v = e.target.value
                setId(/^[\d.\-\s]*$/.test(v) && v.replace(/\D/g, '').length > 3 ? formatarCpf(v) : v)
              }} />
          </div>
          <fieldset className="canal">
            <legend>Receber o código por</legend>
            {[['email', 'E-mail'], ['sms', 'SMS no celular']].map(([k, t]) => (
              <label key={k} className={`canal-opcao ${canal === k ? 'ativo' : ''}`}>
                <input type="radio" name="canal" value={k} checked={canal === k} onChange={() => setCanal(k)} />
                {t}
              </label>
            ))}
          </fieldset>
          <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Enviando…' : 'Enviar código'}</button>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button type="button" className="btn btn-leve voltar-login" onClick={onVoltar}>← Voltar para o login</button>
        </form>
      ) : (
        <form className="login-form" onSubmit={redefinir}>
          <p className="aviso" role="status">{msg}</p>
          <div className="campo">
            <label htmlFor="rec-codigo">Código de 6 dígitos</label>
            <input id="rec-codigo" className="codigo-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              required value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
          </div>
          <div className="campo">
            <label htmlFor="rec-senha">Nova senha</label>
            <input id="rec-senha" type="password" autoComplete="new-password"
              passwordrules="minlength: 8; required: lower; required: upper; required: digit;" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="rec-confirma">Repita a nova senha</label>
            <input id="rec-confirma" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
          </div>
          <ul className="regras">
            {regras.map(([ok, texto]) => (
              <li key={texto} className={ok ? 'regra-ok' : ''}>{ok ? '✓' : '·'} {texto}</li>
            ))}
          </ul>
          <button className="btn btn-principal" disabled={ocupado || codigo.length !== 6 || !regras.every(([ok]) => ok)}>
            {ocupado ? 'Salvando…' : 'Salvar nova senha e entrar'}
          </button>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <div className="acoes">
            <button type="button" className="btn btn-leve" onClick={() => pedirCodigo()} disabled={ocupado}>Reenviar código</button>
            <button type="button" className="btn btn-leve" onClick={onVoltar}>Voltar para o login</button>
          </div>
        </form>
      )}
    </section>
  )
}
