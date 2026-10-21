import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api.js'
import { temPermissao } from '../../lib/permissoes.js'
import { reguaDoMes, mesSeguinte, nomeMes, calcularSalario } from '../../lib/salario.js'
import { dinheiro, dataBR } from '../../lib/comercial.js'
import { baixarArquivo } from '../../lib/relatorio.js'
import { Janela, Campo, Confirmar } from '../comercial/comum.jsx'

const mesAnterior = () => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const mesAtual = () => `${new Date().toISOString().slice(0, 7)}-01`
const pct = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const diaPagamento = (mes) => {
  const s = mesSeguinte(mes)
  return `10/${s.slice(5, 7)}`
}
function faixaTexto(f, faixas) {
  const ord = [...faixas].sort((a, b) => a.de - b.de)
  const i = ord.findIndex((x) => Number(x.de) === Number(f.de))
  const prox = ord[i + 1]
  return prox ? `${dinheiro(f.de)} a ${dinheiro(prox.de - 0.01)}` : `${dinheiro(f.de)} ou mais`
}

// Gestão Mensal: o vendedor vê só o próprio mês; gerente e master veem todos, pulam venda e fecham o mês
export default function GestaoMensal({ perfil }) {
  const todos = temPermissao(perfil, 'gestao_mensal_todos')
  const [mes, setMes] = useState(mesAnterior)
  const [vendedor, setVendedor] = useState(todos ? '' : perfil.id)
  const [salarios, setSalarios] = useState(null)
  const [vendas, setVendas] = useState([])
  const [reguas, setReguas] = useState([])
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [janela, setJanela] = useState(null)
  const [gerando, setGerando] = useState('')
  async function carregar() {
    setErro('')
    try {
      const [s, v, r] = await Promise.all([api.salarioMes(mes), api.vendasDoMes(mes, todos ? vendedor || null : null), api.reguas()])
      setSalarios(s)
      setVendas(v)
      setReguas(r)
    } catch (e) {
      setErro(e.message)
    }
  }
  useEffect(() => {
    setSalarios(null)
    carregar()
  }, [mes, vendedor])
  const avisar = (m) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 3500)
  }
  const regua = useMemo(() => reguaDoMes(reguas, mes), [reguas, mes])
  if (erro && !salarios) return <p className="erro" role="alert">{erro}</p>
  if (!salarios) return <div className="carregando">Carregando…</div>

  const meu = salarios.find((s) => s.vendedor_id === (vendedor || perfil.id))
  const fechado = todos && !vendedor ? salarios.length > 0 && salarios.every((s) => s.fechado) : meu?.fechado
  const podeFechar = todos && mes < mesAtual() && salarios.some((s) => !s.fechado)

  async function exportarPdf() {
    setGerando('pdf')
    try {
      const { gerarPdfDemonstrativo } = await import('../relatorio/PdfDemonstrativo.jsx')
      const s = meu
      baixarArquivo(await gerarPdfDemonstrativo({ mes: nomeMes(mes), pagamento: diaPagamento(mes) + '/' + mesSeguinte(mes).slice(0, 4), s, faixa: faixaTexto(s.faixa, regua.faixas),
        validas: vendas.filter((v) => v.situacao === 'valida' && v.vendedor_id === s.vendedor_id), pendentes: vendas.filter((v) => v.situacao !== 'valida' && v.vendedor_id === s.vendedor_id) }),
        `demonstrativo-${mes.slice(0, 7)}-${(s.vendedor || '').normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()}.pdf`)
    } catch (e) {
      setErro('Não foi possível gerar o PDF: ' + e.message)
    } finally {
      setGerando('')
    }
  }
  async function exportarExcel() {
    setGerando('xlsx')
    try {
      const { gerarXlsx } = await import('../../lib/xlsxSimples.js')
      const nome = (id) => salarios.find((s) => s.vendedor_id === id)?.vendedor || ''
      const abas = [
        { nome: 'Resumo', linhas: [['Vendedor', 'Total deflacionado (R$)', 'Faixa', 'Comissão (%)', 'Comissão (R$)', 'Fixo (R$)', 'Total a pagar (R$)', 'Vendas válidas', 'Pendentes', 'Mês fechado'],
          ...salarios.map((s) => [s.vendedor, s.total_deflacionado, faixaTexto(s.faixa, regua.faixas), Number(s.faixa.pct), s.comissao, s.fixo, s.total, s.vendas, s.pendentes, s.fechado ? 'Sim' : 'Não']),
          ['TOTAL', salarios.reduce((t, s) => t + s.total_deflacionado, 0), '', '', salarios.reduce((t, s) => t + s.comissao, 0), salarios.reduce((t, s) => t + s.fixo, 0), salarios.reduce((t, s) => t + s.total, 0)]] },
        { nome: 'Vendas válidas', linhas: [['Vendedor', 'Cliente', 'Pedido', 'Data', 'Valor bruto (R$)', 'Valor deflacionado (R$)'],
          ...vendas.filter((v) => v.situacao === 'valida').map((v) => [nome(v.vendedor_id), v.cliente, v.codigo_pedido, dataBR(v.venda_data), Number(v.venda_valor), Number(v.venda_deflacionado)])] },
        { nome: 'Pendentes e puladas', linhas: [['Vendedor', 'Cliente', 'Pedido', 'Data', 'Valor deflacionado (R$)', 'Situação', 'O que falta / motivo'],
          ...vendas.filter((v) => v.situacao !== 'valida').map((v) => [nome(v.vendedor_id), v.cliente, v.codigo_pedido, dataBR(v.venda_data), Number(v.venda_deflacionado), v.situacao === 'pulada' ? 'Pulada' : 'Pendente', v.situacao === 'pulada' ? v.pulo_motivo : v.faltando.join(', ')])] },
      ]
      baixarArquivo(await gerarXlsx(abas), `gestao-mensal-${mes.slice(0, 7)}.xlsx`)
    } catch (e) {
      setErro('Não foi possível exportar: ' + e.message)
    } finally {
      setGerando('')
    }
  }

  return (
    <section className="gestao gestao-mensal">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Gestão Mensal</span>
          <h1 className="titulo-grande">Meu Salário do Dia 10</h1>
          <p className="dica">Vendas com fechamento de 01 a {new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate()}/{mes.slice(5, 7)}/{mes.slice(0, 4)} · pagamento em {diaPagamento(mes)}{fechado ? ' · mês fechado' : ''}</p>
        </div>
        <div className="acoes-linha">
          {(vendedor || !todos) && meu && <button type="button" className="btn btn-contorno" onClick={exportarPdf} disabled={!!gerando}>{gerando === 'pdf' ? 'Gerando…' : 'Exportar demonstrativo (PDF)'}</button>}
          {todos && <button type="button" className="btn btn-contorno" onClick={exportarExcel} disabled={!!gerando}>{gerando === 'xlsx' ? 'Gerando…' : 'Exportar Excel'}</button>}
          {podeFechar && <button type="button" className="btn btn-principal" onClick={() => setJanela({ tipo: 'fechar' })}>Fechar mês</button>}
        </div>
      </div>
      <div className="filtros-comercial">
        <label className="campo-mini">Mês das vendas
          <input type="month" value={mes.slice(0, 7)} max={mesAtual().slice(0, 7)} onChange={(e) => e.target.value && setMes(`${e.target.value}-01`)} aria-label="Mês das vendas" />
        </label>
        {todos && (
          <select aria-label="Vendedor" value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
            <option value="">Todos</option>
            {salarios.map((s) => <option key={s.vendedor_id} value={s.vendedor_id}>{s.vendedor}</option>)}
          </select>
        )}
        {msg && <span className="toast" role="status">{msg}</span>}
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      {todos && !vendedor ? (
        <Resumo salarios={salarios} regua={regua} onVer={setVendedor} />
      ) : meu ? (
        <TelaVendedor s={meu} eu={meu.vendedor_id === perfil.id} mes={mes} regua={regua} vendas={vendas.filter((v) => v.vendedor_id === meu.vendedor_id)} todos={todos}
          onPular={(v) => setJanela({ tipo: 'pular', v })} onDesfazer={(v) => setJanela({ tipo: 'desfazer', v })} />
      ) : <p className="vazio-grande">Sem dados para este mês.</p>}

      {janela?.tipo === 'pular' && <PularVenda v={janela.v} onFechar={() => setJanela(null)} onFeito={async () => { setJanela(null); await carregar(); avisar('Venda retirada do cálculo do mês') }} />}
      {janela?.tipo === 'desfazer' && <Confirmar titulo={`Desfazer o pulo de ${janela.v.cliente}?`} botao="Desfazer" texto="A venda volta para o cálculo. Se o mês dela já foi fechado, entra no mês atual."
        onCancelar={() => setJanela(null)} onConfirmar={async () => { await api.desfazerPulo(janela.v.lead_id); setJanela(null); await carregar(); avisar('Pulo desfeito') }} />}
      {janela?.tipo === 'fechar' && <Confirmar titulo={`Fechar ${nomeMes(mes)}?`} botao="Fechar mês"
        texto="O cálculo de cada vendedor fica travado como está agora (valores, faixa e vendas). Mudanças depois não alteram este mês."
        onCancelar={() => setJanela(null)} onConfirmar={async () => { const n = await api.fecharMes(mes); setJanela(null); await carregar(); avisar(`Mês fechado para ${n} vendedor(es)`) }} />}
    </section>
  )
}

