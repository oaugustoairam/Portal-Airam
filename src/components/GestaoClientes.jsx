import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import {
  FINANCEIRAS, financeira, MEIOS, CAPTACOES, VENDEDORES, LOJAS_VENDA, SITUACOES, DOCS_PASTA, VENDA_VAZIA,
  mesAtual, somarMes, nomeMes, moeda, oQueFalta, resumoVendas, ranking,
} from '../lib/vendas.js'
import { baixarArquivo, nomeArquivo } from '../lib/relatorio.js'
import CampoData from './CampoData.jsx'

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const dataCurta = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—')
const CHIP_SIT = { pendente: 'chip-sit-andamento', resolvido: 'chip-sit-ok', cancelado: 'chip-sit-atraso' }

// Gestão de clientes (só vendedores e gerência): controle mensal e controle de pastas
export default function GestaoClientes({ aba, perfil }) {
  const [mes, setMes] = useState(mesAtual)
  const [vendas, setVendas] = useState(null)
  const [editando, setEditando] = useState(null) // venda ou 'nova'
  const [pasta, setPasta] = useState(null) // venda aberta no controle de pastas
  const [erro, setErro] = useState('')

  const carregar = () => api.listarVendas(mes).then(setVendas).catch((e) => setErro(e.message))
  useEffect(() => {
    setVendas(null)
    carregar()
  }, [mes])
  useEffect(() => {
    setEditando(null)
    setPasta(null)
  }, [aba])

  if (editando)
    return (
      <VendaEditor
        venda={editando === 'nova' ? { ...VENDA_VAZIA, mes, vendedor: perfil?.papel === 'vendedor' ? perfil.nome || '' : '' } : editando}
        sugestoesVendedor={[...new Set([...VENDEDORES, ...(vendas || []).map((v) => v.vendedor).filter(Boolean)])]}
        onFechar={() => { setEditando(null); carregar() }}
        onAbrirPasta={(v) => { setEditando(null); setPasta(v) }}
      />
    )
  if (pasta) return <PastaVenda venda={pasta} onFechar={() => { setPasta(null); carregar() }} onEditar={(v) => { setPasta(null); setEditando(v) }} />

  const seletorMes = (
    <div className="seletor-mes" role="group" aria-label="Mês do controle">
      <button type="button" className="btn btn-leve" onClick={() => setMes(somarMes(mes, -1))} aria-label="Mês anterior">‹</button>
      <span className="seletor-mes-nome">{nomeMes(mes)}</span>
      <button type="button" className="btn btn-leve" onClick={() => setMes(somarMes(mes, 1))} aria-label="Próximo mês">›</button>
    </div>
  )

  return (
    <section className="gestao">
      {erro && <p className="erro">{erro}</p>}
      {aba === 'pastas'
        ? <ListaPastas vendas={vendas} seletorMes={seletorMes} onAbrir={setPasta} />
        : <ControleMensal vendas={vendas} mes={mes} seletorMes={seletorMes} onNova={() => setEditando('nova')} onEditar={setEditando}
            onMudou={carregar} />}
    </section>
  )
}

