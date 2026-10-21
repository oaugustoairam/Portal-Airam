// Métricas de Vendas em PDF A4: indicadores do período e as tabelas de cada relatório.
import { Document, Page, View, Text, Image, Font, StyleSheet, pdf } from '@react-pdf/renderer'
import logoVermelho from '../../assets/logo-vermelho.png'
import albert400 from '../../assets/fontes/albert-sans-latin-400-normal.woff'
import albert500 from '../../assets/fontes/albert-sans-latin-500-normal.woff'
import albert600 from '../../assets/fontes/albert-sans-latin-600-normal.woff'
import { dinheiro } from '../../lib/comercial.js'
import { pct, numero } from '../../lib/metricas.js'

Font.register({ family: 'Albert', fonts: [{ src: albert400, fontWeight: 400 }, { src: albert500, fontWeight: 500 }, { src: albert600, fontWeight: 600 }] })
Font.registerHyphenationCallback((p) => [p])

const COR = { marca: '#930000', tinta: '#161616', tinta2: '#6e6e6c', linha: '#e2e2df', papel: '#f4f3f1' }
const s = StyleSheet.create({
  pagina: { fontFamily: 'Albert', fontSize: 8.5, color: COR.tinta, paddingTop: 28, paddingBottom: 36, paddingHorizontal: 32 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1.2, borderBottomColor: COR.marca, paddingBottom: 9, marginBottom: 12 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  card: { width: '25%', padding: 3 },
  cardIn: { backgroundColor: COR.papel, borderRadius: 4, padding: 7 },
  rotulo: { fontSize: 7, color: COR.tinta2, marginBottom: 2 },
  valor: { fontSize: 12, fontWeight: 600 },
  secao: { marginTop: 10 },
  stitulo: { fontSize: 10, fontWeight: 600, color: COR.marca, marginBottom: 4 },
  linha: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COR.linha, paddingVertical: 3 },
  cab: { flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: COR.tinta, paddingVertical: 3 },
  rodape: { position: 'absolute', bottom: 16, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: COR.tinta2 },
})

function Tabela({ titulo, colunas, linhas }) {
  const larg = colunas.map((_, i) => (i === 0 ? 2.2 : 1))
  const total = larg.reduce((a, b) => a + b, 0)
  const w = (i) => ({ width: `${(larg[i] / total) * 100}%`, textAlign: i === 0 ? 'left' : 'right', paddingHorizontal: 2 })
  return (
    <View style={s.secao}>
      <View wrap={false}>
        <Text style={s.stitulo}>{titulo}</Text>
        <View style={s.cab}>{colunas.map((c, i) => <Text key={c} style={[w(i), { fontWeight: 600, fontSize: 7.5 }]}>{c}</Text>)}</View>
      </View>
      {linhas.length === 0 ? <Text style={{ color: COR.tinta2, paddingVertical: 4 }}>Sem dados no período.</Text>
        : linhas.map((l, j) => <View key={j} style={s.linha} wrap={false}>{l.map((v, i) => <Text key={i} style={w(i)}>{v}</Text>)}</View>)}
    </View>
  )
}

function Documento({ resumo: r, tabelas, filtros }) {
  const cards = [['Leads', numero(r.leads, 0)], ['Agendamentos', numero(r.agendamentos, 0)], ['Comparecimentos', numero(r.comparecimentos, 0)], ['Vendas', numero(r.vendas, 0)],
    ['Faturamento', dinheiro(r.faturamento)], ['Ticket médio', r.ticket == null ? '—' : dinheiro(r.ticket)], ['Conversão', pct(r.conversao)], ['Perdas', numero(r.perdas, 0)]]
  return (
    <Document title="Métricas de Vendas" author="Airam Arquitetura & Marcenaria">
      <Page size="A4" style={s.pagina}>
        <View style={s.topo} fixed>
          <Image src={logoVermelho} style={{ width: 84 }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 14, fontWeight: 600, color: COR.marca }}>Métricas de Vendas</Text>
            <Text style={{ fontSize: 8, color: COR.tinta2 }}>{filtros}</Text>
          </View>
        </View>
        <View style={s.cards}>
          {cards.map(([k, v]) => (
            <View key={k} style={s.card}><View style={s.cardIn}><Text style={s.rotulo}>{k}</Text><Text style={s.valor}>{v}</Text></View></View>
          ))}
        </View>
        {tabelas.map((t) => <Tabela key={t.titulo} {...t} />)}
        <View style={s.rodape} fixed>
          <Text>Airam Arquitetura & Marcenaria · gerado em {new Date().toLocaleString('pt-BR')}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export function gerarPdfMetricas(dados) {
  return pdf(<Documento {...dados} />).toBlob()
}