function Resumo({ salarios, regua, onVer }) {
  const soma = (k) => salarios.reduce((t, s) => t + Number(s[k] || 0), 0)
  return (
    <div className="tabela-rolagem grupo">
      <table className="tabela-metricas tabela-salarios">
        <thead><tr><th scope="col">Vendedor</th><th scope="col">Total deflacionado</th><th scope="col">Faixa</th><th scope="col">Comissão</th><th scope="col">Fixo</th><th scope="col">Total a pagar</th><th scope="col">Vendas</th><th scope="col"> </th></tr></thead>
        <tbody>
          {salarios.map((s) => (
            <tr key={s.vendedor_id}>
              <th scope="row">{s.vendedor}{s.fechado && <small className="sit-aviso sit-enviado">fechado</small>}</th>
              <td>{dinheiro(s.total_deflacionado)}</td><td>{faixaTexto(s.faixa, regua.faixas)} · {pct(s.faixa.pct)}</td><td>{dinheiro(s.comissao)}</td><td>{dinheiro(s.fixo)}</td>
              <td><strong>{dinheiro(s.total)}</strong></td><td>{s.vendas}{s.pendentes ? ` (+${s.pendentes} pend.)` : ''}</td>
              <td><button type="button" className="btn btn-leve" onClick={() => onVer(s.vendedor_id)}>Ver</button></td>
            </tr>
          ))}
          <tr className="linha-total"><th scope="row">Total</th><td>{dinheiro(soma('total_deflacionado'))}</td><td /><td>{dinheiro(soma('comissao'))}</td><td>{dinheiro(soma('fixo'))}</td><td><strong>{dinheiro(soma('total'))}</strong></td><td>{soma('vendas')}</td><td /></tr>
        </tbody>
      </table>
    </div>
  )
}

