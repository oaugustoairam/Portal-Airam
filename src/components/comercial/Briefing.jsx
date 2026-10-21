import { useState } from 'react'
import { api } from '../../lib/api.js'
import { agendaDoLead, dataBR, diaLocal, nomeCurto, foneBR, dataHoraBR, PERGUNTAS_BRIEFING } from '../../lib/comercial.js'
import { TEXTOS_BRIEFING } from '../../lib/apiComercial.js'
import { baixarArquivo } from '../../lib/relatorio.js'
import { Campo, Escolha, useComercial } from './comum.jsx'

const SIM_NAO = [[true, 'Sim'], [false, 'Não']]

// Briefing do cliente: feito por mensagem ou ligação, perguntas e PDF para imprimir
export default function Briefing({ lead, briefing, onSalvo }) {
  const { acoes, listas, pessoas, lojas, dados } = useComercial()
  const vazio = { feito: false, forma: null, data: diaLocal(new Date()), ja_mora: null, obra: null, ...Object.fromEntries(TEXTOS_BRIEFING.map((k) => [k, ''])) }
  const comBriefing = (b) => {
    const x = { ...vazio, ...(b || {}) }
    for (const k of TEXTOS_BRIEFING) x[k] = x[k] ?? ''
    return x
  }
  const [f, setF] = useState(() => comBriefing(briefing))
  const temRespostas = !!(briefing && (briefing.ja_mora != null || briefing.obra != null || TEXTOS_BRIEFING.some((k) => briefing[k])))
  const [editando, setEditando] = useState(!briefing && acoes.briefing)
  const [preencher, setPreencher] = useState(temRespostas)
  const [ocupado, setOcupado] = useState(false)
  const [imprimindo, setImprimindo] = useState(false)
  const [erro, setErro] = useState('')
  const ler = !editando || !acoes.briefing
  const muda = (k, v) => setF((x) => ({ ...x, [k]: v }))

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (f.feito && !f.forma) return setErro('Diga se o briefing foi por mensagem ou ligação.')
    if (f.feito && !f.data) return setErro('Informe a data do briefing.')
    setOcupado(true)
    try {
      await api.salvarBriefing({ ...f, lead_id: lead.id })
      setEditando(false)
      onSalvo('Briefing salvo')
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  async function imprimir() {
    setImprimindo(true)
    setErro('')
    try {
      const ag = agendaDoLead(dados.agendamentos, lead.id)
      const cab = {
        cliente: lead.nome, contato: [foneBR(lead.telefone), lead.email].filter(Boolean).join(' · '),
        vendedor: nomeCurto(pessoas, lead.vendedor_id), captador: nomeCurto(pessoas, lead.captador_id),
        origem: listas.origens_lead.find((o) => o.id === lead.origem_id)?.nome || '',
        agendamento: ag ? dataHoraBR(ag.inicio) : '', local: ag ? (ag.modalidade === 'online' ? 'Online' : lojas.find((l) => l.id === ag.loja_id)?.nome || '') : '',
      }
      const { gerarPdfBriefing } = await import('../relatorio/PdfBriefing.jsx')
      // sem briefing salvo, sai o formulário em branco para preencher à mão
      baixarArquivo(await gerarPdfBriefing(cab, briefing || null), `briefing-${lead.nome.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()}.pdf`)
    } catch (e) {
      setErro('Não foi possível gerar o PDF: ' + e.message)
    } finally {
      setImprimindo(false)
    }
  }

  return (
    <form className="briefing" onSubmit={salvar}>
      <div className="secao-cab">
        <h3>Briefing</h3>
        <span className="acoes-linha">
          {ler && acoes.briefing && <button type="button" className="btn btn-contorno" onClick={() => setEditando(true)}>Editar</button>}
          <button type="button" className="btn btn-contorno" onClick={imprimir} disabled={imprimindo}>{imprimindo ? 'Gerando…' : 'IMPRIMIR'}</button>
        </span>
      </div>
      {!acoes.briefing && <p className="dica">O briefing é preenchido pelo vendedor. Você pode imprimir.</p>}

      <fieldset className="grupo" disabled={ler}>
        <label className="check"><input type="checkbox" checked={!!f.feito} onChange={(e) => muda('feito', e.target.checked)} /> Briefing realizado</label>
        {f.feito && (
          <div className="grade grade-2">
            <Escolha id="bf-forma" rotulo="Como" valor={f.forma} onChange={(v) => muda('forma', v)} opcoes={[['mensagem', 'Mensagem'], ['ligacao', 'Ligação']]} />
            <Campo id="bf-data" rotulo="Data"><input id="bf-data" type="date" value={f.data || ''} onChange={(e) => muda('data', e.target.value)} /></Campo>
          </div>
        )}
      </fieldset>

      {!preencher && !ler && <button type="button" className="btn btn-contorno" onClick={() => setPreencher(true)}>Preencher briefing</button>}
      {(preencher || (ler && temRespostas)) && (
        <fieldset className="grupo briefing-perguntas" disabled={ler}>
          <legend>Perguntas</legend>
          <p className="dica">Todas são opcionais. No PDF, o que ficar em branco sai com linhas para preencher à mão.</p>
          {PERGUNTAS_BRIEFING.map((q, n) => (
            <div key={q.campo} className="briefing-pergunta">
              {q.simnao ? (
                <Escolha id={`bf-${q.campo}`} rotulo={`${n + 1}. ${q.texto}`} valor={f[q.campo]} onChange={(v) => muda(q.campo, f[q.campo] === v ? null : v)} opcoes={SIM_NAO} />
              ) : (
                <Campo id={`bf-${q.campo}`} rotulo={`${n + 1}. ${q.texto}`}>
                  <textarea id={`bf-${q.campo}`} rows={q.linhas > 2 ? 3 : 2} maxLength={2000} value={f[q.campo]} onChange={(e) => muda(q.campo, e.target.value)} />
                </Campo>
              )}
              {q.extra && f[q.campo] === q.extra.quando && (
                <Campo id={`bf-${q.extra.campo}`} rotulo={q.extra.texto}>
                  <input id={`bf-${q.extra.campo}`} maxLength={2000} value={f[q.extra.campo]} onChange={(e) => muda(q.extra.campo, e.target.value)} />
                </Campo>
              )}
            </div>
          ))}
        </fieldset>
      )}
      {briefing?.atualizado_em && ler && <p className="dica">Atualizado em {dataBR(diaLocal(briefing.atualizado_em))}.</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!ler && (
        <div className="acoes">
          {briefing && <button type="button" className="btn btn-leve" onClick={() => { setF(comBriefing(briefing)); setEditando(false) }} disabled={ocupado}>Cancelar</button>}
          <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar briefing'}</button>
        </div>
      )}
    </form>
  )
}
