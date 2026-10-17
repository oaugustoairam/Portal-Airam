import { useEffect, useState } from 'react'
import { diasAte, diasEntre, formatarData } from '../lib/constants.js'
import { useContador, useRevelar, reduzirMovimento } from '../lib/movimento.js'

const ANDARES = 8

function partes(dias) {
  const meses = Math.floor(dias / 30)
  const semanas = Math.floor((dias % 30) / 7)
  const resto = dias - meses * 30 - semanas * 7
  return { meses, semanas, dias: resto }
}

// Entrega futura: contagem regressiva até o imóvel ficar pronto para os móveis,
// com um prédio em obra que cresce conforme a data se aproxima.
export default function ContagemObra({ dataVenda, dataPronto }) {
  const [ref, visivel] = useRevelar()
  const restantes = Math.max(0, diasAte(dataPronto) ?? 0)
  const total = Math.max(1, diasEntre(dataVenda, dataPronto) ?? 1)
  const pct = Math.min(1, Math.max(0, 1 - restantes / total))
  const andares = Math.max(1, Math.round(pct * ANDARES))
  const contador = useContador(restantes, visivel, 1600)
  const p = partes(contador)
  const [cuboNoPredio, setCuboNoPredio] = useState(false)
  const [andarSel, setAndarSel] = useState(null)

  useEffect(() => {
    if (!cuboNoPredio) return
    const t = setTimeout(() => setCuboNoPredio(false), 4200)
    return () => clearTimeout(t)
  }, [cuboNoPredio])

  const chegou = restantes === 0
  const parado = reduzirMovimento()

  return (
    <section className={`obra ${visivel ? 'visivel' : ''} ${chegou ? 'obra-pronta' : ''}`} ref={ref} aria-labelledby="obra-titulo">
      <div className="obra-texto">
        <span className="rotulo obra-rotulo">Contagem para começar seus móveis</span>
        {chegou ? (
          <h2 id="obra-titulo" className="obra-titulo">Seu imóvel chegou na data prevista!</h2>
        ) : (
          <h2 id="obra-titulo" className="obra-titulo">
            Faltam <span className="obra-numero num">{contador}</span> {restantes === 1 ? 'dia' : 'dias'}
          </h2>
        )}
        {!chegou && (
          <div className="obra-unidades num" aria-hidden="true">
            <span><strong>{p.meses}</strong> {p.meses === 1 ? 'mês' : 'meses'}</span>
            <span><strong>{p.semanas}</strong> {p.semanas === 1 ? 'semana' : 'semanas'}</span>
            <span><strong>{p.dias}</strong> {p.dias === 1 ? 'dia' : 'dias'}</span>
          </div>
        )}
        <p className="obra-desc">
          {chegou
            ? 'Agora vamos agendar a medição e preparar o projeto final dos seus móveis.'
            : <>Previsão do imóvel pronto para os móveis: <strong className="num">{formatarData(dataPronto)}</strong>. Quando chegar a data, começamos a medição e o projeto final.</>}
        </p>
        <div className="obra-barra" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin="0" aria-valuemax="100" aria-label="Caminho até o imóvel ficar pronto">
          <span style={{ width: visivel ? `${pct * 100}%` : 0 }} />
        </div>
        <span className="obra-barra-legenda num">{Math.round(pct * 100)}% do caminho até o imóvel ficar pronto</span>
        <p className="obra-dica">{cuboNoPredio
          ? 'É aqui que seus móveis Airam vão chegar.'
          : andarSel !== null ? `Andar ${andarSel + 1} pronto.` : 'Toque no cubo vermelho do guindaste.'}</p>
      </div>

      <div className="obra-cena">
        <svg viewBox="0 0 400 300" role="img" aria-label={`Ilustração: prédio em obra com ${andares} de ${ANDARES} andares prontos`}>
          <defs>
            <linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fbeaea" />
              <stop offset="1" stopColor="#fff6f2" />
            </linearGradient>
          </defs>
          <rect width="400" height="300" fill="url(#ceu)" className="obra-ceu" />
          <circle cx="335" cy="58" r="22" className="obra-sol" />
          <g className={parado ? '' : 'obra-nuvens'}>
            <path d="M40 70c0-9 8-15 17-14 3-8 14-11 21-5 9-1 15 6 14 13H40Z" className="obra-nuvem" />
            <path d="M190 42c0-7 6-12 13-11 3-6 11-8 16-4 7-1 12 5 11 10h-40Z" className="obra-nuvem" />
          </g>
          <rect x="0" y="262" width="400" height="38" className="obra-chao" />

          {/* prédio: andares sobem conforme o tempo passa */}
          <g>
            {Array.from({ length: ANDARES }, (_, i) => {
              const y = 262 - (i + 1) * 26
              const feito = i < andares
              return (
                <g key={i} className={`andar ${feito ? 'andar-feito' : 'andar-falta'}`} style={{ '--i': i }}
                  onMouseEnter={() => feito && setAndarSel(i)} onMouseLeave={() => setAndarSel(null)}
                  onClick={() => feito && setAndarSel(i)}>
                  <rect x="70" y={y} width="150" height="26" className="andar-corpo" />
                  {[0, 1, 2, 3].map((j) => (
                    <rect key={j} x={82 + j * 35} y={y + 7} width="20" height="12" className="andar-janela" style={{ '--j': j }} />
                  ))}
                </g>
              )
            })}
            {/* andaime no topo enquanto a obra não termina */}
            {!chegou && (
              <g className="andaime">
                <path d={`M64 ${262 - andares * 26} v-22 M226 ${262 - andares * 26} v-22 M64 ${262 - andares * 26 - 22} h162 M64 ${262 - andares * 26 - 11} h162`} />
              </g>
            )}
          </g>

          {/* guindaste */}
          {!chegou && (
            <g className="guindaste">
              <path d="M300 262V60" className="guindaste-torre" />
              <path d="M290 262 300 60 310 262" className="guindaste-trelica" />
              <g className={parado ? '' : 'guindaste-braco'}>
                <path d="M300 64H160M300 64h40" className="guindaste-lanca" />
                <path d="M300 48 160 64M300 48l40 16M300 48v16" className="guindaste-cabo-fixo" />
                <rect x="332" y="64" width="16" height="16" className="guindaste-peso" />
                <g className={`carga ${cuboNoPredio ? 'carga-desce' : ''} ${parado ? 'carga-parada' : ''}`} style={{ '--topo': `${262 - andares * 26 - 40}px` }}>
                  <path d="M190 64v40" className="guindaste-cabo" />
                  <g onClick={() => setCuboNoPredio(true)} className="cubo-carga" role="button" tabIndex={0} aria-label="Cubo Airam"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setCuboNoPredio(true)}>
                    <path d="M190 104l14 8v16l-14 8-14-8v-16z" className="cubo-face" />
                    <path d="M176 112l14 8 14-8M190 120v16" className="cubo-linhas" />
                  </g>
                </g>
              </g>
            </g>
          )}
          {chegou && <text x="145" y="40" textAnchor="middle" className="obra-pronta-texto">PRONTO!</text>}
        </svg>
      </div>
    </section>
  )
}
