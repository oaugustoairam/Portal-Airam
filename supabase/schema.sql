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
alter table public.perfis add constraint perfis_papel_check check (papel in ('admin', 'equipe', 'vendedor', 'cliente'));

-- Funcionário = papel admin, equipe ou vendedor. Papéis só mudam pelo SQL Editor ou pelas
-- funções do servidor; o app não consegue alterar.
create or replace function public.eh_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel in ('admin', 'equipe', 'vendedor'));
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
create unique index if not exists processos_cpf_idx on public.processos (cliente_cpf) where cliente_cpf is not null;
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
