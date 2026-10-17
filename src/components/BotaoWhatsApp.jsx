import { useState } from 'react'
import { WHATSAPP_AIRAM, linkWhatsApp } from '../lib/contato.js'
import { MODO_DEMO } from '../lib/api.js'

// Botão flutuante: abre o WhatsApp da Airam com a mensagem já começada (nome e código do cliente).
export default function BotaoWhatsApp({ nome, codigo }) {
  const [aberto, setAberto] = useState(false)
  const texto = nome
    ? `Olá! Sou ${nome}${codigo ? `, código ${codigo}` : ''}. Tenho uma dúvida sobre meu processo.`
    : 'Olá! Tenho uma dúvida sobre o Portal Airam.'
  // sem número configurado: na demonstração abre o WhatsApp para escolher o contato; no ar, não mostra
  const url = linkWhatsApp(WHATSAPP_AIRAM, texto) || (MODO_DEMO ? `https://wa.me/?text=${encodeURIComponent(texto)}` : null)
  if (!url) return null
  return (
    <div className={`whats ${aberto ? 'whats-aberto' : ''}`} onMouseEnter={() => setAberto(true)} onMouseLeave={() => setAberto(false)}>
      <span className="whats-balao" aria-hidden="true">Dúvidas? Fale com a Airam</span>
      <a className="whats-botao" href={url} target="_blank" rel="noreferrer" aria-label="Tirar dúvidas pelo WhatsApp da Airam">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path fill="currentColor" d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.4.7 4.7 1.9 6.7L3 29l6.9-2.2c1.9 1 4 1.6 6.1 1.6 7 0 12.7-5.7 12.7-12.7S23 3 16 3Zm0 23.2c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-4.1 1.3 1.3-4-.3-.4a10.4 10.4 0 0 1-1.6-5.7C5.5 9.9 10.2 5.3 16 5.3s10.4 4.6 10.4 10.4S21.8 26.2 16 26.2Zm5.7-7.8c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.5 8.5 0 0 1-4.2-3.7c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5 1.9.8 2.6.9 3.6.7.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4l-.4-.3Z" />
        </svg>
      </a>
    </div>
  )
}
