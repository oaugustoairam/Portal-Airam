// Layouts dos relatórios em PDF (gerados no navegador com @react-pdf/renderer).
// Este arquivo só é carregado quando alguém pede um relatório.
import { Document, Page, View, Text, Image, Svg, Path, Circle, Rect, Defs, LinearGradient, Stop, Font, StyleSheet, pdf } from '@react-pdf/renderer'
import { dataCurta, dataMini, dataExtenso, COLUNAS_LISTA, valorColuna } from '../../lib/relatorio.js'
import { diasEntre } from '../../lib/constants.js'
import logoBranco from '../../assets/logo-branco.png'
import logoVermelho from '../../assets/logo-vermelho.png'
import albert300 from '../../assets/fontes/albert-sans-latin-300-normal.woff'
import albert400 from '../../assets/fontes/albert-sans-latin-400-normal.woff'
import albert500 from '../../assets/fontes/albert-sans-latin-500-normal.woff'
import albert600 from '../../assets/fontes/albert-sans-latin-600-normal.woff'

Font.register({
  family: 'Albert',
  fonts: [
    { src: albert300, fontWeight: 300 },
    { src: albert400, fontWeight: 400 },
    { src: albert500, fontWeight: 500 },
    { src: albert600, fontWeight: 600 },
  ],
})
Font.registerHyphenationCallback((palavra) => [palavra])

const COR = {
  marca: '#930000', suave: '#f7e9e9', papel: '#f4f3f1', tinta: '#161616', tinta2: '#6e6e6c',
  linha: '#e2e2df', branco: '#ffffff', ok: '#2e6b45', okSuave: '#e6f0e9', ambar: '#9a6200', ambarSuave: '#f8efdc',
}
const EMPRESA = 'Airam Arquitetura & Marcenaria'
const RODAPE = 'Airam Guarulhos · Airam Mooca · airam.arq.br · WhatsApp (11) 98977-6738'
const M = 32 // margem lateral

const s = StyleSheet.create({
  pagina: { fontFamily: 'Albert', fontSize: 8.5, color: COR.tinta, backgroundColor: COR.branco },
  rotulo: { fontSize: 7, fontWeight: 500, color: COR.tinta2, marginBottom: 3 },
  titulo: { fontSize: 11, fontWeight: 500, marginBottom: 7 },
  rodape: { position: 'absolute', bottom: 16, left: M, right: M, flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 0.6, borderTopColor: COR.linha, paddingTop: 7 },
  miudo: { fontSize: 6.8, color: COR.tinta2 },
})

function Selo({ tipo, children }) {
  const cores = {
    ok: [COR.okSuave, COR.ok], atraso: [COR.marca, COR.branco], andamento: [COR.ambarSuave, COR.ambar], neutro: [COR.papel, COR.tinta2],
  }[tipo] || [COR.papel, COR.tinta2]
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: cores[0], borderRadius: 7, paddingVertical: 2, paddingHorizontal: 6 }}>
      <Text style={{ fontSize: 6.8, fontWeight: 500, color: cores[1] }}>{children}</Text>
    </View>
  )
}

// Rosca de progresso
function Rosca({ valor, tamanho = 58 }) {
  const r = tamanho / 2 - 5
  const c = tamanho / 2
  const ang = (Math.min(99.99, valor) / 100) * Math.PI * 2
  const arco = `M ${c} ${c - r} A ${r} ${r} 0 ${ang > Math.PI ? 1 : 0} 1 ${c + r * Math.sin(ang)} ${c - r * Math.cos(ang)}`
  return (
    <View style={{ width: tamanho, height: tamanho }}>
      <Svg width={tamanho} height={tamanho}>
        <Circle cx={c} cy={c} r={r} stroke={COR.linha} strokeWidth={6} fill="none" />
        {valor > 0 && <Path d={arco} stroke={COR.marca} strokeWidth={6} fill="none" strokeLinecap="round" />}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, width: tamanho, height: tamanho, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 14, fontWeight: 300 }}>{valor}%</Text>
      </View>
    </View>
  )
}

