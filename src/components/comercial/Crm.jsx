import { useMemo, useState } from 'react'
import { api } from '../../lib/api.js'
import { agendaDoLead, diaLocal, diaMesHora, dinheiro, estadoLembrete, foneBR, nomeCurto } from '../../lib/comercial.js'
import { Janela, Campo, Icone, useComercial } from './comum.jsx'
import LeadForm from './LeadForm.jsx'

// CRM: quadro de colunas com arrastar e soltar (no celular, "Mover para")
export default function Crm() {
  const { dados, listas, vendedores, pessoas, acoes, recarregar, avisar, abrirCartao, setDados } = useComercial()
  const [busca, setBusca] = useState('')
  const [vend, setVend] = useState('')
  const [origem, setOrigem] = useState('')
  const [pedido, setPedido] = useState(null) // { lead, coluna } aguardando valor/motivo
  const [novo, setNovo] = useState(false)
  const [arrastando, setArrastando] = useState(null)
  const [sobre, setSobre] = useState(null)
  const [erro, setErro] = useState('')
  const colunas = listas.crm_colunas.filter((c) => c.ativa).sort((a, b) => a.ordem - b.ordem)

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase()
    const n = busca.replace(/\D/g, '')
    return dados.leads.filter((l) => (!vend || l.vendedor_id === vend) && (!origem || l.origem_id === origem)
      && (!t || l.nome.toLowerCase().includes(t) || (n.length >= 3 && l.telefone.replace(/\D/g, '').includes(n))))
  }, [dados.leads, busca, vend, origem])

  async function mover(lead, coluna, extra) {
    if (lead.coluna_id === coluna.id) return
    if (!extra && coluna.tipo === 'ganho') return setPedido({ lead, coluna })
    if (!extra && coluna.tipo === 'perdido') return setPedido({ lead, coluna })
    setErro('')
    const antes = dados.leads
    // muda na tela na hora; se o banco recusar, volta como estava
    setDados((d) => ({ ...d, leads: d.leads.map((l) => (l.id === lead.id ? { ...l, coluna_id: coluna.id, posicao: Date.now() / 1000 } : l)) }))
    try {
      await api.moverLead(lead.id, coluna.id, extra || {})
      await recarregar()
      avisar(`${lead.nome} → ${coluna.nome}`)
    } catch (e) {
      setDados((d) => ({ ...d, leads: antes }))
      setErro(e.message)
      throw e
    }
  }

  return (
    <section className="gestao comercial-crm">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Comercial</span>
          <h1 className="titulo-grande">{acoes.todos ? 'CRM' : 'Meu CRM'}</h1>
          {acoes.mover && <p className="dica">Arraste o cartão para outra coluna. No celular, use “Mover para”.</p>}
        </div>
      </div>
      <div className="filtros-comercial" role="search">
        <input type="search" placeholder="Buscar por nome ou telefone" aria-label="Buscar no CRM" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {acoes.todos && (
          <select aria-label="Ver o CRM de" value={vend} onChange={(e) => setVend(e.target.value)}>
            <option value="">Todos os vendedores</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome || v.email}</option>)}
          </select>
        )}
        <select aria-label="Filtrar por origem" value={origem} onChange={(e) => setOrigem(e.target.value)}>
          <option value="">Todas as origens</option>
          {listas.origens_lead.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="kanban">
        {colunas.map((c) => {
          const cartoes = visiveis.filter((l) => l.coluna_id === c.id).sort((a, b) => b.posicao - a.posicao)
          const soma = c.tipo === 'ganho' ? cartoes.reduce((s, l) => s + Number(l.venda_valor || 0), 0) : null
          return (
            <div key={c.id} className={`kanban-coluna kanban-${c.tipo} ${sobre === c.id ? 'sobre' : ''}`}
              onDragOver={(e) => { if (acoes.mover) { e.preventDefault(); setSobre(c.id) } }}
              onDragLeave={() => setSobre((s) => (s === c.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault()
                setSobre(null)
                const lead = dados.leads.find((l) => l.id === (e.dataTransfer.getData('text/plain') || arrastando))
                setArrastando(null)
                if (lead) mover(lead, c).catch(() => {})
              }}>
              <header className="kanban-topo">
                <h2>{c.nome}</h2>
                <span className="kanban-contador" aria-label={`${cartoes.length} cartões`}>{cartoes.length}</span>
              </header>
              {soma !== null && cartoes.length > 0 && <p className="kanban-soma">{dinheiro(soma)}</p>}
              {c.tipo === 'entrada' && acoes.mover && (
                <button type="button" className="btn btn-contorno kanban-novo" onClick={() => setNovo(true)}>+ Adicionar cliente</button>
              )}
              <ul className="kanban-lista">
                {cartoes.map((l) => (
                  <CartaoKanban key={l.id} lead={l} colunas={colunas} pessoas={pessoas} mostrarVendedor={acoes.todos && !vend}
                    agenda={agendaDoLead(dados.agendamentos, l.id)} lembretes={dados.lembretes.filter((x) => x.lead_id === l.id)}
                    briefing={dados.briefings.find((b) => b.lead_id === l.id)} podeMover={acoes.mover}
                    onAbrir={() => abrirCartao(l.id)} onArrastar={setArrastando}
                    onMover={(col) => mover(l, col).catch(() => {})} />
                ))}
                {cartoes.length === 0 && <li className="kanban-vazio">Nenhum cartão</li>}
              </ul>
            </div>
          )
        })}
      </div>

      {pedido?.coluna.tipo === 'ganho' && (
        <Vendido lead={pedido.lead} onCancelar={() => setPedido(null)}
          onConfirmar={async (extra) => { await mover(pedido.lead, pedido.coluna, extra); setPedido(null) }} />
      )}
      {pedido?.coluna.tipo === 'perdido' && (
        <Perdido lead={pedido.lead} motivos={listas.motivos_perda.filter((m) => m.ativa)} onCancelar={() => setPedido(null)}
          onConfirmar={async (extra) => { await mover(pedido.lead, pedido.coluna, extra); setPedido(null) }} />
      )}
      {novo && <LeadForm onFechar={() => setNovo(false)} onSalvo={async (msg) => { setNovo(false); await recarregar(); avisar(msg) }} />}
    </section>
  )
}

