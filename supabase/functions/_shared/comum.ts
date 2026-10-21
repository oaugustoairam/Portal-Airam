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
  if (!perfil || perfil.ativo === false || !['admin', 'gerente', 'equipe', 'vendedor', 'captador'].includes(perfil.papel)) return null
  return perfil
}

// Pergunta ao banco, com o login de quem chamou, uma regra de acesso (pode_gerir, tem_permissao).
// Assim o servidor segue exatamente as mesmas regras do portal: vendedor só mexe nos clientes dele.
export async function regraDoUsuario(req, funcao, args) {
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!jwt) return false
  const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data, error } = await sb.rpc(funcao, args)
  return !error && data === true
}

export function somenteNumeros(v) {
  return String(v ?? '').replace(/\D/g, '')
}

// Senha provisória legível (sem 0/O, 1/l), 10 caracteres.
export function gerarSenhaProvisoria() {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  // sorteia de novo até ter letra e número (regra de senha do Supabase)
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(10))
    const senha = Array.from(bytes, (b) => letras[b % letras.length]).join('')
    if (/[A-Za-z]/.test(senha) && /\d/.test(senha)) return senha
  }
}

function cpfValido(n: string) {
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false
  const dig = (len: number) => {
    let s = 0
    for (let i = 0; i < len; i++) s += Number(n[i]) * (len + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dig(9) === Number(n[9]) && dig(10) === Number(n[10])
}

// E-mail do cliente a partir do que ele digitou: e-mail, CPF ou telefone do processo.
// CPF válido tem preferência; telefone compartilhado por clientes diferentes não identifica ninguém.
export async function emailDoIdentificador(sb, identificador) {
  const id = String(identificador ?? '').trim().toLowerCase()
  if (id.includes('@')) {
    const { data } = await sb.from('processos').select('cliente_email').ilike('cliente_email', id).limit(1)
    return data?.[0]?.cliente_email?.toLowerCase() ?? null
  }
  const n = somenteNumeros(id)
  if (cpfValido(n)) {
    const { data } = await sb.from('processos').select('cliente_email').eq('cliente_cpf', n).not('cliente_email', 'is', null).limit(1)
    if (data?.length) return data[0].cliente_email.toLowerCase()
  }
  const tel = /^55\d{10,11}$/.test(n) ? n.slice(2) : n
  if (tel.length !== 10 && tel.length !== 11) return null
  const { data } = await sb.from('processos').select('cliente_email').eq('telefone_numeros', tel).not('cliente_email', 'is', null).limit(20)
  const emails = [...new Set((data ?? []).map((p) => p.cliente_email.toLowerCase()))]
  return emails.length === 1 ? emails[0] : null
}

// Encontra a conta do cliente pelo e-mail, CPF ou telefone. Retorna { userId, email, telefone, nome } ou null.
export async function acharCliente(sb, identificador) {
  const email = await emailDoIdentificador(sb, identificador)
  if (!email) return null
  const { data: proc } = await sb.from('processos').select('cliente_email, cliente_telefone, cliente_nome')
    .ilike('cliente_email', email).limit(1).maybeSingle()
  if (!proc) return null
  const { data: perfil } = await sb.from('perfis').select('id, papel').ilike('email', email).maybeSingle()
  if (!perfil || perfil.papel !== 'cliente') return null
  return { userId: perfil.id, email, telefone: proc.cliente_telefone, nome: proc.cliente_nome }
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
