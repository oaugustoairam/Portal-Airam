-- Portal Airam — estrutura do banco (Supabase / Postgres)
-- Execute no Supabase: SQL Editor > New query > cole tudo e rode.
-- Pode rodar de novo depois de mudanças: os comandos são idempotentes.

-- 1. Perfis -----------------------------------------------------------------
-- papel: 'admin' (gerência), 'equipe' (funcionários), 'vendedor' ou 'cliente'
create table if not exists public.perfis (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  nome text,
  papel text not null default 'cliente' check (papel in ('admin', 'equipe', 'cliente')),
  precisa_trocar_senha boolean not null default false,
  criado_em timestamptz not null default now()
);

create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil();

alter table public.perfis drop constraint if exists perfis_papel_check;
alter table public.perfis add constraint perfis_papel_check check (papel in ('admin', 'gerente', 'equipe', 'vendedor', 'captador', 'cliente'));

-- Funcionário = qualquer papel interno. Papéis só mudam pelo SQL Editor ou pelas
-- funções do servidor; o app não consegue alterar.
create or replace function public.eh_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel in ('admin', 'gerente', 'equipe', 'vendedor', 'captador'));
$$;


create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'admin');
$$;

-- E-mail do usuário logado, somente se confirmado.
create or replace function public.meu_email_confirmado()
returns text language sql stable security definer set search_path = public, auth as $$
  select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null;
$$;

-- O próprio usuário marca que já trocou a senha provisória (só isso; não muda o papel).
create or replace function public.senha_trocada()
returns void language sql security definer set search_path = public as $$
  update public.perfis set precisa_trocar_senha = false where id = auth.uid();
$$;
revoke execute on function public.senha_trocada() from anon;

-- 2. Processos (um por venda fechada) ----------------------------------------
create table if not exists public.processos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,                 -- identificação junto com o nome
  cliente_nome text not null,
  cliente_cpf text,                            -- só números
  cliente_email text,                          -- login do cliente (pode ficar para depois)
  cliente_telefone text,
  endereco text,
  ambientes text,                              -- ex.: cozinha, suíte, home office
  data_venda date not null,
  data_disponivel_medicao date,                -- quando o imóvel fica disponível para medir
  -- Regra Airam: até 90 dias entre a venda e a disponibilidade para medição = Normal; acima = Futuro
  -- (calculado pelo gatilho calcular_tipo_prazo; sem a data, vale o que foi informado)
  tipo_prazo text check (tipo_prazo in ('normal', 'futuro')),
  solucao_financeira text not null default 'pendente' check (solucao_financeira in ('ok', 'pendente')),
  data_medicao date,
  medicao_concluida boolean not null default false,
  data_conferencia date,                       -- conferência do projeto final
  conferencia_concluida boolean not null default false,
  data_assinatura_projeto date,                -- assinatura do projeto final
  projeto_assinado_manual boolean not null default false,  -- assinado fora do ZapSign
  data_entrega_prevista date,                  -- prazo máximo do cliente
  entrega_concluida boolean not null default false,
  recado_cliente text,                         -- mensagem que o cliente vê no topo
  criado_em timestamptz not null default now(),
  constraint cpf_numeros check (cliente_cpf is null or cliente_cpf ~ '^[0-9]{11}$')
);
-- (o CPF é único em "clientes"; um cliente pode ter vários contratos — veja a seção 17)
create index if not exists processos_email_idx on public.processos (lower(cliente_email));

-- 3. Documentos ---------------------------------------------------------------
-- 'medicao' é interno: o cliente nunca vê. Arquivos internos ficam em <processo>/interno/
create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos on delete cascade,
  categoria text not null check (categoria in ('medicao', 'contrato', 'projeto_inicial', 'render', 'projeto_final', 'outro')),
  titulo text not null,
  arquivo_path text not null,
  tipo_mime text,
  assinado boolean not null default false,     -- versão assinada vinda do ZapSign
  criado_em timestamptz not null default now(),
  constraint medicao_interna check (categoria <> 'medicao' or arquivo_path like '%/interno/%')
);

-- Arquivos internos do cliente (só a loja vê): medição, projetos Promob vendidos,
-- documentos pessoais e ficha cadastral. Sempre na pasta <processo>/interno/.
create or replace function public.categoria_interna(c text) returns boolean
language sql immutable as $$ select c in ('medicao', 'promob', 'documento_cliente', 'ficha_cadastral') $$;
alter table public.documentos drop constraint if exists documentos_categoria_check;
alter table public.documentos add constraint documentos_categoria_check check (categoria in
  ('medicao', 'contrato', 'projeto_inicial', 'render', 'projeto_final', 'outro', 'promob', 'documento_cliente', 'ficha_cadastral'));
alter table public.documentos drop constraint if exists medicao_interna;
alter table public.documentos drop constraint if exists arquivos_internos;
alter table public.documentos add constraint arquivos_internos
  check (not public.categoria_interna(categoria) or arquivo_path like '%/interno/%');

-- 4. Assinaturas (ZapSign) ---------------------------------------------------
create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos on delete cascade,
  tipo text not null check (tipo in ('contrato', 'projeto_final')),
  documento_id uuid references public.documentos on delete set null,   -- PDF original enviado
  zapsign_doc_token text unique,
  zapsign_signer_token text,
  sign_url text,                               -- link de assinatura do cliente (aberto dentro do portal)
  status text not null default 'pendente' check (status in ('pendente', 'assinado', 'recusado', 'cancelado')),
  assinado_em timestamptz,
  documento_assinado_id uuid references public.documentos on delete set null,
  criado_em timestamptz not null default now()
);

-- 5. Segurança (Row Level Security) ----------------------------------------
alter table public.perfis enable row level security;
alter table public.processos enable row level security;
alter table public.documentos enable row level security;
alter table public.assinaturas enable row level security;

create or replace function public.eh_meu_processo(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.processos
    where id = p and lower(cliente_email) = public.meu_email_confirmado()
  );
$$;

drop policy if exists "perfil proprio" on public.perfis;
create policy "perfil proprio" on public.perfis for select
  using (id = auth.uid() or public.eh_equipe());

drop policy if exists "equipe processos" on public.processos;
create policy "equipe processos" on public.processos for all
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "cliente ve processo" on public.processos;
create policy "cliente ve processo" on public.processos for select
  using (lower(cliente_email) = public.meu_email_confirmado());

drop policy if exists "equipe documentos" on public.documentos;
create policy "equipe documentos" on public.documentos for all
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "cliente ve documentos" on public.documentos;
create policy "cliente ve documentos" on public.documentos for select
  using (not public.categoria_interna(categoria) and public.eh_meu_processo(processo_id));

-- Assinaturas: só o servidor (funções zapsign-*) cria e atualiza; equipe e cliente leem.
drop policy if exists "equipe le assinaturas" on public.assinaturas;
create policy "equipe le assinaturas" on public.assinaturas for select using (public.eh_equipe());
drop policy if exists "equipe cancela assinaturas" on public.assinaturas;
create policy "equipe cancela assinaturas" on public.assinaturas for update
  using (public.eh_equipe()) with check (public.eh_equipe() and status = 'cancelado');
drop policy if exists "cliente le assinaturas" on public.assinaturas;
create policy "cliente le assinaturas" on public.assinaturas for select
  using (public.eh_meu_processo(processo_id));

-- 6. Arquivos (Storage) — bucket privado; caminho: <processo_id>/<arquivo>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 52428800, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'image/vnd.dwg', 'application/acad', 'application/octet-stream',
  'application/zip', 'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "equipe arquivos" on storage.objects;
create policy "equipe arquivos" on storage.objects for all
  using (bucket_id = 'documentos' and public.eh_equipe())
  with check (bucket_id = 'documentos' and public.eh_equipe());
drop policy if exists "cliente le arquivos" on storage.objects;
create policy "cliente le arquivos" on storage.objects for select
  using (
    bucket_id = 'documentos'
    and coalesce((storage.foldername(name))[2], '') <> 'interno'
    and public.eh_meu_processo(
      case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
           then ((storage.foldername(name))[1])::uuid end)
  );

-- 7. Registro de atividades (auditoria) --------------------------------------
create table if not exists public.registro_atividades (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  usuario_id uuid,
  usuario_email text,
  tabela text not null,
  acao text not null,
  registro_id uuid,
  antes jsonb,
  depois jsonb
);
alter table public.registro_atividades enable row level security;
drop policy if exists "admin le registro" on public.registro_atividades;
create policy "admin le registro" on public.registro_atividades for select using (public.eh_admin());

create or replace function public.registrar_atividade()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.registro_atividades (usuario_id, usuario_email, tabela, acao, registro_id, antes, depois)
  values (
    auth.uid(), auth.jwt() ->> 'email', tg_table_name, tg_op,
    case when tg_op = 'DELETE' then old.id else new.id end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['processos', 'documentos', 'assinaturas'] loop
    execute format('drop trigger if exists auditoria on public.%I', t);
    execute format('create trigger auditoria after insert or update or delete on public.%I
      for each row execute function public.registrar_atividade()', t);
  end loop;
end $$;

-- 8. Primeiro acesso da equipe: crie seu usuário em Authentication > Users > Add user
--    (com senha) e depois rode, trocando o e-mail:
-- update public.perfis set papel = 'admin', nome = 'Seu nome' where email = 'voce@airam.arq.br';
-- Para funcionários: papel = 'equipe'.

-- 9. Avisos ao cliente (WhatsApp + e-mail) -----------------------------------
-- Cada mudança de etapa gera uma linha por canal nesta fila. A função do servidor
-- `enviar-notificacoes` envia os pendentes (agendada a cada minuto; veja AVISOS.md).
alter table public.processos add column if not exists notificar boolean not null default true;

-- Telefone só com números (sem o 55), para o cliente entrar no portal pelo telefone
alter table public.processos add column if not exists telefone_numeros text
  generated always as (regexp_replace(regexp_replace(coalesce(cliente_telefone, ''), '\D', '', 'g'), '^55(\d{10,11})$', '\1')) stored;
create index if not exists processos_telefone_idx on public.processos (telefone_numeros);

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos on delete cascade,
  evento text not null,
  canal text not null check (canal in ('email', 'whatsapp')),
  destino text not null,
  titulo text not null,
  mensagem text not null,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'erro', 'ignorado')),
  tentativas int not null default 0,
  erro text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);
create index if not exists notificacoes_fila_idx on public.notificacoes (status, criado_em);
alter table public.notificacoes enable row level security;
drop policy if exists "equipe le avisos" on public.notificacoes;
create policy "equipe le avisos" on public.notificacoes for select using (public.eh_equipe());
-- sem insert/update pelo app: só os gatilhos abaixo e o servidor mexem na fila

