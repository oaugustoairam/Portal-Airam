// Dados do Comercial: leads, arquivos, agendamentos, histórico, lembretes, briefing, avisos e integrações.
// Duas versões com os mesmos métodos: Supabase (regras no banco, RLS e gatilhos) e demonstração
// (localStorage, repetindo as mesmas regras para o teste funcionar igual).
import { temPermissao } from './permissoes.js'
import { prepararImagem } from './imagem.js'
import { numeros, emailValido } from './cadastro.js'

export const TIPOS_ARQUIVO_LEAD = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'text/plain', 'image/vnd.dwg', 'application/zip']
const ACEITA_REDUZIR = ['image/jpeg', 'image/png', 'image/webp'] // fotos grandes viram WebP de 2400 px
const TAMANHO_MAXIMO = 50 * 1024 * 1024

// validação comum (o banco valida de novo)
export function errosLead(l) {
  const e = {}
  if (String(l.nome || '').trim().length < 2) e.nome = 'Informe o nome do cliente.'
  const t = numeros(l.telefone)
  if (t.length < 10 || t.length > 13) e.telefone = 'Telefone/WhatsApp com DDD (10 ou 11 números).'
  if (l.email && !emailValido(l.email)) e.email = 'E-mail inválido.'
  if (!l.vendedor_id) e.vendedor_id = 'Escolha o vendedor.'
  return e
}
// venda: valor bruto, valor deflacionado (digitado por enquanto), código do pedido e data de fechamento
export function errosVenda(v) {
  if (!(Number(v.venda_valor) > 0)) return 'Informe o valor bruto da venda.'
  if (!(Number(v.venda_deflacionado) > 0)) return 'Informe o valor deflacionado da venda.'
  if (!String(v.codigo_pedido || '').trim()) return 'Informe o código do pedido.'
  if (!v.venda_data) return 'Informe a data de fechamento.'
  return null
}
const camposVenda = (v) => ({ venda_valor: Number(v.venda_valor), venda_deflacionado: Number(v.venda_deflacionado), codigo_pedido: String(v.codigo_pedido).trim(), venda_data: v.venda_data })
export function errosAgendamento(a) {
  const e = {}
  if (!a.data) e.data = 'Informe a data.'
  if (!/^\d{2}:\d{2}$/.test(a.hora || '')) e.hora = 'Informe o horário.'
  if (a.modalidade !== 'online' && !a.loja_id) e.loja_id = 'Escolha a loja.'
  return e
}
// o navegador costuma mandar DWG e ZIP sem tipo (ou com tipos variados): vale a extensão
function tipoPelaExtensao(nome) {
  if (/\.txt$/i.test(nome)) return 'text/plain'
  if (/\.dwg$/i.test(nome)) return 'image/vnd.dwg'
  if (/\.zip$/i.test(nome)) return 'application/zip'
  return ''
}
function validarArquivoLead(arquivo) {
  const ext = tipoPelaExtensao(arquivo.name)
  const tipo = ext === 'image/vnd.dwg' || ext === 'application/zip' ? ext : arquivo.type || ext
  if (!TIPOS_ARQUIVO_LEAD.includes(tipo)) throw new Error(`${arquivo.name}: envie PDF, imagem (JPG, PNG, WEBP, HEIC), DWG, texto (.txt) ou .zip.`)
  if (arquivo.size > TAMANHO_MAXIMO) throw new Error(`${arquivo.name}: o arquivo passa de 50 MB.`)
  return tipo
}
const inicioDe = (a) => new Date(`${a.data}T${a.hora}:00`).toISOString()
const fimDe = (inicio, minutos = 60) => new Date(new Date(inicio).getTime() + minutos * 60000).toISOString()
const limparTexto = (v) => (typeof v === 'string' ? v.trim() || null : v ?? null)
function camposLead(l) {
  const out = {}
  for (const k of ['nome', 'telefone', 'email', 'origem_id', 'conversa_texto']) if (k in l) out[k] = limparTexto(l[k])
  if (out.email) out.email = out.email.toLowerCase()
  return out
}
// todas as respostas do briefing são opcionais
export const TEXTOS_BRIEFING = ['endereco', 'previsao_morar', 'moradores', 'projeto_arquitetura', 'quem_opina', 'ambiente_uso', 'obra_detalhes', 'eletros', 'observacoes']
function camposBriefing(b) {
  const out = { lead_id: b.lead_id, feito: !!b.feito, forma: b.forma || null, data: b.data || null }
  for (const k of TEXTOS_BRIEFING) out[k] = limparTexto(b[k])
  out.ja_mora = b.ja_mora === true || b.ja_mora === false ? b.ja_mora : null
  out.obra = b.obra === true || b.obra === false ? b.obra : null
  if (out.ja_mora !== false) out.previsao_morar = null
  if (out.obra !== true) out.obra_detalhes = null
  return out
}
const seguro = (nome) => nome.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80)
const erroLegivel = (e) => {
  const m = e?.message || String(e)
  if (/row-level security|permission denied/i.test(m)) return 'Seu perfil não tem permissão para esta ação.'
  if (/leads_telefone_check/.test(m)) return 'Telefone/WhatsApp com DDD (10 ou 11 números).'
  if (/leads_email_check/.test(m)) return 'E-mail inválido.'
  return m
}
const falhar = (error) => {
  if (error) throw new Error(erroLegivel(error))
}

