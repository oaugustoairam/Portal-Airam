// WhatsApp da Airam para dúvidas dos clientes. Configure VITE_WHATSAPP_AIRAM no .env
// (somente números, com 55 + DDD), por exemplo 5511999999999.
// WhatsApp de atendimento da Airam: (11) 98977-6738
export const WHATSAPP_AIRAM = (import.meta.env.VITE_WHATSAPP_AIRAM || '5511989776738').replace(/\D/g, '')

export function linkWhatsApp(numero, texto) {
  const n = String(numero || '').replace(/\D/g, '')
  if (!n) return null
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}
