// Camada de dados. Usa o Supabase quando as variáveis VITE_SUPABASE_* existem;
// caso contrário roda em modo demonstração, com dados de exemplo no navegador.
import { createClient } from '@supabase/supabase-js'
import { criarDadosDemo, SENHA_DEMO } from './demo.js'
import { calcularTipoPrazo, cpfValido, telefoneNumeros, ehInterna } from './constants.js'
import { avisosDaMudanca, avisoAssinatura, telefoneWhatsApp } from './avisos.js'
import { temPermissao } from './permissoes.js'
import { lerXmlPromob, LIMITE_XML } from './promob.js'
import { errosCliente, errosAmbiente, numeros } from './cadastro.js'
import { prepararImagem } from './imagem.js'
import { ORIGENS_PADRAO, MOTIVOS_PADRAO, COLUNAS_PADRAO } from './comercial.js'
import { comercialSupabase, comercialDemo } from './apiComercial.js'
import { ferramentasSupabase, ferramentasDemo } from './apiFerramentas.js'

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
// (nome, nascimento e endereço são cadastrados pela loja; o banco também trava esses campos)
const CAMPOS_PERFIL = ['telefone', 'instagram', 'receber_novidades', 'foto_path']
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
  'cliente_nascimento', 'aceita_marketing', 'numero_contrato', 'vendedor_id', 'cidade', 'bairro', 'cep', 'tipo_prazo',
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

// ---------------------------------------------------------------- Contratos e ambientes (regras comuns)
const CAMPOS_AMBIENTE = ['id', 'processo_id', 'ordem', 'nome', 'linha', 'tipo', 'fornecedor', 'corpo', 'porta', 'complemento',
  'puxador', 'modelo', 'observacoes', 'qtd', 'prazo', 'valor_bruto', 'valor']
