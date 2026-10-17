// Fotos de ambientes Airam (do site airam.arq.br), usadas na vitrine de entrada e no topo do processo.
import cozinha from '../assets/fotos/cozinha.webp'
import living from '../assets/fotos/living.webp'
import closet from '../assets/fotos/closet.webp'
import dormitorio from '../assets/fotos/dormitorio.webp'
import homeOffice from '../assets/fotos/home-office.webp'
import cozinhaPreta from '../assets/fotos/cozinha-preta.webp'

export const FOTOS = [
  { src: cozinhaPreta, nome: 'Cozinha', frase: 'Feita sob medida para o seu jeito de viver' },
  { src: closet, nome: 'Closet', frase: 'Cada detalhe pensado com você' },
  { src: living, nome: 'Living', frase: 'Projeto, fábrica e montagem em um só lugar' },
  { src: dormitorio, nome: 'Dormitório', frase: '10 anos de garantia nos seus móveis' },
  { src: homeOffice, nome: 'Home office', frase: 'Acompanhe cada etapa pelo portal' },
  { src: cozinha, nome: 'Cozinha', frase: 'Do projeto à montagem, com transparência' },
]

// Escolhe uma foto que combine com os ambientes do processo
export function fotoDoProcesso(ambientes = '') {
  const a = ambientes.toLowerCase()
  const achar = (t) => FOTOS.find((f) => f.nome.toLowerCase() === t)
  if (a.includes('closet')) return achar('closet')
  if (a.includes('home')) return achar('home office')
  if (a.includes('dormit') || a.includes('suíte') || a.includes('suite')) return achar('dormitório')
  if (a.includes('sala') || a.includes('living')) return achar('living')
  return FOTOS[0]
}
