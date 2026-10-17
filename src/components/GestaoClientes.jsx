import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import {
  FINANCEIRAS, financeira, financeiraPorNome, MEIOS, CAPTACOES, LIBERADORES, LOJAS_VENDA, SITUACOES, DOCS_PASTA,
  moeda, resumoVendas, ranking,
} from '../lib/vendas.js'
import {
  ABAS_GESTAO, STATUS, POS_VISTORIA, linhaGestao, paraVenda, oQueFalta, proximoCodigo, periodoRapido, zonaDoCep, registrosDaPlanilha,
} from '../lib/gestao.js'
import { temPermissao } from '../lib/permissoes.js'
import { cpfValido, formatarCpf, formatarTelefone, somarDiasUteis } from '../lib/constants.js'
import { baixarArquivo, nomeArquivo } from '../lib/relatorio.js'
import CampoData from './CampoData.jsx'
import PlanilhaFiltravel from './PlanilhaFiltravel.jsx'
import ConfirmarExclusao from './ConfirmarExclusao.jsx'
import { Acesso } from './AdminHome.jsx'

const CHIP_SIT = { pendente: 'chip-sit-andamento', resolvido: 'chip-sit-ok', cancelado: 'chip-sit-atraso' }
const CHIP_STATUS = { montado: 'chip-sit-ok', assinado: 'chip-sit-andamento', conferido: 'chip-sit-andamento', medido: 'chip-sit-neutro', aguarda: 'chip-sit-neutro', cancelado: 'chip-sit-atraso' }
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '')
const somarDias = (iso, n) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export const PASTAS_GESTAO = [...ABAS_GESTAO.map((a) => [a.id, a.nome]), ['resultados', 'Resultados'], ['pastas', 'Controle de pastas']]

// Gestão de clientes: um cadastro só para a venda, o processo e o acesso do cliente ao portal.
// O vendedor vê só os clientes dele; quem tem "ver todos" vê a loja inteira.
export default function GestaoClientes({ aba, perfil, onAbrirProcesso, onAba }) {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [ficha, setFicha] = useState(null) // linha da gestão ou 'novo'
  const [pasta, setPasta] = useState(null)
  const [periodos, setPeriodos] = useState({ resultados: periodoRapido('mes') })
  const [filtros, setFiltros] = useState({})
  const [ordens, setOrdens] = useState({})
  const [importar, setImportar] = useState(false)

  const carregar = () => api.listarGestao().then(setLista).catch((e) => setErro(e.message))
  useEffect(() => {
    carregar()
  }, [])
  useEffect(() => {
    setFicha(null)
    setPasta(null)
  }, [aba])

  // Resultados e Controle de pastas usam o mesmo período (um leva ao outro)
  const chavePeriodo = aba === 'pastas' ? 'resultados' : aba
  const periodo = periodos[chavePeriodo] || { de: '', ate: '' }
  const linhas = useMemo(() => (lista || []).map(linhaGestao), [lista])
  const doPeriodo = useMemo(
    () => linhas.filter((l) => (!periodo.de || (l.data_venda && l.data_venda >= periodo.de)) && (!periodo.ate || (l.data_venda && l.data_venda <= periodo.ate))),
    [linhas, periodo.de, periodo.ate]
  )
  const verTodos = temPermissao(perfil, 'ver_todos')

  const fecharFicha = (recarregar = true) => {
    setFicha(null)
    if (recarregar) carregar()
    window.scrollTo(0, 0)
  }

  if (erro) return <p className="erro">{erro}</p>
  if (!lista) return <div className="carregando">Carregando…</div>

  if (ficha)
    return (
      <FichaCliente g={ficha === 'novo' ? null : ficha.g} perfil={perfil} lista={lista} onFechar={fecharFicha}
        onAbrirPasta={(g) => { setFicha(null); setPasta(g) }} onAbrirProcesso={onAbrirProcesso} />
    )
  if (pasta) return <PastaCliente g={pasta} onFechar={() => { setPasta(null); carregar() }} onFicha={(g) => { setPasta(null); setFicha(linhaGestao(g)) }} />

  const barraPeriodo = <BarraPeriodo periodo={periodo} onChange={(p) => setPeriodos((x) => ({ ...x, [chavePeriodo]: p }))} />

  if (aba === 'resultados') return <Resultados linhas={doPeriodo} periodo={periodo} barraPeriodo={barraPeriodo} verTodos={verTodos} perfil={perfil}
    onAbrirPasta={(l) => setPasta(l.g)} onVerPastas={() => onAba?.('pastas')} />
  if (aba === 'pastas') return <ListaPastas linhas={doPeriodo} periodo={periodo} barraPeriodo={barraPeriodo} onAbrir={(l) => setPasta(l.g)} onVerResultados={() => onAba?.('resultados')} />

  const def = ABAS_GESTAO.find((a) => a.id === aba) || ABAS_GESTAO[0]
  const daAba = doPeriodo.filter(def.filtro)
  return (
    <section className="gestao">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Gestão de clientes{verTodos ? '' : ' · só os seus'}</span>
          <h1 className="titulo-grande">{def.titulo}</h1>
          <p className="dica">{def.descricao}</p>
        </div>
        <div className="acoes">
          {def.id === 'clientes' && verTodos && <button className="btn btn-leve" onClick={() => setImportar(true)}>Importar planilha</button>}
          <button className="btn btn-principal" onClick={() => setFicha('novo')}>Novo cliente</button>
        </div>
      </div>
      {barraPeriodo}
      <Kpis itens={def.kpis(daAba)} />
      <PlanilhaFiltravel
        linhas={daAba}
        colunas={def.colunas}
        visiveis={def.visiveis}
        filtros={filtros[def.id] || {}}
        setFiltros={(f) => setFiltros((x) => ({ ...x, [def.id]: typeof f === 'function' ? f(x[def.id] || {}) : f }))}
        ordem={ordens[def.id] || { k: 'data_venda', dir: 'desc' }}
        setOrdem={(o) => setOrdens((x) => ({ ...x, [def.id]: typeof o === 'function' ? o(x[def.id] || { k: 'data_venda', dir: 'desc' }) : o }))}
        onAbrir={(l) => setFicha(l)}
        celula={(l, k) => (k === 'situacao' ? <span className={`chip chip-mini ${CHIP_SIT[l.situacao]}`}>{SITUACOES.find(([s]) => s === l.situacao)?.[1]}</span>
          : k === 'status' ? <span className={`chip chip-mini ${CHIP_STATUS[l.status]}`}>{STATUS[l.status]}</span>
            : k === 'prazo_maximo' && l.prazo_vencido ? <span className="texto-atraso">{dataBR(l.prazo_maximo)} · vencido</span>
              : undefined)}
        rotuloVazio={def.id === 'clientes' ? 'Nenhum cliente ainda. Toque em "Novo cliente".' : 'Nenhum cliente nesta etapa.'}
      />
      {importar && <Importar onFechar={(mudou) => { setImportar(false); if (mudou) carregar() }} />}
    </section>
  )
}

