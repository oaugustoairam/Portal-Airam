import { useEffect, useState } from 'react'
import { api, MODO_DEMO } from './lib/api.js'
import Login from './components/Login.jsx'
import TrocarSenha from './components/TrocarSenha.jsx'
import ClienteHome from './components/ClienteHome.jsx'
import PainelEquipe from './components/PainelEquipe.jsx'
import BotaoWhatsApp from './components/BotaoWhatsApp.jsx'
import InstalarApp from './components/InstalarApp.jsx'
import Entrada from './components/Entrada.jsx'
import Avatar from './components/Avatar.jsx'
import logoBranco from './assets/logo-branco.png'
import { IconeInstagram, IconeSite } from './components/NossasLojas.jsx'
import { INSTAGRAM_AIRAM, SITE_AIRAM } from './lib/contato.js'

export const NOME_EMPRESA = 'Airam Arquitetura & Marcenaria'

export default function App() {
  const [perfil, setPerfil] = useState(undefined)
  const [abaCliente, setAbaCliente] = useState('processo')
  const [fotoCliente, setFotoCliente] = useState(null)
  const carregarFoto = () => api.meuPerfil().then((p) => setFotoCliente(p?.foto_path || null)).catch(() => {})

  useEffect(() => {
    const carregar = () => api.perfil().then(setPerfil).catch(() => setPerfil(null))
    carregar()
    return api.aoMudarSessao(() => carregar())
  }, [])

  // ao entrar, sair ou trocar a senha, a nova tela começa do topo
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [perfil?.email, perfil?.precisa_trocar_senha])

  useEffect(() => {
    if (perfil && perfil.papel === 'cliente' && !perfil.precisa_trocar_senha) carregarFoto()
    setAbaCliente('processo')
  }, [perfil?.email, perfil?.precisa_trocar_senha])

  const irPara = (aba) => {
    setAbaCliente(aba)
    window.scrollTo(0, 0)
  }

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
        <BotaoWhatsApp />
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
              {!equipe ? (
                <button className="topo-perfil" onClick={() => irPara('perfil')} aria-label="Abrir meu perfil">
                  <Avatar caminho={fotoCliente} nome={perfil.nome || perfil.email} tamanho={34} />
                  <span className="topo-email">{perfil.nome || perfil.email}</span>
                </button>
              ) : (
                <span className="topo-email">{perfil.nome || perfil.email}</span>
              )}
              <button className="btn btn-leve" onClick={() => api.sair()}>
                Sair
              </button>
            </div>
          )}
        </div>
        {!equipe && (
          <nav className="topo-abas" aria-label="Áreas do cliente">
            <div className="topo-abas-in">
              {[['processo', 'Meu processo'], ['perfil', 'Meu perfil'], ['lojas', 'Nossas lojas']].map(([k, t]) => (
                <button key={k} className={`topo-aba ${abaCliente === k ? 'ativa' : ''}`} aria-current={abaCliente === k ? 'page' : undefined}
                  onClick={() => irPara(k)}>{t}</button>
              ))}
              <a className="topo-aba topo-aba-externa" href={INSTAGRAM_AIRAM} target="_blank" rel="noreferrer"><IconeInstagram />Instagram</a>
              <a className="topo-aba topo-aba-externa" href={SITE_AIRAM} target="_blank" rel="noreferrer"><IconeSite />Site</a>
            </div>
          </nav>
        )}
        {faixaDemo}
      </header>
      <main className={`conteudo ${equipe ? '' : 'conteudo-cliente'}`}>
        {equipe ? <PainelEquipe /> : <ClienteHome aba={abaCliente} onPerfilAtualizado={carregarFoto} />}
        {!equipe && <InstalarApp />}
      </main>
    </div>
  )
}
