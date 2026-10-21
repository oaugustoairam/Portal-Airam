# Roteiro de teste — aba Comercial

Faça na ordem. Cada passo diz o que clicar e o que deve aparecer. Na demonstração a senha é `airam123`;
no portal real use usuários de verdade (crie em Usuários: um **Captador** e um **Vendedor** com WhatsApp).

## 1. Captador cadastra o lead
1. Entre como **Captador** → Comercial → **Captação / Agendamentos**. Não existe a aba CRM para o captador.
2. **+ Novo lead** → clique **Salvar** vazio: aparecem os avisos em vermelho (nome, telefone, origem, vendedor).
3. Preencha nome, telefone, e-mail, origem, vendedor. Em **Planta** e **Imagens de referência**, adicione arquivos
   (dá para tirar antes de salvar). Em **Conversa**, cole o texto ou escolha **Enviar arquivo**.
4. Marque **Já agendar atendimento** → data, horário, **Na loja** + qual loja (ou **Online**) → **Salvar**.
   Deve aparecer: *"Lead cadastrado e enviado para {vendedor}"*.
5. Na lista: busque pelo telefone; use os filtros de vendedor, dia e status; **Limpar filtros**.
6. Na linha do lead: **Editar** (mude o e-mail), **Reagendar** (mude o horário), **Trocar vendedor** (vai e volta).
   O captador não vê **Excluir**.
7. **Ver** → aba **Briefing** → **IMPRIMIR**: baixa o PDF com o formulário em branco.
8. **Calendário**: clique num dia vazio → abre *Novo agendamento* (cancele). Clique no evento → painel com
   **Abrir cartão do cliente**, **Compareceu**, **Não compareceu**, **Reagendar**, **Cancelar agendamento**.
   Teste Mês / Semana / Dia, ‹ Anterior / Hoje / Próximo › e os filtros.

## 2. Vendedor trabalha o lead
1. Entre como **Vendedor** → **Meu CRM**. Só aparecem os leads dele (o de outro vendedor não aparece nem no banco).
2. Arraste o cartão para **Não responde** (o contador muda). No celular use **Mover para…**.
3. Arraste para **Vendidos** → abre o pedido de valor e data → **Cancelar**: o cartão continua onde estava.
4. Arraste para **Perdidos** → sem motivo não deixa; "Outro" pede descrição → **Cancelar**.
5. **+ Adicionar cliente** (na coluna Novo cliente) cria um lead dele mesmo.
6. Abra o cartão:
   - **Anexos**: Visualizar, Baixar, Remover (pede confirmação), **+ Adicionar**.
   - **Anotações e histórico**: escreva e clique **Adicionar anotação**; o histórico mostra tudo com data e autor.
   - **Lembretes**: **+ Novo lembrete** (data, horário, tipo, descrição) → Editar → Concluir → Excluir.
     Crie um com data de ontem: o cartão no quadro passa a mostrar o sino *atrasado*.
   - **Briefing**: marque *Briefing realizado*, escolha **Ligação** ou **Mensagem** e a data → **Preencher briefing**.
     Em *Já mora?* escolha **Não**: só então aparece *Previsão para morar*. **Salvar briefing** → **Editar** →
     **IMPRIMIR** (PDF A4 de uma página com as respostas e espaço para anotações).
   - **Resumo e agenda**: **Compareceu**.
   - **Mover para… Vendidos** → valor e data → **Confirmar venda**.
   - **Avisos enviados**: cada aviso de WhatsApp e e-mail com Enviado/Falhou e o motivo; **Reenviar** no que falhou.
7. **Meus lembretes**: abas Hoje / Atrasados / Próximos / Concluídos; **+ Novo lembrete para** (busque o cliente).
8. **Métricas de Vendas**: o vendedor aparece travado ("somente os seus números"). Atalho **Ano** → **Aplicar**;
   confira os 7 indicadores e os 15 gráficos (**Ver tabela** em cada um); **Exportar PDF** e **Exportar Excel**;
   **Limpar filtros**.

## 3. Gerente e master
1. **Gerente** → CRM → escolha o vendedor no seletor. Em Captação, **Excluir** pede digitar EXCLUIR.
2. **Master** → Comercial → **Configurações**:
   - **Listas**: adicionar, Editar, Remover (pede confirmação; dá para Reativar) em origens, motivos e colunas.
   - **Lojas**: adicionar, Editar, Remover.
   - **Usuários**: Novo, Editar (nome, papel, WhatsApp), **Desativar usuário** (a pessoa não entra mais) e Reativar.
   - **WhatsApp e e-mail**: cadastre as chaves e use **Enviar teste** nos dois canais.

