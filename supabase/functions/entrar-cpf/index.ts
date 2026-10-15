// Login com CPF + senha: encontra o e-mail do CPF no servidor (sem expor ao navegador)
// e faz o login com senha. Mensagem de erro é sempre a mesma para não revelar se o CPF existe.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { cors, resposta, clienteServidor, somenteNumeros } from '../_shared/comum.ts'

const ERRO = 'CPF ou senha incorretos.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const { cpf, senha } = await req.json().catch(() => ({}))
  const numeros = somenteNumeros(cpf)
  if (numeros.length !== 11 || !senha) return resposta({ erro: ERRO }, 400)

  const { data: proc } = await clienteServidor()
    .from('processos').select('cliente_email').eq('cliente_cpf', numeros).maybeSingle()
  if (!proc) return resposta({ erro: ERRO }, 401)

  const anon = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
  })
  const { data, error } = await anon.auth.signInWithPassword({ email: proc.cliente_email, password: senha })
  if (error || !data.session) return resposta({ erro: ERRO }, 401)
  return resposta({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
})
