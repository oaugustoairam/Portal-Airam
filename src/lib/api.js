// Camada de dados. Usa o Supabase quando as variáveis VITE_SUPABASE_* existem;
// caso contrário roda em modo demonstração, com dados de exemplo no navegador.
import { createClient } from '@supabase/supabase-js'
import { criarDadosDemo, SENHA_DEMO } from './demo.js'
import { calcularTipoPrazo, cpfValido, telefoneNumeros, ehInterna } from './constants.js'
import { avisosDaMudanca, avisoAssinatura, telefoneWhatsApp } from './avisos.js'

const url = import.meta.env.VITE_SUPABASE_URL
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY
export const MODO_DEMO = !url || !chave

const sb = MODO_DEMO ? null : createClient(url, chave)

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const EXTENSOES_PERMITIDAS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.dwg', '.promob', '.zip', '.docx']
// arquivos que o navegador costuma mandar sem tipo (ou com tipos variados)
const EXTENSOES_LIVRES = ['.dwg', '.promob', '.zip', '.docx']
const TAMANHO_MAXIMO = 50 * 1024 * 1024
const ERRO_LOGIN = 'Dados de acesso ou senha incorretos.'

// campos do "Meu perfil" que o próprio cliente edita
const CAMPOS_PERFIL = ['nome_preferido', 'sobrenome', 'telefone', 'telefone_2', 'instagram', 'nascimento', 'cep', 'endereco', 'numero',
  'complemento', 'bairro', 'cidade', 'uf', 'receber_novidades', 'foto_path']
function limparPerfil(d) {
  const out = {}
  for (const k of CAMPOS_PERFIL) if (k in d) out[k] = d[k] === '' ? null : d[k]
  if (out.cep) out.cep = String(out.cep).replace(/\D/g, '') || null
  return out
}

function validarArquivo(arquivo) {
  const nome = arquivo.name.toLowerCase()
  const extOk = EXTENSOES_PERMITIDAS.some((e) => nome.endsWith(e))
  const tipoOk = TIPOS_PERMITIDOS.includes(arquivo.type) || EXTENSOES_LIVRES.some((e) => nome.endsWith(e))
  if (!extOk || !tipoOk) throw new Error('Tipo de arquivo não aceito. Envie PDF, JPG, PNG, WEBP, DWG, Promob, ZIP ou DOCX.')
  if (arquivo.size > TAMANHO_MAXIMO) throw new Error('O arquivo passa de 50 MB.')
}

