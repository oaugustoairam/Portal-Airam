// Aba COMERCIAL: captação de leads, CRM do vendedor, calendário e métricas.
// As regras de acesso valem no banco (RLS); aqui só decidimos o que mostrar para cada perfil.
import { temPermissao } from './permissoes.js'

// sub-abas visíveis para cada perfil
export function subabasComercial(perfil) {
  const todos = temPermissao(perfil, 'comercial_todos')
  const lista = []
  if (todos) lista.push(['captacao', 'Captação / Agendamentos'])
  if (perfil?.papel !== 'captador') lista.push(['crm', todos ? 'CRM' : 'Meu CRM'], ['lembretes', 'Meus lembretes'])
  lista.push(['calendario', 'Calendário'], ['metricas', 'Métricas de Vendas'])
  return lista
}

export const TIPOS_COLUNA = [['entrada', 'Entrada (novos leads)'], ['normal', 'Intermediária'], ['ganho', 'Venda (pede valor e data)'], ['perdido', 'Perda (pede motivo)']]
export const TIPOS_LEMBRETE = [['retornar_contato', 'Retornar contato'], ['enviar_orcamento', 'Enviar orçamento'], ['confirmar_agendamento', 'Confirmar agendamento'], ['outro', 'Outro']]

// listas configuráveis (as mesmas tabelas do banco)
export const LISTAS_CONFIG = {
  origens_lead: { titulo: 'Origens do lead', ajuda: 'De onde o cliente veio. Aparece no cadastro do lead e nos relatórios.' },
  motivos_perda: { titulo: 'Motivos de perda', ajuda: 'Pedidos ao mover um cartão para Perdidos. "Pede texto" obriga a descrever.' },
  crm_colunas: { titulo: 'Colunas do CRM', ajuda: 'Ordem das colunas do quadro. Colunas intermediárias podem ser criadas e desativadas.' },
}

export const ORIGENS_PADRAO = ['Instagram', 'Indicação', 'Site', 'Arquiteto', 'Tráfego pago', 'Link da bio', 'Porta de loja',
  'Telefone da loja', 'Corretores', 'Parcerias', 'Metrocasa', 'Amigos pessoais', 'Outro']
export const MOTIVOS_PADRAO = [['Veio e não fechou', false], ['Não compareceu', false], ['Preço', false], ['Prazo', false],
  ['Fechou com concorrente', false], ['Desistiu do projeto', false], ['Outro', true]]
export const COLUNAS_PADRAO = [['novo_cliente', 'Novo cliente', 'entrada', 10], ['nao_responde', 'Não responde', 'normal', 20],
  ['vendidos', 'Vendidos', 'ganho', 90], ['perdidos', 'Perdidos', 'perdido', 100]]

// o que cada perfil pode fazer na tela (o banco confere de novo)
export function acoesComercial(perfil) {
  const todos = temPermissao(perfil, 'comercial_todos')
  const captador = perfil?.papel === 'captador'
  return {
    todos,
    captador,
    cadastrar: todos, // captação: captador, gerente e master
    mover: !captador,
    lembretes: !captador,
    briefing: !captador,
    trocarVendedor: todos,
    excluir: ['admin', 'gerente'].includes(perfil?.papel) || (perfil?.permissoes || {}).excluir === true,
  }
}

export const TIPOS_ARQUIVO = [['planta', 'Planta'], ['referencia', 'Imagem de referência'], ['conversa', 'Conversa']]
export const SITUACOES_AGENDA = { marcado: 'Marcado', compareceu: 'Compareceu', nao_compareceu: 'Não compareceu', cancelado: 'Cancelado' }

// datas no horário local (o banco guarda em UTC)
export const doisDigitos = (n) => String(n).padStart(2, '0')
export const diaLocal = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${doisDigitos(x.getMonth() + 1)}-${doisDigitos(x.getDate())}`
}
export const horaLocal = (d) => {
  const x = new Date(d)
  return `${doisDigitos(x.getHours())}:${doisDigitos(x.getMinutes())}`
}
export const dataHoraBR = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
export const diaMesHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '')
export const dataBR = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
export const dinheiro = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
export const foneBR = (t) => {
  const n = String(t || '').replace(/\D/g, '')
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return t || ''
}
export const linkWhatsApp = (t) => {
  const n = String(t || '').replace(/\D/g, '')
  return n.length >= 10 ? `https://wa.me/${n.length <= 11 ? '55' + n : n}` : null
}

