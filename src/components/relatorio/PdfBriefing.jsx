// Briefing do cliente em uma página A4: respostas preenchidas ou linhas em branco para escrever à mão.
import { Document, Page, View, Text, Image, Font, StyleSheet, pdf } from '@react-pdf/renderer'
import logoVermelho from '../../assets/logo-vermelho.png'
import albert400 from '../../assets/fontes/albert-sans-latin-400-normal.woff'
import albert500 from '../../assets/fontes/albert-sans-latin-500-normal.woff'
import albert600 from '../../assets/fontes/albert-sans-latin-600-normal.woff'
import { PERGUNTAS_BRIEFING } from '../../lib/comercial.js'

Font.register({ family: 'Albert', fonts: [{ src: albert400, fontWeight: 400 }, { src: albert500, fontWeight: 500 }, { src: albert600, fontWeight: 600 }] })
Font.registerHyphenationCallback((p) => [p])

const COR = { marca: '#930000', tinta: '#161616', tinta2: '#6e6e6c', linha: '#cfcfcb', papel: '#f4f3f1' }
const s = StyleSheet.create({
  pagina: { fontFamily: 'Albert', fontSize: 9.5, color: COR.tinta, paddingTop: 30, paddingBottom: 34, paddingHorizontal: 36 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1.2, borderBottomColor: COR.marca, paddingBottom: 10, marginBottom: 12 },
  titulo: { fontSize: 15, fontWeight: 600, color: COR.marca },
  cab: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: COR.papel, borderRadius: 4, padding: 9, marginBottom: 12 },
  cabItem: { width: '33.3%', paddingVertical: 3, paddingRight: 6 },
  rotulo: { fontSize: 7, fontWeight: 500, color: COR.tinta2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1.5 },
  pergunta: { marginBottom: 7 },
  ptitulo: { fontSize: 9.5, fontWeight: 600, marginBottom: 3 },
  resposta: { fontSize: 9.5, lineHeight: 1.35 },
  linha: { borderBottomWidth: 0.6, borderBottomColor: COR.linha, height: 14 },
  marca: { flexDirection: 'row', gap: 14, marginBottom: 2 },
  caixa: { width: 9, height: 9, borderWidth: 1, borderStyle: 'solid', borderColor: COR.tinta, borderRadius: 1.5, marginRight: 4, padding: 1.5 },
  rodape: { position: 'absolute', bottom: 16, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: COR.tinta2 },
})

const Linhas = ({ n }) => Array.from({ length: n }, (_, i) => <View key={i} style={s.linha} />)
function Opcao({ marcada, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={s.caixa}>{marcada && <View style={{ flexGrow: 1, backgroundColor: COR.marca }} />}</View>
      <Text>{children}</Text>
    </View>
  )
}
function Pergunta({ titulo, valor, linhas = 1, children }) {
  const tem = valor !== null && valor !== undefined && String(valor).trim() !== ''
  return (
    <View style={s.pergunta} wrap={false}>
      <Text style={s.ptitulo}>{titulo}</Text>
      {children}
      {tem ? <Text style={s.resposta}>{String(valor)}</Text> : <Linhas n={linhas} />}
    </View>
  )
}

function Documento({ cab, b }) {
  const r = b || {}
  const itens = [['Cliente', cab.cliente], ['Contato', cab.contato], ['Origem', cab.origem], ['Vendedor', cab.vendedor], ['Captador', cab.captador],
    ['Agendamento', [cab.agendamento, cab.local].filter(Boolean).join(' · ')]]
  return (
    <Document title={`Briefing — ${cab.cliente}`} author="Airam Arquitetura & Marcenaria">
      <Page size="A4" style={s.pagina}>
        <View style={s.topo}>
          <Image src={logoVermelho} style={{ width: 92 }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.titulo}>Briefing do cliente</Text>
            <Text style={{ fontSize: 8, color: COR.tinta2 }}>
              {r.feito ? `Realizado por ${r.forma === 'ligacao' ? 'ligação' : 'mensagem'}${r.data ? ` em ${r.data.split('-').reverse().join('/')}` : ''}` : 'Por mensagem (  )   Ligação (  )   Data ___/___/______'}
            </Text>
          </View>
        </View>
        <View style={s.cab}>
          {itens.map(([k, v]) => (
            <View key={k} style={s.cabItem}>
              <Text style={s.rotulo}>{k}</Text>
              <Text>{v || '—'}</Text>
            </View>
          ))}
        </View>

        {PERGUNTAS_BRIEFING.map((q, n) => {
          const titulo = `${n + 1}. ${q.texto}`
          if (!q.simnao) return <Pergunta key={q.campo} titulo={titulo} valor={r[q.campo]} linhas={q.linhas} />
          const resp = r[q.campo]
          // Sim/Não com o complemento: linhas em branco só quando falta a resposta
          const extraPreenchido = resp === q.extra.quando && r[q.extra.campo]
          return (
            <Pergunta key={q.campo} titulo={titulo} valor={extraPreenchido ? r[q.extra.campo] : null}
              linhas={resp === null || resp === undefined || resp === q.extra.quando ? 1 : 0}>
              <View style={s.marca}>
                <Opcao marcada={resp === true}>Sim{q.extra.quando === true ? ` — ${q.extra.texto.toLowerCase()}` : ''}</Opcao>
                <Opcao marcada={resp === false}>Não{q.extra.quando === false ? ` — ${q.extra.texto.toLowerCase()}` : ''}</Opcao>
              </View>
            </Pergunta>
          )
        })}
        <View style={{ marginTop: 4, flexGrow: 1, minHeight: 80 }} wrap={false}>
          <Text style={s.ptitulo}>Observações do atendimento</Text>
          <View style={{ borderWidth: 0.6, borderColor: COR.linha, borderRadius: 4, flexGrow: 1 }} />
        </View>
        <View style={s.rodape} fixed>
          <Text>Airam Arquitetura & Marcenaria · airam.arq.br</Text>
          <Text>Uso interno</Text>
        </View>
      </Page>
    </Document>
  )
}

export function gerarPdfBriefing(cab, briefing) {
  return pdf(<Documento cab={cab} b={briefing} />).toBlob()
}
