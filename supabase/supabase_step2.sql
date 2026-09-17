-- ============================================================================
-- Riskguard — Etapa 2: senha de equipamento, revisão de risco, mensagens
-- JÁ APLICADO no projeto Supabase (Banco_Riskguard) em setembro/2026.
-- Este arquivo fica aqui só como registro/histórico — não precisa rodar de
-- novo. Se precisar recriar o ambiente do zero, rode DEPOIS de
-- supabase_missing_rpc.sql e da migration que criou client_users.role.
-- ============================================================================


-- ============================================================================
-- PARTE A — Senha do equipamento
--
-- Decisão de design: a senha NUNCA fica na tabela `devices`. Se ficasse lá,
-- qualquer `select('*').from('devices')` do frontend (que já existe em
-- Devices.tsx/DeviceDetail.tsx) traria o hash junto pro navegador do gestor
-- — não é a senha em texto puro, mas não devia estar trafegando de graça
-- mesmo assim. Por isso o hash mora numa tabela separada, `device_credentials`,
-- SEM nenhuma policy de SELECT pra usuários comuns: a única forma de
-- ler/escrever nela é via as duas funções abaixo (SECURITY DEFINER).
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.device_credentials (
  device_id     uuid primary key references public.devices(id) on delete cascade,
  password_hash text not null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id)
);

alter table public.device_credentials enable row level security;
-- Propositalmente sem nenhuma "create policy" aqui: com RLS ligado e zero
-- policies, ninguém acessa essa tabela via PostgREST (anon/authenticated),
-- nem pra leitura. Só as funções SECURITY DEFINER abaixo (que rodam como
-- dono da função, ignorando RLS) conseguem tocar nela.

