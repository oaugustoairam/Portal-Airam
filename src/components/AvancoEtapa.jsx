import { useEffect, useRef, useState } from 'react'
import { Icone, GUIA, quandoEtapa } from './Jornada.jsx'

// Transição de fase: quando o processo avança desde a última visita, o cliente vê a etapa
// anterior se fechar e a nova se abrir. No primeiro acesso, mostra onde o processo está.
// A última etapa vista fica guardada neste aparelho, por processo.
export default function AvancoEtapa({ processoId, etapas }) {
  const tudoFeito = etapas.every((e) => e.status === 'concluida')
  const iAtual = tudoFeito ? etapas.length : Math.max(0, etapas.findIndex((e) => e.status === 'atual'))
  const chave = `airam-etapa-vista-${processoId}`
  const [aberto, setAberto] = useState(null) // { de, primeira }
  const botao = useRef(null)

  useEffect(() => {
    let vista = null
    try {
      vista = localStorage.getItem(chave)
    } catch {}
    const n = vista === null ? null : Number(vista)
    if (n === null) setAberto(iAtual > 0 ? { de: iAtual - 1, primeira: true } : null)
    else if (iAtual > n) setAberto({ de: iAtual - 1, primeira: false })
    else guardar()
  }, [processoId, iAtual])

  useEffect(() => {
    if (!aberto) return
    botao.current?.focus()
    const tecla = (e) => e.key === 'Escape' && fechar()
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [aberto])

  function guardar() {
    try {
      localStorage.setItem(chave, String(iAtual))
    } catch {}
  }
  function fechar(verJornada = false) {
    guardar()
    setAberto(null)
    if (verJornada) document.getElementById('jornada')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!aberto) return null
  const anterior = etapas[aberto.de]
  const nova = etapas[iAtual] // indefinida quando tudo foi concluído
  const guia = nova ? GUIA[nova.id] : null
  const quando = nova ? quandoEtapa(nova) : null
  const titulo = tudoFeito ? 'Montagem concluída' : nova.nome

  return (
    <div className="avanco" role="dialog" aria-modal="true" aria-labelledby="avanco-titulo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="avanco-cartao">
        <span className="avanco-eyebrow">
          {tudoFeito ? 'Seu processo foi concluído' : aberto.primeira ? 'Onde seu processo está agora' : 'Seu processo avançou'}
        </span>

        <div className="avanco-cena" aria-hidden="true">
          <div className="avanco-no avanco-de">
            <span className="avanco-icone"><Icone etapa={{ ...anterior, status: 'concluida' }} /></span>
            <span className="avanco-rotulo">{anterior.nome}</span>
          </div>
          <span className="avanco-ligacao"><span /></span>
          <div className="avanco-no avanco-para">
            <span className="avanco-icone">
              {nova ? <Icone etapa={nova} simbolo /> : <Icone etapa={{ ...anterior, status: 'concluida' }} />}
            </span>
            <span className="avanco-rotulo">{nova ? nova.nome : 'Concluído'}</span>
          </div>
        </div>

        <h2 id="avanco-titulo" className="avanco-titulo">{tudoFeito ? titulo : <>Agora: <em>{titulo}</em></>}</h2>
        <p className="avanco-texto">
          {tudoFeito ? 'Seus móveis estão prontos. Obrigado por escolher a Airam. A garantia dos seus móveis está no portal.' : guia?.acontece}
        </p>
        {quando && <p className="avanco-quando num">{quando}</p>}
        {guia?.voce?.length > 0 && (
          <ul className="avanco-lista">
            {guia.voce.map((t) => <li key={t}>{t}</li>)}
          </ul>
        )}

        <div className="avanco-acoes">
          <button ref={botao} className="btn btn-principal" onClick={() => fechar(true)}>Ver minha jornada</button>
          <button className="btn btn-leve" onClick={() => fechar()}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
