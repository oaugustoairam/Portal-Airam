import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api.js'
import { MUNICIPIOS, contarDiasUteis, somarDiasUteisCalc, diasDoMes, deIso, iso, feriadosDoAno } from '../../lib/diasUteis.js'

const hoje = () => iso(new Date())
const dataLonga = (s) => deIso(s).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
const dataCurta = (s) => s.split('-').reverse().join('/')
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const TIPO = { nacional: 'Nacional', estadual: 'Estadual (SP)', municipal: 'Municipal', empresa: 'Empresa' }

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    // navegador sem permissão de área de transferência: seleciona um campo escondido
    const t = document.createElement('textarea')
    t.value = texto
    document.body.appendChild(t)
    t.select()
    const ok = document.execCommand('copy')
    t.remove()
    return ok
  }
}

function BotaoCopiar({ texto }) {
  const [estado, setEstado] = useState('')
  return (
    <button type="button" className="btn btn-contorno" onClick={async () => { setEstado((await copiar(texto)) ? 'Copiado!' : 'Não foi possível copiar'); setTimeout(() => setEstado(''), 2500) }}>
      {estado || 'Copiar resultado'}
    </button>
  )
}

// Ferramentas > Calculadora de dias úteis
export default function DiasUteis() {
  const [municipio, setMunicipio] = useState('sao_paulo')
  const [sabadoUtil, setSabadoUtil] = useState(false)
  const [daEmpresa, setDaEmpresa] = useState([])
  const [erroCarga, setErroCarga] = useState('')
  const [entre, setEntre] = useState({ inicio: hoje(), fim: iso(new Date(Date.now() + 30 * 86400000)) })
  const [soma, setSoma] = useState({ inicio: hoje(), dias: '45', subtrair: false })
  // o pedido guarda as datas; o resultado se refaz sozinho quando muda município, sábado ou recesso
  const [pedido1, setPedido1] = useState(null)
  const [pedido2, setPedido2] = useState(null)
  const [erro1, setErro1] = useState('')
  const [erro2, setErro2] = useState('')
  const [mes, setMes] = useState(() => ({ ano: new Date().getFullYear(), mes: new Date().getMonth() }))
  useEffect(() => {
    api.feriadosEmpresa().then(setDaEmpresa).catch((e) => setErroCarga(e.message))
  }, [])
  const opcoes = { municipio, sabadoUtil, daEmpresa }
  const nomeMunicipio = MUNICIPIOS.find(([k]) => k === municipio)[1]
  const regra = `${sabadoUtil ? 'sábado conta como dia útil' : 'segunda a sexta'} · feriados: ${municipio === 'nenhum' ? 'nacionais e de SP' : `nacionais, de SP e de ${nomeMunicipio}`}${daEmpresa.length ? ' + recessos da empresa' : ''}`

  const r1 = useMemo(() => pedido1 && contarDiasUteis(pedido1.inicio, pedido1.fim, opcoes), [pedido1, municipio, sabadoUtil, daEmpresa])
  const r2 = useMemo(() => pedido2 && somarDiasUteisCalc(pedido2.inicio, pedido2.dias, { ...opcoes, subtrair: pedido2.subtrair }), [pedido2, municipio, sabadoUtil, daEmpresa])

  function calcular1() {
    setErro1('')
    if (!entre.inicio || !entre.fim) return setErro1('Informe as duas datas.')
    setPedido1({ ...entre })
    const ini = [entre.inicio, entre.fim].sort()[0]
    setMes({ ano: deIso(ini).getFullYear(), mes: deIso(ini).getMonth() })
  }
  function calcular2() {
    setErro2('')
    const n = Number(soma.dias)
    if (!soma.inicio) return setErro2('Informe a data inicial.')
    if (!Number.isInteger(n) || n < 1 || n > 2000) return setErro2('Informe de 1 a 2000 dias úteis.')
    const r = somarDiasUteisCalc(soma.inicio, n, { ...opcoes, subtrair: soma.subtrair })
    setPedido2({ inicio: soma.inicio, dias: n, subtrair: soma.subtrair })
    setMes({ ano: deIso(r.resultado).getFullYear(), mes: deIso(r.resultado).getMonth() })
  }

  const texto1 = r1 && `De ${dataCurta(r1.inicio)} a ${dataCurta(r1.fim)}: ${r1.uteis} dias úteis, ${r1.corridos} dias corridos, ${r1.finsDeSemana} dias de fim de semana, ${r1.feriadosEmDiaUtil} feriado(s) em dia útil (${regra}).`
    + (r1.feriados.length ? `\nFeriados: ${r1.feriados.map((f) => `${dataCurta(f.data)} ${f.nome}`).join('; ')}` : '')
  const texto2 = r2 && `${dataCurta(r2.inicio)} ${pedido2.subtrair ? '−' : '+'} ${r2.dias} dias úteis = ${dataCurta(r2.resultado)} (${dataLonga(r2.resultado)}; ${regra}).`

  const dias = useMemo(() => diasDoMes(mes.ano, mes.mes, opcoes), [mes, municipio, sabadoUtil, daEmpresa])
  const feriadosDoMes = dias.filter((d) => d.feriado)
  const marcado = (d) => (r1 && d.data >= r1.inicio && d.data <= r1.fim ? 'no-periodo' : '') + (r2 && d.data === r2.resultado ? ' resultado' : '')
  const andarMes = (n) => setMes((m) => {
    const d = new Date(m.ano, m.mes + n, 1)
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })

  return (
    <section className="gestao dias-uteis">
      <div className="titulo-processo">
        <span className="rotulo">Ferramentas</span>
        <h1 className="titulo-grande">Calculadora de dias úteis</h1>
        <p className="dica">{regra}</p>
      </div>
      {erroCarga && <p className="erro" role="alert">Recessos da empresa não carregaram: {erroCarga}</p>}
      <div className="filtros-comercial">
        <label className="campo-mini">Feriados municipais de
          <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} aria-label="Município">
            {MUNICIPIOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={sabadoUtil} onChange={(e) => setSabadoUtil(e.target.checked)} /> Sábado é dia útil</label>
      </div>

      <div className="du-grade">
        <form className="grupo du-cartao" onSubmit={(e) => { e.preventDefault(); calcular1() }}>
          <h3 className="du-legenda">Dias úteis entre duas datas</h3>
          <div className="grade grade-2">
            <div className="campo"><label htmlFor="du-ini">Data inicial</label><input id="du-ini" type="date" value={entre.inicio} onChange={(e) => setEntre((x) => ({ ...x, inicio: e.target.value }))} /></div>
            <div className="campo"><label htmlFor="du-fim">Data final</label><input id="du-fim" type="date" value={entre.fim} onChange={(e) => setEntre((x) => ({ ...x, fim: e.target.value }))} /></div>
          </div>
          <div className="acoes"><button className="btn btn-principal">Calcular</button>{r1 && <BotaoCopiar texto={texto1} />}</div>
          {erro1 && <p className="erro" role="alert">{erro1}</p>}
          {r1 && (
            <div className="du-resultado" role="status">
              <div className="du-numero"><strong>{r1.uteis}</strong><span>dias úteis</span></div>
              <ul className="du-detalhe">
                <li><strong>{r1.corridos}</strong> dias corridos</li>
                <li><strong>{r1.finsDeSemana}</strong> de fim de semana</li>
                <li><strong>{r1.feriadosEmDiaUtil}</strong> feriado(s) em dia útil</li>
              </ul>
              {r1.feriados.length > 0 && (
                <ul className="du-feriados">
                  {r1.feriados.map((f) => <li key={f.data}><span>{dataCurta(f.data)}</span> {f.nome} <small>{TIPO[f.tipo]}{f.noFimDeSemana ? ' · caiu no fim de semana' : ''}</small></li>)}
                </ul>
              )}
            </div>
          )}
        </form>

        <form className="grupo du-cartao" onSubmit={(e) => { e.preventDefault(); calcular2() }}>
          <h3 className="du-legenda">Somar ou subtrair dias úteis</h3>
          <div className="grade grade-2">
            <div className="campo"><label htmlFor="du-sini">Data inicial</label><input id="du-sini" type="date" value={soma.inicio} onChange={(e) => setSoma((x) => ({ ...x, inicio: e.target.value }))} /></div>
            <div className="campo"><label htmlFor="du-dias">Dias úteis</label><input id="du-dias" type="number" min={1} max={2000} inputMode="numeric" value={soma.dias} onChange={(e) => setSoma((x) => ({ ...x, dias: e.target.value }))} /></div>
          </div>
          <div className="segmentado" role="radiogroup" aria-label="Somar ou subtrair">
            {[[false, 'Somar'], [true, 'Subtrair']].map(([k, t]) => <button key={t} type="button" role="radio" aria-checked={soma.subtrair === k} className={soma.subtrair === k ? 'ativo' : ''} onClick={() => setSoma((x) => ({ ...x, subtrair: k }))}>{t}</button>)}
          </div>
          <div className="acoes"><button className="btn btn-principal">Calcular</button>{r2 && <BotaoCopiar texto={texto2} />}</div>
          {erro2 && <p className="erro" role="alert">{erro2}</p>}
          {r2 && (
            <div className="du-resultado" role="status">
              <div className="du-numero"><strong>{dataCurta(r2.resultado)}</strong><span>{dataLonga(r2.resultado)}</span></div>
              <ul className="du-detalhe"><li><strong>{r2.corridos}</strong> dias corridos</li><li><strong>{r2.feriadosPulados.length}</strong> feriado(s) no caminho</li></ul>
              {r2.feriadosPulados.length > 0 && (
                <ul className="du-feriados">{r2.feriadosPulados.map((f) => <li key={f.data}><span>{dataCurta(f.data)}</span> {f.nome} <small>{TIPO[f.tipo]}</small></li>)}</ul>
              )}
            </div>
          )}
        </form>
      </div>

      <div className="grupo du-calendario">
        <div className="secao-cab">
          <h3 className="du-mes">{MESES[mes.mes]} de {mes.ano}</h3>
          <span className="acoes-linha">
            <button type="button" className="btn btn-contorno" onClick={() => andarMes(-1)} aria-label="Mês anterior">‹</button>
            <button type="button" className="btn btn-contorno" onClick={() => setMes({ ano: new Date().getFullYear(), mes: new Date().getMonth() })}>Hoje</button>
            <button type="button" className="btn btn-contorno" onClick={() => andarMes(1)} aria-label="Próximo mês">›</button>
          </span>
        </div>
        <div className="du-mes-grade" role="grid" aria-label={`${MESES[mes.mes]} de ${mes.ano}`}>
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <span key={d} className="du-sem" role="columnheader">{d}</span>)}
          {dias.map((d) => (
            <span key={d.data} role="gridcell" title={d.feriado?.nome || ''}
              className={`du-dia ${d.doMes ? '' : 'fora'} ${d.fimDeSemana ? 'fds' : ''} ${d.feriado ? `feriado feriado-${d.feriado.tipo}` : ''} ${d.data === hoje() ? 'hoje' : ''} ${marcado(d)}`}>
              {d.dia}
            </span>
          ))}
        </div>
        <div className="cal-legenda du-legenda-cores">
          <span><i className="lg-util" />Dia útil</span><span><i className="lg-fds" />Fim de semana</span><span><i className="lg-feriado" />Feriado</span>
          <span><i className="lg-empresa" />Recesso da empresa</span>{r1 && <span><i className="lg-periodo" />Período calculado</span>}{r2 && <span><i className="lg-resultado" />Data final</span>}
        </div>
        {feriadosDoMes.length > 0 ? (
          <ul className="du-feriados">{feriadosDoMes.map((d) => <li key={d.data}><span>{dataCurta(d.data)}</span> {d.feriado.nome} <small>{TIPO[d.feriado.tipo]}</small></li>)}</ul>
        ) : <p className="vazio-mini">Nenhum feriado neste mês.</p>}
        <details className="du-ano">
          <summary>Todos os feriados de {mes.ano}</summary>
          <ul className="du-feriados">{feriadosDoAno(mes.ano, municipio, daEmpresa).map((f) => <li key={f.data}><span>{dataCurta(f.data)}</span> {f.nome} <small>{TIPO[f.tipo]}</small></li>)}</ul>
        </details>
      </div>
    </section>
  )
}