-- Telefone brasileiro no formato do WhatsApp: 55 + DDD + número
create or replace function public.telefone_whatsapp(t text)
returns text language sql immutable as $$
  select case
    when length(regexp_replace(coalesce(t, ''), '\D', '', 'g')) in (10, 11)
      then '55' || regexp_replace(t, '\D', '', 'g')
    when regexp_replace(coalesce(t, ''), '\D', '', 'g') ~ '^55[0-9]{10,11}$'
      then regexp_replace(t, '\D', '', 'g')
  end;
$$;

create or replace function public.enfileirar_aviso(p public.processos, ev text, titulo text, msg text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not p.notificar then return; end if;
  if p.cliente_email is not null then
    insert into public.notificacoes (processo_id, evento, canal, destino, titulo, mensagem)
    values (p.id, ev, 'email', lower(p.cliente_email), titulo, msg);
  end if;
  if public.telefone_whatsapp(p.cliente_telefone) is not null then
    insert into public.notificacoes (processo_id, evento, canal, destino, titulo, mensagem)
    values (p.id, ev, 'whatsapp', public.telefone_whatsapp(p.cliente_telefone), titulo, msg);
  end if;
end $$;

-- Mudanças feitas pela equipe no processo
create or replace function public.avisos_processo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dt text;
begin
  if new.solucao_financeira = 'ok' and old.solucao_financeira <> 'ok' then
    perform public.enfileirar_aviso(new, 'financeiro_aprovado', 'Solução financeira aprovada',
      'Sua solução financeira foi aprovada. Seguimos para a próxima etapa do seu processo.');
  end if;
  if new.data_medicao is not null and new.data_medicao is distinct from old.data_medicao and not new.medicao_concluida then
    dt := to_char(new.data_medicao, 'DD/MM/YYYY');
    perform public.enfileirar_aviso(new, 'medicao_agendada', 'Medição agendada',
      'Sua medição está agendada para ' || dt || '. Nossa equipe vai até o local nessa data.');
  end if;
  if new.projeto_inicial_enviado and not old.projeto_inicial_enviado then
    perform public.enfileirar_aviso(new, 'projeto_inicial', 'Seu projeto inicial chegou',
      'Seu projeto inicial está disponível no Portal Airam, na aba Projeto inicial.');
  end if;
  if new.medicao_concluida and not old.medicao_concluida then
    perform public.enfileirar_aviso(new, 'medicao_realizada', 'Medição concluída',
      'A medição dos seus ambientes foi concluída. Agora preparamos o seu projeto final.');
  end if;
  if new.data_conferencia is not null and new.data_conferencia is distinct from old.data_conferencia and not new.conferencia_concluida then
    dt := to_char(new.data_conferencia, 'DD/MM/YYYY');
    perform public.enfileirar_aviso(new, 'conferencia_agendada', 'Conferência do projeto final',
      'A conferência do seu projeto final está marcada para ' || dt || '.');
  end if;
  if new.conferencia_concluida and not old.conferencia_concluida then
    perform public.enfileirar_aviso(new, 'conferencia_realizada', 'Conferência concluída',
      'A conferência do seu projeto final foi concluída. Em breve ele estará pronto para assinatura.');
  end if;
  if new.projeto_assinado_manual and not old.projeto_assinado_manual then
    perform public.enfileirar_aviso(new, 'producao_iniciada', 'Seus móveis entraram em fabricação',
      'Projeto final assinado! Seus móveis entraram em fabricação.');
  end if;
  if new.data_entrega_prevista is distinct from old.data_entrega_prevista and not new.entrega_concluida then
    dt := to_char(new.data_entrega_prevista, 'DD/MM/YYYY');
    perform public.enfileirar_aviso(new, 'entrega_reagendada', 'Prazo máximo para entrega',
      'O prazo máximo para entrega dos seus móveis agora é ' || dt || '.');
  end if;
  if new.entrega_concluida and not old.entrega_concluida then
    perform public.enfileirar_aviso(new, 'entrega_concluida', 'Montagem concluída',
      'Montagem concluída! Obrigado por confiar na Airam. Seus móveis têm 10 anos de garantia.');
  end if;
  return new;
end $$;

drop trigger if exists avisos on public.processos;
create trigger avisos after update on public.processos
  for each row execute function public.avisos_processo();

-- Assinaturas: documento liberado para assinar e documento assinado
create or replace function public.avisos_assinatura()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.processos;
  doc text := case new.tipo when 'contrato' then 'contrato' else 'projeto final' end;
begin
  select * into p from public.processos where id = new.processo_id;
  -- o link do ZapSign acabou de ser criado: o cliente já pode assinar
  if new.status = 'pendente' and new.sign_url is not null and (tg_op = 'INSERT' or old.sign_url is null) then
    perform public.enfileirar_aviso(p, new.tipo || '_disponivel', 'Documento para assinar',
      'Seu ' || doc || ' está pronto para assinatura. Entre no Portal Airam e assine em poucos minutos.');
  end if;
  if new.status = 'assinado' and (tg_op = 'INSERT' or old.status <> 'assinado') then
    if new.tipo = 'contrato' then
      perform public.enfileirar_aviso(p, 'contrato_assinado', 'Contrato assinado',
        'Recebemos seu contrato assinado. Obrigado por escolher a Airam! A cópia assinada está no portal.');
    else
      update public.processos set projeto_assinado_em = coalesce(projeto_assinado_em, now()) where id = new.processo_id;
      if not p.projeto_assinado_manual then
        perform public.enfileirar_aviso(p, 'producao_iniciada', 'Seus móveis entraram em fabricação',
          'Projeto final assinado! Seus móveis entraram em fabricação.');
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists avisos on public.assinaturas;
create trigger avisos after insert or update on public.assinaturas
  for each row execute function public.avisos_assinatura();

-- 10. Cronograma interno e projeto inicial -------------------------------------
-- O contrato é assinado na loja, antes do acesso ao portal; no portal ele só aparece
-- como anexo "Contrato assinado". A jornada do cliente começa na solução financeira.
alter table public.processos add column if not exists projeto_inicial_enviado boolean not null default false;
alter table public.processos add column if not exists data_projeto_inicial date;
-- dia em que cada etapa foi concluída (preenchido sozinho; uso interno da loja)
alter table public.processos add column if not exists financeiro_ok_em timestamptz;
alter table public.processos add column if not exists projeto_inicial_em timestamptz;
alter table public.processos add column if not exists medicao_concluida_em timestamptz;
alter table public.processos add column if not exists conferencia_concluida_em timestamptz;
alter table public.processos add column if not exists projeto_assinado_em timestamptz;
alter table public.processos add column if not exists montagem_concluida_em timestamptz;

create or replace function public.marcar_datas_etapas()
returns trigger language plpgsql as $$
declare
  vazio public.processos;  -- no INSERT, compara com um registro sem nada marcado
  a public.processos := case when tg_op = 'UPDATE' then old else vazio end;
begin
  new.financeiro_ok_em := case when new.solucao_financeira <> 'ok' then null
    when coalesce(a.solucao_financeira, '') <> 'ok' then now() else a.financeiro_ok_em end;
  new.projeto_inicial_em := case when not new.projeto_inicial_enviado then null
    when not coalesce(a.projeto_inicial_enviado, false) then now() else a.projeto_inicial_em end;
  new.medicao_concluida_em := case when not new.medicao_concluida then null
    when not coalesce(a.medicao_concluida, false) then now() else a.medicao_concluida_em end;
  new.conferencia_concluida_em := case when not new.conferencia_concluida then null
    when not coalesce(a.conferencia_concluida, false) then now() else a.conferencia_concluida_em end;
  new.montagem_concluida_em := case when not new.entrega_concluida then null
    when not coalesce(a.entrega_concluida, false) then now() else a.montagem_concluida_em end;
  if new.projeto_assinado_manual and not coalesce(a.projeto_assinado_manual, false) then
    new.projeto_assinado_em := coalesce(a.projeto_assinado_em, now());
  elsif tg_op = 'UPDATE' then
    new.projeto_assinado_em := coalesce(new.projeto_assinado_em, a.projeto_assinado_em);
  end if;
  return new;
end $$;

drop trigger if exists datas_etapas on public.processos;
create trigger datas_etapas before insert or update on public.processos
  for each row execute function public.marcar_datas_etapas();

-- Anexar o PDF do projeto inicial marca a etapa como enviada (e avisa o cliente)
create or replace function public.projeto_inicial_anexado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.categoria = 'projeto_inicial' then
    update public.processos set projeto_inicial_enviado = true
    where id = new.processo_id and not projeto_inicial_enviado;
  end if;
  return new;
end $$;

drop trigger if exists projeto_inicial on public.documentos;
create trigger projeto_inicial after insert on public.documentos
  for each row execute function public.projeto_inicial_anexado();

-- 11. Redefinição de senha pelo próprio cliente (código por SMS ou e-mail) --------
-- Só as funções do servidor (recuperar-senha / redefinir-senha) leem e gravam aqui.
create table if not exists public.codigos_verificacao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  canal text not null check (canal in ('email', 'sms')),
  codigo_hash text not null,              -- o código em si nunca é guardado
  expira_em timestamptz not null,
  tentativas int not null default 0,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists codigos_usuario_idx on public.codigos_verificacao (user_id, criado_em desc);
alter table public.codigos_verificacao enable row level security;
-- sem políticas: ninguém acessa pelo app

-- 12. Aniversários e e-mail marketing -----------------------------------------
alter table public.processos add column if not exists cliente_nascimento date;
-- LGPD: o cliente pode sair da lista de novidades (os avisos do processo continuam)
alter table public.processos add column if not exists aceita_marketing boolean not null default true;

create table if not exists public.campanhas (
  id uuid primary key default gen_random_uuid(),
  assunto text not null,
  titulo text not null,
  conteudo text not null,                 -- texto simples; {{nome}} vira o primeiro nome do cliente
  imagem_url text,
  botao_texto text,
  botao_link text,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviando', 'enviada')),
  total int not null default 0,
  enviados int not null default 0,
  falhas int not null default 0,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  enviada_em timestamptz
);

create table if not exists public.campanha_envios (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas on delete cascade,
  email text not null,
  nome text,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'erro')),
  erro text,
  enviado_em timestamptz,
  unique (campanha_id, email)
);

alter table public.campanhas enable row level security;
alter table public.campanha_envios enable row level security;
drop policy if exists "equipe campanhas" on public.campanhas;
create policy "equipe campanhas" on public.campanhas for select using (public.eh_equipe());
drop policy if exists "equipe cria campanhas" on public.campanhas;
create policy "equipe cria campanhas" on public.campanhas for insert with check (public.eh_equipe() and status = 'rascunho');
drop policy if exists "equipe edita rascunho" on public.campanhas;
create policy "equipe edita rascunho" on public.campanhas for update
  using (public.eh_equipe() and status = 'rascunho') with check (public.eh_equipe() and status = 'rascunho');
