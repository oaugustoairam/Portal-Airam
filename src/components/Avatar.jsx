import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export const iniciais = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?'

// Foto de perfil do cliente (ou as iniciais, se ainda não tiver foto)
export default function Avatar({ caminho, nome, tamanho = 40, className = '' }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let vivo = true
    if (!caminho) return setUrl(null)
    api.urlFotoPerfil(caminho).then((u) => vivo && setUrl(u)).catch(() => {})
    return () => (vivo = false)
  }, [caminho])
  return (
    <span className={`avatar ${className}`} style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.36 }} aria-hidden="true">
      {url ? <img src={url} alt="" /> : iniciais(nome)}
    </span>
  )
}
