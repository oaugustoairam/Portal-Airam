// Permissões dos usuários internos (as mesmas regras de tem_permissao() no banco).
// O master (admin) tem tudo; nos outros vale o que o master marcou ou o padrão do papel.
export const PERMISSOES = [
  ['gestao', 'Gestão de clientes', 'Cadastro único de clientes, resultados, capa e controle de pastas'],
  ['processos', 'Processos', 'Etapas do portal, controle interno e relatórios'],
  ['marketing', 'Marketing', 'Aniversários e e-mail marketing'],
  ['ver_todos', 'Ver todos os clientes', 'Sem isto, o vendedor vê só as vendas dele'],
  ['excluir', 'Excluir clientes', 'Apagar um cliente e todos os arquivos dele'],
  ['comercial', 'Comercial', 'Captação, CRM, calendário e métricas de vendas'],
  ['comercial_todos', 'Comercial: ver todos os vendedores', 'Leads, agenda e métricas de todos (sem isto, só os próprios)'],
  ['comercial_config', 'Comercial: configurações', 'Origens do lead, motivos de perda e colunas do CRM'],
]

export const PAPEIS = [
  ['admin', 'Master', 'Acesso total e define as permissões dos outros'],
  ['gerente', 'Gerente', 'Todo o Comercial, todos os vendedores e todas as métricas'],
  ['captador', 'Captador (SDR)', 'Cadastra leads e agendamentos; vê calendário e métricas'],
  ['vendedor', 'Vendedor', 'Só o próprio CRM, clientes, lembretes e métricas'],
  ['equipe', 'Equipe', 'Funcionários da loja'],
]

const PADRAO = {
  gerente: ['gestao', 'processos', 'marketing', 'ver_todos', 'comercial', 'comercial_todos'],
  equipe: ['processos', 'marketing', 'ver_todos'],
  vendedor: ['gestao', 'processos', 'comercial'],
  captador: ['comercial', 'comercial_todos'],
}

export function temPermissao(perfil, chave) {
  if (!perfil) return false
  if (perfil.papel === 'admin') return true
  const p = perfil.permissoes || {}
  if (typeof p[chave] === 'boolean') return p[chave]
  return (PADRAO[perfil.papel] || []).includes(chave)
}

export const PAPEIS_INTERNOS = ['admin', 'gerente', 'equipe', 'vendedor', 'captador']
export const ehInterno = (perfil) => PAPEIS_INTERNOS.includes(perfil?.papel)
