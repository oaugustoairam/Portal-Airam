import { formatarData } from '../lib/constants.js'
import { useRevelar } from '../lib/movimento.js'

function somarAnos(iso, anos) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  d.setFullYear(d.getFullYear() + anos)
  return d.toISOString().slice(0, 10)
}

// Garantia Airam: 10 anos na madeira. Depois da montagem, mostra até quando vale.
export default function Garantia({ montagemEm }) {
  const [ref, visivel] = useRevelar()
  return (
    <section className={`bloco garantia revelar ${visivel ? 'visivel' : ''}`} ref={ref}>
      <span className="rotulo-mono secao-mono">Garantia</span>
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
    </section>
  )
}