// Etapas do portal em linha
function LinhaDoTempo({ etapas }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {etapas.map((e, i) => {
        const feito = e.status === 'concluida'
        const atual = e.status === 'atual'
        return (
          <View key={e.id} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.8,
                borderColor: feito || atual ? COR.marca : COR.linha, backgroundColor: feito ? COR.marca : COR.branco }} />
              {i < etapas.length - 1 && <View style={{ flexGrow: 1, height: 1.4, backgroundColor: feito ? COR.marca : COR.linha }} />}
            </View>
            <Text style={{ fontSize: 7, fontWeight: atual ? 600 : 500, marginTop: 5, paddingRight: 6, color: feito || atual ? COR.tinta : COR.tinta2 }}>{e.nome}</Text>
            <Text style={[s.miudo, { marginTop: 2, color: e.atrasada ? COR.marca : COR.tinta2 }]}>
              {feito ? (e.data ? dataCurta(e.data) : 'Concluída') : atual ? (e.atrasada ? 'Atrasada' : 'Em andamento') : e.data ? `Prev. ${dataCurta(e.data)}` : 'A definir'}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// Cronograma (Gantt) compacto
function Cronograma({ r }) {
  const { inicio, fim } = r.escala
  const total = Math.max(1, diasEntre(inicio, fim))
  const pct = (d) => Math.max(0, Math.min(100, (diasEntre(inicio, d) / total) * 100))
  const pos = (d) => `${pct(d)}%`
  const larg = (a, b) => `${Math.max(0.8, (Math.max(0, diasEntre(a, b)) / total) * 100)}%`
  const meses = []
  const d = new Date(inicio + 'T00:00:00')
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  while (d.toISOString().slice(0, 10) <= fim) {
    meses.push(d.toISOString().slice(0, 10))
    d.setMonth(d.getMonth() + 1)
  }
  const ROTULO = 92
  const ALT = 10

  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 3 }}>
        <View style={{ width: ROTULO }} />
        <View style={{ flexGrow: 1, height: 9 }}>
          {meses.map((m) => (
            <Text key={m} style={[s.miudo, { position: 'absolute', left: pos(m), fontSize: 6 }]}>
              {new Date(m + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
            </Text>
          ))}
        </View>
      </View>
      <View>
        {r.fases.map((f) => {
          const fimRotulo = f.prazo && f.prazo > f.fim ? f.prazo : f.fim
          return (
            <View key={f.nome} style={{ flexDirection: 'row', alignItems: 'center', height: ALT + 5 }}>
              <Text style={{ width: ROTULO, fontSize: 6.8, color: f.inicio ? COR.tinta : COR.tinta2 }}>{f.nome}</Text>
              <View style={{ flexGrow: 1, height: ALT, backgroundColor: COR.papel, borderRadius: 2 }}>
                {meses.map((m) => (
                  <View key={m} style={{ position: 'absolute', left: pos(m), top: 0, bottom: 0, width: 0.5, backgroundColor: COR.linha }} />
                ))}
                {f.inicio && (
                  <View style={{
                    position: 'absolute', left: pos(f.inicio), width: larg(f.inicio, f.fim), top: 1.5, height: ALT - 3, borderRadius: 1.5,
                    backgroundColor: f.emCurso ? COR.suave : COR.marca, borderWidth: f.emCurso ? 0.7 : 0, borderColor: COR.marca,
                  }} />
                )}
                {f.prazo && <View style={{ position: 'absolute', left: pos(f.prazo), top: -1, height: ALT + 2, width: 1.3, backgroundColor: COR.tinta }} />}
                {f.inicio && f.dias !== null && pct(fimRotulo) < 90 && (
                  <Text style={[s.miudo, { position: 'absolute', left: pos(fimRotulo), top: 1.5, marginLeft: 4, fontSize: 5.8 }]}>{f.dias}d</Text>
                )}
              </View>
            </View>
          )
        })}
        <View style={{ position: 'absolute', left: ROTULO, right: 0, top: 0, bottom: 0 }}>
          <View style={{ position: 'absolute', left: pos(r.hoje), top: -2, bottom: 0, borderLeftWidth: 0.8, borderLeftColor: COR.marca, borderStyle: 'dashed' }} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6, marginLeft: ROTULO }}>
        {[
          [{ width: 12, height: 6, backgroundColor: COR.marca, borderRadius: 1 }, 'Concluída'],
          [{ width: 12, height: 6, backgroundColor: COR.suave, borderWidth: 0.7, borderColor: COR.marca, borderRadius: 1 }, 'Em andamento'],
          [{ width: 1.3, height: 8, backgroundColor: COR.tinta }, 'Prazo'],
          [{ width: 0, height: 8, borderLeftWidth: 0.8, borderLeftColor: COR.marca, borderStyle: 'dashed' }, 'Hoje'],
        ].map(([estilo, t]) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
            <View style={estilo} />
            <Text style={[s.miudo, { marginLeft: 4 }]}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function LinhaPrazo({ titulo, regra, prazo, feito, situacao }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.6, borderBottomColor: COR.linha }}>
      <View style={{ flex: 1, paddingRight: 6 }}>
        <Text style={{ fontSize: 8, fontWeight: 500 }}>{titulo}</Text>
        <Text style={s.miudo}>{regra}{feito ? ` · feito em ${dataCurta(feito)}` : ''}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 9.5, fontWeight: 300, marginBottom: 2 }}>{dataCurta(prazo)}</Text>
        <Selo tipo={situacao.tipo}>{situacao.texto}</Selo>
      </View>
    </View>
  )
}

