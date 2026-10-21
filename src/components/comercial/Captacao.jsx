import { useMemo, useState } from 'react'
import { api } from '../../lib/api.js'
import { agendaDoLead, diaLocal, diaMesHora, dataBR, foneBR, nomeCurto, SITUACOES_AGENDA } from '../../lib/comercial.js'
import ConfirmarExclusao from '../ConfirmarExclusao.jsx'
import { useComercial } from './comum.jsx'
import LeadForm from './LeadForm.jsx'
import AgendamentoForm, { TrocarVendedor } from './AgendamentoForm.jsx'

// Captação / Agendamentos: cadastro de leads e lista com ações
export default function Captacao() {
  const { dados, listas, vendedores, pessoas, lojas, acoes, recarregar, avisar, abrirCartao } = useComercial()
  const [busca, setBusca] = useState('')
  const [vend, setVend] = useState('')
  const [dia, setDia] = useState('')
  const [status, setStatus] = useState('')
  const [janela, setJanela] = useState(null) // { tipo, lead, agendamento }
  const colunas = [...listas.crm_colunas].sort((a, b) => a.ordem - b.ordem)
  const nomeLoja = (id) => lojas.find((l) => l.id === id)?.nome || id

  const linhas = useMemo(() => {
    const t = busca.trim().toLowerCase()
    const n = busca.replace(/\D/g, '')
    return dados.leads
      .map((l) => ({ ...l, agenda: agendaDoLead(dados.agendamentos, l.id), agendas: dados.agendamentos.filter((a) => a.lead_id === l.id) }))
      .filter((l) => !t || l.nome.toLowerCase().includes(t) || (n.length >= 3 && l.telefone.replace(/\D/g, '').includes(n)))
      .filter((l) => !vend || l.vendedor_id === vend)
      .filter((l) => !dia || l.agendas.some((a) => a.situacao !== 'cancelado' && diaLocal(a.inicio) === dia))
      .filter((l) => !status || (status === 'sem_agenda' ? !l.agenda : status === 'agendado' ? l.agenda?.situacao === 'marcado' : l.coluna_id === status))
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
  }, [dados, busca, vend, dia, status])

  const fechar = async (msg, novoId) => {
    setJanela(null)
    if (msg) {
      await recarregar()
      avisar(msg)
    }
    return novoId
  }
  const limpar = () => { setBusca(''); setVend(''); setDia(''); setStatus('') }

  return (
    <section className="gestao comercial-captacao">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Comercial</span>
          <h1 className="titulo-grande">Captação / Agendamentos</h1>
          <p className="dica">{dados.leads.length} lead{dados.leads.length === 1 ? '' : 's'} cadastrado{dados.leads.length === 1 ? '' : 's'}.</p>
        </div>
        {acoes.cadastrar && <button className="btn btn-principal" onClick={() => setJanela({ tipo: 'novo' })}>+ Novo lead</button>}
      </div>

      <div className="filtros-comercial" role="search">
        <input type="search" placeholder="Buscar por nome ou telefone" aria-label="Buscar por nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {acoes.todos && (
          <select aria-label="Filtrar por vendedor" value={vend} onChange={(e) => setVend(e.target.value)}>
            <option value="">Todos os vendedores</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome || v.email}</option>)}
          </select>
        )}
        <input type="date" aria-label="Dia do agendamento" title="Dia do agendamento" value={dia} onChange={(e) => setDia(e.target.value)} />
        <select aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="agendado">Com agendamento marcado</option>
          <option value="sem_agenda">Sem agendamento</option>
          {colunas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        {(busca || vend || dia || status) && <button type="button" className="btn btn-leve" onClick={limpar}>Limpar filtros</button>}
      </div>

      {linhas.length === 0 ? (
        <p className="vazio-grande">{dados.leads.length ? 'Nenhum lead com esses filtros.' : 'Nenhum lead ainda. Use “+ Novo lead” para cadastrar o primeiro.'}</p>
      ) : (
        <div className="tabela-leads" role="table" aria-label="Leads">
          <div className="tl-cab" role="row">
            <span role="columnheader">Cliente</span><span role="columnheader">Origem</span><span role="columnheader">Vendedor</span>
            <span role="columnheader">Agendamento</span><span role="columnheader">Status</span><span role="columnheader">Ações</span>
          </div>
          {linhas.map((l) => (
            <div key={l.id} className="tl-linha" role="row">
              <span role="cell" className="tl-cliente">
                <strong>{l.nome}</strong>
                <small>{foneBR(l.telefone)} · cadastrado em {dataBR(diaLocal(l.criado_em))}</small>
              </span>
              <span role="cell" data-rotulo="Origem">{listas.origens_lead.find((o) => o.id === l.origem_id)?.nome || '—'}</span>
              <span role="cell" data-rotulo="Vendedor">{nomeCurto(pessoas, l.vendedor_id)}</span>
              <span role="cell" data-rotulo="Agendamento">
                {l.agenda ? (
                  <>
                    {diaMesHora(l.agenda.inicio)} · {l.agenda.modalidade === 'online' ? 'Online' : nomeLoja(l.agenda.loja_id)}
                    <small className={`sit-agenda sit-${l.agenda.situacao}`}>{SITUACOES_AGENDA[l.agenda.situacao]}</small>
                  </>
                ) : <span className="celula-sub">Sem agendamento</span>}
              </span>
              <span role="cell" data-rotulo="Status"><span className={`chip chip-mini chip-col-${listas.crm_colunas.find((c) => c.id === l.coluna_id)?.tipo}`}>{listas.crm_colunas.find((c) => c.id === l.coluna_id)?.nome}</span></span>
              <span role="cell" className="tl-acoes">
                <button type="button" className="btn btn-leve" onClick={() => abrirCartao(l.id)}>Ver</button>
                <button type="button" className="btn btn-leve" onClick={() => setJanela({ tipo: 'editar', lead: l })}>Editar</button>
                <button type="button" className="btn btn-leve" onClick={() => setJanela({ tipo: 'agendar', lead: l, agendamento: l.agenda?.situacao === 'marcado' ? l.agenda : null })}>
                  {l.agenda?.situacao === 'marcado' ? 'Reagendar' : 'Agendar'}
                </button>
                {acoes.trocarVendedor && <button type="button" className="btn btn-leve" onClick={() => setJanela({ tipo: 'vendedor', lead: l })}>Trocar vendedor</button>}
                {acoes.excluir && <button type="button" className="btn btn-leve texto-atraso" onClick={() => setJanela({ tipo: 'excluir', lead: l })}>Excluir</button>}
              </span>
            </div>
          ))}
        </div>
      )}

      {janela?.tipo === 'novo' && <LeadForm onFechar={() => setJanela(null)} onSalvo={fechar} />}
      {janela?.tipo === 'editar' && <LeadForm lead={janela.lead} onFechar={() => setJanela(null)} onSalvo={fechar} />}
      {janela?.tipo === 'agendar' && <AgendamentoForm lead={janela.lead} agendamento={janela.agendamento} onFechar={() => setJanela(null)} onSalvo={fechar} />}
      {janela?.tipo === 'vendedor' && <TrocarVendedor lead={janela.lead} onFechar={() => setJanela(null)} onSalvo={fechar} />}
      {janela?.tipo === 'excluir' && (
        <ConfirmarExclusao nome={janela.lead.nome} texto="Some o lead com anexos, agendamentos, lembretes, briefing e histórico. As métricas deixam de contar este lead."
          onCancelar={() => setJanela(null)}
          onConfirmar={async () => { await api.excluirLead(janela.lead.id); await fechar('Lead excluído') }} />
      )}
    </section>
  )
}
