// Aba COMERCIAL: captação de leads, CRM do vendedor, calendário e métricas.
// As regras de acesso valem no banco (RLS); aqui só decidimos o que mostrar para cada perfil.
import { temPermissao } from './permissoes.js'

// sub-abas visíveis para cada perfil
export function subabasComercial(perfil) {
  const todos = temPermissao(perfil, 'comercial_todos')
  const lista = []
  if (todos) lista.push(['captacao', 'Captação / Agendamentos'])
  if (perfil?.papel !== 'captador') lista.push(['crm', todos ? 'CRM' : 'Meu CRM'])
  lista.push(['calendario', 'Calendário'], ['metricas', 'Métricas de Vendas'])
  if (temPermissao(perfil, 'comercial_config')) lista.push(['config', 'Configurações'])
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
