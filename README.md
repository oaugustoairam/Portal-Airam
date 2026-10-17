# Portal Airam — Arquitetura & Marcenaria

Sistema de processos pós-venda da Airam, com duas áreas:

**Cliente** (entra com e-mail ou CPF e senha; no primeiro acesso cria a própria senha; se esquecer,
recebe um código por SMS ou e-mail e redefine sozinho)
- Jornada: solução financeira → projeto inicial → medição → projeto final · conferência →
  projeto final · assinatura (PDF assinado pelo portal) → fabricação (ícone animado) → montagem
- O contrato é assinado na loja, antes do acesso; no portal ele aparece em Anexos como "Contrato assinado"
- Prazo máximo para entrega com contagem de dias
- Entrega futura: contagem regressiva com o logo da Airam "carregando" como um relógio até a previsão do imóvel pronto
- Garantia Airam de 10 anos na madeira, com a data de validade após a montagem
- O tipo do contrato (normal / entrega futura) é só interno
- Prazo do processo: **Prazo normal** (medição disponível em até 90 dias após a venda) ou **Projeto futuro** (acima de 90)
- Anexos: contrato assinado, projeto inicial (PDF), renders e projeto final
- Assinatura eletrônica do projeto final pelo ZapSign, dentro do portal

**Equipe** (gerência = `admin`, funcionários = `equipe`)
- Lista de processos com indicadores, busca por nome ou código e filtro Normal/Futuro
- Cadastro: código + nome do cliente, CPF, datas com calendário, prazo obrigatório
- Anexos: Medição (somente a loja vê), projeto inicial, renders, projeto final
- Cronograma interno: dia em que cada etapa foi concluída, dias entre etapas e quando cada e-mail/WhatsApp saiu
- Envio do projeto final para assinatura (ZapSign), liberação de acesso com senha provisória e "Ver como cliente"
- Filtros: situação, prazo, etapa atual, financeiro, período de entrega, busca por nome/código/CPF/telefone
- Avisos automáticos ao cliente por WhatsApp e e-mail a cada etapa: veja [AVISOS.md](AVISOS.md)
- Aniversários: calendário mensal, próximos 30 dias, aviso no painel e e-mail diário para a equipe
- E-mail marketing: criar o conteúdo com prévia, escolher os clientes e enviar (com descadastro, LGPD)

O cliente tem um botão de WhatsApp em todas as telas, com o nome e o código dele já na mensagem
(configure `VITE_WHATSAPP_AIRAM` no `.env`).

## Rodar no computador

```bash
npm install
npm run dev
```
Sem configuração, roda em **modo demonstração** (senha das contas de exemplo: `airam123`).

## Colocar no ar

1. Crie um projeto em https://supabase.com e rode `supabase/schema.sql` no **SQL Editor**.
2. Em **Authentication > Users > Add user**, crie seu usuário (e-mail + senha) e rode no SQL Editor:
   `update public.perfis set papel = 'admin', nome = 'Seu nome' where email = 'voce@airam.arq.br';`
   Para funcionários, use `papel = 'equipe'`.
3. Publique as funções do servidor e configure o ZapSign: veja [ZAPSIGN.md](ZAPSIGN.md).
4. Copie `.env.example` para `.env` com a URL e a *anon key* do Supabase.
5. Publique o site (Cloudflare Pages, Netlify ou Vercel): build `npm run build`, pasta `dist`, com as
   mesmas variáveis `VITE_SUPABASE_*`.

Segurança e configurações obrigatórias do painel: [SEGURANCA.md](SEGURANCA.md).

## App no celular (iPhone e Android)

O portal funciona como aplicativo instalado (PWA), sem precisar da App Store:
- **iPhone:** abra o portal no Safari > **Compartilhar** > **Adicionar à Tela de Início**. O portal mostra esse passo a passo ao cliente.
- **Android:** o portal mostra o botão **Instalar**.

O app abre em tela cheia, com ícone e tela de abertura da Airam. As telas ficam guardadas para abrir rápido, mas dados e documentos sempre vêm direto do servidor e nunca ficam salvos no aparelho.

## Prazos do contrato usados pelo sistema

Aprovação financeira em até 5 dias úteis · medição e assinatura do projeto final em 10 dias úteis (a partir da
solução financeira, ou do imóvel pronto na entrega futura) · entrega em 45 dias úteis a partir do 2º dia útil após a
assinatura do projeto final · montagem iniciada em até 7 dias úteis após a entrega e concluída em até 10 dias úteis.
O cadastro sugere essas datas (botão "Usar"), descontando fins de semana e feriados nacionais. Feriados municipais
não entram no cálculo.

## Meu perfil (cliente)

O cliente tem as abas **Meu processo** e **Meu perfil**. No perfil ele adiciona a foto (cortada e reduzida no
próprio celular antes do envio), como prefere ser chamado, celular/WhatsApp, outro telefone, data de nascimento,
endereço para correspondência (com busca pelo CEP) e informações do imóvel, além
da preferência de novidades e da troca de senha. E-mail de acesso e CPF ficam só para consulta.
O celular, a data de nascimento e a preferência de novidades atualizam o processo automaticamente (avisos,
aniversários e e-mail marketing). A equipe vê tudo em Processos > Dados e prazos.
