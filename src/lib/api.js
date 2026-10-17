// Camada de dados. Usa o Supabase quando as variáveis VITE_SUPABASE_* existem;
// caso contrário roda em modo demonstração, com dados de exemplo no navegador.
import { createClient } from '@supabase/supabase-js'
import { criarDadosDemo, SENHA_DEMO } from './demo.js'
import { calcularTipoPrazo } from './constants.js'
import { avisosDaMudanca, avisoAssinatura, telefoneWhatsApp } from './avisos.js'

const url = import.meta.env.VITE_SUPABASE_URL
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY
export const MODO_DEMO = !url || !chave

const sb = MODO_DEMO ? null : createClient(url, chave)

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const EXTENSOES_PERMITIDAS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.dwg']
const TAMANHO_MAXIMO = 50 * 1024 * 1024
const ERRO_LOGIN = 'E-mail/CPF ou senha incorretos.'

function validarArquivo(arquivo) {
  const nome = arquivo.name.toLowerCase()
  const extOk = EXTENSOES_PERMITIDAS.some((e) => nome.endsWith(e))
  const tipoOk = TIPOS_PERMITIDOS.includes(arquivo.type) || nome.endsWith('.dwg')
  if (!extOk || !tipoOk) throw new Error('Tipo de arquivo não aceito. Envie PDF, JPG, PNG, WEBP ou DWG.')
  if (arquivo.size > TAMANHO_MAXIMO) throw new Error('O arquivo passa de 50 MB.')
}

function caminhoArquivo(processoId, categoria, nome) {
  const seguro = nome.normalize('NFD').replace(/[^\w.-]+/g, '_')
  const pasta = categoria === 'medicao' ? `${processoId}/interno` : processoId
  return `${pasta}/${Date.now()}-${seguro}`
}

// campos que a equipe edita (tipo_prazo é calculado pelo banco)
const CAMPOS = [
  'id', 'codigo', 'cliente_nome', 'cliente_cpf', 'cliente_email', 'cliente_telefone', 'endereco',
  'ambientes', 'data_venda', 'data_disponivel_medicao', 'solucao_financeira', 'data_medicao',
  'medicao_concluida', 'data_conferencia', 'conferencia_concluida', 'data_assinatura_projeto',
  'projeto_assinado_manual', 'data_entrega_prevista', 'entrega_concluida', 'recado_cliente', 'notificar',
]
function limpar(p) {
  const out = {}
  for (const k of CAMPOS) if (k in p) out[k] = p[k] === '' ? null : p[k]
  if (out.cliente_cpf) out.cliente_cpf = String(out.cliente_cpf).replace(/\D/g, '')
  if (out.cliente_email) out.cliente_email = out.cliente_email.trim().toLowerCase()
  return out
}

async function chamarFuncao(nome, corpo) {
  const { data, error } = await sb.functions.invoke(nome, { body: corpo })
  if (error) {
    let msg = error.message
    try {
      msg = (await error.context.json()).erro || msg
    } catch {}
    throw new Error(msg)
  }
  return data
}

// ---------------------------------------------------------------- Supabase
const supabaseApi = {
  aoMudarSessao(cb) {
    const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s))
    return () => data.subscription.unsubscribe()
  },
  async entrar(identificador, senha) {
    const id = identificador.trim()
    if (id.includes('@')) {
      const { error } = await sb.auth.signInWithPassword({ email: id.toLowerCase(), password: senha })
      if (error) throw new Error(ERRO_LOGIN)
      return
    }
    const { data, error } = await sb.functions.invoke('entrar-cpf', { body: { cpf: id, senha } })
    if (error || !data?.access_token) throw new Error(ERRO_LOGIN)
    await sb.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
  },
  async trocarSenha(nova) {
    const { error } = await sb.auth.updateUser({ password: nova })
    if (error) throw new Error('Não foi possível trocar a senha: ' + error.message)
    await sb.rpc('senha_trocada')
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
  async listarProcessos() {
    const { data, error } = await sb
      .from('processos')
      .select('*, assinaturas(*)')
      .order('criado_em', { ascending: false })
    if (error) throw error
    return data
  },
  async processo(id) {
    const { data, error } = await sb
      .from('processos')
      .select('*, documentos(*), assinaturas(*)')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },
  async salvarProcesso(p) {
    const { data, error } = await sb.from('processos').upsert(limpar(p)).select().single()
    if (error) {
      if (error.code === '23505') throw new Error('Já existe um processo com esse código ou CPF.')
      throw error
    }
    return data
  },
  async excluirProcesso(id) {
    const { data: docs } = await sb.from('documentos').select('arquivo_path').eq('processo_id', id)
    if (docs?.length) await sb.storage.from('documentos').remove(docs.map((d) => d.arquivo_path))
    const { error } = await sb.from('processos').delete().eq('id', id)
    if (error) throw error
  },
  async enviarDocumento(processoId, { titulo, categoria }, arquivo) {
    validarArquivo(arquivo)
    const caminho = caminhoArquivo(processoId, categoria, arquivo.name)
    const up = await sb.storage
      .from('documentos')
      .upload(caminho, arquivo, { contentType: arquivo.type || 'application/octet-stream' })
    if (up.error) throw up.error
    const { error } = await sb.from('documentos').insert({
      processo_id: processoId,
      titulo,
      categoria,
      arquivo_path: caminho,
      tipo_mime: arquivo.type || 'application/octet-stream',
    })
    if (error) throw error
  },
  async excluirDocumento(doc) {
    await sb.storage.from('documentos').remove([doc.arquivo_path])
    const { error } = await sb.from('documentos').delete().eq('id', doc.id)
    if (error) throw error
  },
  async urlDocumento(doc) {
    const { data, error } = await sb.storage.from('documentos').createSignedUrl(doc.arquivo_path, 600) // 10 min
    if (error) throw error
    return data.signedUrl
  },
  async liberarAcesso(processoId) {
    return chamarFuncao('liberar-acesso', { processo_id: processoId })
  },
  async enviarParaAssinatura(processoId, documentoId, tipo) {
    return chamarFuncao('zapsign-enviar', { processo_id: processoId, documento_id: documentoId, tipo })
  },
  async cancelarAssinatura(id) {
    const { error } = await sb.from('assinaturas').update({ status: 'cancelado' }).eq('id', id)
    if (error) throw error
  },
  async listarAvisos(processoId) {
    const { data, error } = await sb.from('notificacoes').select('*')
      .eq('processo_id', processoId).order('criado_em', { ascending: false }).limit(100)
    if (error) throw error
    return data
  },
  async reenviarAviso(id) {
    return chamarFuncao('enviar-notificacoes', { id })
  },
}

