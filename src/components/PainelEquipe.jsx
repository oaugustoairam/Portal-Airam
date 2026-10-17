import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { aniversariantesDoDia } from '../lib/aniversarios.js'
import { PASTAS } from '../lib/pastas.js'
import AdminHome from './AdminHome.jsx'
import Aniversarios, { linkParabens } from './Aniversarios.jsx'
import EmailMarketing from './EmailMarketing.jsx'
import GestaoClientes from './GestaoClientes.jsx'

const SECOES = {
  processos: { nome: 'Processos', pastas: [['geral', 'Geral'], ...PASTAS.map((p) => [p.id, p.nome])] },
  // novas ferramentas de marketing entram como novas pastas aqui
  marketing: { nome: 'Marketing', pastas: [['email', 'E-mail marketing'], ['aniversarios', 'Aniversários']] },
  // só vendedores e gerência
  gestao: { nome: 'Gestão de clientes', pastas: [['mensal', 'Controle mensal'], ['pastas', 'Controle de pastas']], papeis: ['admin', 'vendedor'] },
}

// Área interna da loja: processos (geral e por fase) e marketing.
export default function PainelEquipe({ perfil }) {
  const [secao, setSecao] = useState('processos')
  const [pasta, setPasta] = useState({ processos: 'geral', marketing: 'email', gestao: 'mensal' })
  const secoes = Object.entries(SECOES).filter(([, s]) => !s.papeis || s.papeis.includes(perfil?.papel))
  const [processos, setProcessos] = useState([])
  const [abrir, setAbrir] = useState(null)

  useEffect(() => {
    api.listarProcessos().then(setProcessos)
  }, [secao])

  const hoje = aniversariantesDoDia(processos)
  const atual = pasta[secao]
  const irPara = (s, p) => {
    setSecao(s)
    if (p) setPasta((x) => ({ ...x, [s]: p }))
    setAbrir(null)
    window.scrollTo(0, 0)
  }

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

      <nav className="subpastas" aria-label={`Pastas de ${SECOES[secao].nome}`}>
        {SECOES[secao].pastas.map(([k, t]) => (
          <button key={k} className={`subpasta ${atual === k ? 'ativa' : ''}`} aria-current={atual === k ? 'page' : undefined}
            onClick={() => irPara(secao, k)}>
            {t}
            {k === 'aniversarios' && hoje.length > 0 && <span className="subpasta-badge">{hoje.length}</span>}
          </button>
        ))}
      </nav>

      {hoje.length > 0 && (
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

      {secao === 'processos' && (
        <AdminHome key={`${atual}-${abrir || 'lista'}`} abrirInicial={abrir} pasta={atual} onPasta={(p) => irPara('processos', p)} />
      )}
      {secao === 'marketing' && atual === 'email' && <EmailMarketing processos={processos} />}
      {secao === 'gestao' && <GestaoClientes aba={atual} perfil={perfil} />}
      {secao === 'marketing' && atual === 'aniversarios' && (
        <Aniversarios processos={processos} onAbrirProcesso={(id) => { irPara('processos', 'geral'); setAbrir(id) }} />
      )}
    </div>
  )
}
