import { useEffect, useState } from 'react'
import { api, MODO_DEMO } from './lib/api.js'
import Login from './components/Login.jsx'
import TrocarSenha from './components/TrocarSenha.jsx'
import ClienteHome from './components/ClienteHome.jsx'
import AdminHome from './components/AdminHome.jsx'
import logoBranco from './assets/logo-branco.png'

export const NOME_EMPRESA = 'Airam Arquitetura & Marcenaria'

export default function App() {
  const [perfil, setPerfil] = useState(undefined)

  useEffect(() => {
    const carregar = () => api.perfil().then(setPerfil).catch(() => setPerfil(null))
    carregar()
    return api.aoMudarSessao(() => carregar())
  }, [])

  if (perfil === undefined) return <div className="carregando">Carregando…</div>

  const equipe = perfil && ['admin', 'equipe'].includes(perfil.papel)

  return (
    <div className="app">
      <header className="topo">
        <div className="topo-in">
          <div className="marca">
            <img className="marca-logo" src={logoBranco} alt={NOME_EMPRESA} />
            <span className="marca-sub">{equipe ? 'Gestão de processos' : 'Portal do cliente'}</span>
          </div>
          {perfil && (
            <div className="topo-usuario">
              <span className="topo-email">{perfil.nome || perfil.email}</span>
              <button className="btn btn-leve" onClick={() => api.sair()}>
                Sair
              </button>
            </div>
          )}
        </div>
        {MODO_DEMO && (
          <div className="faixa-demo">Modo demonstração: dados fictícios, salvos só neste navegador.</div>
        )}
      </header>
      <main className="conteudo">
        {!perfil && <Login />}
        {perfil?.precisa_trocar_senha && <TrocarSenha perfil={perfil} />}
        {perfil && !perfil.precisa_trocar_senha && (equipe ? <AdminHome /> : <ClienteHome />)}
      </main>
    </div>
  )
}
