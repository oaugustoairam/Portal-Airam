// Envia uma formalização pela caixa de e-mail de quem está logado (Hostinger, SMTP 465) e guarda a cópia em
// "Enviados" (IMAP 993). Registra o resultado, o histórico do cartão e marca o checklist da venda.
import { cors, resposta, clienteServidor, exigirEquipe, regraDoUsuario } from '../_shared/comum.ts'
import { decifrar, smtpEntrar, smtpEnviar, imapGuardarEnviado, montarMensagem } from '../_shared/correio.ts'

const LIMITE = 18 * 1024 * 1024
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const quem = await exigirEquipe(req)
  if (!quem) return resposta({ erro: 'Acesso negado.' }, 403)
  if (!(await regraDoUsuario(req, 'tem_permissao', { chave: 'ferramentas' }))) return resposta({ erro: 'Seu perfil não tem acesso às Ferramentas.' }, 403)
  const { id } = await req.json().catch(() => ({}))
  const sb = clienteServidor()
  const { data: f } = await sb.from('formalizacoes').select('*, tipos_formalizacao(*), formalizacao_anexos(*)').eq('id', id).maybeSingle()
  if (!f || !(await regraDoUsuario(req, 'pode_ver_lead', { lid: f.lead_id }))) return resposta({ erro: 'Formalização não encontrada.' }, 404)

  const falhar = async (erro: string, status = 400) => {
    await sb.from('formalizacoes').update({ situacao: 'falhou', erro, tentativas: f.tentativas + 1 }).eq('id', f.id)
    return resposta({ erro }, status)
  }
  // confere de novo o que a tela conferiu
  const tipo = f.tipos_formalizacao
  const anexos = f.formalizacao_anexos ?? []
  for (const a of tipo?.anexos ?? []) if (a.obrigatorio && !anexos.some((x) => x.anexo_id === a.id)) return falhar(`Falta o anexo obrigatório: ${a.nome}.`)
  if ((tipo?.campos ?? []).includes('previsao') && !String(f.dados?.previsao ?? '').trim()) return falhar('Falta a previsão do imóvel.')
  if ((tipo?.campos ?? []).includes('origem') && !String(f.dados?.codigo_origem ?? '').trim()) return falhar('Falta o pedido de origem.')
  const destinos = [...f.para, ...f.cc, ...f.cco]
  if (!f.para.length || destinos.some((e: string) => !emailOk(e))) return falhar('Confira os destinatários.')
  if (anexos.reduce((s: number, a) => s + Number(a.tamanho || 0), 0) > LIMITE) return falhar('Os anexos passam do limite de 18 MB.')

  const { data: caixa } = await sb.from('caixas_email').select('email, senha_cifrada').eq('usuario_id', quem.id).maybeSingle()
  if (!caixa) return falhar('Cadastre sua caixa de e-mail em "Meu perfil" antes de enviar.')
  const arquivos = []
  for (const a of anexos) {
    const { data, error } = await sb.storage.from('documentos').download(a.caminho)
    if (error || !data) return falhar(`Não consegui ler o anexo ${a.nome}.`, 500)
    arquivos.push({ nome: a.nome, mime: a.mime, dados: new Uint8Array(await data.arrayBuffer()) })
  }
  const senha = await decifrar(caixa.senha_cifrada)
  const mensagem = montarMensagem({ de: caixa.email, nomeDe: quem.nome || caixa.email, para: f.para, cc: f.cc, assunto: f.titulo, texto: f.texto, anexos: arquivos })
  try {
    const c = await smtpEntrar(caixa.email, senha)
    await smtpEnviar(c, caixa.email, destinos, mensagem)
  } catch (e) {
    return falhar(`Não enviado: ${e.message}`, 502)
  }
  // a cópia em "Enviados" não desfaz o envio se falhar
  let copia = 'ok'
  try {
    copia = `ok: ${await imapGuardarEnviado(caixa.email, senha, mensagem)}`
  } catch (e) {
    copia = `falhou: ${e.message}`
  }
  const agora = new Date().toISOString()
  await sb.from('formalizacoes').update({ situacao: 'enviado', erro: null, copia_enviados: copia, enviado_em: agora, tentativas: f.tentativas + 1 }).eq('id', f.id)
  await sb.from('emails_usados').upsert(destinos.map((email: string) => ({ usuario_id: quem.id, email, ultimo_uso: agora })))
  await sb.from('lead_eventos').insert({ lead_id: f.lead_id, tipo: 'formalizacao', por: quem.id, texto: f.titulo,
    dados: { formalizacao_id: f.id, tipo: f.tipo_nome, para: f.para, cc: f.cc, anexos: anexos.length } })
  // checklist da venda: "E-mail de formalização enviado" (só para cartões em Vendidos)
  const { data: col } = await sb.from('leads').select('crm_colunas(tipo)').eq('id', f.lead_id).maybeSingle()
  // relação muitos-para-um: vem como objeto (o tipo gerado diz lista)
  const coluna = (Array.isArray(col?.crm_colunas) ? col.crm_colunas[0] : col?.crm_colunas) as { tipo?: string } | undefined
  if (coluna?.tipo === 'ganho') {
    const { data: ck } = await sb.from('venda_checklist').select('lead_id, formalizacao_em').eq('lead_id', f.lead_id).maybeSingle()
    if (!ck) await sb.from('venda_checklist').insert({ lead_id: f.lead_id, formalizacao_em: agora })
    else if (!ck.formalizacao_em) await sb.from('venda_checklist').update({ formalizacao_em: agora }).eq('lead_id', f.lead_id)
  }
  return resposta({ ok: true, copia })
})
