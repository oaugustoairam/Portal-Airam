// Prévia do e-mail marketing no portal. O servidor usa o mesmo modelo
// (supabase/functions/_shared/email.ts) — mantenha os dois iguais.
export function escapar(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export function htmlCampanha(c, nome) {
  const primeiro = (nome || '').split(' ')[0] || 'cliente'
  const paragrafos = escapar(String(c.conteudo || '').replaceAll('{{nome}}', primeiro))
    .split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`).join('')
  const link = /^https:\/\//.test(c.botao_link || '') ? c.botao_link : null
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;color:#2b2727">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:6px;overflow:hidden">
<tr><td style="background:#930000;color:#fff;padding:22px 28px;font-size:22px;font-weight:bold;letter-spacing:3px">AIRAM
<div style="font-size:12px;font-weight:normal;letter-spacing:0;opacity:.85">Arquitetura &amp; Marcenaria</div></td></tr>
${c.imagem_url && /^https:\/\//.test(c.imagem_url) ? `<tr><td><img src="${escapar(c.imagem_url)}" width="600" alt="" style="display:block;width:100%;height:auto"></td></tr>` : ''}
<tr><td style="padding:28px">
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.2;color:#930000;text-transform:uppercase">${escapar(c.titulo || 'Título do e-mail')}</h1>
${paragrafos || '<p style="margin:0;color:#6b6363">O texto do e-mail aparece aqui.</p>'}
${link && c.botao_texto ? `<a href="${escapar(link)}" style="display:inline-block;margin-top:8px;background:#930000;color:#fff;text-decoration:none;padding:14px 22px;border-radius:4px;font-weight:bold">${escapar(c.botao_texto)}</a>` : ''}
</td></tr>
<tr><td style="padding:18px 28px;font-size:12px;line-height:1.5;color:#6b6363;border-top:1px solid #e3dddd">
Airam Guarulhos · R. dos Cubas, 127 · Airam Mooca · Av. Paes de Barros, 3399<br>
Você recebe este e-mail por ser cliente Airam. <u>Não quero mais receber novidades</u>.
</td></tr></table></td></tr></table></body></html>`
}