drop policy if exists "equipe apaga rascunho" on public.campanhas;
create policy "equipe apaga rascunho" on public.campanhas for delete using (public.eh_equipe() and status = 'rascunho');
drop policy if exists "equipe le envios" on public.campanha_envios;
create policy "equipe le envios" on public.campanha_envios for select using (public.eh_equipe());
-- envios só pelo servidor (função enviar-campanha)

-- 13. Número do contrato (o mesmo do contrato impresso, ex.: 100000503-1)
alter table public.processos add column if not exists numero_contrato text;

-- 14. Perfil do cliente (preenchido pelo próprio cliente no portal) -----------
create table if not exists public.perfil_cliente (
  id uuid primary key references auth.users on delete cascade,
  nome_preferido text,
  telefone text,
  telefone_2 text,
  nascimento date,
  cep text, endereco text, numero text, complemento text, bairro text, cidade text, uf text,
  melhor_horario text,
  observacoes text,                       -- portaria, elevador, vaga, animais etc.
  receber_novidades boolean not null default true,
  foto_path text,
  atualizado_em timestamptz not null default now(),
  constraint cep_numeros check (cep is null or cep ~ '^[0-9]{8}$'),
  constraint textos_curtos check (coalesce(length(observacoes), 0) <= 1000 and coalesce(length(nome_preferido), 0) <= 80)
);
alter table public.perfil_cliente enable row level security;
drop policy if exists "cliente le perfil" on public.perfil_cliente;
create policy "cliente le perfil" on public.perfil_cliente for select using (id = auth.uid() or public.eh_equipe());
drop policy if exists "cliente cria perfil" on public.perfil_cliente;
create policy "cliente cria perfil" on public.perfil_cliente for insert with check (id = auth.uid());
drop policy if exists "cliente edita perfil" on public.perfil_cliente;
create policy "cliente edita perfil" on public.perfil_cliente for update using (id = auth.uid()) with check (id = auth.uid());

-- O que o cliente atualiza vai para os processos dele (avisos, aniversários, novidades)
create or replace function public.sincronizar_perfil_cliente()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  email_cliente text;
begin
  new.atualizado_em := now();
  select lower(email) into email_cliente from auth.users where id = new.id and email_confirmed_at is not null;
  if email_cliente is not null then
    update public.processos set
      cliente_telefone = coalesce(nullif(new.telefone, ''), cliente_telefone),
      cliente_nascimento = coalesce(new.nascimento, cliente_nascimento),
      aceita_marketing = new.receber_novidades
    where lower(cliente_email) = email_cliente;
  end if;
  return new;
end $$;

-- Nome e sobrenome separados, Instagram e endereço de entrega dos móveis (endereco/numero/…)
alter table public.perfil_cliente add column if not exists sobrenome text;
alter table public.perfil_cliente add column if not exists instagram text;
alter table public.perfil_cliente drop constraint if exists perfil_textos_extras;
alter table public.perfil_cliente add constraint perfil_textos_extras
  check (coalesce(length(sobrenome), 0) <= 120 and coalesce(length(instagram), 0) <= 60);

drop trigger if exists sincronizar on public.perfil_cliente;
create trigger sincronizar before insert or update on public.perfil_cliente
  for each row execute function public.sincronizar_perfil_cliente();

-- Fotos de perfil: bucket privado, até 2 MB, só imagens; caminho <user_id>/foto.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar proprio" on storage.objects;
create policy "avatar proprio" on storage.objects for all
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "equipe ve avatares" on storage.objects;
create policy "equipe ve avatares" on storage.objects for select
  using (bucket_id = 'avatares' and public.eh_equipe());

-- 15. Controle interno da loja (o cliente não tem acesso) -----------------------
-- Uma linha por processo (id = id do processo). Datas reais de cada passo, liberador,
-- montador, ATT, vistoria e assistência.
create table if not exists public.controle_interno (
  id uuid primary key references public.processos on delete cascade,
  pendencia_resolvida_em date,
  email_enviado_em date,
  inicial_assinado_em date,
  medido_em date,
  liberador text,
  liberador_recebeu_em date,
  conferido_em date,
  conferencia_enviada_em date,
  pdf_recebido_em date,
  projeto_final_assinado_em date,
  entregue_em date,
  montagem_inicio_em date,
  montador text,
  tem_att boolean,
  vistoria_em date,
  assistencia_retorno_max date,
  observacoes text,
  atualizado_em timestamptz not null default now(),
  atualizado_por text,
  constraint controle_textos check (coalesce(length(observacoes), 0) <= 2000
    and coalesce(length(liberador), 0) <= 120 and coalesce(length(montador), 0) <= 120)
);
alter table public.controle_interno enable row level security;
drop policy if exists "equipe controle" on public.controle_interno;
create policy "equipe controle" on public.controle_interno for all
  using (public.eh_equipe()) with check (public.eh_equipe());

alter table public.controle_interno add column if not exists assistencia_concluida_em date;

create or replace function public.carimbar_controle()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.jwt() ->> 'email';
  return new;
end $$;
drop trigger if exists carimbar on public.controle_interno;
create trigger carimbar before insert or update on public.controle_interno
  for each row execute function public.carimbar_controle();
drop trigger if exists auditoria on public.controle_interno;
create trigger auditoria after insert or update or delete on public.controle_interno
  for each row execute function public.registrar_atividade();

-- 16. Sistema único: gestão de clientes, papéis, permissões e acesso por vendedor ---
-- O cadastro da gestão de clientes É o processo do portal (mesmo registro).
-- Dados comerciais (financeira, valores, situação) ficam em "comercial", que o cliente não lê.
drop table if exists public.venda_documentos;
drop table if exists public.vendas;

alter table public.perfis add column if not exists permissoes jsonb not null default '{}'::jsonb;

-- Permissões do master (admin). Chaves: gestao, processos, marketing, ver_todos, excluir.
-- Admin tem tudo; nos outros vale o que o master marcou ou o padrão do papel.
create or replace function public.tem_permissao(chave text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when papel = 'admin' then true
      when permissoes ? chave then (permissoes ->> chave)::boolean
      when papel = 'equipe' then chave in ('processos', 'marketing', 'ver_todos')
      when papel = 'vendedor' then chave in ('gestao', 'processos')
      else false end
    from public.perfis where id = auth.uid()), false);
$$;

-- Vê todos os clientes (admin, equipe e quem o master liberou). Vendedor vê só os dele.
create or replace function public.ve_todos()
returns boolean language sql stable security definer set search_path = public as $$
  select public.eh_equipe() and public.tem_permissao('ver_todos');
$$;

alter table public.processos add column if not exists vendedor_id uuid references public.perfis (id) on delete set null;
alter table public.processos add column if not exists cidade text;
alter table public.processos add column if not exists bairro text;
alter table public.processos add column if not exists cep text;
alter table public.processos alter column cliente_email drop not null;
alter table public.processos alter column data_disponivel_medicao drop not null;
alter table public.processos alter column data_entrega_prevista drop not null;
create index if not exists processos_vendedor_idx on public.processos (vendedor_id);

-- tipo_prazo deixa de ser coluna calculada: a venda futura pode ser informada sem a data do imóvel
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'processos'
             and column_name = 'tipo_prazo' and is_generated = 'ALWAYS') then
    alter table public.processos drop column tipo_prazo;
  end if;
end $$;
alter table public.processos add column if not exists tipo_prazo text check (tipo_prazo in ('normal', 'futuro'));
create or replace function public.calcular_tipo_prazo()
returns trigger language plpgsql as $$
begin
  if new.data_disponivel_medicao is not null and new.data_venda is not null then
    new.tipo_prazo := case when new.data_disponivel_medicao - new.data_venda <= 90 then 'normal' else 'futuro' end;
  elsif new.tipo_prazo is null then
    new.tipo_prazo := 'normal';
  end if;
  return new;
end $$;
drop trigger if exists tipo_prazo on public.processos;
create trigger tipo_prazo before insert or update on public.processos
  for each row execute function public.calcular_tipo_prazo();

-- Pode cuidar deste processo: quem vê todos, ou o vendedor dono da venda
create or replace function public.pode_gerir(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ve_todos()
    or exists (select 1 from public.processos where id = pid and vendedor_id = auth.uid() and public.eh_equipe());
$$;

-- Dados comerciais da venda (internos)
create table if not exists public.comercial (
  id uuid primary key references public.processos on delete cascade,
  vendedor_nome text,                          -- nome do vendedor (também para vendas importadas)
  captacao text,
  loja text check (loja in ('guarulhos', 'mooca')),
  financeira text check (financeira in ('avista', 'dubai', 'airam', 'santander', 'financeira_santander', 'cartao', 'casa', 'flex', 'losango')),
  forma_pagamento text,
  valor_venda numeric(12, 2),
  valor_deflacionado numeric(12, 2),
  valor_entrada numeric(12, 2),
  valor_parcela numeric(12, 2),
  vencimento_primeira date,
  meios text[] not null default '{}',
  situacao text not null default 'pendente' check (situacao in ('pendente', 'resolvido', 'cancelado')),
  observacao text,
  cliente_meu boolean,
  envio_email date,
  assinatura_inicial date,
  avaliacao_google boolean,
  bruto_promob numeric(12, 2),
  pedido_fabrica text,
  pasta_fechada_em timestamptz,
  atualizado_em timestamptz not null default now(),
  constraint comercial_textos check (coalesce(length(observacao), 0) <= 2000)
);
alter table public.comercial enable row level security;

-- Pasta do cliente (comprovantes, financeira aprovada, contrato...): <processo>/pasta/
create table if not exists public.pasta_documentos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos on delete cascade,
  categoria text not null check (categoria in ('comprovante_pix', 'financeira_aprovada', 'projeto_inicial', 'contrato_assinado', 'documento_foto')),
  titulo text not null,
  arquivo_path text not null check (arquivo_path like '%/pasta/%'),
  tipo_mime text,
  criado_em timestamptz not null default now()
);
alter table public.pasta_documentos enable row level security;

-- Controle interno: campos que a planilha de gestão usa
alter table public.controle_interno add column if not exists entregue boolean;
alter table public.controle_interno add column if not exists previsao_entrega date;
alter table public.controle_interno add column if not exists vistoria_obs text;
alter table public.controle_interno add column if not exists pos_vistoria text;
alter table public.controle_interno drop constraint if exists controle_pos_vistoria;
alter table public.controle_interno add constraint controle_pos_vistoria
  check (pos_vistoria is null or pos_vistoria in ('aguardando', 'em_andamento', 'concluido'));

