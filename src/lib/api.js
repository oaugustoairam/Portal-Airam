// Camada de dados. Usa o Supabase quando as variáveis VITE_SUPABASE_* existem;
// caso contrário roda em modo demonstração, com dados de exemplo no navegador.
import { createClient } from '@supabase/supabase-js'
import { criarDadosDemo } from './demo.js'

const url = import.meta.env.VITE_SUPABASE_URL
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY
export const MODO_DEMO = !url || !chave

const sb = MODO_DEMO ? null : createClient(url, chave)

function ordenarFases(fases) {
  return [...fases].sort((a, b) => a.ordem - b.ordem)
}

// ---------------------------------------------------------------- Supabase
const supabaseApi = {
  async sessao() {
    const { data } = await sb.auth.getSession()
    return data.session
  },
  aoMudarSessao(cb) {
    const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s))
    return () => data.subscription.unsubscribe()
  },
  async entrar(email) {
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    })
    if (error) throw error
  },
  async sair() {
    await sb.auth.signOut()
  },
  async perfil() {
    const { data: u } = await sb.auth.getUser()
    if (!u.user) return null
    const { data } = await sb.from('perfis').select('*').eq('id', u.user.id).maybeSingle()
    return data || { id: u.user.id, email: u.user.email, papel: 'cliente' }
  },
  async listarProjetos() {
    const { data, error } = await sb
      .from('projetos')
      .select('*, fases(*)')
      .order('criado_em', { ascending: false })
    if (error) throw error
    return data.map((p) => ({ ...p, fases: ordenarFases(p.fases) }))
  },
  async projeto(id) {
    const { data, error } = await sb
      .from('projetos')
      .select('*, fases(*), documentos(*)')
      .eq('id', id)
      .single()
    if (error) throw error
    return { ...data, fases: ordenarFases(data.fases) }
  },
  async salvarProjeto(p) {
    const { fases, documentos, ...campos } = p
    const { data, error } = await sb.from('projetos').upsert(campos).select().single()
    if (error) throw error
    return data
  },
  async excluirProjeto(id) {
    const { data: docs } = await sb.from('documentos').select('arquivo_path').eq('projeto_id', id)
    if (docs?.length) await sb.storage.from('documentos').remove(docs.map((d) => d.arquivo_path))
    const { error } = await sb.from('projetos').delete().eq('id', id)
    if (error) throw error
  },
  async salvarFases(projetoId, fases) {
    const linhas = fases.map((f, i) => ({ ...f, projeto_id: projetoId, ordem: i }))
    const ids = linhas.filter((f) => f.id).map((f) => f.id)
    let del = sb.from('fases').delete().eq('projeto_id', projetoId)
    if (ids.length) del = del.not('id', 'in', `(${ids.join(',')})`)
    await del
    const { error } = await sb.from('fases').upsert(linhas)
    if (error) throw error
  },
  async enviarDocumento(projetoId, { titulo, categoria, fase_id }, arquivo) {
    const nomeSeguro = arquivo.name.normalize('NFD').replace(/[^\w.-]+/g, '_')
    const caminho = `${projetoId}/${Date.now()}-${nomeSeguro}`
    const up = await sb.storage.from('documentos').upload(caminho, arquivo, { contentType: arquivo.type })
    if (up.error) throw up.error
    const { error } = await sb.from('documentos').insert({
      projeto_id: projetoId,
      titulo,
      categoria,
      fase_id: fase_id || null,
      arquivo_path: caminho,
      tipo_mime: arquivo.type,
    })
    if (error) throw error
  },
  async excluirDocumento(doc) {
    await sb.storage.from('documentos').remove([doc.arquivo_path])
    const { error } = await sb.from('documentos').delete().eq('id', doc.id)
    if (error) throw error
  },
  async urlDocumento(doc) {
    const { data, error } = await sb.storage.from('documentos').createSignedUrl(doc.arquivo_path, 3600)
    if (error) throw error
    return data.signedUrl
  },
}

// ---------------------------------------------------------------- Demonstração
const CHAVE_DEMO = 'portal-demo-v1'
let memoria = null
const ouvintes = new Set()

