# Segurança do Portal do Cliente

## Como o portal protege os dados

| Camada | O que faz | Onde está |
|---|---|---|
| **Login com senha** | O cliente entra com e-mail ou CPF e senha. A equipe gera uma senha provisória e o cliente é obrigado a trocá-la no primeiro acesso. O login por CPF roda no servidor e não revela se o CPF existe. | Supabase Auth + `entrar-cpf` |
| **Esqueci minha senha** | O cliente pede um código de 6 dígitos por SMS ou e-mail e cria a nova senha sozinho. O código vale 10 minutos e é guardado só como *hash*. São no máximo 5 tentativas por código e 3 códigos a cada 15 minutos. A resposta é a mesma exista ou não o cadastro. | `recuperar-senha` + `redefinir-senha` |
| **Isolamento por cliente** | O banco só entrega um processo, um documento, uma assinatura ou um arquivo se o e-mail **confirmado** do usuário for o e-mail cadastrado no projeto. A regra fica no banco, então nem um app adulterado consegue burlar. | `supabase/schema.sql` (Row Level Security) |
| **Cliente só lê** | Clientes não criam, editam nem apagam nada. Medição é interna: o cliente não vê nem o registro nem o arquivo. | `schema.sql` |
| **Assinaturas** | Só o servidor marca um documento como assinado, depois do aviso do ZapSign. O webhook confere um segredo, e nem a equipe consegue forjar um "assinado". | `zapsign-*` |
| **Equipe** | Os papéis `admin` e `equipe` só mudam pelo SQL Editor do Supabase. O app não tem como promover ninguém. | `schema.sql`, tabela `perfis` |
| **Arquivos privados** | O bucket de arquivos é privado. Cada documento abre por um link temporário que expira em 10 minutos. | `schema.sql` + `src/lib/api.js` |
| **Limite de arquivos** | Só PDF, JPG, PNG, WEBP e DWG, até 50 MB. A regra vale no navegador e no servidor. | `schema.sql` + `api.js` |
| **Registro de atividades** | Toda criação, alteração e exclusão de projeto, etapa ou documento fica registrada com quem fez e quando. Só o admin lê, e ninguém apaga pelo app. | tabela `registro_atividades` |
| **Cabeçalhos do site** | HTTPS obrigatório, bloqueio do portal dentro de iframes (clickjacking) e Content-Security-Policy contra scripts injetados. | `vercel.json` / `public/_headers` |

Essas regras foram testadas num Postgres local: um cliente vê só o próprio projeto. Outro cliente, um visitante anônimo e alguém que crie uma conta com o e-mail de um cliente sem confirmar a caixa de entrada não veem nada. Clientes também não conseguem editar dados nem virar administrador.

## Configurações no painel do Supabase (faça uma vez)

1. **Authentication > Providers > Email**: desligue **Allow new users to sign up**. As contas são
   criadas só pela equipe, em "Liberar acesso".
2. **Authentication > URL Configuration**: em *Redirect URLs*, coloque só o endereço oficial do portal (ex.: `https://portal.airam.arq.br`). Assim ninguém consegue redirecionar o link de login para outro site.
3. **Authentication > Rate Limits**: mantenha os limites de tentativas de login, para dificultar quem tenta adivinhar senhas.
4. **Authentication > Attack Protection**: o **CAPTCHA** (Cloudflare Turnstile) impede robôs de testarem senhas. **Só ative depois** de o widget ser adicionado à tela de login. Esse é um próximo passo do portal, e ligar antes bloqueia todos os logins.
5. **Authentication > SMTP**: use um e-mail próprio, como `portal@airam.arq.br`, via Resend, SendGrid ou o provedor do seu domínio. Os clientes passam a confiar no remetente e o e-mail não cai no spam.
6. **Project Settings > API**: a chave `anon` pode ficar no site, porque as regras acima a protegem. A chave **`service_role` nunca** pode ir para o código do site nem ser enviada por WhatsApp ou e-mail.
7. **Contas da equipe**: ative a verificação em duas etapas (2FA) na conta do Supabase, na Vercel/Netlify e no GitHub. Quem invade uma dessas contas tem acesso a tudo.
8. **Backups**: o plano Pro do Supabase faz backup diário. No gratuito, exporte o banco periodicamente (Database > Backups).

## LGPD (dados pessoais)

- Publique uma **política de privacidade** dizendo quais dados o portal guarda (nome, e-mail, endereço da obra, documentos), para quê e por quanto tempo.
- Ao apagar um projeto pelo painel, os arquivos e registros dele também são apagados. Use isso quando o cliente pedir exclusão.
- Só a equipe que precisa deve ter papel `admin`.

## Próximos reforços recomendados

- **2FA para administradores no próprio portal**: código do Google Authenticator para quem acessa o painel do escritório. O Supabase oferece isso nativamente, e dá para exigir no banco que o admin só altere dados com 2FA ativo.
- **Tela de registro de atividades** no painel, em vez de consultar pelo Supabase.
- **Marca d'água** com o nome do cliente nos PDFs de projeto, para desestimular repasse.

## SMS do "Esqueci minha senha" (Twilio)

1. Crie uma conta em https://www.twilio.com e compre um número com SMS, ou peça um remetente para o Brasil.
2. Cadastre no Supabase: `supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM=+1... CODIGO_PEPPER=<texto-longo>`
3. Publique: `supabase functions deploy recuperar-senha` e `supabase functions deploy redefinir-senha`

Sem a Twilio configurada, o cliente ainda recupera a senha por e-mail (Resend).
