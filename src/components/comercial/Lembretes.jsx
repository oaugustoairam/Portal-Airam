import { useMemo, useState } from 'react'
import { api } from '../../lib/api.js'
import { TIPOS_LEMBRETE, dataHoraBR, diaLocal, horaLocal, estadoLembrete, foneBR, nomeCurto } from '../../lib/comercial.js'
import { Janela, Campo, Confirmar, useComercial } from './comum.jsx'

const ROTULO_ESTADO = { atrasado: 'Atrasado', hoje: 'Hoje', proximo: 'Próximo', concluido: 'Concluído' }

export function LembreteForm({ lead, lembrete, onFechar, onSalvo }) {
  const amanha = new Date(Date.now() + 86400000)
  const [f, setF] = useState(() => lembrete
    ? { id: lembrete.id, data: diaLocal(lembrete.quando), hora: horaLocal(lembrete.quando), tipo: lembrete.tipo, descricao: lembrete.descricao || '' }
    : { data: diaLocal(amanha), hora: '09:00', tipo: 'retornar_contato', descricao: '' })
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  async function salvar() {
    setErro('')
    if (!f.data || !f.hora) return setErro('Informe a data e o horário.')
    if (f.tipo === 'outro' && !f.descricao.trim()) return setErro('Descreva o lembrete.')
    setOcupado(true)
    try {
      await api.salvarLembrete({ ...f, lead_id: lead.id, vendedor_id: lead.vendedor_id })
      onSalvo(lembrete ? 'Lembrete atualizado' : 'Lembrete criado')
    } catch (e) {
      setErro(e.message)
      setOcupado(false)
    }
  }
  return (
    <Janela titulo={lembrete ? 'Editar lembrete' : 'Novo lembrete'} rotulo={lead.nome} ocupado={ocupado} onFechar={onFechar} onSubmit={salvar}
      rodape={<>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="button" className="btn btn-leve" onClick={onFechar} disabled={ocupado}>Cancelar</button>
        <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
      </>}>
      <div className="grade grade-3">
        <Campo id="lb-data" rotulo="Data" obrigatorio><input id="lb-data" type="date" value={f.data} onChange={(e) => setF((x) => ({ ...x, data: e.target.value }))} /></Campo>
        <Campo id="lb-hora" rotulo="Horário" obrigatorio><input id="lb-hora" type="time" step={900} value={f.hora} onChange={(e) => setF((x) => ({ ...x, hora: e.target.value }))} /></Campo>
        <Campo id="lb-tipo" rotulo="Tipo">
          <select id="lb-tipo" value={f.tipo} onChange={(e) => setF((x) => ({ ...x, tipo: e.target.value }))}>
            {TIPOS_LEMBRETE.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </Campo>
      </div>
      <Campo id="lb-desc" rotulo="Descrição" obrigatorio={f.tipo === 'outro'} ajuda="Na hora marcada, o vendedor recebe o aviso por WhatsApp e e-mail.">
        <textarea id="lb-desc" rows={3} maxLength={1000} value={f.descricao} onChange={(e) => setF((x) => ({ ...x, descricao: e.target.value }))} />
      </Campo>
    </Janela>
  )
}

// lista com Concluir / Editar / Excluir (dentro do cartão e em Meus lembretes)
export function ListaLembretes({ lembretes, lead, onMudou, mostrarLead, leads = [], pessoas }) {
  const [janela, setJanela] = useState(null)
  const [erro, setErro] = useState('')
  const ordenados = [...lembretes].sort((a, b) => (a.concluido_em ? 1 : 0) - (b.concluido_em ? 1 : 0) || a.quando.localeCompare(b.quando))
  const leadDe = (l) => lead || leads.find((x) => x.id === l.lead_id)
  async function concluir(l, feito) {
    setErro('')
    try {
      await api.concluirLembrete(l.id, feito)
      onMudou(feito ? 'Lembrete concluído' : 'Lembrete reaberto')
    } catch (e) {
      setErro(e.message)
    }
  }
  return (
    <>
      {lead && (
        <div className="secao-cab">
          <h3>Lembretes</h3>
          <button type="button" className="btn btn-contorno" onClick={() => setJanela({ tipo: 'novo' })}>+ Novo lembrete</button>
        </div>
      )}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ordenados.length === 0 ? <p className="vazio-mini">Nenhum lembrete.</p> : (
        <ul className="lista-lembretes">
          {ordenados.map((l) => {
            const est = estadoLembrete(l)
            const ld = leadDe(l)
            return (
              <li key={l.id} className={`lb-${est}`}>
                <span className="lb-info">
                  <span><strong>{dataHoraBR(l.quando)}</strong> <small className={`sit-lembrete sit-${est}`}>{ROTULO_ESTADO[est]}</small></span>
                  <span>{TIPOS_LEMBRETE.find(([k]) => k === l.tipo)?.[1]}{l.descricao ? `: ${l.descricao}` : ''}</span>
                  {mostrarLead && ld && <span className="celula-sub">{ld.nome} · {foneBR(ld.telefone)}{pessoas ? ` · ${nomeCurto(pessoas, l.vendedor_id)}` : ''}</span>}
                </span>
                <span className="acoes-linha">
                  {mostrarLead && ld && <button type="button" className="btn btn-leve" onClick={() => mostrarLead(ld.id)}>Abrir cartão</button>}
                  {l.concluido_em
                    ? <button type="button" className="btn btn-leve" onClick={() => concluir(l, false)}>Reabrir</button>
                    : <button type="button" className="btn btn-leve" onClick={() => concluir(l, true)}>Concluir</button>}
                  <button type="button" className="btn btn-leve" onClick={() => setJanela({ tipo: 'editar', lembrete: l, lead: ld })}>Editar</button>
                  <button type="button" className="btn btn-leve texto-atraso" onClick={() => setJanela({ tipo: 'excluir', lembrete: l })}>Excluir</button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {janela?.tipo === 'novo' && <LembreteForm lead={lead} onFechar={() => setJanela(null)} onSalvo={(m) => { setJanela(null); onMudou(m) }} />}
      {janela?.tipo === 'editar' && janela.lead && <LembreteForm lead={janela.lead} lembrete={janela.lembrete} onFechar={() => setJanela(null)} onSalvo={(m) => { setJanela(null); onMudou(m) }} />}
      {janela?.tipo === 'excluir' && <Confirmar titulo="Excluir este lembrete?" texto={`${dataHoraBR(janela.lembrete.quando)}${janela.lembrete.descricao ? ` · ${janela.lembrete.descricao}` : ''}`}
        onCancelar={() => setJanela(null)} onConfirmar={async () => { await api.excluirLembrete(janela.lembrete.id); setJanela(null); onMudou('Lembrete excluído') }} />}
    </>
  )
}

// Meus lembretes: Hoje / Atrasados / Próximos / Concluídos
export default function MeusLembretes() {
  const { dados, vendedores, pessoas, acoes, recarregar, avisar, abrirCartao } = useComercial()
  const [aba, setAba] = useState('hoje')
  const [vend, setVend] = useState('')
  const [novoPara, setNovoPara] = useState(null)
  const [busca, setBusca] = useState('')
  const lista = dados.lembretes.filter((l) => !vend || l.vendedor_id === vend)
  const grupos = useMemo(() => {
    const g = { hoje: [], atrasado: [], proximo: [], concluido: [] }
    lista.forEach((l) => g[estadoLembrete(l)].push(l))
    return g
  }, [lista])
  const abas = [['hoje', 'Hoje'], ['atrasado', 'Atrasados'], ['proximo', 'Próximos'], ['concluido', 'Concluídos']]
  const mudou = async (m) => { await recarregar(); avisar(m) }
  const t = busca.trim().toLowerCase()
  const candidatos = t.length >= 2 ? dados.leads.filter((l) => l.nome.toLowerCase().includes(t)).slice(0, 8) : []

  return (
    <section className="gestao comercial-lembretes">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Comercial</span>
          <h1 className="titulo-grande">{acoes.todos ? 'Lembretes' : 'Meus lembretes'}</h1>
          <p className="dica">{grupos.atrasado.length} atrasado{grupos.atrasado.length === 1 ? '' : 's'} · {grupos.hoje.length} para hoje</p>
        </div>
        <div className="novo-lembrete-busca">
          <label htmlFor="nl-busca" className="rotulo-campo">+ Novo lembrete para</label>
          <input id="nl-busca" type="search" placeholder="Digite o nome do cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
          {candidatos.length > 0 && (
            <ul className="sugestoes">
              {candidatos.map((l) => <li key={l.id}><button type="button" onClick={() => { setNovoPara(l); setBusca('') }}>{l.nome} · {foneBR(l.telefone)}</button></li>)}
            </ul>
          )}
        </div>
      </div>
      <div className="filtros-comercial">
        <nav className="segmentado" role="tablist" aria-label="Lembretes">
          {abas.map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={aba === k} className={aba === k ? 'ativo' : ''} onClick={() => setAba(k)}>
              {t} <span className="contador-aba">{grupos[k].length}</span>
            </button>
          ))}
        </nav>
        {acoes.todos && (
          <select aria-label="Lembretes de" value={vend} onChange={(e) => setVend(e.target.value)}>
            <option value="">Todos os vendedores</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome || v.email}</option>)}
          </select>
        )}
      </div>
      <ListaLembretes lembretes={grupos[aba]} leads={dados.leads} mostrarLead={abrirCartao} onMudou={mudou} pessoas={acoes.todos ? pessoas : null} />
      {novoPara && <LembreteForm lead={novoPara} onFechar={() => setNovoPara(null)} onSalvo={(m) => { setNovoPara(null); mudou(m) }} />}
    </section>
  )
}
