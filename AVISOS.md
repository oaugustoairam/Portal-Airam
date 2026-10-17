# Avisos automáticos ao cliente (WhatsApp + e-mail)

A cada etapa do processo, o cliente recebe uma mensagem no WhatsApp e um e-mail, sem ninguém da
equipe precisar enviar.

| Quando acontece | Mensagem |
|---|---|
| Solução financeira marcada como OK | "Sua solução financeira foi aprovada…" |
| Projeto inicial anexado (ou marcado como enviado) | "Seu projeto inicial está disponível no Portal Airam…" |
| Dia da medição preenchido ou alterado | "Sua medição está agendada para 25/10/2026…" |
| Medição marcada como feita | "A medição dos seus ambientes foi concluída…" |
| Dia da conferência preenchido ou alterado | "A conferência do seu projeto final está marcada para…" |
| Conferência marcada como feita | "A conferência do seu projeto final foi concluída…" |
| PDF do projeto final enviado para assinatura | "Seu projeto final está pronto para assinatura…" |
| Projeto final assinado (portal ou manual) | "Projeto final assinado! Seus móveis entraram em fabricação." |
| Prazo máximo para entrega alterado | "O prazo máximo para entrega dos seus móveis agora é…" |
| Montagem marcada como concluída | "Montagem concluída! Obrigado por confiar na Airam…" |

- Cada processo tem a opção **"Avisar o cliente por WhatsApp e e-mail a cada etapa"** (aba Dados e prazos).
- A aba **Cronograma interno** mostra, por etapa, o dia em que foi concluída e quando o e-mail e o WhatsApp saíram.
- A aba **Avisos** mostra tudo o que foi enviado, se chegou ou falhou, e tem um botão **Reenviar**.
- Os textos ficam em `supabase/schema.sql` (seção 9). Para mudar uma frase, edite ali e rode o SQL de novo.

## Como funciona por dentro

1. Quando a equipe salva uma mudança, um gatilho no banco coloca o aviso numa fila (`notificacoes`),
   uma linha para o e-mail e outra para o WhatsApp.
2. A cada minuto, o agendador do banco chama a função `enviar-notificacoes`, que envia o que está na
   fila. Se falhar, ela tenta de novo até 3 vezes. Erros aparecem na aba Avisos.

## Passo a passo para ativar

### 1. E-mail (Resend)
1. Crie uma conta em https://resend.com. O plano gratuito envia 3.000 e-mails por mês.
2. Em **Domains**, adicione `airam.arq.br` e cadastre os registros DNS que ele mostrar no provedor
   do domínio. Assim o e-mail sai como `portal@airam.arq.br` e não cai no spam.
3. Crie uma **API Key**.

### 2. WhatsApp (API oficial da Meta)
Use a API oficial. APIs "não oficiais" (que usam o WhatsApp Web) podem ter o número **banido**.

1. Em https://business.facebook.com, crie ou use o **Gerenciador de Negócios** da Airam e verifique a empresa.
2. Em https://developers.facebook.com, crie um app do tipo **Business** e adicione o produto **WhatsApp**.
3. Cadastre um número de telefone para a API. **Esse número não pode estar em uso no app WhatsApp
   comum.** O ideal é um número novo só para os avisos, e o WhatsApp atual da loja continua igual.
4. Anote o **Phone number ID** e gere um **token permanente** (Usuário do sistema com permissão `whatsapp_business_messaging`).
5. Em **Modelos de mensagem**, crie e envie para aprovação:
   - Nome: `atualizacao_processo` · Categoria: **Utilidade** · Idioma: **Português (BR)**
   - Corpo:
     ```
     Olá, {{1}}! Atualização do seu processo Airam {{2}}: {{3}} Acompanhe pelo portal: {{4}}
     ```
   - Exemplos para a Meta: `Marina` · `AIR-0154` · `Sua medição está agendada para 25/10/2026.` · `https://portal.airam.arq.br`

   Um único modelo atende todas as etapas, porque o texto de cada etapa entra no lugar do {{3}}.

### 3. Segredos no servidor (Supabase)
```bash
supabase secrets set RESEND_API_KEY=<chave> EMAIL_REMETENTE="Airam <portal@airam.arq.br>" \
  WHATSAPP_TOKEN=<token> WHATSAPP_PHONE_NUMBER_ID=<id> WHATSAPP_TEMPLATE=atualizacao_processo \
  NOTIFICACOES_SECRET=<senha-longa-inventada> PORTAL_URL=https://portal.airam.arq.br
supabase functions deploy enviar-notificacoes
```

