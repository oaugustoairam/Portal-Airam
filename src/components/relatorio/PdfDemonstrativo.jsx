// Demonstrativo do salário do dia 10 (A4): composição do valor e as vendas do mês.
import { Document, Page, View, Text, Image, Font, StyleSheet, pdf } from '@react-pdf/renderer'
import logoVermelho from '../../assets/logo-vermelho.png'
import albert400 from '../../assets/fontes/albert-sans-latin-400-normal.woff'
import albert500 from '../../assets/fontes/albert-sans-latin-500-normal.woff'
import albert600 from '../../assets/fontes/albert-sans-latin-600-normal.woff'
import { dinheiro, dataBR } from '../../lib/comercial.js'

Font.register({ family: 'Albert', fonts: [{ src: albert400, fontWeight: 400 }, { src: albert500, fontWeight: 500 }, { src: albert600, fontWeight: 600 }] })
Font.registerHyphenationCallback((p) => [p])
const COR = { marca: '#930000', tinta: '#161616', tinta2: '#6e6e6c', linha: '#e2e2df', papel: '#f4f3f1' }
const s = StyleSheet.create({
  pagina: { fontFamily: 'Albert', fontSize: 9, color: COR.tinta, paddingTop: 30, paddingBottom: 40, paddingHorizontal: 36 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1.2, borderBottomColor: COR.marca, paddingBottom: 10, marginBottom: 14 },
  destaque: { backgroundColor: COR.marca, color: '#fff', borderRadius: 6, padding: 16, marginBottom: 12 },
  linha: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COR.linha, paddingVertical: 4 },
  stitulo: { fontSize: 10.5, fontWeight: 600, color: COR.marca, marginTop: 12, marginBottom: 4 },
  rodape: { position: 'absolute', bottom: 18, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: COR.tinta2 },
})
const pct = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

function Documento({ mes, pagamento, s: x, faixa, validas, pendentes }) {
  const comp = [['Total deflacionado das vendas válidas', dinheiro(x.total_deflacionado)], ['Faixa atingida', faixa], ['Comissão', `${pct(x.faixa.pct)} × ${dinheiro(x.total_deflacionado)} = ${dinheiro(x.comissao)}`],
    ['Fixo da faixa', dinheiro(x.fixo)], ['Total a receber', dinheiro(x.total)]]
  return (
    <Document title={`Demonstrativo ${mes} — ${x.vendedor}`} author="Airam Arquitetura & Marcenaria">
      <Page size="A4" style={s.pagina}>
        <View style={s.topo}>
          <Image src={logoVermelho} style={{ width: 90 }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 14, fontWeight: 600, color: COR.marca }}>Demonstrativo de salário</Text>
            <Text style={{ fontSize: 8.5, color: COR.tinta2 }}>{x.vendedor} · vendas de {mes}{x.fechado ? ' · mês fechado' : ' · prévia (mês aberto)'}</Text>
          </View>
        </View>
        <View style={s.destaque}>
          <Text style={{ fontSize: 9, opacity: 0.85 }}>Pagamento em {pagamento}</Text>
          <Text style={{ fontSize: 24, fontWeight: 600, marginTop: 2 }}>{dinheiro(x.total)}</Text>
        </View>
        <Text style={s.stitulo}>Composição</Text>
        {comp.map(([k, v], i) => (
          <View key={k} style={[s.linha, i === comp.length - 1 ? { borderBottomWidth: 0 } : {}]}>
            <Text style={{ width: '55%', fontWeight: i === comp.length - 1 ? 600 : 400 }}>{k}</Text>
            <Text style={{ width: '45%', textAlign: 'right', fontWeight: i === comp.length - 1 ? 600 : 400 }}>{v}</Text>
          </View>
        ))}
        <Text style={s.stitulo}>Vendas válidas ({validas.length})</Text>
        <View style={[s.linha, { borderBottomColor: COR.tinta }]}>
          {['Cliente', 'Pedido', 'Data', 'Deflacionado'].map((c, i) => <Text key={c} style={{ width: ['44%', '18%', '16%', '22%'][i], fontWeight: 600, textAlign: i === 3 ? 'right' : 'left' }}>{c}</Text>)}
        </View>
        {validas.length === 0 ? <Text style={{ color: COR.tinta2, paddingVertical: 4 }}>Nenhuma venda válida no mês.</Text> : validas.map((v) => (
          <View key={v.lead_id} style={s.linha} wrap={false}>
            <Text style={{ width: '44%' }}>{v.cliente}</Text><Text style={{ width: '18%' }}>{v.codigo_pedido || '—'}</Text>
            <Text style={{ width: '16%' }}>{dataBR(v.venda_data)}</Text><Text style={{ width: '22%', textAlign: 'right' }}>{dinheiro(v.venda_deflacionado)}</Text>
          </View>
        ))}
        {pendentes.length > 0 && (
          <>
            <Text style={s.stitulo}>Vendas pendentes ({pendentes.length}) — ainda não entram no cálculo</Text>
            {pendentes.map((v) => (
              <View key={v.lead_id} style={s.linha} wrap={false}>
                <Text style={{ width: '40%' }}>{v.cliente} · {v.codigo_pedido || '—'}</Text>
                <Text style={{ width: '60%', color: COR.tinta2 }}>{v.situacao === 'pulada' ? `Pulada: ${v.pulo_motivo}` : `Falta: ${v.faltando.join(', ')}`}</Text>
              </View>
            ))}
          </>
        )}
        <View style={s.rodape} fixed>
          <Text>Airam Arquitetura & Marcenaria · gerado em {new Date().toLocaleString('pt-BR')}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export function gerarPdfDemonstrativo(dados) {
  return pdf(<Documento {...dados} />).toBlob()
}