function Rodape({ paginas }) {
  return (
    <View style={s.rodape} fixed>
      <Text style={s.miudo}>{RODAPE}</Text>
      {paginas
        ? <Text style={s.miudo} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        : <Text style={s.miudo}>{EMPRESA}</Text>}
    </View>
  )
}

// ============================================================ PDF de um cliente (uma página)
function RelatorioCliente({ r, foto, interno, geradoEm }) {
  const { p, c } = r
  const H = 124
  const metade = Math.ceil(r.marcos.length / 2)
  const colunasMarcos = [r.marcos.slice(0, metade), r.marcos.slice(metade)]
  const resumoObs = c.observacoes && c.observacoes.length > 220 ? c.observacoes.slice(0, 217) + '…' : c.observacoes
  const internos = [
    ['Liberador', c.liberador],
    ['Montador', c.montador],
    ['ATT (assistência técnica)', c.tem_att === true ? 'Sim' : c.tem_att === false ? 'Não' : 'A definir'],
    ...(c.tem_att === true ? [['Retorno da assistência', dataCurta(c.assistencia_retorno_max)]] : []),
    ['Vistoria', dataCurta(c.vistoria_em)],
    ['E-mail de formalização', dataCurta(c.email_enviado_em)],
  ]

  return (
    <Document title={`Relatório ${p.codigo} — ${p.cliente_nome}`} author={EMPRESA} creator="Portal Airam" language="pt-BR">
      <Page size="A4" style={s.pagina}>
        {/* Topo com foto */}
        <View style={{ height: H, backgroundColor: COR.tinta }}>
          {foto && <Image src={foto.src} style={{ width: '100%', height: H, objectFit: 'cover' }} />}
          <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={595} height={H}>
            <Defs>
              <LinearGradient id="sombra" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#000000" stopOpacity={0.78} />
                <Stop offset="0.6" stopColor="#000000" stopOpacity={0.35} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0.15} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={595} height={H} fill="url(#sombra)" />
          </Svg>
          <Image src={logoBranco} style={{ position: 'absolute', top: 20, left: M, width: 92, height: 26, objectFit: 'contain' }} />
          <Text style={{ position: 'absolute', top: 26, right: M, fontSize: 7.5, color: COR.branco, opacity: 0.85 }}>
            Relatório do processo · {dataExtenso(geradoEm)}
          </Text>
          <View style={{ position: 'absolute', left: M, right: M, bottom: 18 }}>
            <Text style={{ fontSize: 26, fontWeight: 300, color: COR.branco, letterSpacing: -0.4 }}>{p.cliente_nome}</Text>
            <Text style={{ fontSize: 8, color: COR.branco, opacity: 0.85, marginTop: 4 }}>
              {[`Código ${p.codigo}`, p.numero_contrato && `Contrato ${p.numero_contrato}`, p.ambientes].filter(Boolean).join('  ·  ')}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: M, paddingTop: 13 }}>
          {/* Números principais */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 0.6, borderBottomColor: COR.linha }}>
            <Rosca valor={r.progresso} />
            <View style={{ marginLeft: 10, width: 70 }}>
              <Text style={s.rotulo}>Progresso</Text>
              <Text style={{ fontSize: 8.3 }}>{r.feitas} de {r.etapas.length} etapas</Text>
            </View>
            {[
              ['Etapa atual', r.concluido ? 'Concluído' : r.atual.nome, r.atual.atrasada ? 'Com atraso' : r.proxima ? `Depois: ${r.proxima.nome}` : ''],
              ['Prazo máximo', dataCurta(p.data_entrega_prevista), r.tipoPrazo],
              ['Desde a venda', r.diasDesdeVenda !== null ? `${r.diasDesdeVenda} dias` : '—', `Venda em ${dataCurta(r.real.venda)}`],
            ].map(([k, v, sub]) => (
              <View key={k} style={{ flex: 1, paddingLeft: 12, borderLeftWidth: 0.6, borderLeftColor: COR.linha, marginLeft: 8 }}>
                <Text style={s.rotulo}>{k}</Text>
                <Text style={{ fontSize: 12 }}>{v}</Text>
                <Text style={[s.miudo, { marginTop: 2 }]}>{sub}</Text>
              </View>
            ))}
            <View style={{ paddingLeft: 12, borderLeftWidth: 0.6, borderLeftColor: COR.linha, marginLeft: 8, width: 92 }}>
              <Text style={s.rotulo}>Situação</Text>
              <Selo tipo={r.situacaoEntrega.tipo}>{r.situacaoEntrega.texto}</Selo>
            </View>
          </View>

          {/* Linha do tempo */}
          <View style={{ paddingTop: 10, paddingBottom: 11, borderBottomWidth: 0.6, borderBottomColor: COR.linha }}>
            <Text style={s.titulo}>Etapas</Text>
            <LinhaDoTempo etapas={r.etapas} />
          </View>

          {/* Cronograma + prazos */}
          <View style={{ flexDirection: 'row', paddingTop: 12 }}>
            <View style={{ width: '58%', paddingRight: 16 }}>
              <Text style={s.titulo}>Cronograma</Text>
              <Cronograma r={r} />
            </View>
            <View style={{ width: '42%' }}>
              <Text style={s.titulo}>Prazos</Text>
              <View style={{ borderTopWidth: 1, borderTopColor: COR.tinta }}>
                <LinhaPrazo titulo="Conferência do projeto" regra="5 dias úteis após o liberador receber" prazo={r.prazoConferencia} feito={r.real.conferido} situacao={r.situacaoConferencia} />
                <LinhaPrazo titulo="PDF do projeto final" regra="5 dias úteis após enviar a conferência" prazo={r.prazoPdf} feito={r.real.pdf} situacao={r.situacaoPdf} />
                <LinhaPrazo titulo="Prazo máximo de entrega" regra={r.tipoPrazo || 'Contrato'} prazo={p.data_entrega_prevista} feito={r.real.entregue} situacao={r.situacaoEntrega} />
                {c.tem_att === true && r.situacaoAssistencia && (
                  <LinhaPrazo titulo="Assistência técnica" regra="Retorno máximo" prazo={c.assistencia_retorno_max} feito={c.assistencia_concluida_em} situacao={r.situacaoAssistencia} />
                )}
              </View>
            </View>
          </View>

          {/* Passo a passo */}
          <View style={{ paddingTop: 12 }}>
            <Text style={s.titulo}>Passo a passo</Text>
            <View style={{ flexDirection: 'row' }}>
              {colunasMarcos.map((col, ci) => (
                <View key={ci} style={{ flex: 1, marginRight: ci === 0 ? 16 : 0, borderTopWidth: 1, borderTopColor: COR.tinta }}>
                  <View style={{ flexDirection: 'row', paddingVertical: 3.5, borderBottomWidth: 0.6, borderBottomColor: COR.linha }}>
                    <Text style={[s.rotulo, { flex: 1, marginBottom: 0 }]}>Passo</Text>
                    <Text style={[s.rotulo, { width: 50, marginBottom: 0 }]}>Previsto</Text>
                    <Text style={[s.rotulo, { width: 50, marginBottom: 0 }]}>Realizado</Text>
                  </View>
                  {col.map((m) => {
                    const atrasado = !m.real && m.previsto && diasEntre(r.hoje, m.previsto) < 0
                    return (
                      <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3.5, borderBottomWidth: 0.6, borderBottomColor: COR.linha }}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 5, height: 5, borderRadius: 2.5, marginRight: 6, backgroundColor: m.real ? COR.marca : COR.branco, borderWidth: 0.8, borderColor: m.real ? COR.marca : COR.linha }} />
                          <Text style={{ fontSize: 7.6, color: m.real ? COR.tinta : COR.tinta2 }}>
                            {m.nome}{interno && m.extra ? ` · ${m.extra}` : ''}
                          </Text>
                        </View>
                        <Text style={{ width: 50, fontSize: 7.3, color: atrasado ? COR.marca : COR.tinta2 }}>{m.previsto ? dataCurta(m.previsto) : '—'}</Text>
                        <Text style={{ width: 50, fontSize: 7.3 }}>{m.real ? dataCurta(m.real) : '—'}</Text>
                      </View>
                    )
                  })}
                </View>
              ))}
            </View>
          </View>

          {/* Controle interno */}
          {interno && (
            <View style={{ marginTop: 12, backgroundColor: COR.papel, borderRadius: 6, paddingVertical: 9, paddingHorizontal: 12 }}>
              <View style={{ flexDirection: 'row' }}>
                {internos.map(([k, v]) => (
                  <View key={k} style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={s.rotulo}>{k}</Text>
                    <Text style={{ fontSize: 8.3 }}>{v || '—'}</Text>
                  </View>
                ))}
              </View>
              {resumoObs && (
                <Text style={{ fontSize: 7.4, color: COR.tinta2, marginTop: 6, lineHeight: 1.4 }}>Observações: {resumoObs}</Text>
              )}
            </View>
          )}
        </View>
        <Rodape />
      </Page>
    </Document>
  )
}

