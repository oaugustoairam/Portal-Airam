// Dados das Ferramentas (dias úteis e formalização), do checklist de venda e da Gestão Mensal.
// Supabase (regras no banco) e demonstração (localStorage, mesmas regras), como em apiComercial.js.
import { temPermissao } from './permissoes.js'
import { faltasFormalizacao } from './formalizacao.js'
import { calcularSalario, reguaDoMes, competencia, faltandoChecklist, ITENS_CHECKLIST, REGUA_PADRAO, primeiroDia, proximaFaixa } from './salario.js'

const falhar = (error) => {
  if (!error) return
  const m = error.message || String(error)
  throw new Error(/row-level security|permission denied/i.test(m) ? 'Seu perfil não tem permissão para esta ação.' : m)
}
export function errosFeriado(f) {
  if (!f.data) return 'Informe a data.'
  if (f.data_fim && f.data_fim < f.data) return 'A data final não pode ser antes da inicial.'
  if (String(f.nome || '').trim().length < 2) return 'Informe o nome.'
  return null
}
const camposFeriado = (f) => ({ data: f.data, data_fim: f.data_fim || null, nome: f.nome.trim(), tipo: f.tipo || 'recesso', abrangencia: f.abrangencia || 'todas' })
const seguro = (nome) => nome.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80)
const tipoArquivo = (f) => f.type || (/\.xml$/i.test(f.name) ? 'application/xml' : /\.pdf$/i.test(f.name) ? 'application/pdf' : 'application/octet-stream')
export function errosTipo(t) {
  if (String(t.nome || '').trim().length < 3) return 'Informe o nome do tipo.'
  if (!String(t.texto_modelo || '').trim()) return 'Escreva o modelo do texto.'
  if (!String(t.titulo_modelo || '').trim()) return 'Escreva o modelo do título.'
  if ((t.anexos || []).some((a) => !String(a.nome || '').trim())) return 'Dê nome a todos os anexos.'
  if ((t.checklist || []).some((c) => !String(c.pergunta || '').trim() || !String(c.texto || '').trim())) return 'Preencha a pergunta e o texto de cada item do checklist.'
  return null
}
export function errosRegua(faixas, vigente) {
  if (!/^\d{4}-\d{2}-01$/.test(vigente || '')) return 'Escolha o mês em que a régua começa a valer.'
  if (!faixas.length) return 'Informe pelo menos uma faixa.'
  if (Number(faixas[0].de) !== 0) return 'A primeira faixa começa em R$ 0,00.'
  for (let i = 0; i < faixas.length; i++) {
    const f = faixas[i]
    if (![f.de, f.pct, f.fixo].every((x) => x !== '' && Number.isFinite(Number(x)))) return `Faixa ${i + 1}: preencha os três valores.`
    if (Number(f.pct) < 0 || Number(f.pct) > 100 || Number(f.fixo) < 0) return `Faixa ${i + 1}: percentual ou fixo inválido.`
    if (i && Number(f.de) <= Number(faixas[i - 1].de)) return 'As faixas precisam estar em ordem crescente.'
  }
  return null
}
const limparTipo = (t) => ({
  id: t.id, nome: t.nome.trim(), titulo_modelo: t.titulo_modelo.trim(), texto_modelo: t.texto_modelo, campos: t.campos || [],
  anexos: (t.anexos || []).map((a) => ({ id: a.id, nome: a.nome.trim(), multiplo: !!a.multiplo, obrigatorio: !!a.obrigatorio })),
  checklist: (t.checklist || []).map((c) => ({ pergunta: c.pergunta.trim(), texto: c.texto.trim() })),
  bloco_checklist: t.bloco_checklist?.trim() || null, ativo: t.ativo !== false, ordem: Number(t.ordem) || 0,
})
const dadosFormalizacao = (f) => ({ previsao: f.previsao || null, codigo_origem: f.codigo_origem || null, nome_origem: f.nome_origem || null, marcados: f.marcados || [] })