## O que foi testado antes da entrega (21/10/2026)
Todos os passos acima rodaram automaticamente no navegador (computador e celular), **55 de 55 aprovados**, duas vezes:
na demonstração e no **banco real de produção**, com 5 usuários de teste temporários (captador, 2 vendedores, gerente
e master). Depois os usuários, leads, arquivos, loja e origem de teste foram apagados da produção.
As regras do banco também foram testadas direto no SQL (captador não move nem exclui, vendedor não vê outro
vendedor nem exclui, usuário desativado perde o acesso, fila de avisos não envia duas vezes).

## O que depende de você
- **WhatsApp**: falta a conta da Meta (token permanente + ID do número) e a aprovação dos modelos
  `novo_lead_vendedor` e `lembrete_vendedor` (texto em `AVISOS.md`). Até lá cada aviso fica como
  *Falhou: WhatsApp não configurado* — registrado, com Reenviar.
- **E-mail**: falta a chave da Resend (e o domínio airam.arq.br verificado nela). Até lá: *Falhou: E-mail não configurado*.
- Preencha o **WhatsApp de cada vendedor** em Usuários.

---

# Fase 2 — Etapas 1 a 7 (perfis, briefing novo e ajustes)

Testado em 21/10/2026: **62 de 62 passos aprovados** na demonstração e no banco real de produção (usuários de teste
temporários, apagados no fim junto com os dados).

## Etapa 1 · Perfis e permissões
1. Entre como **Master**: a barra termina em **Configurações** (Usuários, Listas, Lojas, WhatsApp e e-mail).
   A antiga seção "Usuários" e as configurações de dentro do Comercial foram para lá.
2. Em Configurações > Usuários, abra uma pessoa: as permissões novas são **Ferramentas**, **Gestão Mensal** e
   **Gestão Mensal: todos os vendedores**. Para o Captador, o Marketing fica desligado até você ligar.
3. Entre como **Vendedor**: a barra mostra Comercial, Gestão de clientes, Processos e **Marketing**.
   Como **Captador**, só Comercial. (Ferramentas e Gestão Mensal aparecem na barra quando essas etapas ficarem prontas.)

## Etapas 2 e 6 · Captação e avisos
1. Novo lead: a planta aceita **DWG**; a conversa aceita o **.zip** exportado do WhatsApp.
2. A mensagem de aviso termina com o link `…/?lead=…`: ao abrir, o portal entra direto no cartão do cliente
   (depois de fazer login, se precisar).

## Etapa 3 · CRM
1. Arraste para **VENDIDOS**: o modal pede **valor bruto, valor deflacionado, código do pedido e data**.
   Sem o deflacionado ou sem o código, não salva (o banco também recusa). Cancelar deixa o cartão onde estava.
2. No cartão vendido, **Corrigir venda** muda os valores; a correção aparece no histórico (antes → depois).

## Etapa 4 · Calendário
1. Escolha **Cor por vendedor** ou **Cor por loja**; a legenda embaixo dos filtros mostra quem é cada cor.
   ✓ = compareceu, ✗ = não compareceu, riscado = cancelado.

## Etapa 5 · Briefing
1. No cartão > Briefing > **Preencher briefing**: as 9 perguntas novas, todas opcionais.
   "Qual a previsão para morar?" só aparece com *Já mora no local?* = Não; os detalhes da obra só com Sim.
2. **Salvar briefing** → **Editar** → **IMPRIMIR**: uma folha A4; o que não foi respondido sai com linhas em branco,
   e há a área de observações no rodapé.

---

# Fase 2 — Etapas 8 a 12

Testado em 21/10/2026, na demonstração e no banco real de produção (usuários de teste temporários, apagados no fim com
todos os dados): calculadora 13/13, formalização + checklist + salário 33/33 (demonstração) e 25/25 (produção),
criador de conteúdo 6/6 (demonstração) e 12/12 (produção), CRM completo de novo 62/62. No banco local, os 4 casos
obrigatórios do salário deram exatamente R$ 2.000, R$ 4.000, R$ 8.500 e R$ 17.500.

## Etapa 8 · Calculadora de dias úteis (Ferramentas › Dias úteis)
1. Como **Captador**, a aba Ferramentas não aparece.
2. Como **Vendedor**: Data inicial 01/10/2026, final 31/10/2026 → **Calcular**: 21 dias úteis, 31 corridos, 9 de fim de semana,
   1 feriado (12/10). Marque **Sábado é dia útil**: vira 26 na hora.
3. **Somar ou subtrair**: 21/10/2026 + 45 dias úteis → data final e os feriados do caminho. Troque para **Subtrair**.
4. Troque **Feriados municipais de** para Guarulhos: 08/12 aparece como feriado. **Copiar resultado** copia o texto.
5. No calendário do mês: fins de semana, feriados e recessos com cores diferentes; ‹ › e Hoje; "Todos os feriados do ano".
6. Como **Master**: Configurações › **Feriados e recessos** › Adicionar (ex.: Recesso 24/12 a 02/01), Editar, Excluir.
   O recesso passa a contar na calculadora.

