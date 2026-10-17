// Planilhas da gestão de clientes, nos modelos da Airam:
// capa do envelope (controle de pedido) e relação mensal de clientes (feedback de vendas).
// modelos embutidos no código (base64), carregados só quando alguém gera uma planilha
import modeloCapa from '../assets/modelos/capa-envelope.xlsx?base64'
import modeloFeedback from '../assets/modelos/feedback-vendas.xlsx?base64'
import { preencherModelo, serialExcel } from './xlsx.js'
import { financeira, nomeMes } from './vendas.js'

const FRENTE = 'xl/worksheets/sheet1.xml'
const VERSO = 'xl/worksheets/sheet2.xml'

const data = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '')
const valor = (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const marca = (ok) => (ok ? 'X' : '')

export function celulasCapa(v) {
  const meios = v.meios || []
  return {
    [FRENTE]: {
      // dados do pedido
      C6: v.cliente_nome, N6: v.codigo, C7: data(v.data_venda), H7: v.vendedor, N7: v.captacao,
      A8: marca(v.loja === 'guarulhos'), P8: marca(v.loja === 'mooca'),
      // dados financeiros
      D11: valor(v.valor_venda), N11: v.forma_pagamento, E12: valor(v.valor_entrada), N12: valor(v.valor_parcela),
      E13: financeira(v.financeira)?.nome || '', N13: data(v.vencimento_primeira),
      C14: marca(meios.includes('dinheiro')), F14: marca(meios.includes('pix')), I14: marca(meios.includes('boletos')),
      N14: marca(meios.includes('cartao')), Q14: marca(meios.includes('cheques')),
      // informações da loja
      E17: marca(v.prazo_tipo === '45_dias'), J17: marca(v.prazo_tipo === 'futura'), O17: data(v.previsao_imovel),
      F18: data(v.envio_email), O18: data(v.assinatura_inicial),
      F19: v.avaliacao_google === true ? 'SIM' : v.avaliacao_google === false ? 'NÃO' : '', N19: valor(v.bruto_promob),
      // controle do escritório
      E22: v.pedido_fabrica, N22: data(v.assinatura_projeto_final) || '___ / ____ / ______',
      L23: data(v.prazo_limite_entrega) || '___ / ___ / ______',
      A28: `COMENTARIO / OBSERVAÇÃO: ${v.observacao || ''}`,
    },
    [VERSO]: {
      D5: data(v.medicao_realizada) || '____  / ____  / ________',
      M5: data(v.limite_projeto_final) || '____  / ____  / ________',
    },
  }
}

export function gerarCapa(v) {
  return preencherModelo(modeloCapa, celulasCapa(v))
}

export const SITUACAO_PLANILHA = { pendente: 'PENDENTE', resolvido: 'RESOLVIDO', cancelado: 'CANCELADO' }

// Relação de clientes do mês (até 223 vendas, como o modelo)
export function gerarPlanilhaMes(vendas, mes) {
  const linhas = {}
  vendas.slice(0, 223).forEach((v, i) => {
    const r = 4 + i
    const codigoNum = /^\d+$/.test(v.codigo || '') ? Number(v.codigo) : v.codigo
    Object.assign(linhas, {
      [`A${r}`]: codigoNum, [`B${r}`]: v.cliente_nome, [`C${r}`]: v.vendedor, [`D${r}`]: v.captacao,
      [`E${r}`]: serialExcel(v.data_venda), [`F${r}`]: financeira(v.financeira)?.planilha || '',
      [`G${r}`]: v.valor_venda === '' || v.valor_venda == null ? null : Number(v.valor_venda),
      [`H${r}`]: v.valor_deflacionado === '' || v.valor_deflacionado == null ? null : Number(v.valor_deflacionado),
      [`I${r}`]: [v.forma_pagamento, v.observacao].filter(Boolean).join(' · '), [`J${r}`]: SITUACAO_PLANILHA[v.situacao] || '',
    })
  })
  // o modelo deixa as linhas 4 a 226 escondidas: mostra só as que têm venda
  const mostrar = vendas.slice(0, 223).map((_, i) => [FRENTE, `<row r="${4 + i}" ht="21.75" hidden="1" customHeight="1">`, `<row r="${4 + i}" ht="21.75" customHeight="1">`])
  const titulo = nomeMes(mes).toUpperCase()
  const aba = nomeMes(mes, true)
  return preencherModelo(
    modeloFeedback,
    { [FRENTE]: { A1: `RELAÇÃO DE CLIENTES — ${titulo}`, ...linhas }, [VERSO]: { A1: `RESUMO EXECUTIVO — ${titulo}` } },
    [
      ['xl/workbook.xml', 'name="VENDAS"', `name="${aba}"`],
      ['xl/workbook.xml', "'VENDAS'!", `'${aba}'!`],
      [VERSO, "'VENDAS'!", `'${aba}'!`],
      ...mostrar,
    ]
  )
}
