// WhatsApp da Airam para dúvidas dos clientes. Configure VITE_WHATSAPP_AIRAM no .env
// (somente números, com 55 + DDD), por exemplo 5511999999999.
// Padrão: (11) 94088-7123, o celular do cabeçalho do contrato Airam (confirme se é o WhatsApp de atendimento)
export const WHATSAPP_AIRAM = (import.meta.env.VITE_WHATSAPP_AIRAM || '5511940887123').replace(/\D/g, '')

export function linkWhatsApp(numero, texto) {
  const n = String(numero || '').replace(/\D/g, '')
  if (!n) return null
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}
