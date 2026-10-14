import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { faseAtual, formatarData } from '../lib/constants.js'
import ProjetoView from './ProjetoView.jsx'

export default function ClienteHome() {
  const [projetos, setProjetos] = useState(null)
  const [aberto, setAberto] = useState(null)

  useEffect(() => {
    api.listarProjetos().then(async (lista) => {
      setProjetos(lista)
      if (lista.length === 1) setAberto(await api.projeto(lista[0].id))
    })
  }, [])

  if (!projetos) return <div className="carregando">Carregando seus projetos…</div>

  if (!projetos.length)
    return (
      <div className="vazio-grande">
        <h1 className="titulo-grande">Nenhum projeto por aqui ainda</h1>
        <p>Seu projeto aparece assim que o escritório cadastrá-lo com este e-mail.</p>
      </div>
    )

  if (aberto)
    return (
      <>
        {projetos.length > 1 && (
          <button className="btn btn-leve voltar" onClick={() => setAberto(null)}>
            ← Meus projetos
          </button>
        )}
        <ProjetoView projeto={aberto} />
      </>
    )

  return (
    <section>
      <h1 className="titulo-grande">Meus projetos</h1>
      <ul className="cartoes">
        {projetos.map((p) => (
          <li key={p.id}>
            <button className="cartao" onClick={async () => setAberto(await api.projeto(p.id))}>
              <strong>{p.nome}</strong>
              <span>Fase atual: {faseAtual(p.fases)?.nome || '—'}</span>
              <span className="num">Entrega: {formatarData(p.prazo_final)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
