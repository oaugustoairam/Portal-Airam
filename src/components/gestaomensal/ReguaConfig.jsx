import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { errosRegua } from '../../lib/apiFerramentas.js'
import { calcularSalario, nomeMes } from '../../lib/salario.js'
import { dinheiro } from '../../lib/comercial.js'

const proximoMes = () => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Configurações > Régua de comissão: faixas com vigência (meses fechados não mudam)
export default function ReguaConfig() {
  const [reguas, setReguas] = useState(null)
  const [faixas, setFaixas] = useState([])
  const [vigente, setVigente] = useState(proximoMes)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [teste, setTeste] = useState('120000')
  const carregar = async () => {
    const r = await api.reguas()
    setReguas(r)
    setFaixas(JSON.parse(JSON.stringify(r[0]?.faixas || [])))
  }
  useEffect(() => {
    carregar().catch((e) => setErro(e.message))
  }, [])
  if (!reguas) return erro ? <p className="erro">{erro}</p> : <div className="carregando">Carregando…</div>
  const muda = (i, k, v) => {
    setErro('')
    setFaixas((f) => f.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  }
  const numeros = faixas.map((f) => ({ de: Number(f.de), pct: Number(f.pct), fixo: Number(f.fixo) }))
  const simulado = !errosRegua(faixas, `${vigente}-01`) && Number(teste) >= 0 ? calcularSalario(Number(teste), numeros) : null
  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const er = errosRegua(faixas, `${vigente}-01`)
    if (er) return setErro(er)
    setOcupado(true)
    try {
      await api.salvarRegua(`${vigente}-01`, faixas)
      await carregar()
      setMsg(`Régua salva: vale a partir de ${nomeMes(`${vigente}-01`)}`)
      setTimeout(() => setMsg(''), 3500)
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <form className="grupo regua-config" onSubmit={salvar}>
      <p className="dica">A faixa é definida pelo total deflacionado do mês e o percentual vale sobre todo o valor. Salário = fixo + total × %.
        A nova régua vale a partir do mês escolhido; meses anteriores e meses fechados continuam com a régua antiga.</p>
      <table className="tabela-metricas tabela-regua">
        <thead><tr><th scope="col">A partir de (R$)</th><th scope="col">Comissão (%)</th><th scope="col">Fixo (R$)</th><th scope="col"> </th></tr></thead>
        <tbody>
          {faixas.map((f, i) => (
            <tr key={i}>
              <td><input type="number" min={0} step="0.01" aria-label={`Faixa ${i + 1}: a partir de`} value={f.de} disabled={i === 0} onChange={(e) => muda(i, 'de', e.target.value)} /></td>
              <td><input type="number" min={0} max={100} step="0.01" aria-label={`Faixa ${i + 1}: comissão`} value={f.pct} onChange={(e) => muda(i, 'pct', e.target.value)} /></td>
              <td><input type="number" min={0} step="0.01" aria-label={`Faixa ${i + 1}: fixo`} value={f.fixo} onChange={(e) => muda(i, 'fixo', e.target.value)} /></td>
              <td>{i > 0 && <button type="button" className="btn btn-leve texto-atraso" onClick={() => setFaixas((x) => x.filter((_, j) => j !== i))}>Remover</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="acoes">
        <button type="button" className="btn btn-contorno" onClick={() => setFaixas((x) => [...x, { de: Number(x[x.length - 1]?.de || 0) + 50000, pct: 0, fixo: 0 }])}>+ Adicionar faixa</button>
        <label className="campo-mini">Vale a partir de <input type="month" value={vigente} onChange={(e) => setVigente(e.target.value)} aria-label="Vale a partir de" /></label>
        <label className="campo-mini">Simular total <input type="number" min={0} value={teste} onChange={(e) => setTeste(e.target.value)} aria-label="Simular total deflacionado" /></label>
        {simulado && <span className="ok-texto" role="status">{dinheiro(Number(teste))} → {dinheiro(simulado.fixo)} + {dinheiro(simulado.comissao)} = <strong>{dinheiro(simulado.total)}</strong></span>}
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="acoes">
        <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar régua'}</button>
        {msg && <span className="toast" role="status">{msg}</span>}
      </div>
      <h3>Histórico de vigência</h3>
      <ul className="lista-lembretes">
        {reguas.map((r) => (
          <li key={r.id}><span className="lb-info"><strong>{r.vigente_desde <= '2000-12-31' ? 'Régua inicial' : `A partir de ${nomeMes(r.vigente_desde)}`}</strong>
            <span className="celula-sub">{r.faixas.map((f) => `${dinheiro(f.de)}+: ${f.pct}% + ${dinheiro(f.fixo)}`).join(' · ')}</span></span></li>
        ))}
      </ul>
    </form>
  )
}
