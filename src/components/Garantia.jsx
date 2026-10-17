import { formatarData } from '../lib/constants.js'
import { useRevelar } from '../lib/movimento.js'

function somarAnos(iso, anos) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  d.setFullYear(d.getFullYear() + anos)
  return d.toISOString().slice(0, 10)
}

const tracos = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }

// Ferragens com amortecimento: padrão dos móveis Airam (ao lado da garantia)
function Ferragens() {
  return (
    <aside className="ferragens" aria-label="Ferragens com amortecimento">
      <span className="ferragens-rotulo">Padrão Airam</span>
      <h3 className="ferragens-titulo">Fechamento suave em todo o móvel</h3>
      <div className="ferragem">
        <svg className="ferragem-icone ferragem-porta" viewBox="0 0 48 48" aria-hidden="true">
          <rect x="8" y="6" width="32" height="36" rx="2" {...tracos} />
          <path className="porta" d="M24 6v36" {...tracos} />
          <circle cx="12" cy="14" r="1.6" fill="currentColor" /><circle cx="12" cy="34" r="1.6" fill="currentColor" />
        </svg>
        <div>
          <strong>Dobradiças com amortecimento</strong>
          <p>As portas desaceleram no final e fecham devagar, sem batidas e sem barulho, protegendo os móveis do impacto.</p>
        </div>
      </div>
      <div className="ferragem">
        <svg className="ferragem-icone ferragem-gaveta" viewBox="0 0 48 48" aria-hidden="true">
          <rect x="6" y="10" width="36" height="28" rx="2" {...tracos} />
          <g className="gaveta"><rect x="10" y="20" width="28" height="10" rx="1.5" {...tracos} /><path d="M20 25h8" {...tracos} /></g>
        </svg>
        <div>
          <strong>Corrediças ocultas com amortecimento</strong>
          <p>As gavetas deslizam leves e fecham sozinhas no final do curso. As corrediças ficam escondidas embaixo da gaveta, deixando o acabamento mais limpo.</p>
        </div>
      </div>
    </aside>
  )
}

// Garantia Airam: 10 anos na madeira. Depois da montagem, mostra até quando vale.
export default function Garantia({ montagemEm }) {
  const [ref, visivel] = useRevelar()
  return (
    <section className={`bloco garantia revelar ${visivel ? 'visivel' : ''}`} ref={ref}>
      <span className="rotulo-mono secao-mono">Garantia</span>
      <div className="garantia-duas">
      <div className="garantia-linha">
        <div className="garantia-numero">
          <span className="num">10</span>
          <small>anos</small>
        </div>
        <div className="garantia-texto">
          <p className="garantia-frase">Garantia da madeira dos seus móveis Airam.</p>
          {montagemEm
            ? <span className="pilula pilula-ok num">Válida até {formatarData(somarAnos(montagemEm, 10))}</span>
            : <span className="garantia-sub">Começa a contar na conclusão da montagem.</span>}
          <details className="garantia-mais">
            <summary>O que a garantia não cobre</summary>
            <ul>
              <li>Desgaste natural do uso, infiltrações de água, cupins e outras pragas.</li>
              <li>Móveis montados ou desmontados por pessoas não credenciadas pela Airam.</li>
              <li>Serviços elétricos, hidráulicos, de gás, telefone e internet.</li>
            </ul>
          </details>
        </div>
      </div>
      <Ferragens />
      </div>
    </section>
  )
}