function limparAmbiente(a) {
  const out = {}
  for (const k of CAMPOS_AMBIENTE) {
    if (!(k in a)) continue
    let v = typeof a[k] === 'string' ? a[k].trim() : a[k]
    if (v === '') v = null
    if (['qtd', 'prazo', 'valor_bruto', 'valor'].includes(k) && v !== null) v = Number(v)
    out[k] = v
  }
  return out
}
// valida o pedido de criação antes de mandar ao servidor (o servidor valida de novo)
function validarPedidoContrato(dados) {
  const e = errosCliente(dados.cliente)
  if (Object.keys(e).length) throw new Error(Object.values(e)[0])
  if (!dados.contrato?.loja) throw new Error('Escolha a loja ou canal de origem.')
  if (!dados.ambientes?.length) throw new Error('Cadastre pelo menos um ambiente.')
  dados.ambientes.forEach((a, i) => {
    const ea = errosAmbiente(a)
    if (Object.keys(ea).length) throw new Error(`Ambiente ${i + 1}: ${Object.values(ea)[0]}`)
  })
}
async function prepararXml(arquivo) {
  if (!/\.xml$/i.test(arquivo.name)) throw new Error('Envie o arquivo .xml exportado do Promob.')
  if (arquivo.size > LIMITE_XML) throw new Error('O XML passa de 20 MB.')
  const texto = await arquivo.text()
  let pecas = null
  let erro = null
  try {
    pecas = lerXmlPromob(texto)
  } catch (e) {
    erro = e.message
  }
  return { texto, pecas, erro }
}
const arquivoBase64 = (arquivo) => new Promise((ok, falha) => {
  const r = new FileReader()
  r.onload = () => ok(String(r.result).split(',')[1])
  r.onerror = falha
  r.readAsDataURL(arquivo)
})

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
    const { data: pasta } = await sb.from('pasta_documentos').select('arquivo_path').eq('processo_id', id)
    const { data, error } = await sb.from('processos').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Você não tem permissão para excluir clientes. Peça ao master.')
    const arquivos = [...(docs || []), ...(pasta || [])].map((d) => d.arquivo_path)
    if (arquivos.length) await sb.storage.from('documentos').remove(arquivos)
  },
  async enviarDocumento(processoId, { titulo, categoria }, arquivo) {
    validarArquivo(arquivo)
    arquivo = await prepararImagem(arquivo)
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
  // o que o cliente vê do próprio contrato: total, ambientes (valor do contrato) e parcelas
  async valoresContrato(processoId) {
    const { data, error } = await sb.rpc('valores_do_meu_contrato', { pid: processoId })
    if (error) throw new Error(error.message)
    return data
  },
  // ---------------- Gestão de clientes (cadastro único = processo do portal)
  async listarGestao() {
    const { data, error } = await sb.from('processos').select(SELECT_GESTAO).order('data_venda', { ascending: false })
    if (error) throw error
    return data.map(normalizarGestao)
  },
  async clienteGestao(id) {
    const { data, error } = await sb.from('processos').select(SELECT_GESTAO).eq('id', id).single()
    if (error) throw error
    return normalizarGestao(data)
  },
  async salvarClienteGestao({ processo, comercial, controle }) {
    // o cadastro do cliente é um só: nome, CPF, e-mail, telefone e nascimento vão para "clientes" (o banco repassa aos contratos)
    if (processo.cliente_id) {
      const { error: e1 } = await sb.from('clientes').update({
        nome: processo.cliente_nome, cpf: String(processo.cliente_cpf || '').replace(/\D/g, '') || null,
        email: processo.cliente_email?.trim().toLowerCase() || null, telefone: processo.cliente_telefone || null,
        nascimento: processo.cliente_nascimento || null,
      }).eq('id', processo.cliente_id)
      if (e1) throw new Error(e1.code === '23505' ? 'Este CPF já é de outro cliente.' : 'Não foi possível salvar o cliente: ' + e1.message)
    }
    const p = await this.salvarProcesso(processo)
    if (comercial) {
      const { error } = await sb.from('comercial').upsert(limparComercial({ ...comercial, id: p.id }))
      if (error) throw new Error('Não foi possível salvar os dados comerciais: ' + error.message)
    }
    if (controle) await this.salvarControleInterno(p.id, controle)
    return this.clienteGestao(p.id)
  },
  // importação da planilha de gestão: pula códigos que já existem
  async importarGestao(registros, aoAvancar) {
    const { data: existentes, error: e0 } = await sb.from('processos').select('codigo')
    if (e0) throw e0
    const ja = new Set(existentes.map((x) => x.codigo))
    const novos = registros.filter((r) => !ja.has(r.processo.codigo))
    let feitos = 0
    for (let i = 0; i < novos.length; i += 50) {
      const lote = novos.slice(i, i + 50)
      const { data, error } = await sb.from('processos').insert(lote.map((r) => limpar(r.processo))).select('id, codigo')
      if (error) throw new Error(`Erro ao importar (linhas ${i + 1}–${i + lote.length}): ${error.message}`)
      const id = Object.fromEntries(data.map((x) => [x.codigo, x.id]))
      const com = lote.map((r) => limparComercial({ ...r.comercial, id: id[r.processo.codigo] }))
      const ctl = lote.map((r) => limparControle({ ...r.controle, id: id[r.processo.codigo] }))
      const a = await sb.from('comercial').upsert(com)
      if (a.error) throw new Error('Erro nos dados comerciais: ' + a.error.message)
      const b = await sb.from('controle_interno').upsert(ctl)
      if (b.error) throw new Error('Erro no controle interno: ' + b.error.message)
      feitos += lote.length
      aoAvancar?.(feitos, novos.length)
    }
    return { importados: feitos, pulados: registros.length - novos.length }
  },
  // ---------------- Cadastro de clientes e contratos
  async lojas() {
    const { data, error } = await sb.from('lojas').select('*').eq('ativa', true).order('ordem')
    if (error) throw error
    return data
  },
  async procurarCliente({ cpf, email, telefone }) {
    const { data, error } = await sb.rpc('procurar_cliente', { cpf_: numeros(cpf) || null, email_: email || null, telefone_: telefone || null })
    if (error) throw new Error(error.message)
    return data
  },
  async cliente(id) {
    const { data, error } = await sb.from('clientes').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  },
  async criarContrato(dados) {
    validarPedidoContrato(dados)
    const { data, error } = await sb.rpc('criar_contrato', { dados })
    if (error) throw new Error(error.message)
    return data
  },
  async numeracaoContratos() {
    const { data, error } = await sb.rpc('numeracao_contratos')
    if (error) throw new Error(error.message)
    return data
  },
  async definirNumeracao(proximo) {
    const { error } = await sb.rpc('definir_numeracao', { proximo: Number(proximo) })
    if (error) throw new Error(error.message)
  },
  async ambientes(processoId) {
    const { data, error } = await sb.from('ambientes').select('*').eq('processo_id', processoId).order('ordem')
    if (error) throw error
    return data
  },
  async salvarAmbiente(a) {
    const e = errosAmbiente(a)
    if (Object.keys(e).length) throw new Error(Object.values(e)[0])
    const { data, error } = await sb.from('ambientes').upsert(limparAmbiente(a)).select().single()
    if (error) throw new Error('Não foi possível salvar o ambiente: ' + error.message)
    return data
  },
  async excluirAmbiente(a) {
    if (a.xml_path) await sb.storage.from('documentos').remove([a.xml_path])
    const { error } = await sb.from('ambientes').delete().eq('id', a.id)
    if (error) throw new Error('Não foi possível remover o ambiente: ' + error.message)
  },
  // guarda o XML original e a listagem de peças (quando o formato é reconhecido)
  async enviarXmlAmbiente(a, arquivo) {
    const { pecas, erro } = await prepararXml(arquivo)
    const seguro = arquivo.name.normalize('NFD').replace(/[^\w.-]+/g, '_')
    const caminho = `${a.processo_id}/interno/promob/${a.id}-${Date.now()}-${seguro}`
    const up = await sb.storage.from('documentos').upload(caminho, arquivo, { contentType: 'application/xml' })
    if (up.error) throw new Error('Não foi possível guardar o XML: ' + up.error.message)
    const { data, error } = await sb.from('ambientes').update({
      xml_path: caminho, xml_nome: arquivo.name, xml_enviado_em: new Date().toISOString(), pecas, pecas_erro: erro,
    }).eq('id', a.id).select().single()
    if (error) {
      await sb.storage.from('documentos').remove([caminho])
      throw new Error('Não foi possível salvar o XML: ' + error.message)
    }
    if (a.xml_path) await sb.storage.from('documentos').remove([a.xml_path])
    return data
  },
  async urlXmlAmbiente(a) {
    const { data, error } = await sb.storage.from('documentos').createSignedUrl(a.xml_path, 300, { download: a.xml_nome || true })
    if (error) throw error
    return data.signedUrl
  },
  async lerDocumento(arquivo) {
    if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) throw new Error('Envie uma foto do documento (JPG, PNG ou WEBP).')
    return chamarFuncao('ler-documento', { imagem: await arquivoBase64(arquivo), tipo: arquivo.type })
  },
  async listarVendedores() {
    const { data, error } = await sb.from('perfis').select('id, nome, email, papel').in('papel', ['vendedor', 'admin']).order('nome')
    if (error) throw error
    return data
  },
  async documentosPasta(processoId) {
    const { data, error } = await sb.from('pasta_documentos').select('*').eq('processo_id', processoId).order('criado_em')
    if (error) throw error
    return data
  },
  async enviarDocumentoPasta(processoId, categoria, arquivo) {
    validarArquivoPasta(arquivo)
    const seguro = arquivo.name.normalize('NFD').replace(/[^\w.-]+/g, '_')
    const caminho = `${processoId}/pasta/${Date.now()}-${seguro}`
    const up = await sb.storage.from('documentos').upload(caminho, arquivo, { contentType: arquivo.type })
    if (up.error) throw up.error
    const { error } = await sb.from('pasta_documentos').insert({ processo_id: processoId, categoria, titulo: arquivo.name, arquivo_path: caminho, tipo_mime: arquivo.type })
    if (error) throw error
  },
  async excluirDocumentoPasta(doc) {
    await sb.storage.from('documentos').remove([doc.arquivo_path])
    const { error } = await sb.from('pasta_documentos').delete().eq('id', doc.id)
    if (error) throw error
  },
  async urlDocumentoPasta(doc) {
    const { data, error } = await sb.storage.from('documentos').createSignedUrl(doc.arquivo_path, 600)
    if (error) throw error
    return data.signedUrl
  },
  async arquivoDocumentoPasta(doc) {
    return (await fetch(await this.urlDocumentoPasta(doc))).arrayBuffer()
  },
  async fecharPasta(processoId) {
    const { error } = await sb.from('comercial').upsert({ id: processoId, pasta_fechada_em: new Date().toISOString() })
    if (error) throw error
  },
  // ---------------- Comercial: listas configuráveis
  async comercialListas() {
    const [o, m, c] = await Promise.all([
      sb.from('origens_lead').select('*').order('ordem'),
      sb.from('motivos_perda').select('*').order('ordem'),
      sb.from('crm_colunas').select('*').order('ordem'),
    ])
    const erro = o.error || m.error || c.error
    if (erro) throw new Error(erro.message)
    return { origens_lead: o.data, motivos_perda: m.data, crm_colunas: c.data }
  },
  async salvarItemLista(tabela, item) {
    if (!['origens_lead', 'motivos_perda', 'crm_colunas'].includes(tabela)) throw new Error('Lista inválida.')
    const { error } = await sb.from(tabela).upsert(item)
    if (error) throw new Error(error.code === '23505' ? 'Já existe um item com esse nome.' : error.message)
  },
  async vendedoresComercial() {
    const { data, error } = await sb.rpc('vendedores_comercial')
    if (error) throw new Error(error.message)
    return data
  },
  // ---------------- Usuários internos (master)
  async listarUsuarios() {
    const { data, error } = await sb.from('perfis').select('id, email, nome, papel, permissoes, whatsapp, ativo, criado_em').neq('papel', 'cliente').order('nome')
    if (error) throw error
    return data
  },
  async definirAcesso(id, papel, permissoes, nome, whatsapp) {
    const { error } = await sb.rpc('definir_acesso', { usuario: id, novo_papel: papel, novas_permissoes: permissoes, novo_nome: nome || null, novo_whatsapp: whatsapp || null })
    if (error) throw new Error(error.message)
  },
  async criarUsuario(dados) {
    return chamarFuncao('criar-usuario', dados)
  },
  async trocarEmail(novo) {
    const { error } = await sb.auth.updateUser({ email: novo.trim().toLowerCase() })
    if (error) throw new Error('Não foi possível trocar o e-mail: ' + error.message)
    return 'Enviamos um link de confirmação para o novo e-mail. A troca vale depois que você confirmar.'
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
const CHAVE_DEMO = 'portal-airam-demo-v18'
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
function gravar(estrito = false) {
  try {
    localStorage.setItem(CHAVE_DEMO, JSON.stringify(memoria))
  } catch (e) {
    if (estrito) throw e
  }
}
const avisar = () => ouvintes.forEach((cb) => cb(db().sessao))
// dados do Comercial na demonstração (criados na primeira vez, sem apagar o resto)
function garantirComercial(d) {
  if (!d.comercialListas) {
    d.comercialListas = {
      origens_lead: ORIGENS_PADRAO.map((nome, i) => ({ id: `o${i}`, nome, ativa: true, ordem: nome === 'Outro' ? 99 : i + 1 })),
      motivos_perda: MOTIVOS_PADRAO.map(([nome, pede_texto], i) => ({ id: `m${i}`, nome, pede_texto, ativa: true, ordem: nome === 'Outro' ? 99 : i + 1 })),
      crm_colunas: COLUNAS_PADRAO.map(([id, nome, tipo, ordem]) => ({ id, nome, tipo, ordem, ativa: true })),
    }
    d.leads = d.leads || []
    d.leadArquivos = d.leadArquivos || []
    d.agendamentos = d.agendamentos || []
    d.leadEventos = d.leadEventos || []
    d.lembretes = d.lembretes || []
    d.briefings = d.briefings || {}
    d.avisosEquipe = d.avisosEquipe || []
    gravar()
  }
  return d
}
const novoId = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2)
const comTipo = (p) => ({ ...p, tipo_prazo: calcularTipoPrazo(p.data_venda, p.data_disponivel_medicao) || p.tipo_prazo || 'normal' })
// quem está logado na demonstração e o que pode ver (mesmas regras do banco)
const contaAtual = (d) => d.contas.find((c) => c.email === d.sessao?.email)
function visiveis(d) {
  const conta = contaAtual(d)
  if (!conta) return []
  if (conta.papel === 'cliente') return d.processos.filter((p) => p.cliente_email === conta.email)
  if (temPermissao(conta, 'ver_todos')) return d.processos
  return d.processos.filter((p) => p.vendedor_id === conta.email)
}

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
  'entregue', 'previsao_entrega', 'vistoria_obs', 'pos_vistoria',
]
function limparControle(c) {
  const out = { id: c.id }
  for (const k of CAMPOS_CONTROLE) out[k] = c[k] === '' || c[k] === undefined ? null : typeof c[k] === 'string' ? c[k].trim() || null : c[k]
  return out
}

