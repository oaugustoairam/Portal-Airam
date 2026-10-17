# Assinatura ZapSign dentro do Portal Airam

O cliente assina o **PDF do projeto final** sem sair do portal. A tela do ZapSign abre dentro da
página da Airam, com a cor da marca.

O **contrato** não passa pelo portal: ele é assinado na loja, antes de o cliente receber o acesso.
A equipe só anexa o PDF já assinado (Anexos > "Contrato assinado").

## Como funciona

1. A equipe anexa o PDF do projeto final (aba **Anexos**, tipo *Projeto final*).
2. Na aba **Assinaturas**, a equipe clica em **Enviar para assinatura**. O servidor manda o PDF ao
   ZapSign, com nome, e-mail e CPF do cliente travados, e guarda o link de assinatura.
3. O cliente entra no portal e vê **"O PDF do seu projeto final está pronto para assinatura → Assinar agora"**.
   Ele lê, desenha a assinatura e confirma com um código que chega no e-mail dele.
4. O ZapSign avisa o portal (webhook). O PDF assinado é salvo nos anexos com o selo "Assinado" e a
   etapa "Projeto final · Assinatura" fica concluída. A **Fabricação** começa a aparecer para o cliente.

O token do ZapSign fica só no servidor (Supabase Edge Functions). Ele nunca vai para o site.

## Passo a passo para ativar

1. **Conta ZapSign com API.** Peça ao comercial deles um plano com API. Para testar, use o ambiente
   *sandbox*, que é gratuito e sem validade jurídica: https://sandbox.app.zapsign.com.br
2. **Token da API:** ZapSign > Configurações > Integrações > API ZapSign > copiar token.
3. **Publicar as funções do servidor** (com a [CLI do Supabase](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase login
   supabase link --project-ref <id-do-projeto>
   supabase secrets set ZAPSIGN_API_TOKEN=<token> ZAPSIGN_WEBHOOK_SECRET=<senha-longa-inventada> \
     ZAPSIGN_API_URL=https://sandbox.api.zapsign.com.br PORTAL_URL=https://portal.airam.arq.br
   supabase functions deploy liberar-acesso
   supabase functions deploy entrar-cpf
   supabase functions deploy zapsign-enviar
   supabase functions deploy zapsign-webhook
   ```
4. **Webhook no ZapSign:** Configurações > Integrações > Webhooks
   - URL: `https://<id-do-projeto>.supabase.co/functions/v1/zapsign-webhook`
   - Eventos: *Documento assinado* e *Documento recusado*
   - Header: nome `x-airam-segredo`, valor = o mesmo `ZAPSIGN_WEBHOOK_SECRET`
5. **Testar no sandbox:** crie um processo, anexe um PDF de contrato, envie para assinatura, entre
   como cliente e assine.
6. **Ir para produção:** troque `ZAPSIGN_API_URL` para `https://api.zapsign.com.br`, use o token de
   produção e cadastre o webhook também na conta de produção.

## Opcional

- `ZAPSIGN_LOJA_NOME` e `ZAPSIGN_LOJA_EMAIL`: o representante da Airam entra como segundo
  signatário e recebe o e-mail do ZapSign. O documento só conta como "assinado" quando os dois
  assinarem.
- `ZAPSIGN_LOGO_URL`: logo exibido na tela de assinatura.

## Arquivos

- `supabase/functions/zapsign-enviar`: envia o PDF e cria o link de assinatura
- `supabase/functions/zapsign-webhook`: recebe o aviso e salva o PDF assinado
- `src/components/AssinaturaModal.jsx`: janela de assinatura dentro do portal