// ============================================================ Controle mensal (como a planilha de feedback)
function ControleMensal({ vendas, mes, seletorMes, onNova, onEditar, onMudou }) {
  const [filtro, setFiltro] = useState({ busca: '', situacao: '', vendedor: '', financeira: '' })
  const [gerando, setGerando] = useState('')
  const [erro, setErro] = useState('')
  const set = (k) => (e) => setFiltro((f) => ({ ...f, [k]: e.target.value }))

  const lista = useMemo(() => {
    if (!vendas) return []
    const termo = semAcento(filtro.busca.trim())
    return vendas.filter((v) => {
      if (filtro.situacao && v.situacao !== filtro.situacao) return false
      if (filtro.vendedor && v.vendedor !== filtro.vendedor) return false
      if (filtro.financeira && v.financeira !== filtro.financeira) return false
      if (termo && !semAcento([v.cliente_nome, v.codigo, v.observacao].join(' ')).includes(termo)) return false
      return true
    })
  }, [vendas, filtro])

  if (!vendas) return <div className="carregando">Carregando…</div>
  const resumo = resumoVendas(vendas)
  const porVendedor = ranking(vendas, 'vendedor')
  const porCaptacao = ranking(vendas, 'captacao')
  const vendedores = [...new Set(vendas.map((v) => v.vendedor).filter(Boolean))].sort()

  async function planilha() {
    setErro('')
    setGerando('planilha')
    try {
      const { gerarPlanilhaMes } = await import('../lib/planilhas.js')
      baixarArquivo(await gerarPlanilhaMes(vendas, mes), `feedback-vendas-${mes}.xlsx`)
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
      baixarArquivo(await gerarPdfVendas({ vendas, mes, resumo, porVendedor, porCaptacao }), `relatorio-vendas-${mes}.pdf`)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível gerar o PDF: ' + e.message)
    } finally {
      setGerando('')
    }
  }
  async function mudarSituacao(v, situacao) {
    await api.salvarVenda({ ...v, situacao })
    onMudou()
  }

  const cards = [
    ['resolvido', 'Resolvidos', resumo.resolvido],
    ['pendente', 'Pendentes', resumo.pendente],
    ['cancelado', 'Cancelados', resumo.cancelado],
    ['validas', 'Total (sem cancelados)', resumo.validas],
  ]
  const maxV = Math.max(1, ...porVendedor.map((x) => x.valor))
  const maxC = Math.max(1, ...porCaptacao.map((x) => x.valor))

  return (
    <>
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Gestão de clientes</span>
          <h1 className="titulo-grande">Controle mensal</h1>
        </div>
        <button className="btn btn-principal" onClick={onNova}>Nova venda</button>
      </div>

      <div className="gestao-barra">
        {seletorMes}
        <div className="acoes">
          <button className="btn btn-contorno" onClick={planilha} disabled={!!gerando || !vendas.length}>{gerando === 'planilha' ? 'Gerando…' : 'Baixar planilha'}</button>
          <button className="btn btn-contorno" onClick={pdf} disabled={!!gerando || !vendas.length}>{gerando === 'pdf' ? 'Gerando…' : 'Relatório em PDF'}</button>
        </div>
      </div>
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

      {vendas.length > 0 && (
        <div className="gestao-rankings">
          {[['Ranking por vendedor', porVendedor, maxV], ['Ranking por captação', porCaptacao, maxC]].map(([titulo, itens, max]) => (
            <div key={titulo} className="gestao-ranking">
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
          ))}
        </div>
      )}

      <div className="painel-filtros">
        <div className="filtros-linha">
          <input type="search" placeholder="Buscar por cliente, código ou observação" value={filtro.busca} onChange={set('busca')} aria-label="Buscar venda" />
        </div>
        <div className="filtros-grade aberto">
          <Filtro rotulo="Situação" valor={filtro.situacao} onChange={set('situacao')} opcoes={[['', 'Todas'], ...SITUACOES]} />
          <Filtro rotulo="Vendedor" valor={filtro.vendedor} onChange={set('vendedor')} opcoes={[['', 'Todos'], ...vendedores.map((v) => [v, v])]} />
          <Filtro rotulo="Financeira" valor={filtro.financeira} onChange={set('financeira')} opcoes={[['', 'Todas'], ...FINANCEIRAS.map((f) => [f.id, f.nome])]} />
        </div>
        <div className="filtros-rodape"><span className="num">Mostrando {lista.length} de {vendas.length} vendas de {nomeMes(mes)}</span></div>
      </div>

      {!vendas.length ? (
        <p className="vazio">Nenhuma venda em {nomeMes(mes)}. Toque em "Nova venda" para começar.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela tabela-vendas">
            <thead>
              <tr>
                <th>Cód.</th><th>Cliente</th><th>Vendedor</th><th>Captação</th><th>Data</th><th>Financeira</th>
                <th>Valor</th><th>Deflacionado</th><th>Situação</th><th>O que falta</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => {
                const falta = oQueFalta(v, v.venda_documentos || [])
                return (
                  <tr key={v.id} onClick={() => onEditar(v)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onEditar(v)}>
                    <td className="num"><strong>{v.codigo || '—'}</strong></td>
                    <td>{v.cliente_nome}{v.observacao && <span className="celula-sub">{v.observacao}</span>}</td>
                    <td>{v.vendedor || '—'}</td>
                    <td>{v.captacao || '—'}</td>
                    <td className="num">{dataCurta(v.data_venda)}</td>
                    <td>{financeira(v.financeira)?.nome || '—'}{v.forma_pagamento && <span className="celula-sub">{v.forma_pagamento}</span>}</td>
                    <td className="num">{moeda(v.valor_venda)}</td>
                    <td className="num">{moeda(v.valor_deflacionado)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select className={`select-situacao ${CHIP_SIT[v.situacao]}`} value={v.situacao} aria-label={`Situação de ${v.cliente_nome}`}
                        onChange={(e) => mudarSituacao(v, e.target.value)}>
                        {SITUACOES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                      </select>
                    </td>
                    <td>
                      {v.situacao === 'cancelado' ? <span className="celula-sub">—</span>
                        : falta.length ? <span className="falta" title={falta.join(', ')}><strong className="num">{falta.length}</strong> {falta.length === 1 ? 'item' : 'itens'}<span className="celula-sub">{falta.slice(0, 2).join(', ')}{falta.length > 2 ? '…' : ''}</span></span>
                        : <span className="chip chip-mini chip-sit-ok">Completo</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Filtro({ rotulo, valor, onChange, opcoes }) {
  const id = `fv-${rotulo}`
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <select id={id} value={valor} onChange={onChange} className={valor ? 'filtro-ativo' : ''}>
        {opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </div>
  )
}

// ============================================================ Ficha da venda (preenche a capa do envelope)
function Segmentado({ id, rotulo, valor, opcoes, onChange }) {
  return (
    <div className="campo">
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

function VendaEditor({ venda, sugestoesVendedor, onFechar, onAbrirPasta }) {
  const [f, setF] = useState(() => ({ ...VENDA_VAZIA, ...venda, meios: venda.meios || [] }))
  const [salvando, setSalvando] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [excluir, setExcluir] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  const fin = financeira(f.financeira)
  const falta = oQueFalta(f, f.venda_documentos || null)

  async function salvar() {
    setErro('')
    const salvo = await api.salvarVenda(f)
    setF((x) => ({ ...x, ...salvo }))
    return salvo
  }
  async function acao(tipo, e) {
    e?.preventDefault()
    setSalvando(tipo)
    try {
      const v = await salvar()
      if (tipo === 'capa') {
        const { gerarCapa } = await import('../lib/planilhas.js')
        baixarArquivo(await gerarCapa(v), `capa-${nomeArquivo(`${v.codigo || ''}-${v.cliente_nome}`)}.xlsx`)
        setMsg('Capa gerada')
      } else if (tipo === 'pasta') {
        onAbrirPasta(v)
        return
      } else setMsg('Venda salva')
      setTimeout(() => setMsg(''), 2500)
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando('')
    }
  }

  return (
    <section className="gestao">
      <button className="btn btn-leve voltar" onClick={onFechar}>← Controle mensal</button>
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">{f.id ? `Venda ${f.codigo || ''}` : 'Nova venda'}</span>
          <h1 className="titulo-grande">{f.cliente_nome || 'Nova venda'}</h1>
        </div>
        {msg && <span className="toast" role="status">{msg}</span>}
      </div>

      {f.situacao !== 'cancelado' && falta.length > 0 && (
        <div className="falta-caixa" role="note">
          <strong>O que falta</strong>
          <ul>{falta.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}

      <form className="form" onSubmit={(e) => acao('salvar', e)}>
        <fieldset className="grupo">
          <legend>Dados do pedido</legend>
          <div className="grade grade-3">
            <div className="campo">
              <label htmlFor="v-cliente">Cliente <span className="obrigatorio" aria-hidden="true">*</span></label>
              <input id="v-cliente" required value={f.cliente_nome} onChange={set('cliente_nome')} />
            </div>
            <div className="campo">
              <label htmlFor="v-codigo">Código / pedido</label>
              <input id="v-codigo" value={f.codigo || ''} onChange={set('codigo')} placeholder="100002073" />
            </div>
            <CampoData id="v-data" rotulo="Data da venda" valor={f.data_venda} onChange={(v) => setF((x) => ({ ...x, data_venda: v, mes: x.id ? x.mes : (v || '').slice(0, 7) || x.mes }))} />
            <div className="campo">
              <label htmlFor="v-mes">Mês do controle</label>
              <input id="v-mes" type="month" value={f.mes || ''} onChange={set('mes')} />
            </div>
            <div className="campo">
              <label htmlFor="v-vendedor">Vendedor</label>
              <input id="v-vendedor" list="lista-vendedores" value={f.vendedor || ''} onChange={set('vendedor')} />
              <datalist id="lista-vendedores">{sugestoesVendedor.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <div className="campo">
              <label htmlFor="v-captacao">Captação</label>
              <input id="v-captacao" list="lista-captacao" value={f.captacao || ''} onChange={set('captacao')} />
              <datalist id="lista-captacao">{CAPTACOES.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
          </div>
          <div className="grade grade-3">
            <Segmentado id="v-loja" rotulo="Loja" valor={f.loja || null} opcoes={LOJAS_VENDA} onChange={set('loja')} />
            <Segmentado id="v-sit" rotulo="Situação" valor={f.situacao} opcoes={SITUACOES} onChange={set('situacao')} />
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>Dados financeiros (uso interno)</legend>
          <div className="grade grade-3">
            <div className="campo">
              <label htmlFor="v-fin">Financeira</label>
              <select id="v-fin" value={f.financeira || ''} onChange={(e) => setF((x) => ({ ...x, financeira: e.target.value, forma_pagamento: '' }))}>
                <option value="">Escolha</option>
                {FINANCEIRAS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="v-forma">Forma / condição de pagamento</label>
              <select id="v-forma" value={f.forma_pagamento || ''} onChange={set('forma_pagamento')} disabled={!fin}>
                <option value="">{fin ? 'Escolha' : 'Escolha a financeira antes'}</option>
                {fin?.formas.map((x) => <option key={x}>{x}</option>)}
              </select>
              <span className="ajuda">"1 + 3" = entrada + 3 parcelas</span>
            </div>
            <CampoData id="v-venc" rotulo="Vencimento da 1ª parcela" valor={f.vencimento_primeira} onChange={set('vencimento_primeira')} />
            <Dinheiro id="v-valor" rotulo="Valor do pedido" valor={f.valor_venda} onChange={set('valor_venda')} />
            <Dinheiro id="v-defl" rotulo="Valor deflacionado" valor={f.valor_deflacionado} onChange={set('valor_deflacionado')} ajuda="Base do resumo e do ranking" />
            <Dinheiro id="v-entrada" rotulo="Valor de entrada" valor={f.valor_entrada} onChange={set('valor_entrada')} />
            <Dinheiro id="v-parcela" rotulo="Valor da parcela" valor={f.valor_parcela} onChange={set('valor_parcela')} />
          </div>
          <div className="campo">
            <span className="rotulo-campo">Meios de pagamento</span>
            <div className="chips-escolha">
              {MEIOS.map(([k, t]) => {
                const ativo = f.meios.includes(k)
                return (
                  <button key={k} type="button" aria-pressed={ativo} className={`chip-escolha ${ativo ? 'ativo' : ''}`}
                    onClick={() => setF((x) => ({ ...x, meios: ativo ? x.meios.filter((m) => m !== k) : [...x.meios, k] }))}>{t}</button>
                )
              })}
            </div>
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>Informações da loja</legend>
          <div className="grade grade-3">
            <Segmentado id="v-prazo" rotulo="Prazo" valor={f.prazo_tipo} opcoes={[['45_dias', 'Prazo de 45 dias'], ['futura', 'Venda futura']]} onChange={set('prazo_tipo')} />
            {f.prazo_tipo === 'futura' && <CampoData id="v-prev" rotulo="Previsão do imóvel" valor={f.previsao_imovel} onChange={set('previsao_imovel')} />}
            <CampoData id="v-email" rotulo="Envio de e-mail" valor={f.envio_email} onChange={set('envio_email')} />
            <CampoData id="v-assin" rotulo="Assinatura inicial" valor={f.assinatura_inicial} onChange={set('assinatura_inicial')} />
            <Segmentado id="v-google" rotulo="Avaliação Google" valor={f.avaliacao_google} opcoes={[[null, 'A definir'], [true, 'Sim'], [false, 'Não']]} onChange={set('avaliacao_google')} />
            <Dinheiro id="v-promob" rotulo="Bruto de Promob" valor={f.bruto_promob} onChange={set('bruto_promob')} />
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>Controle do escritório</legend>
          <div className="grade grade-3">
            <div className="campo">
              <label htmlFor="v-fab">Nº do pedido de fábrica</label>
              <input id="v-fab" value={f.pedido_fabrica || ''} onChange={set('pedido_fabrica')} />
            </div>
            <CampoData id="v-apf" rotulo="Assinatura do projeto final" valor={f.assinatura_projeto_final} onChange={set('assinatura_projeto_final')} />
            <CampoData id="v-limite" rotulo="Prazo limite de entrega" valor={f.prazo_limite_entrega} onChange={set('prazo_limite_entrega')} />
            <CampoData id="v-medicao" rotulo="Medição realizada" valor={f.medicao_realizada} onChange={set('medicao_realizada')} />
            <CampoData id="v-lpf" rotulo="Limite de prazo do projeto final" valor={f.limite_projeto_final} onChange={set('limite_projeto_final')} />
          </div>
        </fieldset>

        <div className="campo">
          <label htmlFor="v-obs">Observação</label>
          <textarea id="v-obs" rows={3} maxLength={2000} value={f.observacao || ''} onChange={set('observacao')}
            placeholder="Ex.: Gerar 12 boletos pela casa, 1º vencimento em 05/11" />
        </div>

        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes acoes-venda">
          <button className="btn btn-principal" disabled={!!salvando}>{salvando === 'salvar' ? 'Salvando…' : 'Salvar'}</button>
          <button type="button" className="btn btn-contorno" disabled={!!salvando} onClick={() => acao('capa')}>
            {salvando === 'capa' ? 'Gerando capa…' : 'Fazer capa'}
          </button>
          <button type="button" className="btn btn-contorno" disabled={!!salvando} onClick={() => acao('pasta')}>Controle de pastas →</button>
          {f.id && (excluir ? (
            <span className="confirmar">
              <button type="button" className="btn btn-perigo" onClick={async () => { await api.excluirVenda(f.id); onFechar() }}>Excluir venda e anexos</button>
              <button type="button" className="btn btn-leve" onClick={() => setExcluir(false)}>Cancelar</button>
            </span>
          ) : <button type="button" className="btn btn-perigo-leve" onClick={() => setExcluir(true)}>Excluir</button>)}
        </div>
        <p className="dica">"Fazer capa" salva a venda e baixa a planilha da capa do envelope (frente e verso) já preenchida.</p>
      </form>
    </section>
  )
}

// ============================================================ Controle de pastas
function ListaPastas({ vendas, seletorMes, onAbrir }) {
  if (!vendas) return <div className="carregando">Carregando…</div>
  const ativas = vendas.filter((v) => v.situacao !== 'cancelado')
  return (
    <>
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Gestão de clientes</span>
          <h1 className="titulo-grande">Controle de pastas</h1>
        </div>
      </div>
      <p className="dica">Anexe os documentos de cada cliente. Em "Fechar venda", tudo vira um único PDF para baixar e imprimir.</p>
      <div className="gestao-barra">{seletorMes}</div>
      {!ativas.length ? <p className="vazio">Nenhuma venda neste mês.</p> : (
        <ul className="pastas-lista">
          {ativas.map((v) => {
            const docs = v.venda_documentos || []
            const feitos = DOCS_PASTA.filter((d) => docs.some((x) => x.categoria === d.id)).length
            return (
              <li key={v.id}>
                <button type="button" className="pasta-cartao" onClick={() => onAbrir(v)}>
                  <span className="pasta-cartao-topo">
                    <strong>{v.cliente_nome}</strong>
                    {v.pasta_fechada_em
                      ? <span className="chip chip-mini chip-sit-ok">Venda fechada</span>
                      : <span className="chip chip-mini chip-sit-andamento">Pasta aberta</span>}
                  </span>
                  <span className="celula-sub num">{v.codigo || 'Sem código'} · {v.vendedor || '—'} · {dataCurta(v.data_venda)}</span>
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
    </>
  )
}

function PastaVenda({ venda, onFechar, onEditar }) {
  const [docs, setDocs] = useState(null)
  const [enviando, setEnviando] = useState('')
  const [erro, setErro] = useState('')
  const [fechando, setFechando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [fechadaEm, setFechadaEm] = useState(venda.pasta_fechada_em)

  const carregar = () => api.documentosVenda(venda.id).then(setDocs)
  useEffect(() => {
    carregar()
  }, [venda.id])

  async function enviar(categoria, arquivos) {
    setErro('')
    setEnviando(categoria)
    try {
      for (const a of arquivos) await api.enviarDocumentoVenda(venda.id, categoria, a)
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
      const blob = await gerarPdfPasta(venda, docs, (d) => api.arquivoDocumentoVenda(d), (d) => api.urlDocumentoVenda(d))
      baixarArquivo(blob, `pasta-${nomeArquivo(`${venda.codigo || ''}-${venda.cliente_nome}`)}.pdf`)
      await api.fecharPasta(venda.id)
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
          <span className="rotulo">Pasta {venda.codigo || ''}</span>
          <h1 className="titulo-grande">{venda.cliente_nome}</h1>
        </div>
        <button className="btn btn-leve" onClick={() => onEditar(venda)}>Ver ficha da venda</button>
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
                  {lista.map((d) => <ArquivoPasta key={d.id} doc={d} onRemover={async () => { await api.excluirDocumentoVenda(d); carregar() }} />)}
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
    api.urlDocumentoVenda(doc).then(setUrl).catch(() => {})
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
