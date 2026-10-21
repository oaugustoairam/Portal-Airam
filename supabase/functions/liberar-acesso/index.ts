// Cria (ou renova) o acesso do cliente com uma senha provisória.
// Chamado pela equipe no painel. No primeiro login o cliente é obrigado a trocar a senha.
import { cors, resposta, clienteServidor, exigirEquipe, gerarSenhaProvisoria, regraDoUsuario } from '../_shared/comum.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const equipe = await exigirEquipe(req)
  if (!equipe) return resposta({ erro: 'Acesso negado' }, 403)

  const { processo_id } = await req.json()
  if (!(await regraDoUsuario(req, 'pode_gerir', { pid: processo_id }))) return resposta({ erro: 'Este cliente não é seu.' }, 403)
  const sb = clienteServidor()
  const { data: proc } = await sb.from('processos').select('*').eq('id', processo_id).maybeSingle()
  if (!proc) return resposta({ erro: 'Processo não encontrado' }, 404)
  if (!proc.cliente_email) return resposta({ erro: 'Cadastre o e-mail do cliente antes de liberar o acesso.' }, 400)

  const email = proc.cliente_email.toLowerCase()
  const senha = gerarSenhaProvisoria()

  // procura usuário existente pelo e-mail
  const { data: perfilExistente } = await sb.from('perfis').select('id, papel').ilike('email', email).maybeSingle()
  let userId = perfilExistente?.id
  if (perfilExistente && perfilExistente.papel !== 'cliente') {
    return resposta({ erro: 'Este e-mail pertence a um funcionário. Use outro e-mail para o cliente.' }, 400)
  }
  if (userId) {
    const { error } = await sb.auth.admin.updateUserById(userId, { password: senha, email_confirm: true })
    if (error) return resposta({ erro: error.message }, 400)
  } else {
    const { data, error } = await sb.auth.admin.createUser({ email, password: senha, email_confirm: true })
    if (error) return resposta({ erro: error.message }, 400)
    userId = data.user.id
  }
  await sb.from('perfis').upsert({ id: userId, email, nome: proc.cliente_nome, papel: 'cliente', precisa_trocar_senha: true })
  // registra que o acesso foi liberado (para a liberação em lote não renovar a senha de quem já recebeu)
  await sb.from('processos').update({ acesso_liberado_em: new Date().toISOString() }).eq('cliente_email', proc.cliente_email)

  // e-mail com a senha (opcional: só se RESEND_API_KEY estiver configurada)
  let emailEnviado = false
  const chaveResend = Deno.env.get('RESEND_API_KEY')
  if (chaveResend) {
    const portal = Deno.env.get('PORTAL_URL') ?? ''
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chaveResend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_REMETENTE') ?? 'Airam <portal@airam.arq.br>',
        to: email,
        subject: 'Seu acesso ao Portal Airam',
        html: `<p>Olá, ${proc.cliente_nome}!</p>
<p>Seu acesso ao Portal Airam está liberado. Por lá você acompanha prazos, contrato e projetos dos seus móveis.</p>
<p><b>Endereço:</b> ${portal}<br><b>Login:</b> seu e-mail ou CPF<br><b>Senha provisória:</b> ${senha}</p>
<p>No primeiro acesso você vai criar uma senha só sua.</p>
<p>Airam Arquitetura &amp; Marcenaria</p>`,
      }),
    })
    emailEnviado = r.ok
  }

  // A senha volta para a equipe poder enviar também por WhatsApp. Não fica salva em lugar nenhum.
  return resposta({ senha, email, emailEnviado })
})
