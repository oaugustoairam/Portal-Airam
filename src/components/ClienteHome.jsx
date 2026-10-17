import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { linhaDoTempo, etapaAtual, formatarData, ROTULO_PRAZO } from '../lib/constants.js'
import ProcessoView from './ProcessoView.jsx'
import BotaoWhatsApp from './BotaoWhatsApp.jsx'
import MeuPerfil from './MeuPerfil.jsx'
import NossasLojas from './NossasLojas.jsx'

export default function ClienteHome({ aba = 'processo', onPerfilAtualizado }) {
  const [processos, setProcessos] = useState(null)
  const [aberto, setAberto] = useState(null)

  const abrir = async (id, topo = true) => {
    setAberto(await api.processo(id))
    if (topo) window.scrollTo(0, 0)
  }

  useEffect(() => {
    api.listarProcessos().then((lista) => {
      setProcessos(lista)
      if (lista.length === 1) abrir(lista[0].id)
    })
  }, [])

  if (!processos) return <div className="carregando">Carregando seu processo…</div>

  if (aba === 'lojas')
    return (
      <>
        <NossasLojas />
        <BotaoWhatsApp nome={processos[0]?.cliente_nome} codigo={processos[0]?.codigo} />
      </>
    )

  if (aba === 'perfil')
    return (
      <>
        <MeuPerfil processo={aberto || processos[0]} onAtualizado={onPerfilAtualizado} />
        <BotaoWhatsApp nome={processos[0]?.cliente_nome} codigo={processos[0]?.codigo} />
      </>
    )

  if (!processos.length)
    return (
      <div className="vazio-grande">
        <h1 className="titulo-grande">Nenhum processo por aqui ainda</h1>
        <p>Seu processo aparece assim que a Airam cadastrá-lo com este e-mail, CPF ou telefone.</p>
      </div>
    )

  if (aberto)
    return (
      <>
        {processos.length > 1 && (
          <button className="btn btn-leve voltar" onClick={() => setAberto(null)}>← Meus processos</button>
        )}
        <ProcessoView processo={aberto} onAtualizar={() => abrir(aberto.id, false)} />
        <BotaoWhatsApp nome={aberto.cliente_nome} codigo={aberto.codigo} />
      </>
    )

  return (
    <section>
      <BotaoWhatsApp nome={processos[0]?.cliente_nome} />
      <h1 className="titulo-grande">Meus processos</h1>
      <ul className="cartoes">
        {processos.map((p) => (
          <li key={p.id}>
            <button className="cartao" onClick={() => abrir(p.id)}>
              <strong>{p.codigo}</strong>
              <span>Etapa atual: {etapaAtual(linhaDoTempo(p, p.assinaturas, { cliente: true })).nome}</span>
              <span className="num">{ROTULO_PRAZO}: {formatarData(p.data_entrega_prevista)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
