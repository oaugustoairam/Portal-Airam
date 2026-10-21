import { useState } from 'react'
import { api } from '../../lib/api.js'
import { agendaDoLead, dataBR, diaLocal, nomeCurto, foneBR, dataHoraBR } from '../../lib/comercial.js'
import { baixarArquivo } from '../../lib/relatorio.js'
import { Campo, Escolha, useComercial } from './comum.jsx'

const SIM_NAO = [[true, 'Sim'], [false, 'Não']]

// Briefing do cliente: feito por mensagem ou ligação, perguntas e PDF para imprimir
export default function Briefing({ lead, briefing, onSalvo }) {
  const { acoes, listas, pessoas, lojas, dados } = useComercial()
  const vazio = { feito: false, forma: null, data: diaLocal(new Date()), endereco: '', ja_mora: null, previsao_morar: '', pessoas: '', obra: null, obra_detalhes: '', eletros: '', observacoes: '' }
  const [f, setF] = useState(() => ({ ...vazio, ...(briefing || {}), pessoas: briefing?.pessoas ?? '' }))
  const temRespostas = !!(briefing && (briefing.endereco || briefing.ja_mora != null || briefing.pessoas != null || briefing.obra != null || briefing.eletros || briefing.observacoes))
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
    if (f.pessoas !== '' && (Number(f.pessoas) < 0 || Number(f.pessoas) > 50)) return setErro('Quantidade de pessoas inválida.')
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
          <Campo id="bf-end" rotulo="1. Endereço, bairro e cidade do imóvel">
            <input id="bf-end" value={f.endereco || ''} onChange={(e) => muda('endereco', e.target.value)} />
          </Campo>
          <Escolha id="bf-mora" rotulo="2. Já mora no imóvel?" valor={f.ja_mora} onChange={(v) => muda('ja_mora', v)} opcoes={SIM_NAO} />
          {f.ja_mora === false && (
            <Campo id="bf-prev" rotulo="Previsão para morar">
              <input id="bf-prev" placeholder="Ex.: março de 2027" value={f.previsao_morar || ''} onChange={(e) => muda('previsao_morar', e.target.value)} />
            </Campo>
          )}
          <Campo id="bf-pessoas" rotulo="3. Quantas pessoas vão morar">
            <input id="bf-pessoas" type="number" min={0} max={50} inputMode="numeric" value={f.pessoas} onChange={(e) => muda('pessoas', e.target.value)} />
          </Campo>
          <Escolha id="bf-obra" rotulo="4. Vai ter obra?" valor={f.obra} onChange={(v) => muda('obra', v)} opcoes={SIM_NAO} />
          {f.obra === true && (
            <Campo id="bf-obra-det" rotulo="Detalhes da obra">
              <textarea id="bf-obra-det" rows={2} value={f.obra_detalhes || ''} onChange={(e) => muda('obra_detalhes', e.target.value)} />
            </Campo>
          )}
          <Campo id="bf-eletros" rotulo="5. Lista de eletros">
            <textarea id="bf-eletros" rows={3} placeholder="Geladeira, cooktop, forno de embutir…" value={f.eletros || ''} onChange={(e) => muda('eletros', e.target.value)} />
          </Campo>
          <Campo id="bf-obs" rotulo="6. Observações">
            <textarea id="bf-obs" rows={3} value={f.observacoes || ''} onChange={(e) => muda('observacoes', e.target.value)} />
          </Campo>
        </fieldset>
      )}
      {briefing?.atualizado_em && ler && <p className="dica">Atualizado em {dataBR(diaLocal(briefing.atualizado_em))}.</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!ler && (
        <div className="acoes">
          {briefing && <button type="button" className="btn btn-leve" onClick={() => { setF({ ...vazio, ...briefing, pessoas: briefing.pessoas ?? '' }); setEditando(false) }} disabled={ocupado}>Cancelar</button>}
          <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar briefing'}</button>
        </div>
      )}
    </form>
  )
}
