// Utilidades compartilhadas pelas funções do servidor (Supabase Edge Functions, Deno).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

export const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('PORTAL_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function resposta(corpo, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// Cliente com poderes de servidor. Nunca expor esta chave no site.
export function clienteServidor() {
  return createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
}

// Confere se quem chamou é funcionário (admin ou equipe). Retorna o perfil ou null.
export async function exigirEquipe(req) {
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!jwt) return null
  const sb = clienteServidor()
  const { data, error } = await sb.auth.getUser(jwt)
  if (error || !data.user) return null
  const { data: perfil } = await sb.from('perfis').select('*').eq('id', data.user.id).maybeSingle()
  if (!perfil || !['admin', 'equipe'].includes(perfil.papel)) return null
  return perfil
}

export function somenteNumeros(v) {
  return String(v ?? '').replace(/\D/g, '')
}

// Senha provisória legível (sem 0/O, 1/l), 10 caracteres.
export function gerarSenhaProvisoria() {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => letras[b % letras.length]).join('')
}
