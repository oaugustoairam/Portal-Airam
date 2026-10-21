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
  Quem somos (texto do site; 25 anos de experiência), Nossas lojas (Mooca e Guarulhos, com mapa), Instagram e Site (`src/lib/contato.js`).
  Na aba Contrato o cliente vê valor total, ambientes (valor do contrato, nunca o bruto) e parcelas (`valores_do_meu_contrato`).
  Topo com o logo no centro, fixo ao rolar. Cliente baixa arquivos e renders (um a um ou .zip). A jornada aparece também embaixo das abas de documentos.
  Meu perfil: o cliente só muda foto, e-mail, celular, Instagram e senha; nome, CPF, nascimento e endereço são só leitura
  (gatilho `travar_perfil_cliente` no banco). Garantia de 10 anos na madeira +
  card "Padrão Airam" só tipográfico (dobradiças e corrediças ocultas com amortecimento; não é garantia).
  O fundo do topo alterna entre os renders do cliente (ou fotos da loja). Ao avançar de fase, aparece a transição.
- **Papéis**: admin (= master), gerente, captador (SDR), equipe, vendedor, cliente (`perfis.papel`, + `perfis.whatsapp`) + `perfis.permissoes` (gestao, processos,
  marketing, ver_todos, excluir, comercial, comercial_todos, comercial_config; padrões em `src/lib/permissoes.js` = `tem_permissao()` no banco). `eh_equipe()` = interno;
  `ve_todos()`; `pode_gerir(pid)`. Vendedor sem `ver_todos` vê só processos com `vendedor_id` = ele (RLS).
  O master muda acessos na seção **Usuários** (`definir_acesso`, função `criar-usuario`).
- **Comercial** (1ª da barra; `Comercial.jsx`, `src/lib/comercial.js`, plano em `COMERCIAL.md`): leads (`leads`, `lead_arquivos`,
  `agendamentos`, `lead_eventos` = histórico, `lembretes`, `briefings`, `avisos_equipe`), listas configuráveis (`origens_lead`,
  `motivos_perda`, `crm_colunas`). Vendedor só vê o que é dele (RLS); gerente/captador/master veem todos (`comercial_todos()`).
  Gatilho `regras_lead`: captador não move cartão nem marca venda/perda; vendido exige valor e data; perdido exige motivo;
  só quem vê todos troca o vendedor. CRM separado do contrato (decisão do dono). Comparecimento é marcado no agendamento.
  WhatsApp dos avisos: API oficial da Meta. Telas em `src/components/comercial/` (Captação, CRM, Cartão, Lembretes,
  Calendário, Métricas com PDF/Excel) e dados em `src/lib/apiComercial.js` (Supabase + demonstração com as mesmas regras).
  Avisos da equipe: gatilhos enfileiram em `avisos_equipe`; função `avisos-equipe` (pg_cron a cada minuto) envia e registra.
  Credenciais do WhatsApp/e-mail: tela do master grava na tabela `integracoes` (sem acesso pelo app). `perfis.ativo` desativa usuário.
- **Equipe** (ordem da barra): Comercial, Gestão de clientes, Processos, Marketing (Aniversários primeiro, depois E-mail marketing), Usuários (só master).
  Aniversários do dia aparecem só no Marketing; WhatsApp às 9h pela função `aniversarios-do-dia` (pg_cron 12h UTC).
  - **Novo cliente / Contrato** (1ª pasta da Gestão, `NovoContrato.jsx`): cria cliente + contrato pela função do banco
    `criar_contrato` (valida no servidor; chave de criação impede duplicar; vendedor = quem está logado, só quem vê todos escolhe).
    Tabela `clientes` (CPF único) → `processos.cliente_id`; um cliente pode ter vários contratos. **Número do contrato = código**,
    gerado pela sequência `contrato_numero_seq` (gatilho `numerar_contrato`, não editável; master avança com `definir_numeracao`).
    Ambientes em `ambientes` (valor bruto ≠ valor no contrato; XML do Promob em `<contrato>/interno/promob/`, peças lidas por
    `src/lib/promob.js`, só uso interno). Lojas/canais em `lojas` (Guarulhos, Mooca, Online). CEP pelo ViaCEP (`src/lib/cadastro.js`).
    RG/CNH: função `ler-documento` (Claude, segredo `ANTHROPIC_API_KEY`); o usuário confere antes de aplicar. Plano: `PLANO.md`.
  - **Gestão de clientes** (`src/components/GestaoClientes.jsx`, regras em `src/lib/gestao.js`): **sistema único** — o cadastro
    da gestão é o próprio processo do portal (`processos`) + `comercial` (1:1, só gestão) + `controle_interno`.
    Abas: Clientes (lista total, colunas da planilha 001 GESTÃO DE CLIENTES; o status filtra as fases),
    Resultados (controle mensal: resumo/ranking, planilha `feedback-vendas.xlsx` e PDF por período, com a lista das vendas
    e o estado de cada pasta) e Controle de pastas (mesmo período dos Resultados)
    (`pasta_documentos`, arquivos em `documentos/<pid>/pasta/`; "Fechar venda" → PDF com pdf-lib em `src/lib/pastaPdf.js`).
    Planilha com filtro/ordenação por coluna e período de qualquer dia (`PlanilhaFiltravel.jsx`; cartões no celular).
    **Contrato e ambientes** (ficha do cliente, `ContratoEditor.jsx`): ambientes do contrato, XML/peças e o PDF
    (`relatorio/PdfContrato.jsx`, modelo e texto do contrato da loja; `montarContratoPdf` em `src/lib/contrato.js`).
    **Liberar acessos ao portal** em lote (`LiberarEmLote.jsx`; `processos.acesso_liberado_em` evita trocar senha de quem já tem).
    Renders/fotos grandes são reduzidos para 2400 px WebP antes de subir (`src/lib/imagem.js`).
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
- Documentação: `README.md`, `SEGURANCA.md`, `ZAPSIGN.md`, `AVISOS.md`, `HOSPEDAGEM.md` (portal em portal.airam.arq.br).

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
