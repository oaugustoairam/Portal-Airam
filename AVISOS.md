# Avisos automáticos ao cliente (WhatsApp + e-mail)

A cada etapa do processo, o cliente recebe uma mensagem no WhatsApp e um e-mail, sem ninguém da
equipe precisar enviar.

| Quando acontece | Mensagem |
|---|---|
| Contrato ou projeto final enviado para assinatura | "Seu contrato está pronto para assinatura. Entre no Portal Airam…" |
| Contrato assinado | "Recebemos seu contrato assinado…" |
| Solução financeira marcada como OK | "Sua solução financeira foi aprovada…" |
| Dia da medição preenchido ou alterado | "Sua medição está agendada para 25/10/2026…" |
| Medição marcada como feita | "A medição dos seus ambientes foi concluída…" |
| Dia da conferência preenchido ou alterado | "A conferência do seu projeto final está marcada para…" |
| Conferência marcada como feita | "A conferência do seu projeto final foi concluída…" |
| Projeto final assinado (portal ou manual) | "Projeto final assinado! Seus móveis entraram em produção…" |
| Data de entrega alterada | "A entrega prevista dos seus móveis agora é…" |
| Entrega marcada como concluída | "Entrega e montagem concluídas! Obrigado por confiar na Airam…" |

- Cada processo tem a opção **"Avisar o cliente por WhatsApp e e-mail a cada etapa"** (aba Dados e prazos).
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
