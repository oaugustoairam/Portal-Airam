# Plano de desenvolvimento — Sistema Airam

## Etapa 1 · Diagnóstico (estado em 17/10/2026)

**Tecnologia:** React 18 + Vite 5 (CSS puro), Supabase (Postgres com RLS, Auth, Storage privado, Edge Functions em Deno).
Modo demonstração em `localStorage` quando não há variáveis do Supabase. Produção: projeto `jgpmwntrombiitntekes`
(banco já com o esquema atual, 0 contratos cadastrados, 1 usuário master).

**Banco atual (principais tabelas):**

| Tabela | Papel hoje |
|---|---|
| `perfis` | usuários (admin = master, equipe, vendedor, cliente) + `permissoes` jsonb |
| `processos` | **um contrato/venda**: dados do cliente copiados, etapas do portal, `vendedor_id`, `codigo` e `numero_contrato` (dois campos — será unificado) |
| `comercial` (1:1) | vendedor, captação, loja (só guarulhos/mooca), financeira, valores, meios, situação, observação, `cliente_meu`, `envio_email` (só data), `contrato` jsonb (ambientes e parcelas) |
| `controle_interno` (1:1) | datas reais: medição, liberador, conferência, PDF, assinatura, entrega, montagem, vistoria, ATT |
| `pasta_documentos` | controle de pastas (comprovantes, contrato assinado, documento com foto…) |
| `documentos`, `assinaturas`, `notificacoes`, `perfil_cliente` | portal do cliente, ZapSign, avisos |
| `registro_atividades` | auditoria automática (antes/depois) em processos, comercial, controle, pasta |

**Permissões hoje:** `tem_permissao()` (gestao, processos, marketing, ver_todos, excluir), `pode_gerir(processo)`,
RLS por vendedor (`vendedor_id`). Master muda acessos por `definir_acesso`.

**Limitações encontradas:**
1. Não existe tabela de **clientes**: o cliente vive dentro do contrato → um cliente com 2 contratos vira 2 cadastros.
2. Número do contrato é digitado (risco de repetir) e existe `codigo` + `numero_contrato` (dois identificadores).
3. Ambientes ficam dentro de um JSON, sem arquivo XML nem peças.
4. Loja aceita só Guarulhos/Mooca, com lista fixa no banco.
5. Não há perfis Gerente, Logística e Pós-venda, nem bloqueio temporário, nem proteção do último master.
6. Marketing tem e-mail e aniversários, sem IA.

## Arquitetura escolhida (sem refazer o que funciona)

- **Contrato = `processos`** (continua sendo a unidade do portal do cliente, das pastas, dos resultados e da logística).
- Nova tabela **`clientes`** (pessoa, CPF único). Cada contrato aponta para um cliente (`processos.cliente_id`).
  Os campos do cliente que o portal já usa continuam no contrato, sincronizados automaticamente pelo banco.
- **Número do contrato** gerado pelo banco (sequência), gravado em `codigo` e `numero_contrato` (mesmo valor, não editável).
  Chave de criação única impede contrato duplicado por clique repetido ou envio repetido.
- Nova tabela **`ambientes`** (nome, linha, materiais, valor bruto, valor no contrato, XML do Promob, peças).
- Nova tabela **`lojas`** (Guarulhos, Mooca, Online; novas lojas sem mudar código).

## Etapas

| Etapa | Conteúdo | Situação |
|---|---|---|
| 1 | Diagnóstico e plano | feito |
| 2 | Cadastro e contratos: clientes, numeração automática, CEP com lupa, leitura de RG/CNH, ambientes com XML do Promob, vendedor automático, loja obrigatória, Boletos Casa, data/hora do e-mail de formalização | feito (17/10/2026) |
| 3 | Clientes, Resultados (edição direta, situação/solução financeira só aqui, comentários financeiros com histórico) e Controle de pastas | a fazer |
| 4 | Logística e Pós-venda (campos de cada setor, pendências, integração com pastas) | a fazer |
| 5 | Perfis Vendedor, Logística, Pós-venda, Gerente e Master no banco; bloqueio temporário; auditoria; proteção do Master | a fazer |
| 6 | Marketing com IA (ideias, imagens, 2 sugestões, histórico) | a fazer |
| 7 | Testes completos dos cenários | ao fim de cada etapa + final |

## O que depende de você

- **Número inicial dos contratos**: começou em 100002126 (logo após o maior da planilha, 100002125). Se a fábrica continuar numerando por fora, o master avança a sequência.
- **Arquivos XML reais do Promob** (2 ou 3 ambientes) para ajustar o leitor de peças.
- **Chave da API da Anthropic (Claude)** em Supabase > Edge Functions > Secrets (`ANTHROPIC_API_KEY`):
  usada para ler RG/CNH e para o Marketing com IA.
