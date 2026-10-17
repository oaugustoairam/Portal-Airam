import { useEffect, useState } from 'react'
import { FOTOS } from '../lib/fotos.js'
import { reduzirMovimento } from '../lib/movimento.js'

const TEMPO = 6000

// Vitrine de ambientes: fotos em sequência com zoom lento, barras de progresso estilo stories.
export default function Vitrine() {
  const [atual, setAtual] = useState(0)
  const [pausado, setPausado] = useState(false)

  useEffect(() => {
    if (pausado || reduzirMovimento()) return
    const t = setTimeout(() => setAtual((i) => (i + 1) % FOTOS.length), TEMPO)
    return () => clearTimeout(t)
  }, [atual, pausado])

  const foto = FOTOS[atual]
  return (
    <section className="vitrine" aria-label="Ambientes Airam" onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)}>
      {FOTOS.map((f, i) => (
        <img key={i} src={f.src} alt="" aria-hidden={i !== atual} className={`vitrine-foto ${i === atual ? 'ativa' : ''}`}
          loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
      ))}
      <div className="vitrine-veu" />
      <div className="vitrine-barras" role="tablist" aria-label="Escolher ambiente">
        {FOTOS.map((f, i) => (
          <button key={i} role="tab" aria-selected={i === atual} aria-label={`${f.nome} ${i + 1}`} onClick={() => setAtual(i)}
            className={`vitrine-barra ${i < atual ? 'cheia' : ''} ${i === atual ? 'enchendo' : ''} ${pausado ? 'pausada' : ''}`}>
            <span style={{ animationDuration: TEMPO + 'ms' }} />
          </button>
        ))}
      </div>
      <div className="vitrine-texto" key={atual}>
        <span className="vitrine-ambiente">{foto.nome}</span>
        <p className="vitrine-frase">{foto.frase}</p>
      </div>
    </section>
  )
}