function TelaVendedor({ s, eu, mes, regua, vendas, todos, onPular, onDesfazer }) {
  const validas = vendas.filter((v) => v.situacao === 'valida')
  const pendentes = vendas.filter((v) => v.situacao !== 'valida')
  const prox = s.proxima
  const falta = prox ? Number(prox.de) - s.total_deflacionado : 0
  const simulado = prox ? calcularSalario(Number(prox.de), regua.faixas) : null
  const base = [...regua.faixas].sort((a, b) => a.de - b.de)
  const atualDe = Number(s.faixa.de)
  const progresso = prox ? Math.min(100, Math.max(2, ((s.total_deflacionado - atualDe) / (Number(prox.de) - atualDe)) * 100)) : 100
  return (
    <div className="salario">
      <div className="salario-destaque">
        <span className="salario-rotulo">{eu ? 'Você recebe' : `${s.vendedor} recebe`} no dia {diaPagamento(mes)}</span>
        <strong className="salario-valor">{dinheiro(s.total)}</strong>
        <span className="salario-sub">{nomeMes(mes)} · {s.vendas} venda(s) válida(s){s.fechado ? ' · mês fechado' : ''}</span>
      </div>
      <div className="indicadores">
        <div className="indicador"><span>Total deflacionado</span><strong>{dinheiro(s.total_deflacionado)}</strong></div>
        <div className="indicador"><span>Faixa atingida</span><strong className="indicador-texto">{faixaTexto(s.faixa, regua.faixas)}</strong></div>
        <div className="indicador"><span>Comissão</span><strong>{pct(s.faixa.pct)}</strong></div>
        <div className="indicador"><span>Valor da comissão</span><strong>{dinheiro(s.comissao)}</strong></div>
        <div className="indicador"><span>Fixo</span><strong>{dinheiro(s.fixo)}</strong></div>
      </div>
      <div className="grupo salario-progresso">
        {prox ? (
          <>
            <p><strong>Faltam {dinheiro(falta)}</strong> para chegar a {pct(prox.pct)} + {dinheiro(prox.fixo)} de fixo.</p>
            <div className="barra-faixa" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progresso)} aria-label="Progresso até a próxima faixa">
              <span style={{ width: `${progresso}%` }} />
            </div>
            <p className="dica">Simulação: com {dinheiro(Number(prox.de))} no mês, {eu ? 'você receberia' : 'receberia'} <strong>{dinheiro(simulado.total)}</strong> ({dinheiro(simulado.fixo)} + {dinheiro(simulado.comissao)}).</p>
          </>
        ) : <p><strong>Faixa máxima atingida</strong> ({pct(s.faixa.pct)} + {dinheiro(s.fixo)} de fixo).</p>}
        <div className="faixas-mini" aria-label="Régua de comissão">
          {base.map((f) => <span key={f.de} className={Number(f.de) === atualDe ? 'atual' : ''}>{dinheiro(f.de)}+ · {pct(f.pct)} · {dinheiro(f.fixo)}</span>)}
        </div>
      </div>
      <div className="grade grade-2">
        <fieldset className="grupo">
          <legend>Vendas válidas do mês</legend>
          {validas.length === 0 ? <p className="vazio-mini">Nenhuma venda válida neste mês.</p> : (
            <ul className="lista-lembretes">
              {validas.map((v) => (
                <li key={v.lead_id}>
                  <span className="lb-info"><strong>{v.cliente}</strong><span className="celula-sub">Pedido {v.codigo_pedido || '—'} · {dataBR(v.venda_data)} · {dinheiro(v.venda_deflacionado)} deflacionado</span></span>
                  {todos && !s.fechado && <button type="button" className="btn btn-leve texto-atraso" onClick={() => onPular(v)}>Pular venda</button>}
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        <fieldset className="grupo">
          <legend>Vendas pendentes</legend>
          {pendentes.length === 0 ? <p className="vazio-mini">Nenhuma venda pendente.</p> : (
            <ul className="lista-lembretes">
              {pendentes.map((v) => (
                <li key={v.lead_id} className="lb-atrasado">
                  <span className="lb-info">
                    <strong>{v.cliente}</strong>
                    <span className="celula-sub">Pedido {v.codigo_pedido || '—'} · {dataBR(v.venda_data)} · {dinheiro(v.venda_deflacionado)}</span>
                    {v.situacao === 'pulada'
                      ? <span className="celula-sub texto-atraso">Pulada: {v.pulo_motivo}</span>
                      : <span className="celula-sub texto-atraso">Falta: {v.faltando.join(', ')}</span>}
                  </span>
                  {todos && v.situacao === 'pulada' && <button type="button" className="btn btn-leve" onClick={() => onDesfazer(v)}>Desfazer</button>}
                  {todos && v.situacao === 'pendente' && <button type="button" className="btn btn-leve texto-atraso" onClick={() => onPular(v)}>Pular venda</button>}
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </div>
    </div>
  )
}

function PularVenda({ v, onFechar, onFeito }) {
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  async function ok() {
    if (motivo.trim().length < 3) return setErro('Escreva o motivo.')
    setOcupado(true)
    try {
      await api.pularVenda(v.lead_id, motivo)
      onFeito()
    } catch (e) {
      setErro(e.message)
      setOcupado(false)
    }
  }
  return (
    <Janela titulo={`Pular a venda de ${v.cliente}?`} rotulo="Gestão Mensal" largura="pequena" ocupado={ocupado} onFechar={onFechar} onSubmit={ok}
      rodape={<>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="button" className="btn btn-leve" onClick={onFechar} disabled={ocupado}>Cancelar</button>
        <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Pular venda'}</button>
      </>}>
      <p className="dica">A venda sai do cálculo do mês até ser resolvida. Fica registrado quem pulou, quando e por quê.</p>
      <Campo id="pv-motivo" rotulo="Motivo" obrigatorio><textarea id="pv-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
    </Janela>
  )
}
