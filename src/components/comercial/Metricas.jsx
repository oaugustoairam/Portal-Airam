import { useMemo, useState } from 'react'
import { calcularMetricas, pct, numero, rotuloMes } from '../../lib/metricas.js'
import { ATALHOS_PERIODO, periodo, dinheiro, dataBR, nomeCurto } from '../../lib/comercial.js'
import { baixarArquivo } from '../../lib/relatorio.js'
import { useComercial } from './comum.jsx'
import { Grafico, Barras, Linhas, TabelaDados } from './Graficos.jsx'

const FILTRO_VAZIO = () => {
  const [de, ate] = periodo('mes')
  return { de, ate, vendedor: '', origem: '', canal: '' }
}
const conv = (x) => (x == null ? null : Math.round(x * 1000) / 10)

// tabelas do relatório (as mesmas na tela, no PDF e no Excel): valores crus + formato de cada coluna
export function tabelasRelatorio(m) {
  const t = (titulo, colunas, linhas, formatos) => ({ titulo, colunas, linhas, formatos })
  const n = (v) => numero(v, 0)
  const d1 = (v) => numero(v, 1)
  const p = (v) => (v == null ? '—' : `${numero(v, 1)}%`)
  const txt = (v) => v ?? '—'
  return [
    t('Por vendedor', ['Vendedor', 'Leads', 'Agendados', 'Compareceram', 'Vendas', 'Conversão (%)', 'Faturamento (R$)', 'Ticket médio (R$)'],
      m.porVendedor.map((x) => [x.nome, x.leads, x.agendados, x.compareceu, x.vendas, conv(x.conversao), x.faturamento, x.ticket]), [txt, n, n, n, n, p, dinheiro, dinheiro]),
    t('Evolução mensal', ['Mês', 'Leads', 'Vendas', 'Faturamento (R$)'], m.meses.map((x) => [rotuloMes(x.mes), x.leads, x.vendas, x.faturamento]), [txt, n, n, dinheiro]),
    t('Funil', ['Etapa', 'Leads', '% dos leads'], m.funil.map((x) => [x.etapa, x.n, conv(x.taxa)]), [txt, n, p]),
    t('Motivos de perda', ['Motivo', 'Perdas'], m.motivosPerda.map((x) => [x.motivo, x.n]), [txt, n]),
    t('Por origem', ['Origem', 'Leads', 'Vendas', 'Conversão (%)', 'Faturamento (R$)'], m.porOrigem.map((x) => [x.nome, x.leads, x.vendas, conv(x.conversao), x.faturamento]), [txt, n, n, p, dinheiro]),
    t('Tempo médio de fechamento', ['Vendedor', 'Dias (média)', 'Vendas'], m.fechamento.map((x) => [x.nome, x.media, x.n]), [txt, d1, n]),
    t('Tempo do primeiro contato', ['Vendedor', 'Horas (média)', 'Leads contatados'], m.primeiroContato.map((x) => [x.nome, x.media, x.n]), [txt, d1, n]),
    t('Não responde (agora)', ['Vendedor', 'Leads parados', 'Dias parado (média)'], m.naoResponde.porVendedor.map((x) => [x.nome, x.quantidade, x.media]), [txt, n, d1]),
    t('Loja x Online', ['Canal', 'Leads', 'Agendados', 'Vendas', 'Faturamento (R$)'], m.porCanal.map((x) => [x.nome, x.leads, x.agendados, x.vendas, x.faturamento]), [txt, n, n, n, dinheiro]),
    t('Ranking', ['Posição', 'Vendedor', 'Vendas', 'Faturamento (R$)', 'Conversão (%)'],
      m.porVendedor.filter((x) => x.vendas || x.leads).map((x, i) => [`${i + 1}º`, x.nome, x.vendas, x.faturamento, conv(x.conversao)]), [txt, txt, n, dinheiro, p]),
    t('Produção do captador', ['Captador', 'Leads', 'Agendados', 'Compareceram', 'Vendas'], m.porCaptador.map((x) => [x.nome, x.leads, x.agendados, x.compareceu, x.vendas]), [txt, n, n, n, n]),
    t('Lembretes atrasados (agora)', ['Vendedor', 'Atrasados'], m.lembretesAtrasados.map((x) => [x.nome, x.n]), [txt, n]),
  ]
}
const formatada = (tb) => ({ colunas: tb.colunas, linhas: tb.linhas.map((l) => l.map((v, i) => tb.formatos[i](v))) })

