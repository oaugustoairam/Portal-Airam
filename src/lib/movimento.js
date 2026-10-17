// Pequenos utilitários de animação. Respeitam "reduzir movimento" do aparelho.
import { useEffect, useRef, useState } from 'react'

export const reduzirMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Marca o elemento como visível quando ele entra na tela (para animar a entrada).
export function useRevelar(opcoes = {}) {
  const ref = useRef(null)
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window) || reduzirMovimento()) return setVisivel(true)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisivel(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.15, ...opcoes }
    )
    io.observe(el)
    const seguranca = setTimeout(() => setVisivel(true), 2500) // nunca deixa nada escondido
    return () => {
      io.disconnect()
      clearTimeout(seguranca)
    }
  }, [])
  return [ref, visivel]
}

// Conta de 0 até o valor (efeito de contador).
export function useContador(alvo, ativo = true, duracao = 1100) {
  const [valor, setValor] = useState(reduzirMovimento() ? alvo : 0)
  useEffect(() => {
    if (!ativo || reduzirMovimento()) return setValor(alvo)
    let quadro
    const inicio = performance.now()
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / duracao)
      setValor(Math.round(alvo * (1 - Math.pow(1 - t, 3))))
      if (t < 1) quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [alvo, ativo])
  return valor
}
