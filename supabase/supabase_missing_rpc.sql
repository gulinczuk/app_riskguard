-- Riskguard: função RPC faltante para resolver eventos de furto.
-- Rode isso no SQL editor do Supabase (Project → SQL Editor).
--
-- O prompt original previa `resolve_theft_event(event_id, resolved_by)`,
-- mas essa função ainda não existe no banco atual, e a tabela theft_events
-- não tem coluna para guardar quem resolveu. Este script adiciona a coluna
-- e cria a função como SECURITY DEFINER (necessário porque o UPDATE direto
-- na tabela é bloqueado por policy/trigger para usuários comuns).

-- 1. Adiciona coluna para registrar quem resolveu o evento.
alter table public.theft_events
  add column if not exists resolved_by uuid references auth.users(id);

-- 2. Função RPC. Ajuste o "using (...)" se você já tiver uma policy de RLS
--    diferente controlando quem pode resolver eventos (ex: apenas
--    is_sompo_staff ou o client_id dono do device).
create or replace function public.resolve_theft_event(
  event_id bigint,
  resolved_by uuid
)
returns public.theft_events
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.theft_events;
  caller_client_id uuid;
  caller_is_staff boolean;
  event_client_id uuid;
begin
  -- Confere que quem está chamando tem acesso ao device do evento
  -- (mesma lógica de RLS que já existe nas outras tabelas).
  select client_id, is_sompo_staff into caller_client_id, caller_is_staff
  from public.client_users
  where user_id = auth.uid();

  select d.client_id into event_client_id
  from public.theft_events te
  join public.devices d on d.id = te.device_id
  where te.id = event_id;

  if not (caller_is_staff or caller_client_id = event_client_id) then
    raise exception 'Não autorizado a resolver este evento';
  end if;

  update public.theft_events
  set resolved = true,
      resolved_at = now(),
      resolved_by = resolve_theft_event.resolved_by
  where id = event_id
  returning * into updated_row;

  return updated_row;
end;
$$;

-- 3. Libera execução para usuários autenticados (a checagem de permissão
--    real acontece dentro da função, acima).
grant execute on function public.resolve_theft_event(bigint, uuid) to authenticated;
