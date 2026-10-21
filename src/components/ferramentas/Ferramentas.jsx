import DiasUteis from './DiasUteis.jsx'
import Formalizacao from './Formalizacao.jsx'

// Aba Ferramentas (vendedor, gerente e master; o captador não acessa — regra no banco)
export const pastasFerramentas = () => [['dias_uteis', 'Dias úteis'], ['formalizacao', 'Formalização']]

export default function Ferramentas({ aba, perfil, irParaPerfil }) {
  if (aba === 'dias_uteis') return <DiasUteis />
  if (aba === 'formalizacao') return <Formalizacao perfil={perfil} irParaPerfil={irParaPerfil} />
  return null
}
