// Login com CPF ou telefone + senha: encontra o e-mail do cliente no servidor (sem expor ao
// navegador) e faz o login com senha. O erro é sempre o mesmo para não revelar se o cadastro existe.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { cors, resposta, clienteServidor, emailDoIdentificador } from '../_shared/comum.ts'

const ERRO = 'Dados de acesso ou senha incorretos.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const { identificador, cpf, senha } = await req.json().catch(() => ({}))
  if (!senha) return resposta({ erro: ERRO }, 400)

  const email = await emailDoIdentificador(clienteServidor(), identificador ?? cpf)
  if (!email) return resposta({ erro: ERRO }, 401)

  const anon = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
  })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: senha })
  if (error || !data.session) return resposta({ erro: ERRO }, 401)
  return resposta({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
})
