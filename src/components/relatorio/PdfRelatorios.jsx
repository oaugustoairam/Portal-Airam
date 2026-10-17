// Layouts dos relatórios em PDF (gerados no navegador com @react-pdf/renderer).
// Este arquivo só é carregado quando alguém pede um relatório.
import { Document, Page, View, Text, Image, Svg, Path, Circle, Rect, Defs, LinearGradient, Stop, Font, StyleSheet, pdf } from '@react-pdf/renderer'
import { dataCurta, dataMini, dataExtenso, COLUNAS_LISTA, valorColuna } from '../../lib/relatorio.js'
import { diasEntre } from '../../lib/constants.js'
import logoBranco from '../../assets/logo-branco.png'
import logoVermelho from '../../assets/logo-vermelho.png'
import geistLight from '../../assets/fontes/Geist-Light.ttf'
import geistRegular from '../../assets/fontes/Geist-Regular.ttf'
import geistMedium from '../../assets/fontes/Geist-Medium.ttf'
import geistSemiBold from '../../assets/fontes/Geist-SemiBold.ttf'
import monoRegular from '../../assets/fontes/GeistMono-Regular.ttf'
import monoMedium from '../../assets/fontes/GeistMono-Medium.ttf'

Font.register({
  family: 'Geist',
  fonts: [
    { src: geistLight, fontWeight: 300 },
    { src: geistRegular, fontWeight: 400 },
    { src: geistMedium, fontWeight: 500 },
    { src: geistSemiBold, fontWeight: 600 },
  ],
})
Font.register({ family: 'GeistMono', fonts: [{ src: monoRegular, fontWeight: 400 }, { src: monoMedium, fontWeight: 500 }] })
Font.registerHyphenationCallback((palavra) => [palavra])

const COR = {
  marca: '#930000', marcaEscura: '#6e0000', suave: '#f7e9e9', papel: '#f4f3f1', tinta: '#161616', tinta2: '#6e6e6c',
  linha: '#e2e2df', branco: '#ffffff', grafite: '#393939', ok: '#2e6b45', okSuave: '#e6f0e9', ambar: '#9a6200', ambarSuave: '#f8efdc',
}
const EMPRESA = 'Airam Arquitetura & Marcenaria'
const RODAPE = 'Airam Guarulhos · Airam Mooca · airam.arq.br · WhatsApp (11) 98977-6738'

const s = StyleSheet.create({
  pagina: { fontFamily: 'Geist', fontSize: 9, color: COR.tinta, backgroundColor: COR.branco, paddingTop: 64, paddingBottom: 54, paddingHorizontal: 40 },
  cab: { position: 'absolute', top: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 10, borderBottomWidth: 0.6, borderBottomColor: COR.linha },
  cabLogo: { height: 18, width: 74, objectFit: 'contain' },
  mono: { fontFamily: 'GeistMono', fontSize: 7, letterSpacing: 0.8, textTransform: 'uppercase', color: COR.tinta2 },
  rodape: { position: 'absolute', bottom: 22, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 0.6, borderTopColor: COR.linha, paddingTop: 8 },
  secao: { flexDirection: 'row', alignItems: 'baseline', marginTop: 18, marginBottom: 12 },
  secaoNum: { fontFamily: 'GeistMono', fontSize: 9, color: COR.marca, marginRight: 10 },
  secaoTitulo: { fontSize: 20, fontWeight: 300, letterSpacing: -0.3 },
  card: { borderWidth: 0.6, borderColor: COR.linha, borderRadius: 6, padding: 12 },
  rotulo: { fontFamily: 'GeistMono', fontSize: 6.5, letterSpacing: 0.8, textTransform: 'uppercase', color: COR.tinta2, marginBottom: 4 },
  numeroGrande: { fontSize: 24, fontWeight: 300, letterSpacing: -0.5 },
})