// situação de um lembrete agora
export function estadoLembrete(l, agora = new Date()) {
  if (l.concluido_em) return 'concluido'
  const q = new Date(l.quando)
  if (q < agora) return 'atrasado'
  return diaLocal(q) === diaLocal(agora) ? 'hoje' : 'proximo'
}

// próximo agendamento ativo do lead (ou o último, se todos já passaram)
export function agendaDoLead(agendamentos, leadId) {
  const meus = agendamentos.filter((a) => a.lead_id === leadId && a.situacao !== 'cancelado')
  const agora = Date.now()
  return meus.find((a) => new Date(a.inicio).getTime() >= agora - 3600000) || meus[meus.length - 1] || null
}
// canal do lead: loja do agendamento ou online (sem agendamento = sem canal)
export function canalDoLead(agendamentos, leadId) {
  const a = agendamentos.filter((x) => x.lead_id === leadId && x.situacao !== 'cancelado').pop()
  return a ? (a.modalidade === 'online' ? 'online' : a.loja_id) : null
}

export const nomeCurto = (pessoas, id) => {
  const p = pessoas.find((x) => x.id === id)
  return p ? p.nome || p.email : '—'
}

// atalhos de período das métricas
export function periodo(atalho, hoje = new Date()) {
  const d = (x) => diaLocal(x)
  const y = hoje.getFullYear()
  const m = hoje.getMonth()
  switch (atalho) {
    case 'hoje': return [d(hoje), d(hoje)]
    case 'semana': {
      const ini = new Date(hoje)
      ini.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7))
      const fim = new Date(ini)
      fim.setDate(ini.getDate() + 6)
      return [d(ini), d(fim)]
    }
    case 'mes': return [d(new Date(y, m, 1)), d(new Date(y, m + 1, 0))]
    case 'mes_passado': return [d(new Date(y, m - 1, 1)), d(new Date(y, m, 0))]
    case 'trimestre': {
      const q = Math.floor(m / 3) * 3
      return [d(new Date(y, q, 1)), d(new Date(y, q + 3, 0))]
    }
    case 'ano': return [d(new Date(y, 0, 1)), d(new Date(y, 11, 31))]
    default: return null
  }
}
export const ATALHOS_PERIODO = [['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês'], ['mes_passado', 'Mês passado'], ['trimestre', 'Trimestre'], ['ano', 'Ano']]

// Perguntas do briefing (formulário e PDF usam a mesma lista; todas são opcionais).
// simnao: resposta Sim/Não; extra: campo de texto que só aparece com a resposta indicada.
export const PERGUNTAS_BRIEFING = [
  { campo: 'endereco', texto: 'Onde fica o imóvel?', linhas: 2 },
  { campo: 'ja_mora', texto: 'Já mora no local?', simnao: true, extra: { campo: 'previsao_morar', texto: 'Qual a previsão para morar?', quando: false } },
  { campo: 'moradores', texto: 'Quem vai morar no imóvel com você?', linhas: 2 },
  { campo: 'projeto_arquitetura', texto: 'Tem projeto de arquitetura? Chegou a fazer projeto em alguma loja?', linhas: 2 },
  { campo: 'quem_opina', texto: 'Além de você, quem vai opinar no estilo do projeto?', linhas: 2 },
  { campo: 'ambiente_uso', texto: 'Qual ambiente vocês mais usam no imóvel? Do que você sente mais falta onde mora hoje?', linhas: 3 },
  { campo: 'obra', texto: 'Vai fazer obra no imóvel?', simnao: true, extra: { campo: 'obra_detalhes', texto: 'O que vai ser feito na obra?', quando: true } },
  { campo: 'eletros', texto: 'Qual a lista de eletros que vai usar?', linhas: 3 },
  { campo: 'observacoes', texto: 'Observações', linhas: 3 },
]