## Etapa 9 · Formalização
1. **Meu perfil** (último item da barra): e-mail e senha da caixa da Hostinger → **Salvar e testar**; depois **Testar conexão**.
   Senha errada aparece como "E-mail ou senha incorretos" (testado com a Hostinger de verdade).
2. Ferramentas › **Formalização** › Nova: busque o cliente (só os seus), o **código do pedido** vem do cartão; escolha o tipo.
   - **Venda Normal / Solicitação de Medição**: o checklist de medição; com algum item faltando aparece o aviso e o
     "Solicito medição." não entra no texto; com os 4 marcados, entra com os ✔.
   - **Venda Futura**: pede a previsão do imóvel. **Complemento**: pedido de origem (lista os pedidos vendidos do mesmo cliente ou digite).
   - Anexos obrigatórios do tipo; o total aparece e passa a avisar acima de 18 MB.
   - Para / Cc / Cco: digite e Enter (ou vírgula); sugere os e-mails já usados.
   - Título e texto podem ser editados; "Refazer pelo modelo" volta ao automático.
   - **Enviar e-mail** só liga com tudo preenchido e com a caixa aprovada no teste.
3. **Formalizações enviadas**: Ver (texto, destinatários, anexos para visualizar/baixar), **Reenviar** (pede confirmação) e **Duplicar**.
4. No cartão do cliente: aba **Formalizações** e os anexos em Anexos › Formalizações; o histórico registra o envio.
5. Master › Configurações › **Formalização**: editar título/texto (com prévia), anexos, checklist; **+ Novo tipo**; Desativar/Reativar.

## Etapa 10 · Checklist de venda e Gestão Mensal
1. Ao mover para **Vendidos**: valor bruto, valor deflacionado, código do pedido e data.
2. Cartão › **Checklist de venda**: o vendedor marca contrato, documento, financeiro e pasta; "E-mail de formalização enviado"
   é marcado sozinho pelo envio (gerente e master também podem marcar). O quadro mostra "Checklist 4/5".
3. **Gestão Mensal** (vendedor): escolha o mês das vendas → "Você recebe no dia 10/MM", total deflacionado, faixa, %, comissão,
   fixo, barra até a próxima faixa com simulação, vendas válidas e pendentes (com o que falta). **Exportar demonstrativo (PDF)**.
   O vendedor não vê outros vendedores, nem Pular venda, nem Fechar mês (o banco também bloqueia).
4. **Gerente/Master**: "Todos" mostra a tabela do mês; escolha um vendedor para **Pular venda** (pede motivo; fica no histórico)
   e **Desfazer**; **Fechar mês** só aparece para meses que já terminaram e congela o cálculo; **Exportar Excel**.
5. Master › Configurações › **Régua de comissão**: edite faixas, % e fixos, escolha "Vale a partir de" e salve;
   "Simular total" confere (15.000 → 2.000; 50.000 → 4.000; 120.000 → 8.500; 200.000 → 17.500). Meses fechados não mudam.

## Etapa 11 · Marketing › Criador de conteúdo
1. **Descrever a publicação** (objetivo, tom, tamanho) ou **Enviar uma imagem** (até 4 fotos + contexto) → **Gerar texto**.
2. Resultado: 3 variações com legenda, CTA e hashtags; **Copiar**, **Editar**, **Salvar no histórico**, **Gerar novamente**.
3. Histórico com busca, Copiar e Excluir.
4. Master › Configurações › **Marca (conteúdo)**: tom de voz, palavras a evitar e hashtags padrão.

## Etapa 12 · Configurações do master
Usuários, Listas, Lojas, Feriados e recessos, Formalização, Régua de comissão, Marca (conteúdo) e **Integrações**
(WhatsApp, e-mail de avisos e IA, cada um com **Enviar teste**).

## O que depende de você
- **IA**: cadastre a chave da Anthropic em Configurações › Integrações e clique em **Enviar teste** em "Testar IA".
  Até lá, "Gerar texto" mostra o aviso (em produção a tela foi testada com uma resposta simulada).
- **Formalização**: cada vendedor cadastra a própria caixa da Hostinger em Meu perfil. Sem uma caixa verdadeira eu não pude
  fazer um envio real; a conexão com os servidores da Hostinger foi confirmada (eles responderam "senha incorreta" à senha falsa).
- **Valor deflacionado**: por enquanto digitado à mão no modal de Vendidos; o campo está pronto para a sua função automática.