function Selo({ tipo, children }) {
  const cores = {
    ok: [COR.okSuave, COR.ok], atraso: [COR.marca, COR.branco], andamento: [COR.ambarSuave, COR.ambar], neutro: [COR.papel, COR.tinta2],
  }[tipo] || [COR.papel, COR.tinta2]
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: cores[0], borderRadius: 8, paddingVertical: 2.5, paddingHorizontal: 6 }}>
      <Text style={{ fontFamily: 'GeistMono', fontSize: 6.5, letterSpacing: 0.5, textTransform: 'uppercase', color: cores[1] }}>{children}</Text>
    </View>
  )
}

function Cabecalho({ direita }) {
  return (
    <View style={s.cab} fixed>
      <Image src={logoVermelho} style={s.cabLogo} />
      <Text style={s.mono}>{direita}</Text>
    </View>
  )
}

function Rodape() {
  return (
    <View style={s.rodape} fixed>
      <Text style={[s.mono, { fontSize: 6.5 }]}>{RODAPE}</Text>
      <Text style={[s.mono, { fontSize: 6.5 }]} render={({ pageNumber, totalPages }) => `${String(pageNumber).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`} />
    </View>
  )
}

function Secao({ n, titulo, sub }) {
  return (
    <View wrap={false}>
      <View style={s.secao}>
        <Text style={s.secaoNum}>{n}</Text>
        <Text style={s.secaoTitulo}>{titulo}</Text>
      </View>
      {sub && <Text style={{ color: COR.tinta2, marginTop: -6, marginBottom: 12, fontSize: 8.5 }}>{sub}</Text>}
    </View>
  )
}

// Rosca de progresso
function Rosca({ valor, tamanho = 112 }) {
  const r = tamanho / 2 - 8
  const c = tamanho / 2
  const ang = (Math.min(99.99, valor) / 100) * Math.PI * 2
  const x = c + r * Math.sin(ang)
  const y = c - r * Math.cos(ang)
  const arco = `M ${c} ${c - r} A ${r} ${r} 0 ${ang > Math.PI ? 1 : 0} 1 ${x} ${y}`
  return (
    <View style={{ width: tamanho, height: tamanho }}>
      <Svg width={tamanho} height={tamanho}>
        <Circle cx={c} cy={c} r={r} stroke={COR.linha} strokeWidth={9} fill="none" />
        {valor > 0 && <Path d={arco} stroke={COR.marca} strokeWidth={9} fill="none" strokeLinecap="round" />}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, width: tamanho, height: tamanho, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 26, fontWeight: 300 }}>{valor}%</Text>
        <Text style={[s.mono, { fontSize: 6 }]}>concluído</Text>
      </View>
    </View>
  )
}