export default function Metricas() {
  const { dados, listas, pessoas, lojas, vendedores, acoes, perfil } = useComercial()
  const [rascunho, setRascunho] = useState(FILTRO_VAZIO)
  const [filtro, setFiltro] = useState(rascunho)
  const [atalho, setAtalho] = useState('mes')
  const [gerando, setGerando] = useState('')
  const [erro, setErro] = useState('')
  // vendedor sem "ver todos": filtro travado nele (e o banco só entrega os dados dele)
  const f = acoes.todos ? filtro : { ...filtro, vendedor: perfil.id }
  const m = useMemo(() => calcularMetricas({ ...dados, listas, pessoas, lojas }, f), [dados, listas, pessoas, lojas, f.de, f.ate, f.vendedor, f.origem, f.canal])
  const tabelas = useMemo(() => tabelasRelatorio(m), [m])
  const tb = (titulo) => formatada(tabelas.find((x) => x.titulo === titulo))
  const r = m.resumo
  const tituloPeriodo = f.de || f.ate ? `${dataBR(f.de) || 'início'} a ${dataBR(f.ate) || 'hoje'}` : 'Todo o período'
  const descricaoFiltros = [
    tituloPeriodo,
    f.vendedor && `Vendedor: ${nomeCurto(pessoas, f.vendedor)}`,
    f.origem && `Origem: ${listas.origens_lead.find((o) => o.id === f.origem)?.nome}`,
    f.canal && `Canal: ${f.canal === 'online' ? 'Online' : lojas.find((l) => l.id === f.canal)?.nome}`,
  ].filter(Boolean).join(' · ')

  function escolherAtalho(k) {
    const [de, ate] = periodo(k)
    setAtalho(k)
    setRascunho((x) => ({ ...x, de, ate }))
  }
  function limpar() {
    const v = FILTRO_VAZIO()
    setRascunho(v)
    setFiltro(v)
    setAtalho('mes')
  }
  const nomeArquivo = `metricas-vendas-${(f.de || 'inicio')}-a-${(f.ate || 'hoje')}`

  async function exportar(tipo) {
    setGerando(tipo)
    setErro('')
    try {
      if (tipo === 'pdf') {
        const { gerarPdfMetricas } = await import('../relatorio/PdfMetricas.jsx')
        baixarArquivo(await gerarPdfMetricas({ resumo: r, tabelas: tabelas.map((x) => ({ titulo: x.titulo, ...formatada(x) })), filtros: descricaoFiltros }), `${nomeArquivo}.pdf`)
      } else {
        const { gerarXlsx } = await import('../../lib/xlsxSimples.js')
        const abas = [
          { nome: 'Resumo', linhas: [['Indicador', 'Valor'], ['Período e filtros', descricaoFiltros], ['Leads', r.leads], ['Agendamentos', r.agendamentos], ['Comparecimentos', r.comparecimentos],
            ['Vendas', r.vendas], ['Faturamento (R$)', r.faturamento], ['Ticket médio (R$)', r.ticket], ['Conversão (%)', conv(r.conversao)], ['Perdas', r.perdas]] },
          ...tabelas.map((x) => ({ nome: x.titulo, linhas: [x.colunas, ...x.linhas] })),
          { nome: 'Vendas', linhas: [['Cliente', 'Pedido', 'Vendedor', 'Data', 'Valor bruto (R$)', 'Valor deflacionado (R$)'], ...m.vendas.map((l) => [l.nome, l.codigo_pedido || '', nomeCurto(pessoas, l.vendedor_id), dataBR(l.venda_data), Number(l.venda_valor), l.venda_deflacionado == null ? null : Number(l.venda_deflacionado)])] },
        ]
        baixarArquivo(await gerarXlsx(abas), `${nomeArquivo}.xlsx`)
      }
    } catch (e) {
      setErro('Não foi possível exportar: ' + e.message)
    } finally {
      setGerando('')
    }
  }

  const barrasVend = (campo, fmt, dica) => m.porVendedor.filter((x) => x[campo] != null && (campo !== 'conversao' || x.leads))
    .sort((a, b) => (b[campo] || 0) - (a[campo] || 0)).map((x) => ({ rotulo: x.nome, valor: x[campo], texto: fmt(x[campo]), dica: dica?.(x) }))

  return (
    <section className="gestao comercial-metricas">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Comercial</span>
          <h1 className="titulo-grande">Métricas de Vendas</h1>
          <p className="dica">{descricaoFiltros}{!acoes.todos ? ' · somente os seus números' : ''}</p>
        </div>
        <div className="acoes-linha">
          <button type="button" className="btn btn-contorno" onClick={() => exportar('pdf')} disabled={!!gerando}>{gerando === 'pdf' ? 'Gerando…' : 'Exportar PDF'}</button>
          <button type="button" className="btn btn-contorno" onClick={() => exportar('xlsx')} disabled={!!gerando}>{gerando === 'xlsx' ? 'Gerando…' : 'Exportar Excel'}</button>
        </div>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      <form className="filtros-metricas" onSubmit={(e) => { e.preventDefault(); setFiltro(rascunho) }}>
        <div className="segmentado" role="radiogroup" aria-label="Atalhos de período">
          {ATALHOS_PERIODO.map(([k, t]) => <button key={k} type="button" role="radio" aria-checked={atalho === k} className={atalho === k ? 'ativo' : ''} onClick={() => escolherAtalho(k)}>{t}</button>)}
        </div>
        <label className="campo-mini">De <input type="date" value={rascunho.de} onChange={(e) => { setAtalho(''); setRascunho((x) => ({ ...x, de: e.target.value })) }} /></label>
        <label className="campo-mini">Até <input type="date" value={rascunho.ate} onChange={(e) => { setAtalho(''); setRascunho((x) => ({ ...x, ate: e.target.value })) }} /></label>
        {acoes.todos ? (
          <select aria-label="Vendedor" value={rascunho.vendedor} onChange={(e) => setRascunho((x) => ({ ...x, vendedor: e.target.value }))}>
            <option value="">Todos os vendedores</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome || v.email}</option>)}
          </select>
        ) : <span className="chip chip-neutro" title="O vendedor vê só os próprios números">Vendedor: {perfil.nome || perfil.email}</span>}
        <select aria-label="Origem" value={rascunho.origem} onChange={(e) => setRascunho((x) => ({ ...x, origem: e.target.value }))}>
          <option value="">Todas as origens</option>
          {listas.origens_lead.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select aria-label="Loja ou online" value={rascunho.canal} onChange={(e) => setRascunho((x) => ({ ...x, canal: e.target.value }))}>
          <option value="">Lojas e online</option>
          {lojas.filter((l) => l.id !== 'online').map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          <option value="online">Online</option>
        </select>
        <button className="btn btn-principal">Aplicar</button>
        <button type="button" className="btn btn-leve" onClick={limpar}>Limpar filtros</button>
      </form>

      <div className="indicadores">
        {[['Leads', numero(r.leads, 0)], ['Agendamentos', numero(r.agendamentos, 0)], ['Comparecimentos', numero(r.comparecimentos, 0)], ['Vendas', numero(r.vendas, 0)],
          ['Faturamento', dinheiro(r.faturamento)], ['Ticket médio', r.ticket == null ? '—' : dinheiro(r.ticket)], ['Conversão', pct(r.conversao)]].map(([k, v]) => (
          <div key={k} className="indicador"><span>{k}</span><strong>{v}</strong></div>
        ))}
      </div>

      <div className="graficos">
        <Grafico titulo="Leads por vendedor" tabela={tb('Por vendedor')}>
          <Barras itens={barrasVend('leads', (v) => numero(v, 0), (x) => `${x.vendas} venda(s)`)} />
        </Grafico>
        <Grafico titulo="Conversão por vendedor" sub="Vendas ÷ leads do período" tabela={tb('Por vendedor')}>
          <Barras itens={barrasVend('conversao', pct, (x) => `${x.vendas} de ${x.leads} leads`)} />
        </Grafico>
        <Grafico titulo="Ticket médio por vendedor" tabela={tb('Por vendedor')}>
          <Barras itens={barrasVend('ticket', dinheiro, (x) => `${x.vendas} venda(s)`)} />
        </Grafico>
        <Grafico titulo="Faturamento por vendedor" tabela={tb('Por vendedor')}>
          <Barras itens={barrasVend('faturamento', dinheiro).filter((x) => x.valor > 0)} />
        </Grafico>
        <Grafico titulo="Evolução mensal" sub="Leads e vendas por mês" tabela={tb('Evolução mensal')} largo>
          <Linhas pontos={m.meses.map((x) => ({ x: x.mes, rotulo: rotuloMes(x.mes), valores: { leads: x.leads, vendas: x.vendas } }))}
            series={[{ chave: 'leads', nome: 'Leads' }, { chave: 'vendas', nome: 'Vendas' }]} formato={(v) => numero(v, 0)} />
        </Grafico>
        <Grafico titulo="Funil" sub="Leads do período até a venda" tabela={tb('Funil')}>
          <Barras itens={m.funil.map((x) => ({ rotulo: x.etapa, valor: x.n, texto: `${x.n} · ${pct(x.taxa)}` }))} />
        </Grafico>
        <Grafico titulo="Motivos de perda" tabela={tb('Motivos de perda')}>
          <Barras itens={m.motivosPerda.map((x) => ({ rotulo: x.motivo, valor: x.n, texto: numero(x.n, 0) }))} />
        </Grafico>
        <Grafico titulo="Leads e conversão por origem" tabela={tb('Por origem')}>
          <Barras itens={m.porOrigem.map((x) => ({ rotulo: x.nome, valor: x.leads, texto: `${x.leads} · ${pct(x.conversao)}`, dica: `${x.vendas} venda(s)` }))} />
        </Grafico>
        <Grafico titulo="Tempo médio de fechamento" sub="Dias do cadastro até a venda" tabela={tb('Tempo médio de fechamento')}>
          <Barras itens={m.fechamento.map((x) => ({ rotulo: x.nome, valor: x.media, texto: `${numero(x.media)} dias`, dica: `${x.n} venda(s)` }))} />
        </Grafico>
        <Grafico titulo="Tempo do primeiro contato" sub={`Horas do cadastro até a 1ª ação do vendedor · ${m.semContato} lead(s) ainda sem contato`} tabela={tb('Tempo do primeiro contato')}>
          <Barras itens={m.primeiroContato.map((x) => ({ rotulo: x.nome, valor: x.media, texto: `${numero(x.media)} h`, dica: `${x.n} lead(s)` }))} />
        </Grafico>
        <Grafico titulo="Não responde" sub={`${m.naoResponde.total} lead(s) parados agora · média de ${numero(m.naoResponde.mediaDias)} dias`} tabela={tb('Não responde (agora)')}>
          <Barras itens={m.naoResponde.porVendedor.map((x) => ({ rotulo: x.nome, valor: x.quantidade, texto: `${x.quantidade} · ${numero(x.media)} dias`, dica: 'Quantidade · tempo parado (média)' }))} />
        </Grafico>
        <Grafico titulo="Loja x Online" tabela={tb('Loja x Online')}>
          <Barras itens={m.porCanal.map((x) => ({ rotulo: x.nome, valor: x.leads, texto: `${x.leads} leads · ${x.vendas} vendas`, dica: dinheiro(x.faturamento) }))} />
        </Grafico>
        <Grafico titulo="Ranking" sub="Por faturamento no período" largo>
          <TabelaDados {...tb('Ranking')} />
        </Grafico>
        <Grafico titulo="Produção do captador" tabela={tb('Produção do captador')}>
          <Barras itens={m.porCaptador.map((x) => ({ rotulo: x.nome, valor: x.leads, texto: `${x.leads} leads`, dica: `${x.agendados} agendados · ${x.vendas} vendas` }))} />
        </Grafico>
        <Grafico titulo="Lembretes atrasados por vendedor" sub="Situação agora" tabela={tb('Lembretes atrasados (agora)')}>
          <Barras itens={m.lembretesAtrasados.map((x) => ({ rotulo: x.nome, valor: x.n, texto: numero(x.n, 0) }))} />
        </Grafico>
      </div>
    </section>
  )
}
