import { useEffect, useState } from 'react'
import { api, MODO_DEMO } from './lib/api.js'
import Login from './components/Login.jsx'
import ClienteHome from './components/ClienteHome.jsx'
import AdminHome from './components/AdminHome.jsx'

export const NOME_ESCRITORIO = 'Airam Arquitetura'

export default function App() {
  const [perfil, setPerfil] = useState(undefined)

  useEffect(() => {
    const carregar = () => api.perfil().then(setPerfil).catch(() => setPerfil(null))
    carregar()
    return api.aoMudarSessao(() => carregar())
  }, [])

  if (perfil === undefined) return <div className="carregando">Carregando…</div>

  return (
    <div className="app">
      <header className="topo">
        <div className="topo-in">
          <div className="marca">
            <span className="marca-nome">{NOME_ESCRITORIO}</span>
            <span className="marca-sub">Portal do cliente</span>
          </div>
          {perfil && (
            <div className="topo-usuario">
              <span className="topo-email">{perfil.email}</span>
              <button className="btn btn-leve" onClick={() => api.sair()}>
                Sair
              </button>
            </div>
          )}
        </div>
        {MODO_DEMO && (
          <div className="faixa-demo">
            Modo demonstração: dados de exemplo salvos só neste navegador.
          </div>
        )}
      </header>
      <main className="conteudo">
        {!perfil && <Login />}
        {perfil?.papel === 'admin' && <AdminHome />}
        {perfil?.papel === 'cliente' && <ClienteHome />}
      </main>
    </div>
  )
}
