import { useRef } from 'react'

// Campo de data com calendário: abre o calendário ao tocar no campo ou no ícone.
export default function CampoData({ id, rotulo, valor, onChange, obrigatorio, desabilitado, ajuda }) {
  const ref = useRef(null)
  const abrir = () => {
    try {
      ref.current?.showPicker?.()
    } catch {}
  }
  return (
    <div className="campo">
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio && <span className="obrigatorio" aria-hidden="true"> *</span>}
      </label>
      <div className="campo-data">
        <input
          ref={ref}
          id={id}
          type="date"
          required={obrigatorio}
          disabled={desabilitado}
          value={valor || ''}
          onChange={(e) => onChange(e.target.value)}
          onClick={abrir}
        />
        <button type="button" className="campo-data-btn" onClick={abrir} disabled={desabilitado}
          aria-label={`Abrir calendário: ${rotulo}`}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {ajuda && <span className="ajuda">{ajuda}</span>}
    </div>
  )
}
