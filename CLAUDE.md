# Portal Airam

Portal do cliente e gestão interna da **Airam Arquitetura & Marcenaria** (móveis planejados, lojas em Guarulhos e Mooca).
Dono: Augusto (augusto@airam.arq.br). Tudo em português do Brasil, com linguagem simples para o cliente.

## O que o sistema faz

- **Cliente** (entra com e-mail, CPF ou telefone + senha): acompanha as 7 etapas do processo (Solução financeira,
  Projeto inicial, Medição, Projeto final · Conferência, Projeto final · Assinatura, Fabricação, Montagem), vê
  documentos e renders, assina o projeto final pelo ZapSign dentro do portal, edita "Meu perfil".
  Para o cliente, a linha do tempo começa em **Compra** (data da venda) e a solução financeira não é etapa:
  com pendência, aparece um lembrete no topo (`linhaDoTempo(p, a, { cliente: true })`).
  Abas do cliente, nesta ordem: Meu perfil, Meu processo, Contrato, Projeto inicial, Renders, Projeto final,
  Quem somos (texto do site), Nossas lojas (Mooca e Guarulhos, com mapa), Instagram e Site (`src/lib/contato.js`).
  Topo com o logo no centro, fixo ao rolar. Cliente baixa arquivos e renders (um a um ou .zip).
  Meu perfil: o cliente só muda foto, e-mail, celular, Instagram e senha; nome, CPF, nascimento e endereço são só leitura
  (gatilho `travar_perfil_cliente` no banco). Garantia de 10 anos na madeira +
  card "Padrão Airam" só tipográfico (dobradiças e corrediças ocultas com amortecimento; não é garantia).
  O fundo do topo alterna entre os renders do cliente (ou fotos da loja). Ao avançar de fase, aparece a transição.
- **Papéis**: admin (= master), equipe, vendedor, cliente (`perfis.papel`) + `perfis.permissoes` (gestao, processos,
  marketing, ver_todos, excluir; padrões em `src/lib/permissoes.js` = `tem_permissao()` no banco). `eh_equipe()` = interno;
  `ve_todos()`; `pode_gerir(pid)`. Vendedor sem `ver_todos` vê só processos com `vendedor_id` = ele (RLS).
  O master muda acessos na seção **Usuários** (`definir_acesso`, função `criar-usuario`).
- **Equipe** (ordem da barra): Gestão de clientes, Processos, Marketing (Aniversários primeiro, depois E-mail marketing), Usuários (só master).
  Aniversários do dia aparecem só no Marketing; WhatsApp às 9h pela função `aniversarios-do-dia` (pg_cron 12h UTC).
  - **Gestão de clientes** (`src/components/GestaoClientes.jsx`, regras em `src/lib/gestao.js`): **sistema único** — o cadastro
    da gestão é o próprio processo do portal (`processos`) + `comercial` (1:1, só gestão) + `controle_interno`.
    Abas como a planilha 001 GESTÃO DE CLIENTES: Clientes, Futuros, Conferências, Entrega e montagem, Assistência técnica,
    Montados, Resultados (resumo/ranking, planilha `feedback-vendas.xlsx` e PDF por período) e Controle de pastas
    (`pasta_documentos`, arquivos em `documentos/<pid>/pasta/`; "Fechar venda" → PDF com pdf-lib em `src/lib/pastaPdf.js`).
    Planilha com filtro/ordenação por coluna e período de qualquer dia (`PlanilhaFiltravel.jsx`; cartões no celular).
    Importa a aba 01 CLIENTES (`registrosDaPlanilha`, `lerPlanilha` em `src/lib/xlsx.js`). **Fazer capa** preenche
    `capa-envelope.xlsx` (`src/lib/planilhas.js`, via `paraVenda`). Excluir cliente pede digitar EXCLUIR (`ConfirmarExclusao.jsx`).
  - **Processos**: Geral e pastas Financeiro, Medição, Conferência, Assinatura do projeto final, Entregas, Vistoria,
    Assistência técnica (`src/lib/pastas.js`).
  - No processo: Dados e prazos, Anexos (cliente vê), Arquivos internos (só a loja: medição, Promob vendido,
    documentos do cliente, ficha cadastral), Assinaturas, Controle interno, Avisos, Acesso do cliente.
  - **Controle interno** (`controle_interno`, só equipe): datas reais de cada passo, liberador, montador,
    ATT (= assistência técnica) com retorno máximo e conclusão, vistoria, e-mail de formalização interna.
    Prazos internos: conferência 5 dias úteis após o liberador receber; PDF 5 dias úteis após enviar a conferência.
  - **Relatórios**: selecionar processos → 1 cliente = PDF de uma página A4; vários = lista (PDF e planilha).

## Prazos do contrato

5 dias úteis financeiro · 10 dias úteis medição + projeto final · entrega em 45 dias úteis a partir do
2º dia útil após a assinatura do projeto final · montagem começa em até 7 e termina em até 10 dias úteis.
Dias úteis sem feriados municipais (`somarDiasUteis` em `src/lib/constants.js`).

## Técnica

- React 18 + Vite 5, CSS puro em `src/styles.css` (as regras do fim do arquivo prevalecem). Fonte Albert Sans.
  Cores Airam: #930000, #6e0000, #f2f2f2, #393939.
- Supabase: Postgres com RLS, Auth, Storage privado (`documentos`, `avatares`), Edge Functions em
  `supabase/functions`. Esquema completo e idempotente em `supabase/schema.sql` (pode rodar de novo).
  Projeto de produção: ref `jgpmwntrombiitntekes` (região us-east-2).
- Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` o app roda em **modo demonstração** (dados no
  localStorage, `src/lib/demo.js`, senha `airam123`). Ao mudar os dados de exemplo, suba a versão em `CHAVE_DEMO`.
- PDFs com `@react-pdf/renderer`, carregado só quando alguém gera relatório (`src/components/relatorio`).
- Segredos de servidor ficam em Supabase > Edge Functions > Secrets. Nunca coloque tokens no código.
- Documentação: `README.md`, `SEGURANCA.md`, `ZAPSIGN.md`, `AVISOS.md`.

## Pendências

- Publicar na Vercel (variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`), depois liberar o domínio
  no Auth do Supabase (Site URL / Redirect URLs) e definir o segredo `PORTAL_URL`.
- Contas a criar: ZapSign, Resend (e-mail), Meta WhatsApp Cloud API, Twilio (SMS).

## Comandos

```bash
npm install
npm run dev     # desenvolvimento
npm run build   # gera dist/
```