-- Políticas: cada um vê o que pode cuidar
drop policy if exists "perfil proprio" on public.perfis;
create policy "perfil proprio" on public.perfis for select
  using (id = auth.uid() or public.ve_todos() or (public.eh_equipe() and papel <> 'cliente'));

drop policy if exists "equipe processos" on public.processos;
drop policy if exists "equipe ve processos" on public.processos;
drop policy if exists "equipe cria processos" on public.processos;
drop policy if exists "equipe edita processos" on public.processos;
drop policy if exists "equipe apaga processos" on public.processos;
create policy "equipe ve processos" on public.processos for select
  using (public.ve_todos() or (public.eh_equipe() and vendedor_id = auth.uid()));
create policy "equipe cria processos" on public.processos for insert
  with check (public.eh_equipe() and (public.ve_todos() or vendedor_id = auth.uid()));
create policy "equipe edita processos" on public.processos for update
  using (public.ve_todos() or (public.eh_equipe() and vendedor_id = auth.uid()))
  with check (public.ve_todos() or (public.eh_equipe() and vendedor_id = auth.uid()));
create policy "equipe apaga processos" on public.processos for delete
  using ((public.ve_todos() or (public.eh_equipe() and vendedor_id = auth.uid())) and public.tem_permissao('excluir'));

drop policy if exists "equipe documentos" on public.documentos;
create policy "equipe documentos" on public.documentos for all
  using (public.pode_gerir(processo_id)) with check (public.pode_gerir(processo_id));
drop policy if exists "equipe le assinaturas" on public.assinaturas;
create policy "equipe le assinaturas" on public.assinaturas for select using (public.pode_gerir(processo_id));
drop policy if exists "equipe cancela assinaturas" on public.assinaturas;
create policy "equipe cancela assinaturas" on public.assinaturas for update
  using (public.pode_gerir(processo_id)) with check (public.pode_gerir(processo_id) and status = 'cancelado');
drop policy if exists "equipe le avisos" on public.notificacoes;
create policy "equipe le avisos" on public.notificacoes for select using (public.pode_gerir(processo_id));
drop policy if exists "equipe controle" on public.controle_interno;
create policy "equipe controle" on public.controle_interno for all
  using (public.pode_gerir(id)) with check (public.pode_gerir(id));
drop policy if exists "gestao comercial" on public.comercial;
create policy "gestao comercial" on public.comercial for all
  using (public.pode_gerir(id) and public.tem_permissao('gestao'))
  with check (public.pode_gerir(id) and public.tem_permissao('gestao'));
drop policy if exists "gestao pasta" on public.pasta_documentos;
create policy "gestao pasta" on public.pasta_documentos for all
  using (public.pode_gerir(processo_id) and public.tem_permissao('gestao'))
  with check (public.pode_gerir(processo_id) and public.tem_permissao('gestao'));

drop policy if exists "cliente le perfil" on public.perfil_cliente;
create policy "cliente le perfil" on public.perfil_cliente for select using (
  id = auth.uid() or public.ve_todos()
  or exists (select 1 from public.perfis pf join public.processos pr on lower(pr.cliente_email) = lower(pf.email)
             where pf.id = perfil_cliente.id and pr.vendedor_id = auth.uid() and public.eh_equipe()));

drop policy if exists "equipe campanhas" on public.campanhas;
create policy "equipe campanhas" on public.campanhas for select using (public.eh_equipe() and public.tem_permissao('marketing'));
drop policy if exists "equipe cria campanhas" on public.campanhas;
create policy "equipe cria campanhas" on public.campanhas for insert
  with check (public.eh_equipe() and public.tem_permissao('marketing') and status = 'rascunho');
drop policy if exists "equipe edita rascunho" on public.campanhas;
create policy "equipe edita rascunho" on public.campanhas for update
  using (public.eh_equipe() and public.tem_permissao('marketing') and status = 'rascunho')
  with check (public.eh_equipe() and public.tem_permissao('marketing') and status = 'rascunho');
drop policy if exists "equipe apaga rascunho" on public.campanhas;
create policy "equipe apaga rascunho" on public.campanhas for delete
  using (public.eh_equipe() and public.tem_permissao('marketing') and status = 'rascunho');
drop policy if exists "equipe le envios" on public.campanha_envios;
create policy "equipe le envios" on public.campanha_envios for select using (public.eh_equipe() and public.tem_permissao('marketing'));

-- Arquivos: pasta do processo para quem pode cuidar dele; a subpasta "pasta" só com gestão;
-- o cliente nunca lê "interno" nem "pasta"
drop policy if exists "vendas arquivos" on storage.objects;
drop policy if exists "equipe arquivos" on storage.objects;
create policy "equipe arquivos" on storage.objects for all
  using (bucket_id = 'documentos'
    and public.pode_gerir(case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' then ((storage.foldername(name))[1])::uuid end)
    and (coalesce((storage.foldername(name))[2], '') <> 'pasta' or public.tem_permissao('gestao')))
  with check (bucket_id = 'documentos'
    and public.pode_gerir(case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' then ((storage.foldername(name))[1])::uuid end)
    and (coalesce((storage.foldername(name))[2], '') <> 'pasta' or public.tem_permissao('gestao')));
drop policy if exists "cliente le arquivos" on storage.objects;
create policy "cliente le arquivos" on storage.objects for select
  using (
    bucket_id = 'documentos'
    and coalesce((storage.foldername(name))[2], '') not in ('interno', 'pasta')
    and public.eh_meu_processo(
      case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
           then ((storage.foldername(name))[1])::uuid end)
  );

-- O master (admin) define papel e permissões dos usuários internos
create or replace function public.definir_acesso(usuario uuid, novo_papel text, novas_permissoes jsonb, novo_nome text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Somente o master pode mudar acessos.'; end if;
  if novo_papel not in ('admin', 'equipe', 'vendedor') then raise exception 'Papel inválido.'; end if;
  if usuario = auth.uid() and novo_papel <> 'admin' then raise exception 'Você não pode tirar o seu próprio acesso de master.'; end if;
  if exists (select 1 from public.perfis where id = usuario and papel = 'cliente') then
    raise exception 'Este usuário é um cliente do portal.';
  end if;
  update public.perfis set papel = novo_papel, permissoes = coalesce(novas_permissoes, '{}'::jsonb),
    nome = coalesce(nullif(novo_nome, ''), nome)
  where id = usuario;
end $$;
revoke execute on function public.definir_acesso(uuid, text, jsonb, text) from anon;

-- O cliente só muda foto, celular, Instagram e preferência de novidades.
-- Nome, nascimento e endereço são cadastrados pela loja.
create or replace function public.travar_perfil_cliente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.eh_equipe() then return new; end if;
  if tg_op = 'INSERT' then
    new.nome_preferido := null; new.sobrenome := null; new.nascimento := null; new.cep := null; new.endereco := null;
    new.numero := null; new.complemento := null; new.bairro := null; new.cidade := null; new.uf := null; new.observacoes := null;
  else
    new.nome_preferido := old.nome_preferido; new.sobrenome := old.sobrenome; new.nascimento := old.nascimento;
    new.cep := old.cep; new.endereco := old.endereco; new.numero := old.numero; new.complemento := old.complemento;
    new.bairro := old.bairro; new.cidade := old.cidade; new.uf := old.uf; new.observacoes := old.observacoes;
  end if;
  return new;
end $$;
-- "a_travar" roda antes do gatilho "sincronizar" (ordem alfabética)
drop trigger if exists travar on public.perfil_cliente;
drop trigger if exists a_travar on public.perfil_cliente;
create trigger a_travar before insert or update on public.perfil_cliente
  for each row execute function public.travar_perfil_cliente();

-- Troca de e-mail confirmada: o login novo continua ligado aos processos do cliente
create or replace function public.email_trocado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) is distinct from lower(old.email) then
    update public.perfis set email = new.email where id = new.id;
    update public.processos set cliente_email = lower(new.email) where lower(cliente_email) = lower(old.email);
  end if;
  return new;
end $$;
drop trigger if exists ao_trocar_email on auth.users;
create trigger ao_trocar_email after update of email on auth.users
  for each row execute function public.email_trocado();

create or replace function public.carimbar_comercial()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists carimbar on public.comercial;
create trigger carimbar before update on public.comercial for each row execute function public.carimbar_comercial();
drop trigger if exists auditoria on public.comercial;
create trigger auditoria after insert or update or delete on public.comercial for each row execute function public.registrar_atividade();
drop trigger if exists auditoria on public.pasta_documentos;
create trigger auditoria after insert or update or delete on public.pasta_documentos for each row execute function public.registrar_atividade();

-- Contrato feito pelo portal (dados do cliente, ambientes e pagamento); só a gestão vê
alter table public.comercial add column if not exists contrato jsonb;

-- =============================================================================
-- 17. Etapa 2: cadastro único de clientes, numeração automática de contratos,
--     ambientes (com XML do Promob) e lojas/canais. Migração segura: nada é apagado.
-- =============================================================================

-- Lojas e canais de origem (novas lojas entram aqui, sem mudar código)
create table if not exists public.lojas (
  id text primary key check (id ~ '^[a-z0-9_]{2,30}$'),
  nome text not null,
  ativa boolean not null default true,
  ordem int not null default 0
);
insert into public.lojas (id, nome, ordem) values
  ('guarulhos', 'Loja Guarulhos', 1), ('mooca', 'Loja Mooca', 2), ('online', 'Online', 3)
on conflict (id) do nothing;
alter table public.lojas enable row level security;
drop policy if exists "equipe le lojas" on public.lojas;
create policy "equipe le lojas" on public.lojas for select using (public.eh_equipe());
drop policy if exists "master lojas" on public.lojas;
create policy "master lojas" on public.lojas for all using (public.eh_admin()) with check (public.eh_admin());

alter table public.comercial drop constraint if exists comercial_loja_check;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'comercial_loja_fk') then
    alter table public.comercial add constraint comercial_loja_fk foreign key (loja) references public.lojas (id);
  end if;
end $$;

-- Data e hora do envio do e-mail de formalização (antes era só a data)
do $$ begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'comercial' and column_name = 'envio_email') = 'date' then
    alter table public.comercial alter column envio_email type timestamptz using (envio_email::timestamp at time zone 'America/Sao_Paulo');
  end if;
end $$;

