-- Portal Airam — estrutura do banco (Supabase / Postgres)
-- Execute no Supabase: SQL Editor > New query > cole tudo e rode.
-- Pode rodar de novo depois de mudanças: os comandos são idempotentes.

-- 1. Perfis -----------------------------------------------------------------
-- papel: 'admin' (gerência), 'equipe' (funcionários) ou 'cliente'
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

-- Funcionário = papel admin ou equipe. Papéis só mudam pelo SQL Editor ou pelas
-- funções do servidor; o app não consegue alterar.
create or replace function public.eh_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel in ('admin', 'equipe'));
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
  cliente_email text not null,                 -- login do cliente
  cliente_telefone text,
  endereco text,
  ambientes text,                              -- ex.: cozinha, suíte, home office
  data_venda date not null,
  data_disponivel_medicao date not null,       -- quando o imóvel fica disponível para medir
  -- Regra Airam: até 90 dias entre a venda e a disponibilidade para medição = Normal; acima = Futuro
  tipo_prazo text generated always as (
    case when data_disponivel_medicao - data_venda <= 90 then 'normal' else 'futuro' end
  ) stored,
  solucao_financeira text not null default 'pendente' check (solucao_financeira in ('ok', 'pendente')),
  data_medicao date,
  medicao_concluida boolean not null default false,
  data_conferencia date,                       -- conferência do projeto final
  conferencia_concluida boolean not null default false,
  data_assinatura_projeto date,                -- assinatura do projeto final
  projeto_assinado_manual boolean not null default false,  -- assinado fora do ZapSign
  data_entrega_prevista date not null,         -- prazo do cliente (obrigatório)
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
  using (categoria <> 'medicao' and public.eh_meu_processo(processo_id));

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
  'image/vnd.dwg', 'application/acad', 'application/octet-stream'
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
      'Seu projeto inicial está disponível no Portal Airam, em Documentos.');
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