function db() {
  if (memoria) return memoria
  try {
    const salvo = localStorage.getItem(CHAVE_DEMO)
    if (salvo) memoria = JSON.parse(salvo)
  } catch {}
  if (!memoria) memoria = criarDadosDemo()
  return memoria
}
function gravar() {
  try {
    localStorage.setItem(CHAVE_DEMO, JSON.stringify(memoria))
  } catch {}
}
const novoId = () => Math.random().toString(36).slice(2, 10)

const demoApi = {
  async sessao() {
    return db().sessao
  },
  aoMudarSessao(cb) {
    ouvintes.add(cb)
    return () => ouvintes.delete(cb)
  },
  async entrar(email) {
    const d = db()
    const admin = email === d.emailEscritorio
    d.sessao = { email, papel: admin ? 'admin' : 'cliente' }
    gravar()
    ouvintes.forEach((cb) => cb(d.sessao))
    return { direto: true }
  },
  async sair() {
    db().sessao = null
    gravar()
    ouvintes.forEach((cb) => cb(null))
  },
  async perfil() {
    const s = db().sessao
    return s ? { email: s.email, papel: s.papel } : null
  },
  async listarProjetos() {
    const d = db()
    const visiveis =
      d.sessao?.papel === 'admin'
        ? d.projetos
        : d.projetos.filter((p) => p.cliente_email.toLowerCase() === d.sessao?.email.toLowerCase())
    return visiveis.map((p) => ({ ...p, fases: ordenarFases(d.fases.filter((f) => f.projeto_id === p.id)) }))
  },
  async projeto(id) {
    const d = db()
    const p = d.projetos.find((x) => x.id === id)
    if (!p) throw new Error('Projeto não encontrado')
    return {
      ...p,
      fases: ordenarFases(d.fases.filter((f) => f.projeto_id === id)),
      documentos: d.documentos.filter((x) => x.projeto_id === id),
    }
  },
  async salvarProjeto(p) {
    const d = db()
    const { fases, documentos, ...campos } = p
    if (campos.id) {
      d.projetos = d.projetos.map((x) => (x.id === campos.id ? { ...x, ...campos } : x))
    } else {
      campos.id = novoId()
      campos.criado_em = new Date().toISOString()
      d.projetos.unshift(campos)
    }
    gravar()
    return campos
  },
  async excluirProjeto(id) {
    const d = db()
    d.projetos = d.projetos.filter((x) => x.id !== id)
    d.fases = d.fases.filter((x) => x.projeto_id !== id)
    d.documentos = d.documentos.filter((x) => x.projeto_id !== id)
    gravar()
  },
  async salvarFases(projetoId, fases) {
    const d = db()
    d.fases = d.fases
      .filter((f) => f.projeto_id !== projetoId)
      .concat(fases.map((f, i) => ({ ...f, id: f.id || novoId(), projeto_id: projetoId, ordem: i })))
    gravar()
  },
  async enviarDocumento(projetoId, { titulo, categoria, fase_id }, arquivo) {
    const dataUrl = await new Promise((ok, erro) => {
      const r = new FileReader()
      r.onload = () => ok(r.result)
      r.onerror = erro
      r.readAsDataURL(arquivo)
    })
    const d = db()
    d.documentos.push({
      id: novoId(),
      projeto_id: projetoId,
      titulo,
      categoria,
      fase_id: fase_id || null,
      arquivo_path: dataUrl,
      tipo_mime: arquivo.type,
      criado_em: new Date().toISOString(),
    })
    gravar()
  },
  async excluirDocumento(doc) {
    const d = db()
    d.documentos = d.documentos.filter((x) => x.id !== doc.id)
    gravar()
  },
  async urlDocumento(doc) {
    return doc.arquivo_path
  },
  // só existe no modo demonstração
  emailsDemo() {
    const d = db()
    return { escritorio: d.emailEscritorio, clientes: [...new Set(d.projetos.map((p) => p.cliente_email))] }
  },
  restaurarDemo() {
    memoria = criarDadosDemo()
    gravar()
    ouvintes.forEach((cb) => cb(null))
  },
}

export const api = MODO_DEMO ? demoApi : supabaseApi