-- CPF válido (mesma regra do app)
create or replace function public.cpf_valido(c text)
returns boolean language plpgsql immutable as $$
declare d int[]; s int; r int; i int;
begin
  if c is null or c !~ '^[0-9]{11}$' or c ~ '^(.)\1{10}$' then return false; end if;
  d := array(select substr(c, g, 1)::int from generate_series(1, 11) g);
  s := 0; for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  r := (s * 10) % 11 % 10; if r <> d[10] then return false; end if;
  s := 0; for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
  r := (s * 10) % 11 % 10; return r = d[11];
end $$;

-- Clientes: uma pessoa (ou empresa), com quantos contratos precisar
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 3 and 200),
  cpf text check (cpf is null or cpf ~ '^[0-9]{11}$' or cpf ~ '^[0-9]{14}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefone text,
  telefone2 text,
  rg text,
  mae text,
  nascimento date,
  sexo text check (sexo is null or sexo in ('F', 'M')),
  profissao text,
  cep text, logradouro text, numero text, complemento text, bairro text, cidade text, uf text,
  criado_por uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists clientes_cpf_idx on public.clientes (cpf) where cpf is not null;
create index if not exists clientes_email_idx on public.clientes (lower(email));
alter table public.clientes enable row level security;

alter table public.processos add column if not exists cliente_id uuid references public.clientes (id) on delete restrict;
create index if not exists processos_cliente_idx on public.processos (cliente_id);
-- um cliente pode ter vários contratos: o CPF deixa de ser único no contrato (continua único em "clientes")
drop index if exists public.processos_cpf_idx;
create index if not exists processos_cpf_busca_idx on public.processos (cliente_cpf);
-- chave de criação: o mesmo envio repetido (clique duplo, recarregar) nunca cria dois contratos
alter table public.processos add column if not exists chave_criacao uuid;
create unique index if not exists processos_chave_criacao_idx on public.processos (chave_criacao) where chave_criacao is not null;

-- Pode ver/editar o cliente: quem vê todos, quem cadastrou, ou o vendedor de um contrato dele
create or replace function public.pode_ver_cliente(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.eh_equipe() and (
    public.ve_todos()
    or exists (select 1 from public.clientes where id = cid and criado_por = auth.uid())
    or exists (select 1 from public.processos where cliente_id = cid and vendedor_id = auth.uid()));
$$;
drop policy if exists "equipe clientes" on public.clientes;
create policy "equipe clientes" on public.clientes for select using (public.pode_ver_cliente(id));
drop policy if exists "gestao edita clientes" on public.clientes;
create policy "gestao edita clientes" on public.clientes for update
  using (public.pode_ver_cliente(id) and public.tem_permissao('gestao'))
  with check (public.pode_ver_cliente(id) and public.tem_permissao('gestao'));
drop policy if exists "master apaga clientes" on public.clientes;
create policy "master apaga clientes" on public.clientes for delete using (public.eh_admin());
-- (a criação passa pela função criar_contrato, que valida tudo no servidor)

-- Clientes que já existem nos contratos antigos: um cadastro por CPF (ou por contrato, sem CPF)
do $$
declare p record; cid uuid;
begin
  for p in select * from public.processos where cliente_id is null order by criado_em loop
    cid := null;
    if p.cliente_cpf is not null then select id into cid from public.clientes where cpf = p.cliente_cpf; end if;
    if cid is null then
      insert into public.clientes (nome, cpf, email, telefone, nascimento, cep, logradouro, bairro, cidade, criado_por)
      values (p.cliente_nome, p.cliente_cpf, nullif(lower(p.cliente_email), ''), p.cliente_telefone, p.cliente_nascimento,
              p.cep, p.endereco, p.bairro, p.cidade, p.vendedor_id)
      returning id into cid;
    end if;
    update public.processos set cliente_id = cid where id = p.id;
  end loop;
end $$;

-- Dados do cliente mudam em um lugar só e chegam em todos os contratos dele (portal, pastas, resultados)
create or replace function public.sincronizar_cliente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.atualizado_em := now();
  update public.processos set
    cliente_nome = new.nome,
    cliente_cpf = case when new.cpf ~ '^[0-9]{11}$' then new.cpf end,
    cliente_email = coalesce(lower(new.email), cliente_email),
    cliente_telefone = coalesce(new.telefone, cliente_telefone),
    cliente_nascimento = coalesce(new.nascimento, cliente_nascimento)
  where cliente_id = new.id;
  return new;
end $$;
drop trigger if exists sincronizar on public.clientes;
create trigger sincronizar before update on public.clientes
  for each row execute function public.sincronizar_cliente();
drop trigger if exists auditoria on public.clientes;
create trigger auditoria after insert or update or delete on public.clientes
  for each row execute function public.registrar_atividade();

-- Numeração automática: o número do contrato é o código (um identificador só).
-- Sequência do banco: nunca repete, nem com dois vendedores salvando ao mesmo tempo,
-- e números de contratos apagados não voltam.
-- começa depois do maior número da planilha de gestão (100002125); o master pode avançar
create sequence if not exists public.contrato_numero_seq start 100002126 minvalue 1;
create or replace function public.numerar_contrato()
returns trigger language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if tg_op = 'INSERT' then
    if new.codigo is null or trim(new.codigo) = '' then
      loop
        n := nextval('public.contrato_numero_seq');
        exit when not exists (select 1 from public.processos where codigo = n::text);
      end loop;
      new.codigo := n::text;
    end if;
  elsif new.codigo is distinct from old.codigo and auth.uid() is not null then
    raise exception 'O número do contrato não pode ser alterado.' using errcode = 'P0001';
  end if;
  new.numero_contrato := new.codigo;
  return new;
end $$;
drop trigger if exists numerar on public.processos;
create trigger numerar before insert or update on public.processos
  for each row execute function public.numerar_contrato();

-- Próximo número (o master define o início uma vez; só pode avançar)
create or replace function public.numeracao_contratos()
returns jsonb language plpgsql security definer set search_path = public as $$
declare ultimo bigint; chamado boolean;
begin
  if not public.eh_equipe() then raise exception 'Sem acesso.'; end if;
  select last_value, is_called into ultimo, chamado from public.contrato_numero_seq;
  return jsonb_build_object('proximo', case when chamado then ultimo + 1 else ultimo end);
end $$;
create or replace function public.definir_numeracao(proximo bigint)
returns void language plpgsql security definer set search_path = public as $$
declare atual bigint; maior bigint;
begin
  if not public.eh_admin() then raise exception 'Somente o master define a numeração.'; end if;
  atual := (public.numeracao_contratos() ->> 'proximo')::bigint;
  select coalesce(max(codigo::bigint), 0) into maior from public.processos where codigo ~ '^[0-9]{1,15}$';
  if proximo < atual or proximo <= maior then
    raise exception 'A numeração só pode avançar: o próximo número precisa ser maior que % e que %.', atual - 1, maior;
  end if;
  perform setval('public.contrato_numero_seq', proximo, false);
end $$;

-- Ambientes do contrato (valor bruto separado do valor no contrato; XML do Promob em <contrato>/interno/promob/)
create table if not exists public.ambientes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos on delete cascade,
  ordem int not null default 0,
  nome text not null check (length(trim(nome)) between 2 and 120),
  linha text, tipo text, fornecedor text default 'AIRAM',
  corpo text, porta text, complemento text, puxador text, modelo text, observacoes text,
  qtd numeric(10, 2) not null default 1 check (qtd > 0),
  prazo int not null default 45 check (prazo between 0 and 720),
  valor_bruto numeric(12, 2) not null check (valor_bruto >= 0),
  valor numeric(12, 2) check (valor >= 0),
  xml_path text check (xml_path is null or xml_path like '%/interno/promob/%'),
  xml_nome text,
  xml_enviado_em timestamptz,
  pecas jsonb,
  pecas_erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists ambientes_processo_idx on public.ambientes (processo_id, ordem);
alter table public.ambientes enable row level security;
drop policy if exists "equipe le ambientes" on public.ambientes;
create policy "equipe le ambientes" on public.ambientes for select using (public.pode_gerir(processo_id));
drop policy if exists "gestao ambientes" on public.ambientes;
create policy "gestao ambientes" on public.ambientes for all
  using (public.pode_gerir(processo_id) and public.tem_permissao('gestao'))
  with check (public.pode_gerir(processo_id) and public.tem_permissao('gestao'));
create or replace function public.carimbar_ambiente()
returns trigger language plpgsql as $$ begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists carimbar on public.ambientes;
create trigger carimbar before update on public.ambientes for each row execute function public.carimbar_ambiente();
drop trigger if exists auditoria on public.ambientes;
create trigger auditoria after insert or update or delete on public.ambientes
  for each row execute function public.registrar_atividade();

-- Procura cliente já cadastrado (CPF, e-mail ou telefone) antes de criar outro.
-- Mostra só o nome e de quem é, para não duplicar; os dados completos seguem a regra normal de acesso.
create or replace function public.procurar_cliente(cpf_ text, email_ text, telefone_ text)
returns table (id uuid, nome text, motivo text, posso_ver boolean, contratos int)
language plpgsql stable security definer set search_path = public as $$
declare tel text := regexp_replace(coalesce(telefone_, ''), '\D', '', 'g');
begin
  if not (public.eh_equipe() and public.tem_permissao('gestao')) then raise exception 'Sem acesso.'; end if;
  return query
    select c.id, c.nome,
      case when c.cpf = cpf_ then 'cpf' when lower(c.email) = lower(email_) then 'email' else 'telefone' end,
      public.pode_ver_cliente(c.id),
      (select count(*)::int from public.processos p where p.cliente_id = c.id)
    from public.clientes c
    where (cpf_ is not null and c.cpf = cpf_)
       or (coalesce(email_, '') <> '' and lower(c.email) = lower(email_))
       or (length(tel) >= 10 and regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') = tel)
    limit 5;
end $$;

-- Cria (ou atualiza) o cliente e cria o contrato com ambientes, tudo de uma vez e validado no servidor.
-- dados: { chave, cliente_id?, cliente{...}, contrato{...}, comercial{...}, ambientes[...] }
create or replace function public.criar_contrato(dados jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  eu uuid := auth.uid();
  c jsonb := dados -> 'cliente';
  k jsonb := coalesce(dados -> 'contrato', '{}'::jsonb);
  com jsonb := coalesce(dados -> 'comercial', '{}'::jsonb);
  chave uuid := nullif(dados ->> 'chave', '')::uuid;
  cid uuid := nullif(dados ->> 'cliente_id', '')::uuid;
  pid uuid; num text; vendedor uuid; vnome text; doc text; a jsonb; i int := 0; total numeric := 0;
  loja_ text := k ->> 'loja';
begin
  if eu is null or not public.eh_equipe() or not public.tem_permissao('gestao') then
    raise exception 'Você não tem permissão para criar contratos.';
  end if;
  if chave is null then raise exception 'Envio inválido (sem chave de criação).'; end if;
  -- mesmo envio repetido: devolve o contrato já criado
  select id, codigo into pid, num from public.processos where chave_criacao = chave;
  if pid is not null then return jsonb_build_object('id', pid, 'codigo', num, 'repetido', true); end if;

  -- validações do cliente
  doc := regexp_replace(coalesce(c ->> 'cpf', ''), '\D', '', 'g');
  if length(trim(coalesce(c ->> 'nome', ''))) < 5 or position(' ' in trim(c ->> 'nome')) = 0 then raise exception 'Informe o nome completo do cliente.'; end if;
  if not (public.cpf_valido(doc) or length(doc) = 14) then raise exception 'CPF inválido.'; end if;
  if coalesce(c ->> 'email', '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  if length(regexp_replace(coalesce(c ->> 'telefone', ''), '\D', '', 'g')) < 10 then raise exception 'Informe o telefone com DDD.'; end if;
  if coalesce(trim(c ->> 'logradouro'), '') = '' or coalesce(trim(c ->> 'numero'), '') = ''
     or coalesce(trim(c ->> 'cidade'), '') = '' or coalesce(trim(c ->> 'uf'), '') = '' then
    raise exception 'Preencha o endereço completo (rua, número, cidade e estado).';
  end if;
  if loja_ is null or not exists (select 1 from public.lojas where id = loja_ and ativa) then raise exception 'Escolha a loja ou canal de origem.'; end if;
  if jsonb_array_length(coalesce(dados -> 'ambientes', '[]'::jsonb)) = 0 then raise exception 'Cadastre pelo menos um ambiente.'; end if;

  -- vendedor: o vendedor é sempre quem está logado; quem vê todos pode escolher
  vendedor := eu;
  if public.ve_todos() and nullif(k ->> 'vendedor_id', '') is not null then
    vendedor := (k ->> 'vendedor_id')::uuid;
    if not exists (select 1 from public.perfis where id = vendedor and papel in ('admin', 'equipe', 'vendedor')) then
      raise exception 'Vendedor inválido.';
    end if;
  end if;
  select nome into vnome from public.perfis where id = vendedor;

  -- cliente: usa o informado, o do mesmo CPF, ou cria
  if cid is null then select id into cid from public.clientes where cpf = doc; end if;
  if cid is null then
    insert into public.clientes (nome, cpf, email, telefone, telefone2, rg, mae, nascimento, sexo, profissao,
      cep, logradouro, numero, complemento, bairro, cidade, uf, criado_por)
    values (trim(c ->> 'nome'), doc, lower(trim(c ->> 'email')), c ->> 'telefone', nullif(c ->> 'telefone2', ''),
      nullif(c ->> 'rg', ''), nullif(c ->> 'mae', ''), nullif(c ->> 'nascimento', '')::date, nullif(c ->> 'sexo', ''),
      nullif(c ->> 'profissao', ''), c ->> 'cep', c ->> 'logradouro', c ->> 'numero', nullif(c ->> 'complemento', ''),
      c ->> 'bairro', c ->> 'cidade', upper(c ->> 'uf'), eu)
    returning id into cid;
  else
    if exists (select 1 from public.clientes where cpf = doc and id <> cid) then raise exception 'Este CPF já é de outro cliente.'; end if;
    update public.clientes set nome = trim(c ->> 'nome'), cpf = doc, email = lower(trim(c ->> 'email')), telefone = c ->> 'telefone',
      telefone2 = nullif(c ->> 'telefone2', ''), rg = nullif(c ->> 'rg', ''), mae = nullif(c ->> 'mae', ''),
      nascimento = nullif(c ->> 'nascimento', '')::date, sexo = nullif(c ->> 'sexo', ''), profissao = nullif(c ->> 'profissao', ''),
      cep = c ->> 'cep', logradouro = c ->> 'logradouro', numero = c ->> 'numero', complemento = nullif(c ->> 'complemento', ''),
      bairro = c ->> 'bairro', cidade = c ->> 'cidade', uf = upper(c ->> 'uf')
    where id = cid;
  end if;

  -- contrato (o número sai da sequência no gatilho "numerar")
  begin
    insert into public.processos (cliente_id, chave_criacao, cliente_nome, cliente_cpf, cliente_email, cliente_telefone,
      cliente_nascimento, endereco, cep, bairro, cidade, data_venda, data_disponivel_medicao, tipo_prazo,
      solucao_financeira, vendedor_id, ambientes)
    values (cid, chave, trim(c ->> 'nome'), case when length(doc) = 11 then doc end, lower(trim(c ->> 'email')), c ->> 'telefone',
      nullif(c ->> 'nascimento', '')::date,
      concat_ws(' — ', concat_ws(', ', c ->> 'logradouro', c ->> 'numero') || coalesce(' - ' || nullif(c ->> 'complemento', ''), ''), c ->> 'bairro', c ->> 'cidade'),
      c ->> 'cep', c ->> 'bairro', c ->> 'cidade',
      coalesce(nullif(k ->> 'data', '')::date, current_date),
      coalesce(nullif(k ->> 'imovel_pronto', '')::date, nullif(k ->> 'data', '')::date, current_date),
      case when k ->> 'tipo' = 'Futura' then 'futuro' else 'normal' end,
      'pendente', vendedor,
      (select string_agg(x ->> 'nome', ', ') from jsonb_array_elements(dados -> 'ambientes') x))
    returning id, codigo into pid, num;
  exception when unique_violation then
    -- envio simultâneo com a mesma chave: devolve o que foi criado
    select id, codigo into pid, num from public.processos where chave_criacao = chave;
    if pid is null then raise; end if;
    return jsonb_build_object('id', pid, 'codigo', num, 'repetido', true);
  end;

  for a in select * from jsonb_array_elements(dados -> 'ambientes') loop
    i := i + 1;
    if coalesce(trim(a ->> 'nome'), '') = '' then raise exception 'Ambiente %: informe o nome.', i; end if;
    if coalesce((a ->> 'valor_bruto')::numeric, -1) < 0 then raise exception 'Ambiente %: informe o valor bruto.', i; end if;
    insert into public.ambientes (processo_id, ordem, nome, linha, tipo, fornecedor, corpo, porta, complemento, puxador, modelo,
      observacoes, qtd, prazo, valor_bruto, valor)
    values (pid, i, trim(a ->> 'nome'), a ->> 'linha', a ->> 'tipo', coalesce(nullif(a ->> 'fornecedor', ''), 'AIRAM'),
      a ->> 'corpo', a ->> 'porta', a ->> 'complemento', a ->> 'puxador', a ->> 'modelo', a ->> 'observacoes',
      coalesce(nullif(a ->> 'qtd', '')::numeric, 1), coalesce(nullif(a ->> 'prazo', '')::int, 45),
      (a ->> 'valor_bruto')::numeric, coalesce(nullif(a ->> 'valor', '')::numeric, (a ->> 'valor_bruto')::numeric));
    total := total + coalesce(nullif(a ->> 'valor', '')::numeric, (a ->> 'valor_bruto')::numeric) * coalesce(nullif(a ->> 'qtd', '')::numeric, 1);
  end loop;

  insert into public.comercial (id, vendedor_nome, captacao, loja, financeira, forma_pagamento, meios, valor_venda,
    vencimento_primeira, valor_entrada, situacao, observacao, contrato)
  values (pid, vnome, nullif(com ->> 'captacao', ''), loja_, nullif(com ->> 'financeira', ''), nullif(com ->> 'forma_pagamento', ''),
    coalesce(array(select jsonb_array_elements_text(com -> 'meios')), '{}'), total,
    nullif(com ->> 'vencimento_primeira', '')::date, nullif(com ->> 'valor_entrada', '')::numeric, 'pendente',
    nullif(com ->> 'observacao', ''), k - 'vendedor_id' - 'loja');
  insert into public.controle_interno (id) values (pid) on conflict do nothing;
  return jsonb_build_object('id', pid, 'codigo', num, 'cliente_id', cid, 'repetido', false);
end $$;
revoke all on function public.criar_contrato(jsonb) from public, anon;
grant execute on function public.criar_contrato(jsonb) to authenticated;

-- XML do Promob nos arquivos internos do contrato
update storage.buckets set allowed_mime_types = (
  select array(select distinct unnest(coalesce(allowed_mime_types, '{}') || array['application/xml', 'text/xml']))
) where id = 'documentos';

-- =============================================================================
-- 18. Lançamento: registro de acesso liberado e valores do contrato para o cliente
-- =============================================================================
alter table public.processos add column if not exists acesso_liberado_em timestamptz;

-- O cliente vê o total, os valores por ambiente (valor do contrato, nunca o bruto) e as parcelas do próprio contrato.
create or replace function public.valores_do_meu_contrato(pid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.eh_meu_processo(pid) then jsonb_build_object(
    'total', c.valor_venda,
    'condicao', c.forma_pagamento,
    'forma', c.contrato -> 'pagamento' ->> 'forma',
    'parcelas', coalesce(c.contrato -> 'pagamento' -> 'parcelas', '[]'::jsonb),
    'ambientes', coalesce((select jsonb_agg(jsonb_build_object('nome', a.nome, 'valor', coalesce(a.valor, a.valor_bruto) * a.qtd) order by a.ordem)
                           from public.ambientes a where a.processo_id = pid), '[]'::jsonb))
  end
  from public.comercial c where c.id = pid;
$$;
revoke all on function public.valores_do_meu_contrato(uuid) from public, anon;
grant execute on function public.valores_do_meu_contrato(uuid) to authenticated;

-- =============================================================================
-- 19. COMERCIAL (Etapa 1): perfis gerente e captador, leads, CRM, agendamentos,
--     lembretes, briefing e avisos para a equipe. Regras de acesso no banco.
-- =============================================================================
alter table public.perfis add column if not exists whatsapp text;

-- Permissões por papel (o master pode ligar/desligar cada uma na tela Usuários).
-- comercial = acessa a aba; comercial_todos = vê leads/agenda/métricas de todos os vendedores;
-- comercial_config = edita listas (origens, motivos de perda, colunas do CRM).
create or replace function public.tem_permissao(chave text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when papel = 'admin' then true
      when permissoes ? chave then (permissoes ->> chave)::boolean
      when papel = 'gerente' then chave in ('gestao', 'processos', 'marketing', 'ver_todos', 'comercial', 'comercial_todos')
      when papel = 'equipe' then chave in ('processos', 'marketing', 'ver_todos')
      when papel = 'vendedor' then chave in ('gestao', 'processos', 'comercial')
      when papel = 'captador' then chave in ('comercial', 'comercial_todos')
      else false end
    from public.perfis where id = auth.uid()), false);
$$;

create or replace function public.papel_atual()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.perfis where id = auth.uid();
$$;
create or replace function public.comercial_todos()
returns boolean language sql stable security definer set search_path = public as $$
  select public.eh_equipe() and public.tem_permissao('comercial') and public.tem_permissao('comercial_todos');
$$;

-- Listas configuráveis
create table if not exists public.origens_lead (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) between 2 and 60),
  ativa boolean not null default true,
  ordem int not null default 0
);
create table if not exists public.motivos_perda (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) between 2 and 80),
  pede_texto boolean not null default false,          -- "Outro": exige descrever
  ativa boolean not null default true,
  ordem int not null default 0
);
create table if not exists public.crm_colunas (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  nome text not null,
  tipo text not null default 'normal' check (tipo in ('entrada', 'normal', 'ganho', 'perdido')),
  ordem int not null default 0,
  ativa boolean not null default true
);
insert into public.origens_lead (nome, ordem) values
  ('Instagram', 1), ('Indicação', 2), ('Site', 3), ('Arquiteto', 4), ('Tráfego pago', 5), ('Link da bio', 6),
  ('Porta de loja', 7), ('Telefone da loja', 8), ('Corretores', 9), ('Parcerias', 10), ('Metrocasa', 11),
  ('Amigos pessoais', 12), ('Outro', 99)
on conflict (nome) do nothing;
insert into public.motivos_perda (nome, ordem, pede_texto) values
  ('Veio e não fechou', 1, false), ('Não compareceu', 2, false), ('Preço', 3, false), ('Prazo', 4, false),
  ('Fechou com concorrente', 5, false), ('Desistiu do projeto', 6, false), ('Outro', 99, true)
on conflict (nome) do nothing;
insert into public.crm_colunas (id, nome, tipo, ordem) values
  ('novo_cliente', 'Novo cliente', 'entrada', 10), ('nao_responde', 'Não responde', 'normal', 20),
  ('vendidos', 'Vendidos', 'ganho', 90), ('perdidos', 'Perdidos', 'perdido', 100)
on conflict (id) do nothing;

do $$
declare t text;
begin
  foreach t in array array['origens_lead', 'motivos_perda', 'crm_colunas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "comercial le" on public.%I', t);
    execute format('create policy "comercial le" on public.%I for select using (public.tem_permissao(''comercial''))', t);
    execute format('drop policy if exists "config edita" on public.%I', t);
    execute format('create policy "config edita" on public.%I for all using (public.tem_permissao(''comercial_config'')) with check (public.tem_permissao(''comercial_config''))', t);
  end loop;
end $$;

-- Leads (cartões do CRM)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 150),
  telefone text not null check (length(regexp_replace(telefone, '\D', '', 'g')) between 10 and 13),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  origem_id uuid references public.origens_lead (id),
  captador_id uuid references public.perfis (id) on delete set null default auth.uid(),
  vendedor_id uuid not null references public.perfis (id),
  coluna_id text not null default 'novo_cliente' references public.crm_colunas (id),
  posicao double precision not null default extract(epoch from now()),
  conversa_texto text check (coalesce(length(conversa_texto), 0) <= 200000),
  venda_valor numeric(12, 2) check (venda_valor is null or venda_valor > 0),
  venda_data date,
  perda_motivo_id uuid references public.motivos_perda (id),
  perda_texto text,
  primeiro_contato_em timestamptz,
  movido_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists leads_vendedor_idx on public.leads (vendedor_id, coluna_id);
