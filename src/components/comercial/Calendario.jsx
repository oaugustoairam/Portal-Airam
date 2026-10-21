import { useMemo, useState } from 'react'
import { api } from '../../lib/api.js'
import { dataHoraBR, diaLocal, horaLocal, foneBR, nomeCurto, SITUACOES_AGENDA } from '../../lib/comercial.js'
import { Janela, Confirmar, useComercial } from './comum.jsx'
import AgendamentoForm from './AgendamentoForm.jsx'

const SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const somar = (d, dias) => {
  const x = new Date(d)
  x.setDate(x.getDate() + dias)
  return x
}
const segunda = (d) => somar(d, -((d.getDay() + 6) % 7))

export default function Calendario() {
  const { dados, vendedores, pessoas, lojas, acoes, recarregar, avisar, abrirCartao } = useComercial()
  const [modo, setModo] = useState(() => (window.innerWidth < 700 ? 'dia' : 'mes'))
  const [ref, setRef] = useState(() => new Date())
  const [vend, setVend] = useState('')
  const [loja, setLoja] = useState('')
  const [modalidade, setModalidade] = useState('')
  const [cancelados, setCancelados] = useState(false)
  const [corPor, setCorPor] = useState('vendedor')
  const [janela, setJanela] = useState(null)
  const hoje = diaLocal(new Date())
  const nomeLoja = (id) => lojas.find((l) => l.id === id)?.nome || id
  const leadDe = (a) => dados.leads.find((l) => l.id === a.lead_id)

  const eventos = useMemo(() => dados.agendamentos.filter((a) => (cancelados || a.situacao !== 'cancelado')
    && (!vend || a.vendedor_id === vend) && (!modalidade || a.modalidade === modalidade) && (!loja || a.loja_id === loja)), [dados.agendamentos, vend, loja, modalidade, cancelados])
  const doDia = (dia) => eventos.filter((a) => diaLocal(a.inicio) === dia).sort((a, b) => a.inicio.localeCompare(b.inicio))

  function andar(passo) {
    if (passo === 0) return setRef(new Date())
    setRef((r) => (modo === 'mes' ? new Date(r.getFullYear(), r.getMonth() + passo, 1) : somar(r, passo * (modo === 'semana' ? 7 : 1))))
  }
  const titulo = modo === 'mes' ? `${MESES[ref.getMonth()]} de ${ref.getFullYear()}`
    : modo === 'semana' ? `Semana de ${segunda(ref).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${somar(segunda(ref), 6).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
      : ref.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  const novoNoDia = acoes.cadastrar ? (dia) => setJanela({ tipo: 'novo', dia }) : null
  const mudou = async (msg) => { setJanela(null); await recarregar(); avisar(msg) }

  // cor fixa por vendedor (ordem da lista) ou por loja; passou de 8, cinza (a legenda mostra quem é quem)
  const ordemCor = corPor === 'vendedor' ? vendedores.map((v) => v.id) : lojas.map((l) => l.id)
  const chaveCor = (a) => (corPor === 'vendedor' ? a.vendedor_id : a.modalidade === 'online' ? 'online' : a.loja_id)
  const slotCor = (k) => {
    const i = ordemCor.indexOf(k)
    return i >= 0 && i < 8 ? i + 1 : 0
  }
  const legenda = corPor === 'vendedor' ? vendedores.map((v) => [v.id, v.nome || v.email]) : lojas.map((l) => [l.id, l.nome])
  const MARCA_SIT = { compareceu: '✓ ', nao_compareceu: '✗ ', cancelado: '' }
  function Evento({ a, compacto }) {
    const l = leadDe(a)
    return (
      <button type="button" className={`cal-evento sit-${a.situacao}`} style={{ '--cor-evento': `var(--cat-${slotCor(chaveCor(a))})` }}
        onClick={(e) => { e.stopPropagation(); setJanela({ tipo: 'ver', a }) }}
        title={`${horaLocal(a.inicio)} ${l?.nome || ''} · ${nomeCurto(pessoas, a.vendedor_id)} · ${a.modalidade === 'online' ? 'Online' : nomeLoja(a.loja_id)}${a.situacao !== 'marcado' ? ` · ${SITUACOES_AGENDA[a.situacao]}` : ''}`}>
        <span className="cal-hora">{MARCA_SIT[a.situacao] || ''}{horaLocal(a.inicio)}</span>
        <span className="cal-nome">{l?.nome || 'Lead'}</span>
        {!compacto && <span className="cal-local">{a.modalidade === 'online' ? 'Online' : nomeLoja(a.loja_id)} · {nomeCurto(pessoas, a.vendedor_id)}</span>}
      </button>
    )
  }

  let corpo
  if (modo === 'mes') {
    const inicio = segunda(new Date(ref.getFullYear(), ref.getMonth(), 1))
    const dias = Array.from({ length: 42 }, (_, i) => somar(inicio, i))
    corpo = (
      <div className="cal-mes" role="grid" aria-label={titulo}>
        {SEMANA.map((d) => <div key={d} className="cal-sem" role="columnheader">{d}</div>)}
        {dias.map((d) => {
          const dia = diaLocal(d)
          const evs = doDia(dia)
          return (
            <div key={dia} role="gridcell" className={`cal-dia ${d.getMonth() !== ref.getMonth() ? 'fora' : ''} ${dia === hoje ? 'hoje' : ''} ${novoNoDia ? 'clicavel' : ''}`}
              onClick={() => novoNoDia?.(dia)} aria-label={`${d.getDate()} — ${evs.length} agendamento(s)${novoNoDia ? '. Clique para agendar' : ''}`}>
              <span className="cal-num">{d.getDate()}</span>
              {evs.slice(0, 3).map((a) => <Evento key={a.id} a={a} compacto />)}
              {evs.length > 3 && <button type="button" className="cal-mais" onClick={(e) => { e.stopPropagation(); setRef(d); setModo('dia') }}>+{evs.length - 3}</button>}
            </div>
          )
        })}
      </div>
    )
  } else {
    const dias = modo === 'semana' ? Array.from({ length: 7 }, (_, i) => somar(segunda(ref), i)) : [ref]
    corpo = (
      <div className={`cal-lista cal-${modo}`}>
        {dias.map((d) => {
          const dia = diaLocal(d)
          const evs = doDia(dia)
          return (
            <div key={dia} className={`cal-coluna ${dia === hoje ? 'hoje' : ''}`}>
              <header>
                <strong>{d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</strong>
                {novoNoDia && <button type="button" className="btn btn-leve" aria-label={`Novo agendamento em ${d.toLocaleDateString('pt-BR')}`} onClick={() => novoNoDia(dia)}>+ Agendar</button>}
              </header>
              {evs.length === 0 ? <p className="vazio-mini">Livre</p> : evs.map((a) => <Evento key={a.id} a={a} />)}
            </div>
          )
        })}
      </div>
    )
  }

  const ag = janela?.a
  const lead = ag && leadDe(ag)
  const marcar = async (situacao, msg) => {
    try {
      await api.situacaoAgendamento(ag.id, situacao)
      await mudou(msg)
    } catch (e) {
      avisar(e.message, true)
    }
  }
  return (
    <section className="gestao comercial-calendario">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Comercial · Calendário</span>
          <h1 className="titulo-grande cal-titulo">{titulo}</h1>
        </div>
        <div className="cal-nav">
          <button type="button" className="btn btn-contorno" onClick={() => andar(-1)}>‹ Anterior</button>
          <button type="button" className="btn btn-contorno" onClick={() => andar(0)}>Hoje</button>
          <button type="button" className="btn btn-contorno" onClick={() => andar(1)}>Próximo ›</button>
        </div>
      </div>
      <div className="filtros-comercial">
        <div className="segmentado" role="radiogroup" aria-label="Visão">
          {[['mes', 'Mês'], ['semana', 'Semana'], ['dia', 'Dia']].map(([k, t]) => (
            <button key={k} type="button" role="radio" aria-checked={modo === k} className={modo === k ? 'ativo' : ''} onClick={() => setModo(k)}>{t}</button>
          ))}
        </div>
        {acoes.todos && (
          <select aria-label="Filtrar por vendedor" value={vend} onChange={(e) => setVend(e.target.value)}>
            <option value="">Todos os vendedores</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome || v.email}</option>)}
          </select>
        )}
        <select aria-label="Filtrar por loja" value={loja} onChange={(e) => setLoja(e.target.value)}>
          <option value="">Todas as lojas</option>
          {lojas.filter((l) => l.id !== 'online').map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
        <select aria-label="Filtrar por modalidade" value={modalidade} onChange={(e) => setModalidade(e.target.value)}>
          <option value="">Loja e online</option>
          <option value="loja">Só na loja</option>
          <option value="online">Só online</option>
        </select>
        <label className="check"><input type="checkbox" checked={cancelados} onChange={(e) => setCancelados(e.target.checked)} /> Mostrar cancelados</label>
        <div className="segmentado" role="radiogroup" aria-label="Cores por">
          {[['vendedor', 'Cor por vendedor'], ['loja', 'Cor por loja']].map(([k, t]) => (
            <button key={k} type="button" role="radio" aria-checked={corPor === k} className={corPor === k ? 'ativo' : ''} onClick={() => setCorPor(k)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="cal-legenda" aria-label="Legenda das cores">
        {legenda.map(([k, t]) => <span key={k}><i style={{ background: `var(--cat-${slotCor(k)})` }} />{t}</span>)}
        <span className="cal-legenda-sit">✓ compareceu · ✗ não compareceu · riscado = cancelado</span>
      </div>
      {corpo}
      {novoNoDia && <p className="dica">Clique num dia para criar um agendamento.</p>}

      {janela?.tipo === 'novo' && <AgendamentoForm dia={janela.dia} onFechar={() => setJanela(null)} onSalvo={mudou} />}
      {janela?.tipo === 'reagendar' && <AgendamentoForm agendamento={janela.a} lead={leadDe(janela.a)} onFechar={() => setJanela(null)} onSalvo={mudou} />}
      {janela?.tipo === 'cancelar' && <Confirmar titulo="Cancelar este agendamento?" botao="Cancelar agendamento" texto={`${lead?.nome || ''} · ${dataHoraBR(ag.inicio)}`}
        onCancelar={() => setJanela({ tipo: 'ver', a: ag })} onConfirmar={async () => { await api.situacaoAgendamento(ag.id, 'cancelado'); await mudou('Agendamento cancelado') }} />}
      {janela?.tipo === 'ver' && (
        <Janela titulo={lead?.nome || 'Agendamento'} rotulo="Agendamento" largura="pequena" onFechar={() => setJanela(null)}>
          <dl className="cartao-dados">
            <div><dt>Quando</dt><dd>{dataHoraBR(ag.inicio)}</dd></div>
            <div><dt>Onde</dt><dd>{ag.modalidade === 'online' ? 'Online' : nomeLoja(ag.loja_id)}</dd></div>
            <div><dt>Vendedor</dt><dd>{nomeCurto(pessoas, ag.vendedor_id)}</dd></div>
            {lead && <div><dt>Telefone</dt><dd>{foneBR(lead.telefone)}</dd></div>}
            <div><dt>Situação</dt><dd>{SITUACOES_AGENDA[ag.situacao]}</dd></div>
          </dl>
          <div className="acoes-coluna">
            {lead && <button type="button" className="btn btn-principal" onClick={() => { setJanela(null); abrirCartao(lead.id) }}>Abrir cartão do cliente</button>}
            {ag.situacao !== 'cancelado' && (
              <span className="acoes-linha">
                <button type="button" className="btn btn-contorno" onClick={() => marcar('compareceu', 'Comparecimento marcado')}>Compareceu</button>
                <button type="button" className="btn btn-contorno" onClick={() => marcar('nao_compareceu', 'Marcado: não compareceu')}>Não compareceu</button>
              </span>
            )}
            <button type="button" className="btn btn-contorno" onClick={() => setJanela({ tipo: 'reagendar', a: ag })}>Reagendar</button>
            {ag.situacao !== 'cancelado' && <button type="button" className="btn btn-leve texto-atraso" onClick={() => setJanela({ tipo: 'cancelar', a: ag })}>Cancelar agendamento</button>}
          </div>
        </Janela>
      )}
    </section>
  )
}
