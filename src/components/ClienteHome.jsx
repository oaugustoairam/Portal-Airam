import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { linhaDoTempo, etapaAtual, formatarData } from '../lib/constants.js'
import ProcessoView from './ProcessoView.jsx'

export default function ClienteHome() {
  const [processos, setProcessos] = useState(null)
  const [aberto, setAberto] = useState(null)

  const abrir = async (id) => setAberto(await api.processo(id))

  useEffect(() => {
    api.listarProcessos().then((lista) => {
      setProcessos(lista)
      if (lista.length === 1) abrir(lista[0].id)
    })
  }, [])

  if (!processos) return <div className="carregando">Carregando seu processo…</div>

  if (!processos.length)
    return (
      <div className="vazio-grande">
        <h1 className="titulo-grande">Nenhum processo por aqui ainda</h1>
        <p>Seu processo aparece assim que a Airam cadastrá-lo com este e-mail.</p>
      </div>
    )

  if (aberto)
    return (
      <>
        {processos.length > 1 && (
          <button className="btn btn-leve voltar" onClick={() => setAberto(null)}>← Meus processos</button>
        )}
        <ProcessoView processo={aberto} onAtualizar={() => abrir(aberto.id)} />
      </>
    )

  return (
    <section>
      <h1 className="titulo-grande">Meus processos</h1>
      <ul className="cartoes">
        {processos.map((p) => (
          <li key={p.id}>
            <button className="cartao" onClick={() => abrir(p.id)}>
              <strong>{p.codigo}</strong>
              <span>Etapa atual: {etapaAtual(linhaDoTempo(p, p.assinaturas)).nome}</span>
              <span className="num">Entrega prevista: {formatarData(p.data_entrega_prevista)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
