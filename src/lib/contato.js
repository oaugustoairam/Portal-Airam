// WhatsApp da Airam para dúvidas dos clientes. Configure VITE_WHATSAPP_AIRAM no .env
// (somente números, com 55 + DDD), por exemplo 5511999999999.
// WhatsApp de atendimento da Airam: (11) 98977-6738
export const WHATSAPP_AIRAM = (import.meta.env.VITE_WHATSAPP_AIRAM || '5511989776738').replace(/\D/g, '')

export function linkWhatsApp(numero, texto) {
  const n = String(numero || '').replace(/\D/g, '')
  if (!n) return null
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

export const INSTAGRAM_AIRAM = 'https://www.instagram.com/airam_arquitetura.marcenaria/'
export const SITE_AIRAM = 'https://airam.arq.br'

export const LOJAS = [
  {
    id: 'mooca',
    nome: 'Airam Arquitetura e Marcenaria - Mooca',
    cidade: 'Mooca · São Paulo',
    endereco: 'Av. Paes de Barros, 3399 - 3º andar - sala 34 - Parque da Mooca, São Paulo - SP, 03149-100',
  },
  {
    id: 'guarulhos',
    nome: 'Airam Arquitetura e Marcenaria - Guarulhos',
    cidade: 'Guarulhos',
    endereco: 'R. dos Cubas, 127 - Jardim São Paulo, Guarulhos - SP, 07110-111',
  },
]

const q = (t) => encodeURIComponent(t)
export const mapaEmbutido = (loja) => `https://www.google.com/maps?q=${q(loja.endereco)}&output=embed`
export const comoChegar = (loja) => `https://www.google.com/maps/dir/?api=1&destination=${q(loja.endereco)}`
export const abrirNoWaze = (loja) => `https://waze.com/ul?q=${q(loja.endereco)}&navigate=yes`
