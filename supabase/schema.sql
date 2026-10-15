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