### 4. Agendar o envio a cada minuto
No Supabase, ative as extensões **pg_cron** e **pg_net** (Database > Extensions) e rode no SQL
Editor, trocando os dois valores:
```sql
select cron.schedule('enviar-avisos-airam', '* * * * *', $$
  select net.http_post(
    url := 'https://<id-do-projeto>.supabase.co/functions/v1/enviar-notificacoes',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-airam-segredo', '<mesmo NOTIFICACOES_SECRET>'),
    body := '{}'::jsonb
  );
$$);
```

Sem o WhatsApp configurado, os avisos de WhatsApp aparecem como "Não enviado" e o e-mail continua
funcionando, e o contrário também vale.

## Custos aproximados

- **E-mail:** grátis até 3.000 por mês na Resend.
- **WhatsApp:** a Meta cobra por mensagem de *Utilidade* enviada. No Brasil fica em torno de **R$ 0,04
  a R$ 0,05** por mensagem. Confira a tabela atual em developers.facebook.com/docs/whatsapp/pricing.
  São cerca de 10 avisos por processo, então **menos de R$ 1 por cliente** no processo inteiro.
- Se o cliente responder, as mensagens dentro da conversa aberta por ele não são cobradas.

## LGPD

Os avisos são parte do serviço contratado (informações sobre o próprio pedido). Mesmo assim, informe
no contrato que o cliente vai receber atualizações por WhatsApp e e-mail. Se ele pedir para não
receber, desligue a opção no processo.

---

# Aniversários

- Cadastre a **data de nascimento** do cliente (aba Dados e prazos).
- A área **Aniversários** mostra o calendário do mês, os aniversários dos próximos 30 dias e o botão
  **Parabenizar no WhatsApp**, com a mensagem pronta.
- No dia, aparece um aviso no topo do painel da equipe.
- Os aniversários aparecem **só na área Marketing** (aba Aniversários).
- **Aviso diário às 9h no WhatsApp (e por e-mail):** a função `aniversarios-do-dia` roda todo dia às 9h de Brasília
  (12h UTC) e, se houver aniversariante, manda a lista para a equipe.
  1. Na Meta (WhatsApp Manager), crie o modelo **`aniversarios_do_dia`**, categoria *Utilidade*, idioma *Português (BR)*:
     ```
     Bom dia! Hoje é aniversário de {{1}} cliente(s) da Airam: {{2}}. Abra o portal em Marketing > Aniversários para mandar os parabéns.
     ```
     Exemplos para a Meta: `2` · `Marina Duarte (AIR-0154), Carla Nogueira (AIR-0158)`.
  2. Em Edge Functions > Secrets: `AVISOS_EQUIPE_WHATSAPP=5511989776738` (pode ter vários, separados por vírgula),
     além de `WHATSAPP_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`. Opcional: `AVISOS_EQUIPE_EMAIL=voce@airam.arq.br`.
  3. Agende (SQL Editor):
  ```sql
  select cron.schedule('aniversarios-airam', '0 12 * * *', $$
    select net.http_post(
      url := 'https://<id-do-projeto>.supabase.co/functions/v1/aniversarios-do-dia',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-airam-segredo', '<mesmo NOTIFICACOES_SECRET>'),
      body := '{}'::jsonb);
  $$);
  ```
  O WhatsApp só chega depois que a conta da Meta estiver ativa e o modelo aprovado. Sem isso, o e-mail continua funcionando.

# E-mail marketing

1. Na área **E-mail marketing**, escreva o assunto, o título, o texto, uma imagem (opcional) e um botão (opcional).
   `{{nome}}` vira o primeiro nome do cliente. A prévia mostra o e-mail como o cliente recebe.
2. Escolha os clientes: todos, em andamento, concluídos, prazo normal/futuro ou aniversariantes do mês.
3. Clique em **Enviar** e confirme. O histórico mostra quantos foram entregues.

**LGPD:** todo e-mail tem o link **"Não quero mais receber novidades"**. Quem clica sai da lista na hora
(os avisos do processo continuam). A opção também pode ser desmarcada no cadastro do cliente.

**Ativar:** `supabase secrets set MARKETING_SECRET=<texto-longo> EMAIL_MARKETING_REMETENTE="Airam <novidades@airam.arq.br>"`,
depois `supabase functions deploy enviar-campanha` e `supabase functions deploy descadastrar`.

**Limites da Resend:** no plano gratuito são 100 e-mails por dia e 3.000 por mês. Para campanhas maiores,
o plano pago (a partir de ≈ US$ 20/mês) libera 50.000 por mês. Confira os valores atuais no site da Resend.
