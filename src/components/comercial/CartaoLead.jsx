import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { dataBR, dataHoraBR, diaLocal, diaMesHora, dinheiro, foneBR, linkWhatsApp, nomeCurto, SITUACOES_AGENDA, TIPOS_ARQUIVO } from '../../lib/comercial.js'
import ConfirmarExclusao from '../ConfirmarExclusao.jsx'
import { Janela, Confirmar, useComercial } from './comum.jsx'
import LeadForm from './LeadForm.jsx'
import AgendamentoForm, { TrocarVendedor } from './AgendamentoForm.jsx'
import { Vendido, Perdido } from './Crm.jsx'
import { ListaLembretes } from './Lembretes.jsx'
import Briefing from './Briefing.jsx'

const ABAS = [['resumo', 'Resumo e agenda'], ['anexos', 'Anexos'], ['lembretes', 'Lembretes'], ['briefing', 'Briefing'], ['historico', 'Anotações e histórico'], ['avisos', 'Avisos enviados']]

// Cartão completo do cliente (lead)
export default function CartaoLead({ id, onFechar }) {
  const ctx = useComercial()
  const { dados, listas, pessoas, lojas, acoes, recarregar, avisar } = ctx
  const lead = dados.leads.find((l) => l.id === id)
  const [aba, setAba] = useState('resumo')
  const [janela, setJanela] = useState(null)
  const [arquivos, setArquivos] = useState(null)
  const [eventos, setEventos] = useState(null)
  const [avisos, setAvisos] = useState(null)
  const [erro, setErro] = useState('')
  const [nota, setNota] = useState('')
  const [salvandoNota, setSalvandoNota] = useState(false)
  const [tipoNovo, setTipoNovo] = useState('planta')
  const [enviando, setEnviando] = useState(false)

  const carregarExtras = () => Promise.all([
    api.arquivosLead(id).then(setArquivos),
    api.eventosLead(id).then(setEventos),
    api.avisosLead(id).then(setAvisos),
  ]).catch((e) => setErro(e.message))
  useEffect(() => {
    if (lead) carregarExtras()
  }, [id])

  if (!lead) {
    return (
      <Janela titulo="Lead não encontrado" largura="pequena" onFechar={onFechar}>
        <p className="dica">Este lead foi excluído ou passou para outro vendedor.</p>
      </Janela>
    )
  }
  const colunas = listas.crm_colunas.filter((c) => c.ativa).sort((a, b) => a.ordem - b.ordem)
  const coluna = listas.crm_colunas.find((c) => c.id === lead.coluna_id)
  const agendas = dados.agendamentos.filter((a) => a.lead_id === id).sort((a, b) => b.inicio.localeCompare(a.inicio))
  const nomeLoja = (lid) => lojas.find((l) => l.id === lid)?.nome || lid
  const zap = linkWhatsApp(lead.telefone)

  async function feito(msg) {
    setJanela(null)
    await recarregar()
    await carregarExtras()
    if (msg) avisar(msg)
  }
  async function agir(fn, msg) {
    setErro('')
    try {
      await fn()
      await feito(msg)
    } catch (e) {
      setErro(e.message)
    }
  }
  function moverPara(colId) {
    const c = colunas.find((x) => x.id === colId)
    if (!c) return
    if (c.tipo === 'ganho' || c.tipo === 'perdido') return setJanela({ tipo: c.tipo, coluna: c })
    agir(() => api.moverLead(lead.id, c.id), `${lead.nome} → ${c.nome}`)
  }
  async function anotar(e) {
    e.preventDefault()
    setSalvandoNota(true)
    setErro('')
    try {
      await api.anotarLead(lead.id, nota)
      setNota('')
      await feito('Anotação adicionada')
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvandoNota(false)
    }
  }
  async function enviarArquivos(lista) {
    setEnviando(true)
    setErro('')
    const falhas = []
    for (const f of lista) await api.enviarArquivoLead(lead.id, tipoNovo, f).catch((e) => falhas.push(e.message))
    setEnviando(false)
    await carregarExtras()
    if (falhas.length) setErro(falhas.join(' '))
    else avisar(lista.length > 1 ? `${lista.length} arquivos adicionados` : 'Arquivo adicionado')
  }
  async function abrirArquivo(arq, baixar) {
    try {
      const url = await api.urlArquivoLead(arq, baixar)
      if (baixar) {
        const a = document.createElement('a')
        a.href = url
        a.download = arq.nome
        document.body.appendChild(a)
        a.click()
        a.remove()
      } else window.open(url, '_blank', 'noopener')
    } catch (e) {
      setErro(e.message)
    }
  }

  return (
    <Janela titulo={lead.nome} rotulo={`Cartão do cliente · ${coluna?.nome || ''}`} largura="cartao" onFechar={onFechar}>
      <div className="cartao-topo">
        <dl className="cartao-dados">
          <div><dt>Telefone</dt><dd>{foneBR(lead.telefone)} {zap && <a className="link-zap" href={zap} target="_blank" rel="noreferrer">WhatsApp</a>}</dd></div>
          <div><dt>E-mail</dt><dd>{lead.email || '—'}</dd></div>
          <div><dt>Origem</dt><dd>{listas.origens_lead.find((o) => o.id === lead.origem_id)?.nome || '—'}</dd></div>
          <div><dt>Vendedor</dt><dd>{nomeCurto(pessoas, lead.vendedor_id)}</dd></div>
          <div><dt>Captador</dt><dd>{nomeCurto(pessoas, lead.captador_id)}</dd></div>
          <div><dt>Cadastrado</dt><dd>{dataHoraBR(lead.criado_em)}</dd></div>
          {lead.venda_valor && <div><dt>Venda · pedido {lead.codigo_pedido}</dt><dd>{dinheiro(lead.venda_valor)} bruto · {dinheiro(lead.venda_deflacionado)} deflacionado · {dataBR(lead.venda_data)}</dd></div>}
          {lead.perda_motivo_id && <div><dt>Perda</dt><dd>{listas.motivos_perda.find((m) => m.id === lead.perda_motivo_id)?.nome}{lead.perda_texto ? ` · ${lead.perda_texto}` : ''}</dd></div>}
        </dl>
        <div className="cartao-acoes">
          <button type="button" className="btn btn-contorno" onClick={() => setJanela({ tipo: 'editar' })}>Editar dados</button>
          {acoes.mover && (
            <select aria-label="Mover para" value="" onChange={(e) => moverPara(e.target.value)}>
              <option value="">Mover para…</option>
              {colunas.filter((c) => c.id !== lead.coluna_id).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
          {acoes.mover && coluna?.tipo === 'ganho' && <button type="button" className="btn btn-leve" onClick={() => setJanela({ tipo: 'corrigir' })}>Corrigir venda</button>}
          {acoes.trocarVendedor && <button type="button" className="btn btn-leve" onClick={() => setJanela({ tipo: 'vendedor' })}>Trocar vendedor</button>}
          {acoes.excluir && <button type="button" className="btn btn-leve texto-atraso" onClick={() => setJanela({ tipo: 'excluir' })}>Excluir lead</button>}
        </div>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      <nav className="cartao-abas" role="tablist" aria-label="Partes do cartão">
        {ABAS.filter(([k]) => (k !== 'lembretes' || acoes.lembretes)).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} className={aba === k ? 'ativa' : ''} onClick={() => setAba(k)}>{t}</button>
        ))}
      </nav>

      {aba === 'resumo' && (
        <div className="cartao-secao">
          <div className="secao-cab">
            <h3>Agendamentos</h3>
            <button type="button" className="btn btn-contorno" onClick={() => setJanela({ tipo: 'agendar' })}>+ Novo agendamento</button>
          </div>
          {agendas.length === 0 ? <p className="vazio-mini">Nenhum agendamento.</p> : (
            <ul className="lista-agendas">
              {agendas.map((a) => (
                <li key={a.id} className={`sit-${a.situacao}`}>
                  <span><strong>{dataHoraBR(a.inicio)}</strong> · {a.modalidade === 'online' ? 'Online' : nomeLoja(a.loja_id)}
                    <small className={`sit-agenda sit-${a.situacao}`}>{SITUACOES_AGENDA[a.situacao]}</small></span>
                  <span className="acoes-linha">
                    {a.situacao !== 'cancelado' && <>
                      <button type="button" className="btn btn-leve" aria-pressed={a.situacao === 'compareceu'} onClick={() => agir(() => api.situacaoAgendamento(a.id, 'compareceu'), 'Comparecimento marcado')}>Compareceu</button>
                      <button type="button" className="btn btn-leve" aria-pressed={a.situacao === 'nao_compareceu'} onClick={() => agir(() => api.situacaoAgendamento(a.id, 'nao_compareceu'), 'Marcado: não compareceu')}>Não compareceu</button>
                    </>}
                    <button type="button" className="btn btn-leve" onClick={() => setJanela({ tipo: 'agendar', agendamento: a })}>Reagendar</button>
                    {a.situacao !== 'cancelado' && <button type="button" className="btn btn-leve texto-atraso" onClick={() => setJanela({ tipo: 'cancelar', agendamento: a })}>Cancelar</button>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3>Conversa</h3>
          {lead.conversa_texto ? <pre className="conversa-texto">{lead.conversa_texto}</pre> : <p className="vazio-mini">Sem texto de conversa. Arquivos de conversa ficam em Anexos.</p>}
        </div>
      )}

      {aba === 'anexos' && (
        <div className="cartao-secao">
          <div className="secao-cab">
            <h3>Anexos</h3>
            <span className="acoes-linha">
              <select aria-label="Tipo do anexo" value={tipoNovo} onChange={(e) => setTipoNovo(e.target.value)}>
                {TIPOS_ARQUIVO.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
              <label className={`btn btn-contorno ${enviando ? 'desabilitado' : ''}`}>
                {enviando ? 'Enviando…' : '+ Adicionar'}
                <input type="file" multiple hidden disabled={enviando} accept="image/*,application/pdf,text/plain,.txt,.dwg,.zip"
                  onChange={(e) => { const l = [...e.target.files]; e.target.value = ''; if (l.length) enviarArquivos(l) }} />
              </label>
            </span>
          </div>
          {!arquivos ? <p className="vazio-mini">Carregando…</p> : arquivos.length === 0 ? <p className="vazio-mini">Nenhum anexo.</p> : (
            TIPOS_ARQUIVO.map(([k, t]) => {
              const doTipo = arquivos.filter((a) => a.tipo === k)
              if (!doTipo.length) return null
              return (
                <div key={k} className="grupo-anexos">
                  <h4>{t}</h4>
                  <ul className="lista-anexos">
                    {doTipo.map((a) => (
                      <li key={a.id}>
                        <span>{a.nome}<small>{dataBR(diaLocal(a.criado_em))}</small></span>
                        <span className="acoes-linha">
                          <button type="button" className="btn btn-leve" onClick={() => abrirArquivo(a, false)}>Visualizar</button>
                          <button type="button" className="btn btn-leve" onClick={() => abrirArquivo(a, true)}>Baixar</button>
                          <button type="button" className="btn btn-leve texto-atraso" onClick={() => setJanela({ tipo: 'remover', arquivo: a })}>Remover</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })
          )}
        </div>
      )}

      {aba === 'lembretes' && acoes.lembretes && (
        <div className="cartao-secao">
          <ListaLembretes lembretes={dados.lembretes.filter((l) => l.lead_id === id)} lead={lead} onMudou={feito} />
        </div>
      )}

      {aba === 'briefing' && (
        <div className="cartao-secao">
          <Briefing lead={lead} briefing={dados.briefings.find((b) => b.lead_id === id)} onSalvo={feito} />
        </div>
      )}

      {aba === 'historico' && (
        <div className="cartao-secao">
          <form className="nova-nota" onSubmit={anotar}>
            <label htmlFor="nota-txt" className="rotulo-campo">Adicionar anotação</label>
            <textarea id="nota-txt" rows={3} maxLength={5000} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: cliente pediu orçamento da cozinha até sexta" />
            <button className="btn btn-contorno" disabled={salvandoNota || nota.trim().length < 2}>{salvandoNota ? 'Salvando…' : 'Adicionar anotação'}</button>
          </form>
          {!eventos ? <p className="vazio-mini">Carregando…</p> : (
            <ol className="historico-lead">
              {eventos.map((e) => (
                <li key={e.id} className={`ev-${e.tipo}`}>
                  <span className="hist-quando">{dataHoraBR(e.quando)} · {nomeCurto(pessoas, e.por)}</span>
                  <span className="hist-texto">{textoEvento(e, { listas, lojas, pessoas })}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {aba === 'avisos' && (
        <div className="cartao-secao">
          <p className="dica">Avisos para o vendedor (novo lead e lembretes). Quando falha, o motivo aparece aqui e dá para reenviar.</p>
          {!avisos ? <p className="vazio-mini">Carregando…</p> : avisos.length === 0 ? <p className="vazio-mini">Nenhum aviso.</p> : (
            <ul className="lista-avisos">
              {avisos.map((a) => (
                <li key={a.id}>
                  <span><strong>{a.canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</strong> · {a.evento === 'lembrete' ? 'Lembrete' : 'Novo lead'} · {diaMesHora(a.enviado_em || a.criado_em)}
                    <small className={`sit-aviso sit-${a.situacao}`}>{{ enviado: 'Enviado', falhou: 'Falhou', pendente: 'Na fila', simulado: 'Simulado (demonstração)' }[a.situacao]}</small>
                  </span>
                  {a.erro && <small className="celula-sub">{a.erro}</small>}
                  {a.situacao === 'falhou' && <button type="button" className="btn btn-leve" onClick={() => agir(() => api.reenviarAviso(a.id), 'Aviso reenviado')}>Reenviar</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {janela?.tipo === 'editar' && <LeadForm lead={lead} onFechar={() => setJanela(null)} onSalvo={feito} />}
      {janela?.tipo === 'agendar' && <AgendamentoForm lead={lead} agendamento={janela.agendamento} onFechar={() => setJanela(null)} onSalvo={feito} />}
      {janela?.tipo === 'vendedor' && <TrocarVendedor lead={lead} onFechar={() => setJanela(null)} onSalvo={feito} />}
      {janela?.tipo === 'ganho' && <Vendido lead={lead} onCancelar={() => setJanela(null)}
        onConfirmar={async (x) => { await api.moverLead(lead.id, janela.coluna.id, x); await feito('Venda registrada') }} />}
      {janela?.tipo === 'corrigir' && <Vendido lead={lead} corrigir onCancelar={() => setJanela(null)}
        onConfirmar={async (x) => { await api.corrigirVenda(lead.id, x); await feito('Venda corrigida') }} />}
      {janela?.tipo === 'perdido' && <Perdido lead={lead} motivos={listas.motivos_perda.filter((m) => m.ativa)} onCancelar={() => setJanela(null)}
        onConfirmar={async (x) => { await api.moverLead(lead.id, janela.coluna.id, x); await feito('Perda registrada') }} />}
      {janela?.tipo === 'cancelar' && <Confirmar titulo="Cancelar este agendamento?" botao="Cancelar agendamento" texto={`${dataHoraBR(janela.agendamento.inicio)} · fica no histórico como cancelado.`}
        onCancelar={() => setJanela(null)} onConfirmar={async () => { await api.situacaoAgendamento(janela.agendamento.id, 'cancelado'); await feito('Agendamento cancelado') }} />}
      {janela?.tipo === 'remover' && <Confirmar titulo={`Remover ${janela.arquivo.nome}?`} botao="Remover" texto="O arquivo é apagado do portal."
        onCancelar={() => setJanela(null)} onConfirmar={async () => { await api.removerArquivoLead(janela.arquivo); await feito('Arquivo removido') }} />}
      {janela?.tipo === 'excluir' && <ConfirmarExclusao nome={lead.nome} texto="Some o lead com anexos, agendamentos, lembretes, briefing e histórico."
        onCancelar={() => setJanela(null)} onConfirmar={async () => { await api.excluirLead(lead.id); onFechar(); await recarregar(); avisar('Lead excluído') }} />}
    </Janela>
  )
}

export function textoEvento(e, { listas, lojas, pessoas }) {
  const col = (c) => listas.crm_colunas.find((x) => x.id === c)?.nome || c
  const loja = (a) => (a?.modalidade === 'online' ? 'Online' : lojas.find((l) => l.id === a?.loja_id)?.nome || '')
  const d = e.dados || {}
  switch (e.tipo) {
    case 'criado': return `Lead cadastrado para ${nomeCurto(pessoas, d.vendedor_id)}`
    case 'movido': return `Movido de ${col(e.de_coluna)} para ${col(e.para_coluna)}`
    case 'vendido': return `Vendido: pedido ${d.codigo || '—'} · ${dinheiro(d.valor)} bruto${d.deflacionado ? ` · ${dinheiro(d.deflacionado)} deflacionado` : ''} · ${dataBR(d.data)}`
    case 'venda_editada': return `Venda corrigida: ${dinheiro(d.antes?.deflacionado)} → ${dinheiro(d.depois?.deflacionado)} deflacionado · bruto ${dinheiro(d.depois?.valor)} · pedido ${d.depois?.codigo || '—'} · ${dataBR(d.depois?.data)}`
    case 'perdido': return `Perdido: ${listas.motivos_perda.find((m) => m.id === d.motivo_id)?.nome || ''}${e.texto ? ` · ${e.texto}` : ''}`
    case 'nota': return e.texto
    case 'agendamento': return `Agendado para ${dataHoraBR(d.inicio)} · ${loja(d)}`
    case 'remarcado': return `Reagendado de ${dataHoraBR(d.antes?.inicio)} para ${dataHoraBR(d.depois?.inicio)} · ${loja(d.depois)}`
    case 'comparecimento': return `Agendamento: ${SITUACOES_AGENDA[d.para] || d.para}`
    case 'lembrete': return `Lembrete para ${dataHoraBR(d.quando)}${e.texto ? `: ${e.texto}` : ''}`
    case 'briefing': return d.feito ? `Briefing realizado${d.forma ? ` por ${d.forma === 'ligacao' ? 'ligação' : 'mensagem'}` : ''}` : 'Briefing atualizado'
    case 'editado': return 'Dados do lead editados'
    case 'vendedor': return `Vendedor trocado: ${nomeCurto(pessoas, d.de)} → ${nomeCurto(pessoas, d.para)}`
    default: return e.tipo
  }
}
