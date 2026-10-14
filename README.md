# Portal do Cliente — Airam Arquitetura & Marcenaria

Portal onde cada cliente entra com o próprio e-mail e acompanha o projeto:

- **Fase atual** e linha do tempo com todas as etapas (concluída, em andamento, a iniciar, atrasada)
- **Prazos**: data de cada etapa e entrega final, com contagem de dias
- **Documentos** por tipo: contrato, projeto inicial, renders (com galeria), projeto final e outros
- **Recado por etapa** (ex.: "aguardando aprovação do layout")

O escritório tem um painel para criar projetos, editar etapas e prazos, enviar arquivos e ver o projeto como o cliente vê.

## Rodar no computador

```bash
npm install
npm run dev
```

Sem configuração, roda em **modo demonstração** (dados de exemplo no navegador).

## Colocar no ar com dados reais (≈ 20 min, plano gratuito)

1. Crie uma conta em https://supabase.com e um projeto novo.
2. No Supabase, abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e rode.
3. Em **Authentication > URL Configuration**, coloque o endereço do portal (ex.: `https://portal.airam.arq.br`) em *Site URL* e *Redirect URLs*.
4. Copie `.env.example` para `.env` e preencha com a URL e a *anon key* (Project Settings > API).
5. Publique na Vercel ou Netlify (importe o repositório; adicione as mesmas duas variáveis de ambiente). Comando de build: `npm run build`, pasta: `dist`.
6. Entre no portal com o e-mail do escritório e, no SQL Editor, rode:
   `update public.perfis set papel = 'admin' where email = 'seu@email';`
7. Crie um projeto com o e-mail do cliente. O cliente entra pelo link mágico que recebe por e-mail; ele só vê os projetos ligados ao e-mail dele (garantido pelo banco, via Row Level Security).

## Estrutura

- `src/lib/api.js` — acesso a dados (Supabase ou demonstração)
- `src/components/ProjetoView.jsx` — tela que o cliente vê
- `src/components/AdminHome.jsx` — painel do escritório
- `supabase/schema.sql` — tabelas, permissões e armazenamento de arquivos
