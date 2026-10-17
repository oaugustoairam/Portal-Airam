import { FOTOS } from '../lib/fotos.js'
import { SITE_AIRAM, INSTAGRAM_AIRAM } from '../lib/contato.js'
import { useRevelar } from '../lib/movimento.js'

const DIFERENCIAIS = ['Atendimento', 'Projetos', 'Design', 'Entrega', 'Pós-venda', 'Assessoria na sua obra']

const PROCESSO = [
  ['Atendimento', 'Com as suas informações em mãos, damos início ao atendimento.'],
  ['Projeto', 'Damos o toque profissional para que o seu projeto tenha um design bonito e funcional.'],
  ['Seus móveis', 'Com o design, as medidas, cores, ferragens e puxadores definidos, e aquele custo-benefício exclusivo para você, em poucos dias seus móveis estão na sua casa.'],
]

// Quem somos: o mesmo texto do site airam.arq.br, no layout do portal
export default function QuemSomos() {
  const [ref, visivel] = useRevelar()
  const foto = FOTOS.find((f) => f.nome === 'Living') || FOTOS[0]
  return (
    <section className={`quem-somos revelar ${visivel ? 'visivel' : ''}`} ref={ref}>
      <header className="qs-cab">
        <span className="rotulo-mono">Quem somos</span>
        <h1 className="titulo-grande">O sonho de uma casa planejada, bonita e funcional.</h1>
      </header>

      <figure className="qs-foto">
        <img src={foto.src} alt="Ambiente planejado Airam" loading="lazy" />
      </figure>

      <div className="qs-numeros" role="list">
        <div role="listitem"><strong className="num">25</strong><span>anos de experiência em móveis planejados</span></div>
        <div role="listitem"><strong className="num">2019</strong><span>o ano em que a Airam nasceu</span></div>
        <div role="listitem"><strong className="num">10</strong><span>anos de garantia na madeira</span></div>
      </div>

      <div className="qs-texto">
        <p className="qs-destaque">
          A Airam Arquitetura &amp; Marcenaria está no mercado para idealizar e realizar o sonho de uma casa planejada, bonita e funcional.
        </p>
        <p>
          Idealizada por empreendedores com 25 anos de experiência no mercado de móveis planejados.
          Em 2019, foi tomada a decisão de entrar no mercado, com o propósito de trazer diferenciais em atendimento, projetos, design, entrega e
          pós-venda, além do suporte e assessoria geral em sua obra.
        </p>
        <p>
          Temos um departamento formado por arquitetos que lhe dará suporte não só nos seus móveis, mas em qualquer outro setor da sua obra ou reforma.
        </p>
      </div>

      <ul className="qs-diferenciais" aria-label="Nossos diferenciais">
        {DIFERENCIAIS.map((d) => <li key={d}>{d}</li>)}
      </ul>

      <div className="qs-bloco">
        <span className="rotulo-mono">Nosso processo</span>
        <ol className="qs-processo">
          {PROCESSO.map(([t, d], i) => (
            <li key={t}>
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <strong>{t}</strong>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="qs-bloco qs-mobiliario">
        <span className="rotulo-mono">Mobiliário sob medida</span>
        <p>
          Nossos móveis planejados são de altíssima qualidade para ambientes residenciais, comerciais, hoteleiros, entre outros. Uma fábrica nova,
          equipada com máquinas da mais alta tecnologia e dimensionadas para atender às novas exigências do mercado.
        </p>
        <p>
          Os produtos se destacam pelo design, onde forma e função interagem naturalmente, com soluções práticas e inovadoras para os mais variados
          ambientes. Os materiais são de excelente qualidade e a madeira vem de reflorestamento, respeitando a preservação do ecossistema.
        </p>
      </div>

      <div className="qs-contato">
        <div>
          <span className="rotulo-mono">Atendimento</span>
          <p>Segunda a sábado, das 10h às 20h<br />Fechado aos domingos e feriados</p>
        </div>
        <div>
          <span className="rotulo-mono">Telefone</span>
          <p><a href="tel:+551124471006" className="num">(11) 2447-1006</a></p>
        </div>
        <div className="qs-links">
          <a className="btn btn-contorno" href={SITE_AIRAM} target="_blank" rel="noreferrer">Visitar o site</a>
          <a className="btn btn-contorno" href={INSTAGRAM_AIRAM} target="_blank" rel="noreferrer">Instagram</a>
        </div>
      </div>
    </section>
  )
}
