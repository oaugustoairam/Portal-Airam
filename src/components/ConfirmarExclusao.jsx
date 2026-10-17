import { useEffect, useRef, useState } from 'react'

// Pergunta de segurança antes de apagar um cliente: mostra o que será perdido e
// só libera o botão depois de digitar EXCLUIR.
export default function ConfirmarExclusao({ nome, codigo, texto: explicacao, onConfirmar, onCancelar }) {
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const ref = useRef(null)
  const ok = texto.trim().toUpperCase() === 'EXCLUIR'

  useEffect(() => {
    ref.current?.focus()
    const esc = (e) => e.key === 'Escape' && !ocupado && onCancelar()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [ocupado])

  async function confirmar(e) {
    e.preventDefault()
    if (!ok) return
    setErro('')
    setOcupado(true)
    try {
      await onConfirmar()
    } catch (err) {
      setErro(err.message)
      setOcupado(false)
    }
  }

  return (
    <div className="modal modal-exclusao" role="presentation" onClick={() => !ocupado && onCancelar()}>
      <form className="confirmar-exclusao" role="alertdialog" aria-modal="true" aria-labelledby="exc-titulo" aria-describedby="exc-texto"
        onClick={(e) => e.stopPropagation()} onSubmit={confirmar}>
        <span className="rotulo texto-atraso">Atenção · não dá para desfazer</span>
        <h2 id="exc-titulo">Tem certeza que quer apagar {nome}{codigo ? ` (${codigo})` : ''}?</h2>
        <p id="exc-texto">
          {explicacao || 'Some tudo deste cliente: dados da venda, processo, anexos, renders, pasta, assinaturas e controle interno. O cliente deixa de ver o processo no portal.'}
        </p>
        <label htmlFor="exc-confirma">Para confirmar, digite <strong>EXCLUIR</strong></label>
        <input id="exc-confirma" ref={ref} value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes">
          <button type="button" className="btn btn-leve" onClick={onCancelar} disabled={ocupado}>Cancelar</button>
          <button className="btn btn-perigo" disabled={!ok || ocupado}>{ocupado ? 'Apagando…' : 'Apagar para sempre'}</button>
        </div>
      </form>
    </div>
  )
}
