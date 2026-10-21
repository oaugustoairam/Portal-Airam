// Master (admin) cria um usuário interno (equipe ou vendedor) com senha provisória.
// No primeiro login a pessoa é obrigada a criar a própria senha.
import { cors, resposta, clienteServidor, exigirEquipe, gerarSenhaProvisoria } from '../_shared/comum.ts'

const PAPEIS = ['admin', 'gerente', 'equipe', 'vendedor', 'captador']
const CHAVES = ['gestao', 'processos', 'marketing', 'ver_todos', 'excluir', 'comercial', 'comercial_todos', 'comercial_config']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const quem = await exigirEquipe(req)
  if (!quem || quem.papel !== 'admin') return resposta({ erro: 'Somente o master cria usuários.' }, 403)

  const corpo = await req.json().catch(() => ({}))
  // desativar / reativar: a regra fica no banco (definir_ativo) e o login é bloqueado no Auth
  if (corpo.acao === 'ativo') {
    if (!corpo.id || corpo.id === quem.id) return resposta({ erro: 'Você não pode desativar o seu próprio acesso.' }, 400)
    const sb = clienteServidor()
    const { data: alvo } = await sb.from('perfis').select('id, papel').eq('id', corpo.id).maybeSingle()
    if (!alvo || alvo.papel === 'cliente') return resposta({ erro: 'Usuário não encontrado.' }, 404)
    const ativar = corpo.ativo === true
    const { error: e1 } = await sb.from('perfis').update({ ativo: ativar }).eq('id', alvo.id)
    if (e1) return resposta({ erro: e1.message }, 500)
    const { error: e2 } = await sb.auth.admin.updateUserById(alvo.id, { ban_duration: ativar ? 'none' : '876000h' })
    if (e2) return resposta({ erro: e2.message }, 500)
    return resposta({ ok: true })
  }
  const { email, nome, papel, permissoes, whatsapp } = corpo
  const zap = String(whatsapp ?? '').replace(/\D/g, '')
  if (zap && (zap.length < 10 || zap.length > 13)) return resposta({ erro: 'WhatsApp inválido (use DDD + número).' }, 400)
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
  await sb.from('perfis').upsert({ id: data.user.id, email: e, nome: String(nome ?? '').trim() || null, papel, permissoes: perm, whatsapp: zap || null, precisa_trocar_senha: true })
  return resposta({ id: data.user.id, senha })
})