// ---------------------------------------------------------------- Supabase
export function ferramentasSupabase(sb, chamarFuncao) {
  return {
    // ---- dias úteis
    async feriadosEmpresa() {
      const { data, error } = await sb.from('feriados_empresa').select('*').order('data')
      falhar(error)
      return data
    },
    async salvarFeriado(f) {
      const e = errosFeriado(f)
      if (e) throw new Error(e)
      const r = f.id ? await sb.from('feriados_empresa').update(camposFeriado(f)).eq('id', f.id) : await sb.from('feriados_empresa').insert(camposFeriado(f))
      falhar(r.error)
    },
    async excluirFeriado(id) {
      const { data, error } = await sb.from('feriados_empresa').delete().eq('id', id).select('id')
      falhar(error)
      if (!data?.length) throw new Error('Seu perfil não tem permissão para esta ação.')
    },
    // ---- caixa de e-mail (a senha vai direto para o servidor, que cifra e testa)
    async minhaCaixa() {
      const { data, error } = await sb.rpc('minha_caixa')
      falhar(error)
      return data?.[0] || null
    },
    async salvarCaixa(email, senha) {
      return (await chamarFuncao('caixa-email', { acao: 'salvar', email, senha })).caixa
    },
    async testarCaixa() {
      return (await chamarFuncao('caixa-email', { acao: 'testar' })).caixa
    },
    async removerCaixa() {
      await chamarFuncao('caixa-email', { acao: 'remover' })
    },
    // ---- formalização
    async tiposFormalizacao() {
      const { data, error } = await sb.from('tipos_formalizacao').select('*').order('ordem')
      falhar(error)
      return data
    },
    async salvarTipoFormalizacao(t) {
      const e = errosTipo(t)
      if (e) throw new Error(e)
      const { error } = await sb.from('tipos_formalizacao').upsert({ ...limparTipo(t), atualizado_em: new Date().toISOString() })
      falhar(error)
    },
    async emailsUsados() {
      const { data, error } = await sb.from('emails_usados').select('email').order('ultimo_uso', { ascending: false }).limit(200)
      falhar(error)
      return data.map((x) => x.email)
    },
    async formalizacoes(leadId) {
      let q = sb.from('formalizacoes').select('*, formalizacao_anexos(*)').order('criado_em', { ascending: false }).limit(300)
      if (leadId) q = q.eq('lead_id', leadId)
      const { data, error } = await q
      falhar(error)
      return data
    },
    // cria o registro, sobe os anexos e pede o envio ao servidor
    async enviarFormalizacao(f, tipo) {
      const faltas = faltasFormalizacao(tipo, f)
      if (faltas.length) throw new Error(faltas[0])
      const id = crypto.randomUUID()
      const { data: u } = await sb.auth.getUser()
      const { error } = await sb.from('formalizacoes').insert({ id, lead_id: f.lead_id, tipo_id: tipo.id, tipo_nome: tipo.nome, codigo: f.codigo.trim(), cliente_nome: f.cliente,
        titulo: f.titulo.trim(), texto: f.texto, para: f.para, cc: f.cc || [], cco: f.cco || [], dados: dadosFormalizacao(f), enviado_por: u.user.id })
      falhar(error)
      for (const [anexoId, lista] of Object.entries(f.anexos || {})) {
        for (const arq of lista) {
          let caminho = arq.caminho
          if (!arq.herdado) {
            caminho = `comercial/${f.lead_id}/formalizacoes/${id}/${Date.now()}-${seguro(arq.name)}`
            const up = await sb.storage.from('documentos').upload(caminho, arq, { contentType: tipoArquivo(arq) })
            falhar(up.error)
          }
          const r = await sb.from('formalizacao_anexos').insert({ formalizacao_id: id, anexo_id: anexoId, nome: arq.herdado ? arq.nome : arq.name, caminho,
            mime: arq.herdado ? arq.mime : tipoArquivo(arq), tamanho: arq.herdado ? arq.tamanho : arq.size })
          falhar(r.error)
        }
      }
      const r = await chamarFuncao('formalizacao-enviar', { id })
      return { id, ...r }
    },
    async reenviarFormalizacao(id) {
      return chamarFuncao('formalizacao-enviar', { id })
    },
    async urlAnexoFormalizacao(a, baixar) {
      const { data, error } = await sb.storage.from('documentos').createSignedUrl(a.caminho, 600, baixar ? { download: a.nome } : undefined)
      falhar(error)
      return data.signedUrl
    },
    // ---- checklist de venda
    async marcarChecklist(leadId, item, feito) {
      if (!ITENS_CHECKLIST.some(([k]) => k === item)) throw new Error('Item inválido.')
      // (upsert faria o gatilho do banco rodar duas vezes e duplicar o histórico)
      const valor = { [`${item}_em`]: feito ? new Date().toISOString() : null }
      const atualizar = () => sb.from('venda_checklist').update(valor).eq('lead_id', leadId).select('lead_id')
      let r = await atualizar()
      if (!r.error && !r.data?.length) {
        r = await sb.from('venda_checklist').insert({ lead_id: leadId, ...valor })
        if (r.error?.code === '23505') r = await atualizar() // outro clique criou a linha ao mesmo tempo
      }
      falhar(r.error)
    },
    // ---- gestão mensal
    async salarioMes(mes) {
      const { data, error } = await sb.rpc('salario_mes', { m: mes })
      falhar(error)
      return data.map((x) => ({ ...x, total_deflacionado: Number(x.total_deflacionado), comissao: Number(x.comissao), fixo: Number(x.fixo), total: Number(x.total) }))
    },
    async vendasDoMes(mes, vendedor) {
      const { data, error } = await sb.rpc('vendas_do_mes', { m: mes, vend: vendedor || null })
      falhar(error)
      return data
    },
    async pularVenda(leadId, motivo) {
      const { error } = await sb.rpc('pular_venda', { lid: leadId, motivo_: motivo })
      falhar(error)
    },
    async desfazerPulo(leadId) {
      const { error } = await sb.rpc('desfazer_pulo', { lid: leadId })
      falhar(error)
    },
    async fecharMes(mes) {
      const { data, error } = await sb.rpc('fechar_mes', { m: mes })
      falhar(error)
      return data
    },
    async reguas() {
      const { data, error } = await sb.from('regua_comissao').select('*').order('vigente_desde', { ascending: false })
      falhar(error)
      return data
    },
    async salvarRegua(vigente_desde, faixas) {
      const e = errosRegua(faixas, vigente_desde)
      if (e) throw new Error(e)
      const linhas = faixas.map((f) => ({ de: Number(f.de), pct: Number(f.pct), fixo: Number(f.fixo) }))
      const { error } = await sb.from('regua_comissao').upsert({ vigente_desde, faixas: linhas }, { onConflict: 'vigente_desde' })
      falhar(error)
    },
    // ---- criador de conteúdo (a IA roda só no servidor)
    async gerarConteudo(pedido) {
      const e = errosConteudo(pedido)
      if (e) throw new Error(e)
      return (await chamarFuncao('conteudo-ia', pedido)).variacoes
    },
    async testarIA() {
      return chamarFuncao('conteudo-ia', { acao: 'teste' })
    },
    async diretrizesMarca() {
      const { data, error } = await sb.from('diretrizes_marca').select('*').eq('id', 1).maybeSingle()
      falhar(error)
      return data
    },
    async salvarDiretrizes(m) {
      const { error } = await sb.from('diretrizes_marca').upsert({ id: 1, tom_de_voz: m.tom_de_voz.trim(), palavras_evitar: m.palavras_evitar.trim(), hashtags_padrao: m.hashtags_padrao.trim(), atualizado_em: new Date().toISOString() })
      falhar(error)
    },
    async conteudosIA() {
      const { data, error } = await sb.from('conteudos_ia').select('*').order('criado_em', { ascending: false }).limit(300)
      falhar(error)
      return data
    },
    async salvarConteudo(c) {
      const { data: u } = await sb.auth.getUser()
      const { error } = await sb.from('conteudos_ia').insert({ usuario_id: u.user.id, modo: c.modo, pedido: c.pedido, variacoes: c.variacoes, texto_final: c.texto_final })
      falhar(error)
    },
    async excluirConteudo(id) {
      const { data, error } = await sb.from('conteudos_ia').delete().eq('id', id).select('id')
      falhar(error)
      if (!data?.length) throw new Error('Seu perfil não tem permissão para esta ação.')
    },
  }
}

