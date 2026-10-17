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

// campos do "Meu perfil" que o próprio cliente edita
const CAMPOS_PERFIL = ['nome_preferido', 'telefone', 'telefone_2', 'nascimento', 'cep', 'endereco', 'numero', 'complemento',
  'bairro', 'cidade', 'uf', 'observacoes', 'receber_novidades', 'foto_path']
function limparPerfil(d) {
  const out = {}
  for (const k of CAMPOS_PERFIL) if (k in d) out[k] = d[k] === '' ? null : d[k]
  if (out.cep) out.cep = String(out.cep).replace(/\D/g, '') || null
  return out
}

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
  'projeto_inicial_enviado', 'data_projeto_inicial',
  'medicao_concluida', 'data_conferencia', 'conferencia_concluida', 'data_assinatura_projeto',
  'projeto_assinado_manual', 'data_entrega_prevista', 'entrega_concluida', 'recado_cliente', 'notificar',
  'cliente_nascimento', 'aceita_marketing', 'numero_contrato',
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
  async recuperarSenha(identificador, canal) {
    const { data, error } = await sb.functions.invoke('recuperar-senha', { body: { identificador, canal } })
    if (error) {
      let msg = 'Não foi possível enviar o código agora. Tente de novo em instantes.'
      try {
        msg = (await error.context.json()).erro || msg
      } catch {}
      throw new Error(msg)
    }
    return data.mensagem
  },
  async redefinirSenha(identificador, codigo, senha) {
    const { data, error } = await sb.functions.invoke('redefinir-senha', { body: { identificador, codigo, senha } })
    if (error) {
      let msg = 'Não foi possível redefinir a senha.'
      try {
        msg = (await error.context.json()).erro || msg
      } catch {}
      throw new Error(msg)
    }
    if (data?.access_token) await sb.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
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
  async meuPerfil() {
    const { data: u } = await sb.auth.getUser()
    if (!u.user) return null
    const { data } = await sb.from('perfil_cliente').select('*').eq('id', u.user.id).maybeSingle()
    return { ...(data || { receber_novidades: true }), email: u.user.email }
  },
  async salvarMeuPerfil(dados) {
    const { data: u } = await sb.auth.getUser()
    const { data, error } = await sb.from('perfil_cliente').upsert({ id: u.user.id, ...limparPerfil(dados) }).select().single()
    if (error) throw new Error('Não foi possível salvar: ' + error.message)
    return { ...data, email: u.user.email }
  },
  async enviarFotoPerfil(blob) {
    const { data: u } = await sb.auth.getUser()
    const caminho = `${u.user.id}/foto.jpg`
    const up = await sb.storage.from('avatares').upload(caminho, blob, { contentType: 'image/jpeg', upsert: true })
    if (up.error) throw new Error('Não foi possível enviar a foto: ' + up.error.message)
    await sb.from('perfil_cliente').upsert({ id: u.user.id, foto_path: caminho })
    return caminho
  },
  async removerFotoPerfil() {
    const { data: u } = await sb.auth.getUser()
    await sb.storage.from('avatares').remove([`${u.user.id}/foto.jpg`])
    await sb.from('perfil_cliente').upsert({ id: u.user.id, foto_path: null })
  },
  async urlFotoPerfil(caminho) {
    if (!caminho) return null
    const { data } = await sb.storage.from('avatares').createSignedUrl(caminho, 3600)
    return data?.signedUrl ? `${data.signedUrl}&v=${Date.now()}` : null
  },
  async perfilDoCliente(email) {
    const { data: perfil } = await sb.from('perfis').select('id').ilike('email', email).maybeSingle()
    if (!perfil) return null
    const { data } = await sb.from('perfil_cliente').select('*').eq('id', perfil.id).maybeSingle()
    return data
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
  async listarCampanhas() {
    const { data, error } = await sb.from('campanhas').select('*').order('criado_em', { ascending: false }).limit(50)
    if (error) throw error
    return data
  },
  async salvarCampanha(c) {
    const campos = (({ id, assunto, titulo, conteudo, imagem_url, botao_texto, botao_link }) =>
      ({ ...(id ? { id } : {}), assunto, titulo, conteudo, imagem_url: imagem_url || null, botao_texto: botao_texto || null, botao_link: botao_link || null }))(c)
    const { data, error } = await sb.from('campanhas').upsert(campos).select().single()
    if (error) throw error
    return data
  },
  async enviarCampanha(campanhaId, processoIds) {
    return chamarFuncao('enviar-campanha', { campanha_id: campanhaId, processo_ids: processoIds })
  },
}

// ---------------------------------------------------------------- Demonstração
const CHAVE_DEMO = 'portal-airam-demo-v9'
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

// mesma regra do gatilho marcar_datas_etapas: guarda o dia em que cada etapa foi concluída
function marcarDatas(a, n) {
  const agora = new Date().toISOString()
  const regra = (feito, antes, campo) => (!feito ? null : antes ? a[campo] || agora : agora)
  n.financeiro_ok_em = regra(n.solucao_financeira === 'ok', a.solucao_financeira === 'ok', 'financeiro_ok_em')
  n.projeto_inicial_em = regra(n.projeto_inicial_enviado, a.projeto_inicial_enviado, 'projeto_inicial_em')
  n.medicao_concluida_em = regra(n.medicao_concluida, a.medicao_concluida, 'medicao_concluida_em')
  n.conferencia_concluida_em = regra(n.conferencia_concluida, a.conferencia_concluida, 'conferencia_concluida_em')
  n.montagem_concluida_em = regra(n.entrega_concluida, a.entrega_concluida, 'montagem_concluida_em')
  if (n.projeto_assinado_manual && !a.projeto_assinado_manual) n.projeto_assinado_em = a.projeto_assinado_em || agora
  return n
}

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
  async recuperarSenha(identificador, canal) {
    const d = db()
    const id = identificador.trim().toLowerCase()
    const conta = d.contas.find((c) => c.papel === 'cliente' && (c.email === id || (c.cpf && c.cpf === id.replace(/\D/g, ''))))
    d.codigoDemo = conta ? { email: conta.email, codigo: '123456', canal } : null
    gravar()
    return 'Se o cadastro existir, enviamos um código de 6 dígitos. Ele vale por 10 minutos. (Demonstração: use 123456)'
  },
  async redefinirSenha(identificador, codigo, senha) {
    const d = db()
    if (!d.codigoDemo || codigo !== d.codigoDemo.codigo) throw new Error('Código incorreto. Na demonstração, use 123456.')
    if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha))
      throw new Error('A nova senha precisa de 8 caracteres ou mais, com letras e números.')
    const conta = d.contas.find((c) => c.email === d.codigoDemo.email)
    Object.assign(conta, { senha, precisa_trocar_senha: false })
    d.codigoDemo = null
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
      const depois = marcarDatas(antes, { ...antes, ...campos })
      d.processos = d.processos.map((x) => (x.id === campos.id ? depois : x))
      campos.avisos = simularAvisos(depois, avisosDaMudanca(antes, depois))
    } else {
      Object.assign(campos, {
        id: novoId(),
        criado_em: new Date().toISOString(),
        solucao_financeira: campos.solucao_financeira || 'pendente',
      })
      marcarDatas({}, campos)
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
    // anexar o projeto inicial marca a etapa como enviada (como o gatilho do banco)
    const p = d.processos.find((x) => x.id === processoId)
    if (categoria === 'projeto_inicial' && !p.projeto_inicial_enviado) {
      const antes = { ...p }
      marcarDatas(antes, Object.assign(p, { projeto_inicial_enviado: true }))
      simularAvisos(p, avisosDaMudanca(antes, p))
    }
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
    const proc = d.processos.find((x) => x.id === a.processo_id)
    if (a.tipo === 'projeto_final' && proc) proc.projeto_assinado_em = proc.projeto_assinado_em || a.assinado_em
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
  async listarCampanhas() {
    return db().campanhas || []
  },
  async meuPerfil() {
    const d = db()
    const email = d.sessao?.email
    return { receber_novidades: true, ...(d.perfisCliente?.[email] || {}), email }
  },
  async salvarMeuPerfil(dados) {
    const d = db()
    const email = d.sessao.email
    d.perfisCliente = d.perfisCliente || {}
    const novo = { ...(d.perfisCliente[email] || {}), ...limparPerfil(dados), atualizado_em: new Date().toISOString() }
    d.perfisCliente[email] = novo
    // mesma sincronização do gatilho do banco
    d.processos.filter((p) => p.cliente_email === email).forEach((p) => {
      if (novo.telefone) p.cliente_telefone = novo.telefone
      if (novo.nascimento) p.cliente_nascimento = novo.nascimento
      p.aceita_marketing = novo.receber_novidades !== false
    })
    gravar()
    return { ...novo, email }
  },
  async enviarFotoPerfil(blob) {
    const dataUrl = await new Promise((ok, erro) => {
      const r = new FileReader()
      r.onload = () => ok(r.result)
      r.onerror = erro
      r.readAsDataURL(blob)
    })
    await this.salvarMeuPerfil({ foto_path: dataUrl })
    return dataUrl
  },
  async removerFotoPerfil() {
    await this.salvarMeuPerfil({ foto_path: null })
  },
  async urlFotoPerfil(caminho) {
    return caminho || null
  },
  async perfilDoCliente(email) {
    return db().perfisCliente?.[email] || null
  },
  async salvarCampanha(c) {
    const d = db()
    d.campanhas = d.campanhas || []
    if (c.id) {
      d.campanhas = d.campanhas.map((x) => (x.id === c.id ? { ...x, ...c } : x))
      gravar()
      return d.campanhas.find((x) => x.id === c.id)
    }
    const nova = { ...c, id: novoId(), status: 'rascunho', total: 0, enviados: 0, falhas: 0, criado_em: new Date().toISOString() }
    d.campanhas.unshift(nova)
    gravar()
    return nova
  },
  async enviarCampanha(campanhaId, processoIds) {
    const d = db()
    const emails = new Set(
      d.processos.filter((p) => processoIds.includes(p.id) && p.aceita_marketing !== false).map((p) => p.cliente_email.toLowerCase())
    )
    if (!emails.size) throw new Error('Nenhum dos clientes escolhidos aceita receber novidades.')
    const c = d.campanhas.find((x) => x.id === campanhaId)
    Object.assign(c, { status: 'enviada', total: emails.size, enviados: emails.size, falhas: 0, enviada_em: new Date().toISOString(), simulada: true })
    gravar()
    return { total: emails.size, enviados: emails.size, falhas: 0 }
  },
  contasDemo() {
    return { senha: SENHA_DEMO, contas: db().contas }
  },
}

export const api = MODO_DEMO ? demoApi : supabaseApi
