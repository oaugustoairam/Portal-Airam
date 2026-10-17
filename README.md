# Portal Airam — Arquitetura & Marcenaria

Sistema de processos pós-venda da Airam, com duas áreas:

**Cliente** (entra com e-mail ou CPF e senha; no primeiro acesso cria a própria senha)
- Cronograma: assinatura do contrato → solução financeira → medição → conferência do projeto final →
  assinatura do projeto final → produção (ícone animado) → entrega e montagem
- Prazo do processo: **Prazo normal** (medição disponível em até 90 dias após a venda) ou **Projeto futuro** (acima de 90)
- Contrato, projeto inicial, renders e projeto final
- Assinatura eletrônica ZapSign dentro do portal

**Equipe** (gerência = `admin`, funcionários = `equipe`)
- Lista de processos com indicadores, busca por nome ou código e filtro Normal/Futuro
- Cadastro: código + nome do cliente, CPF, datas com calendário, prazo obrigatório
- Anexos: Medição (somente a loja vê), projeto inicial, renders, projeto final
- Envio para assinatura (ZapSign), liberação de acesso com senha provisória e "Ver como cliente"

## Rodar no computador

```bash
npm install
npm run dev
```
Sem configuração, roda em **modo demonstração** (senha das contas de exemplo: `airam123`).

## Colocar no ar

1. Crie um projeto em https://supabase.com e rode `supabase/schema.sql` no **SQL Editor**.
2. Em **Authentication > Users > Add user**, crie seu usuário (e-mail + senha) e rode no SQL Editor:
   `update public.perfis set papel = 'admin', nome = 'Seu nome' where email = 'voce@airam.arq.br';`
   Para funcionários, use `papel = 'equipe'`.
3. Publique as funções do servidor e configure o ZapSign: veja [ZAPSIGN.md](ZAPSIGN.md).
4. Copie `.env.example` para `.env` com a URL e a *anon key* do Supabase.
5. Publique o site (Cloudflare Pages, Netlify ou Vercel): build `npm run build`, pasta `dist`, com as
   mesmas variáveis `VITE_SUPABASE_*`.

Segurança e configurações obrigatórias do painel: [SEGURANCA.md](SEGURANCA.md).

## App no celular (iPhone e Android)

O portal funciona como aplicativo instalado (PWA), sem precisar da App Store:
- **iPhone:** abra o portal no Safari > **Compartilhar** > **Adicionar à Tela de Início**. O portal mostra esse passo a passo ao cliente.
- **Android:** o portal mostra o botão **Instalar**.

O app abre em tela cheia, com ícone e tela de abertura da Airam. As telas ficam guardadas para abrir rápido, mas dados e documentos sempre vêm direto do servidor e nunca ficam salvos no aparelho.