function Kpis({ itens }) {
  return (
    <div className="gestao-kpis">
      {itens.map(([t, v, tom]) => (
        <div key={t} className={`gestao-kpi ${tom || ''}`}>
          <span className="rotulo">{t}</span>
          <strong className="num">{v}</strong>
        </div>
      ))}
    </div>
  )
}

// Filtro de período pela data da venda: qualquer dia de início e fim
function BarraPeriodo({ periodo, onChange }) {
  const rapidos = [['tudo', 'Tudo'], ['mes', 'Este mês'], ['passado', 'Mês passado'], ['30', 'Últimos 30 dias'], ['ano', 'Este ano']]
  const igual = (t) => {
    const p = periodoRapido(t)
    return p.de === (periodo.de || '') && p.ate === (periodo.ate || '')
  }
  return (
    <div className="gestao-periodo" role="group" aria-label="Período da venda">
      <span className="rotulo">Data da venda</span>
      <div className="gestao-periodo-rapidos">
        {rapidos.map(([k, t]) => (
          <button key={k} type="button" className={`chip-escolha ${igual(k) ? 'ativo' : ''}`} aria-pressed={igual(k)} onClick={() => onChange(periodoRapido(k))}>{t}</button>
        ))}
      </div>
      <div className="gestao-periodo-datas">
        <label><span>De</span><input type="date" value={periodo.de || ''} max={periodo.ate || undefined} onChange={(e) => onChange({ ...periodo, de: e.target.value })} /></label>
        <label><span>Até</span><input type="date" value={periodo.ate || ''} min={periodo.de || undefined} onChange={(e) => onChange({ ...periodo, ate: e.target.value })} /></label>
      </div>
    </div>
  )
}

function textoPeriodo(p) {
  if (p.de && p.ate) return `${dataBR(p.de)} a ${dataBR(p.ate)}`
  if (p.de) return `desde ${dataBR(p.de)}`
  if (p.ate) return `até ${dataBR(p.ate)}`
  return 'todo o período'
}

// ============================================================ Resultados (resumo e ranking, como a planilha de feedback)
function Resultados({ linhas, periodo, barraPeriodo, verTodos, perfil, onAbrirPasta, onVerPastas }) {
  const [gerando, setGerando] = useState('')
  const [erro, setErro] = useState('')
  const vendas = useMemo(() => linhas.map((l) => paraVenda(l.g)), [linhas])
  const resumo = resumoVendas(vendas)
  const porVendedor = ranking(vendas, 'vendedor')
  const porCaptacao = ranking(vendas, 'captacao')
  const porFinanceira = ranking(vendas.map((v) => ({ ...v, fin: financeira(v.financeira)?.nome })), 'fin')
  const titulo = textoPeriodo(periodo)
  const nomeBase = nomeArquivo(`vendas-${periodo.de || 'inicio'}-${periodo.ate || 'hoje'}`)

  async function planilha() {
    setErro('')
    setGerando('planilha')
    try {
      const { gerarPlanilhaVendas } = await import('../lib/planilhas.js')
      const aba = periodo.de && periodo.ate ? `${dataBR(periodo.de).slice(0, 5)} a ${dataBR(periodo.ate).slice(0, 5)}` : 'VENDAS'
      baixarArquivo(await gerarPlanilhaVendas(vendas, { titulo, aba }), `${nomeBase}.xlsx`)
    } catch (e) {
      setErro('Não foi possível gerar a planilha: ' + e.message)
    } finally {
      setGerando('')
    }
  }
  async function pdf() {
    setErro('')
    setGerando('pdf')
    try {
      const { gerarPdfVendas } = await import('./relatorio/PdfRelatorios.jsx')
      const t = titulo.charAt(0).toUpperCase() + titulo.slice(1)
      baixarArquivo(await gerarPdfVendas({ vendas, titulo: t, resumo, porVendedor, porCaptacao }), `${nomeBase}.pdf`)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível gerar o PDF: ' + e.message)
    } finally {
      setGerando('')
    }
  }

  const cards = [
    ['resolvido', 'Resolvidos', resumo.resolvido],
    ['pendente', 'Pendentes', resumo.pendente],
    ['cancelado', 'Cancelados', resumo.cancelado],
    ['validas', 'Total (sem cancelados)', resumo.validas],
  ]
  return (
    <section className="gestao">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Gestão de clientes{verTodos ? '' : ` · resultados de ${perfil?.nome || 'você'}`}</span>
          <h1 className="titulo-grande">Resultados</h1>
          <p className="dica">Resumo e ranking de {titulo}, pelo valor deflacionado.</p>
        </div>
        <div className="acoes">
          <button className="btn btn-contorno" onClick={planilha} disabled={!!gerando || !vendas.length}>{gerando === 'planilha' ? 'Gerando…' : 'Baixar planilha'}</button>
          <button className="btn btn-contorno" onClick={pdf} disabled={!!gerando || !vendas.length}>{gerando === 'pdf' ? 'Gerando…' : 'Relatório em PDF'}</button>
        </div>
      </div>
      {barraPeriodo}
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="gestao-cards">
        {cards.map(([k, t, r]) => (
          <div key={k} className={`gestao-card gestao-card-${k}`}>
            <span className="rotulo">{t}</span>
            <strong className="num">{moeda(r.valor)}</strong>
            <span className="celula-sub num">{r.qtd} {r.qtd === 1 ? 'venda' : 'vendas'} · deflacionado</span>
          </div>
        ))}
      </div>
      {vendas.length ? (
        <div className="gestao-rankings">
          {[verTodos && ['Ranking por vendedor', porVendedor], ['Ranking por captação', porCaptacao], ['Por financeira', porFinanceira]].filter(Boolean).map(([t, itens]) => (
            <Ranking key={t} titulo={t} itens={itens} />
          ))}
        </div>
      ) : <p className="vazio">Nenhuma venda em {titulo}.</p>}
      {linhas.length > 0 && <PastasDoPeriodo linhas={linhas} onAbrirPasta={onAbrirPasta} onVerPastas={onVerPastas} />}
    </section>
  )
}

