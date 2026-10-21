# Aba COMERCIAL — análise e modelo de dados

## O que o portal já tem e será reaproveitado

| Já existe | Uso no Comercial |
|---|---|
| React 18 + Vite, Supabase (Postgres com RLS, Auth, Storage privado, Edge Functions, pg_cron) | mesma stack, mesmo login |
| `perfis` (papel + permissões) e a tela **Usuários** do master | novos papéis **gerente** e **captador**; campo **WhatsApp** do usuário |
| `lojas` (Guarulhos, Mooca, Online) | loja do agendamento |
| Lista de captações (AMIGOS PESSOAIS, ARQUITETURA, …) | vira a tabela configurável **origens do lead** |
| Envio de WhatsApp (API oficial da Meta) e e-mail (Resend) nas funções do servidor | avisos de novo lead e lembretes |
| `registro_atividades` (auditoria automática) | histórico de tudo que muda |
| `@react-pdf/renderer` (relatórios A4) | PDF do briefing |
| Planilha filtrável e período de qualquer dia | lista de leads e filtros das métricas |
| **Novo cliente / Contrato** | quando o lead é vendido, vira cliente + contrato sem digitar de novo |

## Modelo de dados proposto

```
perfis (+ whatsapp, papel: admin | gerente | captador | vendedor | equipe | cliente)

origens_lead     id, nome, ativa, ordem                       (configurável)
motivos_perda    id, nome, ativa, ordem                       (configurável)
crm_colunas      id, nome, ordem, tipo: entrada|normal|ganho|perdido, ativa
                 → NOVO CLIENTE (entrada), NÃO RESPONDE, VENDIDOS (ganho), PERDIDOS (perdido);
                   o master cria colunas intermediárias sem mudar código

leads            id, nome, telefone, email, origem_id, captador_id, vendedor_id,
                 coluna_id, posicao (ordem no quadro), conversa_texto,
                 venda_valor, venda_data, perda_motivo_id, perda_texto,
                 processo_id (contrato gerado, quando vendido),
                 criado_em, primeiro_contato_em, movido_em
lead_arquivos    id, lead_id, tipo: planta|referencia|conversa, nome, caminho, mime, tamanho
                 → Storage privado: documentos/comercial/<lead>/...
agendamentos     id, lead_id, vendedor_id, inicio, fim, modalidade: loja|online, loja_id,
                 situacao: marcado|compareceu|nao_compareceu|cancelado, criado_por
lead_eventos     id, lead_id, tipo: criado|movido|nota|agendamento|remarcado|lembrete|briefing|vendido|perdido,
                 de_coluna, para_coluna, texto, dados, por, quando     ← base dos relatórios
lembretes        id, lead_id, vendedor_id, quando, tipo, descricao, concluido_em, notificado_em
briefings        lead_id, feito, forma: mensagem|ligacao, data, endereco, ja_mora, previsao_morar,
                 pessoas, obra, obra_detalhes, eletros, observacoes
avisos_equipe    id, usuario_id, canal: whatsapp|email, evento, lead_id, mensagem,
                 situacao: pendente|enviado|falhou, erro, tentativas, criado_em, enviado_em
```

## Regras de acesso (no banco, RLS)

| Papel | Leads / cartões | Calendário | Métricas |
|---|---|---|---|
| Master | todos | todos | todas |
| Gerente | todos | todos | todas |
| Captador | cadastra; vê todos | todos | todas |
| Vendedor | **só os dele** (vendedor_id = ele) | só os dele | só as dele (filtro travado) |

As métricas saem de funções do banco que respeitam essas regras: o vendedor recebe apenas os próprios números,
mesmo que alguém altere a tela.

## Etapas

1. Modelo de dados, perfis e permissões
2. Captação / Agendamentos (novo lead com anexos)
3. CRM Kanban + cartão do cliente
4. Calendário
5. Briefing + PDF
6. Avisos de novo lead (WhatsApp + e-mail) com registro e reenvio
7. Lembretes com aviso agendado no servidor
8. Métricas de Vendas (filtros, gráficos, PDF e Excel/CSV)