// ---------------------------------------------------------------- Supabase
export function comercialSupabase(sb, chamarFuncao) {
  const processarAvisos = () => chamarFuncao('avisos-equipe', { acao: 'processar' }).catch(() => {}) // o agendador do servidor tenta de novo
  async function subir(leadId, tipo, arquivo) {
    const mime = validarArquivoLead(arquivo)
    const pronto = ACEITA_REDUZIR.includes(mime) ? await prepararImagem(arquivo) : arquivo
    const caminho = `comercial/${leadId}/${Date.now()}-${seguro(pronto.name || arquivo.name)}`
    const up = await sb.storage.from('documentos').upload(caminho, pronto, { contentType: pronto === arquivo ? mime : pronto.type })
    falhar(up.error)
    const { error } = await sb.from('lead_arquivos').insert({ lead_id: leadId, tipo, nome: arquivo.name, caminho, mime: pronto === arquivo ? mime : pronto.type, tamanho: pronto.size })
    if (error) {
      await sb.storage.from('documentos').remove([caminho])
      falhar(error)
    }
  }
  return {
    async nomesEquipe() {
      const { data, error } = await sb.from('perfis').select('id, nome, email, papel, ativo').neq('papel', 'cliente')
      falhar(error)
      return data
    },
    async todasLojas() {
      const { data, error } = await sb.from('lojas').select('*').order('ordem')
      falhar(error)
      return data
    },
    async salvarLoja(loja) {
      const { error } = await sb.from('lojas').upsert(loja)
      if (error) throw new Error(error.code === '23505' ? 'Já existe uma loja com esse código.' : erroLegivel(error))
    },
    async comercialDados() {
      const [l, a, r, b] = await Promise.all([
        sb.from('leads').select('*').order('posicao', { ascending: false }),
        sb.from('agendamentos').select('*').order('inicio'),
        sb.from('lembretes').select('*').order('quando'),
        sb.from('briefings').select('*'),
      ])
      falhar(l.error || a.error || r.error || b.error)
      return { leads: l.data, agendamentos: a.data, lembretes: r.data, briefings: b.data }
    },
    // novo lead: cadastro, anexos e agendamento; o banco põe o aviso do vendedor na fila
    async criarLead(dados, anexos = {}, agendamento = null) {
      const e = errosLead(dados)
      if (Object.keys(e).length) throw new Error(Object.values(e)[0])
      if (agendamento) {
        const ea = errosAgendamento(agendamento)
        if (Object.keys(ea).length) throw new Error(Object.values(ea)[0])
      }
      for (const f of [...(anexos.plantas || []), ...(anexos.referencias || []), ...(anexos.conversa || [])]) validarArquivoLead(f)
      const id = crypto.randomUUID()
      const { error } = await sb.from('leads').insert({ id, ...camposLead(dados), vendedor_id: dados.vendedor_id })
      falhar(error)
      const problemas = []
      if (agendamento) {
        const inicio = inicioDe(agendamento)
        const r = await sb.from('agendamentos').insert({ lead_id: id, vendedor_id: dados.vendedor_id, inicio, fim: fimDe(inicio),
          modalidade: agendamento.modalidade, loja_id: agendamento.modalidade === 'online' ? null : agendamento.loja_id })
        if (r.error) problemas.push('agendamento: ' + erroLegivel(r.error))
      }
      for (const [tipo, lista] of [['planta', anexos.plantas], ['referencia', anexos.referencias], ['conversa', anexos.conversa]])
        for (const f of lista || []) await subir(id, tipo, f).catch((err) => problemas.push(err.message))
      processarAvisos()
      return { id, problemas }
    },
    async salvarLead(id, dados) {
      const { error } = await sb.from('leads').update(camposLead(dados)).eq('id', id)
      falhar(error)
    },
    async moverLead(id, coluna_id, extra = {}) {
      const campos = { coluna_id, posicao: Date.now() / 1000 }
      if ('venda_valor' in extra) {
        const e = errosVenda(extra)
        if (e) throw new Error(e)
        Object.assign(campos, camposVenda(extra))
      }
      if ('perda_motivo_id' in extra) Object.assign(campos, { perda_motivo_id: extra.perda_motivo_id, perda_texto: limparTexto(extra.perda_texto) })
      const { error } = await sb.from('leads').update(campos).eq('id', id)
      falhar(error)
    },
    // gerente, master ou o próprio vendedor corrige os valores (fica no histórico)
    async corrigirVenda(id, venda) {
      const e = errosVenda(venda)
      if (e) throw new Error(e)
      const { error } = await sb.from('leads').update(camposVenda(venda)).eq('id', id)
      falhar(error)
    },
    async trocarVendedor(id, vendedor_id) {
      const { error } = await sb.from('leads').update({ vendedor_id }).eq('id', id)
      falhar(error)
      processarAvisos()
    },
    async excluirLead(id) {
      const { data: arqs } = await sb.from('lead_arquivos').select('caminho').eq('lead_id', id)
      const { data, error } = await sb.from('leads').delete().eq('id', id).select('id')
      falhar(error)
      if (!data?.length) throw new Error('Seu perfil não tem permissão para excluir leads.')
      if (arqs?.length) await sb.storage.from('documentos').remove(arqs.map((a) => a.caminho))
    },
    async arquivosLead(id) {
      const { data, error } = await sb.from('lead_arquivos').select('*').eq('lead_id', id).order('criado_em')
      falhar(error)
      return data
    },
    async enviarArquivoLead(id, tipo, arquivo) {
      await subir(id, tipo, arquivo)
    },
    async removerArquivoLead(arq) {
      const { error } = await sb.from('lead_arquivos').delete().eq('id', arq.id)
      falhar(error)
      await sb.storage.from('documentos').remove([arq.caminho])
    },
    async urlArquivoLead(arq, baixar = false) {
      const { data, error } = await sb.storage.from('documentos').createSignedUrl(arq.caminho, 600, baixar ? { download: arq.nome } : undefined)
      falhar(error)
      return data.signedUrl
    },
    async salvarAgendamento(a) {
      const ea = errosAgendamento(a)
      if (Object.keys(ea).length) throw new Error(Object.values(ea)[0])
      const inicio = inicioDe(a)
      const campos = { inicio, fim: fimDe(inicio), modalidade: a.modalidade, loja_id: a.modalidade === 'online' ? null : a.loja_id }
      const r = a.id
        ? await sb.from('agendamentos').update({ ...campos, situacao: 'marcado' }).eq('id', a.id)
        : await sb.from('agendamentos').insert({ ...campos, lead_id: a.lead_id, vendedor_id: a.vendedor_id })
      falhar(r.error)
    },
    async situacaoAgendamento(id, situacao) {
      const { error } = await sb.from('agendamentos').update({ situacao }).eq('id', id)
      falhar(error)
    },
    async eventosLead(id) {
      const { data, error } = await sb.from('lead_eventos').select('*').eq('lead_id', id).order('quando', { ascending: false })
      falhar(error)
      return data
    },
    async anotarLead(id, texto) {
      const t = String(texto || '').trim()
      if (t.length < 2) throw new Error('Escreva a anotação.')
      const { data: u } = await sb.auth.getUser()
      const { error } = await sb.from('lead_eventos').insert({ lead_id: id, tipo: 'nota', texto: t.slice(0, 5000), por: u.user.id })
      falhar(error)
    },
    async salvarLembrete(l) {
      if (!l.data || !/^\d{2}:\d{2}$/.test(l.hora || '')) throw new Error('Informe a data e o horário do lembrete.')
      const campos = { quando: inicioDe(l), tipo: l.tipo, descricao: limparTexto(l.descricao) }
      const r = l.id
        ? await sb.from('lembretes').update(campos).eq('id', l.id)
        : await sb.from('lembretes').insert({ ...campos, lead_id: l.lead_id, vendedor_id: l.vendedor_id })
      falhar(r.error)
    },
    async concluirLembrete(id, feito = true) {
      const { error } = await sb.from('lembretes').update({ concluido_em: feito ? new Date().toISOString() : null }).eq('id', id)
      falhar(error)
    },
    async excluirLembrete(id) {
      const { error } = await sb.from('lembretes').delete().eq('id', id)
      falhar(error)
    },
    async salvarBriefing(b) {
      const { error } = await sb.from('briefings').upsert(camposBriefing(b))
      falhar(error)
    },
    async avisosLead(id) {
      const { data, error } = await sb.from('avisos_equipe').select('*').eq('lead_id', id).order('criado_em', { ascending: false })
      falhar(error)
      return data
    },
    async reenviarAviso(id) {
      const { error } = await sb.rpc('reenviar_aviso_equipe', { aid: id })
      falhar(error)
      await processarAvisos()
    },
    async integracoes() {
      return chamarFuncao('avisos-equipe', { acao: 'status' })
    },
    async salvarIntegracoes(credenciais) {
      return chamarFuncao('avisos-equipe', { acao: 'salvar', credenciais })
    },
    async testarIntegracao(canal, destino) {
      return chamarFuncao('avisos-equipe', { acao: 'teste', canal, destino })
    },
    async definirAtivo(id, ativo) {
      return chamarFuncao('criar-usuario', { acao: 'ativo', id, ativo })
    },
  }
}

