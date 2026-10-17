import { useEffect, useState } from 'react'
import { api, MODO_DEMO } from './lib/api.js'
import Login from './components/Login.jsx'
import TrocarSenha from './components/TrocarSenha.jsx'
import ClienteHome from './components/ClienteHome.jsx'
import AdminHome from './components/AdminHome.jsx'
import InstalarApp from './components/InstalarApp.jsx'
import Entrada from './components/Entrada.jsx'
import logoBranco from './assets/logo-branco.png'

export const NOME_EMPRESA = 'Airam Arquitetura & Marcenaria'

export default function App() {
  const [perfil, setPerfil] = useState(undefined)

  useEffect(() => {
    const carregar = () => api.perfil().then(setPerfil).catch(() => setPerfil(null))
    carregar()
    return api.aoMudarSessao(() => carregar())
  }, [])

  // ao entrar, sair ou trocar a senha, a nova tela começa do topo
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [perfil?.email, perfil?.precisa_trocar_senha])

  if (perfil === undefined) return <div className="carregando">Carregando…</div>

  const equipe = perfil && ['admin', 'equipe'].includes(perfil.papel)
  const faixaDemo = MODO_DEMO && (
    <div className="faixa-demo">Modo demonstração: dados fictícios, salvos só neste navegador.</div>
  )

  // Entrada e primeira senha: tela cheia com a vitrine de ambientes
  if (!perfil || perfil.precisa_trocar_senha)
    return (
      <div className="app app-entrada">
        {faixaDemo}
        <Entrada>{!perfil ? <Login /> : <TrocarSenha perfil={perfil} />}</Entrada>
      </div>
    )

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
        {faixaDemo}
      </header>
      <main className={`conteudo ${equipe ? '' : 'conteudo-cliente'}`}>
        {equipe ? <AdminHome /> : <ClienteHome />}
        {!equipe && <InstalarApp />}
      </main>
    </div>
  )
}