// ---------------------------------------------------------------- Demonstração
const CHAVE_DEMO = 'portal-airam-demo-v4'
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
const avisar = () => ouvintes.forEach((cb) => cb(db().sessao))
const novoId = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2)
const comTipo = (p) => ({ ...p, tipo_prazo: calcularTipoPrazo(p.data_venda, p.data_disponivel_medicao) })

// simula a fila de avisos do servidor (um aviso por canal)
function simularAvisos(p, eventos) {
  if (p.notificar === false || !eventos.length) return 0
  const d = db()
  d.avisos = d.avisos || []
  const canais = [['email', p.cliente_email], ['whatsapp', telefoneWhatsApp(p.cliente_telefone)]].filter(([, dest]) => dest)
  for (const e of eventos)
    for (const [canal, destino] of canais)
      d.avisos.unshift({ id: novoId(), processo_id: p.id, ...e, canal, destino, status: 'simulado', criado_em: new Date().toISOString() })
  return eventos.length
}

const demoApi = {
  aoMudarSessao(cb) {
    ouvintes.add(cb)
    return () => ouvintes.delete(cb)
  },
  async entrar(identificador, senha) {
    const d = db()
    const id = identificador.trim().toLowerCase()
    const conta = d.contas.find(
      (c) => c.email === id || (c.cpf && c.cpf === id.replace(/\D/g, '') && id.replace(/\D/g, '').length === 11)
    )
    if (!conta || conta.senha !== senha) throw new Error(ERRO_LOGIN)
    d.sessao = { email: conta.email }
    gravar()
    avisar()
  },
  async trocarSenha(nova) {
    const d = db()
    const conta = d.contas.find((c) => c.email === d.sessao?.email)
    conta.senha = nova
    conta.precisa_trocar_senha = false
    gravar()
    avisar()
  },
  async sair() {
    db().sessao = null
    gravar()
    avisar()
  },
  async perfil() {
    const d = db()
    const conta = d.contas.find((c) => c.email === d.sessao?.email)
    return conta ? { email: conta.email, nome: conta.nome, papel: conta.papel, precisa_trocar_senha: conta.precisa_trocar_senha } : null
  },
  async listarProcessos() {
    const d = db()
    const conta = d.contas.find((c) => c.email === d.sessao?.email)
    const lista = conta?.papel === 'cliente' ? d.processos.filter((p) => p.cliente_email === conta.email) : d.processos
    return lista.map((p) => ({ ...comTipo(p), assinaturas: d.assinaturas.filter((a) => a.processo_id === p.id) }))
  },
  async processo(id) {
    const d = db()
    const conta = d.contas.find((c) => c.email === d.sessao?.email)
    const p = d.processos.find((x) => x.id === id)
    if (!p) throw new Error('Processo não encontrado')
    const cliente = conta?.papel === 'cliente'
    return {
      ...comTipo(p),
      documentos: d.documentos.filter((x) => x.processo_id === id && !(cliente && x.categoria === 'medicao')),
      assinaturas: d.assinaturas.filter((a) => a.processo_id === id),
    }
  },
  async salvarProcesso(p) {
    const d = db()
    const campos = limpar(p)
    const conflito = d.processos.find(
      (x) => x.id !== campos.id && (x.codigo === campos.codigo || (campos.cliente_cpf && x.cliente_cpf === campos.cliente_cpf))
    )
    if (conflito) throw new Error('Já existe um processo com esse código ou CPF.')
    if (campos.id) {
      const antes = d.processos.find((x) => x.id === campos.id)
      const depois = { ...antes, ...campos }
      d.processos = d.processos.map((x) => (x.id === campos.id ? depois : x))
      campos.avisos = simularAvisos(depois, avisosDaMudanca(antes, depois))
    } else {
      Object.assign(campos, {
        id: novoId(),
        criado_em: new Date().toISOString(),
        solucao_financeira: campos.solucao_financeira || 'pendente',
      })
      d.processos.unshift(campos)
    }
    gravar()
    return campos
  },
  async excluirProcesso(id) {
    const d = db()
    d.processos = d.processos.filter((x) => x.id !== id)
    d.documentos = d.documentos.filter((x) => x.processo_id !== id)
    d.assinaturas = d.assinaturas.filter((x) => x.processo_id !== id)
    gravar()
  },
  async enviarDocumento(processoId, { titulo, categoria }, arquivo) {
    validarArquivo(arquivo)
    const dataUrl = await new Promise((ok, erro) => {
      const r = new FileReader()
      r.onload = () => ok(r.result)
      r.onerror = erro
      r.readAsDataURL(arquivo)
    })
    const d = db()
    d.documentos.push({
      id: novoId(),
      processo_id: processoId,
      titulo,
      categoria,
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
  async liberarAcesso(processoId) {
    const d = db()
    const p = d.processos.find((x) => x.id === processoId)
    const senha = 'Airam' + Math.floor(1000 + Math.random() * 9000)
    const existente = d.contas.find((c) => c.email === p.cliente_email)
    if (existente && existente.papel !== 'cliente')
      throw new Error('Este e-mail pertence a um funcionário. Use outro e-mail para o cliente.')
    if (existente) Object.assign(existente, { senha, precisa_trocar_senha: true, cpf: p.cliente_cpf })
    else
      d.contas.push({ email: p.cliente_email, cpf: p.cliente_cpf, nome: p.cliente_nome, papel: 'cliente', senha, precisa_trocar_senha: true })
    gravar()
    return { senha, email: p.cliente_email, emailEnviado: false }
  },
  async enviarParaAssinatura(processoId, documentoId, tipo) {
    const d = db()
    if (d.assinaturas.some((a) => a.processo_id === processoId && a.tipo === tipo && a.status === 'pendente'))
      throw new Error('Já existe um documento desse tipo aguardando assinatura. Cancele antes de enviar outro.')
    d.assinaturas.push({
      id: novoId(),
      processo_id: processoId,
      tipo,
      documento_id: documentoId,
      sign_url: null, // no modo demonstração a assinatura é simulada
      status: 'pendente',
      criado_em: new Date().toISOString(),
    })
    simularAvisos(d.processos.find((x) => x.id === processoId), [avisoAssinatura(tipo, 'pendente')])
    gravar()
  },
  async cancelarAssinatura(id) {
    const d = db()
    d.assinaturas = d.assinaturas.map((a) => (a.id === id ? { ...a, status: 'cancelado' } : a))
    gravar()
  },
  // só no modo demonstração: simula o que o webhook do ZapSign faz
  async assinarDemo(assinaturaId) {
    const d = db()
    const a = d.assinaturas.find((x) => x.id === assinaturaId)
    const original = d.documentos.find((x) => x.id === a.documento_id)
    const doc = {
      id: novoId(),
      processo_id: a.processo_id,
      categoria: a.tipo,
      titulo: a.tipo === 'contrato' ? 'Contrato assinado' : 'Projeto final assinado',
      arquivo_path: original?.arquivo_path || '',
      tipo_mime: original?.tipo_mime || 'application/pdf',
      assinado: true,
      criado_em: new Date().toISOString(),
    }
    d.documentos.push(doc)
    Object.assign(a, { status: 'assinado', assinado_em: new Date().toISOString(), documento_assinado_id: doc.id })
    simularAvisos(d.processos.find((x) => x.id === a.processo_id), [avisoAssinatura(a.tipo, 'assinado')])
    gravar()
  },
  async listarAvisos(processoId) {
    return (db().avisos || []).filter((a) => a.processo_id === processoId)
  },
  async reenviarAviso(id) {
    const d = db()
    const a = (d.avisos || []).find((x) => x.id === id)
    if (a) d.avisos.unshift({ ...a, id: novoId(), criado_em: new Date().toISOString() })
    gravar()
  },
  contasDemo() {
    return { senha: SENHA_DEMO, contas: db().contas }
  },
}

export const api = MODO_DEMO ? demoApi : supabaseApi
