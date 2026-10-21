// Caixa de e-mail do usuário (Hostinger): salvar com a senha cifrada, testar a conexão (SMTP e IMAP) e remover.
// A senha nunca volta para o navegador nem aparece em log.
import { cors, resposta, clienteServidor, exigirEquipe } from '../_shared/comum.ts'
import { cifrar, decifrar, smtpEntrar, imapEntrar } from '../_shared/correio.ts'

async function testar(email: string, senha: string) {
  const erros: string[] = []
  try {
    const c = await smtpEntrar(email, senha)
    await c.escrever('QUIT\r\n').catch(() => {})
    c.fechar()
  } catch (e) {
    erros.push(`Envio (SMTP): ${e.message}`)
  }
  try {
    const i = await imapEntrar(email, senha)
    await i.cmd('LOGOUT').catch(() => {})
    i.c.fechar()
  } catch (e) {
    erros.push(`Cópia em Enviados (IMAP): ${e.message}`)
  }
  return erros.length ? erros.join(' · ') : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const quem = await exigirEquipe(req)
  if (!quem) return resposta({ erro: 'Acesso negado.' }, 403)
  const sb = clienteServidor()
  const corpo = await req.json().catch(() => ({}))
  const estado = async () => {
    const { data } = await sb.from('caixas_email').select('email, testado_em, teste_ok, erro').eq('usuario_id', quem.id).maybeSingle()
    return data
  }

  if (corpo.acao === 'remover') {
    await sb.from('caixas_email').delete().eq('usuario_id', quem.id)
    return resposta({ caixa: null })
  }
  if (corpo.acao === 'salvar') {
    const email = String(corpo.email ?? '').trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return resposta({ erro: 'E-mail inválido.' }, 400)
    let senha = String(corpo.senha ?? '')
    if (!senha) {
      // trocar só o e-mail mantendo a senha já salva
      const { data } = await sb.from('caixas_email').select('senha_cifrada').eq('usuario_id', quem.id).maybeSingle()
      if (!data) return resposta({ erro: 'Informe a senha da caixa de e-mail.' }, 400)
      senha = await decifrar(data.senha_cifrada)
    }
    if (senha.length > 200) return resposta({ erro: 'Senha muito longa.' }, 400)
    const erro = await testar(email, senha)
    const { error } = await sb.from('caixas_email').upsert({ usuario_id: quem.id, email, senha_cifrada: await cifrar(senha), testado_em: new Date().toISOString(),
      teste_ok: !erro, erro, atualizado_em: new Date().toISOString() })
    if (error) return resposta({ erro: 'Não foi possível salvar a caixa.' }, 500)
    return resposta({ caixa: await estado() })
  }
  if (corpo.acao === 'testar') {
    const { data } = await sb.from('caixas_email').select('email, senha_cifrada').eq('usuario_id', quem.id).maybeSingle()
    if (!data) return resposta({ erro: 'Cadastre a caixa de e-mail primeiro.' }, 400)
    const erro = await testar(data.email, await decifrar(data.senha_cifrada))
    await sb.from('caixas_email').update({ testado_em: new Date().toISOString(), teste_ok: !erro, erro }).eq('usuario_id', quem.id)
    return resposta({ caixa: await estado() })
  }
  return resposta({ caixa: await estado() })
})
