import { useEffect, useState } from 'react'
import { diasAte, diasEntre, formatarData } from '../lib/constants.js'
import { useContador, useRevelar, reduzirMovimento } from '../lib/movimento.js'
import cubo from '../assets/cubo-vermelho.png'

const MARCAS = 60

// Ângulo animado de 0 até o alvo (efeito de ponteiro de relógio). Reinicia quando `rodada` muda.
function useAngulo(alvo, ativo, rodada) {
  const [ang, setAng] = useState(reduzirMovimento() ? alvo : 0)
  useEffect(() => {
    if (!ativo) return
    if (reduzirMovimento()) return setAng(alvo)
    let quadro
    const inicio = performance.now()
    const duracao = 2600
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / duracao)
      // avanço "em passos", como um ponteiro que anda de marca em marca
      const suave = 1 - Math.pow(1 - t, 3)
      const passos = Math.floor((suave * alvo) / 6) * 6
      setAng(t < 1 ? passos : alvo)
      if (t < 1) quadro = requestAnimationFrame(passo)
    }
    setAng(0)
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [alvo, ativo, rodada])
  return ang
}

// Entrega futura: o logo da Airam vai "carregando" como um relógio até o imóvel ficar pronto.
export default function ContagemObra({ dataVenda, dataPronto }) {
  const [ref, visivel] = useRevelar()
  const [rodada, setRodada] = useState(0)
  const restantes = Math.max(0, diasAte(dataPronto) ?? 0)
  const total = Math.max(1, diasEntre(dataVenda, dataPronto) ?? 1)
  const pct = Math.min(1, Math.max(0, 1 - restantes / total))
  const ang = useAngulo(pct * 360, visivel, rodada)
  const contador = useContador(restantes, visivel, 2000)
  const chegou = restantes === 0

  return (
    <section className={`contagem ${visivel ? 'visivel' : ''}`} ref={ref} aria-labelledby="contagem-titulo">
      <div className="contagem-texto">
        <span className="rotulo-mono">Contagem</span>
        {chegou ? (
          <h2 id="contagem-titulo" className="contagem-titulo">Seu imóvel chegou na data prevista. <span>Vamos agendar a medição.</span></h2>
        ) : (
          <h2 id="contagem-titulo" className="contagem-titulo">
            Faltam <span className="contagem-num num">{contador}</span> {restantes === 1 ? 'dia' : 'dias'}{' '}
            <span>para começarmos o projeto dos seus móveis.</span>
          </h2>
        )}
        <dl className="numeros">
          <div>
            <dt>Imóvel pronto</dt>
            <dd className="num">{formatarData(dataPronto)}</dd>
          </div>
          <div>
            <dt>Do caminho</dt>
            <dd className="num">{Math.round((ang / 360) * 100)}%</dd>
          </div>
        </dl>
        <p className="contagem-desc">Quando o imóvel estiver pronto, fazemos a medição e o projeto final. A partir daí, você acompanha cada etapa por aqui.</p>
      </div>

      <button type="button" className="relogio" onClick={() => setRodada((r) => r + 1)}
        aria-label={`${Math.round(pct * 100)}% do caminho até o imóvel ficar pronto. Toque para ver de novo.`}
        style={{ '--ang': `${ang}deg` }}>
        <svg className="relogio-marcas" viewBox="0 0 300 300" aria-hidden="true">
          {Array.from({ length: MARCAS }, (_, i) => {
            const a = (i / MARCAS) * 2 * Math.PI
            const grande = i % 5 === 0
            const r1 = grande ? 128 : 134
            const x1 = 150 + Math.sin(a) * r1, y1 = 150 - Math.cos(a) * r1
            const x2 = 150 + Math.sin(a) * 142, y2 = 150 - Math.cos(a) * 142
            const aceso = (i / MARCAS) * 360 < ang
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={`marca ${grande ? 'marca-grande' : ''} ${aceso ? 'marca-acesa' : ''}`} />
          })}
        </svg>
        <span className="relogio-logo relogio-base" style={{ backgroundImage: `url(${cubo})` }} aria-hidden="true" />
        <span className="relogio-logo relogio-cheio" style={{ backgroundImage: `url(${cubo})` }} aria-hidden="true" />
        <span className="relogio-ponteiro" aria-hidden="true" />
        <span className="relogio-segundos" aria-hidden="true" />
        <span className="relogio-centro" aria-hidden="true" />
      </button>
    </section>
  )
}
