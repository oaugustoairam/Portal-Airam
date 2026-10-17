import { useEffect, useState } from 'react'
import { api, MODO_DEMO } from '../lib/api.js'

const NOMES = { contrato: 'contrato', projeto_final: 'projeto final' }

// Assinatura dentro do portal: abre a tela do ZapSign num iframe, sem o cliente sair do site.
export default function AssinaturaModal({ assinatura, documento, nomeCliente, onFechar, onAssinado }) {
  const [assinado, setAssinado] = useState(false)

  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onFechar()
    // eventos que o widget do ZapSign envia para a página
    const mensagem = (e) => {
      let host = ''
      try {
        host = new URL(e.origin).hostname
      } catch {}
      if (!/(^|\.)zapsign\.(com\.br|co)$/.test(host)) return
      if (e.data === 'zs-doc-signed') setAssinado(true)
    }
    window.addEventListener('keydown', tecla)
    window.addEventListener('message', mensagem)
    return () => {
      window.removeEventListener('keydown', tecla)
      window.removeEventListener('message', mensagem)
    }
  }, [])

  // depois de assinar, o ZapSign avisa o servidor (webhook); recarregamos em seguida
  useEffect(() => {
    if (!assinado) return
    const t = setTimeout(onAssinado, 2500)
    return () => clearTimeout(t)
  }, [assinado])

  return (
    <div className="modal" role="dialog" aria-label={`Assinar ${NOMES[assinatura.tipo]}`}>
      <div className="modal-assinatura">
        <header className="modal-assinatura-topo">
          <div>
            <span className="rotulo">Assinatura eletrônica</span>
            <strong>Assinar o {NOMES[assinatura.tipo]}</strong>
          </div>
          <button className="btn btn-leve" onClick={onFechar}>Fechar</button>
        </header>
        {assinado ? (
          <div className="assinado-ok">
            <span className="assinado-selo" aria-hidden="true">✓</span>
            <strong>Assinatura concluída</strong>
            <p>Obrigado! O documento assinado aparece no seu portal em instantes.</p>
          </div>
        ) : assinatura.sign_url ? (
          <iframe className="zapsign-frame" src={assinatura.sign_url} title="Assinatura ZapSign" allow="camera" />
        ) : MODO_DEMO ? (
          <SimulacaoZapSign assinatura={assinatura} documento={documento} nomeCliente={nomeCliente}
            onConcluir={() => setAssinado(true)} />
        ) : (
          <p className="assinado-ok">O link de assinatura ainda está sendo preparado. Tente novamente em alguns minutos.</p>
        )}
        <footer className="modal-assinatura-rodape">Assinatura com validade jurídica via ZapSign</footer>
      </div>
    </div>
  )
}

// Só na demonstração: imita as etapas da tela do ZapSign (ler, confirmar nome, código por e-mail).
function SimulacaoZapSign({ assinatura, documento, nomeCliente, onConcluir }) {
  const [url, setUrl] = useState(null)
  const [nome, setNome] = useState('')
  const [aceite, setAceite] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (documento) api.urlDocumento(documento).then(setUrl)
  }, [documento?.id])

  async function assinar(e) {
    e.preventDefault()
    if (codigo !== '123456') return setErro('Código incorreto. Na demonstração, use 123456.')
    await api.assinarDemo(assinatura.id)
    onConcluir()
  }

  return (
    <form className="simulacao" onSubmit={assinar}>
      <p className="simulacao-aviso">Simulação da tela do ZapSign. No portal real, a tela oficial abre aqui.</p>
      {url && (
        <a className="btn btn-contorno" href={url} target="_blank" rel="noreferrer">
          Ler o documento: {documento.titulo}
        </a>
      )}
      <div className="campo">
        <label htmlFor="sim-nome">Digite seu nome completo</label>
        <input id="sim-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder={nomeCliente} />
      </div>
      <label className="check">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
        Li e concordo com o documento
      </label>
      <div className="campo">
        <label htmlFor="sim-codigo">Código enviado ao seu e-mail (demonstração: 123456)</label>
        <input id="sim-codigo" inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
      </div>
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-principal" disabled={nome.trim().length < 3 || !aceite || codigo.length !== 6}>
        Assinar
      </button>
    </form>
  )
}
