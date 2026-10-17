// Detecção de aparelho para o aviso de instalação do app.
export function ehIOS() {
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// true quando o portal foi aberto pelo ícone da tela de início (app instalado)
export function ehAppInstalado() {
  return navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches
}

export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {}) // sem service worker o site funciona igual
  })
}
