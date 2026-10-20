# Como colocar o portal em portal.airam.arq.br

O site institucional (WordPress + Elementor na Hostinger) continua em **airam.arq.br**.
O portal fica num subdomínio próprio, **portal.airam.arq.br**, hospedado na Vercel a partir do GitHub privado.
O site só ganha um botão "Portal do Cliente" que leva para lá (sem iframe: o portal bloqueia ser aberto dentro de outro site).

## 1. Vercel (hospedagem do portal)

1. Crie a conta em vercel.com com o GitHub `oaugustoairam` (o repositório `Portal-Airam` é privado e continua privado).
   Uso comercial pede o plano **Pro** (o Hobby gratuito é só para uso pessoal).
2. **Add New → Project →** importe `Portal-Airam`. Framework: Vite. Build: `npm run build`. Saída: `dist`.
3. Em **Environment Variables** (Production), cadastre:
   - `VITE_SUPABASE_URL` = `https://jgpmwntrombiitntekes.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = a chave **anon / publishable** (Supabase → Project Settings → API).
     Nunca use a `service_role` / secret aqui.
4. **Deploy.** Teste no endereço `*.vercel.app` que a Vercel mostrar.

## 2. Subdomínio (Hostinger)

1. Na Vercel: projeto → **Settings → Domains → Add** → `portal.airam.arq.br`. Ela mostra um registro **CNAME** com o valor exato.
2. No hPanel da Hostinger: **Domínios → airam.arq.br → DNS / Nameservers → Gerenciar registros DNS**:
   - Tipo **CNAME**, Nome **portal**, Aponta para: o valor que a Vercel mostrou, TTL padrão. Salvar.
3. Em alguns minutos (até 24 h) a Vercel mostra "Valid Configuration" e emite o HTTPS sozinha.

## 3. Supabase (depois que o portal abrir)

- **Authentication → URL Configuration:** Site URL `https://portal.airam.arq.br`; Redirect URLs `https://portal.airam.arq.br/**`.
- **Edge Functions → Secrets:** `PORTAL_URL` = `https://portal.airam.arq.br` (links dos e-mails e bloqueio de chamadas de outros sites).

## 4. Botão no site (WordPress)

- **Menu:** Aparência → Menus → Links personalizados → URL `https://portal.airam.arq.br`, texto "Portal do Cliente" → Adicionar ao menu → Salvar.
- **Ou no cabeçalho do Elementor:** Modelos → Theme Builder → Cabeçalho → Editar → arraste um **Botão** → Link `https://portal.airam.arq.br`.

## O que protege o portal

- Regras e dados ficam no servidor: o banco (RLS) decide o que cada pessoa vê; vendedor, cliente e master têm acessos
  diferentes mesmo que alguém altere o código no navegador.
- Chaves secretas (service_role, Anthropic, ZapSign, Resend, WhatsApp) ficam só nos Secrets do Supabase.
- Repositório privado; build minificado e sem source maps; cabeçalhos de segurança em `vercel.json`
  (CSP, HSTS, proibição de iframe, noindex).
- O que vai para o navegador (telas) sempre pode ser visto por quem acessa, em qualquer site do mundo; por isso nada
  sensível fica nele.