function caminhoArquivo(processoId, categoria, nome) {
  const seguro = nome.normalize('NFD').replace(/[^\w.-]+/g, '_')
  const pasta = ehInterna(categoria) ? `${processoId}/interno` : processoId
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
    const { data, error } = await sb.functions.invoke('entrar-cpf', { body: { identificador: id, senha } })
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
  // ---------------- Gestão de clientes (vendedores)
  async listarVendas(mes) {
    let q = sb.from('vendas').select('*, venda_documentos(id, categoria)').order('data_venda', { ascending: false, nullsFirst: false })
    if (mes) q = q.eq('mes', mes)
    const { data, error } = await q
    if (error) throw error
    return data
  },
  async salvarVenda(v) {
    const { data, error } = await sb.from('vendas').upsert(limparVenda(v)).select('*, venda_documentos(id, categoria)').single()
    if (error) throw new Error('Não foi possível salvar: ' + error.message)
    return data
  },
  async excluirVenda(id) {
    const { data: docs } = await sb.from('venda_documentos').select('arquivo_path').eq('venda_id', id)
    if (docs?.length) await sb.storage.from('documentos').remove(docs.map((d) => d.arquivo_path))
    const { error } = await sb.from('vendas').delete().eq('id', id)
    if (error) throw error
  },
  async documentosVenda(vendaId) {
    const { data, error } = await sb.from('venda_documentos').select('*').eq('venda_id', vendaId).order('criado_em')
    if (error) throw error
    return data
  },
  async enviarDocumentoVenda(vendaId, categoria, arquivo) {
    validarArquivoPasta(arquivo)
    const seguro = arquivo.name.normalize('NFD').replace(/[^\w.-]+/g, '_')
    const caminho = `vendas/${vendaId}/${Date.now()}-${seguro}`
    const up = await sb.storage.from('documentos').upload(caminho, arquivo, { contentType: arquivo.type })
    if (up.error) throw up.error
    const { error } = await sb.from('venda_documentos').insert({ venda_id: vendaId, categoria, titulo: arquivo.name, arquivo_path: caminho, tipo_mime: arquivo.type })
    if (error) throw error
  },
  async excluirDocumentoVenda(doc) {
    await sb.storage.from('documentos').remove([doc.arquivo_path])
    const { error } = await sb.from('venda_documentos').delete().eq('id', doc.id)
    if (error) throw error
  },
  async urlDocumentoVenda(doc) {
    const { data, error } = await sb.storage.from('documentos').createSignedUrl(doc.arquivo_path, 600)
    if (error) throw error
    return data.signedUrl
  },
  async arquivoDocumentoVenda(doc) {
    return (await fetch(await this.urlDocumentoVenda(doc))).arrayBuffer()
  },
  async fecharPasta(vendaId) {
    const { error } = await sb.from('vendas').update({ pasta_fechada_em: new Date().toISOString() }).eq('id', vendaId)
    if (error) throw error
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
  async controlesInternos(ids) {
    const { data, error } = await sb.from('controle_interno').select('*').in('id', ids)
    if (error) throw error
    return Object.fromEntries(data.map((c) => [c.id, c]))
  },
  async controleInterno(processoId) {
    const { data, error } = await sb.from('controle_interno').select('*').eq('id', processoId).maybeSingle()
    if (error) throw error
    return data || { id: processoId }
  },
  async salvarControleInterno(processoId, dados) {
    const { data, error } = await sb.from('controle_interno').upsert(limparControle({ ...dados, id: processoId })).select().single()
    if (error) throw new Error('Não foi possível salvar: ' + error.message)
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
const CHAVE_DEMO = 'portal-airam-demo-v16'
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

export const CAMPOS_CONTROLE = [
  'pendencia_resolvida_em', 'email_enviado_em', 'inicial_assinado_em', 'medido_em', 'liberador', 'liberador_recebeu_em',
  'conferido_em', 'conferencia_enviada_em', 'pdf_recebido_em', 'projeto_final_assinado_em', 'entregue_em',
  'montagem_inicio_em', 'montador', 'tem_att', 'vistoria_em', 'assistencia_retorno_max', 'assistencia_concluida_em', 'observacoes',
]
function limparControle(c) {
  const out = { id: c.id }
  for (const k of CAMPOS_CONTROLE) out[k] = c[k] === '' || c[k] === undefined ? null : typeof c[k] === 'string' ? c[k].trim() || null : c[k]
  return out
}

// Gestão de clientes: campos da venda que o vendedor edita
const CAMPOS_VENDA = [
  'mes', 'codigo', 'cliente_nome', 'vendedor', 'captacao', 'loja', 'data_venda', 'financeira', 'forma_pagamento',
  'valor_venda', 'valor_deflacionado', 'valor_entrada', 'valor_parcela', 'vencimento_primeira', 'meios', 'prazo_tipo',
  'previsao_imovel', 'envio_email', 'assinatura_inicial', 'avaliacao_google', 'bruto_promob', 'pedido_fabrica',
  'assinatura_projeto_final', 'prazo_limite_entrega', 'medicao_realizada', 'limite_projeto_final', 'observacao', 'situacao',
]
const NUMEROS_VENDA = ['valor_venda', 'valor_deflacionado', 'valor_entrada', 'valor_parcela', 'bruto_promob']
function limparVenda(v) {
  const out = v.id ? { id: v.id } : {}
  for (const k of CAMPOS_VENDA) {
    let x = v[k]
    if (typeof x === 'string') x = x.trim()
    if (x === '' || x === undefined) x = null
    if (NUMEROS_VENDA.includes(k) && x !== null) {
      // aceita 1234.56 (campo numérico) e 1.234,56 (digitado no formato brasileiro)
      const t = String(x)
      x = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
      if (!Number.isFinite(x)) x = null
    }
    out[k] = x
  }
  out.meios = Array.isArray(v.meios) ? v.meios : []
  if (!out.mes && out.data_venda) out.mes = out.data_venda.slice(0, 7)
  if (!out.cliente_nome) throw new Error('Informe o nome do cliente.')
  if (!out.mes) throw new Error('Informe a data da venda ou o mês do controle.')
  return out
}
const TIPOS_PASTA = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
function validarArquivoPasta(arquivo) {
  if (!TIPOS_PASTA.includes(arquivo.type)) throw new Error('Envie PDF ou foto (JPG, PNG ou WEBP).')
  if (arquivo.size > TAMANHO_MAXIMO) throw new Error('O arquivo passa de 50 MB.')
}

// Mesma regra do servidor: e-mail, CPF ou telefone do processo. Telefone usado por
// mais de um cliente não entra (ambíguo).
function acharContaDemo(d, identificador, soCliente = false) {
  const id = String(identificador || '').trim().toLowerCase()
  const lista = soCliente ? d.contas.filter((c) => c.papel === 'cliente') : d.contas
  if (id.includes('@')) return lista.find((c) => c.email === id)
  const n = id.replace(/\D/g, '')
  if (n.length === 11 && cpfValido(n)) {
    const porCpf = lista.find((c) => c.cpf === n)
    if (porCpf) return porCpf
  }
  const tel = telefoneNumeros(n)
  if (tel.length < 10) return undefined
  const emails = [...new Set(d.processos.filter((p) => telefoneNumeros(p.cliente_telefone) === tel).map((p) => p.cliente_email))]
  return emails.length === 1 ? lista.find((c) => c.email === emails[0] && c.papel === 'cliente') : undefined
}

const demoApi = {
  aoMudarSessao(cb) {
    ouvintes.add(cb)
    return () => ouvintes.delete(cb)
  },
  async entrar(identificador, senha) {
    const d = db()
    const conta = acharContaDemo(d, identificador)
    if (!conta || conta.senha !== senha) throw new Error(ERRO_LOGIN)
    d.sessao = { email: conta.email }
    gravar()
    avisar()
  },
  async recuperarSenha(identificador, canal) {
    const d = db()
    const conta = acharContaDemo(d, identificador, true)
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
      documentos: d.documentos.filter((x) => x.processo_id === id && !(cliente && ehInterna(x.categoria))),
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
  // ---------------- Gestão de clientes (vendedores)
  async listarVendas(mes) {
    const d = db()
    const docs = d.vendaDocs || []
    return (d.vendas || [])
      .filter((v) => !mes || v.mes === mes)
      .map((v) => ({ ...v, venda_documentos: docs.filter((x) => x.venda_id === v.id).map(({ id, categoria }) => ({ id, categoria })) }))
      .sort((a, b) => (b.data_venda || '').localeCompare(a.data_venda || ''))
  },
  async salvarVenda(v) {
    const d = db()
    d.vendas = d.vendas || []
    const limpo = limparVenda(v)
    if (limpo.id) d.vendas = d.vendas.map((x) => (x.id === limpo.id ? { ...x, ...limpo, atualizado_em: new Date().toISOString() } : x))
    else d.vendas.unshift({ ...limpo, id: novoId(), pasta_fechada_em: null, criado_em: new Date().toISOString() })
    gravar()
    const id = limpo.id || d.vendas[0].id
    return (await this.listarVendas()).find((x) => x.id === id)
  },
  async excluirVenda(id) {
    const d = db()
    d.vendas = (d.vendas || []).filter((x) => x.id !== id)
    d.vendaDocs = (d.vendaDocs || []).filter((x) => x.venda_id !== id)
    gravar()
  },
  async documentosVenda(vendaId) {
    return (db().vendaDocs || []).filter((x) => x.venda_id === vendaId)
  },
  async enviarDocumentoVenda(vendaId, categoria, arquivo) {
    validarArquivoPasta(arquivo)
    const dataUrl = await new Promise((ok, erro) => {
      const r = new FileReader()
      r.onload = () => ok(r.result)
      r.onerror = erro
      r.readAsDataURL(arquivo)
    })
    const d = db()
    d.vendaDocs = d.vendaDocs || []
    d.vendaDocs.push({ id: novoId(), venda_id: vendaId, categoria, titulo: arquivo.name, arquivo_path: dataUrl, tipo_mime: arquivo.type, criado_em: new Date().toISOString() })
    gravar()
  },
  async excluirDocumentoVenda(doc) {
    const d = db()
    d.vendaDocs = (d.vendaDocs || []).filter((x) => x.id !== doc.id)
    gravar()
  },
  async urlDocumentoVenda(doc) {
    return doc.arquivo_path
  },
  async arquivoDocumentoVenda(doc) {
    return (await fetch(doc.arquivo_path)).arrayBuffer()
  },
  async fecharPasta(vendaId) {
    const d = db()
    const v = (d.vendas || []).find((x) => x.id === vendaId)
    if (v) v.pasta_fechada_em = new Date().toISOString()
    gravar()
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
  async controlesInternos(ids) {
    const c = db().controles || {}
    return Object.fromEntries(ids.filter((id) => c[id]).map((id) => [id, c[id]]))
  },
  async controleInterno(processoId) {
    return db().controles?.[processoId] || { id: processoId }
  },
  async salvarControleInterno(processoId, dados) {
    const d = db()
    d.controles = d.controles || {}
    d.controles[processoId] = { ...limparControle({ ...dados, id: processoId }), atualizado_em: new Date().toISOString(), atualizado_por: d.sessao.email }
    gravar()
    return d.controles[processoId]
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
