# Fase 2 — análise e modelo de dados proposto

Stack atual (mantida): React 18 + Vite, CSS próprio, Supabase (Postgres com RLS, Auth, Storage, Edge Functions,
pg_cron). Mesmo login, mesmo visual.

## 1. O que já existe e o que falta

| Item do pedido | Situação hoje | O que falta |
|---|---|---|
| 0. Perfis | master, gerente, vendedor, captador + permissões no banco | Ferramentas, Gestão Mensal e Configurações no banco; "Marketing" do captador por chave liberada pelo master |
| 1.1 Captação | pronta e testada | aceitar **DWG** e **.zip** (conversa do WhatsApp); link direto do cartão no aviso |
| 1.2 Calendário | pronto | **cor por vendedor ou por loja** (hoje a cor é pela situação) |
| 1.3 CRM | pronto | modal de VENDIDOS com **valor bruto, valor deflacionado e código do pedido**; progresso do checklist (3/5) no cartão |
| 1.4 Cartão | pronto | seções **Checklist de venda** e **Formalizações** |
| 1.5 Lembretes | prontos (aviso pelo servidor a cada minuto) | link do cartão na mensagem |
| 1.6 Briefing | pronto com 6 perguntas | trocar pelas **9 perguntas novas** (já em andamento) |
| 1.7 Métricas | prontas (15 gráficos, PDF, Excel) | separar **faturamento bruto** de deflacionado quando o campo novo existir |
| 2.1 Calculadora | só a regra interna de prazos (feriados nacionais) | tela nova + feriados de SP, São Paulo e Guarulhos + recessos da empresa |
| 2.2 Formalização | não existe (só o campo de data no controle interno) | tudo |
| 3. Criador de conteúdo IA | não existe (a chave da Anthropic já é usada na leitura de RG/CNH) | tudo |
| 4. Gestão Mensal | não existe (Gestão de clientes > Resultados é outra coisa e continua) | tudo |
| 5. Configurações | dentro de Comercial + seção Usuários | virar **aba própria do master** juntando tudo |

Nada existente é removido: Gestão de clientes e Processos continuam na barra.
Barra proposta: **Comercial · Ferramentas · Gestão de clientes · Processos · Marketing · Gestão Mensal · Configurações**.

## 2. Modelo de dados novo

```
-- permissões novas (tem_permissao): ferramentas, gestao_mensal, gestao_mensal_todos
--   vendedor: ferramentas, gestao_mensal (só o próprio)   gerente: + gestao_mensal_todos
--   captador: nenhuma das três; marketing só se o master ligar

leads (+ venda_bruto, venda_deflacionado, codigo_pedido)          -- venda_valor vira o bruto

venda_checklist   lead_id PK, contrato_assinado, documento_cliente, formalizacao_enviada (automático),
                  financeiro_resolvido, pasta_feita  (cada item: feito_em, feito_por)
                  completa_em (preenchido pelo banco quando os 5 itens ficam prontos)
venda_pulos       id, lead_id, mes (AAAA-MM), motivo, por, em, desfeito_por, desfeito_em

regua_comissao    id, vigente_desde (mês), faixas jsonb [{de, ate, pct, fixo}], criado_por
fechamentos_mes   mes, vendedor_id, total_deflacionado, faixa, pct, comissao, fixo, total,
                  vendas jsonb (cópia congelada), regua_id, fechado_por, fechado_em
                  → mês fechado não muda mesmo se a régua ou uma venda mudar depois
-- cálculo numa função do banco (salario_mes(mes, vendedor)): o vendedor só recebe o dele (RLS);
-- o captador não tem acesso a nada disso

feriados_empresa  id, data, nome, tipo (feriado | recesso), abrangencia (todas | sao_paulo | guarulhos)
-- feriados nacionais, estaduais e municipais calculados no código para qualquer ano (Páscoa → Carnaval,
-- Sexta-feira Santa, Corpus Christi)

caixas_email      usuario_id PK, email, senha_cifrada (pgcrypto, chave só no servidor), testado_em, erro
tipos_formalizacao id, nome, titulo_modelo, texto_modelo, campos jsonb, anexos_obrigatorios jsonb,
                  checklist jsonb, ativo, ordem    -- os tipos A a D vêm prontos; o master cria outros
formalizacoes     id, lead_id, tipo_id, codigo, cliente_nome, titulo, texto, para[], cc[], cco[],
                  dados jsonb, situacao (enviado | falhou), erro, enviado_por, enviado_em, copia_imap (ok/erro)
formalizacao_anexos id, formalizacao_id, nome, caminho (documentos/comercial/<lead>/formalizacoes/...), tamanho
emails_usados     usuario_id, email, ultimo_uso                  -- sugestão de destinatários

conteudos_ia      id, usuario_id, modo (texto | imagem), pedido jsonb, variacoes jsonb, escolhido, editado,
                  salvo_em
diretrizes_marca  1 linha: tom_de_voz, palavras_evitar, hashtags_padrao, atualizado_por
-- integracoes (já existe): + chave da IA (ou o segredo ANTHROPIC_API_KEY)

historico_acoes   (já existe como registro_atividades + lead_eventos) → envio de formalização,
                  pular/desfazer venda, fechar mês e mudanças de régua também entram
```

## 3. Servidor (Edge Functions)

- `formalizacao-enviar`: confere tudo de novo, envia por **SMTP smtp.hostinger.com:465 (SSL)** com a conta do
  vendedor e grava a cópia em "Enviados" por **IMAP imap.hostinger.com:993**; marca o checklist.
- `caixa-email`: salva a senha cifrada e faz o "Testar conexão" (SMTP e IMAP). A senha nunca volta para a tela.
- `conteudo-ia`: chama a Claude API (com imagem) usando a chave do servidor e as diretrizes da marca.
- Limite de anexos: 25 MB no total (o limite da Hostinger por mensagem); o portal avisa antes de enviar.

## 4. WhatsApp — recomendação

**WhatsApp Cloud API oficial da Meta** (já é a que você escolheu e a que está pronta no portal): é a única
sem risco de bloqueio do número, cobra só por conversa de utilidade (centavos) e não precisa de servidor
ligado. Z-API e Evolution usam o WhatsApp Web (risco de banimento e precisam de um celular conectado);
Twilio usa a mesma API da Meta, mas com custo adicional por mensagem.

## 5. Decisões do dono (21/10/2026)

- **Valor deflacionado:** por enquanto digitado à mão no modal de VENDIDOS (gerente e master podem corrigir,
  com histórico). Depois virá uma função automática — o campo fica pronto para receber o cálculo.
- **Competência:** venda com checklist completo só no mês seguinte entra no mês em que completou.
- **Checklist de venda:** o vendedor marca no cartão; gerente e master conferem e podem desmarcar.
  "E-mail de formalização enviado" é sempre automático. Tudo vai para o histórico.
- **Seletor do salário:** o mês escolhido é o mês das vendas (outubro → "Você recebe no dia 10/11").
- **WhatsApp:** API oficial da Meta (mantida).
