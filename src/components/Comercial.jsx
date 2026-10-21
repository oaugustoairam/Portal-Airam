import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { acoesComercial } from '../lib/comercial.js'
import { ComercialCtx } from './comercial/comum.jsx'
import Captacao from './comercial/Captacao.jsx'
import Crm from './comercial/Crm.jsx'
import Calendario from './comercial/Calendario.jsx'
import MeusLembretes from './comercial/Lembretes.jsx'
import Metricas from './comercial/Metricas.jsx'
import CartaoLead from './comercial/CartaoLead.jsx'

// Aba COMERCIAL: carrega listas, pessoas e dados uma vez e entrega para as telas.
// Tudo que é salvo recarrega os dados do banco na hora (sem recarregar a página).
export default function Comercial({ aba, perfil, leadInicial }) {
  const [base, setBase] = useState(null)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState(null)
  const [cartao, setCartao] = useState(leadInicial || null)
  const relogio = useRef(null)
  const contador = useRef(0)

  const carregarBase = async () => {
    const [listas, pessoas, vendedores, lojas] = await Promise.all([api.comercialListas(), api.nomesEquipe(), api.vendedoresComercial(), api.lojas()])
    setBase({ listas, pessoas, vendedores, lojas })
  }
  const recarregar = async () => {
    try {
      setDados(await api.comercialDados())
    } catch (e) {
      avisar(e.message, true)
    }
  }
  useEffect(() => {
    Promise.all([carregarBase(), api.comercialDados().then(setDados)]).catch((e) => setErro(e.message))
  }, [])
  function avisar(msg, ehErro = false) {
    clearTimeout(relogio.current)
    setToast({ msg, erro: ehErro, n: ++contador.current })
    relogio.current = setTimeout(() => setToast(null), ehErro ? 7000 : 3500)
  }

  if (erro) return <p className="erro" role="alert">Não foi possível carregar o Comercial: {erro}</p>
  if (!base || !dados) return <div className="carregando">Carregando…</div>

  const ctx = { ...base, dados, setDados, perfil, acoes: acoesComercial(perfil), recarregar, avisar, abrirCartao: setCartao, recarregarBase: carregarBase }
  return (
    <ComercialCtx.Provider value={ctx}>
      {aba === 'captacao' && <Captacao />}
      {aba === 'crm' && <Crm />}
      {aba === 'lembretes' && <MeusLembretes />}
      {aba === 'calendario' && <Calendario />}
      {aba === 'metricas' && <Metricas />}
      {cartao && <CartaoLead id={cartao} onFechar={() => setCartao(null)} />}
      {toast && <div key={toast.n} data-n={toast.n} className={`toast-fixo ${toast.erro ? 'erro' : ''}`} role={toast.erro ? 'alert' : 'status'}>{toast.msg}</div>}
    </ComercialCtx.Provider>
  )
}
