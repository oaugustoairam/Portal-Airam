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

// Encontra a conta do cliente pelo e-mail ou CPF. Retorna { userId, email, telefone, nome } ou null.
export async function acharCliente(sb, identificador) {
  const id = String(identificador ?? '').trim().toLowerCase()
  const cpf = somenteNumeros(id)
  let consulta = sb.from('processos').select('cliente_email, cliente_telefone, cliente_nome').limit(1)
  if (id.includes('@')) consulta = consulta.ilike('cliente_email', id)
  else if (cpf.length === 11) consulta = consulta.eq('cliente_cpf', cpf)
  else return null
  const { data: proc } = await consulta.maybeSingle()
  if (!proc) return null
  const { data: perfil } = await sb.from('perfis').select('id, papel').ilike('email', proc.cliente_email).maybeSingle()
  if (!perfil || perfil.papel !== 'cliente') return null
  return { userId: perfil.id, email: proc.cliente_email.toLowerCase(), telefone: proc.cliente_telefone, nome: proc.cliente_nome }
}

export async function hashCodigo(codigo, userId) {
  const dados = new TextEncoder().encode(`${codigo}:${userId}:${Deno.env.get('CODIGO_PEPPER') ?? 'airam'}`)
  const h = await crypto.subtle.digest('SHA-256', dados)
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function senhaForte(s) {
  return typeof s === 'string' && s.length >= 8 && /[A-Za-z]/.test(s) && /\d/.test(s)
}

// Telefone brasileiro em E.164 (+55DDDNÚMERO)
export function telefoneE164(t) {
  const n = somenteNumeros(t)
  if (n.length === 10 || n.length === 11) return '+55' + n
  if (/^55\d{10,11}$/.test(n)) return '+' + n
  return null
}