create index if not exists leads_criado_idx on public.leads (criado_em);
create index if not exists leads_telefone_idx on public.leads (regexp_replace(telefone, '\D', '', 'g'));

create or replace function public.pode_ver_lead(lid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tem_permissao('comercial') and (
    public.comercial_todos() or exists (select 1 from public.leads where id = lid and vendedor_id = auth.uid()));
$$;

create table if not exists public.lead_arquivos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads on delete cascade,
  tipo text not null check (tipo in ('planta', 'referencia', 'conversa')),
  nome text not null,
  caminho text not null check (caminho like 'comercial/%'),
  mime text,
  tamanho bigint,
  enviado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads on delete cascade,
  vendedor_id uuid not null references public.perfis (id),
  inicio timestamptz not null,
  fim timestamptz,
  modalidade text not null check (modalidade in ('loja', 'online')),
  loja_id text references public.lojas (id),
  situacao text not null default 'marcado' check (situacao in ('marcado', 'compareceu', 'nao_compareceu', 'cancelado')),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint agendamento_loja check (modalidade = 'online' or loja_id is not null),
  constraint agendamento_fim check (fim is null or fim > inicio)
);
create index if not exists agendamentos_inicio_idx on public.agendamentos (inicio);
create table if not exists public.lead_eventos (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads on delete cascade,
  tipo text not null check (tipo in ('criado', 'movido', 'nota', 'agendamento', 'remarcado', 'comparecimento',
    'lembrete', 'briefing', 'vendido', 'perdido', 'editado', 'vendedor')),
  de_coluna text, para_coluna text,
  texto text check (coalesce(length(texto), 0) <= 5000),
  dados jsonb,
  por uuid default auth.uid(),
  quando timestamptz not null default now()
);
create index if not exists lead_eventos_lead_idx on public.lead_eventos (lead_id, quando);
create table if not exists public.lembretes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads on delete cascade,
  vendedor_id uuid not null references public.perfis (id),
  quando timestamptz not null,
  tipo text not null check (tipo in ('retornar_contato', 'enviar_orcamento', 'confirmar_agendamento', 'outro')),
  descricao text check (coalesce(length(descricao), 0) <= 1000),
  concluido_em timestamptz,
  notificado_em timestamptz,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists lembretes_fila_idx on public.lembretes (quando) where concluido_em is null and notificado_em is null;
