import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { formatarData, somarDiasUteis } from '../lib/constants.js'
import { PRAZOS_INTERNOS, situacaoPrazo } from '../lib/relatorio.js'
import CampoData from './CampoData.jsx'

// Situação de um prazo interno: cumprido, atrasado ou quanto falta
const CHIP = { ok: 'chip-concluida', atraso: 'chip-atraso', andamento: 'chip-em_andamento' }
function SituacaoPrazo({ prazo, feito, semBase }) {
  if (!prazo) return <span className="celula-sub">{semBase}</span>
  const sit = situacaoPrazo(prazo, feito)
  return <span className={`chip chip-mini ${CHIP[sit.tipo]}`}>{sit.texto}</span>
}

function Prazo({ rotulo, prazo, feito, semBase }) {
  return (
    <div className="controle-prazo">
      <span className="rotulo-campo">{rotulo}</span>
      <strong className="num">{prazo ? formatarData(prazo) : '—'}</strong>
      <SituacaoPrazo prazo={prazo} feito={feito} semBase={semBase} />
    </div>
  )
}

// Botão "Usar" com a data que o sistema já registrou sozinho
function Sugestao({ data, texto, valor, onUsar }) {
  if (!data || data === valor) return null
  return (
    <div className="sugestao-prazo">
      <span>{texto}: <strong className="num">{formatarData(data)}</strong></span>
      <button type="button" className="btn btn-leve" onClick={() => onUsar(data)}>Usar</button>
    </div>
  )
}

export default function ControleInterno({ processo: p }) {
  const [f, setF] = useState(null)
  const [erro, setErro] = useState('')
  const [salvo, setSalvo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setF(null)
    api.controleInterno(p.id).then(setF).catch((e) => setErro(e.message))
  }, [p.id])

  if (!f) return erro ? <p className="erro">{erro}</p> : <div className="carregando">Carregando…</div>

  const set = (k) => (v) => {
    setSalvo(false)
    setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  }
  const dataDe = (iso) => iso?.slice(0, 10) || null
  const assinadoZapSign = p.assinaturas?.find((a) => a.tipo === 'projeto_final' && a.status === 'assinado')?.assinado_em

  const prazoConferencia = somarDiasUteis(f.liberador_recebeu_em, PRAZOS_INTERNOS.conferencia)
  const prazoPdf = somarDiasUteis(f.conferencia_enviada_em, PRAZOS_INTERNOS.pdf)

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      setF(await api.salvarControleInterno(p.id, f))
      setSalvo(true)
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const data = (k, rotulo, extra) => (
    <div className="controle-campo">
      <CampoData id={`ci-${k}`} rotulo={rotulo} valor={f[k]} onChange={set(k)} />
      {extra}
    </div>
  )

  return (
    <form className="form controle-interno" onSubmit={salvar}>
      <p className="dica">
        Uso interno: o cliente não vê nada desta tela. Os prazos internos contam dias úteis, sem feriados municipais.
      </p>

      <fieldset className="grupo">
        <legend>Venda e início</legend>
        <div className="grade grade-3">
          <div className="controle-campo">
            <span className="rotulo-campo">Vendido em</span>
            <strong className="num controle-fixo">{formatarData(p.data_venda)}</strong>
          </div>
          {data('pendencia_resolvida_em', 'Pendência resolvida em',
            <Sugestao data={dataDe(p.financeiro_ok_em)} texto="Solução financeira marcada" valor={f.pendencia_resolvida_em} onUsar={set('pendencia_resolvida_em')} />)}
          {data('email_enviado_em', 'E-mail de formalização interna enviado em')}
          {data('inicial_assinado_em', 'Projeto inicial assinado em',
            <Sugestao data={dataDe(p.projeto_inicial_em)} texto="Projeto inicial marcado" valor={f.inicial_assinado_em} onUsar={set('inicial_assinado_em')} />)}
          {data('medido_em', 'Medido em',
            <Sugestao data={dataDe(p.medicao_concluida_em)} texto="Medição marcada" valor={f.medido_em} onUsar={set('medido_em')} />)}
        </div>
      </fieldset>

      <fieldset className="grupo">
        <legend>Liberador e conferência</legend>
        <div className="grade grade-3">
          <div className="campo">
            <label htmlFor="ci-liberador">Liberador</label>
            <input id="ci-liberador" value={f.liberador || ''} onChange={set('liberador')} placeholder="Quem recebeu a medição" />
          </div>
          {data('liberador_recebeu_em', 'Liberador recebeu a medição em')}
          <Prazo rotulo={`Prazo da conferência (${PRAZOS_INTERNOS.conferencia} dias úteis)`} prazo={prazoConferencia} feito={f.conferido_em}
            semBase="Calculado quando o liberador receber" />
          {data('conferido_em', 'Conferido em')}
          {data('conferencia_enviada_em', 'Projeto conferido enviado em')}
          <Prazo rotulo={`Prazo do PDF (${PRAZOS_INTERNOS.pdf} dias úteis)`} prazo={prazoPdf} feito={f.pdf_recebido_em}
            semBase="Calculado quando a conferência for enviada" />
          {data('pdf_recebido_em', 'PDF recebido em')}
          {data('projeto_final_assinado_em', 'Projeto final assinado em',
            <Sugestao data={dataDe(assinadoZapSign || p.projeto_assinado_em)} texto={assinadoZapSign ? 'Assinado no ZapSign' : 'Assinatura marcada'}
              valor={f.projeto_final_assinado_em} onUsar={set('projeto_final_assinado_em')} />)}
        </div>
      </fieldset>

      <fieldset className="grupo">
        <legend>Entrega, montagem e pós-montagem</legend>
        <div className="grade grade-3">
          {data('entregue_em', 'Entregue em')}
          {data('montagem_inicio_em', 'Montagem começou em')}
          <div className="campo">
            <label htmlFor="ci-montador">Montador</label>
            <input id="ci-montador" value={f.montador || ''} onChange={set('montador')} />
          </div>
          <div className="campo">
            <span className="rotulo-campo" id="ci-att-rotulo">Tem ATT (assistência técnica)?</span>
            <div className="segmentado" role="radiogroup" aria-labelledby="ci-att-rotulo">
              {[[null, 'A definir'], [true, 'Sim'], [false, 'Não']].map(([v, t]) => (
                <button key={t} type="button" role="radio" aria-checked={f.tem_att === v}
                  className={f.tem_att === v ? 'ativo' : ''} onClick={() => set('tem_att')(v)}>{t}</button>
              ))}
            </div>
          </div>
          {data('vistoria_em', 'Vistoria feita em')}
          {f.tem_att === true && data('assistencia_retorno_max', 'Assistência técnica: retorno máximo',
            f.assistencia_retorno_max && <SituacaoPrazo prazo={f.assistencia_retorno_max} feito={f.assistencia_concluida_em} />)}
          {f.tem_att === true && data('assistencia_concluida_em', 'Assistência técnica concluída em')}
        </div>
      </fieldset>

      <div className="campo">
        <label htmlFor="ci-obs">Observações internas</label>
        <textarea id="ci-obs" rows={3} maxLength={2000} value={f.observacoes || ''} onChange={set('observacoes')} />
      </div>

      <div className="acoes">
        <button className="btn btn-principal" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar controle'}</button>
        {salvo && <span className="toast">Salvo</span>}
        {f.atualizado_em && (
          <span className="celula-sub">
            Última alteração: {new Date(f.atualizado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            {f.atualizado_por ? ` por ${f.atualizado_por}` : ''}
          </span>
        )}
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </form>
  )
}
