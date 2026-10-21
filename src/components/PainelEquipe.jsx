import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { aniversariantesDoDia } from '../lib/aniversarios.js'
import { PASTAS } from '../lib/pastas.js'
import { temPermissao } from '../lib/permissoes.js'
import AdminHome from './AdminHome.jsx'
import Aniversarios, { linkParabens } from './Aniversarios.jsx'
import EmailMarketing from './EmailMarketing.jsx'
import GestaoClientes, { PASTAS_GESTAO } from './GestaoClientes.jsx'
import Configuracoes, { PASTAS_CONFIG } from './Configuracoes.jsx'
import Comercial from './Comercial.jsx'
import { subabasComercial } from '../lib/comercial.js'

// ordem da barra: Comercial, Gestão de clientes, Processos, Marketing (e, para o master, Configurações)
const SECOES = {
  comercial: { nome: 'Comercial', pastas: subabasComercial, permissao: 'comercial' },
  gestao: { nome: 'Gestão de clientes', pastas: PASTAS_GESTAO, permissao: 'gestao' },
  processos: { nome: 'Processos', pastas: [['geral', 'Geral'], ...PASTAS.map((p) => [p.id, p.nome])], permissao: 'processos' },
  // novas ferramentas de marketing entram como novas pastas aqui
  marketing: { nome: 'Marketing', pastas: [['aniversarios', 'Aniversários'], ['email', 'E-mail marketing']], permissao: 'marketing' },
  config: { nome: 'Configurações', pastas: PASTAS_CONFIG, master: true },
}

// Área interna da loja: cada pessoa vê as seções que o master liberou.
// link dos avisos: ?lead=<id> abre o cartão do cliente direto no Comercial
function leadDoLink() {
  try {
    const id = new URLSearchParams(window.location.search).get('lead')
    return id && /^[\w@.-]{6,80}$/.test(id) ? id : null
  } catch {
    return null
  }
}

export default function PainelEquipe({ perfil }) {
  const secoes = Object.entries(SECOES).filter(([, s]) => (s.master ? perfil?.papel === 'admin' : temPermissao(perfil, s.permissao)))
  const [leadInicial] = useState(() => (temPermissao(perfil, 'comercial') ? leadDoLink() : null))
  useEffect(() => {
    if (leadInicial) window.history.replaceState(null, '', window.location.pathname)
  }, [])
  const [secao, setSecao] = useState(() => (leadInicial ? 'comercial' : secoes[0]?.[0] || 'processos'))
  const pastasDe = (s) => (typeof SECOES[s].pastas === 'function' ? SECOES[s].pastas(perfil) : SECOES[s].pastas)
  const [pasta, setPasta] = useState(() => ({ comercial: subabasComercial(perfil)[0]?.[0], gestao: 'novo', processos: 'geral', marketing: 'aniversarios', config: 'usuarios' }))
  const [processos, setProcessos] = useState([])
  const [abrir, setAbrir] = useState(null)
  const marketing = temPermissao(perfil, 'marketing')

  useEffect(() => {
    if (marketing) api.listarProcessos().then(setProcessos).catch(() => {})
  }, [secao])

  const hoje = marketing ? aniversariantesDoDia(processos) : []
  const atual = pasta[secao]
  const [toque, setToque] = useState(0) // tocar de novo na pasta aberta volta para a lista
  const irPara = (s, p) => {
    setToque((n) => n + 1)
    setSecao(s)
    if (p) setPasta((x) => ({ ...x, [s]: p }))
    setAbrir(null)
    window.scrollTo(0, 0)
  }
  const abrirProcesso = temPermissao(perfil, 'processos') ? (id) => { irPara('processos', 'geral'); setAbrir(id) } : null

  if (!secoes.length) return <p className="vazio">Seu usuário ainda não tem nenhuma área liberada. Fale com o master.</p>

  return (
    <div className="painel-equipe">
      <nav className="painel-nav" aria-label="Áreas da gestão">
        {secoes.map(([k, s]) => (
          <button key={k} className={`painel-nav-item ${secao === k ? 'ativo' : ''}`} aria-current={secao === k ? 'page' : undefined}
            onClick={() => irPara(k)}>
            {s.nome}
            {k === 'marketing' && hoje.length > 0 && <span className="painel-nav-badge">{hoje.length}</span>}
          </button>
        ))}
      </nav>

      {pastasDe(secao).length > 0 && (
        <nav className="subpastas" aria-label={`Pastas de ${SECOES[secao].nome}`}>
          {pastasDe(secao).map(([k, t]) => (
            <button key={k} className={`subpasta ${atual === k ? 'ativa' : ''}`} aria-current={atual === k ? 'page' : undefined}
              onClick={() => irPara(secao, k)}>
              {t}
              {k === 'aniversarios' && hoje.length > 0 && <span className="subpasta-badge">{hoje.length}</span>}
            </button>
          ))}
        </nav>
      )}

      {/* aniversários do dia: só no Marketing */}
      {secao === 'marketing' && hoje.length > 0 && (
        <div className="banner-aniv" role="status">
          <span className="banner-aniv-icone" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 21h16M5 21v-7h14v7M5 17c2 0 2-1.5 3.5-1.5S10 17 12 17s2-1.5 3.5-1.5S17 17 19 17M12 14v-3M12 8.5c-1 0-1.5-.8-1.5-1.5S12 4 12 4s1.5 2.3 1.5 3-.5 1.5-1.5 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="banner-aniv-texto">
            <strong>Hoje é aniversário de {hoje.map((p) => p.cliente_nome).join(', ')}</strong>
          </span>
          <span className="banner-aniv-acoes">
            {hoje.map((p) => {
              const link = linkParabens(p)
              return link ? <a key={p.id} className="btn btn-contorno" href={link} target="_blank" rel="noreferrer">Parabenizar {p.cliente_nome.split(' ')[0]}</a> : null
            })}
          </span>
        </div>
      )}

      {secao === 'comercial' && <Comercial aba={atual} perfil={perfil} leadInicial={leadInicial} />}
      {secao === 'gestao' && <GestaoClientes aba={atual} toque={toque} perfil={perfil} onAbrirProcesso={abrirProcesso} onAba={(p) => irPara('gestao', p)} />}
      {secao === 'processos' && (
        <AdminHome key={`${atual}-${abrir || 'lista'}`} abrirInicial={abrir} pasta={atual} onPasta={(p) => irPara('processos', p)} />
      )}
      {secao === 'marketing' && atual === 'aniversarios' && (
        <Aniversarios processos={processos} onAbrirProcesso={abrirProcesso || (() => {})} />
      )}
      {secao === 'marketing' && atual === 'email' && <EmailMarketing processos={processos} />}
      {secao === 'config' && <Configuracoes aba={atual} perfil={perfil} />}
    </div>
  )
}
