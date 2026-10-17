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
  Nossas lojas (Mooca e Guarulhos, com mapa), Instagram e Site (endereços e links em `src/lib/contato.js`).
  Meu perfil: nome, sobrenome, Instagram, endereço de entrega dos móveis. Garantia de 10 anos na madeira +
  card "Padrão Airam" (dobradiças e corrediças ocultas com amortecimento; não é garantia).
  O fundo do topo alterna entre os renders do cliente (ou fotos da loja). Ao avançar de fase, aparece a transição.
- **Papéis**: admin, equipe, vendedor, cliente (`perfis.papel`). `eh_equipe()` = admin/equipe/vendedor;
  `eh_vendas()` = admin/vendedor.
- **Equipe**: área com seções.
  - **Processos**: Geral (resumo por fase + lista com filtros) e pastas Financeiro, Medição, Conferência,
    Assinatura do projeto final, Entregas, Vistoria, Assistência técnica (`src/lib/pastas.js`).
  - **Marketing**: E-mail marketing e Aniversários (novas ferramentas entram como novas pastas).
  - **Gestão de clientes** (só admin e vendedor; `src/components/GestaoClientes.jsx`, `src/lib/vendas.js`):
    Controle mensal (tabela `vendas`, igual à planilha FEEDBACK_VENDAS: resumo, ranking por vendedor e captação,
    "O que falta", planilha no modelo `src/assets/modelos/feedback-vendas.xlsx` e PDF), ficha da venda com
    financeiras/formas da Airam, **Fazer capa** (preenche `capa-envelope.xlsx`, frente e verso, em `src/lib/planilhas.js`)
    e **Controle de pastas** (`venda_documentos`, arquivos em `documentos/vendas/<id>/`; "Fechar venda" junta tudo
    num PDF com pdf-lib em `src/lib/pastaPdf.js`). Os modelos .xlsx são preenchidos célula a célula (`src/lib/xlsx.js`)
    sem mudar o desenho.
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
