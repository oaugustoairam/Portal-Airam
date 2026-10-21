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
