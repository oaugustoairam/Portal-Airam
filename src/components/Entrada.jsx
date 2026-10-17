import Vitrine from './Vitrine.jsx'
import logoBranco from '../assets/logo-branco.png'
import InstalarApp from './InstalarApp.jsx'

// Tela de entrada em duas metades: vitrine de ambientes + painel (login ou criar senha).
// No celular, a vitrine fica no topo e o painel sobe por cima dela.
export default function Entrada({ children }) {
  return (
    <div className="entrada">
      <div className="entrada-vitrine">
        <Vitrine />
        <img className="entrada-logo" src={logoBranco} alt="Airam Arquitetura & Marcenaria" />
      </div>
      <div className="entrada-painel">
        <div className="entrada-conteudo">
          {children}
          <InstalarApp />
        </div>
        <footer className="entrada-rodape">
          <span>Airam Guarulhos · Airam Mooca</span>
          <a href="https://airam.arq.br" target="_blank" rel="noreferrer">airam.arq.br</a>
        </footer>
      </div>
    </div>
  )
}
