import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { Campo } from '../comercial/comum.jsx'

// Configurações > Marca: diretrizes que a IA segue no Criador de conteúdo
export default function DiretrizesMarca() {
  const [m, setM] = useState(null)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    api.diretrizesMarca().then(setM).catch((e) => setErro(e.message))
  }, [])
  if (!m) return erro ? <p className="erro">{erro}</p> : <div className="carregando">Carregando…</div>
  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (m.tom_de_voz.trim().length < 5) return setErro('Descreva o tom de voz.')
    setOcupado(true)
    try {
      await api.salvarDiretrizes(m)
      setMsg('Diretrizes salvas')
      setTimeout(() => setMsg(''), 2500)
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <form className="grupo diretrizes-marca" onSubmit={salvar}>
      <p className="dica">A IA já sabe que a Airam é marcenaria de alto padrão, escreve em português do Brasil e foca em exclusividade,
        acabamento e projeto sob medida. Aqui você ajusta o jeito da marca.</p>
      <Campo id="dm-tom" rotulo="Tom de voz"><textarea id="dm-tom" rows={3} maxLength={1000} value={m.tom_de_voz} onChange={(e) => setM((x) => ({ ...x, tom_de_voz: e.target.value }))} /></Campo>
      <Campo id="dm-evitar" rotulo="Palavras e expressões a evitar" ajuda="Separe por vírgula."><textarea id="dm-evitar" rows={2} maxLength={1000} value={m.palavras_evitar} onChange={(e) => setM((x) => ({ ...x, palavras_evitar: e.target.value }))} /></Campo>
      <Campo id="dm-hash" rotulo="Hashtags padrão" ajuda="Entram em todas as legendas."><input id="dm-hash" maxLength={500} value={m.hashtags_padrao} onChange={(e) => setM((x) => ({ ...x, hashtags_padrao: e.target.value }))} /></Campo>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="acoes"><button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar diretrizes'}</button>{msg && <span className="toast" role="status">{msg}</span>}</div>
    </form>
  )
}
