import { useEffect, useRef, useState } from 'react'

// Gráficos das métricas (SVG/HTML simples): uma cor por série, passar o mouse mostra o valor,
// e cada gráfico tem a visão em tabela.

export function Grafico({ titulo, sub, tabela, children, largo }) {
  const [verTabela, setVerTabela] = useState(false)
  return (
    <figure className={`grafico ${largo ? 'grafico-largo' : ''}`}>
      <figcaption>
        <span>
          <strong>{titulo}</strong>
          {sub && <small>{sub}</small>}
        </span>
        {tabela && <button type="button" className="btn btn-leve" aria-pressed={verTabela} onClick={() => setVerTabela((x) => !x)}>{verTabela ? 'Ver gráfico' : 'Ver tabela'}</button>}
      </figcaption>
      {verTabela && tabela ? <TabelaDados {...tabela} /> : children}
    </figure>
  )
}

export function TabelaDados({ colunas, linhas }) {
  if (!linhas.length) return <p className="vazio-mini">Sem dados no período.</p>
  return (
    <div className="tabela-rolagem">
      <table className="tabela-metricas">
        <thead><tr>{colunas.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{linhas.map((l, i) => <tr key={i}>{l.map((v, j) => (j === 0 ? <th key={j} scope="row">{v}</th> : <td key={j}>{v}</td>))}</tr>)}</tbody>
      </table>
    </div>
  )
}

// barras horizontais: itens [{ rotulo, valor, texto, dica }]
export function Barras({ itens, serie = 1 }) {
  const [foco, setFoco] = useState(null)
  if (!itens.length) return <p className="vazio-mini">Sem dados no período.</p>
  const max = Math.max(...itens.map((x) => x.valor || 0), 0) || 1
  return (
    <ul className="barras" onMouseLeave={() => setFoco(null)}>
      {itens.map((x, i) => (
        <li key={`${x.rotulo}-${i}`} className={foco === i ? 'foco' : ''} onMouseEnter={() => setFoco(i)} tabIndex={0} onFocus={() => setFoco(i)} onBlur={() => setFoco(null)}
          aria-label={`${x.rotulo}: ${x.texto}${x.dica ? ` (${x.dica})` : ''}`}>
          <span className="barra-rotulo">{x.rotulo}</span>
          <span className="barra-trilho">
            <span className={`barra serie-${serie}`} style={{ width: `${Math.max(0.5, ((x.valor || 0) / max) * 100)}%` }} />
          </span>
          <span className="barra-valor">{x.texto}</span>
          {foco === i && x.dica && <span className="barra-dica" role="tooltip">{x.dica}</span>}
        </li>
      ))}
    </ul>
  )
}

// linhas no tempo com a mesma escala: pontos [{ x, rotulo, valores: {chave: n} }], series [{ chave, nome }]
export function Linhas({ pontos, series, formato = (v) => v }) {
  const [foco, setFoco] = useState(null)
  const ref = useRef(null)
  const [L, setL] = useState(640)
  // desenha na largura real (o texto não estica)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setL(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [pontos.length > 0])
  if (!pontos.length) return <p className="vazio-mini">Sem dados no período.</p>
  const A = 220
  const m = { e: 36, d: 12, t: 12, b: 26 }
  const max = Math.max(1, ...pontos.flatMap((p) => series.map((s) => p.valores[s.chave] || 0)))
  const passo = Math.pow(10, Math.floor(Math.log10(max)))
  const topo = Math.ceil(max / passo) * passo
  const x = (i) => m.e + (pontos.length === 1 ? (L - m.e - m.d) / 2 : (i / (pontos.length - 1)) * (L - m.e - m.d))
  const y = (v) => m.t + (1 - v / topo) * (A - m.t - m.b)
  const marcas = [0, topo / 2, topo]
  const cada = Math.ceil(pontos.length / Math.max(2, Math.floor(L / 70)))
  return (
    <div className="linhas">
      <div className="legenda">
        {series.map((s, i) => <span key={s.chave}><i className={`marca serie-${i + 1}`} />{s.nome}</span>)}
      </div>
      <div className="linhas-area" ref={ref}>
        <svg width={L} height={A} viewBox={`0 0 ${L} ${A}`} role="img" aria-label={series.map((s) => s.nome).join(' e ') + ' por mês'}
          onMouseLeave={() => setFoco(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const px = ((e.clientX - r.left) / r.width) * L
            let melhor = 0
            pontos.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(melhor) - px)) melhor = i })
            setFoco(melhor)
          }}>
          {marcas.map((v) => (
            <g key={v}>
              <line x1={m.e} x2={L - m.d} y1={y(v)} y2={y(v)} className="grade-linha" />
              <text x={m.e - 6} y={y(v) + 4} textAnchor="end" className="eixo-texto">{formato(v)}</text>
            </g>
          ))}
          {pontos.map((p, i) => (i % cada === 0 || i === pontos.length - 1) && <text key={p.x} x={x(i)} y={A - 6} textAnchor="middle" className="eixo-texto">{p.rotulo}</text>)}
          {foco !== null && <line x1={x(foco)} x2={x(foco)} y1={m.t} y2={A - m.b} className="mira" />}
          {series.map((s, si) => (
            <g key={s.chave} className={`serie-${si + 1}`}>
              <polyline fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="traco"
                points={pontos.map((p, i) => `${x(i)},${y(p.valores[s.chave] || 0)}`).join(' ')} />
              {pontos.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.valores[s.chave] || 0)} r={foco === i ? 5 : 3.5} className="ponto" />)}
            </g>
          ))}
        </svg>
        {foco !== null && (
          <div className="linhas-dica" role="tooltip" style={{ left: `${(x(foco) / L) * 100}%` }}>
            <strong>{pontos[foco].rotulo}</strong>
            {series.map((s, i) => <span key={s.chave}><i className={`marca serie-${i + 1}`} />{s.nome}: {formato(pontos[foco].valores[s.chave] || 0)}</span>)}
          </div>
        )}
      </div>
    </div>
  )
}
