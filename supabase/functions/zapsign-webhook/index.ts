// Recebe os avisos do ZapSign. Configure no ZapSign (Configurações > Integrações > Webhooks):
//   URL: https://<seu-projeto>.supabase.co/functions/v1/zapsign-webhook
//   Header: x-airam-segredo = <mesmo valor de ZAPSIGN_WEBHOOK_SECRET>
// Quando o documento fica totalmente assinado, o PDF assinado é salvo no portal.
import { clienteServidor } from '../_shared/comum.ts'

const ok = () => new Response('ok', { status: 200 })

Deno.serve(async (req) => {
  const segredo = Deno.env.get('ZAPSIGN_WEBHOOK_SECRET')
  if (!segredo || req.headers.get('x-airam-segredo') !== segredo) return new Response('negado', { status: 401 })

  const ev = await req.json().catch(() => null)
  if (!ev?.token) return ok()

  const sb = clienteServidor()
  const { data: assinatura } = await sb.from('assinaturas').select('*').eq('zapsign_doc_token', ev.token).maybeSingle()
  if (!assinatura || assinatura.status === 'assinado') return ok() // desconhecido ou já processado

  if (ev.event_type === 'doc_refused') {
    await sb.from('assinaturas').update({ status: 'recusado' }).eq('id', assinatura.id)
    return ok()
  }
  // doc_signed chega a cada signatário; só finaliza quando o documento inteiro estiver assinado
  if (ev.event_type !== 'doc_signed' || ev.status !== 'signed' || !ev.signed_file) return ok()

  const pdf = await fetch(ev.signed_file)
  if (!pdf.ok) return new Response('falha ao baixar', { status: 500 }) // ZapSign tenta de novo
  const caminho = `${assinatura.processo_id}/assinados/${assinatura.tipo}-${assinatura.id}.pdf`
  const up = await sb.storage.from('documentos').upload(caminho, await pdf.arrayBuffer(), {
    contentType: 'application/pdf', upsert: true,
  })
  if (up.error) return new Response('falha ao salvar', { status: 500 })

  const { data: doc } = await sb.from('documentos').insert({
    processo_id: assinatura.processo_id,
    categoria: assinatura.tipo,
    titulo: assinatura.tipo === 'contrato' ? 'Contrato assinado' : 'Projeto final assinado',
    arquivo_path: caminho,
    tipo_mime: 'application/pdf',
    assinado: true,
  }).select().single()

  await sb.from('assinaturas').update({
    status: 'assinado',
    assinado_em: ev.signer_who_signed?.signed_at ?? new Date().toISOString(),
    documento_assinado_id: doc?.id ?? null,
  }).eq('id', assinatura.id)

  if (assinatura.tipo === 'projeto_final') {
    await sb.from('processos').update({ data_assinatura_projeto: new Date().toISOString().slice(0, 10) })
      .eq('id', assinatura.processo_id).is('data_assinatura_projeto', null)
  }
  return ok()
})
