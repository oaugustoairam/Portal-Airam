import { useMemo, useState } from 'react'
import { clientesComNascimento, proximoAniversario } from '../lib/aniversarios.js'
import { telefoneWhatsApp } from '../lib/avisos.js'
import { linkWhatsApp } from '../lib/contato.js'
import { hojeISO } from '../lib/constants.js'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function linkParabens(p) {
  const tel = telefoneWhatsApp(p.cliente_telefone)
  if (!tel) return null
  return linkWhatsApp(tel, `Olá, ${p.cliente_nome.split(' ')[0]}! Hoje é um dia especial: toda a equipe Airam deseja um feliz aniversário! 🎉`)
}

const iniciais = (n) => n.split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase()

export default function Aniversarios({ processos, onAbrirProcesso }) {
  const hoje = hojeISO()
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)))
  const [mes, setMes] = useState(Number(hoje.slice(5, 7)) - 1)
  const [sel, setSel] = useState(null)

  const clientes = useMemo(() => clientesComNascimento(processos), [processos])
  const semData = new Set(processos.filter((p) => !p.cliente_nascimento).map((p) => p.cliente_email)).size
  const proximos = clientes
    .map((p) => ({ p, ...proximoAniversario(p.cliente_nascimento, hoje) }))
    .filter((x) => x.dias <= 30)
    .sort((a, b) => a.dias - b.dias)

  const primeiro = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const celulas = [...Array(primeiro).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)]
  const doDia = (d) => clientes.filter((p) => Number(p.cliente_nascimento.slice(5, 7)) === mes + 1 && Number(p.cliente_nascimento.slice(8, 10)) === d)
  const ehHoje = (d) => ano === Number(hoje.slice(0, 4)) && mes === Number(hoje.slice(5, 7)) - 1 && d === Number(hoje.slice(8, 10))
  const mudarMes = (delta) => {
    const m = mes + delta
    setMes((m + 12) % 12)
    setAno(ano + Math.floor(m / 12))
  }

  return (
    <section className="aniv">
      <div className="cab-linha">
        <h1 className="titulo-grande">Aniversários</h1>
        <span className="dica">{clientes.length} clientes com data de nascimento{semData ? ` · ${semData} sem data (cadastre em Dados e prazos)` : ''}</span>
      </div>

      <div className="aniv-grade">
        <div className="calendario">
          <div className="calendario-topo">
            <button className="carrossel-seta" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
            <strong>{MESES[mes]} {ano}</strong>
            <button className="carrossel-seta" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
          </div>
          <div className="calendario-semana" aria-hidden="true">{SEMANA.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="calendario-dias">
            {celulas.map((d, i) => {
              if (!d) return <span key={`v${i}`} className="cal-dia cal-vazio" />
              const pessoas = doDia(d)
              return (
                <div key={d} className={`cal-dia ${ehHoje(d) ? 'cal-hoje' : ''} ${pessoas.length ? 'cal-com' : ''}`}>
                  <span className="cal-num num">{d}</span>
                  {pessoas.map((p) => (
                    <button key={p.id} className="cal-pessoa" onClick={() => setSel(p)} title={p.cliente_nome}>
                      <span className="cal-avatar">{iniciais(p.cliente_nome)}</span>
                      <span className="cal-nome">{p.cliente_nome.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>

        <aside className="aniv-lado">
          {sel && <CartaoAniversario p={sel} onFechar={() => setSel(null)} onAbrirProcesso={onAbrirProcesso} />}
          <h2 className="titulo-secao">Próximos 30 dias</h2>
          {!proximos.length && <p className="vazio">Nenhum aniversário nos próximos 30 dias.</p>}
          <ul className="aniv-lista">
            {proximos.map(({ p, dias, idade }) => (
              <li key={p.id}>
                <button className={`aniv-item ${dias === 0 ? 'aniv-hoje' : ''}`} onClick={() => setSel(p)}>
                  <span className="cal-avatar">{iniciais(p.cliente_nome)}</span>
                  <span className="aniv-info">
                    <strong>{p.cliente_nome}</strong>
                    <span className="num">{p.cliente_nascimento.slice(8, 10)}/{p.cliente_nascimento.slice(5, 7)} · faz {idade} anos</span>
                  </span>
                  <span className={`chip ${dias === 0 ? 'chip-em_andamento' : 'chip-neutro'}`}>{dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `em ${dias} dias`}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  )
}

function CartaoAniversario({ p, onFechar, onAbrirProcesso }) {
  const { dias, idade } = proximoAniversario(p.cliente_nascimento)
  const link = linkParabens(p)
  return (
    <div className="aniv-cartao">
      <button className="aniv-fechar" onClick={onFechar} aria-label="Fechar">×</button>
      <span className="rotulo">{p.codigo}</span>
      <strong className="aniv-cartao-nome">{p.cliente_nome}</strong>
      <span className="num">{p.cliente_nascimento.split('-').reverse().join('/')} · {dias === 0 ? `faz ${idade} anos hoje` : `faz ${idade} anos em ${dias} ${dias === 1 ? 'dia' : 'dias'}`}</span>
      <div className="acoes">
        {link ? <a className="btn btn-principal" href={link} target="_blank" rel="noreferrer">Parabenizar no WhatsApp</a>
          : <span className="dica">Sem telefone cadastrado.</span>}
        <button className="btn btn-contorno" onClick={() => onAbrirProcesso(p.id)}>Abrir processo</button>
      </div>
    </div>
  )
}
