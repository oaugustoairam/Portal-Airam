// Permissões dos usuários internos (as mesmas regras de tem_permissao() no banco).
// O master (admin) tem tudo; nos outros vale o que o master marcou ou o padrão do papel.
export const PERMISSOES = [
  ['gestao', 'Gestão de clientes', 'Cadastro único de clientes, resultados, capa e controle de pastas'],
  ['processos', 'Processos', 'Etapas do portal, controle interno e relatórios'],
  ['marketing', 'Marketing', 'Aniversários e e-mail marketing'],
  ['ver_todos', 'Ver todos os clientes', 'Sem isto, o vendedor vê só as vendas dele'],
  ['excluir', 'Excluir clientes', 'Apagar um cliente e todos os arquivos dele'],
]

export const PAPEIS = [
  ['admin', 'Master', 'Acesso total e define as permissões dos outros'],
  ['equipe', 'Equipe', 'Funcionários da loja'],
  ['vendedor', 'Vendedor', 'Vê os próprios clientes e resultados'],
]

const PADRAO = {
  equipe: ['processos', 'marketing', 'ver_todos'],
  vendedor: ['gestao', 'processos'],
}

export function temPermissao(perfil, chave) {
  if (!perfil) return false
  if (perfil.papel === 'admin') return true
  const p = perfil.permissoes || {}
  if (typeof p[chave] === 'boolean') return p[chave]
  return (PADRAO[perfil.papel] || []).includes(chave)
}

export const ehInterno = (perfil) => ['admin', 'equipe', 'vendedor'].includes(perfil?.papel)
