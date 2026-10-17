import { useState } from 'react'
import { LOJAS, INSTAGRAM_AIRAM, SITE_AIRAM, mapaEmbutido, comoChegar, abrirNoWaze } from '../lib/contato.js'

const tracos = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const IconeInstagram = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" {...tracos} /><circle cx="12" cy="12" r="4" {...tracos} /><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" /></svg>
)
export const IconeSite = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...tracos} /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5Z" {...tracos} /></svg>
)
const IconeLocal = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" {...tracos} /><circle cx="12" cy="10" r="2.4" {...tracos} /></svg>
)

function Loja({ loja }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(loja.endereco)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {}
  }
  return (
    <article className="loja">
      <div className="loja-mapa">
        <iframe title={`Mapa da ${loja.nome}`} src={mapaEmbutido(loja)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </div>
      <div className="loja-info">
        <span className="loja-cidade"><IconeLocal />{loja.cidade}</span>
        <h2 className="loja-nome">{loja.nome}</h2>
        <address className="loja-endereco">{loja.endereco}</address>
        <div className="loja-acoes">
          <a className="btn btn-principal" href={comoChegar(loja)} target="_blank" rel="noreferrer">Como chegar</a>
          <a className="btn btn-contorno" href={abrirNoWaze(loja)} target="_blank" rel="noreferrer">Abrir no Waze</a>
          <button type="button" className="btn btn-leve" onClick={copiar}>{copiado ? 'Endereço copiado' : 'Copiar endereço'}</button>
        </div>
      </div>
    </article>
  )
}

// Aba "Nossas lojas" do cliente: endereços com mapa e caminhos para Instagram e site.
export default function NossasLojas() {
  return (
    <section className="lojas">
      <div>
        <span className="rotulo">Airam Arquitetura & Marcenaria</span>
        <h1 className="titulo-grande">Nossas lojas</h1>
        <p className="lojas-intro">Venha nos visitar. Toque em "Como chegar" para abrir o caminho no seu celular.</p>
      </div>
      <div className="lojas-lista">
        {LOJAS.map((l) => <Loja key={l.id} loja={l} />)}
      </div>
      <div className="lojas-redes">
        <a className="rede" href={INSTAGRAM_AIRAM} target="_blank" rel="noreferrer">
          <IconeInstagram />
          <span><strong>Instagram</strong><small>@airam_arquitetura.marcenaria</small></span>
        </a>
        <a className="rede" href={SITE_AIRAM} target="_blank" rel="noreferrer">
          <IconeSite />
          <span><strong>Site</strong><small>airam.arq.br</small></span>
        </a>
      </div>
    </section>
  )
}