export function errosConteudo(p) {
  if (p.modo === 'texto' && String(p.descricao || '').trim().length < 10) return 'Descreva o post em pelo menos uma frase.'
  if (p.modo === 'imagem' && !(p.imagens || []).length) return 'Envie pelo menos uma foto.'
  return null
}

// ---------------------------------------------------------------- Demonstração (mesmas regras do banco)
export function ferramentasDemo({ db, gravar, contaAtual, novoId }) {
  const agora = () => new Date().toISOString()
  const base = () => {
    const d = db()
    d.feriadosEmpresa = d.feriadosEmpresa || []
    d.caixas = d.caixas || {}
    d.formalizacoes = d.formalizacoes || []
    d.emailsUsados = d.emailsUsados || {}
    d.checklists = d.checklists || {}
    d.pulos = d.pulos || []
    d.fechamentos = d.fechamentos || []
    d.reguas = d.reguas || [{ id: 'r0', vigente_desde: '2000-01-01', faixas: REGUA_PADRAO }]
    d.leads = d.leads || []
    d.leadEventos = d.leadEventos || []
    if (!d.tiposFormalizacao) d.tiposFormalizacao = TIPOS_PADRAO.map((t) => ({ ...t }))
    return d
  }
  const eu = (d) => {
    const c = contaAtual(d)
    if (!c || c.ativo === false) throw new Error('Seu perfil não tem permissão para esta ação.')
    return c
  }
  const exigirMaster = (d) => {
    if (eu(d).papel !== 'admin') throw new Error('Seu perfil não tem permissão para esta ação.')
  }
  const todosComercial = (c) => temPermissao(c, 'comercial_todos')
  const podeVer = (d, c, leadId) => {
    const l = d.leads.find((x) => x.id === leadId)
    if (!l || !temPermissao(c, 'comercial') || !(todosComercial(c) || l.vendedor_id === c.email)) throw new Error('Cliente não encontrado.')
    return l
  }
  const ehVendido = (d, l) => d.comercialListas?.crm_colunas.find((x) => x.id === l.coluna_id)?.tipo === 'ganho'
  const evento = (d, lead_id, tipo, extra = {}) => d.leadEventos.push({ id: novoId(), lead_id, tipo, por: contaAtual(d)?.email, quando: agora(), ...extra })
  const lerArquivo = (f) => new Promise((ok, erro) => {
    const r = new FileReader()
    r.onload = () => ok(r.result)
    r.onerror = erro
    r.readAsDataURL(f)
  })
  // mesma regra do gatilho regras_checklist
  function aplicarChecklist(d, leadId, mudancas, porServidor = false) {
    const c = contaAtual(d)
    const l = d.leads.find((x) => x.id === leadId)
    if (!l || !ehVendido(d, l)) throw new Error('O checklist é só para vendas (cartão em Vendidos).')
    const ck = d.checklists[leadId] || { lead_id: leadId }
    if (!porServidor && 'formalizacao_em' in mudancas && !todosComercial(c)) throw new Error('O item "E-mail de formalização enviado" é marcado sozinho quando a formalização sai pelo portal.')
    const novo = { ...ck, ...mudancas }
    if (!novo.formalizacao_em && !ck.formalizacao_em) novo.formalizacao_em = d.formalizacoes.filter((f) => f.lead_id === leadId && ['enviado', 'simulado'].includes(f.situacao)).map((f) => f.enviado_em).sort()[0] || null
    const itens = []
    for (const [k] of ITENS_CHECKLIST) {
      if ((novo[`${k}_em`] || null) !== (ck[`${k}_em`] || null)) {
        itens.push(`${k}:${novo[`${k}_em`] ? 'marcado' : 'desmarcado'}`)
        novo[`${k}_por`] = novo[`${k}_em`] ? (porServidor ? null : c?.email) : null
      }
    }
    novo.completa_em = ITENS_CHECKLIST.every(([k]) => novo[`${k}_em`]) ? ck.completa_em || agora() : null
    d.checklists[leadId] = novo
    if (itens.length) evento(d, leadId, 'checklist', { dados: { itens, completa: !!novo.completa_em } })
  }
  const vendidos = (d) => d.leads.filter((l) => ehVendido(d, l))
  const acessoMensal = (c) => {
    const todos = temPermissao(c, 'gestao_mensal_todos')
    if (!todos && !temPermissao(c, 'gestao_mensal')) throw new Error('Sem acesso à Gestão Mensal.')
    return todos
  }
  function linhasDoMes(d, mes, vend) {
    const fechadosDe = new Set(d.fechamentos.filter((f) => f.mes === mes).map((f) => f.vendedor_id))
    const fim = mesSeguinte(mes)
    const out = []
    for (const l of vendidos(d)) {
      if (vend && l.vendedor_id !== vend) continue
      const ck = d.checklists[l.id]
      const pulo = d.pulos.find((p) => p.lead_id === l.id && !p.desfeito_em)
      const comp = competencia(l, ck, d.pulos)
      const base = { lead_id: l.id, vendedor_id: l.vendedor_id, cliente: l.nome, codigo_pedido: l.codigo_pedido, venda_data: l.venda_data, venda_valor: l.venda_valor, venda_deflacionado: l.venda_deflacionado, competencia: comp }
      if (ck?.completa_em && !pulo) {
        if (comp === mes && !fechadosDe.has(l.vendedor_id)) out.push({ ...base, situacao: 'valida', faltando: [] })
      } else if (l.venda_data < fim) {
        out.push({ ...base, situacao: pulo ? 'pulada' : 'pendente', faltando: faltandoChecklist(ck), pulo_motivo: pulo?.motivo, pulo_por: pulo?.por, pulo_em: pulo?.em })
      }
    }
    for (const f of d.fechamentos.filter((x) => x.mes === mes && (!vend || x.vendedor_id === vend))) {
      for (const v of f.vendas) out.push({ ...v, vendedor_id: f.vendedor_id, situacao: 'valida', faltando: [], competencia: mes })
    }
    return out.sort((a, b) => (a.venda_data || '').localeCompare(b.venda_data || ''))
  }
  function salarios(d, mes) {
    const c = eu(d)
    const todos = acessoMensal(c)
    const regua = reguaDoMes(d.reguas, mes)
    const pessoas = d.contas.filter((p) => p.papel !== 'cliente' && (todos || p.email === c.email)
      && ((p.papel === 'vendedor' && p.ativo !== false) || (!todos && p.email === c.email) || vendidos(d).some((l) => l.vendedor_id === p.email && competencia(l, d.checklists[l.id], d.pulos) === mes)
        || d.fechamentos.some((f) => f.mes === mes && f.vendedor_id === p.email)))
    return pessoas.map((p) => {
      const f = d.fechamentos.find((x) => x.mes === mes && x.vendedor_id === p.email)
      const linhas = linhasDoMes(d, mes, p.email)
      const validas = linhas.filter((x) => x.situacao === 'valida')
      const s = f || calcularSalario(validas.reduce((t, x) => t + Number(x.venda_deflacionado || 0), 0), regua.faixas)
      const faixasUsadas = f ? (d.reguas.find((r) => r.id === f.regua_id) || regua).faixas : regua.faixas
      return { vendedor_id: p.email, vendedor: p.nome || p.email, total_deflacionado: s.total_deflacionado, faixa: s.faixa, comissao: s.comissao, fixo: s.fixo, total: s.total,
        vendas: validas.length, pendentes: linhas.length - validas.length, fechado: !!f, fechado_em: f?.fechado_em || null, proxima: proximaFaixa(s.total_deflacionado, faixasUsadas) }
    }).sort((a, b) => a.vendedor.localeCompare(b.vendedor))
  }
  const mesSeguinte = (mes) => {
    const [a, m] = mes.split('-').map(Number)
    return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`
  }

  return {
    async feriadosEmpresa() {
      const d = base()
      eu(d)
      return JSON.parse(JSON.stringify(d.feriadosEmpresa)).sort((a, b) => a.data.localeCompare(b.data))
    },
    async salvarFeriado(f) {
      const d = base()
      exigirMaster(d)
      const e = errosFeriado(f)
      if (e) throw new Error(e)
      if (f.id) Object.assign(d.feriadosEmpresa.find((x) => x.id === f.id), camposFeriado(f))
      else d.feriadosEmpresa.push({ id: novoId(), ...camposFeriado(f), criado_por: contaAtual(d).email, criado_em: agora() })
      gravar()
    },
    async excluirFeriado(id) {
      const d = base()
      exigirMaster(d)
      d.feriadosEmpresa = d.feriadosEmpresa.filter((x) => x.id !== id)
      gravar()
    },
    // na demonstração não há servidor de e-mail: a caixa fica "salva" sem senha e sem teste real
    async minhaCaixa() {
      const d = base()
      return d.caixas[eu(d).email] || null
    },
    async salvarCaixa(email, senha) {
      const d = base()
      const c = eu(d)
      const e = String(email || '').trim().toLowerCase()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('E-mail inválido.')
      if (!senha && !d.caixas[c.email]) throw new Error('Informe a senha da caixa de e-mail.')
      d.caixas[c.email] = { email: e, testado_em: agora(), teste_ok: true, erro: null, demonstracao: true }
      gravar()
      return d.caixas[c.email]
    },
    async testarCaixa() {
      const d = base()
      const c = eu(d)
      if (!d.caixas[c.email]) throw new Error('Cadastre a caixa de e-mail primeiro.')
      d.caixas[c.email].testado_em = agora()
      gravar()
      return d.caixas[c.email]
    },
    async removerCaixa() {
      const d = base()
      delete d.caixas[eu(d).email]
      gravar()
    },
    async tiposFormalizacao() {
      const d = base()
      eu(d)
      return JSON.parse(JSON.stringify(d.tiposFormalizacao)).sort((a, b) => a.ordem - b.ordem)
    },
    async salvarTipoFormalizacao(t) {
      const d = base()
      exigirMaster(d)
      const e = errosTipo(t)
      if (e) throw new Error(e)
      const i = d.tiposFormalizacao.findIndex((x) => x.id === t.id)
      if (i >= 0) d.tiposFormalizacao[i] = limparTipo(t)
      else d.tiposFormalizacao.push(limparTipo(t))
      gravar()
    },
    async emailsUsados() {
      const d = base()
      return d.emailsUsados[eu(d).email] || []
    },
    async formalizacoes(leadId) {
      const d = base()
      const c = eu(d)
      return JSON.parse(JSON.stringify(d.formalizacoes.filter((f) => (!leadId || f.lead_id === leadId) && (() => {
        try {
          podeVer(d, c, f.lead_id)
          return true
        } catch {
          return false
        }
      })()))).sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    },
    async enviarFormalizacao(f, tipo) {
      const d = base()
      const c = eu(d)
      if (!temPermissao(c, 'ferramentas')) throw new Error('Seu perfil não tem acesso às Ferramentas.')
      podeVer(d, c, f.lead_id)
      const faltas = faltasFormalizacao(tipo, f)
      if (faltas.length) throw new Error(faltas[0])
      const id = novoId()
      const anexos = []
      for (const [anexoId, lista] of Object.entries(f.anexos || {})) {
        for (const arq of lista) {
          if (arq.herdado) anexos.push({ id: novoId(), formalizacao_id: id, anexo_id: anexoId, nome: arq.nome, caminho: arq.caminho, mime: arq.mime, tamanho: arq.tamanho })
          else {
            if (arq.size > 3 * 1024 * 1024) throw new Error(`${arq.name}: na demonstração o limite é 3 MB por anexo.`)
            anexos.push({ id: novoId(), formalizacao_id: id, anexo_id: anexoId, nome: arq.name, caminho: await lerArquivo(arq), mime: tipoArquivo(arq), tamanho: arq.size })
          }
        }
      }
      const registro = { id, lead_id: f.lead_id, tipo_id: tipo.id, tipo_nome: tipo.nome, codigo: f.codigo.trim(), cliente_nome: f.cliente, titulo: f.titulo.trim(), texto: f.texto,
        para: f.para, cc: f.cc || [], cco: f.cco || [], dados: dadosFormalizacao(f), situacao: 'pendente', tentativas: 0, enviado_por: c.email, criado_em: agora(), formalizacao_anexos: anexos }
      d.formalizacoes.push(registro)
      if (!d.caixas[c.email]) {
        Object.assign(registro, { situacao: 'falhou', erro: 'Cadastre sua caixa de e-mail em "Meu perfil" antes de enviar.', tentativas: 1 })
        gravar()
        throw new Error(registro.erro)
      }
      this._simularEnvio(d, registro, c)
      try {
        gravar(true)
      } catch {
        throw new Error('O navegador ficou sem espaço para a demonstração. Use anexos menores.')
      }
      return { id, ok: true, copia: 'Demonstração' }
    },
    _simularEnvio(d, registro, c) {
      Object.assign(registro, { situacao: 'simulado', erro: null, copia_enviados: 'Demonstração: nada foi enviado de verdade.', enviado_em: agora(), tentativas: registro.tentativas + 1 })
      const usados = new Set([...registro.para, ...registro.cc, ...registro.cco, ...(d.emailsUsados[c.email] || [])])
      d.emailsUsados[c.email] = [...usados]
      evento(d, registro.lead_id, 'formalizacao', { texto: registro.titulo, dados: { formalizacao_id: registro.id, tipo: registro.tipo_nome, para: registro.para, cc: registro.cc, anexos: registro.formalizacao_anexos.length } })
      const l = d.leads.find((x) => x.id === registro.lead_id)
      if (l && ehVendido(d, l) && !d.checklists[l.id]?.formalizacao_em) aplicarChecklist(d, l.id, { formalizacao_em: registro.enviado_em }, true)
    },
    async reenviarFormalizacao(id) {
      const d = base()
      const c = eu(d)
      const r = d.formalizacoes.find((x) => x.id === id)
      if (!r) throw new Error('Formalização não encontrada.')
      podeVer(d, c, r.lead_id)
      if (!d.caixas[c.email]) throw new Error('Cadastre sua caixa de e-mail em "Meu perfil" antes de enviar.')
      this._simularEnvio(d, r, c)
      gravar()
      return { ok: true }
    },
    async urlAnexoFormalizacao(a) {
      return URL.createObjectURL(await (await fetch(a.caminho)).blob())
    },
    async marcarChecklist(leadId, item, feito) {
      const d = base()
      const c = eu(d)
      podeVer(d, c, leadId)
      if (c.papel === 'captador') throw new Error('Seu perfil não tem permissão para esta ação.')
      if (!ITENS_CHECKLIST.some(([k]) => k === item)) throw new Error('Item inválido.')
      aplicarChecklist(d, leadId, { [`${item}_em`]: feito ? agora() : null })
      gravar()
    },
    async checklists() {
      const d = base()
      return JSON.parse(JSON.stringify(Object.values(d.checklists)))
    },
    async salarioMes(mes) {
      return salarios(base(), primeiroDia(mes))
    },
    async vendasDoMes(mes, vendedor) {
      const d = base()
      const c = eu(d)
      const todos = acessoMensal(c)
      return linhasDoMes(d, primeiroDia(mes), todos ? vendedor || null : c.email)
    },
    async pularVenda(leadId, motivo) {
      const d = base()
      const c = eu(d)
      if (!temPermissao(c, 'gestao_mensal_todos')) throw new Error('Somente o gerente ou o master pode pular uma venda.')
      if (String(motivo || '').trim().length < 3) throw new Error('Escreva o motivo.')
      const l = vendidos(d).find((x) => x.id === leadId)
      if (!l) throw new Error('Venda não encontrada.')
      if (d.pulos.some((p) => p.lead_id === leadId && !p.desfeito_em)) throw new Error('Esta venda já foi pulada.')
      const mes = competencia(l, d.checklists[l.id], d.pulos)
      if (d.checklists[l.id]?.completa_em && d.fechamentos.some((f) => f.mes === mes && f.vendedor_id === l.vendedor_id)) throw new Error('O mês desta venda já foi fechado.')
      d.pulos.push({ id: novoId(), lead_id: leadId, mes, motivo: motivo.trim(), por: c.email, em: agora(), desfeito_por: null, desfeito_em: null })
      evento(d, leadId, 'pulo', { texto: motivo.trim(), dados: { acao: 'pulou', mes } })
      gravar()
    },
    async desfazerPulo(leadId) {
      const d = base()
      const c = eu(d)
      if (!temPermissao(c, 'gestao_mensal_todos')) throw new Error('Somente o gerente ou o master pode desfazer.')
      const p = d.pulos.find((x) => x.lead_id === leadId && !x.desfeito_em)
      if (!p) throw new Error('Esta venda não está pulada.')
      Object.assign(p, { desfeito_por: c.email, desfeito_em: agora() })
      evento(d, leadId, 'pulo', { dados: { acao: 'desfez' } })
      gravar()
    },
    async fecharMes(mes) {
      const d = base()
      const c = eu(d)
      if (!temPermissao(c, 'gestao_mensal_todos')) throw new Error('Somente o gerente ou o master fecha o mês.')
      const m = primeiroDia(mes)
      if (m >= primeiroDia(new Date().toISOString())) throw new Error('Só dá para fechar um mês que já terminou.')
      const regua = reguaDoMes(d.reguas, m)
      let n = 0
      for (const s of salarios(d, m).filter((x) => !x.fechado)) {
        const vendas = linhasDoMes(d, m, s.vendedor_id).filter((x) => x.situacao === 'valida').map(({ lead_id, cliente, codigo_pedido, venda_data, venda_valor, venda_deflacionado }) => ({ lead_id, cliente, codigo_pedido, venda_data, venda_valor, venda_deflacionado }))
        d.fechamentos.push({ mes: m, vendedor_id: s.vendedor_id, total_deflacionado: s.total_deflacionado, faixa: s.faixa, comissao: s.comissao, fixo: s.fixo, total: s.total, vendas, regua_id: regua.id, fechado_por: c.email, fechado_em: agora() })
        n++
      }
      gravar()
      return n
    },
    async reguas() {
      const d = base()
      if (!temPermissao(eu(d), 'gestao_mensal')) throw new Error('Sem acesso à Gestão Mensal.')
      return JSON.parse(JSON.stringify(d.reguas)).sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))
    },
    // na demonstração não há servidor nem chave de IA: a geração mostra o aviso; histórico e diretrizes funcionam
    async gerarConteudo(pedido) {
      const e = errosConteudo(pedido)
      if (e) throw new Error(e)
      throw new Error('Na demonstração não há IA conectada. No portal real, o texto é gerado assim que o master cadastrar a chave da Anthropic em Configurações > Integrações.')
    },
    async testarIA() {
      throw new Error('Na demonstração não há servidor para testar a IA.')
    },
    async diretrizesMarca() {
      const d = base()
      d.marca = d.marca || { id: 1, tom_de_voz: 'Elegante, persuasivo e sem exageros. Próximo, mas sofisticado.', palavras_evitar: 'barato, promoção imperdível, o melhor do mundo, incrível!!!', hashtags_padrao: '#airam #moveisplanejados #marcenaria #altopadrao #projetosobmedida' }
      return { ...d.marca }
    },
    async salvarDiretrizes(m) {
      const d = base()
      exigirMaster(d)
      d.marca = { id: 1, tom_de_voz: m.tom_de_voz.trim(), palavras_evitar: m.palavras_evitar.trim(), hashtags_padrao: m.hashtags_padrao.trim(), atualizado_em: agora() }
      gravar()
    },
    async conteudosIA() {
      const d = base()
      const c = eu(d)
      return (d.conteudos || []).filter((x) => x.usuario_id === c.email || c.papel === 'admin').sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    },
    async salvarConteudo(x) {
      const d = base()
      const c = eu(d)
      if (!temPermissao(c, 'marketing')) throw new Error('Seu perfil não tem acesso ao Marketing.')
      d.conteudos = d.conteudos || []
      d.conteudos.push({ id: novoId(), usuario_id: c.email, modo: x.modo, pedido: x.pedido, variacoes: x.variacoes, texto_final: x.texto_final, criado_em: agora() })
      gravar()
    },
    async excluirConteudo(id) {
      const d = base()
      const c = eu(d)
      d.conteudos = (d.conteudos || []).filter((x) => !(x.id === id && (x.usuario_id === c.email || c.papel === 'admin')))
      gravar()
    },
    async salvarRegua(vigente_desde, faixas) {
      const d = base()
      exigirMaster(d)
      const e = errosRegua(faixas, vigente_desde)
      if (e) throw new Error(e)
      const linhas = faixas.map((f) => ({ de: Number(f.de), pct: Number(f.pct), fixo: Number(f.fixo) }))
      const r = d.reguas.find((x) => x.vigente_desde === vigente_desde)
      if (r) r.faixas = linhas
      else d.reguas.push({ id: novoId(), vigente_desde, faixas: linhas, criado_por: contaAtual(d).email, criado_em: agora() })
      gravar()
    },
  }
}

// os 4 tipos que vêm prontos (iguais aos do banco)
const ANEXOS_PADRAO = [{ id: 'promob', nome: 'Promob(s) vendido(s)', multiplo: true, obrigatorio: true }, { id: 'capa', nome: 'Capa do pedido do contrato', multiplo: false, obrigatorio: true }]
const CHECKLIST_MEDICAO = [
  { pergunta: 'Paredes definidas? (sem mudanças)', texto: 'Paredes definidas (sem mudanças)' }, { pergunta: 'Pé-direito / gesso definido?', texto: 'Pé-direito / gesso definido' },
  { pergunta: 'Pias / bancadas instaladas?', texto: 'Pias / bancadas instaladas' }, { pergunta: 'Tem lista de eletros?', texto: 'Lista de eletros disponível' },
]
export const TIPOS_PADRAO = [
  { id: 'venda_futura', nome: 'Formalização Venda Futura', titulo_modelo: '{codigo} - {cliente}', texto_modelo: '{codigo} - {cliente}\n\nSegue em anexo o projeto inicial do cliente.\n\nPROJETO FUTURO\nPrevisão do imóvel: {previsao}', campos: ['previsao'], anexos: ANEXOS_PADRAO, checklist: [], bloco_checklist: null, ativo: true, ordem: 1 },
  { id: 'venda_normal', nome: 'Formalização Venda Normal', titulo_modelo: '{codigo} - {cliente}', texto_modelo: '{codigo} - {cliente}\n\nSegue em anexo o projeto inicial do cliente.\n\n{checklist}', campos: [], anexos: ANEXOS_PADRAO, checklist: CHECKLIST_MEDICAO, bloco_checklist: 'Solicito medição.', ativo: true, ordem: 2 },
  { id: 'venda_complemento', nome: 'Formalização Venda Complemento', titulo_modelo: '{codigo} - {cliente}', texto_modelo: '{codigo} - {cliente}\n\nComplemento referente ao pedido de origem: {codigo_origem} - {nome_origem}', campos: ['origem'], anexos: [ANEXOS_PADRAO[1]], checklist: [], bloco_checklist: null, ativo: true, ordem: 3 },
  { id: 'solicitacao_medicao', nome: 'Solicitação de Medição', titulo_modelo: '{codigo} - {cliente}', texto_modelo: '{codigo} - {cliente}\n\nSegue em anexo o projeto inicial do cliente.\n\n{checklist}', campos: [], anexos: ANEXOS_PADRAO, checklist: CHECKLIST_MEDICAO, bloco_checklist: 'Solicito medição.', ativo: true, ordem: 4 },
]