function CartaoKanban({ lead, agenda, lembretes, briefing, colunas, pessoas, mostrarVendedor, podeMover, onAbrir, onArrastar, onMover }) {
  const estados = lembretes.map((l) => estadoLembrete(l))
  const atrasado = estados.includes('atrasado')
  const pendente = !atrasado && estados.some((e) => e === 'hoje' || e === 'proximo')
  return (
    <li className="kanban-cartao" draggable={podeMover} onDragStart={(e) => { e.dataTransfer.setData('text/plain', lead.id); e.dataTransfer.effectAllowed = 'move'; onArrastar(lead.id) }} onDragEnd={() => onArrastar(null)}>
      <div role="button" tabIndex={0} className="kanban-abrir" onClick={onAbrir} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onAbrir())}>
        <strong>{lead.nome}</strong>
        <span>{foneBR(lead.telefone)}</span>
        {agenda && <span className="kanban-agenda"><Icone nome="agenda" /> {diaMesHora(agenda.inicio)}</span>}
        {lead.venda_valor && <span className="kanban-valor">{dinheiro(lead.venda_valor)}</span>}
        {mostrarVendedor && <span className="kanban-vendedor">{nomeCurto(pessoas, lead.vendedor_id)}</span>}
        <span className="kanban-icones">
          {atrasado && <span className="kanban-ico ico-atrasado"><Icone nome="sino" titulo="Lembrete atrasado" /> atrasado</span>}
          {pendente && <span className="kanban-ico ico-pendente"><Icone nome="sino" titulo="Lembrete pendente" /></span>}
          {briefing?.feito && <span className="kanban-ico ico-briefing"><Icone nome="briefing" titulo="Briefing realizado" /></span>}
        </span>
      </div>
      {podeMover && (
        <select className="kanban-mover" aria-label={`Mover ${lead.nome} para`} value="" onChange={(e) => { const c = colunas.find((x) => x.id === e.target.value); if (c) onMover(c) }}>
          <option value="">Mover para…</option>
          {colunas.filter((c) => c.id !== lead.coluna_id).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      )}
    </li>
  )
}

// Vendido: pede valor e data; cancelar deixa o cartão onde estava
export function Vendido({ lead, onConfirmar, onCancelar }) {
  const [valor, setValor] = useState(lead.venda_valor ? String(lead.venda_valor).replace('.', ',') : '')
  const [data, setData] = useState(lead.venda_data || diaLocal(new Date()))
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const numero = Number(valor.replace(/\./g, '').replace(',', '.'))
  async function ok() {
    setErro('')
    if (!(numero > 0)) return setErro('Informe o valor da venda.')
    if (!data) return setErro('Informe a data de fechamento.')
    setOcupado(true)
    try {
      await onConfirmar({ venda_valor: numero, venda_data: data })
    } catch (e) {
      setErro(e.message)
      setOcupado(false)
    }
  }
  return (
    <Janela titulo="Marcar como vendido" rotulo={lead.nome} largura="pequena" ocupado={ocupado} onFechar={onCancelar} onSubmit={ok}
      rodape={<>
        <button type="button" className="btn btn-leve" onClick={onCancelar} disabled={ocupado}>Cancelar</button>
        <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Confirmar venda'}</button>
      </>}>
      <div className="grade grade-2">
        <Campo id="vd-valor" rotulo="Valor da venda (R$)" obrigatorio>
          <input id="vd-valor" inputMode="decimal" placeholder="25.000,00" value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, ''))} />
        </Campo>
        <Campo id="vd-data" rotulo="Data de fechamento" obrigatorio>
          <input id="vd-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </Janela>
  )
}

export function Perdido({ lead, motivos, onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState(lead.perda_motivo_id || '')
  const [texto, setTexto] = useState(lead.perda_texto || '')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const m = motivos.find((x) => x.id === motivo)
  async function ok() {
    setErro('')
    if (!m) return setErro('Escolha o motivo da perda.')
    if (m.pede_texto && !texto.trim()) return setErro('Descreva o motivo da perda.')
    setOcupado(true)
    try {
      await onConfirmar({ perda_motivo_id: motivo, perda_texto: texto })
    } catch (e) {
      setErro(e.message)
      setOcupado(false)
    }
  }
  return (
    <Janela titulo="Marcar como perdido" rotulo={lead.nome} largura="pequena" ocupado={ocupado} onFechar={onCancelar} onSubmit={ok}
      rodape={<>
        <button type="button" className="btn btn-leve" onClick={onCancelar} disabled={ocupado}>Cancelar</button>
        <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Confirmar perda'}</button>
      </>}>
      <Campo id="pd-motivo" rotulo="Motivo" obrigatorio>
        <select id="pd-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
          <option value="">Escolha…</option>
          {motivos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>
      </Campo>
      <Campo id="pd-texto" rotulo={m?.pede_texto ? 'Descreva o motivo' : 'Detalhes (opcional)'} obrigatorio={m?.pede_texto}>
        <textarea id="pd-texto" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </Campo>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </Janela>
  )
}
