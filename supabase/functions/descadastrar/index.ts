// Link "Não quero mais receber novidades" dos e-mails de marketing (LGPD).
// Os avisos do processo (etapas, assinatura) continuam chegando.
import { clienteServidor } from '../_shared/comum.ts'
import { tokenDescadastro, escapar } from '../_shared/email.ts'

function pagina(titulo, texto) {
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapar(titulo)}</title><body style="margin:0;font-family:Arial,sans-serif;background:#f2f2f2;color:#2b2727">
<div style="max-width:480px;margin:48px auto;background:#fff;border-radius:6px;overflow:hidden">
<div style="background:#930000;color:#fff;padding:18px 24px;font-weight:bold;letter-spacing:3px">AIRAM</div>
<div style="padding:24px"><h1 style="font-size:20px;color:#930000;margin:0 0 12px">${escapar(titulo)}</h1><p style="line-height:1.5;margin:0">${escapar(texto)}</p></div></div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const email = (url.searchParams.get('e') || '').toLowerCase()
  const token = url.searchParams.get('t') || ''
  if (!email || token !== (await tokenDescadastro(email))) return pagina('Link inválido', 'Este link não é válido ou está incompleto.')
  await clienteServidor().from('processos').update({ aceita_marketing: false }).ilike('cliente_email', email)
  return pagina('Pronto', 'Você não vai mais receber e-mails de novidades da Airam. Os avisos sobre o andamento do seu processo continuam normalmente.')
})
