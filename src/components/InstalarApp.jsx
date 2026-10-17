import { useEffect, useState } from 'react'
import { ehIOS, ehAppInstalado } from '../lib/plataforma.js'

const CHAVE = 'airam-instalar-fechado-ate'

function fechadoAgora() {
  try {
    return Number(localStorage.getItem(CHAVE) || 0) > Date.now()
  } catch {
    return false
  }
}

// Convite para instalar o portal como app: passo a passo no iPhone, botão direto no Android.
export default function InstalarApp() {
  const [visivel, setVisivel] = useState(false)
  const [promptAndroid, setPromptAndroid] = useState(null)
  const ios = ehIOS()

  useEffect(() => {
    if (ehAppInstalado() || fechadoAgora()) return
    if (ios) setVisivel(true)
    const antes = (e) => {
      e.preventDefault()
      setPromptAndroid(e)
      setVisivel(true)
    }
    window.addEventListener('beforeinstallprompt', antes)
    return () => window.removeEventListener('beforeinstallprompt', antes)
  }, [])

  function fechar() {
    setVisivel(false)
    try {
      localStorage.setItem(CHAVE, String(Date.now() + 30 * 86400000)) // pergunta de novo em 30 dias
    } catch {}
  }

  async function instalarAndroid() {
    promptAndroid.prompt()
    await promptAndroid.userChoice.catch(() => {})
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <aside className="instalar" aria-label="Instalar o app Airam">
      <img src="./apple-touch-icon.png" alt="" className="instalar-icone" width="44" height="44" />
      <div className="instalar-texto">
        <strong>Tenha o app Airam no celular</strong>
        {ios ? (
          <span>
            Toque em <IconeCompartilhar /> <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.
          </span>
        ) : (
          <span>Acesse seus prazos e documentos direto da tela inicial.</span>
        )}
      </div>
      <div className="instalar-acoes">
        {promptAndroid && <button className="btn btn-principal" onClick={instalarAndroid}>Instalar</button>}
        <button className="btn btn-leve" onClick={fechar} aria-label="Fechar aviso">Agora não</button>
      </div>
    </aside>
  )
}

function IconeCompartilhar() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" className="icone-compartilhar" aria-label="ícone Compartilhar" role="img">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}