// Ligação com o Controle de pastas: cada venda do período e como está a pasta dela
function PastasDoPeriodo({ linhas, onAbrirPasta, onVerPastas }) {
  const ativas = linhas.filter((l) => !l.cancelado)
  const feitos = (l) => DOCS_PASTA.filter((d) => (l.g.pasta || []).some((x) => x.categoria === d.id)).length
  const fechadas = ativas.filter((l) => l.pasta_fechada).length
  const completas = ativas.filter((l) => !l.pasta_fechada && feitos(l) === DOCS_PASTA.length).length
  return (
    <div className="resultados-pastas">
      <div className="cab-linha">
        <div>
          <h2 className="rotulo">Vendas do período e pastas</h2>
          <p className="dica">{fechadas} de {ativas.length} vendas fechadas{completas ? ` · ${completas} com a pasta completa, prontas para fechar` : ''}.</p>
        </div>
        {onVerPastas && <button className="btn btn-leve" onClick={onVerPastas}>Ir para o Controle de pastas →</button>}
      </div>
      <div className="tabela-wrap">
        <table className="tabela tabela-pastas">
          <thead>
            <tr><th>Cód.</th><th>Cliente</th><th>Vendedor</th><th>Data</th><th>Deflacionado</th><th>Situação</th><th>Pasta</th><th></th></tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const n = feitos(l)
              return (
                <tr key={l.id}>
                  <td className="num"><strong>{l.codigo}</strong></td>
                  <td>{l.cliente_nome}</td>
                  <td>{l.vendedor || '—'}</td>
                  <td className="num">{dataBR(l.data_venda)}</td>
                  <td className="num">{moeda(l.valor_deflacionado)}</td>
                  <td><span className={`chip chip-mini ${CHIP_SIT[l.situacao]}`}>{SITUACOES.find(([k]) => k === l.situacao)?.[1]}</span></td>
                  <td>
                    {l.cancelado ? <span className="celula-sub">—</span> : (
                      <span className="pasta-mini">
                        <span className="pasta-progresso" aria-hidden="true">
                          {DOCS_PASTA.map((d) => <span key={d.id} className={(l.g.pasta || []).some((x) => x.categoria === d.id) ? 'ok' : ''} />)}
                        </span>
                        {l.pasta_fechada ? <span className="chip chip-mini chip-sit-ok">Fechada</span> : <span className="celula-sub num">{n}/{DOCS_PASTA.length}</span>}
                      </span>
                    )}
                  </td>
                  <td>{!l.cancelado && <button className="btn btn-leve" onClick={() => onAbrirPasta(l)}>Abrir pasta</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Ranking({ titulo, itens }) {
  const max = Math.max(1, ...itens.map((x) => x.valor))
  return (
    <div className="gestao-ranking">
      <h2 className="rotulo">{titulo}</h2>
      <ol>
        {itens.map((x, i) => (
          <li key={x.nome}>
            <span className="gestao-ranking-pos num">{i + 1}</span>
            <span className="gestao-ranking-nome">{x.nome}<small className="num">{x.qtd} {x.qtd === 1 ? 'venda' : 'vendas'}</small></span>
            <span className="gestao-ranking-barra"><span style={{ width: `${(x.valor / max) * 100}%` }} /></span>
            <span className="gestao-ranking-valor num">{moeda(x.valor)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ============================================================ Ficha do cliente (cadastro único)
function Segmentado({ id, rotulo, valor, opcoes, onChange, largo }) {
  return (
    <div className={`campo ${largo ? 'campo-largo' : ''}`}>
      <span className="rotulo-campo" id={id}>{rotulo}</span>
      <div className="segmentado" role="radiogroup" aria-labelledby={id}>
        {opcoes.map(([v, t]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={valor === v} className={valor === v ? 'ativo' : ''}
            onClick={() => onChange(v)}>{t}</button>
        ))}
      </div>
    </div>
  )
}

function Dinheiro({ id, rotulo, valor, onChange, ajuda }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <div className="campo-prefixo">
        <span aria-hidden="true">R$</span>
        <input id={id} type="number" inputMode="decimal" step="0.01" min="0" value={valor ?? ''} onChange={(e) => onChange(e.target.value)} />
      </div>
      {ajuda && <span className="ajuda">{ajuda}</span>}
    </div>
  )
}

function Texto({ id, rotulo, valor, onChange, obrigatorio, ...resto }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}{obrigatorio && <span className="obrigatorio" aria-hidden="true"> *</span>}</label>
      <input id={id} value={valor ?? ''} required={obrigatorio} onChange={(e) => onChange(e.target.value)} {...resto} />
    </div>
  )
}

const SIM_NAO = [[null, '—'], [true, 'Sim'], [false, 'Não']]

function FichaCliente({ g: inicial, perfil, lista, onFechar, onAbrirPasta, onAbrirProcesso }) {
  const [g, setG] = useState(inicial)
  const ehVendedor = !temPermissao(perfil, 'ver_todos')
  const podeExcluir = temPermissao(perfil, 'excluir')
  const [p, setP] = useState(() => {
    const { comercial, controle, pasta, assinaturas, documentos, ...x } = g || {}
    return g
      ? { ...x, cliente_cpf: formatarCpf(x.cliente_cpf || '') }
      : { codigo: proximoCodigo(lista), cliente_nome: '', data_venda: new Date().toISOString().slice(0, 10), tipo_prazo: 'normal',
        solucao_financeira: 'pendente', vendedor_id: ehVendedor ? perfil.id : null }
  })
  const [c, setC] = useState(() => ({ situacao: 'pendente', meios: [], cliente_meu: true, ...(g?.comercial || {}),
    ...(!g && ehVendedor ? { vendedor_nome: perfil.nome } : {}) }))
  const [ci, setCi] = useState(() => ({ ...(g?.controle || {}) }))
  const [vendedores, setVendedores] = useState([])
  const [salvando, setSalvando] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [excluir, setExcluir] = useState(false)
  const [acesso, setAcesso] = useState(false)
  const [futura, setFutura] = useState(g ? g.tipo_prazo === 'futuro' : false)

  useEffect(() => {
    if (!ehVendedor) api.listarVendedores().then(setVendedores).catch(() => {})
  }, [])

  const sp = (k) => (v) => setP((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  const sc = (k) => (v) => setC((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  const si = (k) => (v) => setCi((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  const fin = financeira(c.financeira)
  const atual = { ...(g || {}), ...p, comercial: c, controle: ci }
  const falta = c.situacao === 'cancelado' ? [] : oQueFalta(atual, g?.pasta || [])

  async function salvar() {
    if (!p.cliente_nome?.trim()) throw new Error('Informe o nome do cliente.')
    if (!p.codigo?.trim()) throw new Error('Informe o código.')
    if (!p.data_venda) throw new Error('Informe a data da venda.')
    if (p.cliente_cpf && !cpfValido(p.cliente_cpf)) throw new Error('O CPF informado não é válido.')
    if (futura && !p.data_disponivel_medicao) throw new Error('Na venda futura, informe quando o imóvel fica pronto.')
    const processo = { ...p, data_disponivel_medicao: futura ? p.data_disponivel_medicao : p.data_venda }
    const salvo = await api.salvarClienteGestao({ processo, comercial: c, controle: ci })
    const { comercial, controle, pasta, assinaturas, documentos, ...x } = salvo
    setG(salvo)
    setP({ ...x, cliente_cpf: formatarCpf(x.cliente_cpf || '') })
    setC(comercial)
    setCi(controle)
    return salvo
  }
  async function acao(tipo, e) {
    e?.preventDefault()
    setErro('')
    setSalvando(tipo)
    try {
      const salvo = await salvar()
      if (tipo === 'capa') {
        const { gerarCapa } = await import('../lib/planilhas.js')
        const v = paraVenda(salvo)
        baixarArquivo(await gerarCapa(v), `capa-${nomeArquivo(`${v.codigo || ''}-${v.cliente_nome}`)}.xlsx`)
        setMsg('Capa gerada')
      } else if (tipo === 'pasta') return onAbrirPasta(salvo)
      else if (tipo === 'processo') return onAbrirProcesso?.(salvo.id)
      else setMsg(g ? 'Cliente salvo' : 'Cliente cadastrado')
      setTimeout(() => setMsg(''), 2500)
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando('')
    }
  }

  const escolherVendedor = (id) => {
    const v = vendedores.find((x) => x.id === id)
    setP((x) => ({ ...x, vendedor_id: v ? v.id : null }))
    if (v) setC((x) => ({ ...x, vendedor_nome: v.nome || v.email }))
  }
  const prazoSugerido = ci.projeto_final_assinado_em ? somarDiasUteis(ci.projeto_final_assinado_em, 46) : null
  const zona = zonaDoCep(p.cep)

  return (
    <section className="gestao ficha-gestao">
      <button className="btn btn-leve voltar" onClick={() => onFechar(false)}>← Voltar à planilha</button>
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">{g ? `Cliente ${p.codigo || ''}` : 'Novo cliente'}</span>
          <h1 className="titulo-grande">{p.cliente_nome || 'Novo cliente'}</h1>
          {g && <span className={`chip chip-mini ${CHIP_STATUS[linhaGestao(atual).status]}`}>{STATUS[linhaGestao(atual).status]}</span>}
        </div>
        {msg && <span className="toast" role="status">{msg}</span>}
      </div>

      {g && falta.length > 0 && (
        <div className="falta-caixa" role="note">
          <strong>O que falta</strong>
          <ul>{falta.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}

      <form className="form" onSubmit={(e) => acao('salvar', e)}>
        <fieldset className="grupo">
          <legend>Cliente e acesso ao portal</legend>
          <p className="dica">É o mesmo cadastro que o cliente usa no portal: ele entra com o e-mail, o CPF ou o celular.</p>
          <div className="grade grade-3">
            <Texto id="g-codigo" rotulo="Código" valor={p.codigo} onChange={sp('codigo')} obrigatorio />
            <Texto id="g-nome" rotulo="Nome do cliente" valor={p.cliente_nome} onChange={sp('cliente_nome')} obrigatorio />
            <Texto id="g-contrato" rotulo="Nº do contrato" valor={p.numero_contrato} onChange={sp('numero_contrato')} />
            <Texto id="g-cpf" rotulo="CPF" valor={p.cliente_cpf} inputMode="numeric" onChange={(v) => setP((x) => ({ ...x, cliente_cpf: formatarCpf(v) }))} />
            <Texto id="g-email" rotulo="E-mail (login do portal)" type="email" valor={p.cliente_email} onChange={sp('cliente_email')} autoComplete="off" />
            <Texto id="g-tel" rotulo="Celular / WhatsApp" type="tel" valor={p.cliente_telefone} onChange={(v) => setP((x) => ({ ...x, cliente_telefone: formatarTelefone(v) }))} />
            <CampoData id="g-nasc" rotulo="Nascimento" valor={p.cliente_nascimento} onChange={sp('cliente_nascimento')} />
            <Texto id="g-end" rotulo="Endereço da obra" valor={p.endereco} onChange={sp('endereco')} />
            <Texto id="g-amb" rotulo="Ambientes" valor={p.ambientes} onChange={sp('ambientes')} placeholder="Cozinha, dormitório…" />
            <Texto id="g-cep" rotulo={`CEP${zona ? ` · ${zona}` : ''}`} valor={p.cep} inputMode="numeric" onChange={sp('cep')} />
            <Texto id="g-bairro" rotulo="Bairro" valor={p.bairro} onChange={sp('bairro')} />
            <Texto id="g-cidade" rotulo="Cidade" valor={p.cidade} onChange={sp('cidade')} />
          </div>
          {g && (
            <div className="acoes">
              {acesso ? null : (
                <button type="button" className="btn btn-contorno" disabled={!p.cliente_email && !g.cliente_email}
                  onClick={() => setAcesso(true)} title={p.cliente_email ? '' : 'Cadastre e salve o e-mail antes'}>Liberar acesso ao portal</button>
              )}
              {!g.cliente_email && <span className="celula-sub">Salve o e-mail do cliente para liberar o acesso.</span>}
            </div>
          )}
          {acesso && g?.cliente_email && <Acesso processo={{ ...g, ...p }} />}
        </fieldset>

        <fieldset className="grupo">
          <legend>Venda</legend>
          <div className="grade grade-3">
            {ehVendedor ? (
              <div className="campo"><span className="rotulo-campo">Vendedor</span><strong>{c.vendedor_nome || perfil.nome}</strong></div>
            ) : (
              <div className="campo">
                <label htmlFor="g-vend">Vendedor</label>
                <select id="g-vend" value={p.vendedor_id || ''} onChange={(e) => escolherVendedor(e.target.value)}>
                  <option value="">{c.vendedor_nome && !p.vendedor_id ? `${c.vendedor_nome} (sem acesso)` : 'Escolha'}</option>
                  {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome || v.email}</option>)}
                </select>
                <span className="ajuda">O vendedor vê só os clientes dele.</span>
              </div>
            )}
            <div className="campo">
              <label htmlFor="g-capt">Captação</label>
              <input id="g-capt" list="g-captacoes" value={c.captacao || ''} onChange={(e) => sc('captacao')(e.target.value.toUpperCase())} />
              <datalist id="g-captacoes">{CAPTACOES.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <CampoData id="g-data" rotulo="Data da venda" valor={p.data_venda} onChange={sp('data_venda')} obrigatorio />
            <Segmentado id="g-loja" rotulo="Loja" valor={c.loja || null} opcoes={LOJAS_VENDA} onChange={sc('loja')} />
            <Segmentado id="g-sit" rotulo="Situação" valor={c.situacao} opcoes={SITUACOES} onChange={sc('situacao')} largo />
            <Segmentado id="g-meu" rotulo="Cliente meu?" valor={c.cliente_meu ?? null} opcoes={SIM_NAO} onChange={sc('cliente_meu')} />
            <Segmentado id="g-prazo" rotulo="Prazo" valor={futura} opcoes={[[false, 'Normal'], [true, 'Futura']]} onChange={setFutura} />
            {futura && <CampoData id="g-pronto" rotulo="Imóvel pronto em" valor={p.data_disponivel_medicao} onChange={sp('data_disponivel_medicao')} ajuda="Acima de 90 dias da venda" />}
            <Segmentado id="g-fin-ok" rotulo="Solução financeira" valor={p.solucao_financeira} opcoes={[['pendente', 'Pendente'], ['ok', 'Resolvida']]} onChange={sp('solucao_financeira')} />
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>Financeiro (uso interno)</legend>
          <div className="grade grade-3">
            <div className="campo">
              <label htmlFor="g-fin">Financeira</label>
              <select id="g-fin" value={c.financeira || ''} onChange={(e) => setC((x) => ({ ...x, financeira: e.target.value, forma_pagamento: '' }))}>
                <option value="">Escolha</option>
                {FINANCEIRAS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="g-forma">Forma / condição</label>
              <select id="g-forma" value={c.forma_pagamento || ''} onChange={sc('forma_pagamento')} disabled={!fin}>
                <option value="">{fin ? 'Escolha' : 'Escolha a financeira antes'}</option>
                {fin?.formas.map((x) => <option key={x}>{x}</option>)}
              </select>
              <span className="ajuda">"1 + 3" = entrada + 3 parcelas</span>
            </div>
            <CampoData id="g-venc" rotulo="Vencimento da 1ª parcela" valor={c.vencimento_primeira} onChange={sc('vencimento_primeira')} />
            <Dinheiro id="g-valor" rotulo="Valor (à vista)" valor={c.valor_venda} onChange={sc('valor_venda')} />
            <Dinheiro id="g-defl" rotulo="Valor deflacionado" valor={c.valor_deflacionado} onChange={sc('valor_deflacionado')}
              ajuda={c.valor_venda && c.valor_deflacionado ? `Diferença ${moeda(c.valor_venda - c.valor_deflacionado)}` : 'Base do resumo e do ranking'} />
            <Dinheiro id="g-entrada" rotulo="Entrada" valor={c.valor_entrada} onChange={sc('valor_entrada')} />
            <Dinheiro id="g-parcela" rotulo="Parcela" valor={c.valor_parcela} onChange={sc('valor_parcela')} />
            <Dinheiro id="g-promob" rotulo="Bruto de Promob" valor={c.bruto_promob} onChange={sc('bruto_promob')} />
          </div>
          <div className="campo">
            <span className="rotulo-campo">Meios de pagamento</span>
            <div className="chips-escolha">
              {MEIOS.map(([k, t]) => {
                const ativo = (c.meios || []).includes(k)
                return (
                  <button key={k} type="button" aria-pressed={ativo} className={`chip-escolha ${ativo ? 'ativo' : ''}`}
                    onClick={() => setC((x) => ({ ...x, meios: ativo ? x.meios.filter((m) => m !== k) : [...(x.meios || []), k] }))}>{t}</button>
                )
              })}
            </div>
          </div>
          <div className="grade grade-3">
            <CampoData id="g-email-env" rotulo="E-mail de formalização" valor={c.envio_email} onChange={sc('envio_email')} />
            <CampoData id="g-assin-ini" rotulo="Assinatura inicial" valor={c.assinatura_inicial} onChange={sc('assinatura_inicial')} />
            <Segmentado id="g-google" rotulo="Avaliação Google" valor={c.avaliacao_google ?? null} opcoes={SIM_NAO} onChange={sc('avaliacao_google')} />
            <Texto id="g-fab" rotulo="Nº do pedido de fábrica" valor={c.pedido_fabrica} onChange={sc('pedido_fabrica')} />
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>Medição, conferência e assinatura</legend>
          <div className="grade grade-3">
            <CampoData id="g-med" rotulo="Data da medição" valor={ci.medido_em} onChange={si('medido_em')} />
            <div className="campo">
              <label htmlFor="g-lib">Liberador</label>
              <input id="g-lib" list="g-liberadores" value={ci.liberador || ''} onChange={si('liberador')} />
              <datalist id="g-liberadores">{LIBERADORES.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <CampoData id="g-conf" rotulo="Data da conferência" valor={ci.conferido_em} onChange={si('conferido_em')} />
            <CampoData id="g-assin" rotulo="Assinatura do projeto final" valor={ci.projeto_final_assinado_em} onChange={si('projeto_final_assinado_em')} />
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>Entrega e montagem</legend>
          <div className="grade grade-3">
            <CampoData id="g-prev" rotulo="Previsão de entrega" valor={ci.previsao_entrega} onChange={si('previsao_entrega')} />
            <CampoData id="g-max" rotulo="Prazo máximo (contrato)" valor={p.data_entrega_prevista} onChange={sp('data_entrega_prevista')}
              ajuda={prazoSugerido && prazoSugerido !== p.data_entrega_prevista ? `Pelo contrato: ${dataBR(prazoSugerido)}` : undefined} />
            <Segmentado id="g-entregue" rotulo="Entregue?" valor={ci.entregue ?? null} opcoes={SIM_NAO} onChange={si('entregue')} />
            <CampoData id="g-dent" rotulo="Data da entrega" valor={ci.entregue_em} onChange={si('entregue_em')} />
            <CampoData id="g-mont" rotulo="Início da montagem" valor={ci.montagem_inicio_em} onChange={si('montagem_inicio_em')} />
            <Texto id="g-montador" rotulo="Montador" valor={ci.montador} onChange={si('montador')} />
            <Segmentado id="g-montou" rotulo="Já montou?" valor={!!p.entrega_concluida} opcoes={[[false, 'Não'], [true, 'Sim, montado']]} onChange={sp('entrega_concluida')} largo />
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>Vistoria e assistência técnica</legend>
          <div className="grade grade-3">
            <CampoData id="g-vist" rotulo="Data da vistoria" valor={ci.vistoria_em} onChange={si('vistoria_em')} />
            <Segmentado id="g-att" rotulo="Assistência?" valor={ci.tem_att ?? null} opcoes={SIM_NAO} onChange={si('tem_att')} />
            <CampoData id="g-posmax" rotulo="Prazo máximo pós vistoria" valor={ci.assistencia_retorno_max} onChange={si('assistencia_retorno_max')} />
            <Segmentado id="g-pos" rotulo="Pós vistoria" valor={ci.pos_vistoria || null} opcoes={[[null, '—'], ...POS_VISTORIA]} onChange={si('pos_vistoria')} largo />
            <CampoData id="g-attfim" rotulo="Assistência concluída" valor={ci.assistencia_concluida_em} onChange={si('assistencia_concluida_em')} />
          </div>
          <div className="campo">
            <label htmlFor="g-vobs">Observação da vistoria</label>
            <textarea id="g-vobs" rows={2} maxLength={2000} value={ci.vistoria_obs || ''} onChange={si('vistoria_obs')} />
          </div>
        </fieldset>

        <div className="campo">
          <label htmlFor="g-obs">Observação</label>
          <textarea id="g-obs" rows={3} maxLength={2000} value={c.observacao || ''} onChange={sc('observacao')}
            placeholder="Ex.: Gerar 12 boletos pela casa, 1º vencimento em 05/11" />
        </div>

        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes acoes-venda">
          <button className="btn btn-principal" disabled={!!salvando}>{salvando === 'salvar' ? 'Salvando…' : g ? 'Salvar' : 'Cadastrar cliente'}</button>
          <button type="button" className="btn btn-contorno" disabled={!!salvando} onClick={() => acao('capa')}>{salvando === 'capa' ? 'Gerando capa…' : 'Fazer capa'}</button>
          <button type="button" className="btn btn-contorno" disabled={!!salvando} onClick={() => acao('pasta')}>Controle de pastas</button>
          {onAbrirProcesso && <button type="button" className="btn btn-leve" disabled={!!salvando} onClick={() => acao('processo')}>Processo, anexos e renders →</button>}
          {g && podeExcluir && <button type="button" className="btn btn-perigo-leve" onClick={() => setExcluir(true)}>Excluir cliente</button>}
        </div>
        <p className="dica">"Fazer capa" salva e baixa a capa do envelope (frente e verso) já preenchida.</p>
      </form>
      {excluir && (
        <ConfirmarExclusao nome={g.cliente_nome} codigo={g.codigo} onCancelar={() => setExcluir(false)}
          onConfirmar={async () => { await api.excluirProcesso(g.id); onFechar() }} />
      )}
    </section>
  )
}

// ============================================================ Importar a planilha de gestão
function Importar({ onFechar }) {
  const [registros, setRegistros] = useState(null)
  const [estado, setEstado] = useState('')
  const [erro, setErro] = useState('')
  const [fim, setFim] = useState(null)

  async function ler(arquivo) {
    setErro('')
    setRegistros(null)
    try {
      const { lerPlanilha, dataDoExcel } = await import('../lib/xlsx.js')
      const { aba, linhas } = await lerPlanilha(arquivo, 'CLIENTES')
      const r = registrosDaPlanilha(linhas, { dataDoExcel, financeiraPorNome, somarDias })
      if (!r.length) throw new Error(`Nenhum cliente encontrado na aba ${aba}.`)
      setRegistros(r)
    } catch (e) {
      setErro(e.message)
    }
  }
  async function importar() {
    setErro('')
    try {
      setFim(await api.importarGestao(registros, (n, t) => setEstado(`${n} de ${t}`)))
    } catch (e) {
      setErro(e.message)
    } finally {
      setEstado('')
    }
  }
  const contar = (f) => registros.filter(f).length
  return (
    <div className="modal" role="presentation">
      <div className="confirmar-exclusao importar" role="dialog" aria-modal="true" aria-labelledby="imp-t">
        <span className="rotulo">Gestão de clientes</span>
        <h2 id="imp-t">Importar a planilha de gestão</h2>
        {fim ? (
          <>
            <p><strong>{fim.importados}</strong> clientes importados.{fim.pulados ? ` ${fim.pulados} já existiam (mesmo código) e ficaram como estavam.` : ''}</p>
            <p className="dica">Abra cada cliente para escolher o vendedor e cadastrar o e-mail de acesso ao portal.</p>
            <div className="acoes"><button className="btn btn-principal" onClick={() => onFechar(true)}>Ver clientes</button></div>
          </>
        ) : (
          <>
            <p>Envie o arquivo <strong>001 GESTÃO DE CLIENTES.xlsx</strong>. Lemos a aba <em>01 CLIENTES</em> (cabeçalho na linha 5). Clientes com um código que já existe não são alterados.</p>
            <label className="btn btn-contorno">
              Escolher arquivo
              <input type="file" accept=".xlsx" hidden onChange={(e) => { if (e.target.files[0]) ler(e.target.files[0]); e.target.value = '' }} />
            </label>
            {registros && (
              <ul className="importar-resumo">
                <li><strong className="num">{registros.length}</strong> clientes na planilha</li>
                <li><strong className="num">{contar((r) => r.processo.entrega_concluida)}</strong> montados</li>
                <li><strong className="num">{contar((r) => !r.processo.entrega_concluida && (r.controle.projeto_final_assinado_em || r.processo.projeto_assinado_manual))}</strong> assinados aguardando montagem</li>
                <li><strong className="num">{contar((r) => !r.processo.medicao_concluida && !r.processo.entrega_concluida)}</strong> aguardando medição</li>
              </ul>
            )}
            {erro && <p className="erro" role="alert">{erro}</p>}
            <div className="acoes">
              <button className="btn btn-leve" onClick={() => onFechar(false)} disabled={!!estado}>Cancelar</button>
              <button className="btn btn-principal" disabled={!registros || !!estado} onClick={importar}>{estado ? `Importando… ${estado}` : 'Importar'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================ Controle de pastas
function ListaPastas({ linhas, periodo, barraPeriodo, onAbrir, onVerResultados }) {
  const ativas = linhas.filter((l) => !l.cancelado)
  return (
    <section className="gestao">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Gestão de clientes</span>
          <h1 className="titulo-grande">Controle de pastas</h1>
          <p className="dica">Anexe os documentos de cada cliente. Em "Fechar venda", tudo vira um único PDF para baixar e imprimir.</p>
        </div>
        {onVerResultados && <button className="btn btn-leve" onClick={onVerResultados}>Ver resultados de {textoPeriodo(periodo)} →</button>}
      </div>
      {barraPeriodo}
      {!ativas.length ? <p className="vazio">Nenhum cliente neste período.</p> : (
        <ul className="pastas-lista">
          {ativas.map((l) => {
            const docs = l.g.pasta || []
            const feitos = DOCS_PASTA.filter((d) => docs.some((x) => x.categoria === d.id)).length
            return (
              <li key={l.id}>
                <button type="button" className="pasta-cartao" onClick={() => onAbrir(l)}>
                  <span className="pasta-cartao-topo">
                    <strong>{l.cliente_nome}</strong>
                    {l.pasta_fechada
                      ? <span className="chip chip-mini chip-sit-ok">Venda fechada</span>
                      : <span className="chip chip-mini chip-sit-andamento">Pasta aberta</span>}
                  </span>
                  <span className="celula-sub num">{l.codigo || 'Sem código'} · {l.vendedor || '—'} · {dataBR(l.data_venda)}</span>
                  <span className="pasta-progresso" aria-label={`${feitos} de ${DOCS_PASTA.length} documentos`}>
                    {DOCS_PASTA.map((d) => <span key={d.id} className={docs.some((x) => x.categoria === d.id) ? 'ok' : ''} title={d.nome} />)}
                  </span>
                  <span className="celula-sub num">{feitos} de {DOCS_PASTA.length} documentos</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function PastaCliente({ g, onFechar, onFicha }) {
  const [docs, setDocs] = useState(null)
  const [enviando, setEnviando] = useState('')
  const [erro, setErro] = useState('')
  const [fechando, setFechando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [fechadaEm, setFechadaEm] = useState(g.comercial?.pasta_fechada_em)

  const carregar = () => api.documentosPasta(g.id).then(setDocs).catch((e) => setErro(e.message))
  useEffect(() => {
    carregar()
  }, [g.id])

  async function enviar(categoria, arquivos) {
    setErro('')
    setEnviando(categoria)
    try {
      for (const a of arquivos) await api.enviarDocumentoPasta(g.id, categoria, a)
      await carregar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando('')
    }
  }

  async function fechar() {
    setErro('')
    setFechando(true)
    try {
      const { gerarPdfPasta } = await import('../lib/pastaPdf.js')
      const blob = await gerarPdfPasta(paraVenda(g), docs, (d) => api.arquivoDocumentoPasta(d), (d) => api.urlDocumentoPasta(d))
      baixarArquivo(blob, `pasta-${nomeArquivo(`${g.codigo || ''}-${g.cliente_nome}`)}.pdf`)
      await api.fecharPasta(g.id)
      setFechadaEm(new Date().toISOString())
      setConfirmar(false)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível montar o PDF: ' + e.message)
    } finally {
      setFechando(false)
    }
  }

  if (!docs) return <div className="carregando">Carregando…</div>
  const faltando = DOCS_PASTA.filter((d) => !docs.some((x) => x.categoria === d.id))

  return (
    <section className="gestao">
      <button className="btn btn-leve voltar" onClick={onFechar}>← Voltar</button>
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Pasta {g.codigo || ''}</span>
          <h1 className="titulo-grande">{g.cliente_nome}</h1>
        </div>
        <button className="btn btn-leve" onClick={() => onFicha(g)}>Ver ficha do cliente</button>
      </div>
      {fechadaEm && <p className="dica">Venda fechada em {new Date(fechadaEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. Você pode anexar mais documentos e fechar de novo.</p>}

      <div className="pasta-docs">
        {DOCS_PASTA.map((cat) => {
          const lista = docs.filter((d) => d.categoria === cat.id)
          return (
            <div key={cat.id} className={`pasta-doc ${lista.length ? 'pasta-doc-ok' : ''}`}>
              <div className="pasta-doc-cab">
                <span className="pasta-doc-marca" aria-hidden="true">{lista.length ? '✓' : ''}</span>
                <strong>{cat.nome}</strong>
                <label className="btn btn-contorno pasta-doc-enviar">
                  {enviando === cat.id ? 'Enviando…' : lista.length && !cat.varios ? 'Trocar / adicionar' : 'Anexar'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,image/*" multiple={!!cat.varios} hidden disabled={!!enviando}
                    onChange={(e) => { enviar(cat.id, [...e.target.files]); e.target.value = '' }} />
                </label>
              </div>
              {lista.length > 0 && (
                <ul className="pasta-doc-lista">
                  {lista.map((d) => <ArquivoPasta key={d.id} doc={d} onRemover={async () => { await api.excluirDocumentoPasta(d); carregar() }} />)}
                </ul>
              )}
            </div>
          )
        })}
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="pasta-fechar">
        <div>
          <strong>Fechar venda</strong>
          <span>Junta todos os documentos desta pasta em um único PDF, com uma página de resumo na frente, para baixar e imprimir.</span>
        </div>
        {confirmar ? (
          <span className="confirmar">
            <span className="texto-atraso">Faltam: {faltando.map((d) => d.nome).join(', ')}.</span>
            <button className="btn btn-principal" onClick={fechar} disabled={fechando}>{fechando ? 'Montando…' : 'Fechar mesmo assim'}</button>
            <button className="btn btn-leve" onClick={() => setConfirmar(false)}>Cancelar</button>
          </span>
        ) : (
          <button className="btn btn-principal" disabled={fechando || !docs.length}
            onClick={() => (faltando.length ? setConfirmar(true) : fechar())}>{fechando ? 'Montando o PDF…' : 'Fechar venda'}</button>
        )}
      </div>
    </section>
  )
}

function ArquivoPasta({ doc, onRemover }) {
  const [url, setUrl] = useState(null)
  const [remover, setRemover] = useState(false)
  useEffect(() => {
    api.urlDocumentoPasta(doc).then(setUrl).catch(() => {})
  }, [doc.id])
  return (
    <li className="pasta-arquivo">
      <span className="doc-tipo">{doc.tipo_mime?.includes('pdf') ? 'PDF' : 'IMG'}</span>
      <span className="pasta-arquivo-nome">{doc.titulo}</span>
      <a className="btn btn-leve" href={url || '#'} target="_blank" rel="noreferrer">Abrir</a>
      {remover ? (
        <span className="confirmar">
          <button className="btn btn-perigo" onClick={onRemover}>Remover</button>
          <button className="btn btn-leve" onClick={() => setRemover(false)}>Cancelar</button>
        </span>
      ) : <button className="btn btn-perigo-leve" onClick={() => setRemover(true)}>Remover</button>}
    </li>
  )
}
