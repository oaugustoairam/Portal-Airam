import { formatarData } from '../lib/constants.js'
import { useRevelar } from '../lib/movimento.js'

function somarAnos(iso, anos) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  d.setFullYear(d.getFullYear() + anos)
  return d.toISOString().slice(0, 10)
}
function somarDias(iso, dias) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Garantias do contrato Airam. Depois da montagem, mostra até quando vale cada uma.
export default function Garantia({ montagemEm }) {
  const [ref, visivel] = useRevelar()
  const itens = [
    { prazo: '10', unidade: 'anos', nome: 'Madeira', texto: 'Garantia da estrutura de madeira dos seus móveis.', ate: montagemEm && somarAnos(montagemEm, 10) },
    { prazo: '1', unidade: 'ano', nome: 'Ferragens e acessórios', texto: 'Dobradiças, corrediças, puxadores e acessórios, a contar da instalação.', ate: montagemEm && somarAnos(montagemEm, 1) },
    { prazo: '90', unidade: 'dias', nome: 'Fabricação e montagem', texto: 'Defeitos de fabricação ou de montagem, após o Termo de Vistoria. Atendimento em até 45 dias úteis.', ate: montagemEm && somarDias(montagemEm, 90) },
  ]
  return (
    <section className={`bloco garantia revelar ${visivel ? 'visivel' : ''}`} ref={ref}>
      <h2 className="titulo-secao">Sua garantia Airam</h2>
      <div className="garantia-grade">
        {itens.map((g, i) => (
          <div key={g.nome} className="garantia-item" style={{ '--i': i }}>
            <span className="garantia-prazo num">{g.prazo}<small>{g.unidade}</small></span>
            <strong>{g.nome}</strong>
            <p>{g.texto}</p>
            {g.ate && <span className="garantia-ate num">Válida até {formatarData(g.ate)}</span>}
          </div>
        ))}
      </div>
      <details className="garantia-mais">
        <summary>O que a garantia não cobre</summary>
        <ul>
          <li>Desgaste natural do uso, infiltrações de água, cupins e outras pragas.</li>
          <li>Móveis montados ou desmontados por pessoas não credenciadas pela Airam.</li>
          <li>Serviços elétricos, hidráulicos, de gás, telefone e internet.</li>
          <li>Danos causados depois da vistoria, inclusive por outros profissionais na obra.</li>
        </ul>
      </details>
    </section>
  )
}