-- Define/troca a senha de um equipamento. Só o gestor dono do client_id do
-- equipamento (ou staff da seguradora) pode chamar. Nunca retorna o hash.
create or replace function public.riskguard_set_device_password(
  p_device_id uuid,
  p_senha text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_client_id uuid;
  caller_role text;
  caller_is_staff boolean;
  target_client_id uuid;
begin
  select client_id, role, is_sompo_staff
    into caller_client_id, caller_role, caller_is_staff
  from public.client_users
  where user_id = auth.uid();

  select client_id into target_client_id
  from public.devices
  where id = p_device_id;

  if target_client_id is null then
    raise exception 'Equipamento não encontrado';
  end if;

  if not (caller_is_staff or (caller_role = 'gestor' and caller_client_id = target_client_id)) then
    raise exception 'Não autorizado a definir a senha deste equipamento';
  end if;

  if p_senha is null or length(p_senha) < 4 then
    raise exception 'A senha precisa ter pelo menos 4 caracteres';
  end if;

  insert into public.device_credentials (device_id, password_hash, updated_at, updated_by)
  values (p_device_id, crypt(p_senha, gen_salt('bf')), now(), auth.uid())
  on conflict (device_id)
  do update set password_hash = excluded.password_hash,
                updated_at = now(),
                updated_by = auth.uid();
end;
$$;

revoke all on function public.riskguard_set_device_password(uuid, text) from public;
grant execute on function public.riskguard_set_device_password(uuid, text) to authenticated;

-- Só diz SE existe senha e quando foi trocada pela última vez — nunca o
-- hash. É o que a UI usa pra mostrar "senha definida em dd/mm" ou não.
create or replace function public.riskguard_get_device_password_status(p_device_id uuid)
returns table(has_password boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_client_id uuid;
  caller_is_staff boolean;
  target_client_id uuid;
begin
  select client_id, is_sompo_staff into caller_client_id, caller_is_staff
  from public.client_users
  where user_id = auth.uid();

  select client_id into target_client_id
  from public.devices
  where id = p_device_id;

  if not (caller_is_staff or caller_client_id = target_client_id) then
    raise exception 'Não autorizado';
  end if;

  return query
  select true, dc.updated_at
  from public.device_credentials dc
  where dc.device_id = p_device_id
  union all
  select false, null::timestamptz
  where not exists (select 1 from public.device_credentials where device_id = p_device_id)
  limit 1;
end;
$$;

grant execute on function public.riskguard_get_device_password_status(uuid) to authenticated;


-- ============================================================================
-- PARTE B — Revisão de alertas de risco
--
-- Mesmo padrão de supabase_missing_rpc.sql (resolve_theft_event): colunas
-- novas + função SECURITY DEFINER fazendo o UPDATE, em vez de abrir uma
-- policy de UPDATE ampla na tabela pro client autenticado.
-- ============================================================================

alter table public.risk_scores
  add column if not exists acknowledged_by uuid references auth.users(id),
  add column if not exists acknowledged_at timestamptz,
  add column if not exists resolution_notes text;

create or replace function public.riskguard_acknowledge_risk_score(
  p_score_id bigint,
  p_notes text default null
)
returns public.risk_scores
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.risk_scores;
  caller_client_id uuid;
  caller_is_staff boolean;
  score_client_id uuid;
begin
  select client_id, is_sompo_staff into caller_client_id, caller_is_staff
  from public.client_users
  where user_id = auth.uid();

  select d.client_id into score_client_id
  from public.risk_scores rs
  join public.devices d on d.id = rs.device_id
  where rs.id = p_score_id;

  if not (caller_is_staff or caller_client_id = score_client_id) then
    raise exception 'Não autorizado a revisar este score de risco';
  end if;

  update public.risk_scores
  set acknowledged_by = auth.uid(),
      acknowledged_at = now(),
      resolution_notes = p_notes
  where id = p_score_id
  returning * into updated_row;

  return updated_row;
end;
$$;

revoke all on function public.riskguard_acknowledge_risk_score(bigint, text) from public;
grant execute on function public.riskguard_acknowledge_risk_score(bigint, text) to authenticated;


-- ============================================================================
-- PARTE C — Mensagens pro operador
--
-- RLS de verdade aqui (SELECT/INSERT abertos pro próprio client_id), porque
-- é uma tabela de conversa normal, não um dado sensível tipo senha. Marcar
-- como lida vai por RPC mesmo assim, pra não abrir UPDATE geral na tabela
-- (um operador não deveria poder editar o texto de uma mensagem do gestor).
-- ============================================================================

create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  client_id   uuid not null,
  device_id   uuid references public.devices(id) on delete set null,
  sender_id   uuid references auth.users(id),
  sender_type text not null check (sender_type in ('gestor', 'operador', 'ia')),
  severity    text not null default 'info' check (severity in ('info', 'medio', 'grave')),
  body        text not null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

create index if not exists messages_client_id_created_at_idx
  on public.messages (client_id, created_at desc);

create index if not exists messages_device_id_idx
  on public.messages (device_id);

alter table public.messages enable row level security;

drop policy if exists "messages_select_same_client" on public.messages;
create policy "messages_select_same_client"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.client_users cu
      where cu.user_id = auth.uid()
        and (cu.is_sompo_staff or cu.client_id = messages.client_id)
    )
  );

drop policy if exists "messages_insert_same_client" on public.messages;
create policy "messages_insert_same_client"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and sender_type in ('gestor', 'operador')
    and exists (
      select 1 from public.client_users cu
      where cu.user_id = auth.uid()
        and cu.client_id = messages.client_id
        and cu.role = messages.sender_type
    )
  );

-- Marca uma mensagem como lida (só read_at muda, nunca o corpo). Qualquer
-- membro do client_id da mensagem pode marcar como lida.
create or replace function public.riskguard_mark_message_read(p_message_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_client_id uuid;
  caller_is_staff boolean;
  msg_client_id uuid;
begin
  select client_id, is_sompo_staff into caller_client_id, caller_is_staff
  from public.client_users
  where user_id = auth.uid();

  select client_id into msg_client_id
  from public.messages
  where id = p_message_id;

  if not (caller_is_staff or caller_client_id = msg_client_id) then
    raise exception 'Não autorizado';
  end if;

  update public.messages
  set read_at = now()
  where id = p_message_id
    and read_at is null;
end;
$$;

revoke all on function public.riskguard_mark_message_read(bigint) from public;
grant execute on function public.riskguard_mark_message_read(bigint) to authenticated;