// ---------------------------------------------------------------- Demonstração (mesmas regras do banco)
export function comercialDemo({ db, gravar, contaAtual, novoId, garantir }) {
  const LIMITE_DEMO = 4 * 1024 * 1024 // o navegador guarda pouco: na demonstração os anexos ficam até 4 MB
  const agora = () => new Date().toISOString()
  const base = () => {
    const d = garantir(db())
    if (!d.lojas) d.lojas = [{ id: 'guarulhos', nome: 'Loja Guarulhos', ativa: true, ordem: 1 }, { id: 'mooca', nome: 'Loja Mooca', ativa: true, ordem: 2 }, { id: 'online', nome: 'Online', ativa: true, ordem: 3 }]
    return d
  }
  const eu = (d) => {
    const c = contaAtual(d)
    if (!c || !temPermissao(c, 'comercial')) throw new Error('Seu perfil não tem permissão para esta ação.')
    return c
  }
  const todos = (c) => temPermissao(c, 'comercial_todos')
  const podeVer = (d, c, leadId) => {
    const l = d.leads.find((x) => x.id === leadId)
    if (!l || !(todos(c) || l.vendedor_id === c.email)) throw new Error('Lead não encontrado.')
    return l
  }
  const evento = (d, lead_id, tipo, extra = {}) => {
    const c = contaAtual(d)
    const e = { id: novoId(), lead_id, tipo, por: c?.email, quando: agora(), ...extra }
    d.leadEventos.push(e)
    // primeiro contato: primeira ação do vendedor responsável
    const l = d.leads.find((x) => x.id === lead_id)
    if (l && !l.primeiro_contato_em && l.vendedor_id === c?.email && ['movido', 'nota', 'vendido', 'perdido', 'briefing', 'lembrete'].includes(tipo)) l.primeiro_contato_em = e.quando
  }
  const avisar = (d, lead, evento_, lembrete) => {
    const v = d.contas.find((x) => x.email === lead.vendedor_id)
    for (const canal of ['whatsapp', 'email'])
      d.avisosEquipe.unshift({ id: novoId(), usuario_id: v?.email, canal, destino: canal === 'whatsapp' ? v?.whatsapp : v?.email, evento: evento_,
        lead_id: lead.id, lembrete_id: lembrete?.id || null, mensagem: `${evento_ === 'lembrete' ? 'Lembrete' : 'Novo lead'}: ${lead.nome}`,
        situacao: 'simulado', erro: 'Demonstração: nada é enviado de verdade.', criado_em: agora() })
  }
  const lerArquivo = (f) => new Promise((ok, erro) => {
    const r = new FileReader()
    r.onload = () => ok(r.result)
    r.onerror = erro
    r.readAsDataURL(f)
  })
  async function subir(d, leadId, tipo, arquivo) {
    const mime = validarArquivoLead(arquivo)
    const pronto = ACEITA_REDUZIR.includes(mime) ? await prepararImagem(arquivo) : arquivo
    if (pronto.size > LIMITE_DEMO) throw new Error(`${arquivo.name}: na demonstração o limite é 4 MB.`)
    d.leadArquivos.push({ id: novoId(), lead_id: leadId, tipo, nome: arquivo.name, caminho: await lerArquivo(pronto), mime: pronto === arquivo ? mime : pronto.type, tamanho: pronto.size, enviado_por: contaAtual(d).email, criado_em: agora() })
  }
  const salvarComCuidado = () => {
    try {
      gravar(true)
    } catch {
      throw new Error('O navegador ficou sem espaço para a demonstração. Remova anexos grandes.')
    }
  }
  return {
    async nomesEquipe() {
      return db().contas.filter((c) => c.papel !== 'cliente').map((c) => ({ id: c.email, nome: c.nome, email: c.email, papel: c.papel, ativo: c.ativo !== false }))
    },
    async todasLojas() {
      return JSON.parse(JSON.stringify(base().lojas)).sort((a, b) => a.ordem - b.ordem)
    },
    async salvarLoja(loja) {
      const d = base()
      const c = contaAtual(d)
      if (!(c?.papel === 'admin' || temPermissao(c, 'comercial_config'))) throw new Error('Seu perfil não tem permissão para esta ação.')
      const i = d.lojas.findIndex((x) => x.id === loja.id)
      if (i >= 0) d.lojas[i] = { ...d.lojas[i], ...loja }
      else if (d.lojas.some((x) => x.nome.toLowerCase() === loja.nome.toLowerCase())) throw new Error('Já existe uma loja com esse nome.')
      else d.lojas.push({ ativa: true, ...loja })
      gravar()
    },
    async comercialDados() {
      const d = base()
      const c = eu(d)
      const meus = d.leads.filter((l) => todos(c) || l.vendedor_id === c.email)
      const ids = new Set(meus.map((l) => l.id))
      const copia = (x) => JSON.parse(JSON.stringify(x))
      return {
        leads: copia(meus).sort((a, b) => b.posicao - a.posicao),
        agendamentos: copia(d.agendamentos.filter((a) => ids.has(a.lead_id))).sort((a, b) => a.inicio.localeCompare(b.inicio)),
        lembretes: c.papel === 'captador' ? [] : copia(d.lembretes.filter((a) => ids.has(a.lead_id))).sort((a, b) => a.quando.localeCompare(b.quando)),
        briefings: copia(Object.values(d.briefings).filter((b) => ids.has(b.lead_id))),
      }
    },
    async criarLead(dados, anexos = {}, agendamento = null) {
      const d = base()
      const c = eu(d)
      const e = errosLead(dados)
      if (Object.keys(e).length) throw new Error(Object.values(e)[0])
      if (agendamento) {
        const ea = errosAgendamento(agendamento)
        if (Object.keys(ea).length) throw new Error(Object.values(ea)[0])
      }
      for (const f of [...(anexos.plantas || []), ...(anexos.referencias || []), ...(anexos.conversa || [])]) validarArquivoLead(f)
      const vendedor_id = todos(c) ? dados.vendedor_id : c.email
      const v = d.contas.find((x) => x.email === vendedor_id)
      if (!v || !['vendedor', 'gerente', 'admin'].includes(v.papel) || v.ativo === false) throw new Error('Escolha um vendedor válido.')
      const entrada = [...d.comercialListas.crm_colunas].filter((x) => x.tipo === 'entrada' && x.ativa).sort((a, b) => a.ordem - b.ordem)[0]
      const t = agora()
      const lead = { id: novoId(), ...camposLead(dados), vendedor_id, captador_id: c.email, coluna_id: entrada?.id || 'novo_cliente', posicao: Date.now() / 1000,
        venda_valor: null, venda_data: null, perda_motivo_id: null, perda_texto: null, primeiro_contato_em: null, movido_em: t, criado_em: t, atualizado_em: t }
      d.leads.push(lead)
      evento(d, lead.id, 'criado', { para_coluna: lead.coluna_id, dados: { vendedor_id, origem_id: lead.origem_id } })
      if (agendamento) {
        const inicio = inicioDe(agendamento)
        d.agendamentos.push({ id: novoId(), lead_id: lead.id, vendedor_id, inicio, fim: fimDe(inicio), modalidade: agendamento.modalidade,
          loja_id: agendamento.modalidade === 'online' ? null : agendamento.loja_id, situacao: 'marcado', criado_por: c.email, criado_em: t })
        evento(d, lead.id, 'agendamento', { dados: { inicio, modalidade: agendamento.modalidade, loja_id: agendamento.loja_id } })
      }
      const problemas = []
      for (const [tipo, lista] of [['planta', anexos.plantas], ['referencia', anexos.referencias], ['conversa', anexos.conversa]])
        for (const f of lista || []) await subir(d, lead.id, tipo, f).catch((err) => problemas.push(err.message))
      avisar(d, lead, 'novo_lead')
      salvarComCuidado()
      return { id: lead.id, problemas }
    },
    async salvarLead(id, dados) {
      const d = base()
      const c = eu(d)
      const l = podeVer(d, c, id)
      const novos = camposLead(dados)
      const e = errosLead({ ...l, ...novos })
      if (Object.keys(e).length) throw new Error(Object.values(e)[0])
      const antes = { nome: l.nome, telefone: l.telefone, email: l.email, origem_id: l.origem_id }
      Object.assign(l, novos, { atualizado_em: agora() })
      if (['nome', 'telefone', 'email', 'origem_id'].some((k) => k in novos && antes[k] !== l[k])) evento(d, id, 'editado', { dados: { antes } })
      gravar()
    },
    async moverLead(id, coluna_id, extra = {}) {
      const d = base()
      const c = eu(d)
      const l = podeVer(d, c, id)
      if (c.papel === 'captador') throw new Error('O captador não move cartões no CRM.')
      const col = d.comercialListas.crm_colunas.find((x) => x.id === coluna_id)
      if (!col || !col.ativa) throw new Error('Coluna inválida.')
      const de = l.coluna_id
      if (col.tipo === 'ganho') {
        const e = errosVenda(extra)
        if (e) throw new Error(e)
        Object.assign(l, camposVenda(extra), { perda_motivo_id: null, perda_texto: null })
      } else if (col.tipo === 'perdido') {
        const m = d.comercialListas.motivos_perda.find((x) => x.id === extra.perda_motivo_id)
        if (!m) throw new Error('Para marcar como perdido, informe o motivo da perda.')
        if (m.pede_texto && !String(extra.perda_texto || '').trim()) throw new Error('Descreva o motivo da perda.')
        Object.assign(l, { perda_motivo_id: m.id, perda_texto: limparTexto(extra.perda_texto), venda_valor: null, venda_data: null, venda_deflacionado: null, codigo_pedido: null })
      } else Object.assign(l, { venda_valor: null, venda_data: null, venda_deflacionado: null, codigo_pedido: null, perda_motivo_id: null, perda_texto: null })
      Object.assign(l, { coluna_id, posicao: Date.now() / 1000, atualizado_em: agora() })
      if (de !== coluna_id) {
        l.movido_em = agora()
        evento(d, id, col.tipo === 'ganho' ? 'vendido' : col.tipo === 'perdido' ? 'perdido' : 'movido', {
          de_coluna: de, para_coluna: coluna_id, texto: col.tipo === 'perdido' ? l.perda_texto : null,
          dados: col.tipo === 'ganho' ? { valor: l.venda_valor, deflacionado: l.venda_deflacionado, codigo: l.codigo_pedido, data: l.venda_data } : col.tipo === 'perdido' ? { motivo_id: l.perda_motivo_id } : null,
        })
      }
      gravar()
    },
    async corrigirVenda(id, venda) {
      const d = base()
      const c = eu(d)
      const l = podeVer(d, c, id)
      if (c.papel === 'captador') throw new Error('O captador não registra venda nem perda.')
      if (d.comercialListas.crm_colunas.find((x) => x.id === l.coluna_id)?.tipo !== 'ganho') throw new Error('O cartão não está em Vendidos.')
      const e = errosVenda(venda)
      if (e) throw new Error(e)
      const antes = { valor: l.venda_valor, deflacionado: l.venda_deflacionado, codigo: l.codigo_pedido, data: l.venda_data }
      Object.assign(l, camposVenda(venda), { atualizado_em: agora() })
      evento(d, id, 'venda_editada', { dados: { antes, depois: { valor: l.venda_valor, deflacionado: l.venda_deflacionado, codigo: l.codigo_pedido, data: l.venda_data } } })
      gravar()
    },
    async trocarVendedor(id, vendedor_id) {
      const d = base()
      const c = eu(d)
      const l = podeVer(d, c, id)
      if (!todos(c)) throw new Error('Somente o gerente pode trocar o vendedor responsável.')
      const v = d.contas.find((x) => x.email === vendedor_id)
      if (!v || !['vendedor', 'gerente', 'admin'].includes(v.papel)) throw new Error('Escolha um vendedor válido.')
      if (l.vendedor_id === vendedor_id) return
      evento(d, id, 'vendedor', { dados: { de: l.vendedor_id, para: vendedor_id } })
      l.vendedor_id = vendedor_id
      d.agendamentos.filter((a) => a.lead_id === id).forEach((a) => (a.vendedor_id = vendedor_id))
      d.lembretes.filter((a) => a.lead_id === id && !a.concluido_em).forEach((a) => (a.vendedor_id = vendedor_id))
      avisar(d, l, 'novo_lead')
      gravar()
    },
    async excluirLead(id) {
      const d = base()
      const c = eu(d)
      podeVer(d, c, id)
      if (!(['admin', 'gerente'].includes(c.papel) || temPermissao(c, 'excluir'))) throw new Error('Seu perfil não tem permissão para excluir leads.')
      d.leads = d.leads.filter((x) => x.id !== id)
      for (const k of ['leadArquivos', 'agendamentos', 'leadEventos', 'lembretes', 'avisosEquipe']) d[k] = d[k].filter((x) => x.lead_id !== id)
      delete d.briefings[id]
      gravar()
    },
    async arquivosLead(id) {
      const d = base()
      podeVer(d, eu(d), id)
      return d.leadArquivos.filter((x) => x.lead_id === id)
    },
    async enviarArquivoLead(id, tipo, arquivo) {
      const d = base()
      podeVer(d, eu(d), id)
      await subir(d, id, tipo, arquivo)
      salvarComCuidado()
    },
    async removerArquivoLead(arq) {
      const d = base()
      podeVer(d, eu(d), arq.lead_id)
      d.leadArquivos = d.leadArquivos.filter((x) => x.id !== arq.id)
      gravar()
    },
    // o navegador não abre data: numa aba nova; vira um endereço blob: temporário
    async urlArquivoLead(arq) {
      return URL.createObjectURL(await (await fetch(arq.caminho)).blob())
    },
    async salvarAgendamento(a) {
      const d = base()
      const c = eu(d)
      const l = podeVer(d, c, a.lead_id)
      const ea = errosAgendamento(a)
      if (Object.keys(ea).length) throw new Error(Object.values(ea)[0])
      const inicio = inicioDe(a)
      const campos = { inicio, fim: fimDe(inicio), modalidade: a.modalidade, loja_id: a.modalidade === 'online' ? null : a.loja_id, vendedor_id: l.vendedor_id }
      if (a.id) {
        const x = d.agendamentos.find((y) => y.id === a.id)
        const antes = { inicio: x.inicio, modalidade: x.modalidade, loja_id: x.loja_id }
        if (x.situacao !== 'marcado') evento(d, l.id, 'comparecimento', { dados: { de: x.situacao, para: 'marcado' } })
        Object.assign(x, campos, { situacao: 'marcado' })
        evento(d, l.id, 'remarcado', { dados: { antes, depois: { inicio, modalidade: campos.modalidade, loja_id: campos.loja_id } } })
      } else {
        d.agendamentos.push({ id: novoId(), lead_id: l.id, ...campos, situacao: 'marcado', criado_por: c.email, criado_em: agora() })
        evento(d, l.id, 'agendamento', { dados: { inicio, modalidade: campos.modalidade, loja_id: campos.loja_id } })
      }
      gravar()
    },
    async situacaoAgendamento(id, situacao) {
      const d = base()
      const c = eu(d)
      const a = d.agendamentos.find((x) => x.id === id)
      if (!a) throw new Error('Agendamento não encontrado.')
      podeVer(d, c, a.lead_id)
      if (a.situacao !== situacao) evento(d, a.lead_id, 'comparecimento', { dados: { de: a.situacao, para: situacao } })
      a.situacao = situacao
      gravar()
    },
    async eventosLead(id) {
      const d = base()
      podeVer(d, eu(d), id)
      return d.leadEventos.filter((x) => x.lead_id === id).sort((a, b) => b.quando.localeCompare(a.quando))
    },
    async anotarLead(id, texto) {
      const d = base()
      podeVer(d, eu(d), id)
      const t = String(texto || '').trim()
      if (t.length < 2) throw new Error('Escreva a anotação.')
      evento(d, id, 'nota', { texto: t.slice(0, 5000) })
      gravar()
    },
    async salvarLembrete(l) {
      const d = base()
      const c = eu(d)
      const lead = podeVer(d, c, l.lead_id)
      if (c.papel === 'captador') throw new Error('Seu perfil não tem permissão para esta ação.')
      if (!l.data || !/^\d{2}:\d{2}$/.test(l.hora || '')) throw new Error('Informe a data e o horário do lembrete.')
      const campos = { quando: inicioDe(l), tipo: l.tipo, descricao: limparTexto(l.descricao), vendedor_id: lead.vendedor_id }
      if (l.id) {
        const x = d.lembretes.find((y) => y.id === l.id)
        if (x.quando !== campos.quando) x.notificado_em = null
        Object.assign(x, campos)
      } else {
        const novo = { id: novoId(), lead_id: lead.id, ...campos, concluido_em: null, notificado_em: null, criado_por: c.email, criado_em: agora() }
        d.lembretes.push(novo)
        evento(d, lead.id, 'lembrete', { texto: novo.descricao, dados: { quando: novo.quando, tipo: novo.tipo } })
      }
      gravar()
    },
    async concluirLembrete(id, feito = true) {
      const d = base()
      const c = eu(d)
      const x = d.lembretes.find((y) => y.id === id)
      if (!x || c.papel === 'captador') throw new Error('Lembrete não encontrado.')
      podeVer(d, c, x.lead_id)
      x.concluido_em = feito ? agora() : null
      gravar()
    },
    async excluirLembrete(id) {
      const d = base()
      const c = eu(d)
      const x = d.lembretes.find((y) => y.id === id)
      if (!x || c.papel === 'captador') throw new Error('Lembrete não encontrado.')
      podeVer(d, c, x.lead_id)
      d.lembretes = d.lembretes.filter((y) => y.id !== id)
      gravar()
    },
    async salvarBriefing(b) {
      const d = base()
      const c = eu(d)
      podeVer(d, c, b.lead_id)
      if (c.papel === 'captador') throw new Error('Seu perfil não tem permissão para esta ação.')
      const antes = d.briefings[b.lead_id]
      const novo = { ...camposBriefing(b), atualizado_por: c.email, atualizado_em: agora() }
      if (!antes || antes.feito !== novo.feito) evento(d, b.lead_id, 'briefing', { dados: { feito: novo.feito, forma: novo.forma } })
      d.briefings[b.lead_id] = novo
      gravar()
    },
    async avisosLead(id) {
      const d = base()
      podeVer(d, eu(d), id)
      return d.avisosEquipe.filter((x) => x.lead_id === id)
    },
    async reenviarAviso(id) {
      const d = base()
      const a = d.avisosEquipe.find((x) => x.id === id)
      if (!a) throw new Error('Aviso não encontrado.')
      a.criado_em = agora()
      gravar()
    },
    async integracoes() {
      throw new Error('Na demonstração não há servidor: as credenciais só podem ser cadastradas no portal real.')
    },
    async salvarIntegracoes() {
      throw new Error('Na demonstração não há servidor: as credenciais só podem ser cadastradas no portal real.')
    },
    async testarIntegracao() {
      throw new Error('Na demonstração não há servidor para enviar o teste.')
    },
    async definirAtivo(id, ativo) {
      const d = db()
      if (contaAtual(d)?.papel !== 'admin') throw new Error('Somente o master pode desativar usuários.')
      if (id === d.sessao.email) throw new Error('Você não pode desativar o seu próprio acesso.')
      const c = d.contas.find((x) => x.email === id)
      if (!c || c.papel === 'cliente') throw new Error('Usuário não encontrado.')
      c.ativo = !!ativo
      gravar()
    },
  }
}