// ============================================================ PDF da lista (vários clientes)
const COLUNAS_PDF = COLUNAS_LISTA.filter(([k]) => k !== 'montador')
const LARGURAS = { codigo: 32, cliente: 104, etapa: 76, progresso: 48, liberador: 50, situacao: 84 }

function RelatorioLista({ linhas, geradoEm }) {
  const atrasados = linhas.filter((l) => l.atraso).length
  const media = Math.round(linhas.reduce((t, l) => t + l.progresso, 0) / Math.max(1, linhas.length))
  const proximos = linhas.filter((l) => l.situacao.tipo === 'andamento' && l.prazoMaximo && diasEntre(geradoEm, l.prazoMaximo) <= 30).length
  return (
    <Document title="Relatório de processos" author={EMPRESA} creator="Portal Airam" language="pt-BR">
      <Page size="A4" orientation="landscape" style={[s.pagina, { paddingTop: 58, paddingBottom: 46, paddingHorizontal: M }]}>
        <View style={{ position: 'absolute', top: 22, left: M, right: M, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingBottom: 9, borderBottomWidth: 0.6, borderBottomColor: COR.linha }} fixed>
          <Image src={logoVermelho} style={{ height: 18, width: 74, objectFit: 'contain' }} />
          <Text style={s.miudo}>Relatório de processos · {dataCurta(geradoEm)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
          <View>
            <Text style={[s.rotulo, { color: COR.marca }]}>Gerado em {dataExtenso(geradoEm)}</Text>
            <Text style={{ fontSize: 22, fontWeight: 300, letterSpacing: -0.4, marginTop: 2 }}>Prazos e datas dos processos</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {[['Processos', linhas.length], ['Com atraso', atrasados], ['Progresso médio', `${media}%`], ['Prazo em 30 dias', proximos]].map(([k, v], i) => (
              <View key={k} style={{ marginLeft: 22, borderTopWidth: 1.2, borderTopColor: i === 1 && atrasados ? COR.marca : COR.tinta, paddingTop: 5, minWidth: 60 }}>
                <Text style={s.rotulo}>{k}</Text>
                <Text style={{ fontSize: 17, fontWeight: 300, color: i === 1 && atrasados ? COR.marca : COR.tinta }}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', backgroundColor: COR.tinta, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 3 }} fixed>
          {COLUNAS_PDF.map(([k, t]) => (
            <Text key={k} style={{ width: LARGURAS[k] || 44, flexGrow: k === 'cliente' ? 1 : 0, paddingRight: 4, fontSize: 6.5, fontWeight: 500, color: COR.branco }}>{t}</Text>
          ))}
        </View>
        {linhas.map((l, i) => (
          <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, backgroundColor: i % 2 ? COR.papel : COR.branco }} wrap={false}>
            {COLUNAS_PDF.map((col) => {
              const [k, , tipo] = col
              const w = { width: LARGURAS[k] || 44, flexGrow: k === 'cliente' ? 1 : 0, paddingRight: 4 }
              if (k === 'progresso')
                return (
                  <View key={k} style={w}>
                    <View style={{ height: 4, backgroundColor: COR.linha, borderRadius: 2 }}>
                      <View style={{ width: `${l.progresso}%`, height: 4, backgroundColor: COR.marca, borderRadius: 2 }} />
                    </View>
                    <Text style={{ fontSize: 6.8, marginTop: 2 }}>{l.progresso}%</Text>
                  </View>
                )
              if (k === 'situacao') return <View key={k} style={w}><Selo tipo={l.situacao.tipo}>{l.situacao.texto}</Selo></View>
              if (k === 'cliente')
                return (
                  <View key={k} style={w}>
                    <Text style={{ fontSize: 7.6, fontWeight: 500 }}>{l.cliente}</Text>
                    {l.ambientes ? <Text style={{ fontSize: 6.4, color: COR.tinta2, marginTop: 1 }}>{l.ambientes}</Text> : null}
                  </View>
                )
              const vencido = (k === 'prazoConferencia' && !l.conferido) || (k === 'prazoPdf' && !l.pdf) || (k === 'prazoMaximo' && !l.entregue)
              const atrasado = vencido && l[k] && diasEntre(geradoEm, l[k]) < 0
              return (
                <Text key={k} style={[w, { fontSize: tipo === 'data' ? 7 : 7.4, color: atrasado ? COR.marca : COR.tinta, fontWeight: k === 'codigo' || atrasado ? 600 : 400 }]}>
                  {valorColuna(l, col, dataMini)}
                </Text>
              )
            })}
          </View>
        ))}
        <Text style={[s.miudo, { marginTop: 10 }]}>
          Datas em vermelho: prazo vencido sem a etapa concluída. Prazos de conferência e PDF: 5 dias úteis cada, sem feriados municipais.
        </Text>
        <Rodape paginas />
      </Page>
    </Document>
  )
}

export function gerarPdfCliente(dados) {
  return pdf(<RelatorioCliente {...dados} />).toBlob()
}

export function gerarPdfLista(dados) {
  return pdf(<RelatorioLista {...dados} />).toBlob()
}