create table if not exists public.briefings (
  lead_id uuid primary key references public.leads on delete cascade,
  feito boolean not null default false,
  forma text check (forma is null or forma in ('mensagem', 'ligacao')),
  data date,
  endereco text, ja_mora boolean, previsao_morar text, pessoas int check (pessoas is null or pessoas between 0 and 50),
  obra boolean, obra_detalhes text, eletros text, observacoes text,
  atualizado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now()
);
create table if not exists public.avisos_equipe (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.perfis (id) on delete set null,
  canal text not null check (canal in ('whatsapp', 'email')),
  destino text,
  evento text not null check (evento in ('novo_lead', 'lembrete', 'remarcado')),
  lead_id uuid references public.leads on delete cascade,
  lembrete_id uuid references public.lembretes on delete cascade,
  mensagem text not null,
  situacao text not null default 'pendente' check (situacao in ('pendente', 'enviado', 'falhou')),
  erro text,
  tentativas int not null default 0,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);
create index if not exists avisos_equipe_fila_idx on public.avisos_equipe (situacao, criado_em);

-- RLS: vendedor só o que é dele; gerente, captador e master veem todos
do $$
declare t text;
begin
  foreach t in array array['leads', 'lead_arquivos', 'agendamentos', 'lead_eventos', 'lembretes', 'briefings', 'avisos_equipe'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists "comercial ve leads" on public.leads;
create policy "comercial ve leads" on public.leads for select
  using (public.tem_permissao('comercial') and (public.comercial_todos() or vendedor_id = auth.uid()));
drop policy if exists "comercial cria leads" on public.leads;
create policy "comercial cria leads" on public.leads for insert
  with check (public.tem_permissao('comercial') and (public.comercial_todos() or vendedor_id = auth.uid()));
drop policy if exists "comercial edita leads" on public.leads;
create policy "comercial edita leads" on public.leads for update
  using (public.tem_permissao('comercial') and (public.comercial_todos() or vendedor_id = auth.uid()))
  with check (public.tem_permissao('comercial') and (public.comercial_todos() or vendedor_id = auth.uid()));
drop policy if exists "comercial apaga leads" on public.leads;
create policy "comercial apaga leads" on public.leads for delete
  using (public.tem_permissao('comercial') and public.tem_permissao('excluir') and (public.comercial_todos() or vendedor_id = auth.uid()));

drop policy if exists "arquivos do lead" on public.lead_arquivos;
create policy "arquivos do lead" on public.lead_arquivos for all
  using (public.pode_ver_lead(lead_id)) with check (public.pode_ver_lead(lead_id));
drop policy if exists "agenda do lead" on public.agendamentos;
create policy "agenda do lead" on public.agendamentos for all
  using (public.pode_ver_lead(lead_id)) with check (public.pode_ver_lead(lead_id));
drop policy if exists "eventos do lead" on public.lead_eventos;
create policy "eventos do lead" on public.lead_eventos for select using (public.pode_ver_lead(lead_id));
drop policy if exists "notas do lead" on public.lead_eventos;
create policy "notas do lead" on public.lead_eventos for insert
  with check (public.pode_ver_lead(lead_id) and tipo = 'nota' and por = auth.uid());
-- lembretes: do vendedor do lead (o captador não cria lembretes)
drop policy if exists "lembretes" on public.lembretes;
create policy "lembretes" on public.lembretes for all
  using (public.pode_ver_lead(lead_id) and (public.papel_atual() <> 'captador'))
  with check (public.pode_ver_lead(lead_id) and public.papel_atual() <> 'captador');
drop policy if exists "briefing" on public.briefings;
create policy "briefing" on public.briefings for all
  using (public.pode_ver_lead(lead_id)) with check (public.pode_ver_lead(lead_id) and public.papel_atual() <> 'captador');
drop policy if exists "avisos equipe" on public.avisos_equipe;
create policy "avisos equipe" on public.avisos_equipe for select
  using (usuario_id = auth.uid() or public.comercial_todos());

-- Regras do cartão (no banco: valem mesmo que alguém altere a tela)
create or replace function public.regras_lead()
returns trigger language plpgsql security definer set search_path = public as $$
declare col public.crm_colunas; motivo public.motivos_perda; meu_papel text := public.papel_atual();
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' then
    -- vendedor que cadastra o próprio lead fica como responsável; captador escolhe qualquer vendedor ativo
    if not public.comercial_todos() then new.vendedor_id := auth.uid(); end if;
    if not exists (select 1 from public.perfis p where p.id = new.vendedor_id and p.papel in ('vendedor', 'gerente', 'admin')) then
      raise exception 'Escolha um vendedor válido.';
    end if;
    new.coluna_id := coalesce((select id from public.crm_colunas where tipo = 'entrada' and ativa order by ordem limit 1), 'novo_cliente');
    new.captador_id := auth.uid();
    new.criado_em := now(); new.movido_em := now();
    new.venda_valor := null; new.venda_data := null; new.perda_motivo_id := null; new.perda_texto := null;
    return new;
  end if;
  -- troca de vendedor: só gerente, captador ou master (quem vê todos)
  if new.vendedor_id is distinct from old.vendedor_id and not public.comercial_todos() then
    raise exception 'Somente o gerente pode trocar o vendedor responsável.';
  end if;
  if new.captador_id is distinct from old.captador_id or new.criado_em is distinct from old.criado_em then
    raise exception 'Captador e data de cadastro não podem ser alterados.';
  end if;
  if new.coluna_id is distinct from old.coluna_id then
    if meu_papel = 'captador' then raise exception 'O captador não move cartões no CRM.'; end if;
    select * into col from public.crm_colunas where id = new.coluna_id;
    if col.id is null or not col.ativa then raise exception 'Coluna inválida.'; end if;
    new.movido_em := now();
    if col.tipo = 'ganho' then
      if new.venda_valor is null or new.venda_valor <= 0 or new.venda_data is null then
        raise exception 'Para marcar como vendido, informe o valor da venda e a data de fechamento.';
      end if;
      new.perda_motivo_id := null; new.perda_texto := null;
    elsif col.tipo = 'perdido' then
      select * into motivo from public.motivos_perda where id = new.perda_motivo_id;
      if motivo.id is null then raise exception 'Para marcar como perdido, informe o motivo da perda.'; end if;
      if motivo.pede_texto and coalesce(trim(new.perda_texto), '') = '' then raise exception 'Descreva o motivo da perda.'; end if;
      new.venda_valor := null; new.venda_data := null;
    else
      new.venda_valor := null; new.venda_data := null; new.perda_motivo_id := null; new.perda_texto := null;
    end if;
  elsif meu_papel = 'captador' and (new.venda_valor is distinct from old.venda_valor or new.venda_data is distinct from old.venda_data
        or new.perda_motivo_id is distinct from old.perda_motivo_id) then
    raise exception 'O captador não registra venda nem perda.';
  end if;
  return new;
end $$;
drop trigger if exists regras on public.leads;
create trigger regras before insert or update on public.leads for each row execute function public.regras_lead();

-- Histórico automático (base dos relatórios: movimentações, primeiro contato, tempo parado)
create or replace function public.historico_lead()
returns trigger language plpgsql security definer set search_path = public as $$
declare col_tipo text;
begin
  if tg_op = 'INSERT' then
    insert into public.lead_eventos (lead_id, tipo, para_coluna, por, dados)
    values (new.id, 'criado', new.coluna_id, auth.uid(), jsonb_build_object('vendedor_id', new.vendedor_id, 'origem_id', new.origem_id));
    return new;
  end if;
  if new.coluna_id is distinct from old.coluna_id then
    select tipo into col_tipo from public.crm_colunas where id = new.coluna_id;
    insert into public.lead_eventos (lead_id, tipo, de_coluna, para_coluna, por, dados, texto)
    values (new.id, case col_tipo when 'ganho' then 'vendido' when 'perdido' then 'perdido' else 'movido' end,
      old.coluna_id, new.coluna_id, auth.uid(),
      case col_tipo when 'ganho' then jsonb_build_object('valor', new.venda_valor, 'data', new.venda_data)
                    when 'perdido' then jsonb_build_object('motivo_id', new.perda_motivo_id) end,
      case when col_tipo = 'perdido' then new.perda_texto end);
  end if;
  if new.vendedor_id is distinct from old.vendedor_id then
    insert into public.lead_eventos (lead_id, tipo, por, dados)
    values (new.id, 'vendedor', auth.uid(), jsonb_build_object('de', old.vendedor_id, 'para', new.vendedor_id));
    update public.agendamentos set vendedor_id = new.vendedor_id where lead_id = new.id;
    update public.lembretes set vendedor_id = new.vendedor_id where lead_id = new.id and concluido_em is null;
  end if;
  if (new.nome, new.telefone, new.email, new.origem_id) is distinct from (old.nome, old.telefone, old.email, old.origem_id) then
    insert into public.lead_eventos (lead_id, tipo, por, dados) values (new.id, 'editado', auth.uid(),
      jsonb_build_object('antes', jsonb_build_object('nome', old.nome, 'telefone', old.telefone, 'email', old.email, 'origem_id', old.origem_id)));
  end if;
  return new;
end $$;
drop trigger if exists historico on public.leads;
create trigger historico after insert or update on public.leads for each row execute function public.historico_lead();

-- Primeiro contato: a primeira movimentação ou anotação feita pelo vendedor responsável
create or replace function public.primeiro_contato()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo in ('movido', 'nota', 'vendido', 'perdido', 'briefing', 'lembrete') then
    update public.leads set primeiro_contato_em = new.quando
    where id = new.lead_id and primeiro_contato_em is null and vendedor_id = new.por;
  end if;
  return new;
end $$;
drop trigger if exists primeiro_contato on public.lead_eventos;
create trigger primeiro_contato after insert on public.lead_eventos for each row execute function public.primeiro_contato();

-- Agendamento: vendedor = o do lead; remarcação e comparecimento ficam no histórico
create or replace function public.regras_agendamento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.vendedor_id := (select vendedor_id from public.leads where id = new.lead_id);
  new.atualizado_em := now();
  if new.modalidade = 'online' then new.loja_id := null; end if;
  if tg_op = 'INSERT' then
    insert into public.lead_eventos (lead_id, tipo, por, dados)
    values (new.lead_id, 'agendamento', auth.uid(), jsonb_build_object('inicio', new.inicio, 'modalidade', new.modalidade, 'loja_id', new.loja_id));
  else
    if (new.inicio, new.modalidade, new.loja_id) is distinct from (old.inicio, old.modalidade, old.loja_id) then
      insert into public.lead_eventos (lead_id, tipo, por, dados) values (new.lead_id, 'remarcado', auth.uid(),
        jsonb_build_object('antes', jsonb_build_object('inicio', old.inicio, 'modalidade', old.modalidade, 'loja_id', old.loja_id),
                           'depois', jsonb_build_object('inicio', new.inicio, 'modalidade', new.modalidade, 'loja_id', new.loja_id)));
    end if;
    if new.situacao is distinct from old.situacao then
      insert into public.lead_eventos (lead_id, tipo, por, dados)
      values (new.lead_id, 'comparecimento', auth.uid(), jsonb_build_object('de', old.situacao, 'para', new.situacao));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists regras on public.agendamentos;
create trigger regras before insert or update on public.agendamentos for each row execute function public.regras_agendamento();

-- Lembrete: sempre do vendedor do lead
create or replace function public.regras_lembrete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.vendedor_id := (select vendedor_id from public.leads where id = new.lead_id);
  if tg_op = 'INSERT' then
    insert into public.lead_eventos (lead_id, tipo, por, texto, dados)
    values (new.lead_id, 'lembrete', auth.uid(), new.descricao, jsonb_build_object('quando', new.quando, 'tipo', new.tipo));
  elsif new.quando is distinct from old.quando then
    new.notificado_em := null; -- remarcado: avisa de novo no novo horário
  end if;
  return new;
end $$;
drop trigger if exists regras on public.lembretes;
create trigger regras before insert or update on public.lembretes for each row execute function public.regras_lembrete();

-- Briefing marcado/atualizado entra no histórico
create or replace function public.historico_briefing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.atualizado_em := now(); new.atualizado_por := auth.uid();
  if tg_op = 'INSERT' or new.feito is distinct from old.feito then
    insert into public.lead_eventos (lead_id, tipo, por, dados)
    values (new.lead_id, 'briefing', auth.uid(), jsonb_build_object('feito', new.feito, 'forma', new.forma));
  end if;
  return new;
end $$;
drop trigger if exists historico on public.briefings;
create trigger historico before insert or update on public.briefings for each row execute function public.historico_briefing();

do $$
declare t text;
begin
  foreach t in array array['leads', 'agendamentos', 'lembretes', 'briefings', 'lead_arquivos', 'origens_lead', 'motivos_perda', 'crm_colunas'] loop
    execute format('drop trigger if exists auditoria on public.%I', t);
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_atividade()', t);
  end loop;
end $$;

-- Arquivos do lead: documentos/comercial/<lead>/...
drop policy if exists "comercial arquivos" on storage.objects;
create policy "comercial arquivos" on storage.objects for all
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = 'comercial'
    and public.pode_ver_lead(case when (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$' then ((storage.foldername(name))[2])::uuid end))
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = 'comercial'
    and public.pode_ver_lead(case when (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$' then ((storage.foldername(name))[2])::uuid end));
update storage.buckets set allowed_mime_types = (
  select array(select distinct unnest(coalesce(allowed_mime_types, '{}') || array['text/plain', 'image/heic']))
) where id = 'documentos';

-- Master define papel, permissões e WhatsApp. O master nunca pode ser rebaixado por outro, e sempre sobra um master.
drop function if exists public.definir_acesso(uuid, text, jsonb, text);
create or replace function public.definir_acesso(usuario uuid, novo_papel text, novas_permissoes jsonb, novo_nome text default null, novo_whatsapp text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Somente o master pode mudar acessos.'; end if;
  if novo_papel not in ('admin', 'gerente', 'equipe', 'vendedor', 'captador') then raise exception 'Papel inválido.'; end if;
  if usuario = auth.uid() and novo_papel <> 'admin' then raise exception 'Você não pode tirar o seu próprio acesso de master.'; end if;
  if exists (select 1 from public.perfis where id = usuario and papel = 'cliente') then raise exception 'Este usuário é um cliente do portal.'; end if;
  if novo_papel <> 'admin' and exists (select 1 from public.perfis where id = usuario and papel = 'admin')
     and (select count(*) from public.perfis where papel = 'admin') <= 1 then
    raise exception 'O sistema precisa de pelo menos um master.';
  end if;
  if novo_whatsapp is not null and length(regexp_replace(novo_whatsapp, '\D', '', 'g')) not between 10 and 13 then
    raise exception 'WhatsApp inválido (use DDD + número).';
  end if;
  update public.perfis set papel = novo_papel, permissoes = coalesce(novas_permissoes, '{}'::jsonb),
    nome = coalesce(nullif(novo_nome, ''), nome),
    whatsapp = coalesce(nullif(regexp_replace(coalesce(novo_whatsapp, ''), '\D', '', 'g'), ''), whatsapp)
  where id = usuario;
end $$;
revoke execute on function public.definir_acesso(uuid, text, jsonb, text, text) from anon;

-- Vendedores ativos (para o captador escolher o responsável)
create or replace function public.vendedores_comercial()
returns table (id uuid, nome text, email text, papel text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.email, p.papel from public.perfis p
  where public.tem_permissao('comercial') and p.papel in ('vendedor', 'gerente')
    and (public.comercial_todos() or p.id = auth.uid())
  order by p.nome;
$$;