// ============================================================ Capa
function Capa({ r, foto, geradoEm }) {
  const { p } = r
  const H = 430
  return (
    <Page size="A4" style={{ fontFamily: 'Geist', backgroundColor: COR.branco, color: COR.tinta }}>
      <View style={{ height: H, backgroundColor: COR.tinta }}>
        {foto && <Image src={foto.src} style={{ width: '100%', height: H, objectFit: 'cover' }} />}
        <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={595} height={H}>
          <Defs>
            <LinearGradient id="sombra" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0.55} />
              <Stop offset="0.35" stopColor="#000000" stopOpacity={0.05} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.45} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={595} height={H} fill="url(#sombra)" />
        </Svg>
        <Image src={logoBranco} style={{ position: 'absolute', top: 34, left: 40, width: 120, height: 34, objectFit: 'contain' }} />
        <Text style={[s.mono, { position: 'absolute', top: 46, right: 40, color: COR.branco }]}>Relatório do processo</Text>
        <View style={{ position: 'absolute', bottom: 26, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[s.mono, { color: COR.branco }]}>{p.ambientes || 'Móveis planejados'}</Text>
          <Text style={[s.mono, { color: COR.branco }]}>Código {p.codigo}</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 40, paddingTop: 30 }}>
        <Text style={[s.mono, { color: COR.marca }]}>Gerado em {dataExtenso(geradoEm)}</Text>
        <Text style={{ fontSize: 38, fontWeight: 300, letterSpacing: -1, marginTop: 10, lineHeight: 1.1 }}>{p.cliente_nome}</Text>
        <Text style={{ fontSize: 10, color: COR.tinta2, marginTop: 8 }}>
          {[p.numero_contrato && `Contrato ${p.numero_contrato}`, p.endereco].filter(Boolean).join('  ·  ') || EMPRESA}
        </Text>

        <View style={{ flexDirection: 'row', marginTop: 26 }}>
          {[
            ['Progresso', `${r.progresso}%`],
            ['Etapa atual', r.concluido ? 'Concluído' : r.atual.nome],
            ['Prazo máximo', dataCurta(p.data_entrega_prevista)],
            ['Situação', r.situacaoEntrega.texto],
          ].map(([k, v], i) => (
            <View key={k} style={{ flex: i === 1 ? 1.5 : 1, borderTopWidth: 1.2, borderTopColor: i === 0 ? COR.marca : COR.tinta, paddingTop: 8, marginRight: i < 3 ? 14 : 0 }}>
              <Text style={s.rotulo}>{k}</Text>
              <Text style={{ fontSize: i === 0 ? 22 : 12, fontWeight: i === 0 ? 300 : 500, color: i === 3 && r.situacaoEntrega.tipo === 'atraso' ? COR.marca : COR.tinta }}>{v}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: 40, marginTop: 26 }}>
        <Text style={s.rotulo}>Etapas do processo</Text>
        <View style={{ flexDirection: 'row', marginBottom: 6, marginTop: 4 }}>
          {r.etapas.map((e) => (
            <View key={e.id} style={{ flex: 1, height: 5, marginRight: 3, borderRadius: 1,
              backgroundColor: e.status === 'concluida' ? COR.marca : e.status === 'atual' ? COR.suave : COR.papel,
              borderWidth: e.status === 'atual' ? 0.8 : 0, borderColor: COR.marca }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row' }}>
          {r.etapas.map((e) => (
            <Text key={e.id} style={{ flex: 1, marginRight: 3, fontSize: 6.3, color: e.status === 'futura' ? COR.tinta2 : COR.tinta, fontWeight: e.status === 'atual' ? 600 : 400 }}>{e.nome}</Text>
          ))}
        </View>
        {!r.concluido && (
          <View style={{ flexDirection: 'row', marginTop: 18, backgroundColor: COR.papel, borderRadius: 6, padding: 14 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.rotulo}>Agora</Text>
              <Text style={{ fontSize: 11, fontWeight: 500 }}>{r.atual.nome}</Text>
              <Text style={{ fontSize: 7.5, color: r.atual.atrasada ? COR.marca : COR.tinta2, marginTop: 3 }}>
                {r.atual.atrasada ? `Com atraso desde ${dataCurta(r.atual.data)}` : r.atual.data ? `Previsão ${dataCurta(r.atual.data)}` : 'Em andamento'}
              </Text>
            </View>
            <View style={{ flex: 1, paddingLeft: 12, borderLeftWidth: 0.6, borderLeftColor: COR.linha }}>
              <Text style={s.rotulo}>Depois</Text>
              <Text style={{ fontSize: 11, fontWeight: 500 }}>{r.proxima?.nome || 'Montagem concluída'}</Text>
              <Text style={{ fontSize: 7.5, color: COR.tinta2, marginTop: 3 }}>{r.proxima?.data ? `Previsão ${dataCurta(r.proxima.data)}` : 'A definir'}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COR.marca, paddingHorizontal: 40, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[s.mono, { color: COR.branco }]}>{EMPRESA}</Text>
        <Text style={[s.mono, { color: COR.branco }]}>airam.arq.br</Text>
      </View>
    </Page>
  )
}

// ============================================================ Linha do tempo (etapas do portal)
function LinhaDoTempo({ etapas }) {
  return (
    <View style={{ flexDirection: 'row', marginTop: 4 }} wrap={false}>
      {etapas.map((e, i) => {
        const feito = e.status === 'concluida'
        const atual = e.status === 'atual'
        return (
          <View key={e.id} style={{ flex: 1, alignItems: 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{
                width: 12, height: 12, borderRadius: 6, borderWidth: 2,
                borderColor: feito || atual ? COR.marca : COR.linha, backgroundColor: feito ? COR.marca : COR.branco,
              }} />
              {i < etapas.length - 1 && <View style={{ flexGrow: 1, height: 1.5, backgroundColor: feito ? COR.marca : COR.linha }} />}
            </View>
            <Text style={{ fontSize: 7.5, fontWeight: atual ? 600 : 500, marginTop: 7, paddingRight: 6, color: feito || atual ? COR.tinta : COR.tinta2 }}>{e.nome}</Text>
            <Text style={[s.mono, { fontSize: 6.5, marginTop: 3, color: e.atrasada ? COR.marca : COR.tinta2 }]}>
              {feito ? (e.data ? dataCurta(e.data) : 'Concluída') : atual ? (e.atrasada ? 'Atrasada' : 'Em andamento') : e.data ? `Prev. ${dataCurta(e.data)}` : 'A definir'}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// ============================================================ Cronograma (Gantt)
function Cronograma({ r }) {
  const { inicio, fim } = r.escala
  const total = Math.max(1, diasEntre(inicio, fim))
  const pos = (d) => `${Math.max(0, Math.min(100, (diasEntre(inicio, d) / total) * 100))}%`
  const larg = (a, b) => `${Math.max(0.8, (Math.max(0, diasEntre(a, b)) / total) * 100)}%`

  // marcas de mês no topo
  const meses = []
  const d = new Date(inicio + 'T00:00:00')
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  while (d.toISOString().slice(0, 10) <= fim) {
    meses.push(d.toISOString().slice(0, 10))
    d.setMonth(d.getMonth() + 1)
  }
  const ROTULO = 128
  const ALT = 15

  return (
    <View wrap={false}>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        <View style={{ width: ROTULO }} />
        <View style={{ flexGrow: 1, height: 12 }}>
          {meses.map((m) => (
            <Text key={m} style={[s.mono, { position: 'absolute', left: pos(m), fontSize: 6 }]}>
              {new Date(m + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
            </Text>
          ))}
        </View>
      </View>
      <View>
        {r.fases.map((f) => (
          <View key={f.nome} style={{ flexDirection: 'row', alignItems: 'center', height: ALT + 8 }}>
            <Text style={{ width: ROTULO, fontSize: 7.5, color: f.inicio ? COR.tinta : COR.tinta2 }}>{f.nome}</Text>
            <View style={{ flexGrow: 1, height: ALT, backgroundColor: COR.papel, borderRadius: 3 }}>
              {meses.map((m) => (
                <View key={m} style={{ position: 'absolute', left: pos(m), top: 0, bottom: 0, width: 0.5, backgroundColor: COR.linha }} />
              ))}
              {f.inicio && (
                <View style={{
                  position: 'absolute', left: pos(f.inicio), width: larg(f.inicio, f.fim), top: 2, height: ALT - 4, borderRadius: 2,
                  backgroundColor: f.emCurso ? COR.suave : COR.marca, borderWidth: f.emCurso ? 0.8 : 0, borderColor: COR.marca,
                }} />
              )}
              {f.prazo && (
                <View style={{ position: 'absolute', left: pos(f.prazo), top: -1, height: ALT + 2, width: 1.6, backgroundColor: COR.tinta }} />
              )}
              {f.inicio && f.dias !== null && (
                <Text style={[s.mono, { position: 'absolute', left: pos(f.prazo && f.prazo > f.fim ? f.prazo : f.fim), top: 4, marginLeft: 5, fontSize: 6, color: COR.tinta2 }]}>{f.dias}d</Text>
              )}
            </View>
          </View>
        ))}
        {/* hoje */}
        <View style={{ position: 'absolute', left: ROTULO, right: 0, top: 0, bottom: 0 }}>
          <View style={{ position: 'absolute', left: pos(r.hoje), top: -2, bottom: 0, borderLeftWidth: 0.8, borderLeftColor: COR.marca, borderStyle: 'dashed' }} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 10, marginLeft: ROTULO }}>
        {[
          [<View style={{ width: 14, height: 7, backgroundColor: COR.marca, borderRadius: 1.5 }} />, 'Fase concluída'],
          [<View style={{ width: 14, height: 7, backgroundColor: COR.suave, borderWidth: 0.8, borderColor: COR.marca, borderRadius: 1.5 }} />, 'Em andamento'],
          [<View style={{ width: 1.6, height: 9, backgroundColor: COR.tinta }} />, 'Prazo'],
          [<View style={{ width: 0, height: 9, borderLeftWidth: 0.8, borderLeftColor: COR.marca, borderStyle: 'dashed' }} />, `Hoje (${dataCurta(r.hoje)})`],
        ].map(([icone, t]) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
            {icone}
            <Text style={{ fontSize: 7, color: COR.tinta2, marginLeft: 5 }}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// Barras: dias em cada fase
function DiasPorFase({ fases }) {
  const comDias = fases.filter((f) => f.dias !== null)
  if (!comDias.length) return <Text style={{ color: COR.tinta2 }}>Nenhuma fase iniciada ainda.</Text>
  const max = Math.max(...comDias.map((f) => f.dias), 1)
  return (
    <View wrap={false}>
      {comDias.map((f) => (
        <View key={f.nome} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
          <Text style={{ width: 128, fontSize: 7.5 }}>{f.nome}</Text>
          <View style={{ flexGrow: 1, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: `${Math.max(1.5, (f.dias / max) * 86)}%`, height: 8, borderRadius: 2, backgroundColor: f.emCurso ? COR.suave : COR.grafite,
              borderWidth: f.emCurso ? 0.8 : 0, borderColor: COR.marca }} />
            <Text style={[s.mono, { fontSize: 7, marginLeft: 6, color: COR.tinta }]}>{f.dias} {f.dias === 1 ? 'dia' : 'dias'}{f.emCurso ? ' · em curso' : ''}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function CartaoPrazo({ titulo, regra, prazo, feito, situacao }) {
  return (
    <View style={[s.card, { flex: 1, marginRight: 8 }]} wrap={false}>
      <Text style={s.rotulo}>{titulo}</Text>
      <Text style={{ fontSize: 16, fontWeight: 300, marginBottom: 2 }}>{dataCurta(prazo)}</Text>
      <Text style={{ fontSize: 7, color: COR.tinta2, marginBottom: 8 }}>{regra}</Text>
      <Selo tipo={situacao.tipo}>{situacao.texto}</Selo>
      <Text style={{ fontSize: 7, color: COR.tinta2, marginTop: 6 }}>Realizado: {feito ? dataCurta(feito) : '—'}</Text>
    </View>
  )
}

function Dado({ k, v, largo }) {
  return (
    <View style={{ width: largo ? '100%' : '50%', paddingRight: 10, marginBottom: 9 }}>
      <Text style={s.rotulo}>{k}</Text>
      <Text style={{ fontSize: 9 }}>{v || '—'}</Text>
    </View>
  )
}

// ============================================================ PDF de um cliente
function RelatorioCliente({ r, foto, imagens, interno, geradoEm }) {
  const { p, c } = r
  const direita = `Código ${p.codigo} · ${p.cliente_nome}`
  return (
    <Document title={`Relatório ${p.codigo} — ${p.cliente_nome}`} author={EMPRESA} creator="Portal Airam" language="pt-BR">
      <Capa r={r} foto={foto} geradoEm={geradoEm} />

      <Page size="A4" style={s.pagina}>
        <Cabecalho direita={direita} />
        <Secao n="01" titulo="Visão geral" />
        <View style={{ flexDirection: 'row' }} wrap={false}>
          <View style={{ marginRight: 26, alignItems: 'center' }}>
            <Rosca valor={r.progresso} />
            <Text style={[s.mono, { marginTop: 8 }]}>{r.feitas} de {r.etapas.length} etapas</Text>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
            <Dado k="Cliente" v={p.cliente_nome} />
            <Dado k="Código / contrato" v={[p.codigo, p.numero_contrato].filter(Boolean).join(' · ')} />
            <Dado k="Ambientes" v={p.ambientes} />
            <Dado k="Tipo de prazo" v={r.tipoPrazo} />
            <Dado k="Telefone" v={p.cliente_telefone} />
            <Dado k="E-mail" v={p.cliente_email} />
            <Dado k="Endereço da obra" v={p.endereco} largo />
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 14 }} wrap={false}>
          {[
            ['Dias desde a venda', r.diasDesdeVenda ?? '—', `Venda em ${dataCurta(r.real.venda)}`],
            ['Prazo máximo', dataCurta(p.data_entrega_prevista), r.situacaoEntrega.texto],
            ['Etapa atual', r.concluido ? 'Concluído' : r.atual.nome, r.atual.atrasada ? 'Com atraso' : 'Em dia'],
            ['Solução financeira', p.solucao_financeira === 'ok' ? 'OK' : 'Pendente', r.real.pendencia ? `Resolvida em ${dataCurta(r.real.pendencia)}` : 'Aguardando'],
          ].map(([k, v, sub], i) => (
            <View key={k} style={[s.card, { flex: 1, marginRight: i < 3 ? 8 : 0, backgroundColor: i === 0 ? COR.marca : COR.branco, borderColor: i === 0 ? COR.marca : COR.linha }]}>
              <Text style={[s.rotulo, i === 0 && { color: '#f3caca' }]}>{k}</Text>
              <Text style={{ fontSize: String(v).length > 12 ? 11 : 20, fontWeight: String(v).length > 12 ? 500 : 300, color: i === 0 ? COR.branco : COR.tinta, minHeight: 24 }}>{v}</Text>
              <Text style={{ fontSize: 7, color: i === 0 ? '#f3caca' : COR.tinta2, marginTop: 4 }}>{sub}</Text>
            </View>
          ))}
        </View>

        <Secao n="02" titulo="Linha do tempo" sub="As etapas que o cliente acompanha no portal." />
        <LinhaDoTempo etapas={r.etapas} />

        <Secao n="03" titulo="Cronograma" sub="Duração real de cada fase, do início ao fim, com os prazos marcados." />
        <Cronograma r={r} />
        <Rodape />
      </Page>

      <Page size="A4" style={s.pagina}>
        <Cabecalho direita={direita} />
        <Secao n="04" titulo="Prazos" sub="Prazos internos em dias úteis, sem feriados municipais." />
        <View style={{ flexDirection: 'row' }}>
          <CartaoPrazo titulo="Conferência do projeto" regra="5 dias úteis após o liberador receber" prazo={r.prazoConferencia} feito={r.real.conferido} situacao={r.situacaoConferencia} />
          <CartaoPrazo titulo="PDF do projeto final" regra="5 dias úteis após enviar a conferência" prazo={r.prazoPdf} feito={r.real.pdf} situacao={r.situacaoPdf} />
          <CartaoPrazo titulo="Prazo máximo de entrega" regra={r.tipoPrazo || 'Contrato'} prazo={p.data_entrega_prevista} feito={r.real.entregue} situacao={r.situacaoEntrega} />
        </View>

        <Secao n="05" titulo="Dias em cada fase" />
        <DiasPorFase fases={r.fases} />

        <Secao n="06" titulo="Passo a passo" sub="Data prevista e data real de cada passo do processo." />
        <View style={{ borderTopWidth: 1, borderTopColor: COR.tinta }}>
          <View style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.6, borderBottomColor: COR.linha }}>
            {['Passo', 'Previsto', 'Realizado', interno ? 'Responsável' : ''].map((t, i) => (
              <Text key={i} style={[s.rotulo, { marginBottom: 0, width: ['40%', '18%', '18%', '24%'][i] }]}>{t}</Text>
            ))}
          </View>
          {r.marcos.map((m) => {
            const atrasado = !m.real && m.previsto && diasEntre(r.hoje, m.previsto) < 0
            return (
              <View key={m.id} style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.6, borderBottomColor: COR.linha, alignItems: 'center' }} wrap={false}>
                <View style={{ width: '40%', flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, marginRight: 7, backgroundColor: m.real ? COR.marca : COR.branco, borderWidth: 1, borderColor: m.real ? COR.marca : COR.linha }} />
                  <Text style={{ fontSize: 8.5, color: m.real ? COR.tinta : COR.tinta2 }}>{m.nome}</Text>
                </View>
                <Text style={{ width: '18%', fontFamily: 'GeistMono', fontSize: 7.5, color: atrasado ? COR.marca : COR.tinta2 }}>{m.previsto ? dataCurta(m.previsto) : '—'}</Text>
                <Text style={{ width: '18%', fontFamily: 'GeistMono', fontSize: 7.5 }}>{m.real ? dataCurta(m.real) : '—'}</Text>
                <Text style={{ width: '24%', fontSize: 8 }}>{interno && m.extra ? m.extra : ''}</Text>
              </View>
            )
          })}
        </View>
        <Rodape />
      </Page>

      {interno && (
        <Page size="A4" style={s.pagina}>
          <Cabecalho direita={direita} />
          <Secao n="07" titulo="Controle interno" sub="Uso da loja. Não compartilhe esta página com o cliente." />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Dado k="Liberador" v={c.liberador} />
            <Dado k="Liberador recebeu a medição" v={dataCurta(c.liberador_recebeu_em)} />
            <Dado k="Montador" v={c.montador} />
            <Dado k="Início da montagem" v={dataCurta(c.montagem_inicio_em)} />
            <Dado k="Tem ATT" v={c.tem_att === true ? 'Sim' : c.tem_att === false ? 'Não' : 'A definir'} />
            <Dado k="Vistoria" v={dataCurta(c.vistoria_em)} />
            <Dado k="E-mail enviado" v={dataCurta(c.email_enviado_em)} />
            <View style={{ width: '50%', marginBottom: 9 }}>
              <Text style={s.rotulo}>Assistência · retorno máximo</Text>
              <Text style={{ fontSize: 9, marginBottom: 3 }}>{dataCurta(c.assistencia_retorno_max)}</Text>
              {r.situacaoAssistencia && <Selo tipo={r.situacaoAssistencia.tipo}>{r.situacaoAssistencia.texto}</Selo>}
            </View>
          </View>
          {c.observacoes && (
            <View style={[s.card, { backgroundColor: COR.papel, borderColor: COR.papel, marginTop: 6 }]} wrap={false}>
              <Text style={s.rotulo}>Observações internas</Text>
              <Text style={{ fontSize: 9, lineHeight: 1.5 }}>{c.observacoes}</Text>
            </View>
          )}
          {c.atualizado_em && (
            <Text style={[s.mono, { marginTop: 10, fontSize: 6.5 }]}>Última alteração do controle: {dataCurta(c.atualizado_em)}{c.atualizado_por ? ` por ${c.atualizado_por}` : ''}</Text>
          )}

          <Secao n="08" titulo="Documentos do processo" />
          {r.documentos.length ? (
            <View style={{ borderTopWidth: 1, borderTopColor: COR.tinta }}>
              {r.documentos.map((d) => (
                <View key={d.id} style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.6, borderBottomColor: COR.linha }} wrap={false}>
                  <Text style={{ width: '24%', fontFamily: 'GeistMono', fontSize: 7, color: COR.tinta2, textTransform: 'uppercase' }}>{d.categoriaNome}</Text>
                  <Text style={{ width: '60%', fontSize: 8.5 }}>{d.titulo}{d.assinado ? '  (assinado)' : ''}</Text>
                  <Text style={{ width: '16%', fontFamily: 'GeistMono', fontSize: 7.5, textAlign: 'right' }}>{dataCurta(d.criado_em)}</Text>
                </View>
              ))}
            </View>
          ) : <Text style={{ color: COR.tinta2 }}>Nenhum documento anexado.</Text>}
          <Rodape />
        </Page>
      )}

      {imagens.length > 0 && (
        <Page size="A4" style={s.pagina}>
          <Cabecalho direita={direita} />
          <Secao n={interno ? '09' : '07'} titulo="Projeto" sub="Imagens anexadas ao processo." />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {imagens.map((img, i) => (
              <View key={i} style={{ width: imagens.length === 1 ? '100%' : '48.5%', marginBottom: 14 }} wrap={false}>
                <Image src={img.src} style={{ width: '100%', height: imagens.length === 1 ? 340 : 170, objectFit: 'cover', borderRadius: 4 }} />
                <Text style={{ fontSize: 8, marginTop: 5 }}>{img.titulo}</Text>
                <Text style={[s.mono, { fontSize: 6, marginTop: 2 }]}>{img.categoria}</Text>
              </View>
            ))}
          </View>
          <Rodape />
        </Page>
      )}
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
      <Page size="A4" orientation="landscape" style={[s.pagina, { paddingHorizontal: 32 }]}>
        <View style={[s.cab, { left: 32, right: 32 }]} fixed>
          <Image src={logoVermelho} style={s.cabLogo} />
          <Text style={s.mono}>Relatório de processos · {dataCurta(geradoEm)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
          <View>
            <Text style={[s.mono, { color: COR.marca }]}>Gerado em {dataExtenso(geradoEm)}</Text>
            <Text style={{ fontSize: 24, fontWeight: 300, letterSpacing: -0.5, marginTop: 4 }}>Prazos e datas dos processos</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {[['Processos', linhas.length], ['Com atraso', atrasados], ['Progresso médio', `${media}%`], ['Prazo em 30 dias', proximos]].map(([k, v], i) => (
              <View key={k} style={{ marginLeft: 22, borderTopWidth: 1.2, borderTopColor: i === 1 && atrasados ? COR.marca : COR.tinta, paddingTop: 5, minWidth: 60 }}>
                <Text style={s.rotulo}>{k}</Text>
                <Text style={{ fontSize: 18, fontWeight: 300, color: i === 1 && atrasados ? COR.marca : COR.tinta }}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', backgroundColor: COR.tinta, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 3 }} fixed>
          {COLUNAS_PDF.map(([k, t]) => (
            <Text key={k} style={{ width: LARGURAS[k] || 44, flexGrow: k === 'cliente' ? 1 : 0, paddingRight: 4, fontFamily: 'GeistMono', fontSize: 5.8, letterSpacing: 0.4, textTransform: 'uppercase', color: COR.branco }}>{t}</Text>
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
                    <Text style={{ fontFamily: 'GeistMono', fontSize: 6.5, marginTop: 2 }}>{l.progresso}%</Text>
                  </View>
                )
              if (k === 'situacao')
                return <View key={k} style={w}><Selo tipo={l.situacao.tipo}>{l.situacao.texto}</Selo></View>
              if (k === 'cliente')
                return (
                  <View key={k} style={w}>
                    <Text style={{ fontSize: 7.5, fontWeight: 500 }}>{l.cliente}</Text>
                    {l.ambientes ? <Text style={{ fontSize: 6.3, color: COR.tinta2, marginTop: 1 }}>{l.ambientes}</Text> : null}
                  </View>
                )
              const vencido = (k === 'prazoConferencia' && !l.conferido) || (k === 'prazoPdf' && !l.pdf) || (k === 'prazoMaximo' && !l.entregue)
              const atrasado = vencido && l[k] && diasEntre(geradoEm, l[k]) < 0
              return (
                <Text key={k} style={[w, {
                  fontFamily: tipo === 'data' || k === 'codigo' ? 'GeistMono' : 'Geist', fontSize: tipo === 'data' ? 6.8 : 7.3,
                  color: atrasado ? COR.marca : COR.tinta, fontWeight: k === 'codigo' || atrasado ? 600 : 400,
                }]}>{valorColuna(l, col, dataMini)}</Text>
              )
            })}
          </View>
        ))}
        <Text style={{ fontSize: 7, color: COR.tinta2, marginTop: 10 }}>
          Datas em vermelho: prazo vencido sem a etapa concluída. Prazos de conferência e PDF: 5 dias úteis cada, sem feriados municipais.
        </Text>
        <View style={[s.rodape, { left: 32, right: 32 }]} fixed>
          <Text style={[s.mono, { fontSize: 6.5 }]}>{RODAPE}</Text>
          <Text style={[s.mono, { fontSize: 6.5 }]} render={({ pageNumber, totalPages }) => `${String(pageNumber).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`} />
        </View>
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
