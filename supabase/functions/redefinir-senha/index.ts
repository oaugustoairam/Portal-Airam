// Confere o código enviado por SMS/e-mail e grava a nova senha. Depois, já entra no portal.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { cors, resposta, clienteServidor, acharCliente, hashCodigo, senhaForte } from '../_shared/comum.ts'

const MAX_TENTATIVAS = 5
const INVALIDO = 'Código inválido ou expirado. Peça um novo código.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const { identificador, codigo, senha } = await req.json().catch(() => ({}))
  if (!senhaForte(senha)) return resposta({ erro: 'A nova senha precisa de 8 caracteres ou mais, com letras e números.' }, 400)

  const sb = clienteServidor()
  const cliente = await acharCliente(sb, identificador)
  if (!cliente || !/^\d{6}$/.test(String(codigo ?? ''))) return resposta({ erro: INVALIDO }, 400)

  const { data: reg } = await sb.from('codigos_verificacao').select('*')
    .eq('user_id', cliente.userId).is('usado_em', null).gt('expira_em', new Date().toISOString())
    .order('criado_em', { ascending: false }).limit(1).maybeSingle()
  if (!reg || reg.tentativas >= MAX_TENTATIVAS) return resposta({ erro: INVALIDO }, 400)

  if ((await hashCodigo(codigo, cliente.userId)) !== reg.codigo_hash) {
    await sb.from('codigos_verificacao').update({ tentativas: reg.tentativas + 1 }).eq('id', reg.id)
    const restam = MAX_TENTATIVAS - reg.tentativas - 1
    return resposta({ erro: restam > 0 ? `Código incorreto. Restam ${restam} tentativas.` : INVALIDO }, 400)
  }

  await sb.from('codigos_verificacao').update({ usado_em: new Date().toISOString() }).eq('id', reg.id)
  const { error } = await sb.auth.admin.updateUserById(cliente.userId, { password: senha })
  if (error) return resposta({ erro: 'Não foi possível salvar a nova senha. Tente de novo.' }, 500)
  await sb.from('perfis').update({ precisa_trocar_senha: false }).eq('id', cliente.userId)

  const anon = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), { auth: { persistSession: false } })
  const { data } = await anon.auth.signInWithPassword({ email: cliente.email, password: senha })
  return resposta({ ok: true, access_token: data?.session?.access_token, refresh_token: data?.session?.refresh_token })
})
