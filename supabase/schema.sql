-- Portal do Cliente — estrutura do banco (Supabase / Postgres)
-- Execute no Supabase: SQL Editor > New query > cole e rode.

-- 1. Perfis -----------------------------------------------------------------
create table if not exists public.perfis (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  nome text,
  papel text not null default 'cliente' check (papel in ('admin', 'cliente')),
  criado_em timestamptz not null default now()
);

-- Cria o perfil automaticamente quando alguém entra pela primeira vez
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

-- Administrador = papel 'admin' na tabela perfis (só muda pelo SQL Editor; o app não consegue alterar).
create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'admin');
$$;

-- 2. Projetos ---------------------------------------------------------------
create table if not exists public.projetos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cliente_nome text,
  cliente_email text not null,          -- o cliente acessa com este e-mail
  endereco text,
  descricao text,
  data_inicio date,
  prazo_final date,
  criado_em timestamptz not null default now()
);

-- 3. Fases ------------------------------------------------------------------
create table if not exists public.fases (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos on delete cascade,
  ordem int not null default 0,
  nome text not null,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida')),
  data_inicio date,
  data_prevista date,
  data_conclusao date,
  observacao text
);

-- 4. Documentos -------------------------------------------------------------
create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos on delete cascade,
  fase_id uuid references public.fases on delete set null,
  categoria text not null check (categoria in ('contrato', 'projeto_inicial', 'render', 'projeto_final', 'outro')),
  titulo text not null,
  arquivo_path text not null,
  tipo_mime text,
  criado_em timestamptz not null default now()
);

-- 5. Segurança (Row Level Security) ---------------------------------------
alter table public.perfis enable row level security;
alter table public.projetos enable row level security;
alter table public.fases enable row level security;
alter table public.documentos enable row level security;

-- E-mail do usuário logado, somente se ele já foi confirmado (link mágico clicado).
-- Impede que alguém crie uma conta com o e-mail de um cliente sem ter acesso à caixa de entrada.
create or replace function public.meu_email_confirmado()
returns text language sql stable security definer set search_path = public, auth as $$
  select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null;
$$;

create or replace function public.eh_meu_projeto(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projetos
    where id = p and lower(cliente_email) = public.meu_email_confirmado()
  );
$$;

drop policy if exists "perfil proprio" on public.perfis;
create policy "perfil proprio" on public.perfis for select
  using (id = auth.uid() or public.eh_admin());

drop policy if exists "admin projetos" on public.projetos;
create policy "admin projetos" on public.projetos for all
  using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "cliente ve projeto" on public.projetos;
create policy "cliente ve projeto" on public.projetos for select
  using (lower(cliente_email) = public.meu_email_confirmado());

drop policy if exists "admin fases" on public.fases;
create policy "admin fases" on public.fases for all
  using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "cliente ve fases" on public.fases;
create policy "cliente ve fases" on public.fases for select
  using (public.eh_meu_projeto(projeto_id));

drop policy if exists "admin documentos" on public.documentos;
create policy "admin documentos" on public.documentos for all
  using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "cliente ve documentos" on public.documentos;
create policy "cliente ve documentos" on public.documentos for select
  using (public.eh_meu_projeto(projeto_id));

-- 6. Arquivos (Storage) — bucket privado; caminho: <projeto_id>/<arquivo>
-- Limite de 50 MB por arquivo e só tipos esperados (PDF, imagens, DWG).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 52428800, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'image/vnd.dwg', 'application/acad', 'application/octet-stream'
])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin arquivos" on storage.objects;
create policy "admin arquivos" on storage.objects for all
  using (bucket_id = 'documentos' and public.eh_admin())
  with check (bucket_id = 'documentos' and public.eh_admin());
drop policy if exists "cliente le arquivos" on storage.objects;
create policy "cliente le arquivos" on storage.objects for select
  using (bucket_id = 'documentos' and public.eh_meu_projeto(
    case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         then ((storage.foldername(name))[1])::uuid end));

-- 7. Registro de atividades (auditoria) --------------------------------------
-- Guarda quem criou, alterou ou apagou projetos, etapas e documentos, e quando.
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
-- sem políticas de insert/update/delete: ninguém altera o registro pelo app

create or replace function public.registrar_atividade()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.registro_atividades (usuario_id, usuario_email, tabela, acao, registro_id, antes, depois)
  values (
    auth.uid(), auth.jwt() ->> 'email', tg_table_name, tg_op,
    coalesce((case when tg_op = 'DELETE' then old.id else new.id end), null),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

drop trigger if exists auditoria on public.projetos;
create trigger auditoria after insert or update or delete on public.projetos
  for each row execute function public.registrar_atividade();
drop trigger if exists auditoria on public.fases;
create trigger auditoria after insert or update or delete on public.fases
  for each row execute function public.registrar_atividade();
drop trigger if exists auditoria on public.documentos;
create trigger auditoria after insert or update or delete on public.documentos
  for each row execute function public.registrar_atividade();

-- 8. Depois de entrar no portal pela primeira vez com o e-mail do escritório,
--    torne-se administrador rodando (troque o e-mail):
-- update public.perfis set papel = 'admin' where email = 'voce@seuescritorio.com.br';
