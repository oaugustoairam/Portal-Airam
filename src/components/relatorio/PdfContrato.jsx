// Contrato de compra e venda no modelo da loja (mesmo layout e mesmo texto do contrato da Airam).
// Só os dados do cliente, ambientes e pagamento mudam.
import { Document, Page, View, Text, Image, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import logo from '../../assets/contrato/logo.png'
import cubo from '../../assets/contrato/cubo.png'
import { descricaoAmbiente, valorBR, dataBR, totalContrato, condicaoTexto, enderecoLinha, num } from '../../lib/contrato.js'

// sem hifenizar palavras no fim da linha, como no contrato original
Font.registerHyphenationCallback((palavra) => [palavra])

const EMPRESA = 'CSC COMÉRCIO DE MÓVEIS PLANEJADOS EIRELI'
const LINHA = '#000'
const s = StyleSheet.create({
  pagina: { paddingTop: 128, paddingBottom: 46, paddingHorizontal: 28, fontFamily: 'Helvetica', fontSize: 7.4, color: '#000' },
  moldura: { position: 'absolute', top: 28, bottom: 28, left: 28, right: 28, borderLeftWidth: 0.6, borderRightWidth: 0.6, borderColor: LINHA },
  cab: { position: 'absolute', top: 28, left: 28, right: 28, height: 100, flexDirection: 'row', borderTopWidth: 0.6, borderBottomWidth: 0.6, borderColor: LINHA },
  cabLogo: { width: 112, alignItems: 'center', justifyContent: 'center', borderRightWidth: 0.6, borderColor: LINHA },
  cabCentro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cabTexto: { fontSize: 7, lineHeight: 1.75, textAlign: 'center' },
  cabNumero: { width: 128, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 0.6, borderColor: LINHA },
  rodape: { position: 'absolute', bottom: 30, right: 40, fontSize: 7.4 },
  rotulo: { fontFamily: 'Helvetica-Bold', fontSize: 7.4 },
  linha: { flexDirection: 'row', borderBottomWidth: 0.6, borderColor: LINHA },
  cel: { paddingHorizontal: 2, paddingVertical: 1.6 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 7.4, textAlign: 'center', paddingVertical: 1.8 },
  barra: { flexDirection: 'row', backgroundColor: '#d9d9d9', borderTopWidth: 1.4, borderBottomWidth: 0.6, borderColor: LINHA },
  clausula: { fontSize: 10.6, lineHeight: 1.25, paddingHorizontal: 12 },
  titulo: { fontFamily: 'Helvetica-Bold', fontSize: 10.6, marginTop: 4, marginBottom: 2 },
  item: { fontSize: 8.6, marginTop: 4 },
  corpo: { fontSize: 10.6, lineHeight: 1.25, marginLeft: 34, marginTop: 2 },
})

function Cabecalho({ numero }) {
  return (
    <>
      <View style={s.moldura} fixed />
      <View style={s.cab} fixed>
        <View style={s.cabLogo}><Image src={logo} style={{ width: 82, height: 60 }} /></View>
        <View style={s.cabCentro}>
          <Text style={s.cabTexto}>
            {EMPRESA}{'\n'}CNPJ: 50.599.252/0001-57{'\n'}Rua dos Cubas , 127 - Altura 500 da Av Paulo Faccini{'\n'}
            Jardim São Paulo-Guarulhos-SP{'\n'}TELEFONE: (11) 94088-7123 / (11)2447-1006{'\n'}www.airam.arq.br{'\n'}diretoria@airam.arq.br
          </Text>
        </View>
        <View style={s.cabNumero}>
          <Image src={cubo} style={{ width: 38, height: 36, marginBottom: 6 }} />
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9.4 }}>CONTRATO N.o</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9.4, marginTop: 2 }}>{numero}</Text>
        </View>
      </View>
      <Text style={s.rodape} fixed render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`} />
    </>
  )
}

// Linha de rótulos em negrito + linha de valores, como no contrato
function Campos({ itens }) {
  return (
    <>
      <View style={s.linha}>
        {itens.map(([r, , w], i) => <Text key={i} style={[s.cel, s.rotulo, { width: w, flexGrow: w ? 0 : 1 }]}>{r}</Text>)}
      </View>
      <View style={s.linha}>
        {itens.map(([, v, w], i) => <Text key={i} style={[s.cel, { width: w, flexGrow: w ? 0 : 1 }]}>{v || ' '}</Text>)}
      </View>
    </>
  )
}

const C1 = 193 // largura das colunas do quadro do cliente (como no original)
const C2 = 133
const C3 = 60

function Pagina1({ k }) {
  const c = k.cliente
  const e = c.endereco
  const ent = k.entregaIgual ? e : k.entrega
  const nomeCliente = `${k.codigo ? `${k.codigo} - ` : ''}${c.nome.toUpperCase()}`
  const amb = k.ambientes
  const W = [24, 26, 152, 128, 92, 34, 0]
  return (
    <View>
      <Campos itens={[['RESPONSÁVEL PELA VENDA', k.responsavel, C1 + C2 / 2 + 26], ['LOJA', k.loja, 0], ['DATA DO CONTRATO', dataBR(k.data), 128]]} />
      <Campos itens={[['CLIENTE', nomeCliente, 0], ['TIPO DE CONTRATO', k.tipo, 128]]} />
      <Campos itens={[['CPF/CNPJ', c.cpf, C1], ['R.G / INSCRIÇÃO ESTADUAL', c.rg, 0], ['DATA DE NASCIMENTO', dataBR(c.nascimento), 128]]} />
      <Campos itens={[['FILIAÇÃO (NOME DA MÃE)', c.mae, 0], ['SEXO', c.sexo === 'F' ? 'Feminino' : c.sexo === 'M' ? 'Masculino' : '', 128]]} />
      <Campos itens={[['ENDEREÇO ATUAL', enderecoLinha(e), 0]]} />
      <Campos itens={[['BAIRRO', e.bairro, C1], ['CIDADE', e.cidade, C2 + C3 + 24], ['UF', e.uf, C3], ['CEP', e.cep, 0]]} />
      <Campos itens={[['TELEFONE', [c.telefone1, c.telefone2].filter(Boolean).join(' / '), C1], ['PROFISSÃO', c.profissao, C2 + C3 + 24], ['E-MAIL', c.email, 0]]} />
      <Campos itens={[['ENDEREÇO DE ENTREGA', enderecoLinha(ent) + (ent.edificio ? ` - Ed. ${ent.edificio}` : ''), C1 + C2 + C3 + 24], ['PRAZO ENTREGA', 'Em dias úteis conforme ambientes', 0]]} />
      <Campos itens={[['BAIRRO', ent.bairro, C1], ['CIDADE', ent.cidade, C2 + C3 + 24], ['UF', ent.uf, C3], ['CEP', ent.cep, 0]]} />
      {!k.entregaIgual && k.entrega.referencia ? <Campos itens={[['REFERÊNCIA', k.entrega.referencia, 0]]} /> : null}

      <View style={[s.barra, { marginTop: 4 }]}>
        {['ITEM', 'QTD', 'DESCRIÇÃO AMBIENTE/ PRODUTO', 'FORNECEDOR', 'LINHA', 'PRAZO', 'VALOR'].map((t, i) => (
          <Text key={t} style={[s.th, { width: W[i] || undefined, flexGrow: W[i] ? 0 : 1 }, t === 'VALOR' && { textAlign: 'right', paddingRight: 3 }]}>{t}</Text>
        ))}
      </View>
      {amb.map((a, i) => (
        <View key={i} style={s.linha} wrap={false}>
          <Text style={[s.cel, { width: W[0], textAlign: 'center' }]}>{i + 1}</Text>
          <Text style={[s.cel, { width: W[1], textAlign: 'right' }]}>{valorBR(num(a.qtd) || 1)}</Text>
          <Text style={[s.cel, { width: W[2] }]}>{descricaoAmbiente(a, i)}</Text>
          <Text style={[s.cel, { width: W[3] }]}>{a.fornecedor}</Text>
          <Text style={[s.cel, { width: W[4] }]}>{a.linha}</Text>
          <Text style={[s.cel, { width: W[5], textAlign: 'center' }]}>{a.prazo}</Text>
          <Text style={[s.cel, { flexGrow: 1, textAlign: 'right' }]}>{valorBR(num(a.valor) * (num(a.qtd) || 1))}</Text>
        </View>
      ))}
      <View style={[s.linha, { justifyContent: 'flex-end' }]}>
        <Text style={[s.cel, { width: 120, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>Total do pedido:</Text>
        <Text style={[s.cel, { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{valorBR(totalContrato(k))}</Text>
      </View>

      <View style={[s.barra, { marginTop: 8 }]}>
        {[['ITEM', 24], ['CORPO', 100], ['PORTA', 94], ['PUXADOR', 94], ['COMPLEMENTO', 103], ['MODELO', 0]].map(([t, w]) => (
          <Text key={t} style={[s.th, { width: w || undefined, flexGrow: w ? 0 : 1 }]}>{t}</Text>
        ))}
      </View>
      {amb.map((a, i) => (
        <View key={i} style={s.linha} wrap={false}>
          <Text style={[s.cel, { width: 24, textAlign: 'center', fontSize: 6.6 }]}>{i + 1}</Text>
          {[['corpo', 100], ['porta', 94], ['puxador', 94], ['complemento', 103], ['modelo', 0]].map(([kk, w]) => (
            <Text key={kk} style={[s.cel, { width: w || undefined, flexGrow: w ? 0 : 1, fontSize: 6.6 }]}>{String(a[kk] || '').toUpperCase()}</Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function Pagina2({ k }) {
  const p = k.pagamento
  const par = p.parcelas
  const metade = Math.ceil(par.length / 2)
  const cols = [['PC', 18], ['VENC', 48], ['VALOR', 50], ['BCO', 22], ['AG.', 22], ['CC', 32], ['CHEQUE', 0]]
  const obs = [...k.ambientes.map((a, i) => (a.observacoes ? `${letra2(i)} ${a.observacoes}` : null)), k.observacao || null].filter(Boolean)
  const Metade = ({ ini }) => (
    <View style={{ flex: 1, borderRightWidth: ini === 0 ? 1.2 : 0, borderColor: LINHA }}>
      {Array.from({ length: metade }, (_, j) => {
        const idx = ini === 0 ? j * 2 : j * 2 + 1
        const x = par[idx]
        return (
          <View key={j} style={s.linha}>
            {cols.map(([t, w], ci) => (
              <Text key={t} style={[s.cel, { width: w || undefined, flexGrow: w ? 0 : 1, borderRightWidth: ci < cols.length - 1 ? 0.6 : 0, borderColor: LINHA,
                textAlign: ci === 2 ? 'right' : ci === 0 ? 'center' : 'left', minHeight: 11 }]}>
                {x ? (ci === 0 ? idx + 1 : ci === 1 ? dataBR(x.venc) : ci === 2 ? valorBR(x.valor) : '') : ''}
              </Text>
            ))}
          </View>
        )
      })}
    </View>
  )
  return (
    <View break>
      <View style={[s.linha, { borderTopWidth: 0.6 }]}>
        <Text style={[s.cel, s.rotulo, { width: 24 }]}>AMB</Text>
        <Text style={[s.cel, s.rotulo]}>OBSERVAÇÃO</Text>
      </View>
      {obs.map((o, i) => <View key={i} style={s.linha}><Text style={[s.cel, { paddingLeft: 26 }]}>{o}</Text></View>)}
      <View style={[s.barra, { marginTop: 2 }]}>
        <Text style={[s.th, { flex: 1 }]}>TOTAL A PRAZO</Text>
        <Text style={[s.th, { flex: 1.4 }]}>CONDIÇÃO DE PAGAMENTO</Text>
        <Text style={[s.th, { flex: 1.2 }]}>FORMA DE PAGAMENTO</Text>
      </View>
      <View style={s.linha}>
        <Text style={[s.cel, { flex: 1, textAlign: 'center', fontFamily: 'Helvetica-Bold' }]}>{valorBR(totalContrato(k))}</Text>
        <Text style={[s.cel, { flex: 1.4, textAlign: 'center' }]}>{condicaoTexto(p.condicao)}</Text>
        <Text style={[s.cel, { flex: 1.2, textAlign: 'center' }]}>{p.forma}</Text>
      </View>
      <View style={[s.barra, { marginTop: 6, backgroundColor: '#fff' }]}>
        {[0, 1].map((m) => (
          <View key={m} style={{ flex: 1, flexDirection: 'row', borderRightWidth: m === 0 ? 1.2 : 0, borderColor: LINHA }}>
            {cols.map(([t, w]) => <Text key={t} style={[s.th, { width: w || undefined, flexGrow: w ? 0 : 1 }]}>{t}</Text>)}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Metade ini={0} />
        <Metade ini={1} />
      </View>
      <Assinaturas k={k} margem={60} />
      {k.substitui ? <Substitui k={k} /> : null}
    </View>
  )
}
const letra2 = (i) => descricaoAmbiente({ descricao: '' }, i).replace(/-$/, '')

function Assinaturas({ k, margem }) {
  const nome = `${k.codigo ? `${k.codigo} - ` : ''}${k.cliente.nome.toUpperCase()}`
  return (
    <View style={{ flexDirection: 'row', marginTop: margem, paddingHorizontal: 10 }} wrap={false}>
      <View style={{ flex: 1, marginRight: 24, borderTopWidth: 0.6, borderColor: LINHA, paddingTop: 4 }}>
        <Text style={{ textAlign: 'center' }}>Contratada: {EMPRESA}</Text>
      </View>
      <View style={{ flex: 1, borderTopWidth: 0.6, borderColor: LINHA, paddingTop: 4 }}>
        <Text style={{ textAlign: 'center' }}>Contratante: {nome}</Text>
      </View>
    </View>
  )
}

const Substitui = ({ k }) => (
  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9.4, textAlign: 'center', marginTop: 18 }}>
    ESTE CONTRATO CANCELA E SUBSTITUI O DE NÚMERO: {k.substitui}{k.substituiData ? `  DE  ${dataBR(k.substituiData)}` : ''}.
  </Text>
)

// ------------------------------------------------------------------ cláusulas (texto do contrato da loja)
const B = ({ children }) => <Text style={{ fontFamily: 'Helvetica-Bold' }}>{children}</Text>

function clausulas(k) {
  const total = `R$ ${valorBR(totalContrato(k))}`
  const cond = condicaoTexto(k.pagamento.condicao)
  return [
    ['CLÁUSULA 1 - OBJETO / PROJETO', [
      ['1.1', <>Compra e venda de bens móveis planejados, projeto e montagem de acordo com as medidas e especificações fornecidas exclusivamente pela <B>CONTRATANTE</B>, sendo facultado À <B>CONTRATADA</B> conferi-las no local de montagem antes da finalização do projeto apresentado.</>],
      ['1.2', <>O projeto inicial consiste na representação gráfica e escrita com orçamento dos móveis que serão realizados em caráter personalíssimo a pedido do <B>CONTRATANTE,</B> excluindo-se qualquer hipótese de instalações e remoções de quaisquer naturezas, senão a instalação e montagem dos móveis de acordo com o projeto final, previamente estabelecido e assinado.{'\n\n'}<B>Observação:</B> O local de montagem deverá estar livre e desembaraçado de quaisquer objetos, exceto eletroeletrônicos, eletrodomésticos e quaisquer outros utencílios que serão embutidos nos móveis. Na hipótese de não observância dessa exigencia pelo CONTRATANTE e havendo necessidade de novo agendamento, o início da montagem para data futura será cobrada taxa de visita técnica no valor de R$250,00 (Duzentos e Cinquenta Reais)</>],
      ['1.2.1', 'O prazo de entrega dos moveis adquirido ao empreendimento predeterminado na época da medição esta ligado diretamente a escolha do cliente. Ficando o mesmo livre para escolher aonde os moveis adquiridos e especificados seja entregue.'],
      ['1.3', 'Declara o CONTRATANTE neste ato que analisará todas as fases de elaboração do projeto inicial até aprovação do projeto final. Estando ciente que as peças enviadas a titulo de complementação de montagem para finalização da obra, pertencem a CONTRATADA sendo certo, caso haja sobras seu retorno não implicará qualquer devolução monetária.'],
      ['1.4', 'Autoriza e compromete-se a CONTRATANTE na hipótese de modificação do projeto final, durante a montagem, por sua conveniência e solicitação, a CONTRATADA emitir titulo de cobrança dos valores previamente acordados em decorrência de tal alteração, sem necessidade de qualquer notificação extrajudicial, para o efetivo pagamento.'],
    ]],
    ['CLÁUSULA 2 - BENS', [
      ['2.1', 'A Empresa CONTRATADA compromete-se através do presente contrato após analise/aprovação de credito e condições de pagamento via financeira a projetar, solicitar a fabricação, entregar e montar os móveis discriminados no projeto anexo devidamente aprovado pela CONTRATANTE, os quais fazem parte integrante deste instrumento.'],
      ['2.2', 'Não estão incluídos nos projetos, o fornecimento de qualquer objeto de decoração, pedras e granito, eletrodoméstico, eletroeletrônico e demais utensílios utilizados para composição ilustrativa, que por ventura esteja no demonstrativo.'],
    ]],
    ['CLÁUSULA 3 - ENTREGA / MONTAGEM / PÓS MONTAGEM', [
      ['3.1', 'O prazo de entrega dos bens descritos no (s) anexo (s) terá previsão de 45 dias utéis, iniciando-se a contagem a partir de segundo dia útil após assinatura do projeto final. As entregas somente são realizadas de segunda a sexta feiras, em horário comercial (09:00h Às 17:00h). Prazo para a medição de até 10 dias após agendamento, prazo para apresentação do projeto final de até 10 dias utéis após a medição.'],
      ['3.1.1', 'O prazo em questão esta diretamente ligado a entrega do empreendimento finalizado pelo cliente, junto com as questões descritas no item (1.2.1)'],
      ['3.2', 'Caso o projeto aprovado seja modificado, por diferença de medidas, pedido ou mediante autorização do(a) CONTRATANTE, durante sua execução, poderá a CONTRATADA emitir, a qualquer tempo, o título correspondente a diferença de preço, ficando, para tanto, desde já autorizada.'],
      ['3.3', '3.1. A contratada dará inicio a montagem em até 07 dias úteis após a entrega e a conclusão em até 10 dias úteis. Caso o contratante queira apenas receber a mercadoria e postergar a montagem enviar por escrito a contratada. E havendo a necessidade de mais dias de montagem, a CONTRATADA deverá informar por escrito ao CONTRATANTE.'],
      ['3.4', 'Após a conclusão da montagem e conferencia pela CONTRATANTE mediante assinatura do Termo de Vistoria de Obra, será de inteira responsabilidade desta, os danos posteriores causados, inclusive por terceiros como (pedreiros, gesseiros, encanadores, marceneiros, pintores, eletricista e etc.), seja a que título for.'],
      ['3.5', 'Na hipótese de armazenamento dos móveis pela CONTRATADA por prazo superior ao descrito na cláusula 3.1'],
      ['3.5.1', 'Por manifestação escrita do CONTRATANTE, ou não poder receber os móveis após o contato, terá um prazo de no máximo (10 dez) dias corridos a contar da data do contato para receber os móveis. Passando-se esse prazo, a CONTRATADA cobrará como despesa de armazenamento o valor de R$100,00 (Cem Reais) por dia, até a efetiva entrega. Caso a transportadora for até o local para efetuar a entrega e o cliente por algum motivo não receber, haverá uma taxa de re-entrega. Nesse caso a nova data de entrega e montagem deverá respeitar uma nova programação da logística da CONTRATADA.'],
      ['3.6', 'A garantia aos móveis será prestada pela CONTRATADA nos termos do Código de Defesa do Consumidor.'],
    ]],
    ['CLÁUSULA 4 - PREÇO / CONDIÇÕES DE PAGAMENTO / MORA POR ATRASO', [
      ['4.1', `4.1. O preço do (s) projeto (s) anexo (s) é de ${total}, que serão pagos pelo CONTRATANTE de acordo com as seguintes condições:`],
      ['4.2', `Condições de pagamento: ${cond}. Sujeito À aprovação de crédito. Prazo para aprovação financeira 05 dias uteis.`],
      ['4.3', 'No caso de pagamento em atraso das parcelas descritas no item 4.2 serão acrescidas de multa de 10% (Dez) por cento e juros de 1% (um) por cento mora/dia mais correção monetária, até o limite máximo de 90 dias, após este prazo as parcelas vincendas, venceram antecipadamente podendo ser executadas sem necessidade de qualquer notificação extrajudicial ou interpelação judicial.'],
      ['4.4', 'O (A) CONTRATANTE está ciente de que o crédito referente a venda parcelada poderá ser cedido a uma instituição financeira, que ficará sub-rogada em todos os direitos provenientes da citada cessão de crédito, ou qualquer outra modalidade de crédito.'],
    ]],
    ['CLÁUSULA 5 - DESISTÊNCIA / RESCISÃO CONTRATUAL', [
      ['5.1', 'Por liberalidade da CONTRATADA em caso de cancelamento o CONTRATANTE pagará a importância de 30% (trinta por cento), do valor total da venda, À título de custos operacionais. Após implantação do pedido na fábrica, ou seja, já produzido ou em produção, o CONTRATANTE pagará a importância de 70% ( Setenta por cento) do valor total da venda.'],
      ['5.2', 'O presente instrumento poderá ser considerado rescindido de pleno direito, a qualquer momento independente de notificação ou interpelação judicial / extrajudicial, devendo a parte que deu causa descrever com carta de próprio punho seus motivos e reais interesses de sua solicitação de desistência de sua aquisição.'],
    ]],
    ['CLÁUSULA 6 - DAS CONDIÇÕES PARA ENTREGA FUTURA', [
      ['6.1', 'Em se tratando de venda de produtos e serviços com previsão de ENTREGA FUTURA, levando em conta que a elaboração do projeto inicial e especificações serão feitas pela CONTRATADA ou por suas empresas parceiras com base no projeto de construção ou reforma, antes da conclusão da obra, fica estabelecido que se por ocasião da confirmação das medidas na obra finalizada forem constatadas divergências, ou se o (a) CONTRATANTE optar em fazer alterações no projeto deverá mediante documento formal solicitar medição e elaboração do projeto final, podendo haver reavaliação do valor total do contrato, bem como o prazo de entrega e instalação dos produtos que se iniciará na data de aprovação do projeto final sendo certo que será cobrado uma taxa de visita no valor de R$ 200,00 (duzentos reais) após a segunda visita pelo (a) CONTRATANTE.'],
      ['6.2', 'Havendo desistência do negócio pelo (a) CONTRATANTE, na hipótese de venda de produtos e serviços nesta modalidade, e considerando que a contratação se deu dentro do estabelecimento comercial onde o (a) CONTRATANTE visualizou o mobiliário em demonstração, a CONTRATADA descontará 30% (trinta por cento) do valor total do contrato, pelas despesas geradas, tais como: prestação de serviços e custos de execução com profissionais especializados, na consonância do Código de Defesa do Consumidor.'],
    ]],
    ['CLÁUSULA 7 - DISPOSIÇÕES GERAIS', [
      ['7.1', 'A mera tolerância da CONTRATADA em relação Às cláusulas e condições do presente instrumento, ou mesmo o retardamento da exigibilidade de direitos, não importará em precedente, novação ou alteração contratual, cujos termos continuarão exigíveis a qualquer tempo.'],
      ['7.2', 'O presente instrumento obriga as partes signatárias, seus sucessores e herdeiros, em todas as suas cláusulas, termos e condições, respondendo a parte infratora por perdas e danos, custas processuais, honorários advocatícios e demais cominações cabíveis a espécie.'],
      ['7.3', 'Fica consignado que os títulos vencíveis do presente avençam, estará em poder do financeiro da CONTRATADA, sendo vedadas Às partes inclusões ou alterações de qualquer natureza mesmo que parciais, os quais só poderão ser exigidos na eventualidade de inadimplemento, mediante a via executiva própria.'],
      ['7.4', 'A nulidade total ou parcial de qualquer cláusula ou condição prevista neste instrumento e seus anexos não afetará nem desobrigará o cumprimento das demais, que continuarão vigentes para todos os seus efeitos legais.'],
      ['7.5', 'Na forma do artigo 368 do Código Civil em vigor, a CONTRATADA e o CONTRATANTE estão autorizados a procederem À compensação, independentemente de qualquer formalidade, entre qualquer débito decorrente deste instrumento com qualquer crédito vencido ou por vencer que tenham ou venham a ter reciprocamente em razão de inadimplemento contratual.'],
    ]],
    ['CLÁUSULA 8 - DAS OBRIGAÇÕES DAS PARTES', [
      ['8.1', 'Constituem obrigações do CONTRATANTE:'],
      ['8.2', 'Disponibilizar antes do início da montagem dos móveis diretamente ao técnico-montador as plantas hidráulicas, elétrica, de aquecimento, de refrigeração, de gás, de redes de informática e demais informações necessárias estruturais a demonstrar de forma clara e precisa inclusive indicando os locais exatos de quaisquer impedimentos que se encontrem instalados nas paredes que servirão para montagem dos móveis e em suas proximidades, sob pena de isenção de responsabilidade da CONTRATADA por quaisquer danos no imóvel e demais utensílios. Na eventualidade do montador constatar no ato da montagem que o imóvel parede e piso se encontrar com problemas de desníveis de ponto comunicar o contratante sobre os problemas existentes afim o qual dará ciência por escrito se responsabizando, por eventuais problemas futuros no que diz respeito a montagem não podendo responsabilizar o contratante por tais problemas.'],
      ['8.3', 'Disponibilizar acompanhamento no local da montagem nos dias e horários previamente estabelecidos com a CONTRATADA para a execução dos serviços.'],
      ['8.4', 'Na impossibilidade de disponibilização física deverá a CONTRATANTE com antecedência mínima de 05 (cinco) dias da assinatura do projeto final entregar a CONTRATADA as medidas exatas dos eletroeletrônicos, eletrodomésticos e/ou quaisquer outros utensílios que serão embutidos nos móveis, sob pena pagamento do custo de eventual modificação na fabricação dos móveis.'],
      ['8.5', '9.1. Nos casos em que as paredes de instalação dos móveis forem feitas de material denominado Dry Wall (gesso), fornecer as buchas especiais, mão-francesa e os suportes, devendo tais materiais estar no local de montagem À disposição do técnico-montador no início da montagem.'],
      ['8.6', 'Constituem obrigações da CONTRATADA:'],
      ['8.7', 'Atender dentro dos prazos convencionados no pedido de compra e venda as solicitações do CONTRATANTE no tocante a entrega e montagem dos móveis descritos no presente instrumento.'],
      ['8.8', 'Dentro do prazo legal 90 (noventa) dias, sanar eventuais defeitos de fabricação através da assistência técnica fornecida pelo fabricante no prazo 45 dias úteis a contar do primeiro dia útil da notificação do CONTRATANTE À CONTRATADA.'],
      ['8.9', 'Executar a montagem dos móveis obedecendo rigorosamente os parâmetros técnicos fornecidos pelo fabricante.'],
      ['8.10', 'Prestar quaisquer informações ao CONTRATANTE referente ao produto adquirido no prazo máximo de 05 (cinco) dias contados do dia seguinte À solicitação.'],
    ]],
    ['CLÁUSULA 9 - ASSISTÊNCIA TÉCNICA', [
      ['9.1', 'A CONTRATADA se responsabiliza por eventuais defeitos de fabricação e ou montagem do produto pelo prazo legal de 90 (noventa) dias, após assinatura do Termo de Encerramento de Obra, sem ônus para a CONTRATANTE.'],
      ['9.2', 'Os serviços de assistência técnica serão realizados pela CONTRATADA, no prazo de até 45 (quarenta e cinco) dias úteis, mediante a elaboração de prévio relatório (check list) apontando todas as peças a serem corrigidas ou substituídas. Quando tratar-se de produtos fora de linha, as partes deverão pactuar novo prazo.'],
    ]],
    ['CLÁUSULA 10 - GARANTIA', [
      ['10.1', 'Garantia da madeira 10 anos. Acessórios e Ferragens como dobradiças, corrediças, puxadores e etc; terão garantia de 01 (hum) ano a contar da data de instalação.'],
      ['10.2', 'A garantia será cessada automaticamente quando os módulos forem montados ou desmontados por pessoa ou técnico não credenciado pela CONTRATADA.'],
      ['10.3', 'A CONTRATANTE declara-se ciente de que os desgastes naturais e decorrentes do uso, infiltrações de água, infestação de cupins e outras pragas, bem como a utilização inadequada dos produtos, não estão cobertos pela garantia.'],
      ['10.4', 'A CONTRATADA não está autorizada a proceder com serviços elétricos, hidráulicos, de gás, ligações de telefone, pontos de internet, etc., ficando sob a responsabilidade da CONTRATANTE a contratação de profissionais especializados, já que eventuais avarias decorrentes de tais fatores igualmente não estão cobertas pela garantia.'],
      ['10.5', 'Os serviços de assistência técnica com prazo expirado de acordo com a clausula 10.1 serão executados após a vistoria previa do técnico enviado pela CONTRATADA e será realizado após aprovação financeira do cliente mediante a tabela de custo na loja.'],
      ['10.6', 'Em se tratando de PRODUTOS DE MOSTRUÁRIO, os defeitos e avarias não terão cobertura pela garantia. Na compra de produtos de mostruário, a CONTRATANTE declara ter previamente verificado o seu estado e tomado ciência dos defeitos e avarias existentes, tendo a CONTRATADA lhe prestado as informações necessárias através de projeto executivo impresso.'],
    ]],
    ['CLÁUSULA 11 - DA IMAGEM', [
      ['11.1', 'O CONTRATANTE autorizada a execução a edição e montagem de fotos e filmagens, conduzindo as reproduções que entender necessárias a CONTRATADA, bem como a produzir os respectivos materiais de comunicação, e publicidade interna e externa e redes sociais, dentro dos padrões ético, respeitando sempre e exclusivamente os fins de promoção dos moveis por ela projetados, comercializados e aqui estipulados. Por ser esta a expressão de minha vontade, nada terei a reclamar a título de direitos conexos a minha imagem e/ou voz ou qualquer outro.'],
    ]],
    ['CLÁUSULA 12 – DO FORO', [
      ['12.1', 'Fica eleito o foro da Comarca de São Paulo, capital do estado de São Paulo para dirimir quaisquer dúvidas ou questões oriundas do presente instrumento, renunciando a qualquer outro, por mais privilegiado que seja. E por estarem justas e contratadas, as partes firmam o presente em duas vias de igual teor e forma.'],
    ]],
  ]
}

function Clausulas({ k }) {
  const c = k.cliente
  const e = c.endereco
  const doc = String(c.cpf || '').replace(/\D/g, '')
  const pj = doc.length === 14
  const endereco = [enderecoLinha(e), e.bairro, e.cidade].filter(Boolean).join(', ').toUpperCase() + (e.uf ? ` – ${e.uf}` : '')
  return (
    <View break style={{ paddingHorizontal: 12 }}>
      <Text style={[s.clausula, { paddingHorizontal: 0, marginTop: 4 }]}>
        <B>AIRAM ARQUITETURA E MARCENARIA</B> sociedade de direito privado com sede na À Rua dos Cubas, 127 - Jardim São Paulo, Guarulhos-SP, inscrita no <B>CNPJ sob nº 32.973.001/0001-09</B>, doravante denominada simplesmente <B>CONTRATADA</B> e, <B>{c.nome.toUpperCase()},</B> pessoa {pj ? 'jurídica' : 'física'}, com endereço na {endereco} devidamente inscrito no <B>{pj ? 'CNPJ' : 'CPF/MF'} nº {doc},</B>{c.rg ? <> portador da cédula de identidade <B>nº {c.rg}</B>,</> : ''}{c.mae ? <> filho(a) de {c.mae.toUpperCase()},</> : ''} doravante denominada simplesmente <B>CONTRATANTE</B>
      </Text>
      <Text style={[s.clausula, { paddingHorizontal: 0, marginTop: 12, fontFamily: 'Helvetica-Bold' }]}>
        Pelo presente instrumento particular e na melhor forma de direito, as partes acima qualificadas têm entre si, justo e acordado, o presente Contrato, o qual em atendimento ao Código de Defesa do Consumidor será regido pelas cláusulas e condições seguintes, que mutuamente aceitam e outorgam, a saber:
      </Text>
      <View style={{ marginTop: 22, marginBottom: 30 }}>
        {['* Sujeito a aprovação de crédito. Prazo para aprovação financeira 05 dias utéis.',
          '* Todos os nossos prazos se iniciam, após não haver pendências financeiras.',
          '* Prazo para MEDIÇÃO e assinatura de PROJETO FINAL EXECUTIVO de 10 dias uteis.',
          '* Prazo de entrega após assinatura do projeto final executivo de 45 DIAS UTEIS.',
          '* Em caso de troca de acabamento "BRANCO PARA MADEIRADO", "MADEIRADO PARA VIDRO" e "VIDRO PARA LAQUEADOS" haverá acrescimo em valores.',
        ].map((t) => <Text key={t} style={[s.clausula, { paddingHorizontal: 0, fontFamily: 'Helvetica-Bold', marginBottom: 9 }]}>{t}</Text>)}
      </View>
      {clausulas(k).map(([titulo, itens]) => (
        <View key={titulo}>
          <Text style={s.titulo} minPresenceAhead={60}>{titulo}</Text>
          {itens.map(([n, t]) => (
            <View key={n} minPresenceAhead={30}>
              <Text style={s.item}>{n}</Text>
              <Text style={s.corpo}>{t}</Text>
            </View>
          ))}
        </View>
      ))}
      <View wrap={false} style={{ marginTop: 50 }}>
        <View style={{ flexDirection: 'row' }}>
          {[['CONTRATADA:', EMPRESA], ['CONTRATANTE:', `${k.codigo ? `${k.codigo} - ` : ''}${c.nome.toUpperCase()}`]].map(([t, n], i) => (
            <View key={t} style={{ flex: 1, marginRight: i === 0 ? 24 : 0, borderTopWidth: 0.6, borderColor: LINHA, paddingTop: 3, alignItems: 'center' }}>
              <Text>{t}</Text>
              <Text style={{ marginTop: 6 }}>{n}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginTop: 8 }}>Testemunhas:</Text>
        <View style={{ flexDirection: 'row', marginTop: 48 }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ flex: 1, marginRight: i === 0 ? 24 : 0 }}>
              <View style={{ borderTopWidth: 0.6, borderColor: LINHA, paddingTop: 2 }}><Text>Nome:</Text></View>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Text style={{ width: 28 }}>R.G.:</Text>
                <View style={{ flex: 1, borderBottomWidth: 0.6, borderColor: LINHA, marginRight: 10 }} />
                <Text style={{ width: 30 }}>C.P.F.:</Text>
                <View style={{ flex: 1, borderBottomWidth: 0.6, borderColor: LINHA }} />
              </View>
            </View>
          ))}
        </View>
        {k.substitui ? <Substitui k={k} /> : null}
      </View>
    </View>
  )
}

function Contrato({ k }) {
  return (
    <Document title={`Contrato ${k.numero} - ${k.cliente.nome}`} author="Airam Arquitetura & Marcenaria" creator="Portal Airam" language="pt-BR">
      <Page size="A4" style={s.pagina}>
        <Cabecalho numero={k.numero} />
        <Pagina1 k={k} />
        <Pagina2 k={k} />
        <Clausulas k={k} />
      </Page>
    </Document>
  )
}

export function gerarPdfContrato(k) {
  return pdf(<Contrato k={k} />).toBlob()
}