// Gestão de clientes: dados comerciais (internos) da venda
const CAMPOS_COMERCIAL = [
  'vendedor_nome', 'captacao', 'loja', 'financeira', 'forma_pagamento', 'valor_venda', 'valor_deflacionado', 'valor_entrada',
  'valor_parcela', 'vencimento_primeira', 'meios', 'situacao', 'observacao', 'cliente_meu', 'envio_email', 'assinatura_inicial',
  'avaliacao_google', 'bruto_promob', 'pedido_fabrica', 'contrato',
]
const NUMEROS_COMERCIAL = ['valor_venda', 'valor_deflacionado', 'valor_entrada', 'valor_parcela', 'bruto_promob']
export function numeroBR(x) {
  if (x === '' || x === null || x === undefined) return null
  if (typeof x === 'number') return Number.isFinite(x) ? x : null
  // aceita 1234.56 (campo numérico) e 1.234,56 (digitado no formato brasileiro)
  const t = String(x).trim().replace(/^R\$\s*/, '')
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : null
}
function limparComercial(c) {
  const out = { id: c.id }
  for (const k of CAMPOS_COMERCIAL) {
    if (!(k in c)) continue
    let x = c[k]
    if (typeof x === 'string') x = x.trim()
    if (x === '' || x === undefined) x = null
    if (NUMEROS_COMERCIAL.includes(k)) x = numeroBR(x)
    out[k] = x
  }
  if ('meios' in c) out.meios = Array.isArray(c.meios) ? c.meios : []
  if (!out.situacao && 'situacao' in c) out.situacao = 'pendente'
  return out
}
// linha da gestão: processo + comercial + controle interno + pasta
function normalizarGestao(r) {
  const um = (x) => (Array.isArray(x) ? x[0] : x) || {}
  const { comercial, controle_interno, pasta_documentos, ...p } = r
  return { ...p, comercial: um(comercial), controle: um(controle_interno), pasta: pasta_documentos || [] }
}
const SELECT_GESTAO = '*, assinaturas(id, tipo, status, assinado_em), comercial(*), controle_interno(*), pasta_documentos(id, categoria)'
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
    if (conta.ativo === false) throw new Error('Este usuário foi desativado. Fale com o master.')
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
    return conta ? { id: conta.email, email: conta.email, nome: conta.nome, papel: conta.papel, permissoes: conta.permissoes || {}, precisa_trocar_senha: conta.precisa_trocar_senha, ativo: conta.ativo !== false, whatsapp: conta.whatsapp || null } : null
  },
  async listarProcessos() {
    const d = db()
    return visiveis(d).map((p) => ({ ...comTipo(p), assinaturas: d.assinaturas.filter((a) => a.processo_id === p.id) }))
  },
  async processo(id) {
    const d = db()
    const conta = contaAtual(d)
    const p = visiveis(d).find((x) => x.id === id)
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
    // o número do contrato é único; o CPF é único no cadastro de clientes (um cliente pode ter vários contratos)
    const conflito = d.processos.find((x) => x.id !== campos.id && x.codigo === campos.codigo)
    if (conflito) throw new Error('Já existe um contrato com esse número.')
    const outroCliente = campos.cliente_cpf && d.processos.find((x) => x.id !== campos.id && x.cliente_cpf === campos.cliente_cpf
      && (x.cliente_id || x.id) !== (campos.cliente_id || d.processos.find((y) => y.id === campos.id)?.cliente_id || campos.id))
    if (outroCliente) throw new Error('Este CPF já é de outro cliente.')
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
    if (!temPermissao(contaAtual(d), 'excluir')) throw new Error('Você não tem permissão para excluir clientes. Peça ao master.')
    if (d.comercial) delete d.comercial[id]
    if (d.controles) delete d.controles[id]
    d.pastaDocs = (d.pastaDocs || []).filter((x) => x.processo_id !== id)
    d.processos = d.processos.filter((x) => x.id !== id)
    d.documentos = d.documentos.filter((x) => x.processo_id !== id)
    d.assinaturas = d.assinaturas.filter((x) => x.processo_id !== id)
    gravar()
  },
  async enviarDocumento(processoId, { titulo, categoria }, arquivo) {
    validarArquivo(arquivo)
    arquivo = await prepararImagem(arquivo)
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
  // ---------------- Gestão de clientes (cadastro único = processo do portal)
  async listarGestao() {
    const d = db()
    const conta = contaAtual(d)
    const gestao = temPermissao(conta, 'gestao')
    return visiveis(d)
      .map((p) => ({
        ...comTipo(p),
        assinaturas: d.assinaturas.filter((a) => a.processo_id === p.id),
        comercial: gestao ? (d.comercial || {})[p.id] || {} : {},
        controle: (d.controles || {})[p.id] || {},
        pasta: (d.pastaDocs || []).filter((x) => x.processo_id === p.id).map(({ id, categoria }) => ({ id, categoria })),
      }))
      .sort((a, b) => (b.data_venda || '').localeCompare(a.data_venda || ''))
  },
  async clienteGestao(id) {
    const r = (await this.listarGestao()).find((x) => x.id === id)
    if (!r) throw new Error('Cliente não encontrado')
    return r
  },
  async salvarClienteGestao({ processo, comercial, controle }) {
    const d = db()
    const conta = contaAtual(d)
    if (!temPermissao(conta, 'ver_todos') && processo.vendedor_id !== conta.email) throw new Error('Você só pode cadastrar vendas suas.')
    const p = await this.salvarProcesso(processo)
    const cli = processo.cliente_id && (d.clientes || []).find((x) => x.id === processo.cliente_id)
    if (cli) {
      Object.assign(cli, { nome: p.cliente_nome, cpf: p.cliente_cpf || cli.cpf, email: p.cliente_email, telefone: p.cliente_telefone, nascimento: p.cliente_nascimento })
      d.processos.filter((x) => x.cliente_id === cli.id && x.id !== p.id).forEach((x) => Object.assign(x, { cliente_nome: cli.nome, cliente_cpf: p.cliente_cpf, cliente_email: cli.email, cliente_telefone: cli.telefone }))
    }
    if (comercial) {
      d.comercial = d.comercial || {}
      d.comercial[p.id] = { ...(d.comercial[p.id] || {}), ...limparComercial({ ...comercial, id: p.id }), atualizado_em: new Date().toISOString() }
    }
    if (controle) await this.salvarControleInterno(p.id, controle)
    gravar()
    return this.clienteGestao(p.id)
  },
  async importarGestao(registros, aoAvancar) {
    const d = db()
    const conta = contaAtual(d)
    if (!temPermissao(conta, 'ver_todos')) throw new Error('Só quem vê todos os clientes pode importar a planilha.')
    const ja = new Set(d.processos.map((x) => x.codigo))
    const novos = registros.filter((r) => !ja.has(r.processo.codigo))
    d.comercial = d.comercial || {}
    d.controles = d.controles || {}
    for (const r of novos) {
      const p = { ...limpar(r.processo), id: novoId(), criado_em: new Date().toISOString() }
      p.tipo_prazo = calcularTipoPrazo(p.data_venda, p.data_disponivel_medicao)
      if (p.entrega_concluida) p.montagem_concluida_em = p.data_entrega_prevista || p.data_venda
      d.processos.push(p)
      d.comercial[p.id] = limparComercial({ ...r.comercial, id: p.id })
      d.controles[p.id] = limparControle({ ...r.controle, id: p.id })
    }
    gravar()
    aoAvancar?.(novos.length, novos.length)
    return { importados: novos.length, pulados: registros.length - novos.length }
  },
  // ---------------- Cadastro de clientes e contratos (demonstração: mesmas regras do servidor)
  async lojas() {
    return [{ id: 'guarulhos', nome: 'Loja Guarulhos' }, { id: 'mooca', nome: 'Loja Mooca' }, { id: 'online', nome: 'Online' }]
  },
  async procurarCliente({ cpf, email, telefone }) {
    const d = db()
    const doc = numeros(cpf)
    const tel = numeros(telefone)
    const conta = contaAtual(d)
    return (d.clientes || []).filter((c) => (doc && c.cpf === doc) || (email && c.email === email.trim().toLowerCase()) || (tel.length >= 10 && numeros(c.telefone) === tel))
      .slice(0, 5).map((c) => ({
        id: c.id, nome: c.nome, motivo: doc && c.cpf === doc ? 'cpf' : email && c.email === email.trim().toLowerCase() ? 'email' : 'telefone',
        posso_ver: temPermissao(conta, 'ver_todos') || c.criado_por === conta.email || d.processos.some((p) => p.cliente_id === c.id && p.vendedor_id === conta.email),
        contratos: d.processos.filter((p) => p.cliente_id === c.id).length,
      }))
  },
  async cliente(id) {
    return (db().clientes || []).find((c) => c.id === id) || null
  },
  async criarContrato(dados) {
    validarPedidoContrato(dados)
    const d = db()
    const conta = contaAtual(d)
    if (!temPermissao(conta, 'gestao')) throw new Error('Você não tem permissão para criar contratos.')
    d.clientes = d.clientes || []
    d.ambientesDemo = d.ambientesDemo || []
    d.chaves = d.chaves || {}
    if (d.chaves[dados.chave]) return { ...d.chaves[dados.chave], repetido: true }
    const c = dados.cliente
    const doc = numeros(c.cpf)
    let cli = dados.cliente_id ? d.clientes.find((x) => x.id === dados.cliente_id) : d.clientes.find((x) => x.cpf === doc)
    if (cli && d.clientes.some((x) => x.cpf === doc && x.id !== cli.id)) throw new Error('Este CPF já é de outro cliente.')
    const campos = { ...c, cpf: doc, email: c.email.trim().toLowerCase(), uf: c.uf.toUpperCase() }
    if (cli) Object.assign(cli, campos)
    else {
      cli = { ...campos, id: novoId(), criado_por: conta.email, criado_em: new Date().toISOString() }
      d.clientes.push(cli)
    }
    const vendedor = temPermissao(conta, 'ver_todos') && dados.contrato.vendedor_id ? d.contas.find((x) => x.email === dados.contrato.vendedor_id) || conta : conta
    let n = d.seqContrato || 100002126
    while (d.processos.some((x) => x.codigo === String(n))) n++ // como a sequência do banco: nunca repete
    const codigo = String(n)
    d.seqContrato = n + 1
    const hoje = new Date().toISOString().slice(0, 10)
    const total = dados.ambientes.reduce((t, a) => t + Number(a.valor === '' || a.valor == null ? a.valor_bruto : a.valor) * (Number(a.qtd) || 1), 0)
    const p = {
      id: novoId(), codigo, numero_contrato: codigo, cliente_id: cli.id, cliente_nome: cli.nome, cliente_cpf: doc.length === 11 ? doc : null,
      cliente_email: cli.email, cliente_telefone: cli.telefone, cliente_nascimento: cli.nascimento || null,
      endereco: [[cli.logradouro, cli.numero].filter(Boolean).join(', ') + (cli.complemento ? ` - ${cli.complemento}` : ''), cli.bairro, cli.cidade].filter(Boolean).join(' — '),
      cep: cli.cep, bairro: cli.bairro, cidade: cli.cidade, data_venda: dados.contrato.data || hoje,
      data_disponivel_medicao: dados.contrato.imovel_pronto || dados.contrato.data || hoje, tipo_prazo: dados.contrato.tipo === 'Futura' ? 'futuro' : 'normal',
      solucao_financeira: 'pendente', vendedor_id: vendedor.email, ambientes: dados.ambientes.map((a) => a.nome).join(', '),
      medicao_concluida: false, conferencia_concluida: false, projeto_assinado_manual: false, entrega_concluida: false, projeto_inicial_enviado: false,
      notificar: true, criado_em: new Date().toISOString(),
    }
    d.processos.unshift(p)
    dados.ambientes.forEach((a, i) => d.ambientesDemo.push({ ...limparAmbiente(a), id: novoId(), processo_id: p.id, ordem: i + 1, valor: a.valor === '' || a.valor == null ? Number(a.valor_bruto) : Number(a.valor) }))
    const com = dados.comercial || {}
    const { vendedor_id, loja, ...resto } = dados.contrato
    d.comercial = d.comercial || {}
    d.comercial[p.id] = { id: p.id, vendedor_nome: vendedor.nome, captacao: com.captacao || null, loja, financeira: com.financeira || null,
      forma_pagamento: com.forma_pagamento || null, meios: com.meios || [], valor_venda: total, vencimento_primeira: com.vencimento_primeira || null,
      valor_entrada: com.valor_entrada || null, situacao: 'pendente', observacao: com.observacao || null, contrato: resto }
    d.controles = d.controles || {}
    d.controles[p.id] = { id: p.id }
    d.chaves[dados.chave] = { id: p.id, codigo, cliente_id: cli.id }
    gravar()
    return { id: p.id, codigo, cliente_id: cli.id, repetido: false }
  },
  async numeracaoContratos() {
    return { proximo: db().seqContrato || 100002126 }
  },
  async definirNumeracao(proximo) {
    const d = db()
    if (contaAtual(d)?.papel !== 'admin') throw new Error('Somente o master define a numeração.')
    const atual = d.seqContrato || 100002126
    if (Number(proximo) < atual) throw new Error(`A numeração só pode avançar: o próximo número precisa ser maior que ${atual - 1}.`)
    d.seqContrato = Number(proximo)
    gravar()
  },
  async ambientes(processoId) {
    return (db().ambientesDemo || []).filter((a) => a.processo_id === processoId).sort((a, b) => a.ordem - b.ordem)
  },
  async salvarAmbiente(a) {
    const e = errosAmbiente(a)
    if (Object.keys(e).length) throw new Error(Object.values(e)[0])
    const d = db()
    d.ambientesDemo = d.ambientesDemo || []
    const x = limparAmbiente(a)
    const i = d.ambientesDemo.findIndex((y) => y.id === x.id)
    if (i >= 0) d.ambientesDemo[i] = { ...d.ambientesDemo[i], ...x }
    else d.ambientesDemo.push({ ...x, id: novoId(), ordem: x.ordem || d.ambientesDemo.filter((y) => y.processo_id === x.processo_id).length + 1 })
    gravar()
    return i >= 0 ? d.ambientesDemo[i] : d.ambientesDemo[d.ambientesDemo.length - 1]
  },
  async excluirAmbiente(a) {
    const d = db()
    d.ambientesDemo = (d.ambientesDemo || []).filter((y) => y.id !== a.id)
    gravar()
  },
  async enviarXmlAmbiente(a, arquivo) {
    const { texto, pecas, erro } = await prepararXml(arquivo)
    const d = db()
    const x = (d.ambientesDemo || []).find((y) => y.id === a.id)
    Object.assign(x, { xml_path: 'data:application/xml;charset=utf-8,' + encodeURIComponent(texto.slice(0, 400000)), xml_nome: arquivo.name,
      xml_enviado_em: new Date().toISOString(), pecas, pecas_erro: erro })
    gravar()
    return x
  },
  async urlXmlAmbiente(a) {
    return a.xml_path
  },
  async lerDocumento() {
    throw new Error('A leitura automática do documento funciona no portal real, depois de configurar a chave da Anthropic no Supabase. Na demonstração, preencha à mão.')
  },
  async listarVendedores() {
    return db().contas.filter((c) => ['vendedor', 'admin'].includes(c.papel)).map((c) => ({ id: c.email, nome: c.nome, email: c.email, papel: c.papel }))
  },
  async documentosPasta(processoId) {
    return (db().pastaDocs || []).filter((x) => x.processo_id === processoId)
  },
  async enviarDocumentoPasta(processoId, categoria, arquivo) {
    validarArquivoPasta(arquivo)
    const dataUrl = await new Promise((ok, erro) => {
      const r = new FileReader()
      r.onload = () => ok(r.result)
      r.onerror = erro
      r.readAsDataURL(arquivo)
    })
    const d = db()
    d.pastaDocs = d.pastaDocs || []
    d.pastaDocs.push({ id: novoId(), processo_id: processoId, categoria, titulo: arquivo.name, arquivo_path: dataUrl, tipo_mime: arquivo.type, criado_em: new Date().toISOString() })
    gravar()
  },
  async excluirDocumentoPasta(doc) {
    const d = db()
    d.pastaDocs = (d.pastaDocs || []).filter((x) => x.id !== doc.id)
    gravar()
  },
  async urlDocumentoPasta(doc) {
    return doc.arquivo_path
  },
  async arquivoDocumentoPasta(doc) {
    return (await fetch(doc.arquivo_path)).arrayBuffer()
  },
  async fecharPasta(processoId) {
    const d = db()
    d.comercial = d.comercial || {}
    d.comercial[processoId] = { ...(d.comercial[processoId] || {}), pasta_fechada_em: new Date().toISOString() }
    gravar()
  },
  // ---------------- Comercial: listas configuráveis (demonstração)
  async comercialListas() {
    const d = garantirComercial(db())
    return JSON.parse(JSON.stringify(d.comercialListas))
  },
  async salvarItemLista(tabela, item) {
    const d = garantirComercial(db())
    if (!temPermissao(contaAtual(d), 'comercial_config')) throw new Error('Sem permissão para mudar as configurações.')
    const lista = d.comercialListas[tabela]
    if (!lista) throw new Error('Lista inválida.')
    if (lista.some((x) => x.nome.trim().toLowerCase() === String(item.nome || '').trim().toLowerCase() && x.id !== item.id)) throw new Error('Já existe um item com esse nome.')
    const i = lista.findIndex((x) => x.id === item.id)
    if (i >= 0) lista[i] = { ...lista[i], ...item }
    else lista.push({ ativa: true, ...item, id: item.id || novoId() })
    lista.sort((a, b) => a.ordem - b.ordem)
    gravar()
  },
  async vendedoresComercial() {
    const d = db()
    const conta = contaAtual(d)
    return d.contas.filter((c) => ['vendedor', 'gerente'].includes(c.papel) && c.ativo !== false && (temPermissao(conta, 'comercial_todos') || c.email === conta.email))
      .map((c) => ({ id: c.email, nome: c.nome, email: c.email, papel: c.papel }))
  },
  // ---------------- Usuários internos (master)
  async listarUsuarios() {
    return db().contas.filter((c) => c.papel !== 'cliente').map((c) => ({ id: c.email, email: c.email, nome: c.nome, papel: c.papel, permissoes: c.permissoes || {}, whatsapp: c.whatsapp || null, ativo: c.ativo !== false }))
  },
  async definirAcesso(id, papel, permissoes, nome, whatsapp) {
    const d = db()
    if (contaAtual(d)?.papel !== 'admin') throw new Error('Somente o master pode mudar acessos.')
    if (id === d.sessao.email && papel !== 'admin') throw new Error('Você não pode tirar o seu próprio acesso de master.')
    const zap = String(whatsapp || '').replace(/\D/g, '')
    if (zap && (zap.length < 10 || zap.length > 13)) throw new Error('WhatsApp inválido (use DDD + número).')
    const c = d.contas.find((x) => x.email === id)
    if (c.papel === 'admin' && papel !== 'admin' && d.contas.filter((x) => x.papel === 'admin').length <= 1) throw new Error('O sistema precisa de pelo menos um master.')
    Object.assign(c, { papel, permissoes: permissoes || {}, nome: nome || c.nome, whatsapp: zap || c.whatsapp || null })
    gravar()
  },
  async criarUsuario({ email, nome, papel, permissoes, whatsapp }) {
    const d = db()
    if (contaAtual(d)?.papel !== 'admin') throw new Error('Somente o master cria usuários.')
    const e = String(email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('E-mail inválido.')
    if (d.contas.some((c) => c.email === e)) throw new Error('Este e-mail já tem acesso.')
    const senha = 'Airam' + Math.floor(1000 + Math.random() * 9000)
    d.contas.push({ email: e, nome, papel, permissoes: permissoes || {}, whatsapp: String(whatsapp || '').replace(/\D/g, '') || null, senha, precisa_trocar_senha: true })
    gravar()
    return { id: e, senha }
  },
  async trocarEmail(novo) {
    const d = db()
    const e = String(novo || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('E-mail inválido.')
    if (d.contas.some((c) => c.email === e)) throw new Error('Este e-mail já está em uso.')
    const antigo = d.sessao.email
    d.contas.find((c) => c.email === antigo).email = e
    d.processos.filter((p) => p.cliente_email === antigo).forEach((p) => (p.cliente_email = e))
    if (d.perfisCliente?.[antigo]) { d.perfisCliente[e] = d.perfisCliente[antigo]; delete d.perfisCliente[antigo] }
    d.sessao.email = e
    gravar()
    return 'E-mail trocado. (No portal real, chega um link de confirmação no novo e-mail.)'
  },
  async liberarAcesso(processoId) {
    const d = db()
    const p = d.processos.find((x) => x.id === processoId)
    if (!p.cliente_email) throw new Error('Cadastre o e-mail do cliente antes de liberar o acesso.')
    const senha = 'Airam' + Math.floor(1000 + Math.random() * 9000)
    const existente = d.contas.find((c) => c.email === p.cliente_email)
    if (existente && existente.papel !== 'cliente')
      throw new Error('Este e-mail pertence a um funcionário. Use outro e-mail para o cliente.')
    if (existente) Object.assign(existente, { senha, precisa_trocar_senha: true, cpf: p.cliente_cpf })
    else
      d.contas.push({ email: p.cliente_email, cpf: p.cliente_cpf, nome: p.cliente_nome, papel: 'cliente', senha, precisa_trocar_senha: true })
    d.processos.filter((x) => x.cliente_email === p.cliente_email).forEach((x) => (x.acesso_liberado_em = new Date().toISOString()))
    gravar()
    return { senha, email: p.cliente_email, emailEnviado: false }
  },
  async valoresContrato(processoId) {
    const d = db()
    const p = visiveis(d).find((x) => x.id === processoId)
    const c = d.comercial?.[processoId]
    if (!p || !c) return null
    return {
      total: c.valor_venda, condicao: c.forma_pagamento, forma: c.contrato?.pagamento?.forma || null,
      parcelas: c.contrato?.pagamento?.parcelas || [],
      ambientes: (d.ambientesDemo || []).filter((a) => a.processo_id === processoId).sort((a, b) => a.ordem - b.ordem)
        .map((a) => ({ nome: a.nome, valor: Number(a.valor ?? a.valor_bruto) * (Number(a.qtd) || 1) })),
    }
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

if (sb) Object.assign(supabaseApi, comercialSupabase(sb, chamarFuncao), ferramentasSupabase(sb, chamarFuncao))
Object.assign(demoApi, comercialDemo({ db, gravar, contaAtual, novoId, garantir: garantirComercial }), ferramentasDemo({ db, gravar, contaAtual, novoId }), {
  async lojas() {
    return (await this.todasLojas()).filter((l) => l.ativa)
  },
})

export const api = MODO_DEMO ? demoApi : supabaseApi
