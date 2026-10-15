// Envia um PDF do processo (contrato ou projeto final) para o ZapSign e guarda o link
// de assinatura do cliente. O cliente assina dentro do Portal Airam (iframe do ZapSign).
import { cors, resposta, clienteServidor, exigirEquipe, somenteNumeros } from '../_shared/comum.ts'

const API = Deno.env.get('ZAPSIGN_API_URL') ?? 'https://sandbox.api.zapsign.com.br' // produção: https://api.zapsign.com.br
const NOMES = { contrato: 'Contrato', projeto_final: 'Projeto final' }

function emBase64(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const equipe = await exigirEquipe(req)
  if (!equipe) return resposta({ erro: 'Acesso negado' }, 403)

  const token = Deno.env.get('ZAPSIGN_API_TOKEN')
  if (!token) return resposta({ erro: 'ZAPSIGN_API_TOKEN não configurado no servidor.' }, 500)

  const { processo_id, documento_id, tipo } = await req.json()
  if (!NOMES[tipo]) return resposta({ erro: 'Tipo de assinatura inválido' }, 400)

  const sb = clienteServidor()
  const { data: proc } = await sb.from('processos').select('*').eq('id', processo_id).maybeSingle()
  const { data: doc } = await sb.from('documentos').select('*').eq('id', documento_id).eq('processo_id', processo_id).maybeSingle()
  if (!proc || !doc) return resposta({ erro: 'Processo ou documento não encontrado' }, 404)
  if (doc.tipo_mime !== 'application/pdf') return resposta({ erro: 'Envie um arquivo PDF para assinatura.' }, 400)

  // já existe assinatura pendente desse tipo? evita duplicar
  const { data: pendente } = await sb.from('assinaturas').select('id')
    .eq('processo_id', processo_id).eq('tipo', tipo).eq('status', 'pendente').maybeSingle()
  if (pendente) return resposta({ erro: `Já existe ${NOMES[tipo].toLowerCase()} aguardando assinatura. Cancele antes de enviar outro.` }, 409)

  const arquivo = await sb.storage.from('documentos').download(doc.arquivo_path)
  if (arquivo.error) return resposta({ erro: 'Não foi possível ler o PDF' }, 500)
  const base64 = emBase64(new Uint8Array(await arquivo.data.arrayBuffer()))

  // cria o registro antes para usar o id como external_id no ZapSign
  const { data: assinatura, error: errIns } = await sb.from('assinaturas')
    .insert({ processo_id, tipo, documento_id, status: 'pendente' }).select().single()
  if (errIns) return resposta({ erro: errIns.message }, 500)

  const cpf = somenteNumeros(proc.cliente_cpf)
  const signatarios = [{
    name: proc.cliente_nome,
    email: proc.cliente_email,
    ...(cpf ? { cpf, require_cpf: true, validate_cpf: true } : {}),
    auth_mode: 'assinaturaTela-tokenEmail',   // desenho na tela + código no e-mail
    send_automatic_email: false,               // o cliente assina pelo portal
    lock_name: true,
    lock_email: true,
    qualification: 'Contratante',
    external_id: `cliente-${proc.id}`,
  }]
  // representante da loja (opcional): recebe o e-mail do ZapSign para assinar também
  const lojaNome = Deno.env.get('ZAPSIGN_LOJA_NOME')
  const lojaEmail = Deno.env.get('ZAPSIGN_LOJA_EMAIL')
  if (lojaNome && lojaEmail) {
    signatarios.push({
      name: lojaNome, email: lojaEmail, auth_mode: 'assinaturaTela', send_automatic_email: true,
      qualification: 'Contratada', external_id: 'loja',
    })
  }

  const r = await fetch(`${API}/api/v1/docs/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${NOMES[tipo]} ${proc.codigo} - ${proc.cliente_nome}`,
      base64_pdf: base64,
      lang: 'pt-br',
      external_id: assinatura.id,
      brand_name: 'Airam Arquitetura & Marcenaria',
      brand_primary_color: '#930000',
      ...(Deno.env.get('ZAPSIGN_LOGO_URL') ? { brand_logo: Deno.env.get('ZAPSIGN_LOGO_URL') } : {}),
      signers: signatarios,
    }),
  })
  const zs = await r.json().catch(() => ({}))
  if (!r.ok || !zs.token) {
    await sb.from('assinaturas').delete().eq('id', assinatura.id)
    return resposta({ erro: 'ZapSign recusou o envio', detalhe: zs }, 502)
  }
  const signer = zs.signers.find((s) => s.external_id === `cliente-${proc.id}`) ?? zs.signers[0]
  await sb.from('assinaturas').update({
    zapsign_doc_token: zs.token,
    zapsign_signer_token: signer.token,
    sign_url: signer.sign_url,
  }).eq('id', assinatura.id)

  return resposta({ ok: true, assinatura_id: assinatura.id })
})
