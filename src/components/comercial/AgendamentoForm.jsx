import { useState } from 'react'
import { api } from '../../lib/api.js'
import { errosAgendamento } from '../../lib/apiComercial.js'
import { diaLocal, horaLocal, foneBR } from '../../lib/comercial.js'
import { Janela, Campo, useComercial } from './comum.jsx'
import { CamposAgendamento } from './LeadForm.jsx'

// Agendar / reagendar. Sem lead definido (clique num dia do calendário), escolhe o lead na lista.
export default function AgendamentoForm({ lead, agendamento, dia, onFechar, onSalvo }) {
  const { lojas, dados } = useComercial()
  const lojasFisicas = lojas.filter((l) => l.id !== 'online')
  const [leadId, setLeadId] = useState(lead?.id || agendamento?.lead_id || '')
  const [busca, setBusca] = useState('')
  const [ag, setAg] = useState(() => agendamento
    ? { id: agendamento.id, data: diaLocal(agendamento.inicio), hora: horaLocal(agendamento.inicio), modalidade: agendamento.modalidade, loja_id: agendamento.loja_id || '' }
    : { data: dia || diaLocal(new Date()), hora: '10:00', modalidade: 'loja', loja_id: lojasFisicas[0]?.id || '' })
  const [tentou, setTentou] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const erros = tentou ? { ...errosAgendamento(ag), ...(!leadId ? { lead: 'Escolha o cliente.' } : {}) } : {}
  const alvo = dados.leads.find((l) => l.id === leadId)
  const t = busca.trim().toLowerCase()
  const nums = busca.replace(/\D/g, '')
  const opcoes = dados.leads.filter((l) => !t || l.nome.toLowerCase().includes(t) || (nums.length >= 3 && l.telefone.replace(/\D/g, '').includes(nums))).slice(0, 50)

  async function salvar() {
    setTentou(true)
    setErro('')
    if (Object.keys({ ...errosAgendamento(ag), ...(!leadId ? { lead: 1 } : {}) }).length) return setErro('Confira os campos marcados.')
    setOcupado(true)
    try {
      await api.salvarAgendamento({ ...ag, lead_id: leadId, vendedor_id: alvo?.vendedor_id })
      onSalvo(agendamento ? 'Agendamento remarcado' : 'Agendamento criado')
    } catch (e) {
      setErro(e.message)
      setOcupado(false)
    }
  }

  return (
    <Janela titulo={agendamento ? 'Reagendar' : 'Novo agendamento'} rotulo={alvo ? alvo.nome : 'Calendário'} ocupado={ocupado} onFechar={onFechar} onSubmit={salvar}
      rodape={<>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="button" className="btn btn-leve" onClick={onFechar} disabled={ocupado}>Cancelar</button>
        <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
      </>}>
      {!lead && !agendamento && (
        <Campo id="ag-lead" rotulo="Cliente (lead)" obrigatorio erro={erros.lead} ajuda={dados.leads.length ? 'Busque pelo nome ou telefone.' : 'Cadastre o lead primeiro em Captação.'}>
          <input id="ag-busca" type="search" placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar cliente" />
          <select id="ag-lead" value={leadId} onChange={(e) => setLeadId(e.target.value)} size={Math.min(6, Math.max(2, opcoes.length + 1))}>
            <option value="">Escolha…</option>
            {opcoes.map((l) => <option key={l.id} value={l.id}>{l.nome} · {foneBR(l.telefone)}</option>)}
          </select>
        </Campo>
      )}
      <CamposAgendamento ag={ag} setAg={setAg} erros={erros} lojas={lojasFisicas} prefixo="ag" />
    </Janela>
  )
}

export function TrocarVendedor({ lead, onFechar, onSalvo }) {
  const { vendedores } = useComercial()
  const [v, setV] = useState(lead.vendedor_id)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  async function salvar() {
    setErro('')
    setOcupado(true)
    try {
      await api.trocarVendedor(lead.id, v)
      const p = vendedores.find((x) => x.id === v)
      onSalvo(`Lead enviado para ${p?.nome || p?.email}`)
    } catch (e) {
      setErro(e.message)
      setOcupado(false)
    }
  }
  return (
    <Janela titulo="Trocar vendedor" rotulo={lead.nome} largura="pequena" ocupado={ocupado} onFechar={onFechar} onSubmit={salvar}
      rodape={<>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="button" className="btn btn-leve" onClick={onFechar} disabled={ocupado}>Cancelar</button>
        <button className="btn btn-principal" disabled={ocupado || v === lead.vendedor_id}>{ocupado ? 'Salvando…' : 'Trocar'}</button>
      </>}>
      <Campo id="tv-vend" rotulo="Novo vendedor" ajuda="Agendamentos e lembretes abertos passam para o novo vendedor, que recebe o aviso.">
        <select id="tv-vend" value={v} onChange={(e) => setV(e.target.value)}>
          {vendedores.map((x) => <option key={x.id} value={x.id}>{x.nome || x.email}</option>)}
        </select>
      </Campo>
    </Janela>
  )
}
