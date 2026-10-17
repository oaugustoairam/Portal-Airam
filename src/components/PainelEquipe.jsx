import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { aniversariantesDoDia } from '../lib/aniversarios.js'
import AdminHome from './AdminHome.jsx'
import Aniversarios, { linkParabens } from './Aniversarios.jsx'
import EmailMarketing from './EmailMarketing.jsx'

// Área interna da loja: processos, aniversários e e-mail marketing.
export default function PainelEquipe() {
  const [aba, setAba] = useState('processos')
  const [processos, setProcessos] = useState([])
  const [abrir, setAbrir] = useState(null)

  useEffect(() => {
    api.listarProcessos().then(setProcessos)
  }, [aba])

  const hoje = aniversariantesDoDia(processos)

  return (
    <div className="painel-equipe">
      <nav className="painel-nav" aria-label="Áreas da gestão">
        {[['processos', 'Processos'], ['aniversarios', 'Aniversários'], ['marketing', 'E-mail marketing']].map(([k, t]) => (
          <button key={k} className={`painel-nav-item ${aba === k ? 'ativo' : ''}`} aria-current={aba === k ? 'page' : undefined}
            onClick={() => { setAba(k); setAbrir(null) }}>
            {t}
            {k === 'aniversarios' && hoje.length > 0 && <span className="painel-nav-badge">{hoje.length}</span>}
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

      {aba === 'processos' && <AdminHome key={abrir || 'lista'} abrirInicial={abrir} />}
      {aba === 'aniversarios' && <Aniversarios processos={processos} onAbrirProcesso={(id) => { setAbrir(id); setAba('processos') }} />}
      {aba === 'marketing' && <EmailMarketing processos={processos} />}
    </div>
  )
}
