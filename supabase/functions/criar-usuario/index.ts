// Master (admin) cria um usuário interno (equipe ou vendedor) com senha provisória.
// No primeiro login a pessoa é obrigada a criar a própria senha.
import { cors, resposta, clienteServidor, exigirEquipe, gerarSenhaProvisoria } from '../_shared/comum.ts'

const PAPEIS = ['admin', 'equipe', 'vendedor']
const CHAVES = ['gestao', 'processos', 'marketing', 'ver_todos', 'excluir']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const quem = await exigirEquipe(req)
  if (!quem || quem.papel !== 'admin') return resposta({ erro: 'Somente o master cria usuários.' }, 403)

  const { email, nome, papel, permissoes } = await req.json().catch(() => ({}))
  const e = String(email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return resposta({ erro: 'E-mail inválido.' }, 400)
  if (!PAPEIS.includes(papel)) return resposta({ erro: 'Papel inválido.' }, 400)
  const perm = Object.fromEntries(CHAVES.filter((k) => typeof permissoes?.[k] === 'boolean').map((k) => [k, permissoes[k]]))

  const sb = clienteServidor()
  const { data: existente } = await sb.from('perfis').select('id, papel').ilike('email', e).maybeSingle()
  if (existente?.papel === 'cliente') return resposta({ erro: 'Este e-mail já é de um cliente do portal.' }, 400)
  if (existente) return resposta({ erro: 'Este e-mail já tem acesso. Mude as permissões na lista.' }, 409)

  const senha = gerarSenhaProvisoria()
  const { data, error } = await sb.auth.admin.createUser({ email: e, password: senha, email_confirm: true })
  if (error) return resposta({ erro: error.message }, 400)
  await sb.from('perfis').upsert({ id: data.user.id, email: e, nome: String(nome ?? '').trim() || null, papel, permissoes: perm, precisa_trocar_senha: true })
  return resposta({ id: data.user.id, senha })
})
