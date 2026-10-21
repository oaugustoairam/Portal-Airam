import { useEffect, useState } from 'react'
import { api, MODO_DEMO } from '../lib/api.js'
import { PAPEIS } from '../lib/permissoes.js'
import { Confirmar } from './comercial/comum.jsx'

const quando = (t) => (t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

// Meu perfil (equipe): dados de acesso e a caixa de e-mail da Hostinger usada nas formalizações
export default function MeuPerfilEquipe({ perfil }) {
  const [caixa, setCaixa] = useState(undefined)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [remover, setRemover] = useState(false)
  useEffect(() => {
    api.minhaCaixa().then((c) => {
      setCaixa(c)
      setEmail(c?.email || perfil.email || '')
    }).catch((e) => setErro(e.message))
  }, [])
  const avisar = (m) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 4000)
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErro('E-mail inválido.')
    if (!caixa && !senha) return setErro('Informe a senha da caixa de e-mail.')
    setOcupado('salvar')
    try {
      const c = await api.salvarCaixa(email.trim(), senha)
      setSenha('')
      setCaixa(c)
      avisar(c?.teste_ok ? 'Caixa salva e conexão testada com sucesso' : 'Caixa salva, mas o teste falhou (veja abaixo)')
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado('')
    }
  }
  async function testar() {
    setErro('')
    setOcupado('testar')
    try {
      const c = await api.testarCaixa()
      setCaixa(c)
      avisar(c?.teste_ok ? 'Conexão funcionando' : 'A conexão falhou (veja abaixo)')
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado('')
    }
  }

  return (
    <section className="gestao meu-perfil-equipe">
      <div className="titulo-processo">
        <span className="rotulo">Meu perfil</span>
        <h1 className="titulo-grande">{perfil.nome || perfil.email}</h1>
        <p className="dica">{PAPEIS.find(([k]) => k === perfil.papel)?.[1]} · {perfil.email}{perfil.whatsapp ? ` · WhatsApp ${perfil.whatsapp}` : ''}. Nome, papel e WhatsApp são alterados pelo master.</p>
      </div>

      <form className="grupo caixa-email" onSubmit={salvar}>
        <h2 className="du-legenda">Caixa de e-mail (Hostinger)</h2>
        <p className="dica">As formalizações saem do portal pela sua conta corporativa e ficam também em "Enviados" no mail.hostinger.com.
          A senha é guardada cifrada no servidor e nunca aparece na tela.</p>
        {MODO_DEMO && <div className="aviso-config">Demonstração: a caixa é salva, mas nenhuma conexão real é testada e nenhum e-mail sai.</div>}
        {caixa === undefined ? <p className="vazio-mini">Carregando…</p> : (
          <>
            <div className="grade grade-2">
              <div className="campo">
                <label htmlFor="cx-email">E-mail da caixa</label>
                <input id="cx-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="cx-senha">Senha da caixa</label>
                <input id="cx-senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)}
                  placeholder={caixa ? '•••••••• (salva — preencha só para trocar)' : ''} />
              </div>
            </div>
            <p className="ajuda">Servidores: envio smtp.hostinger.com (porta 465, SSL) · cópia em Enviados imap.hostinger.com (porta 993, SSL).</p>
            {caixa && (
              <p className={caixa.teste_ok ? 'ok-texto' : 'erro'} role="status">
                {caixa.teste_ok ? `Conexão OK (testada em ${quando(caixa.testado_em)})` : `Falhou no teste de ${quando(caixa.testado_em)}: ${caixa.erro || 'sem detalhes'}`}
              </p>
            )}
            {erro && <p className="erro" role="alert">{erro}</p>}
            <div className="acoes">
              <button className="btn btn-principal" disabled={!!ocupado}>{ocupado === 'salvar' ? 'Salvando e testando…' : 'Salvar e testar'}</button>
              {caixa && <button type="button" className="btn btn-contorno" onClick={testar} disabled={!!ocupado}>{ocupado === 'testar' ? 'Testando…' : 'Testar conexão'}</button>}
              {caixa && <button type="button" className="btn btn-leve texto-atraso" onClick={() => setRemover(true)} disabled={!!ocupado}>Remover caixa</button>}
              {msg && <span className="toast" role="status">{msg}</span>}
            </div>
          </>
        )}
      </form>
      {remover && <Confirmar titulo="Remover a caixa de e-mail?" botao="Remover" texto="A senha é apagada do servidor. Para enviar formalizações de novo, cadastre outra vez."
        onCancelar={() => setRemover(false)} onConfirmar={async () => { await api.removerCaixa(); setRemover(false); setCaixa(null); setSenha(''); avisar('Caixa removida') }} />}
    </section>
  )
}
